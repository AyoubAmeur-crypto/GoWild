import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  AuthenticatedUser,
  Booking,
  BookingStatus,
  CurrencyCode,
  LanguageCode,
  RevalidatedOffer,
} from "../../src/types/domain.ts";

export interface StoredUserAccountRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string;
  nationality: string | null;
  preferred_currency: CurrencyCode;
  preferred_language: LanguageCode;
  created_at: string;
}

export interface GatewayBookingRecord {
  booking: Booking;
  userId: string | null;
  clientToken: string | null;
}

export interface GatewayStorage {
  readonly backend: "sqlite" | "memory";
  createUser(params: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone: string;
    nationality?: string;
    preferredCurrency: CurrencyCode;
    preferredLanguage: LanguageCode;
  }): AuthenticatedUser;
  findUserByEmail(email: string): StoredUserAccountRow | undefined;
  findUserById(id: string): AuthenticatedUser | undefined;
  updateUserProfile(
    userId: string,
    patch: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      nationality?: string;
      preferredCurrency?: CurrencyCode;
      preferredLanguage?: LanguageCode;
    }
  ): AuthenticatedUser | undefined;
  createSession(tokenHash: string, userId: string, ttlDays?: number): void;
  getUserBySessionHash(tokenHash: string): AuthenticatedUser | undefined;
  deleteSession(tokenHash: string): void;
  listFavorites(userId: string): string[];
  addFavorite(userId: string, hotelId: string): void;
  removeFavorite(userId: string, hotelId: string): void;
  saveOfferQuote(quote: RevalidatedOffer): void;
  getOfferQuote(quoteId: string): RevalidatedOffer | undefined;
  findBookingByIdempotencyKey(idempotencyKey: string): Booking | undefined;
  saveBooking(
    booking: Booking,
    owner: { userId?: string; clientToken?: string }
  ): Booking;
  getBookingById(bookingId: string): Booking | undefined;
  getBookingRecordById(bookingId: string): GatewayBookingRecord | undefined;
  listBookings(filter: { userId?: string; clientToken?: string }): Booking[];
  updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    cancelledAt?: string
  ): Booking | undefined;
  close(): void;
}

interface SqlitePreparedLike {
  run: (...args: unknown[]) => unknown;
  get: (...args: unknown[]) => unknown;
  all: (...args: unknown[]) => unknown[];
}

interface SqliteDatabaseLike {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqlitePreparedLike;
  close: () => void;
}

interface NodeSqliteModuleLike {
  DatabaseSync: new (filename: string) => SqliteDatabaseLike;
}

function mapUserRow(row: StoredUserAccountRow): AuthenticatedUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    nationality: row.nationality ?? undefined,
    preferredCurrency: row.preferred_currency,
    preferredLanguage: row.preferred_language,
    createdAt: row.created_at,
  };
}

/**
 * Edge/Serverless-safe in-memory GatewayStorage implementation.
 * Used automatically when running in edge isolates (e.g., EAS Hosting / Cloudflare Workers)
 * where `node:sqlite` is unavailable.
 */
export class InMemoryGatewayStorage implements GatewayStorage {
  public readonly backend = "memory" as const;

  private readonly usersById = new Map<string, StoredUserAccountRow>();
  private readonly userIdByEmail = new Map<string, string>();
  private readonly sessions = new Map<string, { userId: string; expiresAt: string }>();
  private readonly favoritesByUser = new Map<string, Set<string>>();
  private readonly quotes = new Map<string, RevalidatedOffer>();
  private readonly bookingsById = new Map<string, GatewayBookingRecord>();
  private readonly bookingIdByIdem = new Map<string, string>();

  public createUser(params: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone: string;
    nationality?: string;
    preferredCurrency: CurrencyCode;
    preferredLanguage: LanguageCode;
  }): AuthenticatedUser {
    const id = `usr_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const emailNorm = params.email.trim().toLowerCase();

    const row: StoredUserAccountRow = {
      id,
      email: emailNorm,
      password_hash: params.passwordHash,
      first_name: params.firstName.trim(),
      last_name: params.lastName.trim(),
      phone: params.phone.trim(),
      nationality: params.nationality ?? null,
      preferred_currency: params.preferredCurrency,
      preferred_language: params.preferredLanguage,
      created_at: createdAt,
    };

    this.usersById.set(id, row);
    this.userIdByEmail.set(emailNorm, id);
    return mapUserRow(row);
  }

  public findUserByEmail(email: string): StoredUserAccountRow | undefined {
    const id = this.userIdByEmail.get(email.trim().toLowerCase());
    if (!id) return undefined;
    return this.usersById.get(id);
  }

  public findUserById(id: string): AuthenticatedUser | undefined {
    const row = this.usersById.get(id);
    return row ? mapUserRow(row) : undefined;
  }

  public updateUserProfile(
    userId: string,
    patch: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      nationality?: string;
      preferredCurrency?: CurrencyCode;
      preferredLanguage?: LanguageCode;
    }
  ): AuthenticatedUser | undefined {
    const existing = this.usersById.get(userId);
    if (!existing) return undefined;

    const updated: StoredUserAccountRow = {
      ...existing,
      first_name: patch.firstName ?? existing.first_name,
      last_name: patch.lastName ?? existing.last_name,
      phone: patch.phone ?? existing.phone,
      nationality:
        patch.nationality !== undefined ? patch.nationality : existing.nationality,
      preferred_currency: patch.preferredCurrency ?? existing.preferred_currency,
      preferred_language: patch.preferredLanguage ?? existing.preferred_language,
    };

    this.usersById.set(userId, updated);
    return mapUserRow(updated);
  }

  public createSession(tokenHash: string, userId: string, ttlDays: number = 30): void {
    const expires = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
    this.sessions.set(tokenHash, { userId, expiresAt: expires });
  }

  public getUserBySessionHash(tokenHash: string): AuthenticatedUser | undefined {
    const sess = this.sessions.get(tokenHash);
    if (!sess) return undefined;
    if (sess.expiresAt <= new Date().toISOString()) {
      this.sessions.delete(tokenHash);
      return undefined;
    }
    return this.findUserById(sess.userId);
  }

  public deleteSession(tokenHash: string): void {
    this.sessions.delete(tokenHash);
  }

  public listFavorites(userId: string): string[] {
    return Array.from(this.favoritesByUser.get(userId) ?? []).reverse();
  }

  public addFavorite(userId: string, hotelId: string): void {
    let set = this.favoritesByUser.get(userId);
    if (!set) {
      set = new Set<string>();
      this.favoritesByUser.set(userId, set);
    }
    set.add(hotelId);
  }

  public removeFavorite(userId: string, hotelId: string): void {
    this.favoritesByUser.get(userId)?.delete(hotelId);
  }

  public saveOfferQuote(quote: RevalidatedOffer): void {
    this.quotes.set(quote.quoteId, quote);
  }

  public getOfferQuote(quoteId: string): RevalidatedOffer | undefined {
    return this.quotes.get(quoteId);
  }

  public findBookingByIdempotencyKey(idempotencyKey: string): Booking | undefined {
    const id = this.bookingIdByIdem.get(idempotencyKey);
    if (!id) return undefined;
    return this.bookingsById.get(id)?.booking;
  }

  public saveBooking(
    booking: Booking,
    owner: { userId?: string; clientToken?: string }
  ): Booking {
    this.bookingsById.set(booking.id, {
      booking,
      userId: owner.userId ?? null,
      clientToken: owner.clientToken ?? null,
    });
    this.bookingIdByIdem.set(booking.idempotencyKey, booking.id);
    return booking;
  }

  public getBookingById(bookingId: string): Booking | undefined {
    return this.bookingsById.get(bookingId)?.booking;
  }

  public getBookingRecordById(bookingId: string): GatewayBookingRecord | undefined {
    return this.bookingsById.get(bookingId);
  }

  public listBookings(filter: { userId?: string; clientToken?: string }): Booking[] {
    const matches: Booking[] = [];
    for (const rec of this.bookingsById.values()) {
      const matchUser = Boolean(filter.userId && rec.userId === filter.userId);
      const matchClient = Boolean(
        filter.clientToken && rec.clientToken === filter.clientToken
      );
      if (matchUser || matchClient) {
        matches.push(rec.booking);
      }
    }
    return matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    cancelledAt?: string
  ): Booking | undefined {
    const rec = this.bookingsById.get(bookingId);
    if (!rec) return undefined;
    const updated: Booking = {
      ...rec.booking,
      status,
      cancelledAt: cancelledAt ?? rec.booking.cancelledAt,
      updatedAt: new Date().toISOString(),
    };
    this.bookingsById.set(bookingId, { ...rec, booking: updated });
    return updated;
  }

  public close(): void {
    // No external handles to close
  }
}

/**
 * Dynamic SQLite GatewayStorage adapter using `process.getBuiltinModule("node:sqlite")`.
 * Avoids static `import "node:sqlite"` so Metro & Edge bundlers never fail when targeting
 * runtimes without native SQLite bindings.
 */
class DynamicSqliteGatewayStorage implements GatewayStorage {
  public readonly backend = "sqlite" as const;
  private readonly db: SqliteDatabaseLike;

  constructor(DatabaseSyncCtor: new (filename: string) => SqliteDatabaseLike, sqlitePath: string) {
    if (sqlitePath !== ":memory:") {
      fs.mkdirSync(path.dirname(path.resolve(sqlitePath)), { recursive: true });
    }
    this.db = new DatabaseSyncCtor(sqlitePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        nationality TEXT,
        preferred_currency TEXT NOT NULL DEFAULT 'USD',
        preferred_language TEXT NOT NULL DEFAULT 'en',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS favorites (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        hotel_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, hotel_id)
      );

      CREATE TABLE IF NOT EXISTS offer_quotes (
        quote_id TEXT PRIMARY KEY,
        offer_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        hotel_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        client_token TEXT,
        idempotency_key TEXT NOT NULL UNIQUE,
        provider_id TEXT NOT NULL,
        provider_booking_id TEXT,
        booking_reference TEXT,
        status TEXT NOT NULL,
        is_sandbox INTEGER NOT NULL DEFAULT 0,
        is_external_handoff INTEGER NOT NULL DEFAULT 0,
        booking_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_token, created_at DESC);
    `);
  }

  public createUser(params: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone: string;
    nationality?: string;
    preferredCurrency: CurrencyCode;
    preferredLanguage: LanguageCode;
  }): AuthenticatedUser {
    const id = `usr_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const emailNorm = params.email.trim().toLowerCase();

    this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, nationality, preferred_currency, preferred_language, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        emailNorm,
        params.passwordHash,
        params.firstName.trim(),
        params.lastName.trim(),
        params.phone.trim(),
        params.nationality ?? null,
        params.preferredCurrency,
        params.preferredLanguage,
        createdAt
      );

    return {
      id,
      email: emailNorm,
      firstName: params.firstName.trim(),
      lastName: params.lastName.trim(),
      phone: params.phone.trim(),
      nationality: params.nationality,
      preferredCurrency: params.preferredCurrency,
      preferredLanguage: params.preferredLanguage,
      createdAt,
    };
  }

  public findUserByEmail(email: string): StoredUserAccountRow | undefined {
    return this.db
      .prepare(`SELECT * FROM users WHERE email = ?`)
      .get(email.trim().toLowerCase()) as StoredUserAccountRow | undefined;
  }

  public findUserById(id: string): AuthenticatedUser | undefined {
    const row = this.db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .get(id) as StoredUserAccountRow | undefined;
    return row ? mapUserRow(row) : undefined;
  }

  public updateUserProfile(
    userId: string,
    patch: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      nationality?: string;
      preferredCurrency?: CurrencyCode;
      preferredLanguage?: LanguageCode;
    }
  ): AuthenticatedUser | undefined {
    const existing = this.db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .get(userId) as StoredUserAccountRow | undefined;
    if (!existing) return undefined;

    const firstName = patch.firstName ?? existing.first_name;
    const lastName = patch.lastName ?? existing.last_name;
    const phone = patch.phone ?? existing.phone;
    const nationality =
      patch.nationality !== undefined ? patch.nationality : existing.nationality;
    const preferredCurrency = patch.preferredCurrency ?? existing.preferred_currency;
    const preferredLanguage = patch.preferredLanguage ?? existing.preferred_language;

    this.db
      .prepare(
        `UPDATE users
         SET first_name = ?, last_name = ?, phone = ?, nationality = ?, preferred_currency = ?, preferred_language = ?
         WHERE id = ?`
      )
      .run(
        firstName,
        lastName,
        phone,
        nationality,
        preferredCurrency,
        preferredLanguage,
        userId
      );

    return this.findUserById(userId);
  }

  public createSession(tokenHash: string, userId: string, ttlDays: number = 30): void {
    const now = new Date();
    const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
    this.db
      .prepare(
        `INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(tokenHash, userId, expires.toISOString(), now.toISOString());
  }

  public getUserBySessionHash(tokenHash: string): AuthenticatedUser | undefined {
    const row = this.db
      .prepare(
        `SELECT u.* FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`
      )
      .get(tokenHash, new Date().toISOString()) as StoredUserAccountRow | undefined;
    return row ? mapUserRow(row) : undefined;
  }

  public deleteSession(tokenHash: string): void {
    this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
  }

  public listFavorites(userId: string): string[] {
    const rows = this.db
      .prepare(`SELECT hotel_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC`)
      .all(userId) as { hotel_id: string }[];
    return rows.map((r) => r.hotel_id);
  }

  public addFavorite(userId: string, hotelId: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO favorites (user_id, hotel_id, created_at) VALUES (?, ?, ?)`
      )
      .run(userId, hotelId, new Date().toISOString());
  }

  public removeFavorite(userId: string, hotelId: string): void {
    this.db
      .prepare(`DELETE FROM favorites WHERE user_id = ? AND hotel_id = ?`)
      .run(userId, hotelId);
  }

  public saveOfferQuote(quote: RevalidatedOffer): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO offer_quotes (quote_id, offer_id, provider_id, hotel_id, payload_json, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        quote.quoteId,
        quote.offer.offerId,
        quote.offer.providerId,
        quote.offer.hotelId,
        JSON.stringify(quote),
        quote.expiresAt,
        new Date().toISOString()
      );
  }

  public getOfferQuote(quoteId: string): RevalidatedOffer | undefined {
    const row = this.db
      .prepare(`SELECT payload_json FROM offer_quotes WHERE quote_id = ?`)
      .get(quoteId) as { payload_json: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.payload_json) as RevalidatedOffer;
  }

  public findBookingByIdempotencyKey(idempotencyKey: string): Booking | undefined {
    const row = this.db
      .prepare(`SELECT booking_json FROM bookings WHERE idempotency_key = ?`)
      .get(idempotencyKey) as { booking_json: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.booking_json) as Booking;
  }

  public saveBooking(
    booking: Booking,
    owner: { userId?: string; clientToken?: string }
  ): Booking {
    this.db
      .prepare(
        `INSERT INTO bookings (
          id, user_id, client_token, idempotency_key, provider_id, provider_booking_id,
          booking_reference, status, is_sandbox, is_external_handoff, booking_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        booking.id,
        owner.userId ?? null,
        owner.clientToken ?? null,
        booking.idempotencyKey,
        booking.providerId,
        booking.providerBookingId ?? null,
        booking.bookingReference ?? null,
        booking.status,
        booking.isSandbox ? 1 : 0,
        booking.isExternalHandoff ? 1 : 0,
        JSON.stringify(booking),
        booking.createdAt,
        booking.updatedAt
      );
    return booking;
  }

  public getBookingById(bookingId: string): Booking | undefined {
    const row = this.db
      .prepare(`SELECT booking_json FROM bookings WHERE id = ?`)
      .get(bookingId) as { booking_json: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.booking_json) as Booking;
  }

  public getBookingRecordById(bookingId: string): GatewayBookingRecord | undefined {
    const row = this.db
      .prepare(`SELECT booking_json, user_id, client_token FROM bookings WHERE id = ?`)
      .get(bookingId) as
      | { booking_json: string; user_id: string | null; client_token: string | null }
      | undefined;
    if (!row) return undefined;
    return {
      booking: JSON.parse(row.booking_json) as Booking,
      userId: row.user_id,
      clientToken: row.client_token,
    };
  }

  public listBookings(filter: { userId?: string; clientToken?: string }): Booking[] {
    let rows: { booking_json: string }[] = [];
    if (filter.userId && filter.clientToken) {
      rows = this.db
        .prepare(
          `SELECT booking_json FROM bookings
           WHERE user_id = ? OR client_token = ?
           ORDER BY created_at DESC`
        )
        .all(filter.userId, filter.clientToken) as { booking_json: string }[];
    } else if (filter.userId) {
      rows = this.db
        .prepare(`SELECT booking_json FROM bookings WHERE user_id = ? ORDER BY created_at DESC`)
        .all(filter.userId) as { booking_json: string }[];
    } else if (filter.clientToken) {
      rows = this.db
        .prepare(
          `SELECT booking_json FROM bookings WHERE client_token = ? ORDER BY created_at DESC`
        )
        .all(filter.clientToken) as { booking_json: string }[];
    }
    return rows.map((r) => JSON.parse(r.booking_json) as Booking);
  }

  public updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    cancelledAt?: string
  ): Booking | undefined {
    const existing = this.getBookingById(bookingId);
    if (!existing) return undefined;
    const updated: Booking = {
      ...existing,
      status,
      cancelledAt: cancelledAt ?? existing.cancelledAt,
      updatedAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `UPDATE bookings
         SET status = ?, booking_json = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(updated.status, JSON.stringify(updated), updated.updatedAt, bookingId);
    return updated;
  }

  public close(): void {
    this.db.close();
  }
}

export function createGatewayStorage(sqlitePath: string): GatewayStorage {
  try {
    const getBuiltin = (
      process as unknown as {
        getBuiltinModule?: (id: string) => unknown;
      }
    ).getBuiltinModule;

    if (typeof getBuiltin === "function") {
      const sqliteMod = getBuiltin("node:sqlite") as NodeSqliteModuleLike | undefined;
      if (sqliteMod?.DatabaseSync) {
        try {
          return new DynamicSqliteGatewayStorage(sqliteMod.DatabaseSync, sqlitePath);
        } catch {
          // Read-only container directory (e.g., /var/task in serverless): try /tmp fallback
          if (sqlitePath !== ":memory:") {
            return new DynamicSqliteGatewayStorage(
              sqliteMod.DatabaseSync,
              "/tmp/gowild-gateway.sqlite"
            );
          }
        }
      }
    }
  } catch {
    // Fall back to edge-safe memory store
  }

  return new InMemoryGatewayStorage();
}


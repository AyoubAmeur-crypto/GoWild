import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  AuthenticatedUser,
  Booking,
  BookingStatus,
  CurrencyCode,
  LanguageCode,
  RevalidatedOffer,
} from "../../src/types/domain.ts";

export interface StoredUserRow {
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

export class GoWildDatabase {
  public readonly db: DatabaseSync;

  constructor(sqlitePath: string) {
    if (sqlitePath !== ":memory:") {
      fs.mkdirSync(path.dirname(path.resolve(sqlitePath)), { recursive: true });
    }
    this.db = new DatabaseSync(sqlitePath);
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

  public findUserByEmail(email: string): StoredUserRow | undefined {
    const row = this.db
      .prepare(`SELECT * FROM users WHERE email = ?`)
      .get(email.trim().toLowerCase()) as StoredUserRow | undefined;
    return row;
  }

  public findUserById(id: string): AuthenticatedUser | undefined {
    const row = this.db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .get(id) as StoredUserRow | undefined;
    if (!row) return undefined;
    return this.mapUserRow(row);
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
      .get(userId) as StoredUserRow | undefined;
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
      .get(tokenHash, new Date().toISOString()) as StoredUserRow | undefined;
    if (!row) return undefined;
    return this.mapUserRow(row);
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

  public updateBooking(
    bookingId: string,
    updater: (current: Booking) => Booking
  ): Booking | undefined {
    const existing = this.getBookingById(bookingId);
    if (!existing) return undefined;
    const updated = updater(existing);
    this.db
      .prepare(
        `UPDATE bookings
         SET status = ?, booking_json = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        updated.status,
        JSON.stringify(updated),
        updated.updatedAt,
        bookingId
      );
    return updated;
  }

  public getBookingById(bookingId: string): Booking | undefined {
    const row = this.db
      .prepare(`SELECT booking_json FROM bookings WHERE id = ?`)
      .get(bookingId) as { booking_json: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.booking_json) as Booking;
  }

  public getBookingRecordById(bookingId: string):
    | {
        booking: Booking;
        userId: string | null;
        clientToken: string | null;
      }
    | undefined {
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
    return this.updateBooking(bookingId, (cur) => ({
      ...cur,
      status,
      cancelledAt: cancelledAt ?? cur.cancelledAt,
      updatedAt: new Date().toISOString(),
    }));
  }

  public close(): void {
    this.db.close();
  }

  private mapUserRow(row: StoredUserRow): AuthenticatedUser {
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
}

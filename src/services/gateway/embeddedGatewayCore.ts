import { ZodError } from "zod";
import {
  AuthLoginSchema,
  AuthRegisterSchema,
  CreateBookingInputSchema,
  CurrencyCodeSchema,
  HotelSearchQuerySchema,
  ProfileUpdateSchema,
  RevalidateOfferInputSchema,
  RoomOffersRequestSchema,
} from "../../lib/validation.ts";
import {
  calculateNights,
  computePriceBreakdown,
  convertFromUsd,
  filterAndSortHotels,
  getDefaultDates,
} from "../../lib/pricing.ts";
import {
  FIXTURE_HOTELS,
  FIXTURE_PLACES,
  type FixtureHotelSeed,
} from "../../mocks/hotelsFixtureCatalog.ts";
import type {
  AuthenticatedUser,
  Booking,
  CurrencyCode,
  Hotel,
  NotificationItem,
  Occupancy,
  PlaceSuggestion,
  ProviderCapabilities,
  RevalidatedOffer,
  RoomOffer,
} from "../../types/domain.ts";

const STORAGE_KEY = "gowild-embedded-gateway-ledger-v1";

export interface KeyValueStorageLike {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

interface EmbeddedUserRecord {
  user: AuthenticatedUser;
  passwordDigest: string;
}

interface EmbeddedBookingRecord {
  booking: Booking;
  userId: string | null;
  clientToken: string | null;
}

interface PersistedLedgerState {
  users: EmbeddedUserRecord[];
  sessions: Record<string, { userId: string; expiresAt: string }>;
  favoritesByUser: Record<string, string[]>;
  quotes: Record<string, RevalidatedOffer>;
  bookings: EmbeddedBookingRecord[];
}

export interface EmbeddedGatewayRequest {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface EmbeddedGatewayResponse {
  statusCode: number;
  payload: unknown;
}

class EmbeddedHttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function randomHex(length: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  const cryptoObj = (
    globalThis as unknown as {
      crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array };
    }
  ).crypto;

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    cryptoObj.getRandomValues(bytes);
    for (const b of bytes) {
      out += b.toString(16).padStart(2, "0");
    }
    return out.slice(0, length);
  }

  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Pure TypeScript deterministic digest (FNV-1a 256-bit cascade) for local embedded
 * session/account verification without requiring Node `crypto` in React Native Hermes.
 */
function pureDigest(input: string, salt: string = "gw_v1"): string {
  const seeds = [
    0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35,
    0x27d4eb2f, 0x165667b1, 0xd3a2646c, 0xfd7046c5,
  ];
  const combined = `${salt}::${input}::gowild`;
  for (let round = 0; round < 64; round += 1) {
    for (let i = 0; i < combined.length; i += 1) {
      const code = combined.charCodeAt(i);
      const idx = (i + round) & 7;
      let h = seeds[idx] ^ code ^ (round * 131);
      h = Math.imul(h, 0x01000193);
      seeds[idx] = h >>> 0;
    }
  }
  return seeds.map((n) => n.toString(16).padStart(8, "0")).join("");
}

function hashLocalPassword(password: string): string {
  const salt = randomHex(16);
  return `${salt}:${pureDigest(password, salt)}`;
}

function verifyLocalPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, expected] = parts;
  const actual = pureDigest(password, salt);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

const EMBEDDED_CAPABILITIES: ProviderCapabilities = {
  providerId: "development_fixtures",
  displayName: "goWild Always-On Embedded Gateway",
  mode: "development_fixture",
  configured: true,
  supportsAutocomplete: true,
  supportsLiveRates: true,
  supportsOfferRevalidation: true,
  supportsDirectBooking: true,
  supportsHostedCheckout: false,
  supportsBookingRetrieval: true,
  supportsCancellation: true,
  statusMessage:
    "Active via Always-On Embedded Local Gateway. Configure a Cloud API Gateway URL in Profile or run 'npx expo start' / 'eas deploy' for remote supplier execution.",
};

function mapSeedToHotel(
  seed: FixtureHotelSeed,
  currency: CurrencyCode,
  checkIn: string,
  checkOut: string,
  occupancy: Occupancy
): Hotel {
  const breakdown = computePriceBreakdown({
    perNightUsd: seed.baseNightlyUsd * 0.94,
    checkIn,
    checkOut,
    occupancy,
    currency,
    discountRatio: seed.discountRatio,
  });

  const compareNightly = seed.discountRatio
    ? convertFromUsd(seed.baseNightlyUsd / (1 - seed.discountRatio), currency)
    : undefined;

  return {
    id: seed.id,
    providerId: "development_fixtures",
    name: seed.name,
    starRating: seed.starRating,
    reviewScore: seed.reviewScore,
    reviewCount: seed.reviewCount,
    propertyType: seed.propertyType,
    summary: seed.summary,
    description: seed.description,
    location: seed.location,
    images: seed.images,
    amenities: seed.amenities,
    policies: seed.policies,
    lowestNightlyPrice: {
      amount: breakdown.perNightBase,
      currency,
    },
    compareAtNightlyPrice: compareNightly
      ? { amount: compareNightly, currency }
      : undefined,
    isFreeCancellationAvailable: seed.isFreeCancellationAvailable,
    isInstantConfirmation: seed.isInstantConfirmation,
    isFeatured: seed.isFeatured,
    bedSummary: seed.bedSummary,
    bathSummary: seed.bathSummary,
    reviews: seed.reviews,
  };
}

function buildEmbeddedRoomOffers(
  hotelId: string,
  checkIn: string,
  checkOut: string,
  occupancy: Occupancy,
  currency: CurrencyCode
): RoomOffer[] {
  const seed = FIXTURE_HOTELS.find((h) => h.id === hotelId);
  if (!seed) return [];

  const adultsPerRoom = Math.ceil(occupancy.adults / Math.max(1, occupancy.rooms));
  const offers: RoomOffer[] = [];
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const freeCancelDate = new Date(`${checkIn}T12:00:00Z`);
  freeCancelDate.setUTCDate(freeCancelDate.getUTCDate() - 2);
  const freeCancelIso = freeCancelDate.toISOString();

  for (const room of seed.rooms) {
    if (room.maxAdults < adultsPerRoom) continue;

    const flexUsd = seed.baseNightlyUsd * room.priceMultiplier * 1.08;
    const flexPrice = computePriceBreakdown({
      perNightUsd: flexUsd,
      checkIn,
      checkOut,
      occupancy,
      currency,
      discountRatio: seed.discountRatio,
    });

    offers.push({
      offerId: `fxoff_${seed.id}__${room.code}__flex`,
      hotelId: seed.id,
      providerId: "development_fixtures",
      supplierName: "goWild Embedded Gateway Inventory",
      roomName: room.roomName,
      description: room.description,
      maxAdults: room.maxAdults,
      maxChildren: room.maxChildren,
      bedSummary: room.bedSummary,
      sizeSqm: room.sizeSqm,
      availableUnits: room.availableUnits,
      images: seed.images,
      amenities: seed.amenities.slice(0, 5),
      ratePlan: {
        rateId: `${room.code}_flex_bb`,
        boardType: "breakfast_included",
        boardLabel: "Breakfast Included · Flexible",
        paymentType: "pay_now",
        isInstantConfirmation: true,
      },
      price: flexPrice,
      cancellationPolicy: {
        refundableTag: "refundable",
        freeCancellationUntil: freeCancelIso,
        currency,
        summary: `Free cancellation until ${freeCancelIso.slice(0, 10)} (48h before check-in).`,
      },
      expiresAt,
    });

    const saverUsd = seed.baseNightlyUsd * room.priceMultiplier * 0.94;
    const saverPrice = computePriceBreakdown({
      perNightUsd: saverUsd,
      checkIn,
      checkOut,
      occupancy,
      currency,
    });

    offers.push({
      offerId: `fxoff_${seed.id}__${room.code}__saver`,
      hotelId: seed.id,
      providerId: "development_fixtures",
      supplierName: "goWild Embedded Gateway Inventory",
      roomName: room.roomName,
      description: room.description,
      maxAdults: room.maxAdults,
      maxChildren: room.maxChildren,
      bedSummary: room.bedSummary,
      sizeSqm: room.sizeSqm,
      availableUnits: room.availableUnits,
      images: seed.images,
      amenities: seed.amenities.slice(0, 4),
      ratePlan: {
        rateId: `${room.code}_saver_ro`,
        boardType: "room_only",
        boardLabel: "Room Only · Advance Saver",
        paymentType: "pay_now",
        isInstantConfirmation: true,
      },
      price: saverPrice,
      cancellationPolicy: {
        refundableTag: "non_refundable",
        penaltyAmount: saverPrice.total,
        currency,
        summary: "Non-refundable Advance Saver rate. Full stay charged upon cancellation.",
      },
      expiresAt,
    });
  }

  return offers;
}

function buildNotifications(
  bookings: Booking[],
  user?: AuthenticatedUser
): NotificationItem[] {
  const items: NotificationItem[] = [];
  for (const bk of bookings.slice(0, 12)) {
    if (bk.status === "confirmed") {
      items.push({
        id: `notif_conf_${bk.id}`,
        title: `Reservation confirmed · ${bk.hotelName}`,
        body: `${bk.roomName} (${bk.checkIn} to ${bk.checkOut}) — Ref ${bk.bookingReference ?? bk.id}.`,
        category: "booking",
        createdAt: bk.createdAt,
        read: false,
        bookingId: bk.id,
        hotelId: bk.hotelId,
      });
    } else if (bk.status === "cancelled") {
      items.push({
        id: `notif_canc_${bk.id}`,
        title: `Booking cancelled · ${bk.hotelName}`,
        body: `Cancellation processed for ${bk.checkIn} – ${bk.checkOut}.`,
        category: "booking",
        createdAt: bk.cancelledAt ?? bk.updatedAt,
        read: true,
        bookingId: bk.id,
        hotelId: bk.hotelId,
      });
    }
  }

  items.push({
    id: "notif_rate_shield",
    title: "Always-On API Gateway Active",
    body: user
      ? `Signed in as ${user.firstName}. Reservations and rate quotes are persisted locally and ready to sync.`
      : "Every goWild rate is revalidated prior to checkout with idempotent booking protection.",
    category: "account",
    createdAt: user?.createdAt ?? new Date().toISOString(),
    read: Boolean(user),
  });

  return items;
}

export function createEmbeddedGateway(storageAdapter: KeyValueStorageLike) {
  let cachedState: PersistedLedgerState | null = null;

  async function loadState(): Promise<PersistedLedgerState> {
    if (cachedState) return cachedState;
    try {
      const raw = await storageAdapter.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedLedgerState>;
        cachedState = {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          sessions: parsed.sessions ?? {},
          favoritesByUser: parsed.favoritesByUser ?? {},
          quotes: parsed.quotes ?? {},
          bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
        };
        return cachedState;
      }
    } catch {
      // Ignore corrupt cache and initialize fresh ledger
    }
    cachedState = {
      users: [],
      sessions: {},
      favoritesByUser: {},
      quotes: {},
      bookings: [],
    };
    return cachedState;
  }

  async function persistState(state: PersistedLedgerState): Promise<void> {
    cachedState = state;
    await storageAdapter.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getHeader(
    headers: Record<string, string> | undefined,
    targetLower: string
  ): string | undefined {
    if (!headers) return undefined;
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === targetLower) return v;
    }
    return undefined;
  }

  async function resolveActor(headers?: Record<string, string>): Promise<{
    user?: AuthenticatedUser;
    tokenHash?: string;
    clientToken?: string;
  }> {
    const state = await loadState();
    const clientRaw = getHeader(headers, "x-client-token")?.trim();
    const clientToken =
      clientRaw && clientRaw.length >= 6 && clientRaw.length <= 128
        ? clientRaw
        : undefined;

    const authHeader = getHeader(headers, "authorization")?.trim();
    if (!authHeader) return { clientToken };

    const match = /^Bearer\s+(.+)$/i.exec(authHeader);
    const rawToken = match?.[1]?.trim();
    if (!rawToken) return { clientToken };

    const tokenHash = pureDigest(rawToken, "session");
    const sess = state.sessions[tokenHash];
    if (!sess || sess.expiresAt <= new Date().toISOString()) {
      return { clientToken };
    }

    const found = state.users.find((u) => u.user.id === sess.userId)?.user;
    return { user: found, tokenHash, clientToken };
  }

  async function requireActor(headers?: Record<string, string>): Promise<{
    user: AuthenticatedUser;
    tokenHash: string;
    clientToken?: string;
  }> {
    const actor = await resolveActor(headers);
    if (!actor.user || !actor.tokenHash) {
      throw new EmbeddedHttpError(
        401,
        "UNAUTHORIZED",
        "Authentication is required for this action. Please sign in."
      );
    }
    return {
      user: actor.user,
      tokenHash: actor.tokenHash,
      clientToken: actor.clientToken,
    };
  }

  async function dispatch(
    req: EmbeddedGatewayRequest
  ): Promise<EmbeddedGatewayResponse> {
    const requestId = `emb_${randomHex(12)}`;
    const url = new URL(req.path, "http://gowild.local");
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const method = req.method;

    try {
      // 1. Health
      if (method === "GET" && pathname === "/api/health") {
        return {
          statusCode: 200,
          payload: {
            status: "ok",
            timestamp: new Date().toISOString(),
            gateway: {
              runtime: "embedded-local-gateway",
              storageBackend: "async-storage",
            },
            capabilities: EMBEDDED_CAPABILITIES,
          },
        };
      }

      // 2. Places Autocomplete
      if (method === "GET" && pathname === "/api/places") {
        const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
        let places: PlaceSuggestion[];
        if (!q) {
          places = FIXTURE_PLACES.slice(0, 8);
        } else {
          const placeMatches = FIXTURE_PLACES.filter(
            (p) =>
              p.title.toLowerCase().includes(q) ||
              p.subtitle.toLowerCase().includes(q) ||
              p.country.toLowerCase().includes(q)
          );
          const hotelMatches: PlaceSuggestion[] = FIXTURE_HOTELS.filter(
            (h) =>
              h.name.toLowerCase().includes(q) ||
              h.location.city.toLowerCase().includes(q)
          ).map((h) => ({
            placeId: `htl_${h.id}`,
            title: h.name,
            subtitle: `${h.location.city}, ${h.location.country}`,
            cityName: h.location.city,
            country: h.location.country,
            countryCode: h.location.countryCode,
            latitude: h.location.latitude,
            longitude: h.location.longitude,
            type: "hotel",
          }));
          places = [...placeMatches, ...hotelMatches].slice(0, 8);
        }
        return {
          statusCode: 200,
          payload: { places, capabilities: EMBEDDED_CAPABILITIES },
        };
      }

      // 3. Featured Hotels
      if (method === "GET" && pathname === "/api/hotels/featured") {
        const curParsed = CurrencyCodeSchema.safeParse(
          url.searchParams.get("currency") ?? "USD"
        );
        const currency: CurrencyCode = curParsed.success ? curParsed.data : "USD";
        const defaults = getDefaultDates();
        const checkIn = url.searchParams.get("checkIn") ?? defaults.checkIn;
        const checkOut = url.searchParams.get("checkOut") ?? defaults.checkOut;
        const occupancy: Occupancy = { rooms: 1, adults: 2, childrenAges: [] };

        const mapped = FIXTURE_HOTELS.map((seed) =>
          mapSeedToHotel(seed, currency, checkIn, checkOut, occupancy)
        );
        const hotels = filterAndSortHotels(mapped, {
          checkIn,
          checkOut,
          occupancy,
          currency,
          sortBy: "recommended",
        });

        return {
          statusCode: 200,
          payload: { hotels, capabilities: EMBEDDED_CAPABILITIES },
        };
      }

      // 4. Hotel Search
      if (method === "POST" && pathname === "/api/hotels/search") {
        const query = HotelSearchQuerySchema.parse(req.body ?? {});
        const mapped = FIXTURE_HOTELS.map((seed) =>
          mapSeedToHotel(
            seed,
            query.currency,
            query.checkIn,
            query.checkOut,
            query.occupancy
          )
        );
        const results = filterAndSortHotels(mapped, query);
        return {
          statusCode: 200,
          payload: {
            hotels: results,
            total: results.length,
            capabilities: EMBEDDED_CAPABILITIES,
            appliedQuery: query,
          },
        };
      }

      // 5. Hotel Details
      const hotelDetailMatch = /^\/api\/hotels\/([^/]+)$/.exec(pathname);
      if (method === "GET" && hotelDetailMatch) {
        const hotelId = decodeURIComponent(hotelDetailMatch[1]);
        const seed = FIXTURE_HOTELS.find((h) => h.id === hotelId);
        if (!seed) {
          throw new EmbeddedHttpError(
            404,
            "NOT_FOUND",
            `Hotel '${hotelId}' was not found.`
          );
        }
        const curParsed = CurrencyCodeSchema.safeParse(
          url.searchParams.get("currency") ?? "USD"
        );
        const currency: CurrencyCode = curParsed.success ? curParsed.data : "USD";
        const defaults = getDefaultDates();
        const hotel = mapSeedToHotel(
          seed,
          currency,
          defaults.checkIn,
          defaults.checkOut,
          { rooms: 1, adults: 2, childrenAges: [] }
        );
        return {
          statusCode: 200,
          payload: { hotel, capabilities: EMBEDDED_CAPABILITIES },
        };
      }

      // 6. Hotel Images
      const hotelImagesMatch = /^\/api\/hotels\/([^/]+)\/images$/.exec(pathname);
      if (method === "GET" && hotelImagesMatch) {
        const hotelId = decodeURIComponent(hotelImagesMatch[1]);
        const seed = FIXTURE_HOTELS.find((h) => h.id === hotelId);
        return {
          statusCode: 200,
          payload: { images: seed?.images ?? [] },
        };
      }

      // 7. Room Offers
      const hotelOffersMatch = /^\/api\/hotels\/([^/]+)\/offers$/.exec(pathname);
      if (method === "POST" && hotelOffersMatch) {
        const hotelId = decodeURIComponent(hotelOffersMatch[1]);
        const parsed = RoomOffersRequestSchema.parse(req.body ?? {});
        const offers = buildEmbeddedRoomOffers(
          hotelId,
          parsed.checkIn,
          parsed.checkOut,
          parsed.occupancy,
          parsed.currency
        );
        return {
          statusCode: 200,
          payload: { offers, capabilities: EMBEDDED_CAPABILITIES },
        };
      }

      // 8. Revalidate Offer
      if (method === "POST" && pathname === "/api/offers/revalidate") {
        const parsed = RevalidateOfferInputSchema.parse(req.body ?? {});
        if (parsed.offerId.includes("expired")) {
          throw new EmbeddedHttpError(
            410,
            "OFFER_EXPIRED",
            "This room offer has expired. Please refresh rates."
          );
        }
        if (parsed.offerId.includes("soldout")) {
          throw new EmbeddedHttpError(
            409,
            "OFFER_SOLD_OUT",
            "This room category just sold out for your dates."
          );
        }

        const offers = buildEmbeddedRoomOffers(
          parsed.hotelId,
          parsed.checkIn,
          parsed.checkOut,
          parsed.occupancy,
          parsed.currency
        );
        const match = offers.find((o) => o.offerId === parsed.offerId);
        if (!match) {
          throw new EmbeddedHttpError(
            409,
            "OFFER_SOLD_OUT",
            "Selected room offer is unavailable for the requested dates and occupancy."
          );
        }

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const quoteId = `embquo_${randomHex(14)}`;
        const revalidated: RevalidatedOffer = {
          quoteId,
          offer: { ...match, expiresAt },
          available: true,
          priceChanged: false,
          checkoutMode: "sandbox_instant",
          expiresAt,
          capabilities: EMBEDDED_CAPABILITIES,
        };

        const state = await loadState();
        state.quotes[quoteId] = revalidated;
        await persistState(state);

        return { statusCode: 200, payload: { revalidated } };
      }

      // 9. Create Booking
      if (method === "POST" && pathname === "/api/bookings") {
        const idempotencyKey = getHeader(req.headers, "idempotency-key")?.trim();
        if (
          !idempotencyKey ||
          idempotencyKey.length < 8 ||
          idempotencyKey.length > 128
        ) {
          throw new EmbeddedHttpError(
            400,
            "VALIDATION_ERROR",
            "Header 'Idempotency-Key' (8-128 chars) is required to prevent duplicate reservations."
          );
        }

        const actor = await resolveActor(req.headers);
        if (!actor.user && !actor.clientToken) {
          throw new EmbeddedHttpError(
            400,
            "VALIDATION_ERROR",
            "Either an authenticated session or 'X-Client-Token' header is required."
          );
        }

        const state = await loadState();
        const dup = state.bookings.find(
          (b) => b.booking.idempotencyKey === idempotencyKey
        );
        if (dup) {
          return {
            statusCode: 200,
            payload: { booking: dup.booking, deduplicated: true },
          };
        }

        const input = CreateBookingInputSchema.parse(req.body ?? {});
        const quote = state.quotes[input.quoteId];
        if (!quote) {
          throw new EmbeddedHttpError(
            409,
            "OFFER_EXPIRED",
            "This room rate quote was not found. Please revalidate availability before confirming."
          );
        }
        if (Date.parse(quote.expiresAt) <= Date.now()) {
          throw new EmbeddedHttpError(
            409,
            "OFFER_EXPIRED",
            "This room rate quote has expired. Please refresh room rates."
          );
        }
        if (
          quote.offer.offerId !== input.offerId ||
          quote.offer.hotelId !== input.hotelId
        ) {
          throw new EmbeddedHttpError(
            400,
            "VALIDATION_ERROR",
            "Revalidated quote does not match the submitted hotel or room offer."
          );
        }

        const seed = FIXTURE_HOTELS.find((h) => h.id === input.hotelId);
        const nowIso = new Date().toISOString();
        const booking: Booking = {
          id: `bk_${randomHex(14)}`,
          idempotencyKey,
          providerId: "development_fixtures",
          providerDisplayName: EMBEDDED_CAPABILITIES.displayName,
          providerBookingId: `embbk_${randomHex(10)}`,
          bookingReference: `GW-LOC-${randomHex(6).toUpperCase()}`,
          status: "confirmed",
          isSandbox: true,
          isExternalHandoff: false,
          hotelId: input.hotelId,
          hotelName: seed?.name ?? `Property ${input.hotelId}`,
          hotelCity: seed?.location.city ?? "",
          hotelCountry: seed?.location.country ?? "",
          hotelAddress: seed?.location.address ?? "",
          hotelImageUrl:
            seed?.images[0]?.url ?? quote.offer.images[0]?.url ?? "",
          roomName: quote.offer.roomName,
          boardLabel: quote.offer.ratePlan.boardLabel,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          nights: calculateNights(input.checkIn, input.checkOut),
          occupancy: input.occupancy,
          leadGuest: input.leadGuest,
          specialRequests: input.specialRequests,
          price: quote.offer.price,
          cancellationPolicy: quote.offer.cancellationPolicy,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        state.bookings.unshift({
          booking,
          userId: actor.user?.id ?? null,
          clientToken: actor.clientToken ?? null,
        });
        await persistState(state);

        return {
          statusCode: 201,
          payload: { booking, deduplicated: false },
        };
      }

      // 10. List Bookings
      if (method === "GET" && pathname === "/api/bookings") {
        const actor = await resolveActor(req.headers);
        const state = await loadState();
        const todayIso = new Date().toISOString().slice(0, 10);
        let dirty = false;

        const bookings: Booking[] = [];
        for (const rec of state.bookings) {
          const matchUser = Boolean(actor.user && rec.userId === actor.user.id);
          const matchClient = Boolean(
            actor.clientToken && rec.clientToken === actor.clientToken
          );
          if (!matchUser && !matchClient) continue;

          if (
            rec.booking.status === "confirmed" &&
            rec.booking.checkOut < todayIso
          ) {
            rec.booking = {
              ...rec.booking,
              status: "completed",
              updatedAt: new Date().toISOString(),
            };
            dirty = true;
          }
          bookings.push(rec.booking);
        }

        if (dirty) {
          await persistState(state);
        }

        return {
          statusCode: 200,
          payload: { bookings, capabilities: EMBEDDED_CAPABILITIES },
        };
      }

      // 11. Get Single Booking
      const getBookingMatch = /^\/api\/bookings\/([^/]+)$/.exec(pathname);
      if (method === "GET" && getBookingMatch) {
        const bookingId = decodeURIComponent(getBookingMatch[1]);
        const actor = await resolveActor(req.headers);
        const state = await loadState();
        const rec = state.bookings.find((b) => b.booking.id === bookingId);
        const allowed =
          rec &&
          ((actor.user && rec.userId === actor.user.id) ||
            (actor.clientToken && rec.clientToken === actor.clientToken));
        if (!rec || !allowed) {
          throw new EmbeddedHttpError(
            404,
            "NOT_FOUND",
            `Booking '${bookingId}' was not found.`
          );
        }
        return {
          statusCode: 200,
          payload: { booking: rec.booking, capabilities: EMBEDDED_CAPABILITIES },
        };
      }

      // 12. Cancel Booking
      const cancelMatch = /^\/api\/bookings\/([^/]+)\/cancel$/.exec(pathname);
      if (method === "POST" && cancelMatch) {
        const bookingId = decodeURIComponent(cancelMatch[1]);
        const actor = await resolveActor(req.headers);
        const state = await loadState();
        const rec = state.bookings.find((b) => b.booking.id === bookingId);
        const allowed =
          rec &&
          ((actor.user && rec.userId === actor.user.id) ||
            (actor.clientToken && rec.clientToken === actor.clientToken));
        if (!rec || !allowed) {
          throw new EmbeddedHttpError(
            404,
            "NOT_FOUND",
            `Booking '${bookingId}' was not found.`
          );
        }
        if (rec.booking.status === "cancelled") {
          return {
            statusCode: 200,
            payload: {
              booking: rec.booking,
              refundSummary: "Booking was already cancelled.",
            },
          };
        }
        if (
          rec.booking.status === "completed" ||
          rec.booking.status === "failed"
        ) {
          throw new EmbeddedHttpError(
            409,
            "CONFLICT",
            `Cannot cancel a booking with status '${rec.booking.status}'.`
          );
        }

        const cancelledAt = new Date().toISOString();
        rec.booking = {
          ...rec.booking,
          status: "cancelled",
          cancelledAt,
          updatedAt: cancelledAt,
        };
        await persistState(state);

        return {
          statusCode: 200,
          payload: {
            booking: rec.booking,
            refundSummary:
              "Sandbox test reservation cancelled in local embedded gateway ledger.",
          },
        };
      }

      // 13. Auth Register
      if (method === "POST" && pathname === "/api/auth/register") {
        const input = AuthRegisterSchema.parse(req.body ?? {});
        const state = await loadState();
        const emailNorm = input.email.trim().toLowerCase();
        if (state.users.some((u) => u.user.email === emailNorm)) {
          throw new EmbeddedHttpError(
            409,
            "CONFLICT",
            "An account with this email address already exists."
          );
        }

        const user: AuthenticatedUser = {
          id: `usr_${randomHex(16)}`,
          email: emailNorm,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone: input.phone.trim(),
          preferredCurrency: input.preferredCurrency,
          preferredLanguage: input.preferredLanguage,
          createdAt: new Date().toISOString(),
        };

        state.users.push({
          user,
          passwordDigest: hashLocalPassword(input.password),
        });

        const rawToken = `gw_emb_${randomHex(32)}`;
        const tokenHash = pureDigest(rawToken, "session");
        state.sessions[tokenHash] = {
          userId: user.id,
          expiresAt: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        };
        await persistState(state);

        return { statusCode: 201, payload: { token: rawToken, user } };
      }

      // 14. Auth Login
      if (method === "POST" && pathname === "/api/auth/login") {
        const input = AuthLoginSchema.parse(req.body ?? {});
        const state = await loadState();
        const emailNorm = input.email.trim().toLowerCase();
        const found = state.users.find((u) => u.user.email === emailNorm);
        if (
          !found ||
          !verifyLocalPassword(input.password, found.passwordDigest)
        ) {
          throw new EmbeddedHttpError(
            401,
            "UNAUTHORIZED",
            "Invalid email address or password."
          );
        }

        const rawToken = `gw_emb_${randomHex(32)}`;
        const tokenHash = pureDigest(rawToken, "session");
        state.sessions[tokenHash] = {
          userId: found.user.id,
          expiresAt: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        };
        await persistState(state);

        return { statusCode: 200, payload: { token: rawToken, user: found.user } };
      }

      // 15. Auth Logout
      if (method === "POST" && pathname === "/api/auth/logout") {
        const actor = await resolveActor(req.headers);
        if (actor.tokenHash) {
          const state = await loadState();
          delete state.sessions[actor.tokenHash];
          await persistState(state);
        }
        return { statusCode: 200, payload: { ok: true } };
      }

      // 16. Auth Me
      if (method === "GET" && pathname === "/api/auth/me") {
        const { user } = await requireActor(req.headers);
        return { statusCode: 200, payload: { user } };
      }

      // 17. Auth Profile Patch
      if (method === "PATCH" && pathname === "/api/auth/profile") {
        const { user } = await requireActor(req.headers);
        const patch = ProfileUpdateSchema.parse(req.body ?? {});
        const state = await loadState();
        const rec = state.users.find((u) => u.user.id === user.id);
        if (!rec) {
          throw new EmbeddedHttpError(404, "NOT_FOUND", "User profile not found.");
        }
        rec.user = {
          ...rec.user,
          firstName: patch.firstName ?? rec.user.firstName,
          lastName: patch.lastName ?? rec.user.lastName,
          phone: patch.phone ?? rec.user.phone,
          nationality:
            patch.nationality !== undefined
              ? patch.nationality
              : rec.user.nationality,
          preferredCurrency:
            patch.preferredCurrency ?? rec.user.preferredCurrency,
          preferredLanguage:
            patch.preferredLanguage ?? rec.user.preferredLanguage,
        };
        await persistState(state);
        return { statusCode: 200, payload: { user: rec.user } };
      }

      // 18. Favorites
      if (method === "GET" && pathname === "/api/favorites") {
        const { user } = await requireActor(req.headers);
        const state = await loadState();
        return {
          statusCode: 200,
          payload: { hotelIds: state.favoritesByUser[user.id] ?? [] },
        };
      }

      const favMatch = /^\/api\/favorites\/([^/]+)$/.exec(pathname);
      if (favMatch && (method === "POST" || method === "DELETE")) {
        const { user } = await requireActor(req.headers);
        const hotelId = decodeURIComponent(favMatch[1]);
        const state = await loadState();
        const existing = state.favoritesByUser[user.id] ?? [];
        if (method === "POST") {
          state.favoritesByUser[user.id] = existing.includes(hotelId)
            ? existing
            : [hotelId, ...existing];
        } else {
          state.favoritesByUser[user.id] = existing.filter((id) => id !== hotelId);
        }
        await persistState(state);
        return {
          statusCode: 200,
          payload: { hotelIds: state.favoritesByUser[user.id] },
        };
      }

      // 19. Notifications
      if (method === "GET" && pathname === "/api/notifications") {
        const actor = await resolveActor(req.headers);
        const state = await loadState();
        const bookings = state.bookings
          .filter(
            (rec) =>
              (actor.user && rec.userId === actor.user.id) ||
              (actor.clientToken && rec.clientToken === actor.clientToken)
          )
          .map((rec) => rec.booking);
        const notifications = buildNotifications(bookings, actor.user);
        return { statusCode: 200, payload: { notifications } };
      }

      throw new EmbeddedHttpError(
        404,
        "NOT_FOUND",
        `Route '${method} ${pathname}' does not exist.`
      );
    } catch (err) {
      if (err instanceof EmbeddedHttpError) {
        return {
          statusCode: err.statusCode,
          payload: {
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
              requestId,
            },
          },
        };
      }

      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path.join(".") || "root";
          if (!fieldErrors[key]) {
            fieldErrors[key] = issue.message;
          }
        }
        return {
          statusCode: 400,
          payload: {
            error: {
              code: "VALIDATION_ERROR",
              message: err.issues[0]?.message ?? "Invalid request parameters.",
              details: { fields: fieldErrors },
              requestId,
            },
          },
        };
      }

      return {
        statusCode: 500,
        payload: {
          error: {
            code: "INTERNAL_ERROR",
            message:
              err instanceof Error
                ? err.message
                : "Unexpected local gateway error.",
            requestId,
          },
        },
      };
    }
  }

  return { dispatch };
}

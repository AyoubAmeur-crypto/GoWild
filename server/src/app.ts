import http from "node:http";
import { PassThrough } from "node:stream";
import type { Socket } from "node:net";
import crypto from "node:crypto";
import { ZodError } from "zod";
import { readServerConfig, type ServerConfig } from "./config.ts";
import { GoWildDatabase } from "./db.ts";
import { createHotelProvider } from "./providers/registry.ts";
import { createLogger } from "./logger.ts";
import { AppError } from "./errors.ts";
import {
  generateSessionToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "./auth.ts";
import type { FetchLike } from "./httpClient.ts";
import {
  AuthLoginSchema,
  AuthRegisterSchema,
  CreateBookingInputSchema,
  CurrencyCodeSchema,
  HotelSearchQuerySchema,
  LanguageCodeSchema,
  ProfileUpdateSchema,
  RevalidateOfferInputSchema,
  RoomOffersRequestSchema,
} from "../../src/lib/validation.ts";
import { calculateNights, getDefaultDates } from "../../src/lib/pricing.ts";
import type {
  AuthenticatedUser,
  Booking,
  CurrencyCode,
  LanguageCode,
  NotificationItem,
} from "../../src/types/domain.ts";

const MAX_BODY_BYTES = 64 * 1024;

export interface InjectRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "OPTIONS";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface InjectResponse {
  statusCode: number;
  headers: Record<string, string | number | string[] | undefined>;
  rawBody: string;
  json: <T>() => T;
}

export interface GoWildServerInstance {
  server: http.Server;
  db: GoWildDatabase;
  config: ServerConfig;
  inject: (options: InjectRequestOptions) => Promise<InjectResponse>;
  close: () => Promise<void>;
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(
          new AppError(413, "VALIDATION_ERROR", "Request payload exceeds 64KB limit.")
        );
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as unknown);
      } catch {
        reject(new AppError(400, "VALIDATION_ERROR", "Malformed JSON request body."));
      }
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  payload: unknown,
  requestId: string
): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "X-Request-Id": requestId,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Client-Token, Idempotency-Key",
    "Access-Control-Expose-Headers": "X-Request-Id",
  });
  res.end(body);
}

function parseCurrencyParam(raw: string | null): CurrencyCode {
  const parsed = CurrencyCodeSchema.safeParse(raw ?? "USD");
  return parsed.success ? parsed.data : "USD";
}

function parseLanguageParam(raw: string | null): LanguageCode | undefined {
  if (!raw) return undefined;
  const parsed = LanguageCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

function extractBearerToken(req: http.IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim();
}

function extractClientToken(req: http.IncomingMessage): string | undefined {
  const raw = req.headers["x-client-token"];
  const val = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = val?.trim();
  return trimmed && trimmed.length >= 6 && trimmed.length <= 128 ? trimmed : undefined;
}

function buildNotificationsFromBookings(
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
    } else if (bk.status === "pending") {
      items.push({
        id: `notif_pend_${bk.id}`,
        title: `Action needed · Complete checkout for ${bk.hotelName}`,
        body: `Your reservation ${bk.bookingReference ?? bk.id} is awaiting provider checkout confirmation.`,
        category: "booking",
        createdAt: bk.updatedAt,
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
    title: "Live Offer Revalidation Active",
    body: user
      ? `Signed in as ${user.firstName}. Every goWild rate is revalidated with the supplier prior to checkout.`
      : "Sign in to sync saved hotels and reservations across your iOS and Android devices.",
    category: "account",
    createdAt: user?.createdAt ?? new Date().toISOString(),
    read: Boolean(user),
  });

  return items;
}

export function createGoWildServer(
  configOverrides: Partial<ServerConfig> = {},
  fetchFn?: FetchLike
): GoWildServerInstance {
  const config = readServerConfig(configOverrides);
  const db = new GoWildDatabase(config.sqliteDbPath);
  const provider = createHotelProvider(config, fetchFn);
  const logger = createLogger(config.nodeEnv === "test");

  // Sliding-window rate limiter per IP
  const ipBuckets = new Map<string, { count: number; resetAt: number }>();

  function checkRateLimit(ip: string): void {
    const now = Date.now();
    const bucket = ipBuckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      ipBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
      return;
    }
    bucket.count += 1;
    if (bucket.count > config.rateLimitMaxPerMinute) {
      throw new AppError(
        429,
        "RATE_LIMITED",
        "Too many requests. Please wait a moment and try again."
      );
    }
  }

  function resolveUser(req: http.IncomingMessage): {
    user?: AuthenticatedUser;
    tokenHash?: string;
    clientToken?: string;
  } {
    const rawBearer = extractBearerToken(req);
    const clientToken = extractClientToken(req);
    if (!rawBearer) {
      return { clientToken };
    }
    const tokenHash = hashToken(rawBearer);
    const user = db.getUserBySessionHash(tokenHash);
    return { user, tokenHash, clientToken };
  }

  function requireAuth(req: http.IncomingMessage): {
    user: AuthenticatedUser;
    tokenHash: string;
    clientToken?: string;
  } {
    const resolved = resolveUser(req);
    if (!resolved.user || !resolved.tokenHash) {
      throw new AppError(
        401,
        "UNAUTHORIZED",
        "Authentication is required for this action. Please sign in."
      );
    }
    return {
      user: resolved.user,
      tokenHash: resolved.tokenHash,
      clientToken: resolved.clientToken,
    };
  }

  function canAccessBooking(
    record: { userId: string | null; clientToken: string | null },
    actor: { user?: AuthenticatedUser; clientToken?: string }
  ): boolean {
    if (actor.user && record.userId && actor.user.id === record.userId) {
      return true;
    }
    if (actor.clientToken && record.clientToken && actor.clientToken === record.clientToken) {
      return true;
    }
    return false;
  }

  const server = http.createServer(async (req, res) => {
    const requestId = crypto.randomUUID();
    const method = (req.method ?? "GET").toUpperCase();
    const rawUrl = req.url ?? "/";

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Client-Token, Idempotency-Key",
        "Access-Control-Max-Age": "86400",
      });
      res.end();
      return;
    }

    const url = new URL(rawUrl, "http://localhost");
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const clientIp = req.socket.remoteAddress ?? "unknown";

    try {
      checkRateLimit(clientIp);

      // 1. Health & Provider Capabilities
      if (method === "GET" && pathname === "/api/health") {
        sendJson(
          res,
          200,
          {
            status: "ok",
            timestamp: new Date().toISOString(),
            capabilities: provider.getCapabilities(),
          },
          requestId
        );
        return;
      }

      // 2. Places Autocomplete
      if (method === "GET" && pathname === "/api/places") {
        const q = (url.searchParams.get("q") ?? "").trim();
        const lang = parseLanguageParam(url.searchParams.get("lang"));
        const places = await provider.autocompletePlaces(q, lang);
        sendJson(
          res,
          200,
          {
            places,
            capabilities: provider.getCapabilities(),
          },
          requestId
        );
        return;
      }

      // 3. Featured Hotels (Home Discovery)
      if (method === "GET" && pathname === "/api/hotels/featured") {
        const currency = parseCurrencyParam(url.searchParams.get("currency"));
        const defaults = getDefaultDates();
        const checkIn = url.searchParams.get("checkIn") ?? defaults.checkIn;
        const checkOut = url.searchParams.get("checkOut") ?? defaults.checkOut;

        const searchResult = await provider.searchHotels({
          checkIn,
          checkOut,
          occupancy: { rooms: 1, adults: 2, childrenAges: [] },
          currency,
          sortBy: "recommended",
        });

        sendJson(
          res,
          200,
          {
            hotels: searchResult.hotels,
            capabilities: searchResult.capabilities,
          },
          requestId
        );
        return;
      }

      // 4. Hotel Search
      if (method === "POST" && pathname === "/api/hotels/search") {
        const body = await readJsonBody(req);
        const query = HotelSearchQuerySchema.parse(body);
        const result = await provider.searchHotels(query);
        sendJson(res, 200, result, requestId);
        return;
      }

      // 5. Hotel Details: GET /api/hotels/:id
      const hotelDetailMatch = /^\/api\/hotels\/([^/]+)$/.exec(pathname);
      if (method === "GET" && hotelDetailMatch) {
        const hotelId = decodeURIComponent(hotelDetailMatch[1]);
        const currency = parseCurrencyParam(url.searchParams.get("currency"));
        const lang = parseLanguageParam(url.searchParams.get("lang"));
        const hotel = await provider.getHotelDetails(hotelId, currency, lang);
        if (!hotel) {
          throw new AppError(404, "NOT_FOUND", `Hotel '${hotelId}' was not found.`);
        }
        sendJson(
          res,
          200,
          {
            hotel,
            capabilities: provider.getCapabilities(),
          },
          requestId
        );
        return;
      }

      // 6. Hotel Images: GET /api/hotels/:id/images
      const hotelImagesMatch = /^\/api\/hotels\/([^/]+)\/images$/.exec(pathname);
      if (method === "GET" && hotelImagesMatch) {
        const hotelId = decodeURIComponent(hotelImagesMatch[1]);
        const images = await provider.getHotelImages(hotelId);
        sendJson(res, 200, { images }, requestId);
        return;
      }

      // 7. Hotel Room Offers: POST /api/hotels/:id/offers
      const hotelOffersMatch = /^\/api\/hotels\/([^/]+)\/offers$/.exec(pathname);
      if (method === "POST" && hotelOffersMatch) {
        const hotelId = decodeURIComponent(hotelOffersMatch[1]);
        const body = await readJsonBody(req);
        const parsed = RoomOffersRequestSchema.parse(body);
        const offers = await provider.getRoomOffers(
          hotelId,
          parsed.checkIn,
          parsed.checkOut,
          parsed.occupancy,
          parsed.currency
        );
        sendJson(
          res,
          200,
          {
            offers,
            capabilities: provider.getCapabilities(),
          },
          requestId
        );
        return;
      }

      // 8. Revalidate Offer: POST /api/offers/revalidate
      if (method === "POST" && pathname === "/api/offers/revalidate") {
        const body = await readJsonBody(req);
        const parsed = RevalidateOfferInputSchema.parse(body);
        const quote = await provider.revalidateOffer(parsed.offerId, {
          hotelId: parsed.hotelId,
          checkIn: parsed.checkIn,
          checkOut: parsed.checkOut,
          occupancy: parsed.occupancy,
          currency: parsed.currency,
        });
        db.saveOfferQuote(quote);
        sendJson(res, 200, { revalidated: quote }, requestId);
        return;
      }

      // 9. Create Booking: POST /api/bookings
      if (method === "POST" && pathname === "/api/bookings") {
        const rawIdem = req.headers["idempotency-key"];
        const idempotencyKey = (Array.isArray(rawIdem) ? rawIdem[0] : rawIdem)?.trim();
        if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Header 'Idempotency-Key' (8-128 chars) is required to prevent duplicate reservations."
          );
        }

        const actor = resolveUser(req);
        if (!actor.user && !actor.clientToken) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Either an authenticated session or 'X-Client-Token' header is required to associate the booking."
          );
        }

        const existingBooking = db.findBookingByIdempotencyKey(idempotencyKey);
        if (existingBooking) {
          sendJson(
            res,
            200,
            { booking: existingBooking, deduplicated: true },
            requestId
          );
          return;
        }

        if (!provider.createBooking) {
          throw new AppError(
            501,
            "PROVIDER_CAPABILITY_UNSUPPORTED",
            `${provider.getCapabilities().displayName} does not support booking creation.`
          );
        }

        const body = await readJsonBody(req);
        const input = CreateBookingInputSchema.parse(body);

        const quote = db.getOfferQuote(input.quoteId);
        if (!quote) {
          throw new AppError(
            409,
            "OFFER_EXPIRED",
            "This room rate quote was not found. Please revalidate availability before confirming."
          );
        }

        if (Date.parse(quote.expiresAt) <= Date.now()) {
          throw new AppError(
            409,
            "OFFER_EXPIRED",
            "This room rate quote has expired. Please refresh room rates to confirm the latest price."
          );
        }

        if (!quote.available) {
          throw new AppError(
            409,
            "OFFER_SOLD_OUT",
            "This room rate is no longer available for your selected dates."
          );
        }

        if (quote.offer.offerId !== input.offerId || quote.offer.hotelId !== input.hotelId) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Revalidated quote does not match the submitted hotel or room offer."
          );
        }

        const hotelDetails = await provider
          .getHotelDetails(input.hotelId, input.currency)
          .catch(() => null);

        const providerRes = await provider.createBooking({
          idempotencyKey,
          quoteId: quote.quoteId,
          offer: quote.offer,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          occupancy: input.occupancy,
          leadGuest: input.leadGuest,
          specialRequests: input.specialRequests,
        });

        const nowIso = new Date().toISOString();
        const caps = provider.getCapabilities();
        const booking: Booking = {
          id: `bk_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`,
          idempotencyKey,
          providerId: caps.providerId,
          providerDisplayName: caps.displayName,
          providerBookingId: providerRes.providerBookingId,
          bookingReference: providerRes.bookingReference,
          status: providerRes.status,
          isSandbox: providerRes.isSandbox,
          isExternalHandoff: providerRes.isExternalHandoff,
          externalCheckoutUrl: providerRes.externalCheckoutUrl,
          hotelId: input.hotelId,
          hotelName: hotelDetails?.name ?? `Property ${input.hotelId}`,
          hotelCity: hotelDetails?.location.city ?? "",
          hotelCountry: hotelDetails?.location.country ?? "",
          hotelAddress: hotelDetails?.location.address ?? "",
          hotelImageUrl:
            hotelDetails?.images[0]?.url ?? quote.offer.images[0]?.url ?? "",
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

        db.saveBooking(booking, {
          userId: actor.user?.id,
          clientToken: actor.clientToken,
        });

        logger.info("booking.created", {
          bookingId: booking.id,
          providerId: booking.providerId,
          status: booking.status,
          isSandbox: booking.isSandbox,
        });

        sendJson(res, 201, { booking, deduplicated: false }, requestId);
        return;
      }

      // 10. List Bookings: GET /api/bookings
      if (method === "GET" && pathname === "/api/bookings") {
        const actor = resolveUser(req);
        const rawList = db.listBookings({
          userId: actor.user?.id,
          clientToken: actor.clientToken,
        });

        const todayIso = new Date().toISOString().slice(0, 10);
        const bookings = rawList.map((bk) => {
          if (bk.status === "confirmed" && bk.checkOut < todayIso) {
            return db.updateBookingStatus(bk.id, "completed") ?? bk;
          }
          return bk;
        });

        sendJson(
          res,
          200,
          { bookings, capabilities: provider.getCapabilities() },
          requestId
        );
        return;
      }

      // 11. Get Single Booking: GET /api/bookings/:id
      const getBookingMatch = /^\/api\/bookings\/([^/]+)$/.exec(pathname);
      if (method === "GET" && getBookingMatch) {
        const bookingId = decodeURIComponent(getBookingMatch[1]);
        const actor = resolveUser(req);
        const record = db.getBookingRecordById(bookingId);
        if (!record || !canAccessBooking(record, actor)) {
          throw new AppError(404, "NOT_FOUND", `Booking '${bookingId}' was not found.`);
        }

        let currentBooking = record.booking;
        if (
          currentBooking.status === "pending" &&
          currentBooking.providerBookingId &&
          provider.getBooking
        ) {
          const remote = await provider
            .getBooking(currentBooking.providerBookingId)
            .catch(() => null);
          if (remote && remote.status !== currentBooking.status) {
            currentBooking =
              db.updateBookingStatus(
                currentBooking.id,
                remote.status,
                remote.cancelledAt
              ) ?? currentBooking;
          }
        }

        sendJson(
          res,
          200,
          { booking: currentBooking, capabilities: provider.getCapabilities() },
          requestId
        );
        return;
      }

      // 12. Cancel Booking: POST /api/bookings/:id/cancel
      const cancelBookingMatch = /^\/api\/bookings\/([^/]+)\/cancel$/.exec(pathname);
      if (method === "POST" && cancelBookingMatch) {
        const bookingId = decodeURIComponent(cancelBookingMatch[1]);
        const actor = resolveUser(req);
        const record = db.getBookingRecordById(bookingId);
        if (!record || !canAccessBooking(record, actor)) {
          throw new AppError(404, "NOT_FOUND", `Booking '${bookingId}' was not found.`);
        }

        const current = record.booking;
        if (current.status === "cancelled") {
          sendJson(
            res,
            200,
            { booking: current, refundSummary: "Booking was already cancelled." },
            requestId
          );
          return;
        }
        if (current.status === "completed" || current.status === "failed") {
          throw new AppError(
            409,
            "CONFLICT",
            `Cannot cancel a booking with status '${current.status}'.`
          );
        }

        if (!provider.cancelBooking) {
          throw new AppError(
            501,
            "PROVIDER_CAPABILITY_UNSUPPORTED",
            `${provider.getCapabilities().displayName} does not support API cancellation.`
          );
        }

        const cancelRes = await provider.cancelBooking(
          current.providerBookingId ?? current.id
        );
        const updated =
          db.updateBookingStatus(current.id, "cancelled", cancelRes.cancelledAt) ??
          current;

        logger.info("booking.cancelled", {
          bookingId: updated.id,
          providerId: updated.providerId,
        });

        sendJson(
          res,
          200,
          { booking: updated, refundSummary: cancelRes.refundSummary },
          requestId
        );
        return;
      }

      // 13. Auth: Register
      if (method === "POST" && pathname === "/api/auth/register") {
        const body = await readJsonBody(req);
        const input = AuthRegisterSchema.parse(body);
        const existing = db.findUserByEmail(input.email);
        if (existing) {
          throw new AppError(
            409,
            "CONFLICT",
            "An account with this email address already exists."
          );
        }

        const passwordHash = hashPassword(input.password);
        const user = db.createUser({
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          preferredCurrency: input.preferredCurrency,
          preferredLanguage: input.preferredLanguage,
        });

        const { rawToken, tokenHash } = generateSessionToken();
        db.createSession(tokenHash, user.id);

        sendJson(res, 201, { token: rawToken, user }, requestId);
        return;
      }

      // 14. Auth: Login
      if (method === "POST" && pathname === "/api/auth/login") {
        const body = await readJsonBody(req);
        const input = AuthLoginSchema.parse(body);
        const stored = db.findUserByEmail(input.email);
        if (!stored || !verifyPassword(input.password, stored.password_hash)) {
          throw new AppError(
            401,
            "UNAUTHORIZED",
            "Invalid email address or password."
          );
        }

        const user = db.findUserById(stored.id);
        if (!user) {
          throw new AppError(401, "UNAUTHORIZED", "Account not found.");
        }

        const { rawToken, tokenHash } = generateSessionToken();
        db.createSession(tokenHash, user.id);
        sendJson(res, 200, { token: rawToken, user }, requestId);
        return;
      }

      // 15. Auth: Logout
      if (method === "POST" && pathname === "/api/auth/logout") {
        const resolved = resolveUser(req);
        if (resolved.tokenHash) {
          db.deleteSession(resolved.tokenHash);
        }
        sendJson(res, 200, { ok: true }, requestId);
        return;
      }

      // 16. Auth: Current User
      if (method === "GET" && pathname === "/api/auth/me") {
        const { user } = requireAuth(req);
        sendJson(res, 200, { user }, requestId);
        return;
      }

      // 17. Auth: Update Profile
      if (method === "PATCH" && pathname === "/api/auth/profile") {
        const { user } = requireAuth(req);
        const body = await readJsonBody(req);
        const patch = ProfileUpdateSchema.parse(body);
        const updated = db.updateUserProfile(user.id, patch);
        if (!updated) {
          throw new AppError(404, "NOT_FOUND", "User profile not found.");
        }
        sendJson(res, 200, { user: updated }, requestId);
        return;
      }

      // 18. Favorites Sync
      if (method === "GET" && pathname === "/api/favorites") {
        const { user } = requireAuth(req);
        sendJson(res, 200, { hotelIds: db.listFavorites(user.id) }, requestId);
        return;
      }

      const favItemMatch = /^\/api\/favorites\/([^/]+)$/.exec(pathname);
      if (favItemMatch && (method === "POST" || method === "DELETE")) {
        const { user } = requireAuth(req);
        const hotelId = decodeURIComponent(favItemMatch[1]);
        if (method === "POST") {
          db.addFavorite(user.id, hotelId);
        } else {
          db.removeFavorite(user.id, hotelId);
        }
        sendJson(res, 200, { hotelIds: db.listFavorites(user.id) }, requestId);
        return;
      }

      // 19. Notifications
      if (method === "GET" && pathname === "/api/notifications") {
        const actor = resolveUser(req);
        const bookings = db.listBookings({
          userId: actor.user?.id,
          clientToken: actor.clientToken,
        });
        const notifications = buildNotificationsFromBookings(bookings, actor.user);
        sendJson(res, 200, { notifications }, requestId);
        return;
      }

      throw new AppError(404, "NOT_FOUND", `Route '${method} ${pathname}' does not exist.`);
    } catch (err) {
      if (err instanceof AppError) {
        sendJson(
          res,
          err.statusCode,
          {
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
              requestId,
            },
          },
          requestId
        );
        return;
      }

      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path.join(".") || "root";
          if (!fieldErrors[key]) {
            fieldErrors[key] = issue.message;
          }
        }
        sendJson(
          res,
          400,
          {
            error: {
              code: "VALIDATION_ERROR",
              message: err.issues[0]?.message ?? "Invalid request parameters.",
              details: { fields: fieldErrors },
              requestId,
            },
          },
          requestId
        );
        return;
      }

      logger.error("http.unhandled_error", {
        method,
        pathname,
        message: err instanceof Error ? err.message : String(err),
      });

      sendJson(
        res,
        500,
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected server error occurred.",
            requestId,
          },
        },
        requestId
      );
    }
  });

  const inject = (options: InjectRequestOptions): Promise<InjectResponse> =>
    new Promise((resolve, reject) => {
      const stream = new PassThrough();
      const lowerHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(options.headers ?? {})) {
        lowerHeaders[k.toLowerCase()] = v;
      }

      const fakeReq = Object.assign(stream, {
        method: options.method ?? "GET",
        url: options.url,
        headers: lowerHeaders,
        socket: { remoteAddress: "127.0.0.1" } as Socket,
      }) as unknown as http.IncomingMessage;

      let statusCode = 200;
      let resHeaders: Record<string, string | number | string[] | undefined> = {};
      const resChunks: Buffer[] = [];

      const fakeRes = {
        writeHead(
          code: number,
          hdrs?: Record<string, string | number | string[] | undefined>
        ) {
          statusCode = code;
          if (hdrs) resHeaders = { ...resHeaders, ...hdrs };
          return this;
        },
        write(chunk: Buffer | string) {
          resChunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8")
          );
          return true;
        },
        end(chunk?: Buffer | string) {
          if (chunk !== undefined) {
            resChunks.push(
              Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8")
            );
          }
          const rawBody = Buffer.concat(resChunks).toString("utf8");
          resolve({
            statusCode,
            headers: resHeaders,
            rawBody,
            json: <T>() => JSON.parse(rawBody) as T,
          });
          return this;
        },
      } as unknown as http.ServerResponse;

      server.emit("request", fakeReq, fakeRes);

      try {
        if (options.body !== undefined) {
          const payload =
            typeof options.body === "string"
              ? options.body
              : JSON.stringify(options.body);
          stream.end(Buffer.from(payload, "utf8"));
        } else {
          stream.end();
        }
      } catch (err) {
        reject(err);
      }
    });

  const close = () =>
    new Promise<void>((resolve, reject) => {
      const finalizeDb = () => {
        try {
          db.close();
        } catch {
          // ignore already closed sqlite handle
        }
      };

      if (!server.listening) {
        finalizeDb();
        resolve();
        return;
      }

      server.close((closeErr) => {
        finalizeDb();
        if (closeErr) reject(closeErr);
        else resolve();
      });
    });

  return { server, db, config, inject, close };
}

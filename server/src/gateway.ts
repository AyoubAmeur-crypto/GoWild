import crypto from "node:crypto";
import { ZodError } from "zod";
import { readServerConfig, type ServerConfig } from "./config.ts";
import { createGatewayStorage, type GatewayStorage } from "./storage.ts";
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
import type { HotelProvider } from "../../src/services/providers/types.ts";
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

export interface GoWildGatewayInstance {
  config: ServerConfig;
  storage: GatewayStorage;
  provider: HotelProvider;
  handleRequest: (
    request: Request,
    meta?: { clientIp?: string; runtimeLabel?: string }
  ) => Promise<Response>;
  close: () => void;
}

function buildCorsHeaders(requestId: string, runtimeLabel: string): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "X-Request-Id": requestId,
    "X-Gateway-Runtime": runtimeLabel,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Client-Token, Idempotency-Key",
    "Access-Control-Expose-Headers": "X-Request-Id, X-Gateway-Runtime",
  };
}

function jsonResponse(
  statusCode: number,
  payload: unknown,
  requestId: string,
  runtimeLabel: string
): Response {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: buildCorsHeaders(requestId, runtimeLabel),
  });
}

async function readWebJsonBody(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new AppError(413, "VALIDATION_ERROR", "Request payload exceeds 64KB limit.");
  }
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "Malformed JSON request body.");
  }
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

function extractBearerHeader(headers: Headers): string | undefined {
  const header = headers.get("authorization");
  if (!header) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim();
}

function extractClientTokenHeader(headers: Headers): string | undefined {
  const trimmed = headers.get("x-client-token")?.trim();
  return trimmed && trimmed.length >= 6 && trimmed.length <= 128 ? trimmed : undefined;
}

export function buildNotificationsFromBookings(
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

export function createGoWildGateway(
  configOverrides: Partial<ServerConfig> = {},
  fetchFn?: FetchLike,
  customStorage?: GatewayStorage
): GoWildGatewayInstance {
  const config = readServerConfig(configOverrides);
  const storage = customStorage ?? createGatewayStorage(config.sqliteDbPath);
  const provider = createHotelProvider(config, fetchFn);
  const logger = createLogger(config.nodeEnv === "test");

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

  function resolveUser(headers: Headers): {
    user?: AuthenticatedUser;
    tokenHash?: string;
    clientToken?: string;
  } {
    const rawBearer = extractBearerHeader(headers);
    const clientToken = extractClientTokenHeader(headers);
    if (!rawBearer) {
      return { clientToken };
    }
    const tokenHash = hashToken(rawBearer);
    const user = storage.getUserBySessionHash(tokenHash);
    return { user, tokenHash, clientToken };
  }

  function requireAuth(headers: Headers): {
    user: AuthenticatedUser;
    tokenHash: string;
    clientToken?: string;
  } {
    const resolved = resolveUser(headers);
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
    if (
      actor.clientToken &&
      record.clientToken &&
      actor.clientToken === record.clientToken
    ) {
      return true;
    }
    return false;
  }

  const handleRequest = async (
    request: Request,
    meta?: { clientIp?: string; runtimeLabel?: string }
  ): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const runtimeLabel = meta?.runtimeLabel ?? "expo-api-gateway";
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...buildCorsHeaders(requestId, runtimeLabel),
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const clientIp =
      meta?.clientIp ??
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "local";

    try {
      checkRateLimit(clientIp);

      // 1. Health & Provider Capabilities
      if (method === "GET" && pathname === "/api/health") {
        return jsonResponse(
          200,
          {
            status: "ok",
            timestamp: new Date().toISOString(),
            gateway: {
              runtime: runtimeLabel,
              storageBackend: storage.backend,
            },
            capabilities: provider.getCapabilities(),
          },
          requestId,
          runtimeLabel
        );
      }

      // 2. Places Autocomplete
      if (method === "GET" && pathname === "/api/places") {
        const q = (url.searchParams.get("q") ?? "").trim();
        const lang = parseLanguageParam(url.searchParams.get("lang"));
        const places = await provider.autocompletePlaces(q, lang);
        return jsonResponse(
          200,
          {
            places,
            capabilities: provider.getCapabilities(),
          },
          requestId,
          runtimeLabel
        );
      }

      // 3. Featured Hotels
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

        return jsonResponse(
          200,
          {
            hotels: searchResult.hotels,
            capabilities: searchResult.capabilities,
          },
          requestId,
          runtimeLabel
        );
      }

      // 4. Hotel Search
      if (method === "POST" && pathname === "/api/hotels/search") {
        const body = await readWebJsonBody(request);
        const query = HotelSearchQuerySchema.parse(body);
        const result = await provider.searchHotels(query);
        return jsonResponse(200, result, requestId, runtimeLabel);
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
        return jsonResponse(
          200,
          {
            hotel,
            capabilities: provider.getCapabilities(),
          },
          requestId,
          runtimeLabel
        );
      }

      // 6. Hotel Images: GET /api/hotels/:id/images
      const hotelImagesMatch = /^\/api\/hotels\/([^/]+)\/images$/.exec(pathname);
      if (method === "GET" && hotelImagesMatch) {
        const hotelId = decodeURIComponent(hotelImagesMatch[1]);
        const images = await provider.getHotelImages(hotelId);
        return jsonResponse(200, { images }, requestId, runtimeLabel);
      }

      // 7. Hotel Room Offers: POST /api/hotels/:id/offers
      const hotelOffersMatch = /^\/api\/hotels\/([^/]+)\/offers$/.exec(pathname);
      if (method === "POST" && hotelOffersMatch) {
        const hotelId = decodeURIComponent(hotelOffersMatch[1]);
        const body = await readWebJsonBody(request);
        const parsed = RoomOffersRequestSchema.parse(body);
        const offers = await provider.getRoomOffers(
          hotelId,
          parsed.checkIn,
          parsed.checkOut,
          parsed.occupancy,
          parsed.currency
        );
        return jsonResponse(
          200,
          {
            offers,
            capabilities: provider.getCapabilities(),
          },
          requestId,
          runtimeLabel
        );
      }

      // 8. Revalidate Offer: POST /api/offers/revalidate
      if (method === "POST" && pathname === "/api/offers/revalidate") {
        const body = await readWebJsonBody(request);
        const parsed = RevalidateOfferInputSchema.parse(body);
        const quote = await provider.revalidateOffer(parsed.offerId, {
          hotelId: parsed.hotelId,
          checkIn: parsed.checkIn,
          checkOut: parsed.checkOut,
          occupancy: parsed.occupancy,
          currency: parsed.currency,
        });
        storage.saveOfferQuote(quote);
        return jsonResponse(200, { revalidated: quote }, requestId, runtimeLabel);
      }

      // 9. Create Booking: POST /api/bookings
      if (method === "POST" && pathname === "/api/bookings") {
        const idempotencyKey = request.headers.get("idempotency-key")?.trim();
        if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Header 'Idempotency-Key' (8-128 chars) is required to prevent duplicate reservations."
          );
        }

        const actor = resolveUser(request.headers);
        if (!actor.user && !actor.clientToken) {
          throw new AppError(
            400,
            "VALIDATION_ERROR",
            "Either an authenticated session or 'X-Client-Token' header is required to associate the booking."
          );
        }

        const existingBooking = storage.findBookingByIdempotencyKey(idempotencyKey);
        if (existingBooking) {
          return jsonResponse(
            200,
            { booking: existingBooking, deduplicated: true },
            requestId,
            runtimeLabel
          );
        }

        if (!provider.createBooking) {
          throw new AppError(
            501,
            "PROVIDER_CAPABILITY_UNSUPPORTED",
            `${provider.getCapabilities().displayName} does not support booking creation.`
          );
        }

        const body = await readWebJsonBody(request);
        const input = CreateBookingInputSchema.parse(body);

        const quote = storage.getOfferQuote(input.quoteId);
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

        if (
          quote.offer.offerId !== input.offerId ||
          quote.offer.hotelId !== input.hotelId
        ) {
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

        storage.saveBooking(booking, {
          userId: actor.user?.id,
          clientToken: actor.clientToken,
        });

        logger.info("booking.created", {
          bookingId: booking.id,
          providerId: booking.providerId,
          status: booking.status,
          isSandbox: booking.isSandbox,
        });

        return jsonResponse(
          201,
          { booking, deduplicated: false },
          requestId,
          runtimeLabel
        );
      }

      // 10. List Bookings: GET /api/bookings
      if (method === "GET" && pathname === "/api/bookings") {
        const actor = resolveUser(request.headers);
        const rawList = storage.listBookings({
          userId: actor.user?.id,
          clientToken: actor.clientToken,
        });

        const todayIso = new Date().toISOString().slice(0, 10);
        const bookings = rawList.map((bk) => {
          if (bk.status === "confirmed" && bk.checkOut < todayIso) {
            return storage.updateBookingStatus(bk.id, "completed") ?? bk;
          }
          return bk;
        });

        return jsonResponse(
          200,
          { bookings, capabilities: provider.getCapabilities() },
          requestId,
          runtimeLabel
        );
      }

      // 11. Get Single Booking: GET /api/bookings/:id
      const getBookingMatch = /^\/api\/bookings\/([^/]+)$/.exec(pathname);
      if (method === "GET" && getBookingMatch) {
        const bookingId = decodeURIComponent(getBookingMatch[1]);
        const actor = resolveUser(request.headers);
        const record = storage.getBookingRecordById(bookingId);
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
              storage.updateBookingStatus(
                currentBooking.id,
                remote.status,
                remote.cancelledAt
              ) ?? currentBooking;
          }
        }

        return jsonResponse(
          200,
          { booking: currentBooking, capabilities: provider.getCapabilities() },
          requestId,
          runtimeLabel
        );
      }

      // 12. Cancel Booking: POST /api/bookings/:id/cancel
      const cancelBookingMatch = /^\/api\/bookings\/([^/]+)\/cancel$/.exec(pathname);
      if (method === "POST" && cancelBookingMatch) {
        const bookingId = decodeURIComponent(cancelBookingMatch[1]);
        const actor = resolveUser(request.headers);
        const record = storage.getBookingRecordById(bookingId);
        if (!record || !canAccessBooking(record, actor)) {
          throw new AppError(404, "NOT_FOUND", `Booking '${bookingId}' was not found.`);
        }

        const current = record.booking;
        if (current.status === "cancelled") {
          return jsonResponse(
            200,
            { booking: current, refundSummary: "Booking was already cancelled." },
            requestId,
            runtimeLabel
          );
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
          storage.updateBookingStatus(current.id, "cancelled", cancelRes.cancelledAt) ??
          current;

        logger.info("booking.cancelled", {
          bookingId: updated.id,
          providerId: updated.providerId,
        });

        return jsonResponse(
          200,
          { booking: updated, refundSummary: cancelRes.refundSummary },
          requestId,
          runtimeLabel
        );
      }

      // 13. Auth: Register
      if (method === "POST" && pathname === "/api/auth/register") {
        const body = await readWebJsonBody(request);
        const input = AuthRegisterSchema.parse(body);
        const existing = storage.findUserByEmail(input.email);
        if (existing) {
          throw new AppError(
            409,
            "CONFLICT",
            "An account with this email address already exists."
          );
        }

        const passwordHash = hashPassword(input.password);
        const user = storage.createUser({
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          preferredCurrency: input.preferredCurrency,
          preferredLanguage: input.preferredLanguage,
        });

        const { rawToken, tokenHash } = generateSessionToken();
        storage.createSession(tokenHash, user.id);

        return jsonResponse(201, { token: rawToken, user }, requestId, runtimeLabel);
      }

      // 14. Auth: Login
      if (method === "POST" && pathname === "/api/auth/login") {
        const body = await readWebJsonBody(request);
        const input = AuthLoginSchema.parse(body);
        const stored = storage.findUserByEmail(input.email);
        if (!stored || !verifyPassword(input.password, stored.password_hash)) {
          throw new AppError(
            401,
            "UNAUTHORIZED",
            "Invalid email address or password."
          );
        }

        const user = storage.findUserById(stored.id);
        if (!user) {
          throw new AppError(401, "UNAUTHORIZED", "Account not found.");
        }

        const { rawToken, tokenHash } = generateSessionToken();
        storage.createSession(tokenHash, user.id);
        return jsonResponse(200, { token: rawToken, user }, requestId, runtimeLabel);
      }

      // 15. Auth: Logout
      if (method === "POST" && pathname === "/api/auth/logout") {
        const resolved = resolveUser(request.headers);
        if (resolved.tokenHash) {
          storage.deleteSession(resolved.tokenHash);
        }
        return jsonResponse(200, { ok: true }, requestId, runtimeLabel);
      }

      // 16. Auth: Current User
      if (method === "GET" && pathname === "/api/auth/me") {
        const { user } = requireAuth(request.headers);
        return jsonResponse(200, { user }, requestId, runtimeLabel);
      }

      // 17. Auth: Update Profile
      if (method === "PATCH" && pathname === "/api/auth/profile") {
        const { user } = requireAuth(request.headers);
        const body = await readWebJsonBody(request);
        const patch = ProfileUpdateSchema.parse(body);
        const updated = storage.updateUserProfile(user.id, patch);
        if (!updated) {
          throw new AppError(404, "NOT_FOUND", "User profile not found.");
        }
        return jsonResponse(200, { user: updated }, requestId, runtimeLabel);
      }

      // 18. Favorites Sync
      if (method === "GET" && pathname === "/api/favorites") {
        const { user } = requireAuth(request.headers);
        return jsonResponse(
          200,
          { hotelIds: storage.listFavorites(user.id) },
          requestId,
          runtimeLabel
        );
      }

      const favItemMatch = /^\/api\/favorites\/([^/]+)$/.exec(pathname);
      if (favItemMatch && (method === "POST" || method === "DELETE")) {
        const { user } = requireAuth(request.headers);
        const hotelId = decodeURIComponent(favItemMatch[1]);
        if (method === "POST") {
          storage.addFavorite(user.id, hotelId);
        } else {
          storage.removeFavorite(user.id, hotelId);
        }
        return jsonResponse(
          200,
          { hotelIds: storage.listFavorites(user.id) },
          requestId,
          runtimeLabel
        );
      }

      // 19. Notifications
      if (method === "GET" && pathname === "/api/notifications") {
        const actor = resolveUser(request.headers);
        const bookings = storage.listBookings({
          userId: actor.user?.id,
          clientToken: actor.clientToken,
        });
        const notifications = buildNotificationsFromBookings(bookings, actor.user);
        return jsonResponse(200, { notifications }, requestId, runtimeLabel);
      }

      throw new AppError(
        404,
        "NOT_FOUND",
        `Route '${method} ${pathname}' does not exist.`
      );
    } catch (err) {
      if (err instanceof AppError) {
        return jsonResponse(
          err.statusCode,
          {
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
              requestId,
            },
          },
          requestId,
          runtimeLabel
        );
      }

      if (err instanceof ZodError) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path.join(".") || "root";
          if (!fieldErrors[key]) {
            fieldErrors[key] = issue.message;
          }
        }
        return jsonResponse(
          400,
          {
            error: {
              code: "VALIDATION_ERROR",
              message: err.issues[0]?.message ?? "Invalid request parameters.",
              details: { fields: fieldErrors },
              requestId,
            },
          },
          requestId,
          runtimeLabel
        );
      }

      logger.error("gateway.unhandled_error", {
        method,
        pathname,
        message: err instanceof Error ? err.message : String(err),
      });

      return jsonResponse(
        500,
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected gateway error occurred.",
            requestId,
          },
        },
        requestId,
        runtimeLabel
      );
    }
  };

  return {
    config,
    storage,
    provider,
    handleRequest,
    close: () => storage.close(),
  };
}

let singletonGateway: GoWildGatewayInstance | null = null;

export function getSingletonGateway(): GoWildGatewayInstance {
  if (!singletonGateway) {
    singletonGateway = createGoWildGateway();
  }
  return singletonGateway;
}


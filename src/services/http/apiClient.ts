import { create } from "zustand";
import { z } from "zod";
import { AppConfig, resolveGatewayCandidates } from "../../lib/config";
import { useAuthStore } from "../../stores/useAuthStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { embeddedGateway } from "../gateway/embeddedGateway";
import type {
  AuthLoginInput,
  AuthRegisterInput,
  CreateBookingInput,
} from "../../lib/validation";
import type {
  AuthenticatedUser,
  Booking,
  CurrencyCode,
  Hotel,
  HotelSearchQuery,
  HotelSearchResponse,
  LanguageCode,
  NotificationItem,
  Occupancy,
  PlaceSuggestion,
  ProviderCapabilities,
  RevalidatedOffer,
  RoomOffer,
} from "../../types/domain";

const ApiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string().optional(),
  }),
});

export type GatewayConnectionMode =
  | "connecting"
  | "remote_gateway"
  | "embedded_gateway"
  | "unreachable";

export interface GatewayStatusState {
  mode: GatewayConnectionMode;
  activeEndpoint: string;
  runtimeLabel: string;
  latencyMs: number | null;
  lastCheckedAt: string | null;
  setGatewayStatus: (patch: Partial<Omit<GatewayStatusState, "setGatewayStatus">>) => void;
}

export const useGatewayStatusStore = create<GatewayStatusState>((set) => ({
  mode: "connecting",
  activeEndpoint: AppConfig.apiBaseUrl || "same-origin",
  runtimeLabel: "discovering",
  latencyMs: null,
  lastCheckedAt: null,
  setGatewayStatus: (patch) => set((prev) => ({ ...prev, ...patch })),
}));

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isNetworkError: boolean;
  public readonly details?: Record<string, unknown>;
  public readonly requestId?: string;

  constructor(params: {
    statusCode: number;
    code: string;
    message: string;
    isNetworkError?: boolean;
    details?: Record<string, unknown>;
    requestId?: string;
  }) {
    super(params.message);
    this.name = "ApiClientError";
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.isNetworkError = Boolean(params.isNetworkError);
    this.details = params.details;
    this.requestId = params.requestId;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

let stickyRemoteOrigin: string | null = null;
let remoteCooldownUntil = 0;

export function resetGatewayDiscoveryCache(): void {
  stickyRemoteOrigin = null;
  remoteCooldownUntil = 0;
}

async function tryRemoteOrigin<T>(
  origin: string,
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
  token: string | null
): Promise<{
  kind: "success";
  data: T;
  runtimeHeader: string;
  latencyMs: number;
} | {
  kind: "transport_unreachable";
  reason: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  const fullUrl = `${origin}${path}`;

  try {
    const response = await fetch(fullUrl, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startedAt;
    const contentType = response.headers.get("content-type") ?? "";
    const runtimeHeader =
      response.headers.get("x-gateway-runtime") ??
      (origin.endsWith(":4010") ? "standalone-node-bff" : "cloud-api-gateway");

    const rawText = await response.text();

    // If an origin serves static HTML (e.g., bundler index page without API routes),
    // treat it as non-gateway and continue probing next candidate.
    if (
      contentType.includes("text/html") ||
      rawText.trimStart().startsWith("<!DOCTYPE") ||
      rawText.trimStart().startsWith("<html")
    ) {
      return {
        kind: "transport_unreachable",
        reason: `Origin '${origin || "same-origin"}' returned HTML instead of JSON API.`,
      };
    }

    let parsedJson: unknown = null;
    if (rawText.trim().length > 0) {
      try {
        parsedJson = JSON.parse(rawText) as unknown;
      } catch {
        return {
          kind: "transport_unreachable",
          reason: `Origin '${origin || "same-origin"}' returned non-JSON payload.`,
        };
      }
    }

    if (!response.ok) {
      if (response.status === 401 && token && !path.startsWith("/api/auth/login")) {
        useAuthStore.getState().clearSession();
      }

      const errCheck = ApiErrorEnvelopeSchema.safeParse(parsedJson);
      if (errCheck.success) {
        // Authentic API Gateway / supplier error: NEVER silently fallback to fixtures!
        stickyRemoteOrigin = origin;
        useGatewayStatusStore.getState().setGatewayStatus({
          mode: "remote_gateway",
          activeEndpoint: origin || "same-origin (/api)",
          runtimeLabel: runtimeHeader,
          latencyMs,
          lastCheckedAt: new Date().toISOString(),
        });

        throw new ApiClientError({
          statusCode: response.status,
          code: errCheck.data.error.code,
          message: errCheck.data.error.message,
          details: errCheck.data.error.details,
          requestId: errCheck.data.error.requestId,
        });
      }

      // Unstructured 404 from a non-gateway HTTP server -> try next candidate
      if (response.status === 404 || response.status === 502 || response.status === 503) {
        return {
          kind: "transport_unreachable",
          reason: `Origin '${origin || "same-origin"}' returned unstructured ${response.status}.`,
        };
      }

      throw new ApiClientError({
        statusCode: response.status,
        code: "HTTP_ERROR",
        message: `Gateway returned status ${response.status}`,
      });
    }

    return {
      kind: "success",
      data: parsedJson as T,
      runtimeHeader,
      latencyMs,
    };
  } catch (err) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      kind: "transport_unreachable",
      reason: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function dispatchEmbedded<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  headers: Record<string, string>,
  body: unknown,
  token: string | null
): Promise<T> {
  const startedAt = Date.now();
  const res = await embeddedGateway.dispatch({
    method,
    path,
    headers,
    body,
  });
  const latencyMs = Date.now() - startedAt;

  useGatewayStatusStore.getState().setGatewayStatus({
    mode: "embedded_gateway",
    activeEndpoint: "embedded://always-on-local-gateway",
    runtimeLabel: "embedded-local-gateway",
    latencyMs,
    lastCheckedAt: new Date().toISOString(),
  });

  if (res.statusCode >= 400) {
    if (res.statusCode === 401 && token && !path.startsWith("/api/auth/login")) {
      useAuthStore.getState().clearSession();
    }
    const errCheck = ApiErrorEnvelopeSchema.safeParse(res.payload);
    if (errCheck.success) {
      throw new ApiClientError({
        statusCode: res.statusCode,
        code: errCheck.data.error.code,
        message: errCheck.data.error.message,
        details: errCheck.data.error.details,
        requestId: errCheck.data.error.requestId,
      });
    }
    throw new ApiClientError({
      statusCode: res.statusCode,
      code: "HTTP_ERROR",
      message: `Embedded gateway error (${res.statusCode})`,
    });
  }

  return res.payload as T;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const token = useAuthStore.getState().token;
  const { clientToken, customApiGatewayUrl } = useSettingsStore.getState();

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Client-Token": clientToken,
    ...(options.headers ?? {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  // Fast path during cooldown when no remote HTTP server is running locally
  if (
    !AppConfig.strictRemoteGatewayOnly &&
    !customApiGatewayUrl &&
    stickyRemoteOrigin === null &&
    Date.now() < remoteCooldownUntil
  ) {
    return dispatchEmbedded<T>(path, method, headers, options.body, token);
  }

  const baseCandidates = resolveGatewayCandidates(customApiGatewayUrl);
  const orderedOrigins =
    stickyRemoteOrigin !== null && baseCandidates.includes(stickyRemoteOrigin)
      ? [
          stickyRemoteOrigin,
          ...baseCandidates.filter((c) => c !== stickyRemoteOrigin),
        ]
      : baseCandidates;

  const probeReasons: string[] = [];

  for (let i = 0; i < orderedOrigins.length; i += 1) {
    const origin = orderedOrigins[i];
    const timeoutMs =
      options.timeoutMs ??
      (stickyRemoteOrigin === origin
        ? AppConfig.requestTimeoutMs
        : AppConfig.probeTimeoutMs);

    const attempt = await tryRemoteOrigin<T>(
      origin,
      path,
      method,
      headers,
      options.body,
      timeoutMs,
      token
    );

    if (attempt.kind === "success") {
      stickyRemoteOrigin = origin;
      remoteCooldownUntil = 0;
      useGatewayStatusStore.getState().setGatewayStatus({
        mode: "remote_gateway",
        activeEndpoint: origin || "same-origin (/api)",
        runtimeLabel: attempt.runtimeHeader,
        latencyMs: attempt.latencyMs,
        lastCheckedAt: new Date().toISOString(),
      });
      return attempt.data;
    }

    probeReasons.push(attempt.reason);
  }

  stickyRemoteOrigin = null;

  // If strict remote-only lock is explicitly enforced, surface BFF_UNREACHABLE
  if (AppConfig.strictRemoteGatewayOnly) {
    useGatewayStatusStore.getState().setGatewayStatus({
      mode: "unreachable",
      activeEndpoint: orderedOrigins[0] ?? "unconfigured",
      runtimeLabel: "offline",
      latencyMs: null,
      lastCheckedAt: new Date().toISOString(),
    });
    throw new ApiClientError({
      statusCode: 0,
      code: "BFF_UNREACHABLE",
      isNetworkError: true,
      message: `Cannot reach any remote goWild API Gateway (${orderedOrigins.join(", ")}).`,
      details: { probeReasons },
    });
  }

  // Resilient Always-On Embedded Local Gateway (persisted in AsyncStorage, visibly badged)
  remoteCooldownUntil = Date.now() + 20_000;
  return dispatchEmbedded<T>(path, method, headers, options.body, token);
}

export const goWildApi = {
  getHealth: () =>
    apiRequest<{
      status: string;
      timestamp: string;
      gateway?: { runtime: string; storageBackend: string };
      capabilities: ProviderCapabilities;
    }>("/api/health"),

  reconnectGateway: async () => {
    resetGatewayDiscoveryCache();
    return apiRequest<{
      status: string;
      timestamp: string;
      gateway?: { runtime: string; storageBackend: string };
      capabilities: ProviderCapabilities;
    }>("/api/health");
  },

  autocompletePlaces: (q: string, lang?: LanguageCode) => {
    const params = new URLSearchParams({ q });
    if (lang) params.set("lang", lang);
    return apiRequest<{
      places: PlaceSuggestion[];
      capabilities: ProviderCapabilities;
    }>(`/api/places?${params.toString()}`);
  },

  getFeaturedHotels: (
    currency: CurrencyCode,
    checkIn?: string,
    checkOut?: string
  ) => {
    const params = new URLSearchParams({ currency });
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    return apiRequest<{
      hotels: Hotel[];
      capabilities: ProviderCapabilities;
    }>(`/api/hotels/featured?${params.toString()}`);
  },

  searchHotels: (query: HotelSearchQuery) =>
    apiRequest<HotelSearchResponse>("/api/hotels/search", {
      method: "POST",
      body: query,
    }),

  getHotelDetails: (id: string, currency: CurrencyCode, lang?: LanguageCode) => {
    const params = new URLSearchParams({ currency });
    if (lang) params.set("lang", lang);
    return apiRequest<{
      hotel: Hotel;
      capabilities: ProviderCapabilities;
    }>(`/api/hotels/${encodeURIComponent(id)}?${params.toString()}`);
  },

  getRoomOffers: (
    hotelId: string,
    params: {
      checkIn: string;
      checkOut: string;
      occupancy: Occupancy;
      currency: CurrencyCode;
    }
  ) =>
    apiRequest<{
      offers: RoomOffer[];
      capabilities: ProviderCapabilities;
    }>(`/api/hotels/${encodeURIComponent(hotelId)}/offers`, {
      method: "POST",
      body: params,
    }),

  revalidateOffer: (input: {
    offerId: string;
    hotelId: string;
    checkIn: string;
    checkOut: string;
    occupancy: Occupancy;
    currency: CurrencyCode;
  }) =>
    apiRequest<{ revalidated: RevalidatedOffer }>("/api/offers/revalidate", {
      method: "POST",
      body: input,
    }),

  createBooking: (input: CreateBookingInput, idempotencyKey: string) =>
    apiRequest<{ booking: Booking; deduplicated: boolean }>("/api/bookings", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: input,
    }),

  listBookings: () =>
    apiRequest<{
      bookings: Booking[];
      capabilities: ProviderCapabilities;
    }>("/api/bookings"),

  getBooking: (bookingId: string) =>
    apiRequest<{
      booking: Booking;
      capabilities: ProviderCapabilities;
    }>(`/api/bookings/${encodeURIComponent(bookingId)}`),

  cancelBooking: (bookingId: string) =>
    apiRequest<{
      booking: Booking;
      refundSummary: string;
    }>(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: "POST",
      body: {},
    }),

  register: (input: AuthRegisterInput) =>
    apiRequest<{ token: string; user: AuthenticatedUser }>(
      "/api/auth/register",
      {
        method: "POST",
        body: input,
      }
    ),

  login: (input: AuthLoginInput) =>
    apiRequest<{ token: string; user: AuthenticatedUser }>("/api/auth/login", {
      method: "POST",
      body: input,
    }),

  logout: () =>
    apiRequest<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
      body: {},
    }),

  getMe: () => apiRequest<{ user: AuthenticatedUser }>("/api/auth/me"),

  updateProfile: (patch: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    nationality?: string;
    preferredCurrency?: CurrencyCode;
    preferredLanguage?: LanguageCode;
  }) =>
    apiRequest<{ user: AuthenticatedUser }>("/api/auth/profile", {
      method: "PATCH",
      body: patch,
    }),

  getFavorites: () => apiRequest<{ hotelIds: string[] }>("/api/favorites"),

  addFavorite: (hotelId: string) =>
    apiRequest<{ hotelIds: string[] }>(
      `/api/favorites/${encodeURIComponent(hotelId)}`,
      { method: "POST", body: {} }
    ),

  removeFavorite: (hotelId: string) =>
    apiRequest<{ hotelIds: string[] }>(
      `/api/favorites/${encodeURIComponent(hotelId)}`,
      { method: "DELETE" }
    ),

  getNotifications: () =>
    apiRequest<{ notifications: NotificationItem[] }>("/api/notifications"),
};

import { create } from "zustand";
import { httpsCallable } from "firebase/functions";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { firebaseAuth, firebaseFunctions } from "../firebase/client";
import { firebasePublicConfig, functionsRegion, googlePublicConfig, hotelCallable } from "../firebase/config";
import { InAppBookingProvider } from "../providers/inAppBookingProvider";
import { LiteApiLiveService } from "../providers/liteApiLiveService";

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


export const useGatewayStatusStore = create<{
  mode: "connecting" | "remote_gateway" | "unreachable";
  activeEndpoint: string;
  runtimeLabel: string;
  latencyMs: number | null;
  lastCheckedAt: string | null;
}>()(() => ({ mode: "connecting", activeEndpoint: `firebase://${functionsRegion}`, runtimeLabel: "Firebase Python Functions v2", latencyMs: null, lastCheckedAt: null }));

export async function callFunction<T>(name: string, data: Record<string, unknown> = {}): Promise<T> {
  const startedAt = Date.now();
  try {
    const auth = firebaseAuth();
    await auth.authStateReady();
    if (!auth.currentUser) throw new ApiClientError({ statusCode: 401, code: "UNAUTHORIZED", message: "Sign in to access goWild's cloud services." });
    const cleanData = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    const result = await httpsCallable<Record<string, unknown>, T>(firebaseFunctions(), name, { timeout: 120000 })(cleanData);
    useGatewayStatusStore.setState({ mode: "remote_gateway", activeEndpoint: `firebase://${firebasePublicConfig.projectId}/${functionsRegion}/${name}`, latencyMs: Date.now() - startedAt, lastCheckedAt: new Date().toISOString() });
    return result.data;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "FIREBASE_NOT_CONFIGURED";
    const details = typeof error === "object" && error !== null && "details" in error && typeof error.details === "object" && error.details !== null ? error.details as Record<string, unknown> : undefined;
    const network = ["functions/unavailable", "functions/deadline-exceeded"].includes(code);
    useGatewayStatusStore.setState({ mode: network ? "unreachable" : "remote_gateway", lastCheckedAt: new Date().toISOString() });
    throw new ApiClientError({ statusCode: code === "functions/unauthenticated" ? 401 : network ? 503 : 400, code: typeof details?.code === "string" ? details.code : code, message: error instanceof Error ? error.message : "The Firebase callable request failed.", isNetworkError: network, details });
  }
}

const supplier = <T>(action: string, data: Record<string, unknown> = {}) => callFunction<T>(hotelCallable, { action, ...data });
type HealthResponse = { status: string; timestamp: string; gateway: { runtime: string; storageBackend: string }; capabilities: ProviderCapabilities };

async function sessionResult(fallbackInput?: Partial<AuthRegisterInput>): Promise<{ token: string; user: AuthenticatedUser }> {
  const currentUser = firebaseAuth().currentUser;
  if (!currentUser) throw new Error("Firebase sign-in did not complete.");
  const token = await currentUser.getIdToken();
  try {
    const { user } = await callFunction<{ user: AuthenticatedUser }>("getProfile");
    return { token, user };
  } catch {
    const nameParts = (currentUser.displayName || "").trim().split(/\s+/);
    const firstName = fallbackInput?.firstName || nameParts[0] || "Traveler";
    const lastName = fallbackInput?.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");
    const fallbackUser: AuthenticatedUser = {
      id: currentUser.uid,
      email: currentUser.email || fallbackInput?.email || "",
      firstName,
      lastName,
      phone: fallbackInput?.phone || currentUser.phoneNumber || "",
      preferredCurrency: (fallbackInput?.preferredCurrency || "USD") as CurrencyCode,
      preferredLanguage: (fallbackInput?.preferredLanguage || "en") as LanguageCode,
      createdAt: new Date().toISOString(),
    };
    return { token, user: fallbackUser };
  }
}

export const goWildApi = {
  testConnection: () => callFunction<{ success: boolean; uid: string; region: string; documentPath: string; checkedAt: string }>("testConnection"),
  getAuthConfig: async () => googlePublicConfig,
  googleLogin: async (input: { idToken: string; tokenKind: "google" | "firebase" }) => {
    if (input.tokenKind === "google") await signInWithCredential(firebaseAuth(), GoogleAuthProvider.credential(input.idToken));
    return sessionResult();
  },
  getHealth: async () => {
    try {
      return await supplier<HealthResponse>("health");
    } catch {
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        gateway: { runtime: "in_app_engine", storageBackend: "local_persistent" },
        capabilities: InAppBookingProvider.capabilities,
      };
    }
  },
  reconnectGateway: async () => {
    try {
      return await supplier<HealthResponse>("health");
    } catch {
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        gateway: { runtime: "in_app_engine", storageBackend: "local_persistent" },
        capabilities: InAppBookingProvider.capabilities,
      };
    }
  },
  autocompletePlaces: async (q: string, lang?: LanguageCode) => {
    try {
      return await supplier<{ places: PlaceSuggestion[]; capabilities: ProviderCapabilities }>("places", { q, lang });
    } catch {
      return { places: InAppBookingProvider.autocompletePlaces(q, lang), capabilities: InAppBookingProvider.capabilities };
    }
  },
  getFeaturedHotels: async (currency: CurrencyCode, checkIn?: string, checkOut?: string) => {
    if (LiteApiLiveService.isAvailable()) {
      try {
        return await LiteApiLiveService.getFeaturedHotels(currency, checkIn, checkOut);
      } catch {
        // Fallback to callable or local
      }
    }
    try {
      return await supplier<{ hotels: Hotel[]; capabilities: ProviderCapabilities }>("featured", { currency, checkIn, checkOut });
    } catch {
      return InAppBookingProvider.getFeaturedHotels(currency, checkIn, checkOut);
    }
  },
  searchHotels: async (query: HotelSearchQuery) => {
    if (LiteApiLiveService.isAvailable()) {
      try {
        return await LiteApiLiveService.searchHotels(query);
      } catch {
        // Fallback to callable or local
      }
    }
    try {
      return await supplier<HotelSearchResponse>("search", { query });
    } catch {
      return InAppBookingProvider.searchHotels(query);
    }
  },
  getHotelDetails: async (id: string, currency: CurrencyCode, lang?: LanguageCode) => {
    if (LiteApiLiveService.isAvailable()) {
      try {
        return await LiteApiLiveService.getHotelDetails(id, currency, lang);
      } catch {
        // Fallback to callable or local
      }
    }
    try {
      return await supplier<{ hotel: Hotel; capabilities: ProviderCapabilities }>("detail", { hotelId: id, currency, lang });
    } catch {
      return InAppBookingProvider.getHotelDetails(id, currency, lang);
    }
  },
  getRoomOffers: async (hotelId: string, params: { checkIn: string; checkOut: string; occupancy: Occupancy; currency: CurrencyCode }) => {
    if (LiteApiLiveService.isAvailable()) {
      try {
        return await LiteApiLiveService.getRoomOffers(hotelId, params);
      } catch {
        // Fallback to callable or local
      }
    }
    try {
      return await supplier<{ offers: RoomOffer[]; capabilities: ProviderCapabilities }>("offers", { hotelId, ...params });
    } catch {
      return InAppBookingProvider.getRoomOffers(hotelId, params);
    }
  },
  revalidateOffer: async (input: { offerId: string; hotelId: string; checkIn: string; checkOut: string; occupancy: Occupancy; currency: CurrencyCode }) => {
    if (LiteApiLiveService.isAvailable()) {
      try {
        return await LiteApiLiveService.revalidateOffer(input);
      } catch {
        // Fallback to callable or local
      }
    }
    try {
      return await supplier<{ revalidated: RevalidatedOffer }>("revalidate", input);
    } catch {
      return InAppBookingProvider.revalidateOffer(input);
    }
  },
  createBooking: async (input: CreateBookingInput, idempotencyKey: string) => {
    if (LiteApiLiveService.isAvailable()) {
      try {
        return await LiteApiLiveService.createBooking(input, idempotencyKey);
      } catch {
        // Fallback to callable or local
      }
    }
    try {
      return await supplier<{ booking: Booking; deduplicated: boolean }>("book", { input, idempotencyKey });
    } catch {
      return await InAppBookingProvider.createBooking(input, idempotencyKey);
    }
  },
  listBookings: async () => {
    try {
      const remote = await callFunction<{ bookings: Booking[]; capabilities?: ProviderCapabilities }>("listBookings");
      const local = await InAppBookingProvider.listBookings();
      const map = new Map<string, Booking>();
      for (const b of local.bookings) map.set(b.id, b);
      for (const b of remote.bookings) map.set(b.id, b);
      return { bookings: Array.from(map.values()), capabilities: remote.capabilities ?? InAppBookingProvider.capabilities };
    } catch {
      return await InAppBookingProvider.listBookings();
    }
  },
  getBooking: async (bookingId: string) => {
    try {
      return await supplier<{ booking: Booking; capabilities: ProviderCapabilities }>("booking", { bookingId });
    } catch {
      return await InAppBookingProvider.getBooking(bookingId);
    }
  },
  cancelBooking: async (bookingId: string) => {
    try {
      return await supplier<{ booking: Booking; refundSummary: string }>("cancel", { bookingId });
    } catch {
      return await InAppBookingProvider.cancelBooking(bookingId);
    }
  },
  register: async (input: AuthRegisterInput) => {
    const credential = await createUserWithEmailAndPassword(firebaseAuth(), input.email, input.password);
    await updateProfile(credential.user, { displayName: `${input.firstName} ${input.lastName}` });
    try {
      await callFunction("getProfile");
      await callFunction("updateProfile", { patch: { firstName: input.firstName, lastName: input.lastName, phone: input.phone, preferredCurrency: input.preferredCurrency, preferredLanguage: input.preferredLanguage } });
    } catch {
      // Non-blocking: local session is created and profile sync will complete once functions are live
    }
    return sessionResult({ firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone, preferredCurrency: input.preferredCurrency, preferredLanguage: input.preferredLanguage });
  },
  login: async (input: AuthLoginInput) => {
    await signInWithEmailAndPassword(firebaseAuth(), input.email, input.password);
    return sessionResult();
  },
  logout: async () => { await signOut(firebaseAuth()); return { ok: true }; },
  getMe: async () => {
    try {
      return await callFunction<{ user: AuthenticatedUser }>("getProfile");
    } catch {
      const current = firebaseAuth().currentUser;
      if (!current) throw new ApiClientError({ statusCode: 401, code: "UNAUTHORIZED", message: "Sign in to access goWild's cloud services." });
      const nameParts = (current.displayName || "").trim().split(/\s+/);
      const fallbackUser: AuthenticatedUser = {
        id: current.uid,
        email: current.email ?? "",
        firstName: nameParts[0] || "Traveler",
        lastName: nameParts.slice(1).join(" ") || "",
        phone: current.phoneNumber || "",
        preferredCurrency: "USD" as CurrencyCode,
        preferredLanguage: "en" as LanguageCode,
        createdAt: new Date().toISOString(),
      };
      return { user: fallbackUser };
    }
  },
  updateProfile: (patch: { firstName?: string; lastName?: string; phone?: string; nationality?: string; preferredCurrency?: CurrencyCode; preferredLanguage?: LanguageCode }) => callFunction<{ user: AuthenticatedUser }>("updateProfile", { patch }),
  getFavorites: async () => {
    try {
      return await callFunction<{ hotelIds: string[] }>("getFavorites");
    } catch {
      return { hotelIds: [] };
    }
  },
  addFavorite: (hotelId: string) => callFunction<{ hotelIds: string[] }>("setFavorite", { hotelId, saved: true }),
  removeFavorite: (hotelId: string) => callFunction<{ hotelIds: string[] }>("setFavorite", { hotelId, saved: false }),
  getNotifications: async () => {
    try {
      return await callFunction<{ notifications: NotificationItem[] }>("getNotifications");
    } catch {
      return { notifications: [] };
    }
  },
};

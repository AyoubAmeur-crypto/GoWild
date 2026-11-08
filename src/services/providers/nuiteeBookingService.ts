import type { CurrencyCode, Occupancy } from "../../types/domain";

export const DEFAULT_NUITEE_BOOKING_URL =
  "https://ayoub-ameur-7p9zu.nuitee.link";

const TRUSTED_DOMAINS = [
  "ayoub-ameur-7p9zu.nuitee.link",
  "nuitee.link",
  "liteapi.travel",
];

export interface NuiteeLinkParams {
  checkIn?: string;
  checkOut?: string;
  occupancy?: Occupancy;
  currency?: CurrencyCode;
  placeId?: string;
  clientRef?: string;
  hotelName?: string;
}

/**
 * Encodes string to base64 reliably in React Native, Node, and browser environments.
 */
export function base64Encode(raw: string): string {
  if (typeof globalThis.btoa === "function") {
    try {
      return globalThis.btoa(raw);
    } catch {
      // Fallback below
    }
  }
  const maybeBuffer = (
    globalThis as unknown as {
      Buffer?: {
        from: (
          str: string,
          enc: string
        ) => { toString: (enc: string) => string };
      };
    }
  ).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(raw, "utf-8").toString("base64");
  }

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  for (
    let block = 0, charCode, i = 0, map = chars;
    raw.charAt(i | 0) || ((map = "="), i % 1);
    output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
  ) {
    charCode = raw.charCodeAt((i += 3 / 4));
    if (charCode > 0xff) {
      throw new Error("Invalid character for Base64 encoding");
    }
    block = (block << 8) | charCode;
  }
  return output;
}

/**
 * Encodes guest and room occupancy into the Base64 format expected by LiteAPI/Nuitee.
 * Formula: btoa(JSON.stringify([{ adults: 2, children: [8, 6] }]))
 */
export function buildNuiteeOccupanciesParam(occupancy?: Occupancy): string {
  const occ = occupancy ?? { adults: 2, childrenAges: [], rooms: 1 };
  const roomCount = Math.max(1, occ.rooms || 1);
  const totalAdults = Math.max(1, occ.adults || 2);
  const adultsPerRoom = Math.max(1, Math.floor(totalAdults / roomCount));
  const remainingAdults = totalAdults % roomCount;

  const roomConfigs = Array.from({ length: roomCount }, (_, i) => ({
    adults: adultsPerRoom + (i < remainingAdults ? 1 : 0),
    children: i === 0 ? occ.childrenAges ?? [] : [],
  }));

  return base64Encode(JSON.stringify(roomConfigs));
}

/**
 * Validates that the URL targets an approved HTTPS Nuitee Connect white-label domain.
 */
export function isTrustedNuiteeUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "https:") return false;
    return TRUSTED_DOMAINS.some(
      (trusted) =>
        parsed.hostname === trusted || parsed.hostname.endsWith(`.${trusted}`)
    );
  } catch {
    return false;
  }
}

/**
 * Checks if a given hotel ID is a verified LiteAPI / Nuitee property identifier.
 * Real LiteAPI IDs typically start with "lp" (e.g. "lp4aa75") or are numeric IDs.
 * Prototype fixtures in goWild start with "hotel-", "mock-", or "fixture-".
 */
export function isVerifiedNuiteeHotelId(
  hotelId: string | undefined | null
): boolean {
  if (!hotelId) return false;
  const clean = hotelId.trim();
  if (/^(hotel-|mock-|demo-|test-|fixture-)/i.test(clean)) return false;
  return /^lp[a-z0-9]+/i.test(clean) || /^\d{4,}$/.test(clean);
}

/**
 * Resolves the active base URL from environment or fallback default.
 */
export function getNuiteeBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_NUITEE_BOOKING_URL?.trim();
  if (envUrl && isTrustedNuiteeUrl(envUrl)) {
    return envUrl.replace(/\/+$/, "");
  }
  return DEFAULT_NUITEE_BOOKING_URL;
}

/**
 * Constructs deep link to the Nuitee hotel listing / search page.
 */
export function buildNuiteeSearchUrl(params?: NuiteeLinkParams): string {
  const baseUrl = getNuiteeBaseUrl();
  const searchParams = new URLSearchParams();

  if (params?.checkIn) searchParams.set("checkin", params.checkIn);
  if (params?.checkOut) searchParams.set("checkout", params.checkOut);

  const occupancies = buildNuiteeOccupanciesParam(params?.occupancy);
  searchParams.set("occupancies", occupancies);

  // Preferred currency is MAD by default
  const currency: CurrencyCode = params?.currency ?? "MAD";
  searchParams.set("currency", currency);

  if (params?.placeId?.trim()) {
    searchParams.set("placeId", params.placeId.trim());
  }
  if (params?.clientRef?.trim()) {
    searchParams.set("clientRef", params.clientRef.trim());
  }

  const qs = searchParams.toString();
  return `${baseUrl}/hotels${qs ? `?${qs}` : ""}`;
}

/**
 * Constructs deep link to a specific hotel details page if verified,
 * or safely falls back to the search / listing page if using mock IDs.
 */
export function buildNuiteeHotelUrl(
  hotelId: string,
  params?: NuiteeLinkParams
): { url: string; isDirectHotelLink: boolean } {
  const baseUrl = getNuiteeBaseUrl();
  const isVerified = isVerifiedNuiteeHotelId(hotelId);

  const searchParams = new URLSearchParams();
  if (params?.checkIn) searchParams.set("checkin", params.checkIn);
  if (params?.checkOut) searchParams.set("checkout", params.checkOut);

  const occupancies = buildNuiteeOccupanciesParam(params?.occupancy);
  searchParams.set("occupancies", occupancies);

  const currency: CurrencyCode = params?.currency ?? "MAD";
  searchParams.set("currency", currency);

  if (params?.clientRef?.trim()) {
    searchParams.set("clientRef", params.clientRef.trim());
  }

  const qs = searchParams.toString();

  if (isVerified) {
    return {
      url: `${baseUrl}/hotels/${encodeURIComponent(hotelId.trim())}${qs ? `?${qs}` : ""}`,
      isDirectHotelLink: true,
    };
  }

  // Fallback to general listing/search page with stay parameters pre-filled
  return {
    url: `${baseUrl}/hotels${qs ? `?${qs}` : ""}`,
    isDirectHotelLink: false,
  };
}

/**
 * Launches Nuitee hosted white-label website in iOS in-app Safari / Android Custom Tabs.
 * Ensures strict HTTPS validation and full-screen modal presentation.
 */
export async function openNuiteeHostedBooking(
  targetUrl: string,
  options?: { toolbarColor?: string }
): Promise<{ type: string }> {
  if (!isTrustedNuiteeUrl(targetUrl)) {
    throw new Error(
      `Cannot open untrusted booking URL: "${targetUrl}". Only verified HTTPS Nuitee booking links are permitted.`
    );
  }

  const WebBrowser = await import("expo-web-browser");
  return await WebBrowser.openBrowserAsync(targetUrl, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    controlsColor: "#2853AF",
    toolbarColor: options?.toolbarColor ?? "#171725",
    dismissButtonStyle: "done",
    enableBarCollapsing: true,
  });
}

/**
 * High-level Nuitee booking service facade.
 */
export const NuiteeBookingService = {
  getBaseUrl: getNuiteeBaseUrl,
  isTrustedUrl: isTrustedNuiteeUrl,
  isVerifiedHotelId: isVerifiedNuiteeHotelId,
  buildSearchUrl: buildNuiteeSearchUrl,
  buildHotelUrl: buildNuiteeHotelUrl,

  async openHotelBooking(
    hotelId: string,
    params?: NuiteeLinkParams
  ): Promise<{ result: { type: string }; url: string; isDirectHotelLink: boolean }> {
    const { url, isDirectHotelLink } = buildNuiteeHotelUrl(hotelId, params);
    const result = await openNuiteeHostedBooking(url);
    return { result, url, isDirectHotelLink };
  },

  async openSearchBooking(
    params?: NuiteeLinkParams
  ): Promise<{ result: { type: string }; url: string }> {
    const url = buildNuiteeSearchUrl(params);
    const result = await openNuiteeHostedBooking(url);
    return { result, url };
  },
};

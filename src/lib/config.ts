import Constants from "expo-constants";
import { Platform } from "react-native";
import type { CurrencyCode, LanguageCode } from "../types/domain";

function normalizeBaseUrl(rawUrl: string): string {
  const clean = rawUrl.trim().replace(/\/+$/, "");
  if (!clean) return "";
  if (Platform.OS === "android") {
    return clean
      .replace("://localhost", "://10.0.2.2")
      .replace("://127.0.0.1", "://10.0.2.2");
  }
  return clean;
}

function extractExpoHostUri(): string | undefined {
  const fromExpoConfig = Constants.expoConfig?.hostUri;
  if (fromExpoConfig && typeof fromExpoConfig === "string") {
    return fromExpoConfig.trim();
  }
  const manifest2Host = (
    Constants as unknown as {
      manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
    }
  ).manifest2?.extra?.expoClient?.hostUri;
  if (manifest2Host && typeof manifest2Host === "string") {
    return manifest2Host.trim();
  }
  return undefined;
}

/**
 * Builds an ordered list of remote API Gateway candidate origins:
 * 1. User-configured Cloud Gateway URL (Profile -> API Gateway Settings)
 * 2. Environment-configured Cloud Gateway URL (`EXPO_PUBLIC_API_BASE_URL`)
 * 3. Built-in Expo Server API Gateway (`src/app/api/[...route]+api.ts` on Metro / EAS Hosting)
 * 4. Standalone Node 24 BFF (`server/` on port 4010 via detected LAN host IP or loopback)
 */
export function resolveGatewayCandidates(customGatewayUrl?: string): string[] {
  const candidates: string[] = [];
  const pushUnique = (candidate: string, allowEmptyRelative = false) => {
    const norm = allowEmptyRelative && candidate === "" ? "" : normalizeBaseUrl(candidate);
    if (!allowEmptyRelative && !norm) return;
    if (!candidates.includes(norm)) {
      candidates.push(norm);
    }
  };

  if (customGatewayUrl?.trim()) {
    pushUnique(customGatewayUrl);
  }

  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envUrl) {
    pushUnique(envUrl);
  }

  if (Platform.OS === "web") {
    // Same-origin `/api/*` works both in `expo start --web` and on EAS Hosting / Vercel
    pushUnique("", true);
    pushUnique("http://localhost:4010");
    return candidates;
  }

  const hostUri = extractExpoHostUri();
  if (hostUri) {
    const cleanHost = hostUri.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (cleanHost.includes(".exp.direct") || cleanHost.includes(".ngrok")) {
      pushUnique(`https://${cleanHost}`);
    } else {
      pushUnique(`http://${cleanHost}`);
      const hostOnly = cleanHost.split(":")[0];
      if (hostOnly) {
        pushUnique(`http://${hostOnly}:4010`);
      }
    }
  }

  pushUnique("http://localhost:8081");
  pushUnique("http://localhost:4010");

  return candidates;
}

export const AppConfig = {
  apiBaseUrl: resolveGatewayCandidates()[0] ?? "http://localhost:8081",
  strictRemoteGatewayOnly:
    process.env.EXPO_PUBLIC_STRICT_REMOTE_GATEWAY === "true",
  requestTimeoutMs: 12000,
  probeTimeoutMs: 3200,
  appName: "goWild",
  supportEmail: "concierge@gowild.travel",
  supportPhone: "+1 (800) 555-0199",
} as const;

export const UI_COPY: Record<
  LanguageCode,
  {
    discoverSubtitle: string;
    searchPlaceholder: string;
    mostPopular: string;
    recommendedForYou: string;
    exploreMap: string;
    myTrips: string;
    savedHotels: string;
    profileAndSettings: string;
    selectRoom: string;
    bookNow: string;
    freeCancellation: string;
  }
> = {
  en: {
    discoverSubtitle: "Worldwide stays with verified rates",
    searchPlaceholder: "Search city, landmark, or hotel...",
    mostPopular: "Most Popular",
    recommendedForYou: "Recommended Stays",
    exploreMap: "Map View",
    myTrips: "My Trips",
    savedHotels: "Saved Hotels",
    profileAndSettings: "Profile & Preferences",
    selectRoom: "Select Room",
    bookNow: "Review & Reserve",
    freeCancellation: "Free cancellation",
  },
  fr: {
    discoverSubtitle: "Hôtels internationaux aux tarifs vérifiés",
    searchPlaceholder: "Ville, lieu ou hôtel...",
    mostPopular: "Les plus prisés",
    recommendedForYou: "Séjours recommandés",
    exploreMap: "Carte",
    myTrips: "Mes Voyages",
    savedHotels: "Favoris",
    profileAndSettings: "Profil & Préférences",
    selectRoom: "Choisir une chambre",
    bookNow: "Vérifier & Réserver",
    freeCancellation: "Annulation gratuite",
  },
};

export function getCopy(lang: LanguageCode) {
  return UI_COPY[lang] ?? UI_COPY.en;
}

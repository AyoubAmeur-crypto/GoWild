import type { CurrencyCode, LanguageCode } from "../types/domain";

export const AppConfig = {
  appName: "goWild",
  supportEmail: "concierge@gowild.travel",
  supportPhone: "+1 (800) 555-0199",
  nuiteeBookingUrl:
    process.env.EXPO_PUBLIC_NUITEE_BOOKING_URL?.trim() ||
    "https://ayoub-ameur-7p9zu.nuitee.link",
  defaultCurrency: "MAD" as CurrencyCode,
  defaultLanguage: "en" as LanguageCode,
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

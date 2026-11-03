import { useQuery } from "@tanstack/react-query";
import { goWildApi } from "../../../services/http/apiClient";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useSearchStore } from "../../../stores/useSearchStore";
import type { HotelSearchQuery } from "../../../types/domain";

export function useProviderHealth() {
  return useQuery({
    queryKey: ["provider-health"],
    queryFn: () => goWildApi.getHealth(),
    staleTime: 60_000,
  });
}

export function usePlaceAutocomplete(query: string) {
  const language = useSettingsStore((s) => s.language);
  const trimmed = query.trim();

  return useQuery({
    queryKey: ["places-autocomplete", trimmed, language],
    queryFn: () => goWildApi.autocompletePlaces(trimmed, language),
    enabled: trimmed.length >= 1,
    staleTime: 120_000,
  });
}

export function useFeaturedHotels() {
  const currency = useSettingsStore((s) => s.currency);
  const checkIn = useSearchStore((s) => s.checkIn);
  const checkOut = useSearchStore((s) => s.checkOut);

  return useQuery({
    queryKey: ["hotels", "featured", currency, checkIn, checkOut],
    queryFn: () => goWildApi.getFeaturedHotels(currency, checkIn, checkOut),
  });
}

export function useHotelSearch(overrideQuery?: Partial<HotelSearchQuery>) {
  const currency = useSettingsStore((s) => s.currency);
  const language = useSettingsStore((s) => s.language);
  const destination = useSearchStore((s) => s.destination);
  const placeId = useSearchStore((s) => s.placeId);
  const cityName = useSearchStore((s) => s.cityName);
  const countryCode = useSearchStore((s) => s.countryCode);
  const latitude = useSearchStore((s) => s.latitude);
  const longitude = useSearchStore((s) => s.longitude);
  const checkIn = useSearchStore((s) => s.checkIn);
  const checkOut = useSearchStore((s) => s.checkOut);
  const occupancy = useSearchStore((s) => s.occupancy);
  const sortBy = useSearchStore((s) => s.sortBy);
  const filters = useSearchStore((s) => s.filters);

  const fullQuery: HotelSearchQuery = {
    destination: destination.trim() || undefined,
    placeId,
    cityName,
    countryCode,
    latitude,
    longitude,
    radiusKm: latitude !== undefined ? 35 : undefined,
    checkIn,
    checkOut,
    occupancy,
    currency,
    language,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minStarRating: filters.minStarRating,
    propertyTypes:
      filters.propertyTypes.length > 0 ? filters.propertyTypes : undefined,
    amenities: filters.amenities.length > 0 ? filters.amenities : undefined,
    freeCancellationOnly: filters.freeCancellationOnly || undefined,
    instantConfirmationOnly: filters.instantConfirmationOnly || undefined,
    sortBy,
    ...overrideQuery,
  };

  return useQuery({
    queryKey: ["hotels", "search", fullQuery],
    queryFn: () => goWildApi.searchHotels(fullQuery),
  });
}

export function useHotelDetail(hotelId: string | undefined) {
  const currency = useSettingsStore((s) => s.currency);
  const language = useSettingsStore((s) => s.language);

  return useQuery({
    queryKey: ["hotels", "detail", hotelId, currency, language],
    queryFn: () => {
      if (!hotelId) {
        throw new Error("Hotel ID is required");
      }
      return goWildApi.getHotelDetails(hotelId, currency, language);
    },
    enabled: Boolean(hotelId),
  });
}


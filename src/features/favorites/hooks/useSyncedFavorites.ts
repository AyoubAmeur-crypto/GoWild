import { useEffect } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { goWildApi } from "../../../services/http/apiClient";
import { useFavoritesStore } from "../../../stores/favoritesStore";
import { useAuthStore } from "../../../stores/useAuthStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import type { Hotel } from "../../../types/domain";

export function useSyncedFavorites() {
  const token = useAuthStore((s) => s.token);
  const favoriteIds = useFavoritesStore((s) => s.favoriteIds);
  const setFavoriteIds = useFavoritesStore((s) => s.setFavoriteIds);
  const currency = useSettingsStore((s) => s.currency);
  const language = useSettingsStore((s) => s.language);

  const remoteSyncQuery = useQuery({
    queryKey: ["favorites", "remote", token],
    queryFn: () => goWildApi.getFavorites(),
    enabled: Boolean(token),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (remoteSyncQuery.data?.hotelIds) {
      const merged = Array.from(
        new Set([...favoriteIds, ...remoteSyncQuery.data.hotelIds])
      );
      if (merged.length !== favoriteIds.length) {
        setFavoriteIds(merged);
      }
    }
  }, [remoteSyncQuery.data, favoriteIds, setFavoriteIds]);

  const hotelQueries = useQueries({
    queries: favoriteIds.map((id) => ({
      queryKey: ["hotels", "detail", id, currency, language],
      queryFn: () => goWildApi.getHotelDetails(id, currency, language),
      staleTime: 5 * 60_000,
    })),
  });

  const savedHotels: Hotel[] = [];
  let isLoading = false;
  let firstError: unknown = null;

  for (const q of hotelQueries) {
    if (q.isLoading) isLoading = true;
    if (q.error && !firstError) firstError = q.error;
    if (q.data?.hotel) savedHotels.push(q.data.hotel);
  }

  return {
    favoriteIds,
    savedHotels,
    isLoading,
    error: firstError,
    refetchAll: () => {
      for (const q of hotelQueries) {
        q.refetch();
      }
    },
  };
}


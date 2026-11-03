import { useMutation, useQuery } from "@tanstack/react-query";
import { goWildApi } from "../../../services/http/apiClient";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useSearchStore } from "../../../stores/useSearchStore";
import type { Occupancy } from "../../../types/domain";

export function useRoomOffers(hotelId: string | undefined) {
  const currency = useSettingsStore((s) => s.currency);
  const checkIn = useSearchStore((s) => s.checkIn);
  const checkOut = useSearchStore((s) => s.checkOut);
  const occupancy = useSearchStore((s) => s.occupancy);

  return useQuery({
    queryKey: ["hotel-offers", hotelId, checkIn, checkOut, occupancy, currency],
    queryFn: () => {
      if (!hotelId) {
        throw new Error("Hotel ID is required");
      }
      return goWildApi.getRoomOffers(hotelId, {
        checkIn,
        checkOut,
        occupancy,
        currency,
      });
    },
    enabled: Boolean(hotelId && checkOut > checkIn),
    staleTime: 60_000,
  });
}

export function useRevalidateOffer() {
  const currency = useSettingsStore((s) => s.currency);

  return useMutation({
    mutationFn: (params: {
      offerId: string;
      hotelId: string;
      checkIn: string;
      checkOut: string;
      occupancy: Occupancy;
    }) =>
      goWildApi.revalidateOffer({
        ...params,
        currency,
      }),
  });
}


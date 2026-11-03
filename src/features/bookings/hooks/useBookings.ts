import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { goWildApi } from "../../../services/http/apiClient";
import type { CreateBookingInput } from "../../../lib/validation";

export function useBookingsList() {
  return useQuery({
    queryKey: ["bookings", "list"],
    queryFn: () => goWildApi.listBookings(),
  });
}

export function useBookingDetail(bookingId: string | undefined) {
  return useQuery({
    queryKey: ["bookings", "detail", bookingId],
    queryFn: () => {
      if (!bookingId) {
        throw new Error("Booking ID is required");
      }
      return goWildApi.getBooking(bookingId);
    },
    enabled: Boolean(bookingId),
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      input: CreateBookingInput;
      idempotencyKey: string;
    }) => goWildApi.createBooking(params.input, params.idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) => goWildApi.cancelBooking(bookingId),
    onSuccess: (_, bookingId) => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["bookings", "detail", bookingId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}


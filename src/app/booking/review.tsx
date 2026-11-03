import React from "react";
import { useLocalSearchParams } from "expo-router";
import { BookingReviewScreen } from "../../features/bookings/screens/BookingReviewScreen";

export default function BookingReviewRoute() {
  const { hotelId, offerId } = useLocalSearchParams<{
    hotelId: string;
    offerId: string;
  }>();
  return (
    <BookingReviewScreen
      hotelId={hotelId ?? ""}
      offerId={offerId ?? ""}
    />
  );
}


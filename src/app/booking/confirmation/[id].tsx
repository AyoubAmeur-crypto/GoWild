import React from "react";
import { useLocalSearchParams } from "expo-router";
import { BookingConfirmationScreen } from "../../../features/bookings/screens/BookingConfirmationScreen";

export default function BookingConfirmationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookingConfirmationScreen bookingId={id ?? ""} />;
}


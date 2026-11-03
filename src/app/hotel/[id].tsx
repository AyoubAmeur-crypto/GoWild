import React from "react";
import { useLocalSearchParams } from "expo-router";
import { HotelDetailScreen } from "../../features/hotels/screens/HotelDetailScreen";

export default function HotelDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HotelDetailScreen hotelId={id ?? ""} />;
}


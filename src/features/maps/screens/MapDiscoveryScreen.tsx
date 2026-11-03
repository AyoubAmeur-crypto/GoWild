import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  SlidersHorizontal,
  List,
  MapPin,
} from "lucide-react-native";
import type { Hotel } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSearchStore } from "../../../stores/useSearchStore";
import { formatDateRangeShort, haversineDistanceKm } from "../../../lib/pricing";
import { GlassSurface } from "../../../components/ui/GlassSurface";
import { Skeleton } from "../../../components/ui/Skeleton";
import { ErrorState } from "../../../components/ui/ErrorState";
import { EmptyState } from "../../../components/ui/EmptyState";
import {
  useFeaturedHotels,
  useHotelSearch,
} from "../../hotels/hooks/useHotels";
import { InteractiveHotelMap } from "../components/InteractiveHotelMap";

const QUICK_MAP_DESTINATIONS: {
  label: string;
  city?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
}[] = [
  { label: "Worldwide" },
  { label: "Paris", city: "Paris", countryCode: "FR", lat: 48.8566, lng: 2.3522 },
  {
    label: "Marrakech",
    city: "Marrakech",
    countryCode: "MA",
    lat: 31.6295,
    lng: -7.9811,
  },
  { label: "Tokyo", city: "Tokyo", countryCode: "JP", lat: 35.6762, lng: 139.6503 },
  { label: "Dubai", city: "Dubai", countryCode: "AE", lat: 25.2048, lng: 55.2708 },
  {
    label: "New York",
    city: "New York",
    countryCode: "US",
    lat: 40.758,
    lng: -73.9855,
  },
  {
    label: "Santorini",
    city: "Santorini",
    countryCode: "GR",
    lat: 36.4618,
    lng: 25.3753,
  },
];

export const MapDiscoveryScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();

  const destination = useSearchStore((s) => s.destination);
  const cityName = useSearchStore((s) => s.cityName);
  const checkIn = useSearchStore((s) => s.checkIn);
  const checkOut = useSearchStore((s) => s.checkOut);
  const clearPlace = useSearchStore((s) => s.clearPlace);
  const selectPlace = useSearchStore((s) => s.selectPlace);

  const searchQuery = useHotelSearch();
  const featuredQuery = useFeaturedHotels();
  const hotels = searchQuery.data?.hotels ?? [];
  const allCatalogHotels = featuredQuery.data?.hotels ?? hotels;
  const [selectedHotelId, setSelectedHotelId] = useState<string | undefined>();

  const handleQuickCity = (item: (typeof QUICK_MAP_DESTINATIONS)[number]) => {
    setSelectedHotelId(undefined);
    if (!item.city) {
      clearPlace();
      return;
    }
    selectPlace({
      placeId: `quick_${item.city.toLowerCase()}`,
      title: item.city,
      subtitle: item.city,
      cityName: item.city,
      country: item.countryCode ?? "",
      countryCode: item.countryCode ?? "US",
      latitude: item.lat ?? 0,
      longitude: item.lng ?? 0,
      type: "city",
    });
  };

  const handlePressMapPoint = ({
    latitude,
    longitude,
  }: {
    latitude: number;
    longitude: number;
  }) => {
    const pool = allCatalogHotels.length > 0 ? allCatalogHotels : hotels;
    let nearest: Hotel | null = null;
    let bestDistKm = Number.POSITIVE_INFINITY;

    for (const candidate of pool) {
      const dist = haversineDistanceKm(
        latitude,
        longitude,
        candidate.location.latitude,
        candidate.location.longitude
      );
      if (dist < bestDistKm) {
        bestDistKm = dist;
        nearest = candidate;
      }
    }

    if (nearest && bestDistKm <= 2200) {
      selectPlace({
        placeId: `map_${nearest.location.city.toLowerCase()}`,
        title: nearest.location.city,
        subtitle: `${nearest.location.city}, ${nearest.location.country}`,
        cityName: nearest.location.city,
        country: nearest.location.country,
        countryCode: nearest.location.countryCode,
        latitude: nearest.location.latitude,
        longitude: nearest.location.longitude,
        type: "city",
      });
    } else {
      clearPlace();
    }

    router.push("/search");
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      {/* Floating Restrained Glass Top Bar + Quick Destination Pills */}
      <View
        style={[
          styles.floatingHeader,
          { top: Math.max(insets.top + 8, 16) },
        ]}
      >
        <GlassSurface borderRadius={22} intensity={60} style={styles.glassBar}>
          <View style={styles.barInner}>
            <Pressable
              onPress={() => router.back()}
              style={[
                styles.iconBtn,
                { backgroundColor: palette.surface },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ArrowLeft size={18} color={palette.text} />
            </Pressable>

            <Pressable
              onPress={() => router.push("/search")}
              style={styles.centerMeta}
            >
              <Text
                style={[styles.barTitle, { color: palette.text }]}
                numberOfLines={1}
              >
                {destination || "Worldwide"}
              </Text>
              <Text style={[styles.barSub, { color: palette.subtext }]}>
                {formatDateRangeShort(checkIn, checkOut)} · {hotels.length}{" "}
                stays
              </Text>
            </Pressable>

            <View style={styles.rightActions}>
              <Pressable
                onPress={() => router.push("/search")}
                style={[
                  styles.iconBtn,
                  { backgroundColor: palette.surface },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Switch to list view and filters"
              >
                <SlidersHorizontal size={17} color={palette.primary} />
              </Pressable>
              <Pressable
                onPress={() => router.push("/search")}
                style={[
                  styles.iconBtn,
                  { backgroundColor: palette.primary },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Open list view"
              >
                <List size={17} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </GlassSurface>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cityPillsRow}
        >
          {QUICK_MAP_DESTINATIONS.map((item) => {
            const active = item.city
              ? (cityName ?? destination)
                  .toLowerCase()
                  .includes(item.city.toLowerCase())
              : !destination.trim() && !cityName;
            return (
              <Pressable
                key={item.label}
                onPress={() => handleQuickCity(item)}
                style={[
                  styles.cityPill,
                  {
                    backgroundColor: active ? palette.primary : palette.surface,
                    borderColor: active ? palette.primary : palette.border,
                  },
                ]}
              >
                <MapPin
                  size={12}
                  color={active ? "#FFFFFF" : palette.primary}
                />
                <Text
                  style={[
                    styles.cityPillText,
                    { color: active ? "#FFFFFF" : palette.text },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {searchQuery.isLoading ? (
        <View style={styles.centerState}>
          <Skeleton height={320} borderRadius={22} />
        </View>
      ) : searchQuery.error ? (
        <View style={styles.centerState}>
          <ErrorState
            error={searchQuery.error}
            onRetry={() => searchQuery.refetch()}
          />
        </View>
      ) : hotels.length === 0 ? (
        <View style={styles.centerState}>
          <EmptyState
            title="No hotels in this map area"
            description="Reset active filters to view available stays."
            actionLabel="Show All Stays"
            onAction={() => clearPlace()}
          />
        </View>
      ) : (
        <InteractiveHotelMap
          hotels={hotels}
          selectedHotelId={selectedHotelId}
          onSelectHotel={(hotel) => setSelectedHotelId(hotel.id)}
          onOpenHotelDetail={(hotel) => router.push(`/hotel/${hotel.id}`)}
          onPressMapPoint={handlePressMapPoint}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  floatingHeader: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 50,
    gap: 8,
  },
  glassBar: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  barInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  centerMeta: {
    flex: 1,
    gap: 1,
  },
  barTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  barSub: {
    fontSize: 11,
    fontWeight: "600",
  },
  rightActions: {
    flexDirection: "row",
    gap: 6,
  },
  cityPillsRow: {
    gap: 8,
    paddingRight: 8,
  },
  cityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: "#171725",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cityPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
});

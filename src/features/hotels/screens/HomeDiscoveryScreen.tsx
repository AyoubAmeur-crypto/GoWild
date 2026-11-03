import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  Search,
  MapPin,
  Calendar,
  Users,
  Clock,
  Compass,
  ChevronRight,
} from "lucide-react-native";
import type { PropertyType } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useSearchStore } from "../../../stores/useSearchStore";
import { getCopy } from "../../../lib/config";
import { formatDateRangeShort } from "../../../lib/pricing";
import { BrandLogo } from "../../../components/ui/BrandLogo";
import { SearchBar } from "../../../components/ui/SearchBar";
import { Skeleton } from "../../../components/ui/Skeleton";
import { ErrorState } from "../../../components/ui/ErrorState";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useFeaturedHotels } from "../hooks/useHotels";
import { HotelCard } from "../components/HotelCard";
import { useNotificationsQuery } from "../../notifications/hooks/useNotifications";

const TRENDING_CITIES = [
  { city: "Paris", country: "France", code: "FR", lat: 48.8566, lng: 2.3522 },
  { city: "Tokyo", country: "Japan", code: "JP", lat: 35.6762, lng: 139.6503 },
  {
    city: "Marrakech",
    country: "Morocco",
    code: "MA",
    lat: 31.6295,
    lng: -7.9811,
  },
  {
    city: "Santorini",
    country: "Greece",
    code: "GR",
    lat: 36.4618,
    lng: 25.3753,
  },
  {
    city: "New York",
    country: "United States",
    code: "US",
    lat: 40.758,
    lng: -73.9855,
  },
  {
    city: "Dubai",
    country: "United Arab Emirates",
    code: "AE",
    lat: 25.2048,
    lng: 55.2708,
  },
];

const CATEGORY_TABS: { key: "all" | PropertyType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "hotel", label: "Hotels" },
  { key: "resort", label: "Resorts" },
  { key: "villa", label: "Villas" },
  { key: "boutique", label: "Boutique" },
  { key: "apartment", label: "Apartments" },
];

export const HomeDiscoveryScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();

  const language = useSettingsStore((s) => s.language);
  const copy = getCopy(language);

  const destination = useSearchStore((s) => s.destination);
  const checkIn = useSearchStore((s) => s.checkIn);
  const checkOut = useSearchStore((s) => s.checkOut);
  const occupancy = useSearchStore((s) => s.occupancy);
  const recentSearches = useSearchStore((s) => s.recentSearches);
  const selectPlace = useSearchStore((s) => s.selectPlace);
  const applyRecentSearch = useSearchStore((s) => s.applyRecentSearch);

  const [selectedCategory, setSelectedCategory] = useState<
    "all" | PropertyType
  >("all");

  const featuredQuery = useFeaturedHotels();
  const notificationsQuery = useNotificationsQuery();

  const unreadCount = useMemo(
    () =>
      (notificationsQuery.data?.notifications ?? []).filter((n) => !n.read)
        .length,
    [notificationsQuery.data]
  );

  const allHotels = featuredQuery.data?.hotels ?? [];
  const popularHotels = useMemo(() => allHotels.slice(0, 6), [allHotels]);
  const recommendedHotels = useMemo(() => {
    if (selectedCategory === "all") return allHotels;
    return allHotels.filter((h) => h.propertyType === selectedCategory);
  }, [allHotels, selectedCategory]);

  const bottomPad = Platform.OS === "android" ? 112 : 40;

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 8, 18),
            paddingBottom: bottomPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Symmetric Top Bar with Centered goWild Logo */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.push("/search")}
            style={[
              styles.iconCircle,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open hotel search"
          >
            <Search size={18} color={palette.text} />
          </Pressable>

          <View style={styles.brandCenter}>
            <BrandLogo height={34} />
          </View>

          <Pressable
            onPress={() => router.push("/notifications")}
            style={[
              styles.iconCircle,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
          >
            <Bell size={18} color={palette.text} />
            {unreadCount > 0 ? <View style={styles.unreadDot} /> : null}
          </Pressable>
        </View>

        {/* Search Trigger + Dates/Guests Strip */}
        <View style={styles.searchBlock}>
          <SearchBar
            value={destination}
            placeholder={copy.searchPlaceholder}
            readOnly
            onPress={() => router.push("/search")}
            onFilterPress={() => router.push("/search")}
          />

          <View style={styles.tripMetaRow}>
            <Pressable
              onPress={() => router.push("/search")}
              style={[
                styles.tripMetaChip,
                {
                  backgroundColor: palette.surfaceMuted,
                  borderColor: palette.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Change check-in and check-out dates"
            >
              <Calendar size={14} color={palette.primary} />
              <Text style={[styles.tripMetaText, { color: palette.text }]}>
                {formatDateRangeShort(checkIn, checkOut)}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/search")}
              style={[
                styles.tripMetaChip,
                {
                  backgroundColor: palette.surfaceMuted,
                  borderColor: palette.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Change rooms and guests"
            >
              <Users size={14} color={palette.primary} />
              <Text style={[styles.tripMetaText, { color: palette.text }]}>
                {occupancy.rooms} Rm ·{" "}
                {occupancy.adults + occupancy.childrenAges.length} Guests
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Concise Map Banner */}
        <Pressable
          onPress={() => router.push("/map")}
          style={[
            styles.mapBanner,
            { backgroundColor: palette.surfaceIce },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Explore hotels on interactive map"
        >
          <View
            style={[
              styles.mapPinCircle,
              { backgroundColor: palette.surface },
            ]}
          >
            <MapPin size={19} color={palette.primary} />
          </View>
          <View style={styles.mapBannerTextCol}>
            <Text style={[styles.mapBannerTitle, { color: palette.text }]}>
              Explore Map
            </Text>
            <Text style={[styles.mapBannerSub, { color: palette.subtext }]}>
              Find stays by area
            </Text>
          </View>
          <ChevronRight size={18} color={palette.primary} />
        </Pressable>

        {/* Trending Destinations */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Destinations
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalRow}
        >
          {TRENDING_CITIES.map((item) => (
            <Pressable
              key={item.city}
              onPress={() => {
                selectPlace({
                  placeId: `trend_${item.code.toLowerCase()}`,
                  title: item.city,
                  subtitle: `${item.city}, ${item.country}`,
                  cityName: item.city,
                  country: item.country,
                  countryCode: item.code,
                  latitude: item.lat,
                  longitude: item.lng,
                  type: "city",
                });
                router.push("/search");
              }}
              style={[
                styles.cityPill,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Search hotels in ${item.city}`}
            >
              <Compass size={14} color={palette.primary} />
              <Text style={[styles.cityPillName, { color: palette.text }]}>
                {item.city}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Recent Searches */}
        {recentSearches.length > 0 ? (
          <View style={styles.recentSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRow}
            >
              {recentSearches.map((rs) => (
                <Pressable
                  key={rs.id}
                  onPress={() => {
                    applyRecentSearch(rs);
                    router.push("/search");
                  }}
                  style={[
                    styles.recentChip,
                    {
                      backgroundColor: palette.surfaceMuted,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Clock size={12} color={palette.subtext} />
                  <Text style={[styles.recentLabel, { color: palette.text }]}>
                    {rs.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Loading / Error / Inventory Sections */}
        {featuredQuery.isLoading ? (
          <View style={styles.skeletonBlock}>
            <Skeleton height={24} width={140} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRow}
            >
              <Skeleton width={214} height={248} borderRadius={20} />
              <Skeleton width={214} height={248} borderRadius={20} />
            </ScrollView>
            <Skeleton height={96} borderRadius={16} />
            <Skeleton height={96} borderRadius={16} />
          </View>
        ) : featuredQuery.error ? (
          <ErrorState
            error={featuredQuery.error}
            onRetry={() => featuredQuery.refetch()}
          />
        ) : (
          <>
            {/* Popular Carousel */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                {copy.mostPopular}
              </Text>
              <Pressable
                onPress={() => router.push("/search")}
                accessibilityRole="button"
                accessibilityLabel="See all hotels"
              >
                <Text style={[styles.seeAll, { color: palette.primary }]}>
                  See All
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRow}
            >
              {popularHotels.map((hotel) => (
                <HotelCard
                  key={hotel.id}
                  hotel={hotel}
                  variant="hero"
                  onPress={() => router.push(`/hotel/${hotel.id}`)}
                />
              ))}
            </ScrollView>

            {/* Recommended Stays + Category Filter Chips */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Recommended
              </Text>
              <Pressable
                onPress={() => router.push("/map")}
                accessibilityRole="button"
              >
                <Text style={[styles.seeAll, { color: palette.primary }]}>
                  Map
                </Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRow}
            >
              {CATEGORY_TABS.map((tab) => {
                const active = selectedCategory === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setSelectedCategory(tab.key)}
                    style={[
                      styles.catPill,
                      {
                        backgroundColor: active
                          ? palette.primary
                          : palette.surface,
                        borderColor: active ? palette.primary : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.catPillText,
                        { color: active ? "#FFFFFF" : palette.subtext },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {recommendedHotels.length === 0 ? (
              <EmptyState
                title="No stays in this category"
                description="Select All to see every available stay."
                actionLabel="Show All"
                onAction={() => setSelectedCategory("all")}
              />
            ) : (
              <View style={styles.recommendedList}>
                {recommendedHotels.map((hotel) => (
                  <HotelCard
                    key={hotel.id}
                    hotel={hotel}
                    variant="compact"
                    onPress={() => router.push(`/hotel/${hotel.id}`)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F41F52",
  },
  searchBlock: {
    gap: 10,
  },
  tripMetaRow: {
    flexDirection: "row",
    gap: 10,
  },
  tripMetaChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  tripMetaText: {
    fontSize: 12,
    fontWeight: "600",
  },
  mapBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 12,
  },
  mapPinCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  mapBannerTextCol: {
    flex: 1,
    gap: 1,
  },
  mapBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  mapBannerSub: {
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "700",
  },
  horizontalRow: {
    gap: 12,
    paddingRight: 4,
  },
  cityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  cityPillName: {
    fontSize: 13,
    fontWeight: "700",
  },
  recentSection: {
    marginTop: -2,
  },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  recentLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  catPill: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  catPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  recommendedList: {
    gap: 12,
  },
  skeletonBlock: {
    gap: 14,
  },
});

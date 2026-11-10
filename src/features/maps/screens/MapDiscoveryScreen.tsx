import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  BackHandler,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Building2,
  Building,
  Home,
  Palmtree,
  Castle,
  SlidersHorizontal,
  Star,
  Heart,
  MapPin,
  X,
  Search,
} from "lucide-react-native";
import type { Hotel, PropertyType } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSearchStore } from "../../../stores/useSearchStore";
import { useFavoritesStore } from "../../../stores/favoritesStore";
import {
  formatDateRangeShort,
  formatMoney,
  haversineDistanceKm,
} from "../../../lib/pricing";
import { triggerSelectionHaptic } from "../../../lib/haptics";
import { Skeleton } from "../../../components/ui/Skeleton";
import { ErrorState } from "../../../components/ui/ErrorState";
import { EmptyState } from "../../../components/ui/EmptyState";
import {
  useFeaturedHotels,
  useHotelSearch,
} from "../../hotels/hooks/useHotels";
import { InteractiveHotelMap } from "../components/InteractiveHotelMap";
import { AppBottomSheet } from "../../../components/ui/AppBottomSheet";
import { SpringBottomSheet } from "../../../components/ui/SpringBottomSheet";
import { DateRangePicker } from "../../availability/components/DateRangePicker";
import { GuestCounter } from "../../availability/components/GuestCounter";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

interface StayCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  propertyType?: PropertyType;
}

const STAY_CATEGORIES: StayCategory[] = [
  { id: "all", label: "Your search", icon: Home },
  { id: "hotel", label: "Hotels", icon: Building2, propertyType: "hotel" },
  { id: "rental", label: "Airbnb", icon: Home, propertyType: "apartment" },
  { id: "apartment", label: "Apartments", icon: Building, propertyType: "apartment" },
  { id: "villa", label: "Villas", icon: Castle, propertyType: "villa" },
  { id: "resort", label: "Resorts", icon: Palmtree, propertyType: "resort" },
];

export const MapDiscoveryScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, isDark } = useAppTheme();

  const destination = useSearchStore((s) => s.destination);
  const cityName = useSearchStore((s) => s.cityName);
  const checkIn = useSearchStore((s) => s.checkIn);
  const checkOut = useSearchStore((s) => s.checkOut);
  const occupancy = useSearchStore((s) => s.occupancy);
  const setDates = useSearchStore((s) => s.setDates);
  const setOccupancy = useSearchStore((s) => s.setOccupancy);
  const clearPlace = useSearchStore((s) => s.clearPlace);
  const selectPlace = useSearchStore((s) => s.selectPlace);

  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const toggleFavoriteLocal = useFavoritesStore((s) => s.toggleFavoriteLocal);

  const searchQuery = useHotelSearch();
  const featuredQuery = useFeaturedHotels();
  const searchHotels = searchQuery.data?.hotels ?? [];
  const catalogHotels = featuredQuery.data?.hotels ?? [];
  const allHotels = searchHotels.length > 0 ? searchHotels : catalogHotels;

  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedHotelId, setSelectedHotelId] = useState<string | undefined>();
  const [showHalfModal, setShowHalfModal] = useState<boolean>(false);

  // Full-width Date & Guest Picker inside map
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [draftCheckIn, setDraftCheckIn] = useState<string>(checkIn);
  const [draftCheckOut, setDraftCheckOut] = useState<string>(checkOut);
  const [draftOccupancy, setDraftOccupancy] = useState(occupancy);

  // Hardware Back button handling on Android
  useEffect(() => {
    const onBackPress = () => {
      if (showHalfModal) {
        setShowHalfModal(false);
        return true;
      }
      if (pickerOpen) {
        setPickerOpen(false);
        return true;
      }
      if (selectedHotelId) {
        setSelectedHotelId(undefined);
        return true;
      }
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      router.navigate("/(tabs)");
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [showHalfModal, pickerOpen, selectedHotelId, router]);

  const handleOpenPicker = () => {
    triggerSelectionHaptic();
    setDraftCheckIn(checkIn);
    setDraftCheckOut(checkOut);
    setDraftOccupancy(occupancy);
    setPickerOpen(true);
  };

  const handleApplyPicker = () => {
    triggerSelectionHaptic();
    setDates(draftCheckIn, draftCheckOut);
    setOccupancy(draftOccupancy);
    setPickerOpen(false);
  };

  // Filter hotels by selected property type
  const filteredHotels = useMemo(() => {
    if (selectedType === "all") return allHotels;
    const cat = STAY_CATEGORIES.find((c) => c.id === selectedType);
    if (!cat || !cat.propertyType) return allHotels;
    return allHotels.filter(
      (h) => h.propertyType === cat.propertyType || (selectedType === "rental" && h.propertyType === "apartment")
    );
  }, [allHotels, selectedType]);

  const activeHotel = useMemo(() => {
    if (selectedHotelId) {
      const found = filteredHotels.find((h) => h.id === selectedHotelId);
      if (found) return found;
    }
    return filteredHotels[0];
  }, [filteredHotels, selectedHotelId]);

  const handleSelectType = (id: string) => {
    triggerSelectionHaptic();
    setSelectedType(id);
    setSelectedHotelId(undefined);
  };

  const handleSelectHotel = (hotel: Hotel) => {
    triggerSelectionHaptic();
    setSelectedHotelId(hotel.id);
  };

  const handleToggleFav = (hotelId: string) => {
    triggerSelectionHaptic();
    toggleFavoriteLocal(hotelId);
  };

  const handlePressMapPoint = ({
    latitude,
    longitude,
  }: {
    latitude: number;
    longitude: number;
  }) => {
    let nearest: Hotel | null = null;
    let bestDistKm = Number.POSITIVE_INFINITY;

    for (const candidate of allHotels) {
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
  };

  const totalGuests = (occupancy?.adults || 1) + (occupancy?.childrenAges?.length || 0);
  const locationLabel = cityName || destination || "Worldwide";

  return (
    <View style={[styles.root, { backgroundColor: isDark ? "#000000" : palette.background }]}>
      {/* 1. FILTER SEARCH CAPSULE ON TOP + 2. TYPES ROW DIRECTLY UNDER */}
      <View
        style={[
          styles.topHeaderWrap,
          {
            paddingTop: Math.max(insets.top + 6, 12),
            backgroundColor: isDark ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.96)",
            borderBottomColor: isDark ? "#1C1C1E" : "#EBEBEB",
          },
        ]}
      >
        {/* Row 1: Search & Filter Capsule (Airbnb-style floating capsule) */}
        <View style={styles.filterCapsuleContainer}>
          <Pressable
            onPress={handleOpenPicker}
            style={[
              styles.searchCapsule,
              {
                backgroundColor: isDark ? "#18181B" : "#FFFFFF",
                borderColor: isDark ? "#27272A" : "#E5E7EB",
              },
            ]}
          >
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.navigate("/(tabs)");
                }
              }}
              style={[
                styles.backBtn,
                { backgroundColor: isDark ? "#27272A" : "#F3F4F6" },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ArrowLeft size={16} color={palette.text} />
            </Pressable>

            <View style={styles.capsuleMeta}>
              <Text
                style={[styles.capsuleTitle, { color: palette.text }]}
                numberOfLines={1}
              >
                {locationLabel}
              </Text>
              <Text
                style={[styles.capsuleSub, { color: palette.subtext }]}
                numberOfLines={1}
              >
                {formatDateRangeShort(checkIn, checkOut)} · {totalGuests}{" "}
                {totalGuests > 1 ? "guests" : "guest"}
              </Text>
            </View>

            <Pressable
              onPress={handleOpenPicker}
              style={[
                styles.filterBtnCircle,
                {
                  backgroundColor: isDark ? "#27272A" : "#F3F4F6",
                  borderColor: isDark ? "#3F3F46" : "#E5E7EB",
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Filter stays"
            >
              <SlidersHorizontal size={15} color={palette.text} />
            </Pressable>
          </Pressable>
        </View>

        {/* Row 2: Types Horizontal Bar directly under search */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typesRow}
        >
          {STAY_CATEGORIES.map((cat) => {
            const active = selectedType === cat.id;
            const Icon = cat.icon;
            const iconColor = active
              ? isDark
                ? "#FFFFFF"
                : "#171725"
              : isDark
              ? "#71717A"
              : "#717171";

            return (
              <Pressable
                key={cat.id}
                onPress={() => handleSelectType(cat.id)}
                style={[
                  styles.typeTab,
                  active && [
                    styles.typeTabActive,
                    { borderBottomColor: isDark ? "#FFFFFF" : "#171725" },
                  ],
                ]}
                accessibilityRole="button"
                accessibilityLabel={cat.label}
              >
                <Icon size={20} color={iconColor} />
                <Text
                  style={[
                    styles.typeLabel,
                    {
                      color: active
                        ? isDark
                          ? "#FFFFFF"
                          : "#171725"
                        : isDark
                        ? "#71717A"
                        : "#717171",
                      fontWeight: active ? "700" : "500",
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. MAPS IN CENTER */}
      {searchQuery.isLoading && allHotels.length === 0 ? (
        <View style={styles.centerState}>
          <Skeleton height={320} borderRadius={22} />
        </View>
      ) : searchQuery.error && allHotels.length === 0 ? (
        <View style={styles.centerState}>
          <ErrorState
            error={searchQuery.error}
            onRetry={() => searchQuery.refetch()}
          />
        </View>
      ) : filteredHotels.length === 0 ? (
        <View style={styles.centerState}>
          <EmptyState
            title="No places in this category"
            description="Select another stay type or expand your search."
            actionLabel="View All Stays"
            onAction={() => setSelectedType("all")}
          />
        </View>
      ) : (
        <>
          <InteractiveHotelMap
            hotels={filteredHotels}
            selectedHotelId={activeHotel?.id}
            onSelectHotel={handleSelectHotel}
            onOpenHotelDetail={() => setShowHalfModal(true)}
            onPressMapPoint={handlePressMapPoint}
            cityName={locationLabel}
            showDefaultBottomCards={false}
          />

          {/* 4. SOLID AIRBNB-STYLE BOTTOM DRAWER WITH PROPERTY PREVIEW CARD */}
          <View
            style={[
              styles.bottomDrawerContainer,
              {
                backgroundColor: isDark ? "#121214" : "#FFFFFF",
                borderTopColor: isDark ? "#27272A" : "#E5E7EB",
                paddingBottom: Math.max(insets.bottom + 4, 12),
              },
            ]}
          >
            {activeHotel ? (
              <Pressable
                onPress={() => setShowHalfModal(true)}
                style={[
                  styles.airbnbCard,
                  {
                    backgroundColor: isDark ? "#18181B" : "#FFFFFF",
                    borderColor: isDark ? "#27272A" : "#E2E8F0",
                  },
                ]}
              >
                {/* Left Thumbnail Image */}
                <View style={styles.cardImageWrap}>
                  <Image
                    source={{
                      uri:
                        activeHotel.images[0]?.url ||
                        "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
                    }}
                    style={styles.cardImage}
                    contentFit="cover"
                    transition={150}
                  />
                  {/* Subtle Close '✕' Circle */}
                  <Pressable
                    onPress={() => setSelectedHotelId(undefined)}
                    style={styles.cardCloseBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss hotel preview"
                  >
                    <X size={12} color="#FFFFFF" />
                  </Pressable>
                </View>

                {/* Right Hotel Info */}
                <View style={styles.cardInfo}>
                  <View style={styles.cardTitleRow}>
                    <Text
                      style={[styles.cardTitle, { color: palette.text }]}
                      numberOfLines={1}
                    >
                      {activeHotel.name}
                    </Text>
                    <Pressable
                      onPress={() => handleToggleFav(activeHotel.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Save to favorites"
                    >
                      <Heart
                        size={17}
                        color={
                          isFavorite(activeHotel.id)
                            ? palette.primary
                            : palette.subtext
                        }
                        fill={
                          isFavorite(activeHotel.id)
                            ? palette.primary
                            : "transparent"
                        }
                      />
                    </Pressable>
                  </View>

                  <Text
                    style={[styles.cardSubtitle, { color: palette.subtext }]}
                    numberOfLines={1}
                  >
                    Stay in {activeHotel.location.city} ·{" "}
                    {activeHotel.propertyType.toUpperCase()}
                  </Text>

                  <Text
                    style={[styles.cardDesc, { color: palette.subtext }]}
                    numberOfLines={1}
                  >
                    {activeHotel.bedSummary || `A room in ${activeHotel.location.city}`}
                  </Text>

                  <View style={styles.cardBottomRow}>
                    <Text style={[styles.cardPrice, { color: palette.text }]}>
                      {activeHotel.lowestNightlyPrice
                        ? formatMoney(
                            activeHotel.lowestNightlyPrice.amount,
                            activeHotel.lowestNightlyPrice.currency
                          )
                        : "Rate on request"}{" "}
                      <Text
                        style={[styles.cardNight, { color: palette.subtext }]}
                      >
                        night
                      </Text>
                    </Text>

                    <View style={styles.ratingBadge}>
                      <Star
                        size={12}
                        color={palette.ratingGold}
                        fill={palette.ratingGold}
                      />
                      <Text
                        style={[styles.ratingText, { color: palette.text }]}
                      >
                        {activeHotel.reviewScore.toFixed(1)} (
                        {activeHotel.reviewCount})
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ) : null}

            {/* Bottom Drag Handle + Places Count */}
            <Pressable
              onPress={() => {
                if (activeHotel) {
                  setShowHalfModal(true);
                } else if (filteredHotels.length > 0) {
                  setSelectedHotelId(filteredHotels[0].id);
                }
              }}
              style={styles.bottomHandleWrap}
            >
              <View
                style={[
                  styles.dragHandle,
                  { backgroundColor: isDark ? "#3F3F46" : "#DDDDDD" },
                ]}
              />
              <Text
                style={[styles.bottomPlacesText, { color: palette.text }]}
              >
                Over {Math.max(filteredHotels.length, 1000).toLocaleString()} places in{" "}
                {locationLabel}
              </Text>
            </Pressable>
          </View>

          {/* 5. FUNCTIONAL HALF-MODAL FOR SELECTED HOTEL */}
          {activeHotel ? (
            <AppBottomSheet
              visible={showHalfModal}
              title={activeHotel.name}
              subtitle={`${activeHotel.location.city}, ${activeHotel.location.country}`}
              onClose={() => setShowHalfModal(false)}
              snapPoints={[0.58, 0.9]}
              initialSnapIndex={0}
              maxHeightRatio={0.9}
              footer={
                <View style={styles.modalActionRow}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.modalLocationRow}>
                      <MapPin size={13} color={palette.primary} />
                      <Text
                        style={[
                          styles.modalLocationText,
                          { color: palette.subtext },
                        ]}
                        numberOfLines={1}
                      >
                        {activeHotel.location.city},{" "}
                        {activeHotel.location.country}
                      </Text>
                    </View>
                    {activeHotel.lowestNightlyPrice ? (
                      <View style={styles.modalPriceLine}>
                        <Text
                          style={[
                            styles.modalPriceText,
                            { color: palette.primary },
                          ]}
                        >
                          {formatMoney(
                            activeHotel.lowestNightlyPrice.amount,
                            activeHotel.lowestNightlyPrice.currency
                          )}
                        </Text>
                        <Text
                          style={[
                            styles.modalNightText,
                            { color: palette.subtext },
                          ]}
                        >
                          / night
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <PrimaryButton
                    label="Discover More"
                    onPress={() => {
                      setShowHalfModal(false);
                      router.push(`/hotel/${activeHotel.id}`);
                    }}
                  />
                </View>
              }
            >
              <View style={styles.modalInnerBody}>
                {/* Stars and Property Type Badge */}
                <View style={styles.modalStarsRow}>
                  {Array.from({ length: activeHotel.starRating }).map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      color={palette.ratingGold}
                      fill={palette.ratingGold}
                    />
                  ))}
                  <Text style={[styles.modalTypeBadge, { color: palette.primary }]}>
                    {activeHotel.propertyType.toUpperCase()}
                  </Text>
                </View>

                {/* Photo Gallery (10 photos max) */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.modalPhotosScroll}
                >
                  {activeHotel.images.slice(0, 10).map((img) => (
                    <Image
                      key={img.id}
                      source={{ uri: img.url }}
                      style={styles.modalThumbPhoto}
                      contentFit="cover"
                      transition={150}
                    />
                  ))}
                </ScrollView>
              </View>
            </AppBottomSheet>
          ) : null}
          {/* 6. FULL-WIDTH DATES & GUESTS PICKER MODAL INSIDE MAP */}
          <SpringBottomSheet
            visible={pickerOpen}
            title="Dates & Guests"
            onClose={() => setPickerOpen(false)}
            contentStyle={styles.pickerContentStyle}
            footer={
              <PrimaryButton
                label="Apply Dates & Guests"
                onPress={handleApplyPicker}
              />
            }
          >
            <View style={styles.pickerScrollContent}>
              <DateRangePicker
                checkIn={draftCheckIn}
                checkOut={draftCheckOut}
                onChange={(inD, outD) => {
                  setDraftCheckIn(inD);
                  setDraftCheckOut(outD);
                }}
              />

              <GuestCounter
                occupancy={draftOccupancy}
                onChange={setDraftOccupancy}
              />
            </View>
          </SpringBottomSheet>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topHeaderWrap: {
    borderBottomWidth: 1,
    zIndex: 40,
    gap: 8,
  },
  typesRow: {
    paddingHorizontal: 16,
    gap: 20,
    alignItems: "center",
  },
  typeTab: {
    alignItems: "center",
    gap: 4,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  typeTabActive: {
    borderBottomWidth: 2,
  },
  typeLabel: {
    fontSize: 11,
    letterSpacing: -0.2,
  },
  filterCapsuleContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    width: "100%",
  },
  searchCapsule: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 32,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    gap: 10,
    width: "100%",
  },
  pickerContentStyle: {
    paddingHorizontal: 0,
    width: "100%",
  },
  pickerScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
    width: "100%",
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  capsuleMeta: {
    flex: 1,
    gap: 1,
  },
  capsuleTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  capsuleSub: {
    fontSize: 11,
    fontWeight: "500",
  },
  filterBtnCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  bottomDrawerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    gap: 8,
  },
  airbnbCard: {
    flexDirection: "row",
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
    gap: 12,
    alignItems: "center",
  },
  cardImageWrap: {
    position: "relative",
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardCloseBtn: {
    position: "absolute",
    top: 5,
    left: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: "500",
  },
  cardDesc: {
    fontSize: 11,
    fontWeight: "400",
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 3,
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: "700",
  },
  cardNight: {
    fontSize: 11,
    fontWeight: "400",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  bottomHandleWrap: {
    alignItems: "center",
    gap: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  bottomPlacesText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modalInnerBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  modalStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  modalTypeBadge: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  modalPhotosScroll: {
    gap: 8,
    paddingRight: 8,
  },
  modalThumbPhoto: {
    width: 140,
    height: 94,
    borderRadius: 12,
  },
  modalActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  modalLocationText: {
    fontSize: 12,
    fontWeight: "500",
  },
  modalPriceLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  modalPriceText: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalNightText: {
    fontSize: 11,
    fontWeight: "500",
  },
});

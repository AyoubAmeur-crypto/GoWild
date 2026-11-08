import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Map as MapIcon,
  Calendar,
  Users,
  MapPin,
  X,
} from "lucide-react-native";
import type { HotelSortBy } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSearchStore } from "../../../stores/useSearchStore";
import { formatDateRangeShort } from "../../../lib/pricing";
import { SearchBar } from "../../../components/ui/SearchBar";
import { Skeleton } from "../../../components/ui/Skeleton";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { SpringBottomSheet } from "../../../components/ui/SpringBottomSheet";
import { useHotelSearch, usePlaceAutocomplete } from "../hooks/useHotels";
import { HotelCard } from "../components/HotelCard";
import { FilterSheet } from "../components/FilterSheet";
import { DateRangePicker } from "../../availability/components/DateRangePicker";
import { GuestCounter } from "../../availability/components/GuestCounter";

const SORT_OPTIONS: { value: HotelSortBy; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Lowest Price" },
  { value: "rating_desc", label: "Highest Rated" },
  { value: "price_desc", label: "Luxury First" },
];

export const SearchResultsScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();

  const destination = useSearchStore((s) => s.destination);
  const checkIn = useSearchStore((s) => s.checkIn);
  const checkOut = useSearchStore((s) => s.checkOut);
  const occupancy = useSearchStore((s) => s.occupancy);
  const sortBy = useSearchStore((s) => s.sortBy);
  const filters = useSearchStore((s) => s.filters);

  const setDestinationText = useSearchStore((s) => s.setDestinationText);
  const selectPlace = useSearchStore((s) => s.selectPlace);
  const setDates = useSearchStore((s) => s.setDates);
  const setOccupancy = useSearchStore((s) => s.setOccupancy);
  const setSortBy = useSearchStore((s) => s.setSortBy);
  const setFilters = useSearchStore((s) => s.setFilters);
  const resetFilters = useSearchStore((s) => s.resetFilters);
  const recordRecentSearch = useSearchStore((s) => s.recordRecentSearch);

  const [filterOpen, setFilterOpen] = useState(false);
  const [datesModalOpen, setDatesModalOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.propertyTypes.length > 0) count += 1;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined)
      count += 1;
    if (filters.minStarRating !== undefined) count += 1;
    if (filters.freeCancellationOnly) count += 1;
    if (filters.instantConfirmationOnly) count += 1;
    count += filters.amenities.length;
    return count;
  }, [filters]);

  const placesQuery = usePlaceAutocomplete(
    showSuggestions ? destination : ""
  );
  const searchQuery = useHotelSearch();

  const suggestions = placesQuery.data?.places ?? [];
  const hotels = searchQuery.data?.hotels ?? [];

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      {/* Sticky Search Header */}
      <View
        style={[
          styles.topHeader,
          {
            paddingTop: Math.max(insets.top + 8, 18),
            backgroundColor: palette.background,
            borderBottomColor: palette.border,
          },
        ]}
      >
        <View style={styles.navBar}>
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.circleBtn,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={19} color={palette.text} />
          </Pressable>

          <Text style={[styles.headerTitle, { color: palette.text }]}>
            Find Your Stay
          </Text>

          <Pressable
            onPress={() => router.navigate("/map")}
            style={[
              styles.mapSwitchBtn,
              { backgroundColor: palette.primaryTint },
            ]}
            accessibilityRole="button"
            accessibilityLabel="View search results on map"
          >
            <MapIcon size={15} color={palette.primary} />
            <Text style={[styles.mapSwitchText, { color: palette.primary }]}>
              Map
            </Text>
          </Pressable>
        </View>

        <SearchBar
          value={destination}
          onChangeText={(txt) => {
            setDestinationText(txt);
            setShowSuggestions(txt.trim().length > 0);
          }}
          onFilterPress={() => setFilterOpen(true)}
          activeFilterCount={activeFilterCount}
        />

        {/* Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 ? (
          <View
            style={[
              styles.autocompleteBox,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            {suggestions.slice(0, 5).map((place) => (
              <Pressable
                key={place.placeId}
                onPress={() => {
                  selectPlace(place);
                  setShowSuggestions(false);
                  recordRecentSearch();
                }}
                style={[
                  styles.suggestionRow,
                  { borderBottomColor: palette.border },
                ]}
              >
                <MapPin size={15} color={palette.primary} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.suggestionTitle, { color: palette.text }]}
                  >
                    {place.title}
                  </Text>
                  <Text
                    style={[
                      styles.suggestionSubtitle,
                      { color: palette.subtext },
                    ]}
                  >
                    {place.subtitle}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Dates & Occupancy Trigger Bar */}
        <Pressable
          onPress={() => {
            setShowSuggestions(false);
            setDatesModalOpen(true);
          }}
          style={[
            styles.occupancyBar,
            {
              backgroundColor: palette.surfaceMuted,
              borderColor: palette.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Edit dates, rooms, and travelers"
        >
          <View style={styles.occItem}>
            <Calendar size={14} color={palette.primary} />
            <Text style={[styles.occText, { color: palette.text }]}>
              {formatDateRangeShort(checkIn, checkOut)}
            </Text>
          </View>
          <View
            style={[styles.vertDivider, { backgroundColor: palette.border }]}
          />
          <View style={styles.occItem}>
            <Users size={14} color={palette.primary} />
            <Text style={[styles.occText, { color: palette.text }]}>
              {occupancy.rooms} rm · {occupancy.adults} ad
              {occupancy.childrenAges.length > 0
                ? `, ${occupancy.childrenAges.length} ch`
                : ""}
            </Text>
          </View>
          <Text style={[styles.changeLabel, { color: palette.primary }]}>
            Edit
          </Text>
        </Pressable>

        {/* Sort Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortScroll}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setSortBy(opt.value)}
                style={[
                  styles.sortPill,
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
                    styles.sortPillText,
                    { color: active ? "#FFFFFF" : palette.subtext },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Results List */}
      <ScrollView
        contentContainerStyle={[
          styles.resultsContent,
          { paddingBottom: Math.max(insets.bottom + 24, 36) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {searchQuery.isLoading ? (
          <View style={styles.listGap}>
            <Skeleton height={260} borderRadius={18} />
            <Skeleton height={260} borderRadius={18} />
          </View>
        ) : searchQuery.error ? (
          <ErrorState
            error={searchQuery.error}
            onRetry={() => searchQuery.refetch()}
          />
        ) : hotels.length === 0 ? (
          <EmptyState
            title="No matching hotels found"
            description="Adjust your destination, dates, or active filters to see available properties."
            actionLabel="Reset All Filters"
            onAction={() => {
              resetFilters();
              setDestinationText("");
            }}
          />
        ) : (
          <View style={styles.listGap}>
            <Text style={[styles.countHeader, { color: palette.subtext }]}>
              Showing {hotels.length}{" "}
              {hotels.length === 1 ? "property" : "properties"}
              {destination ? ` for "${destination}"` : " worldwide"}
            </Text>

            {hotels.map((hotel) => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                variant="search"
                onPress={() => {
                  recordRecentSearch();
                  router.push(`/hotel/${hotel.id}`);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <FilterSheet
        visible={filterOpen}
        initialFilters={filters}
        onClose={() => setFilterOpen(false)}
        onApply={setFilters}
      />

      {/* Dates & Guests Smooth Spring Bottom Sheet */}
      <SpringBottomSheet
        visible={datesModalOpen}
        title="Dates & Travelers"
        onClose={() => setDatesModalOpen(false)}
        footer={
          <PrimaryButton
            label="Apply Dates & Guests"
            onPress={() => {
              recordRecentSearch();
              setDatesModalOpen(false);
            }}
          />
        }
      >
        <ScrollView
          contentContainerStyle={styles.modalScroll}
          showsVerticalScrollIndicator={false}
        >
          <DateRangePicker
            checkIn={checkIn}
            checkOut={checkOut}
            onChange={setDates}
          />
          <GuestCounter occupancy={occupancy} onChange={setOccupancy} />
        </ScrollView>
      </SpringBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  circleBtnSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  mapSwitchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  mapSwitchText: {
    fontSize: 13,
    fontWeight: "700",
  },
  autocompleteBox: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  suggestionSubtitle: {
    fontSize: 12,
  },
  occupancyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  occItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  occText: {
    fontSize: 12,
    fontWeight: "600",
  },
  vertDivider: {
    width: 1,
    height: 16,
  },
  changeLabel: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: "700",
  },
  sortScroll: {
    gap: 8,
  },
  sortPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  resultsContent: {
    padding: 20,
    gap: 14,
  },
  listGap: {
    gap: 16,
  },
  countHeader: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(23,23,37,0.52)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalScroll: {
    paddingHorizontal: 20,
    gap: 16,
    paddingBottom: 16,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});


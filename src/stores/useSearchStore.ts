import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  HotelSortBy,
  Occupancy,
  PlaceSuggestion,
  PropertyType,
} from "../types/domain";
import { getDefaultDates } from "../lib/pricing";

export interface SearchFilterState {
  minPrice?: number;
  maxPrice?: number;
  minStarRating?: number;
  propertyTypes: PropertyType[];
  amenities: string[];
  freeCancellationOnly: boolean;
  instantConfirmationOnly: boolean;
}

export interface RecentSearchItem {
  id: string;
  label: string;
  cityName?: string;
  countryCode?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  rooms: number;
}

interface SearchState {
  destination: string;
  placeId?: string;
  cityName?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  checkIn: string;
  checkOut: string;
  occupancy: Occupancy;
  sortBy: HotelSortBy;
  filters: SearchFilterState;
  recentSearches: RecentSearchItem[];
  setDestinationText: (text: string) => void;
  selectPlace: (place: PlaceSuggestion) => void;
  clearPlace: () => void;
  setDates: (checkIn: string, checkOut: string) => void;
  setOccupancy: (occupancy: Occupancy) => void;
  setSortBy: (sortBy: HotelSortBy) => void;
  setFilters: (filters: SearchFilterState) => void;
  resetFilters: () => void;
  recordRecentSearch: () => void;
  applyRecentSearch: (item: RecentSearchItem) => void;
  clearRecentSearches: () => void;
}

const DEFAULT_FILTERS: SearchFilterState = {
  propertyTypes: [],
  amenities: [],
  freeCancellationOnly: false,
  instantConfirmationOnly: false,
};

const initialDates = getDefaultDates();

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      destination: "",
      placeId: undefined,
      cityName: undefined,
      countryCode: undefined,
      latitude: undefined,
      longitude: undefined,
      checkIn: initialDates.checkIn,
      checkOut: initialDates.checkOut,
      occupancy: {
        rooms: 1,
        adults: 2,
        childrenAges: [],
      },
      sortBy: "recommended",
      filters: DEFAULT_FILTERS,
      recentSearches: [],

      setDestinationText: (destination) =>
        set({
          destination,
          placeId: undefined,
          cityName: undefined,
          countryCode: undefined,
          latitude: undefined,
          longitude: undefined,
        }),

      selectPlace: (place) =>
        set({
          destination: `${place.cityName}, ${place.country}`,
          placeId: place.placeId,
          cityName: place.cityName,
          countryCode: place.countryCode,
          latitude: place.latitude,
          longitude: place.longitude,
        }),

      clearPlace: () =>
        set({
          destination: "",
          placeId: undefined,
          cityName: undefined,
          countryCode: undefined,
          latitude: undefined,
          longitude: undefined,
        }),

      setDates: (checkIn, checkOut) => set({ checkIn, checkOut }),

      setOccupancy: (occupancy) => set({ occupancy }),

      setSortBy: (sortBy) => set({ sortBy }),

      setFilters: (filters) => set({ filters }),

      resetFilters: () => set({ filters: DEFAULT_FILTERS }),

      recordRecentSearch: () => {
        const s = get();
        const label = s.destination.trim() || s.cityName || "Worldwide Stays";
        const entry: RecentSearchItem = {
          id: `${label.toLowerCase()}_${s.checkIn}_${s.checkOut}`,
          label,
          cityName: s.cityName,
          countryCode: s.countryCode,
          placeId: s.placeId,
          latitude: s.latitude,
          longitude: s.longitude,
          checkIn: s.checkIn,
          checkOut: s.checkOut,
          adults: s.occupancy.adults,
          rooms: s.occupancy.rooms,
        };
        const deduped = [
          entry,
          ...s.recentSearches.filter((r) => r.label !== entry.label),
        ].slice(0, 6);
        set({ recentSearches: deduped });
      },

      applyRecentSearch: (item) =>
        set((state) => ({
          destination: item.label === "Worldwide Stays" ? "" : item.label,
          cityName: item.cityName,
          countryCode: item.countryCode,
          placeId: item.placeId,
          latitude: item.latitude,
          longitude: item.longitude,
          checkIn: item.checkIn,
          checkOut: item.checkOut,
          occupancy: {
            ...state.occupancy,
            adults: item.adults,
            rooms: item.rooms,
          },
        })),

      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: "gowild-search-v2",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);


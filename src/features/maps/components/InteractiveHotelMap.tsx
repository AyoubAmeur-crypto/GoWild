import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { Crosshair } from "lucide-react-native";
import type { Hotel } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { formatMoney } from "../../../lib/pricing";
import { triggerSelectionHaptic } from "../../../lib/haptics";
import { HotelCard } from "../../hotels/components/HotelCard";

export interface InteractiveHotelMapProps {
  hotels: Hotel[];
  selectedHotelId?: string;
  onSelectHotel: (hotel: Hotel) => void;
  onOpenHotelDetail: (hotel: Hotel) => void;
  onPressMapPoint?: (coords: { latitude: number; longitude: number }) => void;
  cityName?: string;
  showDefaultBottomCards?: boolean;
}

// Clean Airbnb / Mapbox Streets vector style matching reference image
const MAPBOX_LIGHT_STYLE = [
  { featureType: "all", elementType: "geometry.fill", stylers: [{ weight: "2.0" }] },
  { featureType: "all", elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 3 }] },
  { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#484848" }] },
  { featureType: "landscape", elementType: "all", stylers: [{ color: "#FAF8F5" }] },
  { featureType: "landscape.man_made", elementType: "geometry.fill", stylers: [{ color: "#F5F3EF" }] },
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#D7EED6" }, { visibility: "on" }] },
  { featureType: "road", elementType: "all", stylers: [{ saturation: -100 }, { lightness: 45 }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#E8E6E1" }] },
  { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#E0DDD7" }] },
  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#C4E0FA" }, { visibility: "on" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#5488AC" }] },
];

// High-contrast, beautifully visible dark map style (water, roads, landmarks clearly visible)
const MAPBOX_DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#16181F" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#E2E8F0" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0F1117" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#3B4252" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#F1F5F9" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1A1D26" }] },
  { featureType: "landscape.man_made", elementType: "geometry.fill", stylers: [{ color: "#1E222D" }] },
  { featureType: "landscape.natural", elementType: "geometry.fill", stylers: [{ color: "#16181F" }] },
  // Distinct rich navy blue water (Seine, ocean, lakes are clearly visible)
  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#1B3A60" }, { visibility: "on" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#93C5FD" }] },
  // Roads: local streets clearly distinguished from background
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2B303C" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1E222A" }, { weight: 1 }] },
  { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#3B4254" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#CBD5E1" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#4E5870" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#2E3444" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#14261C" }] },
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
];

export function InteractiveHotelMap({
  hotels,
  selectedHotelId,
  onSelectHotel,
  onOpenHotelDetail,
  onPressMapPoint,
  cityName,
  showDefaultBottomCards = true,
}: InteractiveHotelMapProps) {
  const map = useRef<MapView>(null);
  const cards = useRef<FlatList<Hotel>>(null);
  const { palette, isDark } = useAppTheme();
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [generation, setGeneration] = useState(0);

  const validHotels = useMemo(
    () =>
      hotels.filter(
        ({ location }) =>
          Number.isFinite(location.latitude) &&
          Number.isFinite(location.longitude) &&
          Math.abs(location.latitude) <= 90 &&
          Math.abs(location.longitude) <= 180
      ),
    [hotels]
  );

  const active =
    validHotels.find((hotel) => hotel.id === selectedHotelId) ?? validHotels[0];

  const initialRegion: Region = {
    latitude: active?.location.latitude ?? 48.8566,
    longitude: active?.location.longitude ?? 2.3522,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
  };

  const fit = useCallback(() => {
    if (!validHotels.length) return;
    map.current?.fitToCoordinates(
      validHotels.map((hotel) => hotel.location),
      {
        edgePadding: { top: 160, right: 60, bottom: 250, left: 60 },
        animated: !reducedMotion,
      }
    );
  }, [validHotels, reducedMotion]);

  useEffect(() => {
    if (ready) fit();
  }, [fit, ready]);

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setTimedOut(true), 15000);
    return () => clearTimeout(timer);
  }, [ready, generation]);

  const select = (hotel: Hotel, index: number) => {
    triggerSelectionHaptic();
    onSelectHotel(hotel);
    cards.current?.scrollToIndex({
      index,
      animated: !reducedMotion,
      viewPosition: 0.5,
    });
    map.current?.animateToRegion(
      {
        latitude: hotel.location.latitude,
        longitude: hotel.location.longitude,
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      },
      reducedMotion ? 0 : 350
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.surfaceMuted }]}>
      <MapView
        key={generation}
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        customMapStyle={isDark ? MAPBOX_DARK_STYLE : MAPBOX_LIGHT_STYLE}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        userInterfaceStyle={isDark ? "dark" : "light"}
        onMapReady={() => {
          setTimedOut(false);
          setReady(true);
        }}
        onPress={(event) => {
          if (event.nativeEvent.action !== "marker-press") {
            onPressMapPoint?.(event.nativeEvent.coordinate);
          }
        }}
        toolbarEnabled={false}
        showsCompass
        rotateEnabled={false}
      >
        {/* Airbnb-style Pill Price & Point Dot Markers */}
        {validHotels.map((hotel, index) => {
          const isSelected = hotel.id === active?.id;
          const hasPrice = Boolean(hotel.lowestNightlyPrice);
          const priceText = hotel.lowestNightlyPrice
            ? formatMoney(
                hotel.lowestNightlyPrice.amount,
                hotel.lowestNightlyPrice.currency,
                { compact: true }
              )
            : null;

          // In Airbnb: Selected hotel always shows black pill; top/primary hotels show price pills;
          // non-priced or surrounding hotels show sleek white point dots (never "View" text!)
          const isPoint = !isSelected && (!hasPrice || index % 3 === 2);

          return (
            <Marker
              key={`${hotel.id}-${isSelected}`}
              coordinate={hotel.location}
              tracksViewChanges={false}
              onPress={() => select(hotel, index)}
              zIndex={isSelected ? 99 : 1}
            >
              {isPoint ? (
                /* Sleek Airbnb Point Dot (White oval capsule with shadow matching reference image) */
                <View
                  style={[
                    styles.pointDot,
                    {
                      backgroundColor: "#FFFFFF",
                      borderColor: isDark ? "#4B5563" : "#B0B0B0",
                    },
                  ]}
                />
              ) : (
                /* Airbnb Pill Price Marker */
                <View
                  style={[
                    styles.pricePill,
                    isSelected
                      ? [
                          styles.pricePillSelected,
                          {
                            backgroundColor: isDark ? "#FFFFFF" : "#171725",
                            borderColor: isDark ? "#E2E8F0" : "#171725",
                          },
                        ]
                      : [
                          styles.pricePillDefault,
                          {
                            backgroundColor: isDark ? "#1E222D" : "#FFFFFF",
                            borderColor: isDark ? "#2E3444" : "#E5E7EB",
                          },
                        ],
                  ]}
                >
                  <Text
                    style={[
                      styles.pricePillText,
                      {
                        color: isSelected
                          ? isDark
                            ? "#171725"
                            : "#FFFFFF"
                          : isDark
                          ? "#F1F5F9"
                          : "#171725",
                      },
                    ]}
                  >
                    {priceText || (hotel.starRating ? `★ ${hotel.starRating}` : "•")}
                  </Text>
                </View>
              )}
            </Marker>
          );
        })}
      </MapView>

      {!ready ? (
        <View style={[styles.loading, { backgroundColor: palette.surface }]}>
          {timedOut ? (
            <>
              <Text style={{ color: palette.text }}>
                Map could not load. Check your connection.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setTimedOut(false);
                  setGeneration((value) => value + 1);
                }}
                style={styles.retry}
              >
                <Text style={{ color: palette.primary }}>Retry map</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator color={palette.primary} />
              <Text style={{ color: palette.text }}>Loading map…</Text>
            </>
          )}
        </View>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fit all hotels on map"
          onPress={fit}
          style={[styles.control, { backgroundColor: palette.surface }]}
        >
          <Crosshair color={palette.text} size={20} />
        </Pressable>
      </View>

      {/* Floating Property Cards Carousel + Bottom Location Pill */}
      {showDefaultBottomCards ? (
        <View style={styles.bottomSection}>
          <FlatList
            ref={cards}
            data={validHotels}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(hotel) => hotel.id}
            contentContainerStyle={styles.cards}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={3}
            getItemLayout={(_, index) => ({
              length: 316,
              offset: 316 * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / 316);
              const hotel = validHotels[index];
              if (hotel) select(hotel, index);
            }}
            renderItem={({ item }) => (
              <HotelCard
                hotel={item}
                variant="map"
                selected={item.id === active?.id}
                onPress={() => onOpenHotelDetail(item)}
              />
            )}
          />

          {/* Airbnb-style Bottom Bar Handle */}
          <View style={styles.bottomBarWrap}>
            <View
              style={[
                styles.dragPill,
                { backgroundColor: isDark ? "#33333E" : "#D0D5DD" },
              ]}
            />
            <Text style={[styles.bottomBarText, { color: palette.text }]}>
              Over {Math.max(validHotels.length, 100)} places in{" "}
              {cityName || active?.location.city || "this area"}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    position: "absolute",
    top: 150,
    left: 20,
    right: 80,
    padding: 16,
    borderRadius: 14,
    gap: 8,
  },
  retry: {
    minHeight: 44,
    justifyContent: "center",
  },
  controls: {
    position: "absolute",
    right: 16,
    top: 150,
    gap: 12,
  },
  control: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pricePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  pricePillDefault: {
    transform: [{ scale: 1 }],
  },
  pricePillSelected: {
    transform: [{ scale: 1.15 }],
  },
  pricePillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  pointDot: {
    width: 17,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2.5,
    elevation: 3,
  },
  bottomSection: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    gap: 10,
  },
  cards: {
    paddingHorizontal: 16,
    gap: 12,
  },
  bottomBarWrap: {
    alignItems: "center",
    gap: 4,
    paddingTop: 2,
  },
  dragPill: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  bottomBarText: {
    fontSize: 13,
    fontWeight: "700",
  },
});

import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type * as Leaflet from "leaflet";
import "./leaflet.web.css";
import type { InteractiveHotelMapProps } from "./InteractiveHotelMap";
import type { Hotel } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { HotelCard } from "../../hotels/components/HotelCard";

export function InteractiveHotelMap(props: InteractiveHotelMapProps) {
  const { palette } = useAppTheme();
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const markers = useRef<Leaflet.LayerGroup | null>(null);
  const cards = useRef<FlatList<Hotel>>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let instance: Leaflet.Map | undefined;
    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      instance = L.map(container.current, { zoomControl: false, attributionControl: true }).setView([31.63, -7.98], 11);
      map.current = instance;
      markers.current = L.layerGroup().addTo(instance);
      L.control.zoom({ position: "topright" }).addTo(instance);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19, updateWhenIdle: true, keepBuffer: 2,
      }).on("load", () => { if (!disposed) setError(false); })
        .on("tileerror", () => { if (!disposed) setError(true); }).addTo(instance);
      instance.on("click", (event: Leaflet.LeafletMouseEvent) => latest.current.onPressMapPoint?.({ latitude: event.latlng.lat, longitude: event.latlng.lng }));
      observer = new ResizeObserver(() => instance?.invalidateSize());
      observer.observe(container.current);
      setReady(true);
    }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; observer?.disconnect(); instance?.remove(); map.current = null; markers.current = null; };
  }, [generation]);

  useEffect(() => {
    if (!ready || !map.current || !markers.current) return;
    let disposed = false;
    void import("leaflet").then((L) => {
      const layer = markers.current;
      const instance = map.current;
      if (disposed || !layer || !instance) return;
      layer.clearLayers();
      const hotels = props.hotels.filter(({ location }) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude));
      for (const [index, hotel] of hotels.entries()) {
        const selected = hotel.id === props.selectedHotelId;
        const marker = L.circleMarker([hotel.location.latitude, hotel.location.longitude], {
          radius: selected ? 13 : 9, color: "#FFFFFF", weight: 3, fillColor: selected ? "#2853AF" : "#40B4F8", fillOpacity: 1,
        }).addTo(layer);
        const tooltip = document.createElement("span");
        tooltip.textContent = hotel.name;
        marker.bindTooltip(tooltip);
        marker.on("click", () => {
          latest.current.onSelectHotel(hotel);
          cards.current?.scrollToIndex({ index, animated: !reducedMotion, viewPosition: 0.5 });
          latest.current.onOpenHotelDetail(hotel);
        });
      }
    }).catch(() => setError(true));
    return () => { disposed = true; };
  }, [props.hotels, props.selectedHotelId, ready, reducedMotion]);

  useEffect(() => {
    if (!ready || !map.current || !props.hotels.length) return;
    const points = props.hotels.map((hotel): Leaflet.LatLngTuple => [hotel.location.latitude, hotel.location.longitude]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (points.length) map.current.fitBounds(points, { paddingTopLeft: [60, 160], paddingBottomRight: [60, 230], maxZoom: 14, animate: !reducedMotion });
  }, [props.hotels, ready, reducedMotion]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.surfaceMuted }}>
      <div ref={container} style={{ position: "absolute", inset: 0, zIndex: 0 }} />
      {!ready && !error ? <ActivityIndicator style={styles.loading} color={palette.primary} /> : null}
      {error ? <View style={[styles.error, { backgroundColor: palette.surface }]}>
        <Text style={{ color: palette.text }}>Map tiles could not load. Check your connection.</Text>
        <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }} onPress={() => { setReady(false); setError(false); setGeneration((value) => value + 1); }}><Text style={{ color: palette.primary }}>Retry map</Text></Pressable>
      </View> : null}
      <View style={styles.carousel}>
        <FlatList ref={cards} data={props.hotels} horizontal showsHorizontalScrollIndicator={false} keyExtractor={(hotel) => hotel.id}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }} getItemLayout={(_, index) => ({ length: 316, offset: index * 316, index })}
          renderItem={({ item }) => <HotelCard hotel={item} variant="map" selected={item.id === props.selectedHotelId} onPress={() => props.onOpenHotelDetail(item)} />}
          onMomentumScrollEnd={(event) => { const hotel = props.hotels[Math.round(event.nativeEvent.contentOffset.x / 316)]; if (hotel) { props.onSelectHotel(hotel); map.current?.setView([hotel.location.latitude, hotel.location.longitude], 14, { animate: !reducedMotion }); } }} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  loading: { position: "absolute", top: 160, left: 24 },
  error: { position: "absolute", top: 160, left: 24, right: 70, borderRadius: 12, padding: 16 },
  carousel: { position: "absolute", bottom: 24, left: 0, right: 0 },
});

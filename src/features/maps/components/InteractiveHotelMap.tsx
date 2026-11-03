import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  Linking,
  Platform,
  LayoutChangeEvent,
  PanResponder,
} from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, Line } from "react-native-svg";
import {
  Plus,
  Minus,
  Crosshair,
  ExternalLink,
  Navigation,
} from "lucide-react-native";
import type { Hotel } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";
import { formatMoney } from "../../../lib/pricing";
import { HotelCard } from "../../hotels/components/HotelCard";

interface InteractiveHotelMapProps {
  hotels: Hotel[];
  selectedHotelId?: string;
  onSelectHotel: (hotel: Hotel) => void;
  onOpenHotelDetail: (hotel: Hotel) => void;
  onPressMapPoint?: (coords: { latitude: number; longitude: number }) => void;
}

const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 16;

function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

function clampLatitude(lat: number): number {
  return Math.max(-85.0511, Math.min(85.0511, lat));
}

function worldSizeForZoom(z: number): number {
  return TILE_SIZE * Math.pow(2, z);
}

function lonToWorldX(lon: number, z: number): number {
  return ((lon + 180) / 360) * worldSizeForZoom(z);
}

function latToWorldY(lat: number, z: number): number {
  const clamped = clampLatitude(lat);
  const rad = (clamped * Math.PI) / 180;
  const merc = Math.log(Math.tan(rad) + 1 / Math.cos(rad));
  return ((1 - merc / Math.PI) / 2) * worldSizeForZoom(z);
}

function worldXToLon(wx: number, z: number): number {
  const ws = worldSizeForZoom(z);
  const wrapped = ((wx % ws) + ws) % ws;
  return (wrapped / ws) * 360 - 180;
}

function worldYToLat(wy: number, z: number): number {
  const ws = worldSizeForZoom(z);
  const clampedY = Math.max(0, Math.min(ws, wy));
  const n = Math.PI - (2 * Math.PI * clampedY) / ws;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function computeFittedView(
  hotels: Hotel[],
  width: number,
  usableHeight: number
): { centerLat: number; centerLng: number; zoom: number } {
  if (hotels.length === 0) {
    return { centerLat: 30.0, centerLng: 10.0, zoom: 2 };
  }
  if (hotels.length === 1) {
    return {
      centerLat: hotels[0].location.latitude,
      centerLng: hotels[0].location.longitude,
      zoom: 14,
    };
  }

  const lats = hotels.map((h) => h.location.latitude);
  const lngs = hotels.map((h) => h.location.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  for (let z = 14; z >= MIN_ZOOM; z -= 1) {
    const dx = Math.abs(lonToWorldX(maxLng, z) - lonToWorldX(minLng, z));
    const dy = Math.abs(latToWorldY(minLat, z) - latToWorldY(maxLat, z));
    if (dx <= width * 0.68 && dy <= usableHeight * 0.62) {
      return { centerLat, centerLng, zoom: z };
    }
  }

  return { centerLat, centerLng, zoom: MIN_ZOOM };
}

interface GestureSession {
  mode: "none" | "pan" | "pinch";
  wasPinch: boolean;
  movedBeyondTap: boolean;
  startPageX: number;
  startPageY: number;
  panAnchorCenter: { lat: number; lng: number };
  panAnchorTouch: { x: number; y: number };
  pinchStartDist: number;
  pinchStartZoom: number;
  pinchStartCenter: { lat: number; lng: number };
  pinchStartMid: { x: number; y: number };
}

export const InteractiveHotelMap: React.FC<InteractiveHotelMapProps> = ({
  hotels,
  selectedHotelId,
  onSelectHotel,
  onOpenHotelDetail,
  onPressMapPoint,
}) => {
  const { palette, isDark } = useAppTheme();
  const containerRef = useRef<React.ComponentRef<typeof View>>(null);
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const listRef = useRef<FlatList<Hotel>>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 390, height: 680 });

  const usableHeight = Math.max(220, canvasSize.height - 210);

  const fitted = useMemo(
    () => computeFittedView(hotels, canvasSize.width, usableHeight),
    [hotels, canvasSize.width, usableHeight]
  );

  // Continuous floating-point zoom supports silky two-finger pinch-to-zoom
  const [zoom, setZoom] = useState<number>(fitted.zoom);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: fitted.centerLat,
    lng: fitted.centerLng,
  });

  const hotelsSignature = useMemo(
    () => hotels.map((h) => h.id).join(","),
    [hotels]
  );

  useEffect(() => {
    const nextFit = computeFittedView(hotels, canvasSize.width, usableHeight);
    setCenter({ lat: nextFit.centerLat, lng: nextFit.centerLng });
    setZoom(nextFit.zoom);
  }, [hotelsSignature, canvasSize.width, usableHeight, hotels]);

  const activeId = selectedHotelId ?? hotels[0]?.id;
  const activeHotel = useMemo(
    () => hotels.find((h) => h.id === activeId) ?? hotels[0],
    [hotels, activeId]
  );

  const visualCenterY = Math.max(150, (canvasSize.height - 96) * 0.44);
  const centerWorldX = lonToWorldX(center.lng, zoom);
  const centerWorldY = latToWorldY(center.lat, zoom);
  const topLeftWorldX = centerWorldX - canvasSize.width / 2;
  const topLeftWorldY = centerWorldY - visualCenterY;

  // Discrete tile zoom level + continuous fractional scale factor for seamless pinching
  const tileZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(zoom)));
  const tileScale = Math.pow(2, zoom - tileZoom);
  const scaledTileSize = TILE_SIZE * tileScale;

  const visibleTiles = useMemo(() => {
    const numTiles = Math.pow(2, tileZoom);
    const minTx = Math.floor(topLeftWorldX / scaledTileSize);
    const maxTx = Math.floor(
      (topLeftWorldX + canvasSize.width) / scaledTileSize
    );
    const minTy = Math.max(0, Math.floor(topLeftWorldY / scaledTileSize));
    const maxTy = Math.min(
      numTiles - 1,
      Math.floor((topLeftWorldY + canvasSize.height) / scaledTileSize)
    );

    const tiles: {
      key: string;
      url: string;
      left: number;
      top: number;
      size: number;
    }[] = [];

    const pixelSize = Math.ceil(scaledTileSize) + 1;

    for (let tx = minTx; tx <= maxTx; tx += 1) {
      const wrappedTx = ((tx % numTiles) + numTiles) % numTiles;
      for (let ty = minTy; ty <= maxTy; ty += 1) {
        tiles.push({
          key: `${tileZoom}_${tx}_${ty}`,
          url: `https://tile.openstreetmap.org/${tileZoom}/${wrappedTx}/${ty}.png`,
          left: tx * scaledTileSize - topLeftWorldX,
          top: ty * scaledTileSize - topLeftWorldY,
          size: pixelSize,
        });
      }
    }
    return tiles;
  }, [
    tileZoom,
    scaledTileSize,
    topLeftWorldX,
    topLeftWorldY,
    canvasSize.width,
    canvasSize.height,
  ]);

  const projectedMarkers = useMemo(() => {
    return hotels.map((hotel, idx) => {
      const wx = lonToWorldX(hotel.location.longitude, zoom);
      const wy = latToWorldY(hotel.location.latitude, zoom);
      return {
        hotel,
        index: idx,
        x: wx - topLeftWorldX,
        y: wy - topLeftWorldY,
      };
    });
  }, [hotels, zoom, topLeftWorldX, topLeftWorldY]);

  // Keep latest state & callbacks in a ref for PanResponder
  const liveRef = useRef({
    center,
    zoom,
    topLeftWorldX,
    topLeftWorldY,
    projectedMarkers,
    onOpenHotelDetail,
    onPressMapPoint,
  });
  liveRef.current = {
    center,
    zoom,
    topLeftWorldX,
    topLeftWorldY,
    projectedMarkers,
    onOpenHotelDetail,
    onPressMapPoint,
  };

  const sessionRef = useRef<GestureSession>({
    mode: "none",
    wasPinch: false,
    movedBeyondTap: false,
    startPageX: 0,
    startPageY: 0,
    panAnchorCenter: { lat: fitted.centerLat, lng: fitted.centerLng },
    panAnchorTouch: { x: 0, y: 0 },
    pinchStartDist: 100,
    pinchStartZoom: fitted.zoom,
    pinchStartCenter: { lat: fitted.centerLat, lng: fitted.centerLng },
    pinchStartMid: { x: 0, y: 0 },
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (evt) =>
          evt.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponderCapture: (evt, gesture) =>
          evt.nativeEvent.touches.length >= 2 ||
          Math.hypot(gesture.dx, gesture.dy) > 8,
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          containerRef.current?.measureInWindow((wx, wy) => {
            originRef.current = { x: wx, y: wy };
          });

          const touches = evt.nativeEvent.touches;
          const { center: curCenter, zoom: curZoom } = liveRef.current;

          if (touches.length >= 2) {
            const t0 = touches[0];
            const t1 = touches[1];
            const dist = Math.max(
              24,
              Math.hypot(t1.pageX - t0.pageX, t1.pageY - t0.pageY)
            );
            const midX = (t0.pageX + t1.pageX) / 2;
            const midY = (t0.pageY + t1.pageY) / 2;

            sessionRef.current = {
              mode: "pinch",
              wasPinch: true,
              movedBeyondTap: true,
              startPageX: midX,
              startPageY: midY,
              panAnchorCenter: { ...curCenter },
              panAnchorTouch: { x: midX, y: midY },
              pinchStartDist: dist,
              pinchStartZoom: curZoom,
              pinchStartCenter: { ...curCenter },
              pinchStartMid: { x: midX, y: midY },
            };
          } else {
            const t0 = touches[0] ?? evt.nativeEvent;
            sessionRef.current = {
              mode: "pan",
              wasPinch: false,
              movedBeyondTap: false,
              startPageX: t0.pageX,
              startPageY: t0.pageY,
              panAnchorCenter: { ...curCenter },
              panAnchorTouch: { x: t0.pageX, y: t0.pageY },
              pinchStartDist: 100,
              pinchStartZoom: curZoom,
              pinchStartCenter: { ...curCenter },
              pinchStartMid: { x: t0.pageX, y: t0.pageY },
            };
          }
        },
        onPanResponderMove: (evt) => {
          const touches = evt.nativeEvent.touches;
          const session = sessionRef.current;
          const { center: curCenter, zoom: curZoom } = liveRef.current;

          if (touches.length >= 2) {
            const t0 = touches[0];
            const t1 = touches[1];
            const dist = Math.max(
              24,
              Math.hypot(t1.pageX - t0.pageX, t1.pageY - t0.pageY)
            );
            const midX = (t0.pageX + t1.pageX) / 2;
            const midY = (t0.pageY + t1.pageY) / 2;

            if (session.mode !== "pinch") {
              session.mode = "pinch";
              session.wasPinch = true;
              session.movedBeyondTap = true;
              session.pinchStartDist = dist;
              session.pinchStartZoom = curZoom;
              session.pinchStartCenter = { ...curCenter };
              session.pinchStartMid = { x: midX, y: midY };
              return;
            }

            const nextZoom = clampZoom(
              session.pinchStartZoom +
                Math.log2(dist / session.pinchStartDist)
            );
            const dMidX = midX - session.pinchStartMid.x;
            const dMidY = midY - session.pinchStartMid.y;

            const nextWx =
              lonToWorldX(session.pinchStartCenter.lng, nextZoom) - dMidX;
            const nextWy =
              latToWorldY(session.pinchStartCenter.lat, nextZoom) - dMidY;

            setZoom(nextZoom);
            setCenter({
              lng: worldXToLon(nextWx, nextZoom),
              lat: worldYToLat(nextWy, nextZoom),
            });
            return;
          }

          if (touches.length === 1) {
            const t0 = touches[0];
            // Smoothly transition from 2-finger pinch back to 1-finger pan without jumping
            if (session.mode === "pinch") {
              session.mode = "pan";
              session.panAnchorCenter = { ...curCenter };
              session.panAnchorTouch = { x: t0.pageX, y: t0.pageY };
              return;
            }

            const totalMove = Math.hypot(
              t0.pageX - session.startPageX,
              t0.pageY - session.startPageY
            );
            if (totalMove > 7) {
              session.movedBeyondTap = true;
            }

            if (session.movedBeyondTap) {
              const dx = t0.pageX - session.panAnchorTouch.x;
              const dy = t0.pageY - session.panAnchorTouch.y;
              const nextWx =
                lonToWorldX(session.panAnchorCenter.lng, curZoom) - dx;
              const nextWy =
                latToWorldY(session.panAnchorCenter.lat, curZoom) - dy;

              setCenter({
                lng: worldXToLon(nextWx, curZoom),
                lat: worldYToLat(nextWy, curZoom),
              });
            }
          }
        },
        onPanResponderRelease: () => {
          const session = sessionRef.current;
          if (!session.wasPinch && !session.movedBeyondTap) {
            const tapX = session.startPageX - originRef.current.x;
            const tapY = session.startPageY - originRef.current.y;
            const {
              zoom: curZoom,
              topLeftWorldX: tlx,
              topLeftWorldY: tly,
              projectedMarkers: markers,
              onOpenHotelDetail: openHotel,
              onPressMapPoint: pressPoint,
            } = liveRef.current;

            // Check if tap landed directly near a hotel pin
            let hitHotel: Hotel | null = null;
            let bestDist = 44;
            for (const m of markers) {
              const d = Math.hypot(m.x - tapX, m.y - tapY);
              if (d < bestDist) {
                bestDist = d;
                hitHotel = m.hotel;
              }
            }

            if (hitHotel) {
              openHotel(hitHotel);
            } else if (pressPoint) {
              const tapLat = worldYToLat(tly + tapY, curZoom);
              const tapLng = worldXToLon(tlx + tapX, curZoom);
              pressPoint({ latitude: tapLat, longitude: tapLng });
            }
          }
          session.mode = "none";
        },
        onPanResponderTerminate: () => {
          sessionRef.current.mode = "none";
        },
      }),
    []
  );

  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasSize({ width, height });
    }
    containerRef.current?.measureInWindow((wx, wy) => {
      originRef.current = { x: wx, y: wy };
    });
  };

  const handleMarkerTap = (hotel: Hotel, index: number) => {
    onSelectHotel(hotel);
    listRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0.5,
    });
    onOpenHotelDetail(hotel);
  };

  const focusSelectedStreetLevel = () => {
    if (!activeHotel) return;
    setCenter({
      lat: activeHotel.location.latitude,
      lng: activeHotel.location.longitude,
    });
    setZoom(15);
  };

  const resetOverview = () => {
    const nextFit = computeFittedView(hotels, canvasSize.width, usableHeight);
    setCenter({ lat: nextFit.centerLat, lng: nextFit.centerLng });
    setZoom(nextFit.zoom);
  };

  const openNativeMapForActive = () => {
    if (!activeHotel) return;
    const { latitude, longitude } = activeHotel.location;
    const label = encodeURIComponent(activeHotel.name);
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?ll=${latitude},${longitude}&q=${label}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    Linking.openURL(url).catch(() => {});
  };

  const mapBg = isDark ? "#131B2B" : "#DFEAF6";
  const gridStroke = isDark ? "rgba(148,163,184,0.14)" : "rgba(40,83,175,0.10)";
  const ringStroke = isDark ? "rgba(64,180,248,0.22)" : "rgba(40,83,175,0.16)";

  return (
    <View
      ref={containerRef}
      style={[styles.root, { backgroundColor: mapBg }]}
      onLayout={onCanvasLayout}
    >
      {/* Interactive Pan + Two-Finger Pinch-to-Zoom + Tap-to-Hotels Viewport */}
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
        <Svg
          pointerEvents="none"
          width={canvasSize.width}
          height={canvasSize.height}
          style={StyleSheet.absoluteFill}
        >
          {[0.2, 0.4, 0.6, 0.8].map((r) => (
            <React.Fragment key={r}>
              <Line
                x1={canvasSize.width * r}
                y1={0}
                x2={canvasSize.width * r}
                y2={canvasSize.height}
                stroke={gridStroke}
                strokeWidth={1}
              />
              <Line
                x1={0}
                y1={canvasSize.height * r}
                x2={canvasSize.width}
                y2={canvasSize.height * r}
                stroke={gridStroke}
                strokeWidth={1}
              />
            </React.Fragment>
          ))}
          <Circle
            cx={canvasSize.width * 0.5}
            cy={visualCenterY}
            r={Math.min(canvasSize.width, canvasSize.height) * 0.24}
            stroke={ringStroke}
            strokeWidth={1.2}
            strokeDasharray="6 6"
            fill="none"
          />
        </Svg>

        {/* Real Slippy Web-Mercator Street Map Tiles (Continuously Scaled on Pinch) */}
        {visibleTiles.map((tile) => (
          <Image
            key={tile.key}
            pointerEvents="none"
            source={{
              uri: tile.url,
              headers: {
                "User-Agent": "goWild-Mobile/1.0 (https://gowild.travel)",
              },
            }}
            style={[
              styles.mapTile,
              {
                left: tile.left,
                top: tile.top,
                width: tile.size,
                height: tile.size,
                opacity: isDark ? 0.82 : 1,
              },
            ]}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ))}

        {isDark ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(15, 23, 42, 0.24)" },
            ]}
          />
        ) : null}

        {/* Hotel Markers — Tapping a Pin Leads Directly to That Hotel */}
        {projectedMarkers.map(({ hotel, index, x, y }) => {
          if (
            x < -80 ||
            x > canvasSize.width + 80 ||
            y < -80 ||
            y > canvasSize.height + 80
          ) {
            return null;
          }
          const isSelected = hotel.id === activeHotel?.id;
          return (
            <Pressable
              key={hotel.id}
              onPress={() => handleMarkerTap(hotel, index)}
              style={[
                styles.markerWrapper,
                {
                  left: x - (isSelected ? 31 : 25),
                  top: y - (isSelected ? 31 : 25),
                  zIndex: isSelected ? 30 : 12,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${hotel.name}`}
            >
              <View
                style={[
                  styles.photoPin,
                  isSelected ? styles.photoPinActive : styles.photoPinIdle,
                  {
                    borderColor: isSelected ? palette.primary : "#FFFFFF",
                  },
                ]}
              >
                <Image
                  source={{ uri: hotel.images[0]?.url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              </View>

              <View
                style={[
                  styles.pinBadge,
                  {
                    backgroundColor: isSelected
                      ? palette.primary
                      : palette.surface,
                    borderColor: isSelected ? palette.primary : palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pinBadgeText,
                    { color: isSelected ? "#FFFFFF" : palette.text },
                  ]}
                >
                  {hotel.lowestNightlyPrice
                    ? formatMoney(
                        hotel.lowestNightlyPrice.amount,
                        hotel.lowestNightlyPrice.currency,
                        { compact: true }
                      )
                    : "View"}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Zoom, Street Focus & Native Maps Controls */}
      <View style={styles.mapControls}>
        <Pressable
          onPress={() => setZoom((z) => clampZoom(Math.round(z) + 1))}
          style={[
            styles.ctrlBtn,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Zoom in map"
        >
          <Plus size={18} color={palette.text} />
        </Pressable>
        <Pressable
          onPress={() => setZoom((z) => clampZoom(Math.round(z) - 1))}
          style={[
            styles.ctrlBtn,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Zoom out map"
        >
          <Minus size={18} color={palette.text} />
        </Pressable>
        <Pressable
          onPress={focusSelectedStreetLevel}
          style={[
            styles.ctrlBtn,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Zoom to selected hotel street"
        >
          <Navigation size={16} color={palette.primary} />
        </Pressable>
        <Pressable
          onPress={resetOverview}
          style={[
            styles.ctrlBtn,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Fit all hotels on map"
        >
          <Crosshair size={17} color={palette.text} />
        </Pressable>
        {activeHotel ? (
          <Pressable
            onPress={openNativeMapForActive}
            style={[
              styles.ctrlBtn,
              { backgroundColor: palette.primary, borderColor: palette.primary },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open selected hotel in device maps"
          >
            <ExternalLink size={16} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>

      {/* Synchronized Bottom Hotel Cards */}
      <View style={styles.carouselWrapper}>
        <FlatList
          ref={listRef}
          data={hotels}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.carouselContent}
          onScrollToIndexFailed={() => {}}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / 316);
            const target = hotels[idx];
            if (target) {
              onSelectHotel(target);
              setCenter({
                lat: target.location.latitude,
                lng: target.location.longitude,
              });
            }
          }}
          renderItem={({ item }) => (
            <HotelCard
              hotel={item}
              variant="map"
              selected={item.id === activeHotel?.id}
              onPress={() => onOpenHotelDetail(item)}
            />
          )}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  mapTile: {
    position: "absolute",
  },
  markerWrapper: {
    position: "absolute",
    alignItems: "center",
  },
  photoPin: {
    overflow: "hidden",
    backgroundColor: "#171725",
    shadowColor: "#171725",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 6,
  },
  photoPinIdle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2.5,
  },
  photoPinActive: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3.5,
  },
  pinBadge: {
    marginTop: -10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pinBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  mapControls: {
    position: "absolute",
    right: 16,
    top: 138,
    gap: 8,
    zIndex: 40,
  },
  ctrlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#171725",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  carouselWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    zIndex: 35,
  },
  carouselContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
});

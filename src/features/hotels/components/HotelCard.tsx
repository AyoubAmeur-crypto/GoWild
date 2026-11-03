import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { MapPin, BedDouble, Bath } from "lucide-react-native";
import type { Hotel } from "../../../types/domain";
import { Shadows } from "../../../theme/tokens";
import { useAppTheme } from "../../../theme/useAppTheme";
import { FavoriteHeartButton } from "../../../components/ui/FavoriteHeartButton";
import { PriceDisplay } from "../../../components/ui/PriceDisplay";

interface HotelCardProps {
  hotel: Hotel;
  variant?: "hero" | "compact" | "search" | "map";
  onPress: () => void;
  selected?: boolean;
}

export const HotelCard: React.FC<HotelCardProps> = ({
  hotel,
  variant = "search",
  onPress,
  selected = false,
}) => {
  const { palette } = useAppTheme();
  const heroUrl = hotel.images[0]?.url;
  const price = hotel.lowestNightlyPrice;
  const compareAt = hotel.compareAtNightlyPrice;

  // 1. Hero Card ("Popular" on Home — pure untouched photo, no overlays, no star/green badges)
  if (variant === "hero") {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.heroCard,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
          Shadows.cardSubtle,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${hotel.name} in ${hotel.location.city}`}
      >
        <Image
          source={{ uri: heroUrl }}
          style={styles.heroImage}
          contentFit="cover"
          transition={200}
        />

        <View style={styles.heroBody}>
          <View style={styles.heroTitleRow}>
            <Text
              style={[styles.heroTitle, { color: palette.text }]}
              numberOfLines={1}
            >
              {hotel.name}
            </Text>
            <FavoriteHeartButton hotelId={hotel.id} />
          </View>

          <View style={styles.locationRow}>
            <MapPin size={12} color={palette.muted} />
            <Text
              style={[styles.locationText, { color: palette.subtext }]}
              numberOfLines={1}
            >
              {hotel.location.city}
            </Text>
          </View>

          <View style={styles.heroPriceRow}>
            {price ? (
              <PriceDisplay
                amount={price.amount}
                currency={price.currency}
                size="sm"
              />
            ) : (
              <Text style={[styles.checkAvail, { color: palette.primary }]}>
                Check dates
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  // 2. Compact Horizontal Row ("Recommended" on Home) or Map Preview Card
  if (variant === "compact" || variant === "map") {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.compactCard,
          variant === "map" && styles.mapCardWidth,
          {
            backgroundColor: palette.surface,
            borderColor: selected ? palette.primary : palette.border,
            borderWidth: selected ? 2 : 1,
          },
          Shadows.cardSubtle,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${hotel.name}, ${hotel.location.city}`}
      >
        <Image
          source={{ uri: heroUrl }}
          style={styles.compactThumb}
          contentFit="cover"
          transition={180}
        />
        <View style={styles.compactBody}>
          <View style={styles.compactHeaderRow}>
            <Text
              style={[styles.compactTitle, { color: palette.text }]}
              numberOfLines={1}
            >
              {hotel.name}
            </Text>
            <FavoriteHeartButton hotelId={hotel.id} />
          </View>

          <View style={styles.locationRow}>
            <MapPin size={13} color={palette.muted} />
            <Text
              style={[styles.locationText, { color: palette.subtext }]}
              numberOfLines={1}
            >
              {hotel.location.city}, {hotel.location.country}
            </Text>
          </View>

          <View style={styles.compactFooter}>
            {price ? (
              <PriceDisplay
                amount={price.amount}
                currency={price.currency}
                compareAtAmount={compareAt?.amount}
                size="sm"
              />
            ) : (
              <Text style={[styles.checkAvail, { color: palette.primary }]}>
                View rates
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  // 3. Full Search Result Card (pure untouched photo, clean metadata below)
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.searchCard,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
        Shadows.cardSubtle,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${hotel.name} in ${hotel.location.city}`}
    >
      <Image
        source={{ uri: heroUrl }}
        style={styles.searchImage}
        contentFit="cover"
        transition={200}
      />

      <View style={styles.searchContent}>
        <View style={styles.searchTitlePriceRow}>
          <View style={styles.searchTitleCol}>
            <Text
              style={[styles.searchTitle, { color: palette.text }]}
              numberOfLines={1}
            >
              {hotel.name}
            </Text>
            <View style={styles.locationRow}>
              <MapPin size={13} color={palette.subtext} />
              <Text
                style={[styles.locationText, { color: palette.subtext }]}
                numberOfLines={1}
              >
                {hotel.location.city}, {hotel.location.country}
              </Text>
            </View>
          </View>

          <View style={styles.searchRightCol}>
            <FavoriteHeartButton hotelId={hotel.id} />
            {price ? (
              <PriceDisplay
                amount={price.amount}
                currency={price.currency}
                compareAtAmount={compareAt?.amount}
                align="right"
              />
            ) : null}
          </View>
        </View>

        <View
          style={[styles.divider, { backgroundColor: palette.border }]}
        />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <BedDouble size={14} color={palette.primary} />
            <Text style={[styles.metaLabel, { color: palette.subtext }]}>
              {hotel.bedSummary ?? "King / Twin"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Bath size={14} color={palette.primary} />
            <Text style={[styles.metaLabel, { color: palette.subtext }]}>
              {hotel.bathSummary ?? "En-suite"}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  // Hero card (Home "Popular")
  heroCard: {
    width: 214,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: 158,
    backgroundColor: "#E9EBED",
  },
  heroBody: {
    padding: 12,
    gap: 5,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  heroTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  heroPriceRow: {
    marginTop: 2,
  },

  // Compact & Map Card
  compactCard: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 10,
    gap: 12,
    alignItems: "center",
  },
  mapCardWidth: {
    width: 304,
  },
  compactThumb: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: "#E9EBED",
  },
  compactBody: {
    flex: 1,
    gap: 5,
  },
  compactHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  compactTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
  },
  compactFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  checkAvail: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Search Card
  searchCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  searchImage: {
    height: 184,
    width: "100%",
    backgroundColor: "#E9EBED",
  },
  searchContent: {
    padding: 14,
    gap: 10,
  },
  searchTitlePriceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  searchTitleCol: {
    flex: 1,
    gap: 4,
  },
  searchRightCol: {
    alignItems: "flex-end",
    gap: 6,
  },
  searchTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    width: "100%",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
});

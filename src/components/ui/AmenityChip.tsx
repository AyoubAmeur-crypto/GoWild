import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import {
  Wifi,
  Waves,
  Sparkles,
  Coffee,
  Dumbbell,
  ConciergeBell,
  Car,
  Wind,
  Utensils,
  Sun,
  ShieldCheck,
  Tv,
  CheckCircle2,
} from "lucide-react-native";
import { useAppTheme } from "../../theme/useAppTheme";

interface AmenityChipProps {
  code: string;
  label: string;
  selected?: boolean;
  onPress?: () => void;
  variant?: "pill" | "tile";
}

function getAmenityIcon(code: string) {
  const c = code.toLowerCase();
  if (c.includes("wifi")) return Wifi;
  if (c.includes("pool") || c.includes("onsen")) return Waves;
  if (c.includes("spa") || c.includes("wellness") || c.includes("hammam"))
    return Sparkles;
  if (c.includes("breakfast") || c.includes("tea") || c.includes("coffee"))
    return Coffee;
  if (c.includes("gym") || c.includes("fitness")) return Dumbbell;
  if (c.includes("concierge") || c.includes("room_service") || c.includes("butler"))
    return ConciergeBell;
  if (c.includes("parking") || c.includes("valet") || c.includes("transfer"))
    return Car;
  if (c.includes("ac") || c.includes("air") || c.includes("terrace")) return Wind;
  if (c.includes("restaurant") || c.includes("dining") || c.includes("bar"))
    return Utensils;
  if (c.includes("beach") || c.includes("rooftop") || c.includes("garden"))
    return Sun;
  if (c.includes("safe")) return ShieldCheck;
  if (c.includes("tv")) return Tv;
  return CheckCircle2;
}

export const AmenityChip: React.FC<AmenityChipProps> = ({
  code,
  label,
  selected = false,
  onPress,
  variant = "pill",
}) => {
  const { palette } = useAppTheme();
  const Icon = getAmenityIcon(code);

  if (variant === "tile") {
    return (
      <View
        style={[
          styles.tile,
          {
            backgroundColor: palette.surfaceMuted,
            borderColor: palette.border,
          },
        ]}
      >
        <View
          style={[
            styles.tileIconCircle,
            { backgroundColor: palette.elevated },
          ]}
        >
          <Icon size={20} color={palette.primary} strokeWidth={1.9} />
        </View>
        <Text
          style={[styles.tileLabel, { color: palette.subtext }]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    );
  }

  const content = (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: selected ? palette.primary : palette.surfaceMuted,
          borderColor: selected ? palette.primary : palette.border,
        },
      ]}
    >
      <Icon
        size={14}
        color={selected ? "#FFFFFF" : palette.primary}
        strokeWidth={2}
      />
      <Text
        style={[
          styles.pillLabel,
          { color: selected ? "#FFFFFF" : palette.text },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
      >
        {content}
      </Pressable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  tile: {
    width: 82,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 7,
  },
  tileIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
});


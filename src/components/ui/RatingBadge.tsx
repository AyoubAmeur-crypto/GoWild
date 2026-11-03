import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Star } from "lucide-react-native";
import { useAppTheme } from "../../theme/useAppTheme";

interface RatingBadgeProps {
  score: number;
  reviewCount?: number;
  variant?: "inline" | "overlay" | "pill";
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({
  score,
  reviewCount,
  variant = "inline",
}) => {
  const { palette } = useAppTheme();

  if (variant === "overlay") {
    return (
      <View style={styles.overlayBadge}>
        <Star size={12} color="#EDB900" fill="#EDB900" />
        <Text style={styles.overlayScore}>{score.toFixed(1)}</Text>
      </View>
    );
  }

  if (variant === "pill") {
    return (
      <View
        style={[
          styles.pillBadge,
          { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
        ]}
      >
        <Star size={13} color={palette.ratingGold} fill={palette.ratingGold} />
        <Text style={[styles.inlineScore, { color: palette.text }]}>
          {score.toFixed(1)}
        </Text>
        {reviewCount !== undefined ? (
          <Text style={[styles.countText, { color: palette.subtext }]}>
            ({reviewCount})
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.inlineRow}>
      <Star size={14} color={palette.ratingGold} fill={palette.ratingGold} />
      <Text style={[styles.inlineScore, { color: palette.text }]}>
        {score.toFixed(1)}
      </Text>
      {reviewCount !== undefined ? (
        <Text style={[styles.countText, { color: palette.subtext }]}>
          ({reviewCount})
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  overlayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(23, 23, 37, 0.72)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  overlayScore: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  inlineScore: {
    fontSize: 13,
    fontWeight: "700",
  },
  countText: {
    fontSize: 12,
    fontWeight: "500",
  },
});


import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { CurrencyCode } from "../../types/domain";
import { formatMoney } from "../../lib/pricing";
import { useAppTheme } from "../../theme/useAppTheme";

interface PriceDisplayProps {
  amount: number;
  currency: CurrencyCode;
  compareAtAmount?: number;
  suffix?: string;
  size?: "sm" | "md" | "lg";
  lightText?: boolean;
  align?: "left" | "right";
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  amount,
  currency,
  compareAtAmount,
  suffix = "/night",
  size = "md",
  lightText = false,
  align = "left",
}) => {
  const { palette } = useAppTheme();

  const fontSize = size === "sm" ? 15 : size === "lg" ? 22 : 17;
  const primaryColor = lightText ? "#FFFFFF" : palette.primary;
  const subColor = lightText ? "rgba(255,255,255,0.78)" : palette.subtext;

  return (
    <View
      style={[
        styles.container,
        align === "right" && { alignItems: "flex-end" },
      ]}
    >
      {compareAtAmount && compareAtAmount > amount ? (
        <Text style={[styles.compareAt, { color: palette.danger }]}>
          {formatMoney(compareAtAmount, currency, { compact: true })}
        </Text>
      ) : null}
      <View style={styles.mainRow}>
        <Text style={[styles.amount, { fontSize, color: primaryColor }]}>
          {formatMoney(amount, currency, { compact: size !== "lg" })}
        </Text>
        {suffix ? (
          <Text style={[styles.suffix, { color: subColor }]}>{suffix}</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
  },
  compareAt: {
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "line-through",
    marginBottom: 1,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  amount: {
    fontWeight: "700",
  },
  suffix: {
    fontSize: 12,
    fontWeight: "500",
  },
});


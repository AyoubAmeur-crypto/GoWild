import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { PriceBreakdown } from "../../../types/domain";
import { formatMoney } from "../../../lib/pricing";
import { useAppTheme } from "../../../theme/useAppTheme";

interface PriceBreakdownCardProps {
  price: PriceBreakdown;
  providerLabel?: string;
}

export const PriceBreakdownCard: React.FC<PriceBreakdownCardProps> = ({
  price,
  providerLabel,
}) => {
  const { palette } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.heading, { color: palette.text }]}>
        Price Details ({price.currency})
      </Text>

      <View style={styles.lines}>
        {price.items.map((item) => (
          <View key={item.label} style={styles.lineRow}>
            <Text style={[styles.lineLabel, { color: palette.subtext }]}>
              {item.label}
            </Text>
            <Text style={[styles.lineVal, { color: palette.text }]}>
              {formatMoney(item.amount, price.currency)}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.divider, { backgroundColor: palette.border }]} />

      <View style={styles.totalRow}>
        <View>
          <Text style={[styles.totalLabel, { color: palette.text }]}>
            Total Payable
          </Text>
          <Text style={[styles.taxNote, { color: palette.muted }]}>
            Includes applicable taxes & fees
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {price.strikethroughTotal ? (
            <Text style={[styles.strike, { color: palette.danger }]}>
              {formatMoney(price.strikethroughTotal, price.currency)}
            </Text>
          ) : null}
          <Text style={[styles.totalValue, { color: palette.primary }]}>
            {formatMoney(price.total, price.currency)}
          </Text>
        </View>
      </View>

      {providerLabel ? (
        <Text style={[styles.attribution, { color: palette.muted }]}>
          Rate verified via {providerLabel}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  heading: {
    fontSize: 16,
    fontWeight: "700",
  },
  lines: {
    gap: 8,
  },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lineLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  lineVal: {
    fontSize: 13,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    width: "100%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  taxNote: {
    fontSize: 11,
    marginTop: 2,
  },
  strike: {
    fontSize: 12,
    textDecorationLine: "line-through",
    fontWeight: "600",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  attribution: {
    fontSize: 11,
    fontWeight: "500",
  },
});


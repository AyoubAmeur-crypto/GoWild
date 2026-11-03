import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  BedDouble,
  Users,
  Utensils,
  ShieldCheck,
  AlertTriangle,
  Maximize2,
  Zap,
} from "lucide-react-native";
import type { RoomOffer } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";
import { formatMoney } from "../../../lib/pricing";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

interface RoomOfferCardProps {
  offer: RoomOffer;
  onSelect: (offer: RoomOffer) => void;
  loading?: boolean;
}

export const RoomOfferCard: React.FC<RoomOfferCardProps> = ({
  offer,
  onSelect,
  loading = false,
}) => {
  const { palette } = useAppTheme();
  const isRefundable = offer.cancellationPolicy.refundableTag === "refundable";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={[styles.roomName, { color: palette.text }]}>
            {offer.roomName}
          </Text>
          <Text style={[styles.supplierText, { color: palette.muted }]}>
            Supplied by {offer.supplierName}
          </Text>
        </View>
        {offer.availableUnits !== undefined && offer.availableUnits <= 3 ? (
          <View
            style={[
              styles.scarcityPill,
              { backgroundColor: palette.dangerTint },
            ]}
          >
            <Text style={[styles.scarcityText, { color: palette.danger }]}>
              {offer.availableUnits} left
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.description, { color: palette.subtext }]}>
        {offer.description}
      </Text>

      {/* Room Specs */}
      <View style={styles.specWrap}>
        <View
          style={[
            styles.specPill,
            { backgroundColor: palette.surfaceMuted },
          ]}
        >
          <BedDouble size={13} color={palette.primary} />
          <Text style={[styles.specText, { color: palette.text }]}>
            {offer.bedSummary}
          </Text>
        </View>

        <View
          style={[
            styles.specPill,
            { backgroundColor: palette.surfaceMuted },
          ]}
        >
          <Users size={13} color={palette.primary} />
          <Text style={[styles.specText, { color: palette.text }]}>
            Up to {offer.maxAdults} adults
            {offer.maxChildren > 0 ? `, ${offer.maxChildren} children` : ""}
          </Text>
        </View>

        {offer.sizeSqm ? (
          <View
            style={[
              styles.specPill,
              { backgroundColor: palette.surfaceMuted },
            ]}
          >
            <Maximize2 size={13} color={palette.primary} />
            <Text style={[styles.specText, { color: palette.text }]}>
              {offer.sizeSqm} m²
            </Text>
          </View>
        ) : null}
      </View>

      {/* Rate Plan & Policy Badges */}
      <View
        style={[
          styles.policyBox,
          { backgroundColor: palette.surfaceMuted },
        ]}
      >
        <View style={styles.policyItem}>
          <Utensils size={14} color={palette.primary} />
          <Text style={[styles.policyLabel, { color: palette.text }]}>
            {offer.ratePlan.boardLabel}
          </Text>
        </View>

        <View style={styles.policyItem}>
          {isRefundable ? (
            <ShieldCheck size={14} color={palette.success} />
          ) : (
            <AlertTriangle size={14} color={palette.warning} />
          )}
          <Text
            style={[
              styles.policyLabel,
              { color: isRefundable ? palette.success : palette.subtext },
            ]}
          >
            {offer.cancellationPolicy.summary}
          </Text>
        </View>

        {offer.ratePlan.isInstantConfirmation ? (
          <View style={styles.policyItem}>
            <Zap size={14} color={palette.primary} />
            <Text style={[styles.policyLabel, { color: palette.subtext }]}>
              Instant confirmation
            </Text>
          </View>
        ) : null}
      </View>

      {/* Footer Price + Action */}
      <View
        style={[
          styles.footerRow,
          { borderTopColor: palette.border },
        ]}
      >
        <View style={styles.priceCol}>
          {offer.price.strikethroughTotal ? (
            <Text style={[styles.strike, { color: palette.danger }]}>
              {formatMoney(offer.price.strikethroughTotal, offer.price.currency)}
            </Text>
          ) : null}
          <View style={styles.nightlyRow}>
            <Text style={[styles.nightlyPrice, { color: palette.primary }]}>
              {formatMoney(offer.price.perNightBase, offer.price.currency, {
                compact: true,
              })}
            </Text>
            <Text style={[styles.perNightSuffix, { color: palette.subtext }]}>
              /night
            </Text>
          </View>
          <Text style={[styles.totalCaption, { color: palette.subtext }]}>
            {formatMoney(offer.price.total, offer.price.currency)} total incl.
            taxes ({offer.price.nights}{" "}
            {offer.price.nights === 1 ? "night" : "nights"})
          </Text>
        </View>

        <PrimaryButton
          label="Select Room"
          onPress={() => onSelect(offer)}
          loading={loading}
          style={styles.selectBtn}
        />
      </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  titleCol: {
    flex: 1,
    gap: 2,
  },
  roomName: {
    fontSize: 16,
    fontWeight: "700",
  },
  supplierText: {
    fontSize: 11,
    fontWeight: "600",
  },
  scarcityPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  scarcityText: {
    fontSize: 11,
    fontWeight: "700",
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  specWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  specPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  specText: {
    fontSize: 12,
    fontWeight: "600",
  },
  policyBox: {
    padding: 12,
    borderRadius: 12,
    gap: 7,
  },
  policyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  policyLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  priceCol: {
    flex: 1,
    gap: 2,
  },
  strike: {
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "line-through",
  },
  nightlyRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  nightlyPrice: {
    fontSize: 20,
    fontWeight: "700",
  },
  perNightSuffix: {
    fontSize: 12,
    fontWeight: "500",
  },
  totalCaption: {
    fontSize: 11,
    fontWeight: "500",
  },
  selectBtn: {
    minHeight: 46,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
});


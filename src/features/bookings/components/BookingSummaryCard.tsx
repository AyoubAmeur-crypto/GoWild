import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import {
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react-native";
import type { Booking } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";
import { formatDateRangeShort, formatMoney } from "../../../lib/pricing";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";

interface BookingSummaryCardProps {
  booking: Booking;
  onPress: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
}

export const BookingSummaryCard: React.FC<BookingSummaryCardProps> = ({
  booking,
  onPress,
  onCancel,
  cancelling = false,
}) => {
  const { palette } = useAppTheme();

  const statusMeta = (() => {
    switch (booking.status) {
      case "confirmed":
        return {
          label: booking.isSandbox ? "Confirmed (Sandbox)" : "Confirmed",
          bg: palette.successTint,
          fg: palette.success,
          Icon: CheckCircle2,
        };
      case "pending":
        return {
          label: booking.isExternalHandoff
            ? "Pending Checkout"
            : "Pending Supplier",
          bg: palette.warningTint,
          fg: palette.warning,
          Icon: Clock,
        };
      case "cancelled":
        return {
          label: "Cancelled",
          bg: palette.dangerTint,
          fg: palette.danger,
          Icon: XCircle,
        };
      case "completed":
        return {
          label: "Completed Stay",
          bg: palette.primaryTint,
          fg: palette.primary,
          Icon: CheckCircle2,
        };
      case "failed":
        return {
          label: "Failed",
          bg: palette.dangerTint,
          fg: palette.danger,
          Icon: AlertTriangle,
        };
    }
  })();

  const StatusIcon = statusMeta.Icon;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Booking for ${booking.hotelName}, status ${statusMeta.label}`}
    >
      <View style={styles.topRow}>
        <Image
          source={{ uri: booking.hotelImageUrl }}
          style={styles.thumb}
          contentFit="cover"
        />
        <View style={styles.topContent}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: statusMeta.bg },
            ]}
          >
            <StatusIcon size={12} color={statusMeta.fg} />
            <Text style={[styles.statusText, { color: statusMeta.fg }]}>
              {statusMeta.label}
            </Text>
          </View>

          <Text
            style={[styles.hotelName, { color: palette.text }]}
            numberOfLines={1}
          >
            {booking.hotelName}
          </Text>
          <Text
            style={[styles.roomName, { color: palette.subtext }]}
            numberOfLines={1}
          >
            {booking.roomName} · {booking.boardLabel}
          </Text>

          {booking.hotelCity ? (
            <View style={styles.metaLine}>
              <MapPin size={12} color={palette.muted} />
              <Text style={[styles.metaText, { color: palette.subtext }]}>
                {booking.hotelCity}
                {booking.hotelCountry ? `, ${booking.hotelCountry}` : ""}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.infoStrip,
          { backgroundColor: palette.surfaceMuted },
        ]}
      >
        <View style={styles.metaLine}>
          <Calendar size={14} color={palette.primary} />
          <Text style={[styles.dateText, { color: palette.text }]}>
            {formatDateRangeShort(booking.checkIn, booking.checkOut)} (
            {booking.nights} {booking.nights === 1 ? "night" : "nights"})
          </Text>
        </View>

        <Text style={[styles.totalText, { color: palette.primary }]}>
          {formatMoney(booking.price.total, booking.price.currency)}
        </Text>
      </View>

      <View style={styles.bottomRow}>
        <Text style={[styles.refText, { color: palette.muted }]}>
          Ref: {booking.bookingReference ?? booking.id} ·{" "}
          {booking.providerDisplayName}
        </Text>

        {booking.isExternalHandoff && booking.status === "pending" ? (
          <View style={styles.metaLine}>
            <ExternalLink size={12} color={palette.primary} />
            <Text style={[styles.handoffText, { color: palette.primary }]}>
              External Checkout
            </Text>
          </View>
        ) : null}
      </View>

      {onCancel &&
      (booking.status === "confirmed" || booking.status === "pending") ? (
        <PrimaryButton
          label="Cancel Reservation"
          variant="danger"
          loading={cancelling}
          onPress={onCancel}
          style={styles.cancelBtn}
        />
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    gap: 12,
  },
  thumb: {
    width: 82,
    height: 86,
    borderRadius: 12,
    backgroundColor: "#E9EBED",
  },
  topContent: {
    flex: 1,
    gap: 4,
    alignItems: "flex-start",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  hotelName: {
    fontSize: 16,
    fontWeight: "700",
  },
  roomName: {
    fontSize: 12,
    fontWeight: "500",
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  infoStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 13,
    fontWeight: "600",
  },
  totalText: {
    fontSize: 15,
    fontWeight: "700",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refText: {
    fontSize: 11,
    fontWeight: "500",
  },
  handoffText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cancelBtn: {
    minHeight: 42,
    paddingVertical: 10,
  },
});


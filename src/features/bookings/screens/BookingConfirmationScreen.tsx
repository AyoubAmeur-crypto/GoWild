import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  User,
  MapPin,
  RefreshCw,
} from "lucide-react-native";
import { useAppTheme } from "../../../theme/useAppTheme";
import { formatFullDate } from "../../../lib/pricing";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { Skeleton } from "../../../components/ui/Skeleton";
import { ErrorState } from "../../../components/ui/ErrorState";
import { PriceBreakdownCard } from "../../availability/components/PriceBreakdownCard";
import { useBookingDetail, useCancelBooking } from "../hooks/useBookings";

interface BookingConfirmationScreenProps {
  bookingId: string;
}

export const BookingConfirmationScreen: React.FC<
  BookingConfirmationScreenProps
> = ({ bookingId }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();

  const detailQuery = useBookingDetail(bookingId);
  const cancelMutation = useCancelBooking();
  const booking = detailQuery.data?.booking;

  const confirmCancel = () => {
    if (!booking) return;
    Alert.alert(
      "Cancel Reservation",
      `Cancel your reservation at ${booking.hotelName}? ${booking.cancellationPolicy.summary}`,
      [
        { text: "Keep Stay", style: "cancel" },
        {
          text: "Cancel Booking",
          style: "destructive",
          onPress: () => cancelMutation.mutate(booking.id),
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 16, 28),
            paddingBottom: Math.max(insets.bottom + 24, 36),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {detailQuery.isLoading ? (
          <View style={styles.gap}>
            <Skeleton height={150} borderRadius={22} />
            <Skeleton height={220} borderRadius={18} />
          </View>
        ) : detailQuery.error || !booking ? (
          <ErrorState
            error={detailQuery.error ?? new Error("Booking not found.")}
            onRetry={() => detailQuery.refetch()}
          />
        ) : (
          <>
            {/* Status Banner */}
            <View
              style={[
                styles.heroStatus,
                {
                  backgroundColor:
                    booking.status === "confirmed"
                      ? palette.successTint
                      : booking.status === "pending"
                        ? palette.warningTint
                        : palette.dangerTint,
                },
              ]}
            >
              {booking.status === "confirmed" ? (
                <CheckCircle2 size={38} color={palette.success} />
              ) : booking.status === "pending" ? (
                <Clock size={38} color={palette.warning} />
              ) : (
                <XCircle size={38} color={palette.danger} />
              )}

              <Text style={[styles.statusHeadline, { color: palette.text }]}>
                {booking.status === "confirmed"
                  ? booking.isSandbox
                    ? "Reservation Confirmed (Sandbox)"
                    : "Reservation Confirmed"
                  : booking.status === "pending"
                    ? "Awaiting Provider Checkout"
                    : booking.status === "cancelled"
                      ? "Reservation Cancelled"
                      : "Reservation Status: " + booking.status}
              </Text>

              <Text style={[styles.refCode, { color: palette.subtext }]}>
                Confirmation Ref: {booking.bookingReference ?? booking.id}
              </Text>
              <Text style={[styles.providerNote, { color: palette.muted }]}>
                Processed via {booking.providerDisplayName}
              </Text>
            </View>

            {/* Pending External Checkout Action */}
            {booking.status === "pending" && booking.externalCheckoutUrl ? (
              <View style={styles.pendingActions}>
                <PrimaryButton
                  label="Open Provider Checkout"
                  onPress={async () => {
                    if (booking.externalCheckoutUrl) {
                      await WebBrowser.openBrowserAsync(
                        booking.externalCheckoutUrl
                      ).catch(() => {});
                      detailQuery.refetch();
                    }
                  }}
                />
                <Pressable
                  onPress={() => detailQuery.refetch()}
                  style={[
                    styles.syncBtn,
                    { borderColor: palette.border },
                  ]}
                >
                  <RefreshCw size={15} color={palette.primary} />
                  <Text style={[styles.syncText, { color: palette.primary }]}>
                    Refresh Supplier Confirmation Status
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Reservation Details Card */}
            <View
              style={[
                styles.detailsCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text style={[styles.hotelTitle, { color: palette.text }]}>
                {booking.hotelName}
              </Text>
              <Text style={[styles.roomSubtitle, { color: palette.primary }]}>
                {booking.roomName} · {booking.boardLabel}
              </Text>

              {booking.hotelAddress ? (
                <View style={styles.infoRow}>
                  <MapPin size={15} color={palette.subtext} />
                  <Text style={[styles.infoText, { color: palette.subtext }]}>
                    {booking.hotelAddress}
                    {booking.hotelCity ? `, ${booking.hotelCity}` : ""}
                  </Text>
                </View>
              ) : null}

              <View
                style={[styles.divider, { backgroundColor: palette.border }]}
              />

              <View style={styles.infoRow}>
                <Calendar size={15} color={palette.primary} />
                <Text style={[styles.infoText, { color: palette.text }]}>
                  Check-in {formatFullDate(booking.checkIn)} · Check-out{" "}
                  {formatFullDate(booking.checkOut)} ({booking.nights} nights)
                </Text>
              </View>

              <View style={styles.infoRow}>
                <User size={15} color={palette.primary} />
                <Text style={[styles.infoText, { color: palette.text }]}>
                  Lead Guest: {booking.leadGuest.firstName}{" "}
                  {booking.leadGuest.lastName} ({booking.leadGuest.email})
                </Text>
              </View>
            </View>

            <PriceBreakdownCard
              price={booking.price}
              providerLabel={booking.providerDisplayName}
            />

            {/* Actions */}
            <View style={styles.footerButtons}>
              <PrimaryButton
                label="View My Trips"
                onPress={() => router.replace("/(tabs)/bookings")}
              />
              <PrimaryButton
                label="Back to Explore"
                variant="secondary"
                onPress={() => router.replace("/(tabs)")}
              />
              {(booking.status === "confirmed" ||
                booking.status === "pending") && (
                <PrimaryButton
                  label="Cancel Reservation"
                  variant="danger"
                  loading={cancelMutation.isPending}
                  onPress={confirmCancel}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  gap: {
    gap: 16,
  },
  heroStatus: {
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    gap: 6,
  },
  statusHeadline: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },
  refCode: {
    fontSize: 13,
    fontWeight: "700",
  },
  providerNote: {
    fontSize: 12,
    fontWeight: "500",
  },
  pendingActions: {
    gap: 10,
  },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncText: {
    fontSize: 13,
    fontWeight: "700",
  },
  detailsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  hotelTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  roomSubtitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    width: "100%",
  },
  footerButtons: {
    gap: 10,
    marginTop: 4,
  },
});


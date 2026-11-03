import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Briefcase, Compass } from "lucide-react-native";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { getCopy } from "../../../lib/config";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { Skeleton } from "../../../components/ui/Skeleton";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { useBookingsList, useCancelBooking } from "../hooks/useBookings";
import { BookingSummaryCard } from "../components/BookingSummaryCard";

const BASE_TABS = ["Upcoming", "Completed", "Cancelled"] as const;

export const MyTripsScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const language = useSettingsStore((s) => s.language);
  const copy = getCopy(language);

  const [tabIndex, setTabIndex] = useState(0);
  const bookingsQuery = useBookingsList();
  const cancelMutation = useCancelBooking();

  const grouped = useMemo(() => {
    const all = bookingsQuery.data?.bookings ?? [];
    return {
      upcoming: all.filter(
        (b) => b.status === "confirmed" || b.status === "pending"
      ),
      completed: all.filter((b) => b.status === "completed"),
      cancelled: all.filter(
        (b) => b.status === "cancelled" || b.status === "failed"
      ),
    };
  }, [bookingsQuery.data]);

  const tabLabels = useMemo(
    () => [
      `Upcoming (${grouped.upcoming.length})`,
      `Completed (${grouped.completed.length})`,
      `Cancelled (${grouped.cancelled.length})`,
    ],
    [grouped]
  );

  const filteredBookings =
    tabIndex === 0
      ? grouped.upcoming
      : tabIndex === 1
        ? grouped.completed
        : grouped.cancelled;

  const bottomPad = Platform.OS === "android" ? 112 : 40;

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 12, 22),
            paddingBottom: bottomPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerBlock}>
            <Text style={[styles.title, { color: palette.text }]}>
              {copy.myTrips}
            </Text>
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              Manage upcoming reservations, receipts, and cancellations
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/map")}
            style={[
              styles.mapQuickBtn,
              {
                backgroundColor: palette.primaryTint,
                borderColor: palette.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Explore hotels on map"
          >
            <Compass size={15} color={palette.primary} />
            <Text style={[styles.mapQuickText, { color: palette.primary }]}>
              Map
            </Text>
          </Pressable>
        </View>

        <SegmentedControl
          options={tabLabels}
          selectedIndex={tabIndex}
          onChange={setTabIndex}
        />

        {bookingsQuery.isLoading ? (
          <View style={styles.list}>
            <Skeleton height={180} borderRadius={18} />
            <Skeleton height={180} borderRadius={18} />
          </View>
        ) : bookingsQuery.error ? (
          <ErrorState
            error={bookingsQuery.error}
            onRetry={() => bookingsQuery.refetch()}
          />
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={28} color={palette.primary} />}
            title={`No ${BASE_TABS[tabIndex].toLowerCase()} reservations`}
            description="Select any hotel and confirm a room offer to receive an instant verified booking receipt and manage cancellations here."
            actionLabel="Explore Hotels to Book"
            onAction={() => router.push("/search")}
          />
        ) : (
          <View style={styles.list}>
            {filteredBookings.map((booking) => (
              <BookingSummaryCard
                key={booking.id}
                booking={booking}
                cancelling={
                  cancelMutation.isPending &&
                  cancelMutation.variables === booking.id
                }
                onPress={() =>
                  router.push(`/booking/confirmation/${booking.id}`)
                }
                onCancel={
                  booking.status === "confirmed" || booking.status === "pending"
                    ? () => {
                        Alert.alert(
                          "Cancel Reservation",
                          `Are you sure you want to cancel ${booking.hotelName}?`,
                          [
                            { text: "Keep Booking", style: "cancel" },
                            {
                              text: "Cancel Booking",
                              style: "destructive",
                              onPress: () => cancelMutation.mutate(booking.id),
                            },
                          ]
                        );
                      }
                    : undefined
                }
              />
            ))}
          </View>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
  },
  mapQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  mapQuickText: {
    fontSize: 12,
    fontWeight: "700",
  },
  list: {
    gap: 14,
  },
});

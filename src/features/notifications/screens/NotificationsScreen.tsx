import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Bell, CheckCircle2, ShieldAlert } from "lucide-react-native";
import { useAppTheme } from "../../../theme/useAppTheme";
import { formatFullDate } from "../../../lib/pricing";
import { Skeleton } from "../../../components/ui/Skeleton";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { useNotificationsQuery } from "../hooks/useNotifications";

export const NotificationsScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();

  const notificationsQuery = useNotificationsQuery();
  const items = notificationsQuery.data?.notifications ?? [];

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top + 8, 18),
            borderBottomColor: palette.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={19} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Notifications
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 36) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {notificationsQuery.isLoading ? (
          <View style={styles.list}>
            <Skeleton height={92} borderRadius={16} />
            <Skeleton height={92} borderRadius={16} />
          </View>
        ) : notificationsQuery.error ? (
          <ErrorState
            error={notificationsQuery.error}
            onRetry={() => notificationsQuery.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell size={28} color={palette.primary} />}
            title="All caught up"
            description="Booking confirmations, check-in reminders, and rate alerts will appear here."
          />
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (item.bookingId) {
                    router.push(`/booking/confirmation/${item.bookingId}`);
                  } else if (item.hotelId) {
                    router.push(`/hotel/${item.hotelId}`);
                  }
                }}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor:
                        item.category === "booking"
                          ? palette.successTint
                          : palette.primaryTint,
                    },
                  ]}
                >
                  {item.category === "booking" ? (
                    <CheckCircle2 size={18} color={palette.success} />
                  ) : (
                    <ShieldAlert size={18} color={palette.primary} />
                  )}
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.itemTitle, { color: palette.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.itemBody, { color: palette.subtext }]}>
                    {item.body}
                  </Text>
                  <Text style={[styles.itemDate, { color: palette.muted }]}>
                    {formatFullDate(item.createdAt.slice(0, 10))}
                  </Text>
                </View>
              </Pressable>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 20,
  },
  list: {
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  itemBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  itemDate: {
    fontSize: 11,
    fontWeight: "500",
  },
});


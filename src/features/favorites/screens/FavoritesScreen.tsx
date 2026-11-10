import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heart, Cloud } from "lucide-react-native";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useAuthStore } from "../../../stores/useAuthStore";
import { getCopy } from "../../../lib/config";
import { Skeleton } from "../../../components/ui/Skeleton";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import { HotelCard } from "../../hotels/components/HotelCard";
import { useSyncedFavorites } from "../hooks/useSyncedFavorites";

export const FavoritesScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const language = useSettingsStore((s) => s.language);
  const copy = getCopy(language);
  const user = useAuthStore((s) => s.user);

  const { favoriteIds, savedHotels, isLoading, error, refetchAll } =
    useSyncedFavorites();

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
        <View style={styles.headerBlock}>
          <Text style={[styles.title, { color: palette.text }]}>
            {copy.savedHotels}
          </Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            {favoriteIds.length}{" "}
            {favoriteIds.length === 1 ? "property saved" : "properties saved"}{" "}
            for quick comparison
          </Text>
        </View>

        {!user && favoriteIds.length > 0 ? (
          <Pressable
            onPress={() => router.push("/auth/sign-in")}
            style={[
              styles.syncBanner,
              {
                backgroundColor: palette.surfaceIce,
                borderColor: palette.border,
              },
            ]}
          >
            <Cloud size={17} color={palette.primary} />
            <Text style={[styles.syncText, { color: palette.text }]}>
              Sign in to sync your saved hotels across devices
            </Text>
          </Pressable>
        ) : null}

        {favoriteIds.length === 0 ? (
          <EmptyState
            icon={<Heart size={28} color={palette.primary} />}
            title="No saved hotels yet"
            description="Tap the heart icon on any hotel card or detail page to shortlist properties for your next trip."
            actionLabel="Discover Hotels"
            onAction={() => router.navigate("/(tabs)")}
          />
        ) : isLoading && savedHotels.length === 0 ? (
          <View style={styles.list}>
            <Skeleton height={250} borderRadius={18} />
            <Skeleton height={250} borderRadius={18} />
          </View>
        ) : error && savedHotels.length === 0 ? (
          <ErrorState error={error} onRetry={refetchAll} />
        ) : (
          <View style={styles.list}>
            {savedHotels.map((hotel) => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                variant="search"
                onPress={() => router.push(`/hotel/${hotel.id}`)}
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
  headerBlock: {
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
  },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  syncText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    gap: 16,
  },
});


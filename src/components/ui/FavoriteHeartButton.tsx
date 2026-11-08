import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Heart } from "lucide-react-native";
import { useAppTheme } from "../../theme/useAppTheme";
import { useFavoritesStore } from "../../stores/favoritesStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { goWildApi } from "../../services/http/apiClient";
import { haptics } from "../../lib/haptics";

interface FavoriteHeartButtonProps {
  hotelId: string;
  size?: "sm" | "md";
  overlay?: boolean;
}

export const FavoriteHeartButton: React.FC<FavoriteHeartButtonProps> = ({
  hotelId,
  size = "sm",
  overlay = false,
}) => {
  const { palette } = useAppTheme();
  const isFav = useFavoritesStore((state) => state.favoriteIds.includes(hotelId));
  const toggleFavoriteLocal = useFavoritesStore((state) => state.toggleFavoriteLocal);
  const token = useAuthStore((state) => state.token);

  const isSmall = size === "sm";
  const iconSize = isSmall ? 16 : 20;

  const handlePress = () => {
    haptics.light();
    const nowFav = toggleFavoriteLocal(hotelId);
    if (token) {
      if (nowFav) {
        goWildApi.addFavorite(hotelId).catch(() => {});
      } else {
        goWildApi.removeFavorite(hotelId).catch(() => {});
      }
    }
  };

  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        handlePress();
      }}
      hitSlop={10}
      style={({ pressed }) => [
        styles.base,
        isSmall ? styles.small : styles.medium,
        {
          backgroundColor: overlay
            ? "rgba(255, 255, 255, 0.90)"
            : palette.surfaceMuted,
          borderColor: overlay ? "transparent" : palette.border,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isFav }}
      accessibilityLabel={
        isFav ? "Remove hotel from saved" : "Save hotel to favorites"
      }
    >
      <Heart
        size={iconSize}
        color={isFav ? "#F41F52" : overlay ? "#171725" : palette.subtext}
        fill={isFav ? "#F41F52" : "none"}
        strokeWidth={2}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  small: {
    width: 34,
    height: 34,
  },
  medium: {
    width: 44,
    height: 44,
  },
  pressed: {
    transform: [{ scale: 0.92 }],
  },
});

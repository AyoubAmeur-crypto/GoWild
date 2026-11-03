import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useAppTheme } from "../../theme/useAppTheme";

const LOGO_MARK = require("../../../assets/brand/gowild-mark.png");
const LOGO_LIGHT = require("../../../assets/brand/gowild-logo-light.png");
const LOGO_DARK = require("../../../assets/brand/gowild-logo-dark.png");

// Exact source geometry from assets/goWild (1080 x 600 px).png crop: 2265 x 552
const FULL_LOGO_ASPECT_RATIO = 2265 / 552;

interface BrandLogoProps {
  variant?: "full" | "mark";
  tone?: "auto" | "light" | "dark";
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Canonical goWild Brand Logo component.
 * Preserves exact geometric blue flower mark (#40B4F8) and wordmark proportions.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = "full",
  tone = "auto",
  height = 30,
  style,
}) => {
  const { isDark } = useAppTheme();

  if (variant === "mark") {
    return (
      <View
        style={[styles.wrapper, { width: height, height }, style]}
        accessibilityRole="image"
        accessibilityLabel="goWild brand mark"
      >
        <Image
          source={LOGO_MARK}
          style={styles.image}
          contentFit="contain"
          transition={120}
        />
      </View>
    );
  }

  const useDarkWordmarkAsset =
    tone === "dark" || (tone === "auto" && isDark);
  const width = Math.round(height * FULL_LOGO_ASPECT_RATIO);

  return (
    <View
      style={[styles.wrapper, { width, height }, style]}
      accessibilityRole="image"
      accessibilityLabel="goWild"
    >
      <Image
        source={useDarkWordmarkAsset ? LOGO_DARK : LOGO_LIGHT}
        style={styles.image}
        contentFit="contain"
        transition={120}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});


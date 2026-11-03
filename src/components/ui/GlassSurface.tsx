import React from "react";
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
} from "react-native";
import { BlurView, BlurTint, BlurMethod } from "expo-blur";
import { useAppTheme } from "../../theme/useAppTheme";

interface GlassSurfaceProps {
  children?: React.ReactNode;
  intensity?: number;
  tint?: BlurTint;
  borderRadius?: number;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
  blurMethod?: BlurMethod;
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  intensity = 50,
  tint,
  borderRadius = 16,
  bordered = true,
  style,
  blurMethod = "dimezisBlurViewSdk31Plus",
}) => {
  const { isDark } = useAppTheme();
  const resolvedTint: BlurTint = tint ?? (isDark ? "dark" : "light");

  return (
    <View
      style={[
        styles.outerContainer,
        { borderRadius },
        bordered && [
          styles.bordered,
          {
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.14)"
              : "rgba(255, 255, 255, 0.65)",
          },
        ],
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={resolvedTint}
        blurMethod={Platform.OS === "android" ? blurMethod : undefined}
        style={[StyleSheet.absoluteFill, styles.blurView, { borderRadius }]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            backgroundColor:
              resolvedTint === "dark"
                ? Platform.OS === "android"
                  ? "rgba(23, 29, 43, 0.88)"
                  : "rgba(23, 29, 43, 0.55)"
                : Platform.OS === "android"
                  ? "rgba(255, 255, 255, 0.88)"
                  : "rgba(255, 255, 255, 0.42)",
          },
        ]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    overflow: "hidden",
    position: "relative",
    backgroundColor: "transparent",
  },
  bordered: {
    borderWidth: 1,
    shadowColor: "#171725",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  blurView: {
    overflow: "hidden",
  },
  content: {
    position: "relative",
    zIndex: 1,
  },
});

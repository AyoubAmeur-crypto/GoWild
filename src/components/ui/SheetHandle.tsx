import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useAppTheme } from "../../theme/useAppTheme";

export interface SheetHandleProps {
  style?: StyleProp<ViewStyle>;
  indicatorStyle?: StyleProp<ViewStyle>;
  active?: boolean;
}

export const SheetHandle: React.FC<SheetHandleProps> = ({
  style,
  indicatorStyle,
  active = false,
}) => {
  const { isDark, palette } = useAppTheme();

  return (
    <View
      style={[styles.handleContainer, style]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Bottom sheet drag handle"
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: isDark
              ? active
                ? "#71717A"
                : "#3F3F46"
              : active
              ? "#9CA3AF"
              : "#D1D5DB",
            transform: [{ scaleX: active ? 1.15 : 1.0 }],
          },
          indicatorStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  handleContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  pill: {
    width: 38,
    height: 4.5,
    borderRadius: 2.25,
  },
});


import React, { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { Colors } from "../../theme/tokens";
import { Motion } from "../../theme/motion";
import { useSettingsStore } from "../../stores/useSettingsStore";

export interface GlassSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "glass" | "solid";
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const DIMENSIONS = {
  sm: { width: 44, height: 26, thumbSize: 22, padding: 2 },
  md: { width: 52, height: 30, thumbSize: 24, padding: 3 },
  lg: { width: 62, height: 36, thumbSize: 30, padding: 3 },
} as const;

export const GlassSwitch: React.FC<GlassSwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  size = "md",
  variant = "glass",
  accessibilityLabel = "Toggle switch",
  style,
}) => {
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const dims = DIMENSIONS[size];
  const travelDistance = dims.width - dims.thumbSize - dims.padding * 2;

  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = withTiming(value ? 1 : 0, { duration: 0 });
    } else {
      progress.value = withSpring(value ? 1 : 0, Motion.spring.snappy);
    }
  }, [value, reducedMotion]);

  const handlePress = () => {
    if (disabled) return;
    onValueChange(!value);
  };

  const animatedTrackStyle = useAnimatedStyle(() => {
    const inactiveColor =
      variant === "glass"
        ? "rgba(184, 184, 184, 0.28)"
        : "rgba(226, 232, 240, 0.9)";
    const activeColor = Colors.primary;

    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      [inactiveColor, activeColor]
    );

    return {
      backgroundColor,
    };
  });

  const animatedThumbStyle = useAnimatedStyle(() => {
    const translateX = progress.value * travelDistance;
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={[
        styles.touchable,
        {
          width: dims.width,
          height: dims.height,
          borderRadius: dims.height / 2,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.track,
          {
            width: dims.width,
            height: dims.height,
            borderRadius: dims.height / 2,
            padding: dims.padding,
          },
          variant === "glass" && styles.glassTrackBorder,
          animatedTrackStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: dims.thumbSize,
              height: dims.thumbSize,
              borderRadius: dims.thumbSize / 2,
            },
            animatedThumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  touchable: {
    justifyContent: "center",
    alignItems: "center",
  },
  track: {
    justifyContent: "center",
  },
  glassTrackBorder: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.45)",
  },
  thumb: {
    backgroundColor: Colors.white,
    shadowColor: "rgba(0, 0, 0, 0.2)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  disabled: {
    opacity: 0.45,
  },
});

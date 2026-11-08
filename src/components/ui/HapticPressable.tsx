import React, { useRef } from "react";
import {
  Pressable,
  PressableProps,
  Animated,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
} from "react-native";
import { haptics } from "../../lib/haptics";
import { useSettingsStore } from "../../stores/useSettingsStore";

export type HapticType =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "none";

export interface HapticPressableProps extends Omit<PressableProps, "style"> {
  haptic?: HapticType;
  scaleOnPress?: boolean;
  activeScale?: number;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
}

export const HapticPressable: React.FC<HapticPressableProps> = ({
  haptic = "light",
  scaleOnPress = true,
  activeScale = 0.97,
  style,
  onPressIn,
  onPressOut,
  onPress,
  children,
  disabled,
  ...rest
}) => {
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const triggerHaptic = () => {
    if (disabled || haptic === "none") return;
    switch (haptic) {
      case "selection":
        haptics.selection();
        break;
      case "light":
        haptics.light();
        break;
      case "medium":
        haptics.medium();
        break;
      case "heavy":
        haptics.heavy();
        break;
      case "success":
        haptics.success();
        break;
    }
  };

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!disabled && scaleOnPress && !reducedMotion) {
      Animated.spring(scaleAnim, {
        toValue: activeScale,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }).start();
    }
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    if (!disabled && scaleOnPress && !reducedMotion) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 35,
        bounciness: 4,
      }).start();
    }
    onPressOut?.(e);
  };

  const handlePress = (e: GestureResponderEvent) => {
    triggerHaptic();
    onPress?.(e);
  };

  return (
    <Pressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      {...rest}
    >
      {(state) => {
        const resolvedStyle =
          typeof style === "function" ? style(state) : style;

        return (
          <Animated.View
            style={[
              resolvedStyle,
              scaleOnPress &&
                !reducedMotion && {
                  transform: [{ scale: scaleAnim }],
                },
            ]}
          >
            {typeof children === "function" ? children(state) : children}
          </Animated.View>
        );
      }}
    </Pressable>
  );
};


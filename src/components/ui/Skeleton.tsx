import React, { useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "../../theme/useAppTheme";

interface SkeletonProps {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height,
  borderRadius = 14,
  style,
}) => {
  const { palette, reducedMotion } = useAppTheme();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 0.65;
      return;
    }
    opacity.value = withRepeat(withTiming(0.95, { duration: 850 }), -1, true);
  }, [reducedMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: palette.border,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};


import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Motion } from "../../theme/motion";
import { useAppTheme } from "../../theme/useAppTheme";
import { GlassSurface } from "./GlassSurface";

interface SegmentedControlProps {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  variant?: "glass" | "solid";
  style?: StyleProp<ViewStyle>;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  selectedIndex,
  onChange,
  variant = "solid",
  style,
}) => {
  const { palette, reducedMotion } = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const segmentWidth =
    containerWidth > 0 && options.length > 0
      ? (containerWidth - 8) / options.length
      : 0;

  const translateX = useSharedValue(0);

  useEffect(() => {
    const targetX = selectedIndex * segmentWidth;
    if (reducedMotion) {
      translateX.value = withTiming(targetX, { duration: 0 });
    } else {
      translateX.value = withSpring(targetX, Motion.spring.interactive);
    }
  }, [selectedIndex, segmentWidth, reducedMotion, translateX]);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: segmentWidth,
  }));

  const content = (
    <View style={styles.innerContainer} onLayout={onLayout}>
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.activeIndicator,
            { backgroundColor: palette.elevated },
            animatedIndicatorStyle,
          ]}
        />
      )}

      {options.map((option, index) => {
        const isSelected = selectedIndex === index;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(index)}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[
                styles.segmentText,
                { color: isSelected ? palette.primary : palette.subtext },
                isSelected && styles.segmentTextActive,
              ]}
              numberOfLines={1}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (variant === "glass") {
    return (
      <GlassSurface
        borderRadius={30}
        intensity={40}
        style={[styles.container, style]}
      >
        {content}
      </GlassSurface>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.surfaceMuted },
        style,
      ]}
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 30,
    padding: 4,
  },
  innerContainer: {
    flexDirection: "row",
    position: "relative",
    alignItems: "center",
  },
  activeIndicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 26,
    shadowColor: "#171725",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 6,
    elevation: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "500",
  },
  segmentTextActive: {
    fontWeight: "700",
  },
});

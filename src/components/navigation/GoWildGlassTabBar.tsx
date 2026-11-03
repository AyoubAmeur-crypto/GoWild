import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
  Platform,
} from "react-native";
import { BottomTabBarProps } from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Compass, Briefcase, Heart, User } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { Motion } from "../../theme/motion";
import { useAppTheme } from "../../theme/useAppTheme";

interface TabMeta {
  name: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

const TAB_CONFIG: Record<string, TabMeta> = {
  index: {
    name: "index",
    label: "Explore",
    icon: Compass,
  },
  bookings: {
    name: "bookings",
    label: "My Trips",
    icon: Briefcase,
  },
  favorites: {
    name: "favorites",
    label: "Saved",
    icon: Heart,
  },
  profile: {
    name: "profile",
    label: "Profile",
    icon: User,
  },
};

export const GoWildGlassTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  emitter,
  navigateToTab,
}) => {
  const insets = useSafeAreaInsets();
  const { palette, isDark, reducedMotion } = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = state.index;
  const numTabs = state.routes.length;
  const paddingHorizontal = 8;
  const itemWidth =
    containerWidth > 0 && numTabs > 0
      ? (containerWidth - paddingHorizontal * 2) / numTabs
      : 0;

  const indicatorTranslateX = useSharedValue(0);

  useEffect(() => {
    const targetX = activeIndex * itemWidth;
    if (reducedMotion) {
      indicatorTranslateX.value = withTiming(targetX, { duration: 0 });
    } else {
      indicatorTranslateX.value = withSpring(targetX, Motion.spring.interactive);
    }
  }, [activeIndex, itemWidth, reducedMotion, indicatorTranslateX]);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorTranslateX.value }],
    width: itemWidth,
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          bottom: Math.max(insets.bottom + 8, 14),
        },
      ]}
    >
      <View
        style={[
          styles.floatingContainer,
          {
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.14)"
              : "rgba(255, 255, 255, 0.82)",
          },
        ]}
        onLayout={onLayout}
      >
        <BlurView
          intensity={65}
          tint={isDark ? "dark" : "light"}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={[StyleSheet.absoluteFill, styles.blurView]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.translucentBacking,
            {
              backgroundColor: isDark
                ? Platform.OS === "android"
                  ? "rgba(23, 29, 43, 0.92)"
                  : "rgba(23, 29, 43, 0.78)"
                : Platform.OS === "android"
                  ? "rgba(255, 255, 255, 0.92)"
                  : "rgba(255, 255, 255, 0.75)",
            },
          ]}
        />

        {itemWidth > 0 && (
          <Animated.View
            style={[
              styles.activeIndicator,
              {
                left: paddingHorizontal,
                width: itemWidth,
                backgroundColor: palette.primaryTint,
                borderColor: isDark
                  ? "rgba(64, 180, 248, 0.28)"
                  : "rgba(40, 83, 175, 0.18)",
              },
              animatedIndicatorStyle,
            ]}
          />
        )}

        <View style={styles.tabsRow}>
          {state.routes.map((route, index) => {
            const descriptor = descriptors[route.key];
            const options = descriptor?.options;
            const isFocused = state.index === index;
            const meta = TAB_CONFIG[route.name] || {
              name: route.name,
              label: options?.title || route.name,
              icon: Compass,
            };

            const IconComponent = meta.icon;

            const onPress = () => {
              const event = emitter.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigateToTab(route.key);
              }
            };

            const onLongPress = () => {
              emitter.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={options.tabBarAccessibilityLabel || meta.label}
                testID={`tab-${route.name}`}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tabItem}
              >
                <View style={styles.tabIconWrapper}>
                  <IconComponent
                    size={20}
                    color={isFocused ? palette.primary : palette.muted}
                    strokeWidth={isFocused ? 2.4 : 1.9}
                  />
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isFocused ? palette.primary : palette.muted },
                    isFocused && styles.tabLabelFocused,
                  ]}
                  numberOfLines={1}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 999,
  },
  floatingContainer: {
    width: "100%",
    height: 64,
    borderRadius: 34,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    shadowColor: "#171725",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10,
    justifyContent: "center",
  },
  blurView: {
    borderRadius: 34,
  },
  translucentBacking: {
    borderRadius: 34,
  },
  activeIndicator: {
    position: "absolute",
    top: 6,
    bottom: 6,
    borderRadius: 28,
    borderWidth: 1,
  },
  tabsRow: {
    flexDirection: "row",
    height: "100%",
    paddingHorizontal: 8,
    alignItems: "center",
    position: "relative",
    zIndex: 2,
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabIconWrapper: {
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  tabLabelFocused: {
    fontWeight: "700",
  },
});

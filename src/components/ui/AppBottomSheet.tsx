import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useAppTheme } from "../../theme/useAppTheme";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { haptics } from "../../lib/haptics";
import { SheetHandle } from "./SheetHandle";

export interface AppBottomSheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
  showHandle?: boolean;
  showCloseButton?: boolean;
  dismissOnBackdropPress?: boolean;
  headerRight?: React.ReactNode;
  maxHeightRatio?: number;
  /**
   * Optional snap points as ratios of screen height (e.g. `[0.55, 0.92]`).
   * Supports dragging upward to expand and downward to collapse or dismiss.
   */
  snapPoints?: number[];
  initialSnapIndex?: number;
}

const SPRING_CONFIG = {
  damping: 26,
  stiffness: 280,
  mass: 0.85,
  overshootClamping: false,
};

export const AppBottomSheet: React.FC<AppBottomSheetProps> = ({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  contentStyle,
  sheetStyle,
  showHandle = true,
  showCloseButton = true,
  dismissOnBackdropPress = true,
  headerRight,
  maxHeightRatio = 0.92,
  snapPoints,
  initialSnapIndex,
}) => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { palette, isDark } = useAppTheme();
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const [modalRendered, setModalRendered] = useState(visible);
  const [isDragging, setIsDragging] = useState(false);

  // Normalized ascending snap ratios (e.g., [0.55, 0.92])
  const resolvedSnapRatios = useMemo(() => {
    if (snapPoints && snapPoints.length > 0) {
      return [...snapPoints].sort((a, b) => a - b);
    }
    return [maxHeightRatio];
  }, [snapPoints, maxHeightRatio]);

  const topRatio = resolvedSnapRatios[resolvedSnapRatios.length - 1] ?? maxHeightRatio;
  const maxSheetHeight = height * topRatio;

  // Each snap point's translateY offset relative to the fully expanded top position (0 = fully expanded)
  const snapOffsets = useMemo(
    () => resolvedSnapRatios.map((r) => Math.max(0, (topRatio - r) * height)),
    [resolvedSnapRatios, topRatio, height]
  );

  const defaultSnapIdx =
    initialSnapIndex !== undefined
      ? Math.min(Math.max(0, initialSnapIndex), snapOffsets.length - 1)
      : snapOffsets.length - 1;

  const translateY = useSharedValue(height);
  const dragStartY = useSharedValue(0);
  const activeSnapIdx = useSharedValue(defaultSnapIdx);

  const finishClose = useCallback(() => {
    setModalRendered(false);
    onClose();
  }, [onClose]);

  const triggerDismissHaptic = useCallback(() => {
    haptics.light();
  }, []);

  const triggerSnapHaptic = useCallback(() => {
    haptics.selection();
  }, []);

  // Animate sheet presentation and dismissal on `visible` change
  useEffect(() => {
    const initialOffset = snapOffsets[defaultSnapIdx] ?? 0;
    if (visible) {
      setModalRendered(true);
      activeSnapIdx.value = defaultSnapIdx;
      translateY.value = height;
      if (reducedMotion) {
        translateY.value = initialOffset;
      } else {
        translateY.value = withSpring(initialOffset, SPRING_CONFIG);
      }
    } else if (modalRendered) {
      if (reducedMotion) {
        setModalRendered(false);
      } else {
        translateY.value = withTiming(
          height,
          {
            duration: 210,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          },
          (finished) => {
            if (finished) {
              runOnJS(setModalRendered)(false);
            }
          }
        );
      }
    }
  }, [visible, height, reducedMotion, defaultSnapIdx, snapOffsets, translateY, activeSnapIdx, modalRendered]);

  // Smooth programmatic dismiss
  const animateDismiss = useCallback(() => {
    haptics.light();
    if (reducedMotion) {
      onClose();
    } else {
      translateY.value = withTiming(
        height,
        {
          duration: 200,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
        (finished) => {
          if (finished) {
            runOnJS(finishClose)();
          }
        }
      );
    }
  }, [reducedMotion, height, onClose, finishClose, translateY]);

  // UI-thread Pan Gesture on top handle & header
  const headerPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-4, 4])
        .onBegin(() => {
          dragStartY.value = translateY.value;
          runOnJS(setIsDragging)(true);
          runOnJS(triggerSnapHaptic)();
        })
        .onUpdate((event) => {
          const rawY = dragStartY.value + event.translationY;
          if (rawY < 0) {
            // Rubberband resistance when pulling upward above highest snap point
            translateY.value = rawY * 0.22;
          } else {
            translateY.value = rawY;
          }
        })
        .onEnd((event) => {
          runOnJS(setIsDragging)(false);
          const currentY = translateY.value;
          const vy = event.velocityY;
          const lowestSnapOffset = snapOffsets[0] ?? 0;

          // Dismiss if dragged well below lowest snap point or flicked downward rapidly
          if (
            currentY > lowestSnapOffset + 105 ||
            (vy > 750 && currentY > lowestSnapOffset + 24)
          ) {
            runOnJS(triggerDismissHaptic)();
            if (reducedMotion) {
              runOnJS(finishClose)();
            } else {
              translateY.value = withTiming(
                height,
                {
                  duration: 195,
                  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                },
                (finished) => {
                  if (finished) {
                    runOnJS(finishClose)();
                  }
                }
              );
            }
            return;
          }

          // Multi-snap point resolution (supports upward expansion & downward snap)
          const projectedY = currentY + vy * 0.12;
          let bestIdx = 0;
          let bestDist = Math.abs(projectedY - (snapOffsets[0] ?? 0));

          for (let i = 1; i < snapOffsets.length; i++) {
            const dist = Math.abs(projectedY - (snapOffsets[i] ?? 0));
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = i;
            }
          }

          if (bestIdx !== activeSnapIdx.value) {
            activeSnapIdx.value = bestIdx;
            runOnJS(triggerSnapHaptic)();
          }

          const targetOffset = snapOffsets[bestIdx] ?? 0;
          if (reducedMotion) {
            translateY.value = targetOffset;
          } else {
            translateY.value = withSpring(targetOffset, SPRING_CONFIG);
          }
        })
        .onFinalize(() => {
          runOnJS(setIsDragging)(false);
        }),
    [
      dragStartY,
      translateY,
      snapOffsets,
      activeSnapIdx,
      reducedMotion,
      height,
      triggerSnapHaptic,
      triggerDismissHaptic,
      finishClose,
    ]
  );

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!modalRendered) return null;

  return (
    <Modal
      visible={modalRendered}
      transparent
      animationType="none"
      onRequestClose={animateDismiss}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        {/* Transparent Backdrop: Zero dark/gray dim overlay, blocks accidental background touches */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdropPress ? animateDismiss : undefined}
          accessibilityRole="button"
          accessibilityLabel="Dismiss sheet"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
          style={styles.keyboardAvoidingWrap}
        >
          {/* Sliding Bottom-Anchored Sheet */}
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: isDark ? "#121214" : palette.background,
                borderColor: isDark ? "#27272A" : palette.border,
                maxHeight: maxSheetHeight,
                paddingBottom: Math.max(insets.bottom, 16),
              },
              animatedSheetStyle,
              sheetStyle,
            ]}
          >
            {/* Solid Bottom Extension Fill: Guarantees zero bottom gap during spring or upward pull */}
            <View
              style={[
                styles.bottomExtensionFill,
                { backgroundColor: isDark ? "#121214" : palette.background },
              ]}
            />

            {/* Interactive Top Handle & Header Region (Draggable Up/Down) */}
            <GestureDetector gesture={headerPanGesture}>
              <Animated.View style={styles.draggableHeaderZone}>
                {showHandle ? <SheetHandle active={isDragging} /> : null}

                {(title || showCloseButton || headerRight) && (
                  <View
                    style={[
                      styles.header,
                      { borderBottomColor: isDark ? "#27272A" : palette.border },
                    ]}
                  >
                    <View style={styles.headerTitleWrap}>
                      {title ? (
                        <Text
                          style={[styles.title, { color: palette.text }]}
                          numberOfLines={1}
                        >
                          {title}
                        </Text>
                      ) : null}
                      {subtitle ? (
                        <Text
                          style={[styles.subtitle, { color: palette.subtext }]}
                          numberOfLines={1}
                        >
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.headerRightActions}>
                      {headerRight}

                      {showCloseButton ? (
                        <Pressable
                          onPress={animateDismiss}
                          style={[
                            styles.closeBtn,
                            {
                              backgroundColor: isDark
                                ? "#27272A"
                                : palette.surfaceMuted,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Close sheet"
                          hitSlop={8}
                        >
                          <X size={18} color={palette.text} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                )}
              </Animated.View>
            </GestureDetector>

            {/* Scrollable / Flexible Sheet Content */}
            <View style={[styles.content, contentStyle]}>{children}</View>

            {/* Optional Sheet Footer (e.g., Primary Action Button) */}
            {footer ? (
              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: isDark ? "#27272A" : palette.border,
                  },
                ]}
              >
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
    zIndex: 999,
  },
  keyboardAvoidingWrap: {
    width: "100%",
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 20,
    overflow: "visible",
  },
  bottomExtensionFill: {
    position: "absolute",
    bottom: -500,
    left: 0,
    right: 0,
    height: 500,
  },
  draggableHeaderZone: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexShrink: 1,
    width: "100%",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

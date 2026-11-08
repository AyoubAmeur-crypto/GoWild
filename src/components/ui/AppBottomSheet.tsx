import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
  Easing,
  PanResponder,
} from "react-native";
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
}

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
}) => {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { palette, isDark } = useAppTheme();
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const [modalRendered, setModalRendered] = useState(visible);
  const [isDragging, setIsDragging] = useState(false);
  const translateY = useRef(new Animated.Value(height)).current;
  const currentDragY = useRef(0);

  // Animate sheet presentation and dismissal
  useEffect(() => {
    if (visible) {
      setModalRendered(true);
      translateY.setValue(height);
      if (reducedMotion) {
        translateY.setValue(0);
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 28,
          stiffness: 260,
          mass: 0.85,
        }).start();
      }
    } else {
      if (reducedMotion) {
        setModalRendered(false);
      } else {
        Animated.timing(translateY, {
          toValue: height,
          duration: 220,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            setModalRendered(false);
          }
        });
      }
    }
  }, [visible, height, translateY, reducedMotion]);

  // Smooth dismiss with animation
  const animateDismiss = () => {
    haptics.light();
    if (reducedMotion) {
      onClose();
    } else {
      Animated.timing(translateY, {
        toValue: height,
        duration: 200,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onClose();
        }
      });
    }
  };

  // Interactive PanResponder on handle & header
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        haptics.selection();
      },
      onPanResponderMove: (_, gestureState) => {
        const dy = gestureState.dy;
        currentDragY.current = dy;
        if (dy > 0) {
          // Linear downward tracking
          translateY.setValue(dy);
        } else {
          // Rubberband resistance when pulling upward past top
          translateY.setValue(dy * 0.2);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsDragging(false);
        const { dy, vy } = gestureState;

        // Dismiss if dragged down more than 100px or flicked down rapidly
        if (dy > 110 || vy > 0.75) {
          animateDismiss();
        } else {
          // Smooth spring back to top snap position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 24,
            stiffness: 280,
            mass: 0.8,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 24,
          stiffness: 280,
        }).start();
      },
    })
  ).current;

  if (!modalRendered) return null;

  const maxSheetHeight = height * maxHeightRatio;

  return (
    <Modal
      visible={modalRendered}
      transparent
      animationType="none"
      onRequestClose={animateDismiss}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        {/* Transparent Backdrop: Zero dark/gray overlay per requirement, blocks touches to page */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissOnBackdropPress ? animateDismiss : undefined}
          accessibilityRole="button"
          accessibilityLabel="Dismiss sheet"
        />

        {/* Sliding Bottom-Anchored Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? "#121214" : palette.background,
              borderColor: isDark ? "#27272A" : palette.border,
              maxHeight: maxSheetHeight,
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY }],
            },
            sheetStyle,
          ]}
        >
          {/* Solid Bottom Extension Fill: Prevents any background peeking through the bottom */}
          <View
            style={[
              styles.bottomExtensionFill,
              { backgroundColor: isDark ? "#121214" : palette.background },
            ]}
          />

          {/* Interactive Top Handle & Header Region (Draggable) */}
          <View {...panResponder.panHandlers} style={styles.draggableHeaderZone}>
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
          </View>

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
      </View>
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
    bottom: -400,
    left: 0,
    right: 0,
    height: 400,
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

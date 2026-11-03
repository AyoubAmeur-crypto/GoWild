import React from "react";
import {
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Colors } from "../../theme/tokens";
import { GlassSurface } from "./GlassSurface";

interface GlassButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  intensity?: number;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  style,
  labelStyle,
  intensity = 40,
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.touchable,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
    >
      <GlassSurface
        intensity={intensity}
        borderRadius={16}
        bordered
        style={styles.surface}
      >
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <>
              {icon && <View style={styles.iconWrapper}>{icon}</View>}
              <Text style={[styles.label, labelStyle]}>{label}</Text>
            </>
          )}
        </View>
      </GlassSurface>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  touchable: {
    borderRadius: 16,
  },
  surface: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  iconWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
});

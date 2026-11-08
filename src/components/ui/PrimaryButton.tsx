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
import { Shadows } from "../../theme/tokens";
import { useAppTheme } from "../../theme/useAppTheme";
import { haptics } from "../../lib/haptics";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  disabledReason,
  testID,
  style,
  labelStyle,
}) => {
  const { palette } = useAppTheme();

  const backgroundByVariant: Record<
    NonNullable<PrimaryButtonProps["variant"]>,
    string
  > = {
    primary: palette.primary,
    secondary: palette.primaryTint,
    danger: palette.dangerTint,
    ghost: "transparent",
  };

  const textByVariant: Record<
    NonNullable<PrimaryButtonProps["variant"]>,
    string
  > = {
    primary: "#FFFFFF",
    secondary: palette.primary,
    danger: palette.danger,
    ghost: palette.text,
  };

  const handlePress = () => {
    if (disabled || loading) return;
    haptics.medium();
    onPress();
  };

  return (
    <View>
      <Pressable
        testID={testID}
        onPress={handlePress}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: backgroundByVariant[variant] },
          variant === "primary" && !disabled && Shadows.ctaButton,
          variant === "ghost" && {
            borderWidth: 1,
            borderColor: palette.border,
          },
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textByVariant[variant]} />
        ) : (
          <View style={styles.content}>
            <Text
              style={[
                styles.label,
                { color: textByVariant[variant] },
                labelStyle,
              ]}
            >
              {label}
            </Text>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
          </View>
        )}
      </Pressable>
      {disabled && disabledReason ? (
        <Text style={[styles.disabledHint, { color: palette.subtext }]}>
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.48,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  disabledHint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },
});

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SearchX } from "lucide-react-native";
import { useAppTheme } from "../../theme/useAppTheme";
import { PrimaryButton } from "./PrimaryButton";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}) => {
  const { palette } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: palette.primaryTint },
        ]}
      >
        {icon ?? <SearchX size={28} color={palette.primary} />}
      </View>
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      <Text style={[styles.description, { color: palette.subtext }]}>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <PrimaryButton
          label={actionLabel}
          onPress={onAction}
          style={styles.button}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 300,
  },
  button: {
    marginTop: 8,
    minWidth: 180,
  },
});


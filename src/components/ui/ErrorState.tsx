import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { AlertCircle, WifiOff, Clock } from "lucide-react-native";
import { useAppTheme } from "../../theme/useAppTheme";
import { PrimaryButton } from "./PrimaryButton";
import { ApiClientError } from "../../services/http/apiClient";

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  title,
  onRetry,
  retryLabel = "Try Again",
}) => {
  const { palette } = useAppTheme();

  const apiErr = error instanceof ApiClientError ? error : null;
  const isOffline = Boolean(apiErr?.isNetworkError);
  const isExpired =
    apiErr?.code === "OFFER_EXPIRED" || apiErr?.code === "OFFER_SOLD_OUT";

  const resolvedTitle =
    title ??
    (isOffline
      ? "Connection Unavailable"
      : isExpired
        ? "Rate Availability Updated"
        : apiErr?.code === "PROVIDER_NOT_CONFIGURED"
          ? "Hotel Supplier Credentials Needed"
          : "Unable to Complete Request");

  const resolvedMessage =
    apiErr?.message ??
    (error instanceof Error
      ? error.message
      : "An unexpected issue occurred while communicating with the hotel service.");

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: isExpired ? palette.warning : palette.border,
        },
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: isExpired
              ? palette.warningTint
              : palette.dangerTint,
          },
        ]}
      >
        {isOffline ? (
          <WifiOff size={26} color={palette.danger} />
        ) : isExpired ? (
          <Clock size={26} color={palette.warning} />
        ) : (
          <AlertCircle size={26} color={palette.danger} />
        )}
      </View>

      <Text style={[styles.title, { color: palette.text }]}>{resolvedTitle}</Text>
      <Text style={[styles.message, { color: palette.subtext }]}>
        {resolvedMessage}
      </Text>

      {apiErr?.code ? (
        <View
          style={[
            styles.codeBadge,
            { backgroundColor: palette.surfaceMuted },
          ]}
        >
          <Text style={[styles.codeText, { color: palette.muted }]}>
            Code: {apiErr.code}
          </Text>
        </View>
      ) : null}

      {onRetry ? (
        <PrimaryButton
          label={retryLabel}
          onPress={onRetry}
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
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  codeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  codeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  button: {
    marginTop: 8,
    minWidth: 160,
  },
});


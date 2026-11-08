import React from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { ErrorState } from "../../../components/ui/ErrorState";
import { GoogleGLogo } from "../../../components/ui/PaymentLogos";
import { useGoogleLoginMutation } from "../hooks/useAuthActions";

export function GoogleSignInButton() {
  const mutation = useGoogleLoginMutation();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <PrimaryButton
        label="Continue with Google"
        variant="ghost"
        icon={<GoogleGLogo size={18} />}
        loading={mutation.isPending}
        onPress={() =>
          mutation.mutate(undefined, {
            onSuccess: () => router.replace("/(tabs)"),
          })
        }
      />
      {mutation.error ? <ErrorState error={mutation.error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
});

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { ArrowLeft, Eye, EyeOff } from "lucide-react-native";
import { AuthLoginSchema, type AuthLoginInput } from "../../../lib/validation";
import { createZodFormResolver } from "../../../lib/formResolver";
import { useAppTheme } from "../../../theme/useAppTheme";
import { BrandLogo } from "../../../components/ui/BrandLogo";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { ErrorState } from "../../../components/ui/ErrorState";
import { useLoginMutation } from "../hooks/useAuthActions";

export const SignInScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useLoginMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthLoginInput>({
    resolver: createZodFormResolver(AuthLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: AuthLoginInput) => {
    loginMutation.mutate(values, {
      onSuccess: () => {
        router.replace("/(tabs)");
      },
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { backgroundColor: palette.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 12, 24),
            paddingBottom: Math.max(insets.bottom + 24, 36),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={19} color={palette.text} />
        </Pressable>

        <View style={styles.brandBlock}>
          <BrandLogo height={34} />
          <Text style={[styles.title, { color: palette.text }]}>
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Sign in to access your goWild reservations, saved stays, and
            traveler preferences.
          </Text>
        </View>

        <View
          style={[
            styles.formCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={styles.field}>
            <Text style={[styles.label, { color: palette.subtext }]}>
              Email Address
            </Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder="traveler@example.com"
                  placeholderTextColor={palette.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surfaceMuted,
                      borderColor: errors.email
                        ? palette.danger
                        : palette.border,
                      color: palette.text,
                    },
                  ]}
                />
              )}
            />
            {errors.email ? (
              <Text style={[styles.err, { color: palette.danger }]}>
                {errors.email.message}
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: palette.subtext }]}>
              Password
            </Text>
            <View style={styles.pwRow}>
              <Controller
                control={control}
                name="password"
                render={({ field: { value, onChange } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Enter your password"
                    placeholderTextColor={palette.muted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    style={[
                      styles.input,
                      styles.pwInput,
                      {
                        backgroundColor: palette.surfaceMuted,
                        borderColor: errors.password
                          ? palette.danger
                          : palette.border,
                        color: palette.text,
                      },
                    ]}
                  />
                )}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeBtn}
                accessibilityRole="button"
                accessibilityLabel="Toggle password visibility"
              >
                {showPassword ? (
                  <EyeOff size={18} color={palette.subtext} />
                ) : (
                  <Eye size={18} color={palette.subtext} />
                )}
              </Pressable>
            </View>
            {errors.password ? (
              <Text style={[styles.err, { color: palette.danger }]}>
                {errors.password.message}
              </Text>
            ) : null}
          </View>

          {loginMutation.error ? (
            <ErrorState error={loginMutation.error} />
          ) : null}

          <PrimaryButton
            label="Sign In"
            loading={loginMutation.isPending}
            onPress={handleSubmit(onSubmit)}
          />
        </View>

        <Pressable
          onPress={() => router.replace("/auth/sign-up")}
          style={styles.switchLink}
          accessibilityRole="button"
        >
          <Text style={[styles.switchText, { color: palette.subtext }]}>
            New to goWild?{" "}
            <Text style={{ color: palette.primary, fontWeight: "700" }}>
              Create an Account
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 22,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brandBlock: {
    alignItems: "flex-start",
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  pwRow: {
    position: "relative",
    justifyContent: "center",
  },
  pwInput: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
  },
  err: {
    fontSize: 11,
    fontWeight: "600",
  },
  switchLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  switchText: {
    fontSize: 14,
  },
});


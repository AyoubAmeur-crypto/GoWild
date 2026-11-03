import React from "react";
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
import { ArrowLeft } from "lucide-react-native";
import {
  AuthRegisterSchema,
  type AuthRegisterInput,
} from "../../../lib/validation";
import { createZodFormResolver } from "../../../lib/formResolver";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { BrandLogo } from "../../../components/ui/BrandLogo";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { ErrorState } from "../../../components/ui/ErrorState";
import { useRegisterMutation } from "../hooks/useAuthActions";

export const SignUpScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const currency = useSettingsStore((s) => s.currency);
  const language = useSettingsStore((s) => s.language);

  const registerMutation = useRegisterMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthRegisterInput>({
    resolver: createZodFormResolver(AuthRegisterSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      preferredCurrency: currency,
      preferredLanguage: language,
    },
  });

  const onSubmit = (values: AuthRegisterInput) => {
    registerMutation.mutate(
      {
        ...values,
        preferredCurrency: currency,
        preferredLanguage: language,
      },
      {
        onSuccess: () => {
          router.replace("/(tabs)");
        },
      }
    );
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
          <BrandLogo height={32} />
          <Text style={[styles.title, { color: palette.text }]}>
            Create Traveler Account
          </Text>
          <Text style={[styles.subtitle, { color: palette.subtext }]}>
            Save your guest profile for faster checkouts and sync hotel bookings
            across devices.
          </Text>
        </View>

        <View
          style={[
            styles.formCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          {(
            [
              {
                name: "firstName",
                label: "First Name",
                placeholder: "Elena",
                keyboardType: "default",
                secure: false,
              },
              {
                name: "lastName",
                label: "Last Name",
                placeholder: "Rostova",
                keyboardType: "default",
                secure: false,
              },
              {
                name: "email",
                label: "Email Address",
                placeholder: "traveler@example.com",
                keyboardType: "email-address",
                secure: false,
              },
              {
                name: "phone",
                label: "Phone Number",
                placeholder: "+1 415 555 0140",
                keyboardType: "phone-pad",
                secure: false,
              },
              {
                name: "password",
                label: "Password (8+ characters)",
                placeholder: "Minimum 8 characters",
                keyboardType: "default",
                secure: true,
              },
            ] as const
          ).map((f) => (
            <View key={f.name} style={styles.field}>
              <Text style={[styles.label, { color: palette.subtext }]}>
                {f.label}
              </Text>
              <Controller
                control={control}
                name={f.name}
                render={({ field: { value, onChange } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder={f.placeholder}
                    placeholderTextColor={palette.muted}
                    keyboardType={f.keyboardType}
                    secureTextEntry={f.secure}
                    autoCapitalize={
                      f.name === "email" || f.name === "password"
                        ? "none"
                        : "words"
                    }
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.surfaceMuted,
                        borderColor: errors[f.name]
                          ? palette.danger
                          : palette.border,
                        color: palette.text,
                      },
                    ]}
                  />
                )}
              />
              {errors[f.name] ? (
                <Text style={[styles.err, { color: palette.danger }]}>
                  {errors[f.name]?.message}
                </Text>
              ) : null}
            </View>
          ))}

          {registerMutation.error ? (
            <ErrorState error={registerMutation.error} />
          ) : null}

          <PrimaryButton
            label="Create Account"
            loading={registerMutation.isPending}
            onPress={handleSubmit(onSubmit)}
          />
        </View>

        <Pressable
          onPress={() => router.replace("/auth/sign-in")}
          style={styles.switchLink}
        >
          <Text style={[styles.switchText, { color: palette.subtext }]}>
            Already registered?{" "}
            <Text style={{ color: palette.primary, fontWeight: "700" }}>
              Sign In
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
    gap: 20,
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
    gap: 6,
  },
  title: {
    fontSize: 24,
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
    gap: 14,
  },
  field: {
    gap: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
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


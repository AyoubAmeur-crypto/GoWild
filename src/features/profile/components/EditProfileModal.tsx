import React, { useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import type { AuthenticatedUser } from "../../../types/domain";
import { createZodFormResolver } from "../../../lib/formResolver";
import { useAppTheme } from "../../../theme/useAppTheme";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { AppBottomSheet } from "../../../components/ui/AppBottomSheet";

const EditTravelerSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters"),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,20}$/, "Enter a valid phone number"),
  nationality: z
    .string()
    .trim()
    .max(2, "Use 2-letter country code (e.g. US, FR)")
    .optional(),
});

type EditTravelerValues = z.infer<typeof EditTravelerSchema>;

interface EditProfileModalProps {
  visible: boolean;
  user: AuthenticatedUser;
  loading?: boolean;
  onClose: () => void;
  onSave: (values: EditTravelerValues) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  user,
  loading = false,
  onClose,
  onSave,
}) => {
  const { palette } = useAppTheme();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditTravelerValues>({
    resolver: createZodFormResolver(EditTravelerSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      nationality: user.nationality ?? "",
    },
  });

  useEffect(() => {
    if (visible) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        nationality: user.nationality ?? "",
      });
    }
  }, [visible, user, reset]);

  return (
    <AppBottomSheet
      visible={visible}
      title="Edit Traveler Details"
      onClose={onClose}
      footer={
        <PrimaryButton
          label="Save Changes"
          loading={loading}
          onPress={handleSubmit((vals) =>
            onSave({
              ...vals,
              nationality:
                vals.nationality && vals.nationality.trim().length === 2
                  ? vals.nationality.trim().toUpperCase()
                  : undefined,
            })
          )}
        />
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardWrap}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.fields}>
            {(
              [
                { name: "firstName", label: "First Name", placeholder: "Elena" },
                { name: "lastName", label: "Last Name", placeholder: "Rostova" },
                {
                  name: "phone",
                  label: "Phone Number",
                  placeholder: "+1 415 555 0140",
                },
                {
                  name: "nationality",
                  label: "Nationality (ISO-2)",
                  placeholder: "US",
                },
              ] as const
            ).map((fieldDef) => (
              <View key={fieldDef.name} style={styles.fieldGroup}>
                <Text style={[styles.label, { color: palette.subtext }]}>
                  {fieldDef.label}
                </Text>
                <Controller
                  control={control}
                  name={fieldDef.name}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value ?? ""}
                      onChangeText={onChange}
                      placeholder={fieldDef.placeholder}
                      placeholderTextColor={palette.muted}
                      style={[
                        styles.input,
                        {
                          backgroundColor: palette.surface,
                          borderColor: errors[fieldDef.name]
                            ? palette.danger
                            : palette.border,
                          color: palette.text,
                        },
                      ]}
                    />
                  )}
                />
                {errors[fieldDef.name] ? (
                  <Text style={[styles.error, { color: palette.danger }]}>
                    {errors[fieldDef.name]?.message}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBottomSheet>
  );
};

const styles = StyleSheet.create({
  keyboardWrap: {
    width: "100%",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  fields: {
    gap: 12,
  },
  fieldGroup: {
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
  error: {
    fontSize: 11,
    fontWeight: "600",
  },
});



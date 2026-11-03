import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import {
  ArrowLeft,
  ShieldCheck,
  Lock,
  CheckSquare,
  Square,
  AlertTriangle,
  RefreshCw,
} from "lucide-react-native";
import type { RevalidatedOffer } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSearchStore } from "../../../stores/useSearchStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useAuthStore } from "../../../stores/useAuthStore";
import { createZodFormResolver } from "../../../lib/formResolver";
import { formatDateRangeShort, formatMoney } from "../../../lib/pricing";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { Skeleton } from "../../../components/ui/Skeleton";
import { ErrorState } from "../../../components/ui/ErrorState";
import { useHotelDetail } from "../../hotels/hooks/useHotels";
import { useRevalidateOffer } from "../../availability/hooks/useRoomOffers";
import { PriceBreakdownCard } from "../../availability/components/PriceBreakdownCard";
import { useCreateBooking } from "../hooks/useBookings";

const CheckoutFormSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Last name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,20}$/, "Enter a valid phone (e.g. +1 415 555 0190)"),
  specialRequests: z.string().trim().max(500).optional(),
  acceptedPolicies: z.boolean().refine((v) => v === true, {
    message: "Please accept the cancellation and property rules to continue",
  }),
});

type CheckoutFormValues = z.infer<typeof CheckoutFormSchema>;

function generateIdempotencyKey(): string {
  return `idem_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

interface BookingReviewScreenProps {
  hotelId: string;
  offerId: string;
}

export const BookingReviewScreen: React.FC<BookingReviewScreenProps> = ({
  hotelId,
  offerId,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();

  const checkIn = useSearchStore((s) => s.checkIn);
  const checkOut = useSearchStore((s) => s.checkOut);
  const occupancy = useSearchStore((s) => s.occupancy);
  const currency = useSettingsStore((s) => s.currency);
  const user = useAuthStore((s) => s.user);

  const [revalidated, setRevalidated] = useState<RevalidatedOffer | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    generateIdempotencyKey()
  );

  const hotelQuery = useHotelDetail(hotelId);
  const revalidateMutation = useRevalidateOffer();
  const createBookingMutation = useCreateBooking();

  const runRevalidation = () => {
    if (!hotelId || !offerId) return;
    revalidateMutation.mutate(
      {
        hotelId,
        offerId,
        checkIn,
        checkOut,
        occupancy,
      },
      {
        onSuccess: (res) => {
          setRevalidated(res.revalidated);
          setIdempotencyKey(generateIdempotencyKey());
        },
      }
    );
  };

  useEffect(() => {
    runRevalidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, offerId, checkIn, checkOut, currency]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: createZodFormResolver(CheckoutFormSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      specialRequests: "",
      acceptedPolicies: false,
    },
  });

  const onSubmit = (values: CheckoutFormValues) => {
    if (!revalidated) return;
    createBookingMutation.mutate(
      {
        idempotencyKey,
        input: {
          quoteId: revalidated.quoteId,
          offerId: revalidated.offer.offerId,
          hotelId,
          checkIn,
          checkOut,
          occupancy,
          currency: revalidated.offer.price.currency,
          leadGuest: {
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            email: values.email.trim(),
            phone: values.phone.trim(),
            nationality: user?.nationality,
          },
          specialRequests: values.specialRequests?.trim() || undefined,
          acceptedPolicies: true,
        },
      },
      {
        onSuccess: async ({ booking }) => {
          if (booking.isExternalHandoff && booking.externalCheckoutUrl) {
            await WebBrowser.openBrowserAsync(
              booking.externalCheckoutUrl
            ).catch(() => {});
          }
          router.replace(`/booking/confirmation/${booking.id}`);
        },
      }
    );
  };

  const hotel = hotelQuery.data?.hotel;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.root, { backgroundColor: palette.background }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top + 8, 18),
            borderBottomColor: palette.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.circleBtn,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Back to hotel details"
        >
          <ArrowLeft size={19} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          Review & Reserve
        </Text>
        <Pressable
          onPress={runRevalidation}
          style={[
            styles.circleBtn,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Revalidate live room offer"
        >
          <RefreshCw size={17} color={palette.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 30, 44) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {revalidateMutation.isPending && !revalidated ? (
          <View style={styles.gapBlock}>
            <Skeleton height={120} borderRadius={18} />
            <Skeleton height={180} borderRadius={18} />
            <Skeleton height={240} borderRadius={18} />
          </View>
        ) : revalidateMutation.error ? (
          <ErrorState
            error={revalidateMutation.error}
            retryLabel="Return to Room Selection"
            onRetry={() => router.back()}
          />
        ) : revalidated ? (
          <>
            {/* Price Change Alert Banner */}
            {revalidated.priceChanged && revalidated.previousTotal ? (
              <View
                style={[
                  styles.alertBox,
                  {
                    backgroundColor: palette.warningTint,
                    borderColor: palette.warning,
                  },
                ]}
              >
                <AlertTriangle size={18} color={palette.warning} />
                <Text style={[styles.alertText, { color: palette.text }]}>
                  Supplier rate updated from{" "}
                  {formatMoney(
                    revalidated.previousTotal,
                    revalidated.offer.price.currency
                  )}{" "}
                  to{" "}
                  {formatMoney(
                    revalidated.offer.price.total,
                    revalidated.offer.price.currency
                  )}{" "}
                  during live revalidation.
                </Text>
              </View>
            ) : null}

            {/* Hotel & Room Summary Card */}
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <View style={styles.summaryTop}>
                {hotel?.images[0]?.url ? (
                  <Image
                    source={{ uri: hotel.images[0].url }}
                    style={styles.hotelThumb}
                    contentFit="cover"
                  />
                ) : null}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={[styles.summaryHotel, { color: palette.text }]}
                    numberOfLines={1}
                  >
                    {hotel?.name ?? "Selected Property"}
                  </Text>
                  <Text
                    style={[styles.summaryRoom, { color: palette.primary }]}
                  >
                    {revalidated.offer.roomName}
                  </Text>
                  <Text
                    style={[styles.summaryMeta, { color: palette.subtext }]}
                  >
                    {revalidated.offer.ratePlan.boardLabel} ·{" "}
                    {revalidated.offer.bedSummary}
                  </Text>
                </View>
              </View>

              <View
                style={[styles.divider, { backgroundColor: palette.border }]}
              />

              <View style={styles.datesSummaryGrid}>
                <View>
                  <Text style={[styles.gridCap, { color: palette.muted }]}>
                    DATES
                  </Text>
                  <Text style={[styles.gridVal, { color: palette.text }]}>
                    {formatDateRangeShort(checkIn, checkOut)} (
                    {revalidated.offer.price.nights} nights)
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.gridCap, { color: palette.muted }]}>
                    OCCUPANCY
                  </Text>
                  <Text style={[styles.gridVal, { color: palette.text }]}>
                    {occupancy.rooms} rm · {occupancy.adults} adults
                    {occupancy.childrenAges.length > 0
                      ? `, ${occupancy.childrenAges.length} ch`
                      : ""}
                  </Text>
                </View>
              </View>
            </View>

            {/* Lead Traveler Form */}
            <View
              style={[
                styles.formCard,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                Lead Traveler Information
              </Text>

              {(
                [
                  {
                    name: "firstName",
                    label: "First Name",
                    placeholder: "As shown on government ID",
                    keyboardType: "default",
                  },
                  {
                    name: "lastName",
                    label: "Last Name",
                    placeholder: "Surname",
                    keyboardType: "default",
                  },
                  {
                    name: "email",
                    label: "Confirmation Email",
                    placeholder: "traveler@example.com",
                    keyboardType: "email-address",
                  },
                  {
                    name: "phone",
                    label: "Mobile Phone",
                    placeholder: "+1 415 555 0190",
                    keyboardType: "phone-pad",
                  },
                ] as const
              ).map((f) => (
                <View key={f.name} style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: palette.subtext }]}>
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
                        autoCapitalize={
                          f.name === "email" ? "none" : "words"
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
                    <Text style={[styles.fieldErr, { color: palette.danger }]}>
                      {errors[f.name]?.message}
                    </Text>
                  ) : null}
                </View>
              ))}

              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: palette.subtext }]}>
                  Special Requests (Optional)
                </Text>
                <Controller
                  control={control}
                  name="specialRequests"
                  render={({ field: { value, onChange } }) => (
                    <TextInput
                      value={value ?? ""}
                      onChangeText={onChange}
                      placeholder="High floor, late check-in, quiet room..."
                      placeholderTextColor={palette.muted}
                      multiline
                      style={[
                        styles.textArea,
                        {
                          backgroundColor: palette.surfaceMuted,
                          borderColor: palette.border,
                          color: palette.text,
                        },
                      ]}
                    />
                  )}
                />
              </View>
            </View>

            {/* Itemized Price Breakdown */}
            <PriceBreakdownCard
              price={revalidated.offer.price}
              providerLabel={revalidated.capabilities.displayName}
            />

            {/* Compliant Payment & Cancellation Disclosure */}
            <View
              style={[
                styles.complianceCard,
                {
                  backgroundColor: palette.surfaceMuted,
                  borderColor: palette.border,
                },
              ]}
            >
              <View style={styles.complianceHeader}>
                <Lock size={16} color={palette.primary} />
                <Text style={[styles.complianceTitle, { color: palette.text }]}>
                  {revalidated.checkoutMode === "provider_hosted_checkout"
                    ? "PCI-Compliant Provider Hosted Checkout"
                    : "Verified Sandbox Reservation Flow"}
                </Text>
              </View>
              <Text
                style={[styles.complianceDesc, { color: palette.subtext }]}
              >
                {revalidated.checkoutMode === "provider_hosted_checkout"
                  ? "goWild never collects raw card numbers in-app. Tapping Continue securely prebooks your quote and launches the supplier's hosted payment session."
                  : "No raw card details are collected. Confirming submits an idempotent reservation request against the active sandbox/fixture supplier."}
              </Text>

              <View style={styles.policyLine}>
                <ShieldCheck size={15} color={palette.success} />
                <Text style={[styles.policyLineText, { color: palette.text }]}>
                  {revalidated.offer.cancellationPolicy.summary}
                </Text>
              </View>

              <Controller
                control={control}
                name="acceptedPolicies"
                render={({ field: { value, onChange } }) => (
                  <Pressable
                    onPress={() => onChange(!value)}
                    style={styles.checkboxRow}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: value }}
                  >
                    {value ? (
                      <CheckSquare size={20} color={palette.primary} />
                    ) : (
                      <Square size={20} color={palette.muted} />
                    )}
                    <Text
                      style={[styles.checkboxLabel, { color: palette.text }]}
                    >
                      I agree to the cancellation policy, property check-in
                      rules, and total payable amount of{" "}
                      {formatMoney(
                        revalidated.offer.price.total,
                        revalidated.offer.price.currency
                      )}
                      .
                    </Text>
                  </Pressable>
                )}
              />
              {errors.acceptedPolicies ? (
                <Text style={[styles.fieldErr, { color: palette.danger }]}>
                  {errors.acceptedPolicies.message}
                </Text>
              ) : null}
            </View>

            {createBookingMutation.error ? (
              <ErrorState
                error={createBookingMutation.error}
                onRetry={runRevalidation}
                retryLabel="Revalidate Offer"
              />
            ) : null}

            <PrimaryButton
              label={
                revalidated.checkoutMode === "provider_hosted_checkout"
                  ? "Continue to Provider Checkout"
                  : `Confirm Reservation · ${formatMoney(
                      revalidated.offer.price.total,
                      revalidated.offer.price.currency
                    )}`
              }
              loading={createBookingMutation.isPending}
              onPress={handleSubmit(onSubmit)}
            />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  gapBlock: {
    gap: 16,
  },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  summaryTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  hotelThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#E9EBED",
  },
  summaryHotel: {
    fontSize: 16,
    fontWeight: "700",
  },
  summaryRoom: {
    fontSize: 14,
    fontWeight: "700",
  },
  summaryMeta: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    width: "100%",
  },
  datesSummaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gridCap: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  gridVal: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  fieldWrap: {
    gap: 5,
  },
  fieldLabel: {
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
  textArea: {
    minHeight: 74,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: "top",
  },
  fieldErr: {
    fontSize: 11,
    fontWeight: "600",
  },
  complianceCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  complianceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  complianceTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  complianceDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  policyLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  policyLineText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 4,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});


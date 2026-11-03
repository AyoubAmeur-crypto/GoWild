import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Star } from "lucide-react-native";
import type { PropertyType } from "../../../types/domain";
import type { SearchFilterState } from "../../../stores/useSearchStore";
import { useAppTheme } from "../../../theme/useAppTheme";
import { GlassSwitch } from "../../../components/ui/GlassSwitch";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { AmenityChip } from "../../../components/ui/AmenityChip";

interface FilterSheetProps {
  visible: boolean;
  initialFilters: SearchFilterState;
  onClose: () => void;
  onApply: (next: SearchFilterState) => void;
}

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "hotel", label: "Hotels" },
  { value: "resort", label: "Resorts" },
  { value: "villa", label: "Villas" },
  { value: "boutique", label: "Boutique" },
  { value: "apartment", label: "Suites & Apt" },
];

const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "Any Budget" },
  { label: "Under $300", max: 300 },
  { label: "$300 – $550", min: 300, max: 550 },
  { label: "$550+", min: 550 },
];

const FACILITY_FILTERS: { code: string; label: string }[] = [
  { code: "wifi", label: "Free Wi-Fi" },
  { code: "pool", label: "Pool" },
  { code: "spa", label: "Spa & Wellness" },
  { code: "breakfast", label: "Breakfast" },
  { code: "gym", label: "Fitness Studio" },
  { code: "concierge", label: "24h Concierge" },
];

export const FilterSheet: React.FC<FilterSheetProps> = ({
  visible,
  initialFilters,
  onClose,
  onApply,
}) => {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<SearchFilterState>(initialFilters);

  useEffect(() => {
    if (visible) {
      setDraft(initialFilters);
    }
  }, [visible, initialFilters]);

  const togglePropertyType = (type: PropertyType) => {
    setDraft((prev) => {
      const exists = prev.propertyTypes.includes(type);
      return {
        ...prev,
        propertyTypes: exists
          ? prev.propertyTypes.filter((t) => t !== type)
          : [...prev.propertyTypes, type],
      };
    });
  };

  const toggleAmenity = (code: string) => {
    setDraft((prev) => {
      const exists = prev.amenities.includes(code);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((a) => a !== code)
          : [...prev.amenities, code],
      };
    });
  };

  const resetAll = () => {
    setDraft({
      propertyTypes: [],
      amenities: [],
      freeCancellationOnly: false,
      instantConfirmationOnly: false,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.background,
              paddingBottom: Math.max(insets.bottom + 14, 24),
            },
          ]}
        >
          <View style={styles.handleBar} />

          <View
            style={[
              styles.header,
              { borderBottomColor: palette.border },
            ]}
          >
            <Pressable
              onPress={resetAll}
              accessibilityRole="button"
              accessibilityLabel="Reset filters"
            >
              <Text style={[styles.resetText, { color: palette.primary }]}>
                Reset
              </Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: palette.text }]}>
              Filter Stays
            </Text>
            <Pressable
              onPress={onClose}
              style={[
                styles.closeIcon,
                { backgroundColor: palette.surfaceMuted },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close filter modal"
            >
              <X size={18} color={palette.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Property Type */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Property Type
              </Text>
              <View style={styles.chipWrap}>
                {PROPERTY_TYPES.map((pt) => {
                  const active = draft.propertyTypes.includes(pt.value);
                  return (
                    <Pressable
                      key={pt.value}
                      onPress={() => togglePropertyType(pt.value)}
                      style={[
                        styles.choicePill,
                        {
                          backgroundColor: active
                            ? palette.primary
                            : palette.surfaceMuted,
                          borderColor: active
                            ? palette.primary
                            : palette.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          { color: active ? "#FFFFFF" : palette.text },
                        ]}
                      >
                        {pt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Nightly Budget */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Nightly Price Range
              </Text>
              <View style={styles.chipWrap}>
                {PRICE_PRESETS.map((preset) => {
                  const selected =
                    draft.minPrice === preset.min &&
                    draft.maxPrice === preset.max;
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() =>
                        setDraft((prev) => ({
                          ...prev,
                          minPrice: preset.min,
                          maxPrice: preset.max,
                        }))
                      }
                      style={[
                        styles.choicePill,
                        {
                          backgroundColor: selected
                            ? palette.primary
                            : palette.surfaceMuted,
                          borderColor: selected
                            ? palette.primary
                            : palette.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          { color: selected ? "#FFFFFF" : palette.text },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Minimum Star Rating */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Minimum Star Rating
              </Text>
              <View style={styles.starRow}>
                {[3, 4, 5].map((stars) => {
                  const active = draft.minStarRating === stars;
                  return (
                    <Pressable
                      key={stars}
                      onPress={() =>
                        setDraft((prev) => ({
                          ...prev,
                          minStarRating: active ? undefined : stars,
                        }))
                      }
                      style={[
                        styles.starPill,
                        {
                          backgroundColor: active
                            ? palette.primary
                            : palette.surfaceMuted,
                          borderColor: active
                            ? palette.primary
                            : palette.border,
                        },
                      ]}
                    >
                      <Star
                        size={14}
                        color={active ? "#FFFFFF" : palette.ratingGold}
                        fill={active ? "#FFFFFF" : palette.ratingGold}
                      />
                      <Text
                        style={[
                          styles.choiceText,
                          { color: active ? "#FFFFFF" : palette.text },
                        ]}
                      >
                        {stars}+ Stars
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Toggles */}
            <View
              style={[
                styles.toggleGroup,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabels}>
                  <Text style={[styles.toggleTitle, { color: palette.text }]}>
                    Free Cancellation
                  </Text>
                  <Text
                    style={[styles.toggleSubtitle, { color: palette.subtext }]}
                  >
                    Only show stays with refundable rate plans
                  </Text>
                </View>
                <GlassSwitch
                  value={draft.freeCancellationOnly}
                  onValueChange={(v) =>
                    setDraft((p) => ({ ...p, freeCancellationOnly: v }))
                  }
                  accessibilityLabel="Free cancellation only"
                />
              </View>

              <View
                style={[styles.divider, { backgroundColor: palette.border }]}
              />

              <View style={styles.toggleRow}>
                <View style={styles.toggleLabels}>
                  <Text style={[styles.toggleTitle, { color: palette.text }]}>
                    Instant Confirmation
                  </Text>
                  <Text
                    style={[styles.toggleSubtitle, { color: palette.subtext }]}
                  >
                    Immediate booking confirmation from supplier
                  </Text>
                </View>
                <GlassSwitch
                  value={draft.instantConfirmationOnly}
                  onValueChange={(v) =>
                    setDraft((p) => ({ ...p, instantConfirmationOnly: v }))
                  }
                  accessibilityLabel="Instant confirmation only"
                />
              </View>
            </View>

            {/* Facilities */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                Facilities & Amenities
              </Text>
              <View style={styles.chipWrap}>
                {FACILITY_FILTERS.map((fac) => (
                  <AmenityChip
                    key={fac.code}
                    code={fac.code}
                    label={fac.label}
                    selected={draft.amenities.includes(fac.code)}
                    onPress={() => toggleAmenity(fac.code)}
                  />
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton
              label="Apply Filters"
              onPress={() => {
                onApply(draft);
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(23, 23, 37, 0.52)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
  },
  handleBar: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  resetText: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  closeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 20,
    gap: 22,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choicePill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  choiceText: {
    fontSize: 13,
    fontWeight: "600",
  },
  starRow: {
    flexDirection: "row",
    gap: 10,
  },
  starPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleGroup: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleLabels: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  toggleSubtitle: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    width: "100%",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
});


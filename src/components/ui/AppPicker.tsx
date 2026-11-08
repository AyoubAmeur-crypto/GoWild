import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Check, Search, X } from "lucide-react-native";
import { AppBottomSheet } from "./AppBottomSheet";
import { HapticPressable } from "./HapticPressable";
import { PrimaryButton } from "./PrimaryButton";
import { useAppTheme } from "../../theme/useAppTheme";
import { haptics } from "../../lib/haptics";

export interface AppPickerOption<T = string> {
  id: T;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export interface AppPickerProps<T = string> {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: AppPickerOption<T>[];
  selectedId?: T;
  selectedIds?: T[];
  isMultiSelect?: boolean;
  onSelect: (id: T) => void;
  onSelectMulti?: (ids: T[]) => void;
  onClose: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  style?: StyleProp<ViewStyle>;
}

export function AppPicker<T extends string = string>({
  visible,
  title,
  subtitle,
  options,
  selectedId,
  selectedIds = [],
  isMultiSelect = false,
  onSelect,
  onSelectMulti,
  onClose,
  searchable = false,
  searchPlaceholder = "Search options…",
}: AppPickerProps<T>) {
  const { palette, isDark } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [draftMulti, setDraftMulti] = useState<T[]>(selectedIds);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const handleSelectSingle = (id: T) => {
    haptics.selection();
    onSelect(id);
    onClose();
  };

  const handleToggleMulti = (id: T) => {
    haptics.selection();
    setDraftMulti((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApplyMulti = () => {
    haptics.success();
    onSelectMulti?.(draftMulti);
    onClose();
  };

  return (
    <AppBottomSheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        isMultiSelect ? (
          <PrimaryButton
            label={`Apply (${draftMulti.length} selected)`}
            onPress={handleApplyMulti}
          />
        ) : undefined
      }
    >
      <View style={styles.container}>
        {searchable ? (
          <View
            style={[
              styles.searchWrap,
              {
                backgroundColor: isDark ? "#1C1C1E" : "#F4F5F7",
                borderColor: isDark ? "#2C2C2E" : "#E5E7EB",
              },
            ]}
          >
            <Search size={16} color={palette.subtext} />
            <TextInput
              style={[styles.searchInput, { color: palette.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={palette.subtext}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 ? (
              <HapticPressable
                onPress={() => setSearchQuery("")}
                haptic="light"
                style={styles.clearBtn}
              >
                <X size={14} color={palette.subtext} />
              </HapticPressable>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {filteredOptions.map((opt) => {
            const isSelected = isMultiSelect
              ? draftMulti.includes(opt.id)
              : selectedId === opt.id;

            return (
              <HapticPressable
                key={opt.id}
                onPress={() =>
                  isMultiSelect
                    ? handleToggleMulti(opt.id)
                    : handleSelectSingle(opt.id)
                }
                haptic="selection"
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? "rgba(64, 180, 248, 0.12)"
                        : "rgba(40, 83, 175, 0.08)"
                      : "transparent",
                    borderColor: isSelected
                      ? isDark
                        ? "rgba(64, 180, 248, 0.3)"
                        : "rgba(40, 83, 175, 0.2)"
                      : "transparent",
                  },
                ]}
              >
                {opt.icon ? <View style={styles.iconWrap}>{opt.icon}</View> : null}

                <View style={styles.optionMeta}>
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: isSelected ? palette.primary : palette.text,
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {opt.subtitle ? (
                    <Text
                      style={[styles.optionSub, { color: palette.subtext }]}
                    >
                      {opt.subtitle}
                    </Text>
                  ) : null}
                </View>

                {isSelected ? (
                  <View
                    style={[
                      styles.checkCircle,
                      { backgroundColor: palette.primary },
                    ]}
                  >
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.uncheckCircle,
                      { borderColor: isDark ? "#3F3F46" : "#D1D5DB" },
                    ]}
                  />
                )}
              </HapticPressable>
            );
          })}
        </ScrollView>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  listContent: {
    gap: 6,
    paddingVertical: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  optionMeta: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 15,
  },
  optionSub: {
    fontSize: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  uncheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
});


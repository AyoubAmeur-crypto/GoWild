import React from "react";
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
} from "react-native";
import { Search, SlidersHorizontal, X } from "lucide-react-native";
import { useAppTheme } from "../../theme/useAppTheme";

interface SearchBarProps {
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  onPress?: () => void;
  onFilterPress?: () => void;
  activeFilterCount?: number;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = "Search city, landmark, or hotel...",
  readOnly = false,
  onPress,
  onFilterPress,
  activeFilterCount = 0,
  autoFocus = false,
}) => {
  const { palette } = useAppTheme();

  const inner = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
      ]}
    >
      <Search size={18} color={palette.subtext} strokeWidth={2.1} />

      {readOnly ? (
        <Text
          style={[
            styles.readOnlyText,
            { color: value ? palette.text : palette.muted },
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          autoFocus={autoFocus}
          returnKeyType="search"
          style={[styles.input, { color: palette.text }]}
          accessibilityLabel="Search destination or hotel"
        />
      )}

      {!readOnly && value.length > 0 && onChangeText ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search input"
        >
          <X size={16} color={palette.muted} />
        </Pressable>
      ) : null}

      {onFilterPress ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onFilterPress();
          }}
          hitSlop={8}
          style={[
            styles.filterButton,
            {
              backgroundColor:
                activeFilterCount > 0 ? palette.primary : palette.surfaceMuted,
              borderColor: palette.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open search filters"
        >
          <SlidersHorizontal
            size={16}
            color={activeFilterCount > 0 ? "#FFFFFF" : palette.text}
          />
          {activeFilterCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );

  if (readOnly && onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="search"
        accessibilityLabel={value || placeholder}
      >
        {inner}
      </Pressable>
    );
  }

  return inner;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 28,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 8,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 8,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#F41F52",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});


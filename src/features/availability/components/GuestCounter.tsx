import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Minus, Plus } from "lucide-react-native";
import type { Occupancy } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";

interface GuestCounterProps {
  occupancy: Occupancy;
  onChange: (next: Occupancy) => void;
}

export const GuestCounter: React.FC<GuestCounterProps> = ({
  occupancy,
  onChange,
}) => {
  const { palette } = useAppTheme();

  const updateRooms = (delta: number) => {
    const rooms = Math.max(1, Math.min(8, occupancy.rooms + delta));
    const adults = Math.max(rooms, occupancy.adults);
    onChange({ ...occupancy, rooms, adults });
  };

  const updateAdults = (delta: number) => {
    const adults = Math.max(
      occupancy.rooms,
      Math.min(16, occupancy.adults + delta)
    );
    onChange({ ...occupancy, adults });
  };

  const updateChildrenCount = (delta: number) => {
    if (delta > 0 && occupancy.childrenAges.length < 6) {
      onChange({
        ...occupancy,
        childrenAges: [...occupancy.childrenAges, 8],
      });
    } else if (delta < 0 && occupancy.childrenAges.length > 0) {
      onChange({
        ...occupancy,
        childrenAges: occupancy.childrenAges.slice(0, -1),
      });
    }
  };

  const updateChildAge = (idx: number, delta: number) => {
    const nextAges = occupancy.childrenAges.map((age, i) =>
      i === idx ? Math.max(0, Math.min(17, age + delta)) : age
    );
    onChange({ ...occupancy, childrenAges: nextAges });
  };

  const renderRow = (
    title: string,
    subtitle: string,
    value: number,
    onDec: () => void,
    onInc: () => void,
    minReached: boolean,
    maxReached: boolean
  ) => (
    <View style={styles.row}>
      <View style={styles.labelCol}>
        <Text style={[styles.rowTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: palette.subtext }]}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.stepper}>
        <Pressable
          onPress={onDec}
          disabled={minReached}
          style={[
            styles.stepBtn,
            {
              backgroundColor: palette.surfaceMuted,
              borderColor: palette.border,
              opacity: minReached ? 0.38 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${title}`}
        >
          <Minus size={15} color={palette.text} />
        </Pressable>
        <Text style={[styles.stepVal, { color: palette.text }]}>{value}</Text>
        <Pressable
          onPress={onInc}
          disabled={maxReached}
          style={[
            styles.stepBtn,
            {
              backgroundColor: palette.primaryTint,
              borderColor: palette.primary,
              opacity: maxReached ? 0.38 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${title}`}
        >
          <Plus size={15} color={palette.primary} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      {renderRow(
        "Rooms",
        "Number of hotel rooms",
        occupancy.rooms,
        () => updateRooms(-1),
        () => updateRooms(1),
        occupancy.rooms <= 1,
        occupancy.rooms >= 8
      )}

      <View style={[styles.divider, { backgroundColor: palette.border }]} />

      {renderRow(
        "Adults",
        "Ages 18 or above",
        occupancy.adults,
        () => updateAdults(-1),
        () => updateAdults(1),
        occupancy.adults <= occupancy.rooms,
        occupancy.adults >= 16
      )}

      <View style={[styles.divider, { backgroundColor: palette.border }]} />

      {renderRow(
        "Children",
        "Ages 0 to 17 at check-out",
        occupancy.childrenAges.length,
        () => updateChildrenCount(-1),
        () => updateChildrenCount(1),
        occupancy.childrenAges.length === 0,
        occupancy.childrenAges.length >= 6
      )}

      {occupancy.childrenAges.length > 0 ? (
        <View
          style={[
            styles.agesBox,
            { backgroundColor: palette.surfaceMuted },
          ]}
        >
          <Text style={[styles.agesTitle, { color: palette.subtext }]}>
            Child ages (required for accurate hotel rate calculation)
          </Text>
          {occupancy.childrenAges.map((age, idx) => (
            <View key={`child_${idx}`} style={styles.ageRow}>
              <Text style={[styles.ageLabel, { color: palette.text }]}>
                Child {idx + 1} age
              </Text>
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => updateChildAge(idx, -1)}
                  disabled={age <= 0}
                  style={[
                    styles.smallStepBtn,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                  ]}
                >
                  <Minus size={13} color={palette.text} />
                </Pressable>
                <Text style={[styles.ageVal, { color: palette.text }]}>
                  {age} yr
                </Text>
                <Pressable
                  onPress={() => updateChildAge(idx, 1)}
                  disabled={age >= 17}
                  style={[
                    styles.smallStepBtn,
                    { backgroundColor: palette.surface, borderColor: palette.border },
                  ]}
                >
                  <Plus size={13} color={palette.text} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelCol: {
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  rowSubtitle: {
    fontSize: 12,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepVal: {
    minWidth: 22,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    width: "100%",
  },
  agesBox: {
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  agesTitle: {
    fontSize: 11,
    fontWeight: "600",
  },
  ageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ageLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  smallStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ageVal: {
    minWidth: 38,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
  },
});


import React, { useMemo, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  MonthList,
  useDateRange,
  CalendarThemeProvider,
  mergeTheme,
  defaultTheme,
  darkTheme,
  type DateRange,
  type CalendarTheme,
  type PartialCalendarTheme,
} from "@super-calendar/native/picker";
import {
  addDays,
  subDays,
  startOfDay,
  isBefore,
  differenceInCalendarDays,
  format,
} from "date-fns";
import { Minus, Plus, ArrowRight, Calendar } from "lucide-react-native";
import { useAppTheme } from "../../../theme/useAppTheme";
import { haptics } from "../../../lib/haptics";
import { HapticPressable } from "../../../components/ui/HapticPressable";

export interface DateRangePickerProps {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
}

function parseIso(isoStr: string): Date {
  const [y, m, d] = isoStr.split("-").map(Number);
  if (!y || !m || !d) return startOfDay(new Date());
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  checkIn,
  checkOut,
  onChange,
}) => {
  const { palette, isDark } = useAppTheme();
  const today = useMemo(() => startOfDay(new Date()), []);

  const parsedIn = useMemo(() => parseIso(checkIn), [checkIn]);
  const parsedOut = useMemo(() => parseIso(checkOut), [checkOut]);

  // Controlled date-range hook from Super Calendar
  const { range, onPressDate, selectRange, setRange } = useDateRange({
    minDate: today,
    initialRange: {
      start: parsedIn,
      end: parsedOut,
    },
  });

  // Track previous range to synchronize with parent and trigger haptics
  const prevRangeRef = useRef<DateRange | null>(range);

  useEffect(() => {
    // Sync external props change if range differs
    if (
      !range ||
      toIso(range.start) !== checkIn ||
      (range.end && toIso(range.end) !== checkOut)
    ) {
      setRange({
        start: parsedIn,
        end: parsedOut,
      });
    }
  }, [checkIn, checkOut, parsedIn, parsedOut, setRange]);

  // When user selects a range through the calendar
  useEffect(() => {
    if (!range) return;

    const prev = prevRangeRef.current;
    const startChanged = !prev || toIso(prev.start) !== toIso(range.start);
    const endChanged = !prev || (prev.end && range.end ? toIso(prev.end) !== toIso(range.end) : prev.end !== range.end);

    if (startChanged || endChanged) {
      prevRangeRef.current = range;

      if (range.start && range.end) {
        haptics.success();
        onChange(toIso(range.start), toIso(range.end));
      } else {
        haptics.selection();
      }
    }
  }, [range, onChange]);

  // Handle day press
  const handlePressDay = useCallback(
    (day: Date) => {
      if (isBefore(day, today)) {
        haptics.warning();
        return;
      }
      haptics.selection();
      onPressDate(day);
    },
    [today, onPressDate]
  );

  // Handle drag-to-select with Super Calendar
  const handleSelectDrag = useCallback(
    (start: Date, end: Date) => {
      const validStart = isBefore(start, today) ? today : start;
      if (isBefore(end, validStart)) return;

      haptics.selection();
      selectRange(validStart, end);
    },
    [today, selectRange]
  );

  // Endpoint adjusters: extend or shorten Check-In without restarting selection
  const handleAdjustCheckIn = useCallback(
    (deltaDays: number) => {
      if (!range?.start) return;
      const newStart = addDays(range.start, deltaDays);

      if (isBefore(newStart, today)) {
        haptics.warning();
        return;
      }

      const currentEnd = range.end || addDays(range.start, 1);
      if (differenceInCalendarDays(currentEnd, newStart) < 1) {
        // Pushing checkout forward by 1 night if checkin reaches it
        const pushedEnd = addDays(newStart, 1);
        haptics.selection(true);
        selectRange(newStart, pushedEnd);
        onChange(toIso(newStart), toIso(pushedEnd));
      } else {
        haptics.selection(true);
        selectRange(newStart, currentEnd);
        onChange(toIso(newStart), toIso(currentEnd));
      }
    },
    [range, today, selectRange, onChange]
  );

  // Endpoint adjusters: extend or shorten Check-Out without restarting selection
  const handleAdjustCheckOut = useCallback(
    (deltaDays: number) => {
      if (!range?.start) return;
      const currentEnd = range.end || addDays(range.start, 1);
      const newEnd = addDays(currentEnd, deltaDays);

      if (differenceInCalendarDays(newEnd, range.start) < 1) {
        haptics.warning();
        return;
      }

      haptics.selection(true);
      selectRange(range.start, newEnd);
      onChange(toIso(range.start), toIso(newEnd));
    },
    [range, selectRange, onChange]
  );

  // Total nights calculation
  const totalNights = useMemo(() => {
    if (!range?.start || !range?.end) return 1;
    return Math.max(1, differenceInCalendarDays(range.end, range.start));
  }, [range]);

  // Custom Super Calendar theme matching goWild brand tokens
  const customTheme = useMemo<CalendarTheme>(() => {
    const base = isDark ? darkTheme : defaultTheme;
    return mergeTheme({
      ...base,
      colors: {
        ...base.colors,
        surface: isDark ? "#121214" : "#FFFFFF",
        selectedBackground: palette.primary,
        selectedText: "#FFFFFF",
        rangeBackground: isDark ? "rgba(40, 83, 175, 0.28)" : "#E8F2FF",
        todayBackground: palette.brandSky,
        todayText: "#FFFFFF",
        text: isDark ? "#FFFFFF" : "#171725",
        textMuted: isDark ? "#71717A" : "#717171",
        textDisabled: isDark ? "#3F3F46" : "#D1D5DB",
        gridLine: isDark ? "#27272A" : "#EEEEEE",
        weekendBackground: isDark ? "#15171C" : "#FBFBFC",
      },
      text: {
        ...base.text,
        monthTitle: {
          fontSize: 16,
          fontWeight: "700",
          color: isDark ? "#FFFFFF" : "#171725",
        },
        weekday: {
          fontSize: 12,
          fontWeight: "600",
          color: isDark ? "#71717A" : "#8E8E93",
        },
        dateCell: {
          fontSize: 14,
          fontWeight: "600",
        },
      },
      todayBadgeRadius: 18,
      rangeBandHeight: 38,
    });
  }, [isDark, palette]);

  return (
    <View style={styles.container}>
      {/* 1. Interactive Endpoint Summary & Scrubbers */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: isDark ? "#18181B" : "#F4F6FA",
            borderColor: isDark ? "#27272A" : "#E2E8F0",
          },
        ]}
      >
        {/* Check-in Endpoint Card */}
        <View style={styles.endpointCard}>
          <Text style={[styles.endpointLabel, { color: palette.subtext }]}>
            CHECK-IN
          </Text>
          <Text style={[styles.endpointDate, { color: palette.text }]}>
            {range?.start ? format(range.start, "EEE, MMM d") : "Select date"}
          </Text>

          <View style={styles.stepperRow}>
            <HapticPressable
              onPress={() => handleAdjustCheckIn(-1)}
              haptic="selection"
              style={[
                styles.stepperBtn,
                { backgroundColor: isDark ? "#27272A" : "#FFFFFF" },
              ]}
              accessibilityLabel="Decrease check-in by one day"
            >
              <Minus size={14} color={palette.text} />
            </HapticPressable>

            <HapticPressable
              onPress={() => handleAdjustCheckIn(1)}
              haptic="selection"
              style={[
                styles.stepperBtn,
                { backgroundColor: isDark ? "#27272A" : "#FFFFFF" },
              ]}
              accessibilityLabel="Increase check-in by one day"
            >
              <Plus size={14} color={palette.text} />
            </HapticPressable>
          </View>
        </View>

        {/* Center Nights Pill */}
        <View style={styles.centerPillWrap}>
          <View
            style={[
              styles.nightsBadge,
              { backgroundColor: palette.primaryTint },
            ]}
          >
            <Calendar size={12} color={palette.primary} />
            <Text style={[styles.nightsText, { color: palette.primary }]}>
              {totalNights} {totalNights === 1 ? "night" : "nights"}
            </Text>
          </View>
          <ArrowRight size={14} color={palette.subtext} />
        </View>

        {/* Check-out Endpoint Card */}
        <View style={styles.endpointCard}>
          <Text style={[styles.endpointLabel, { color: palette.subtext }]}>
            CHECK-OUT
          </Text>
          <Text style={[styles.endpointDate, { color: palette.text }]}>
            {range?.end
              ? format(range.end, "EEE, MMM d")
              : range?.start
              ? format(addDays(range.start, 1), "EEE, MMM d")
              : "Select date"}
          </Text>

          <View style={styles.stepperRow}>
            <HapticPressable
              onPress={() => handleAdjustCheckOut(-1)}
              haptic="selection"
              style={[
                styles.stepperBtn,
                { backgroundColor: isDark ? "#27272A" : "#FFFFFF" },
              ]}
              accessibilityLabel="Decrease check-out by one day"
            >
              <Minus size={14} color={palette.text} />
            </HapticPressable>

            <HapticPressable
              onPress={() => handleAdjustCheckOut(1)}
              haptic="selection"
              style={[
                styles.stepperBtn,
                { backgroundColor: isDark ? "#27272A" : "#FFFFFF" },
              ]}
              accessibilityLabel="Increase check-out by one day"
            >
              <Plus size={14} color={palette.text} />
            </HapticPressable>
          </View>
        </View>
      </View>

      {/* Drag & Select Tip */}
      <Text style={[styles.gestureTip, { color: palette.subtext }]}>
        Tap to pick dates, or long-press & drag across days to extend.
      </Text>

      {/* 2. Super Calendar MonthList */}
      <View style={styles.calendarWrap}>
        <CalendarThemeProvider value={customTheme}>
          <MonthList
            date={range?.start || today}
            selectedRange={range ?? undefined}
            minDate={today}
            weekStartsOn={0}
            weekRowHeight={46}
            monthHeaderHeight={40}
            fillCellOnSelection={false}
            onPressDay={handlePressDay}
            onSelectDrag={handleSelectDrag}
          />
        </CalendarThemeProvider>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 12,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
  },
  endpointCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  endpointLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  endpointDate: {
    fontSize: 14,
    fontWeight: "700",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  centerPillWrap: {
    alignItems: "center",
    gap: 4,
  },
  nightsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  nightsText: {
    fontSize: 11,
    fontWeight: "700",
  },
  gestureTip: {
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  calendarWrap: {
    height: 380,
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
});

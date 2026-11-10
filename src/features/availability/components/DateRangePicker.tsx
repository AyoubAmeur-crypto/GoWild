import React, { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  MonthList,
  useDateRange,
  CalendarThemeProvider,
  mergeTheme,
  defaultTheme,
  darkTheme,
  isSameCalendarDay,
  type CalendarTheme,
} from "@super-calendar/native/picker";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import {
  addDays,
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

type EndpointFocus = "auto" | "checkIn" | "checkOut";
type DragAnchorMode = "fresh" | "adjustEnd" | "adjustStart";

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

const SCRUB_STEP_PX = 22;

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  checkIn,
  checkOut,
  onChange,
}) => {
  const { palette, isDark, reducedMotion } = useAppTheme();
  const today = useMemo(() => startOfDay(new Date()), []);

  const parsedIn = useMemo(() => parseIso(checkIn), [checkIn]);
  const parsedOut = useMemo(() => parseIso(checkOut), [checkOut]);

  const [focusedEndpoint, setFocusedEndpoint] = useState<EndpointFocus>("auto");

  // Super Calendar date-range state hook
  const { range, onPressDate, selectRange, setRange } = useDateRange({
    minDate: today,
    initialRange: {
      start: parsedIn,
      end: parsedOut,
    },
  });

  // Keep a ref to latest range so gestures and callbacks read current endpoints without stale closures
  const rangeRef = useRef(range);
  rangeRef.current = range;

  // Track external prop changes without overwriting an in-progress single-endpoint selection
  const lastCommittedRef = useRef<{ checkIn: string; checkOut: string }>({
    checkIn,
    checkOut,
  });

  useEffect(() => {
    const extChanged =
      lastCommittedRef.current.checkIn !== checkIn ||
      lastCommittedRef.current.checkOut !== checkOut;

    if (extChanged) {
      lastCommittedRef.current = { checkIn, checkOut };
      setRange({
        start: parsedIn,
        end: parsedOut,
      });
    }
  }, [checkIn, checkOut, parsedIn, parsedOut, setRange]);

  const commitValidRange = useCallback(
    (startDate: Date, endDate: Date, withConfirmHaptic: boolean) => {
      const cleanStart = isBefore(startDate, today) ? today : startOfDay(startDate);
      const cleanEnd =
        differenceInCalendarDays(endDate, cleanStart) < 1
          ? addDays(cleanStart, 1)
          : startOfDay(endDate);

      const nextIn = toIso(cleanStart);
      const nextOut = toIso(cleanEnd);

      selectRange(cleanStart, cleanEnd);
      lastCommittedRef.current = { checkIn: nextIn, checkOut: nextOut };

      if (withConfirmHaptic) {
        haptics.success();
      }
      onChange(nextIn, nextOut);
    },
    [today, selectRange, onChange]
  );

  // Tap handler on calendar days: supports choosing check-in/check-out AND shortening/extending endpoints without restarting
  const handlePressDay = useCallback(
    (rawDay: Date) => {
      const day = startOfDay(rawDay);
      if (isBefore(day, today)) {
        haptics.warning();
        return;
      }

      const current = rangeRef.current;

      // 1. If user explicitly tapped an existing range endpoint, focus that endpoint for adjustment
      if (current?.start && current?.end) {
        if (isSameCalendarDay(day, current.start)) {
          haptics.selection();
          setFocusedEndpoint("checkIn");
          return;
        }
        if (isSameCalendarDay(day, current.end)) {
          haptics.selection();
          setFocusedEndpoint("checkOut");
          return;
        }
      }

      // 2. If user is adjusting Check-In endpoint directly
      if (focusedEndpoint === "checkIn" && current?.start) {
        const currentEnd = current.end ?? addDays(current.start, 1);
        if (isBefore(day, currentEnd)) {
          commitValidRange(day, currentEnd, true);
          setFocusedEndpoint("auto");
          return;
        }
        // Tapped on/after current checkout: shift start to day and wait for new checkout
        haptics.selection();
        setRange({ start: day, end: null });
        setFocusedEndpoint("checkOut");
        return;
      }

      // 3. If user is adjusting Check-Out endpoint directly
      if (focusedEndpoint === "checkOut" && current?.start) {
        if (differenceInCalendarDays(day, current.start) >= 1) {
          commitValidRange(current.start, day, true);
          setFocusedEndpoint("auto");
          return;
        }
        // Tapped before current check-in: make tapped day the new check-in and keep previous start/end
        commitValidRange(day, current.end ?? addDays(current.start, 1), true);
        setFocusedEndpoint("auto");
        return;
      }

      // 4. Standard Super Calendar `onPressDate` flow with smart range extension/shortening
      if (!current || current.end !== null) {
        // Begin selecting new check-in
        haptics.selection();
        onPressDate(day);
        setFocusedEndpoint("auto");
      } else {
        // Completing an open range (check-in was chosen, now choosing check-out)
        if (isSameCalendarDay(day, current.start)) {
          commitValidRange(current.start, addDays(current.start, 1), true);
        } else if (isBefore(day, current.start)) {
          commitValidRange(day, current.start, true);
        } else {
          commitValidRange(current.start, day, true);
        }
      }
    },
    [today, focusedEndpoint, commitValidRange, onPressDate, setRange]
  );

  // Track active drag state to avoid redundant JS updates and support endpoint dragging
  const dragSessionRef = useRef<{
    originIso: string;
    lastHoveredIso: string;
    mode: DragAnchorMode;
    anchorStart: Date;
    anchorEnd: Date;
  } | null>(null);

  // Long-press + drag handler (`onSelectDrag` from Super Calendar `MonthList`)
  const handleSelectDrag = useCallback(
    (rawOrigin: Date, rawHovered: Date) => {
      const origin = isBefore(rawOrigin, today) ? today : startOfDay(rawOrigin);
      const hovered = isBefore(rawHovered, today) ? today : startOfDay(rawHovered);

      const originIso = toIso(origin);
      const hoveredIso = toIso(hovered);

      // Initialize drag session on first frame of a new drag gesture
      if (!dragSessionRef.current || dragSessionRef.current.originIso !== originIso) {
        const current = rangeRef.current;
        let mode: DragAnchorMode = "fresh";
        const anchorStart = current?.start ?? origin;
        const anchorEnd = current?.end ?? addDays(anchorStart, 1);

        if (current?.start && current?.end) {
          const distToEnd = Math.abs(differenceInCalendarDays(origin, current.end));
          const distToStart = Math.abs(differenceInCalendarDays(origin, current.start));
          if (distToEnd <= 1 && distToEnd <= distToStart) {
            mode = "adjustEnd";
          } else if (distToStart <= 1) {
            mode = "adjustStart";
          }
        }

        dragSessionRef.current = {
          originIso,
          lastHoveredIso: "",
          mode,
          anchorStart,
          anchorEnd,
        };
      }

      // Skip redundant JS state updates if finger is still on the same day cell
      if (dragSessionRef.current.lastHoveredIso === hoveredIso) {
        return;
      }
      dragSessionRef.current.lastHoveredIso = hoveredIso;

      const { mode, anchorStart, anchorEnd } = dragSessionRef.current;
      let nextStart: Date;
      let nextEnd: Date;

      if (mode === "adjustEnd") {
        // Dragging the Check-Out endpoint to shorten or extend the stay
        if (isBefore(hovered, anchorStart)) {
          nextStart = hovered;
          nextEnd = anchorStart;
        } else if (isSameCalendarDay(hovered, anchorStart)) {
          nextStart = anchorStart;
          nextEnd = addDays(anchorStart, 1);
        } else {
          nextStart = anchorStart;
          nextEnd = hovered;
        }
      } else if (mode === "adjustStart") {
        // Dragging the Check-In endpoint to shorten or extend the stay
        if (isBefore(hovered, anchorEnd)) {
          nextStart = hovered;
          nextEnd = anchorEnd;
        } else if (isSameCalendarDay(hovered, anchorEnd)) {
          nextStart = anchorEnd;
          nextEnd = addDays(anchorEnd, 1);
        } else {
          nextStart = anchorStart;
          nextEnd = hovered;
        }
      } else {
        // Dragging a fresh range from `origin` to `hovered`
        const [orderedStart, orderedEnd] =
          origin.getTime() <= hovered.getTime() ? [origin, hovered] : [hovered, origin];
        nextStart = orderedStart;
        nextEnd = isSameCalendarDay(orderedStart, orderedEnd)
          ? addDays(orderedStart, 1)
          : orderedEnd;
      }

      // Light throttled haptic feedback as selection extends/shortens across days
      haptics.selection();
      selectRange(nextStart, nextEnd);

      const nextIn = toIso(nextStart);
      const nextOut = toIso(nextEnd);
      lastCommittedRef.current = { checkIn: nextIn, checkOut: nextOut };
      onChange(nextIn, nextOut);
    },
    [today, selectRange, onChange]
  );

  // Endpoint adjusters: extend or shorten Check-In without restarting selection
  const handleAdjustCheckIn = useCallback(
    (deltaDays: number) => {
      const current = rangeRef.current;
      if (!current?.start) return;
      const newStart = addDays(current.start, deltaDays);

      if (isBefore(newStart, today)) {
        haptics.warning();
        return;
      }

      const currentEnd = current.end || addDays(current.start, 1);
      const nextEnd =
        differenceInCalendarDays(currentEnd, newStart) < 1
          ? addDays(newStart, 1)
          : currentEnd;

      haptics.selection();
      commitValidRange(newStart, nextEnd, false);
    },
    [today, commitValidRange]
  );

  // Endpoint adjusters: extend or shorten Check-Out without restarting selection
  const handleAdjustCheckOut = useCallback(
    (deltaDays: number) => {
      const current = rangeRef.current;
      if (!current?.start) return;
      const currentEnd = current.end || addDays(current.start, 1);
      const newEnd = addDays(currentEnd, deltaDays);

      if (differenceInCalendarDays(newEnd, current.start) < 1) {
        haptics.warning();
        return;
      }

      haptics.selection();
      commitValidRange(current.start, newEnd, false);
    },
    [commitValidRange]
  );

  // UI-thread horizontal scrub gestures on Check-In and Check-Out cards
  const checkInScale = useSharedValue(1);
  const checkOutScale = useSharedValue(1);
  const checkInScrubStep = useSharedValue(0);
  const checkOutScrubStep = useSharedValue(0);

  const checkInPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .onBegin(() => {
          checkInScrubStep.value = 0;
          if (!reducedMotion) {
            checkInScale.value = withSpring(1.03, { damping: 20, stiffness: 300 });
          }
        })
        .onUpdate((event) => {
          const steps = Math.trunc(event.translationX / SCRUB_STEP_PX);
          const delta = steps - checkInScrubStep.value;
          if (delta !== 0) {
            checkInScrubStep.value = steps;
            runOnJS(handleAdjustCheckIn)(delta);
          }
        })
        .onFinalize(() => {
          checkInScale.value = withSpring(1, { damping: 20, stiffness: 300 });
        }),
    [checkInScrubStep, checkInScale, reducedMotion, handleAdjustCheckIn]
  );

  const checkOutPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .onBegin(() => {
          checkOutScrubStep.value = 0;
          if (!reducedMotion) {
            checkOutScale.value = withSpring(1.03, { damping: 20, stiffness: 300 });
          }
        })
        .onUpdate((event) => {
          const steps = Math.trunc(event.translationX / SCRUB_STEP_PX);
          const delta = steps - checkOutScrubStep.value;
          if (delta !== 0) {
            checkOutScrubStep.value = steps;
            runOnJS(handleAdjustCheckOut)(delta);
          }
        })
        .onFinalize(() => {
          checkOutScale.value = withSpring(1, { damping: 20, stiffness: 300 });
        }),
    [checkOutScrubStep, checkOutScale, reducedMotion, handleAdjustCheckOut]
  );

  const checkInCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkInScale.value }],
  }));

  const checkOutCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkOutScale.value }],
  }));

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
          fontSize: 15,
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
      rangeBandHeight: 36,
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
        {/* Check-in Endpoint Card (Tap to focus or slide left/right to scrub) */}
        <GestureDetector gesture={checkInPanGesture}>
          <Animated.View
            style={[
              styles.endpointCard,
              focusedEndpoint === "checkIn" && {
                borderColor: palette.primary,
                backgroundColor: isDark ? "rgba(40, 83, 175, 0.16)" : "#E8F2FF",
              },
              checkInCardStyle,
            ]}
          >
            <HapticPressable
              haptic="selection"
              activeScale={0.98}
              onPress={() =>
                setFocusedEndpoint((prev) =>
                  prev === "checkIn" ? "auto" : "checkIn"
                )
              }
              style={styles.endpointHeaderBtn}
              accessibilityLabel="Focus check-in date adjustment"
            >
              <Text
                style={[
                  styles.endpointLabel,
                  {
                    color:
                      focusedEndpoint === "checkIn"
                        ? palette.primary
                        : palette.subtext,
                  },
                ]}
              >
                CHECK-IN
              </Text>
              <Text style={[styles.endpointDate, { color: palette.text }]}>
                {range?.start ? format(range.start, "EEE, MMM d") : "Select date"}
              </Text>
            </HapticPressable>

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
                <Minus size={13} color={palette.text} />
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
                <Plus size={13} color={palette.text} />
              </HapticPressable>
            </View>
          </Animated.View>
        </GestureDetector>

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
          <ArrowRight size={13} color={palette.subtext} />
        </View>

        {/* Check-out Endpoint Card (Tap to focus or slide left/right to scrub) */}
        <GestureDetector gesture={checkOutPanGesture}>
          <Animated.View
            style={[
              styles.endpointCard,
              focusedEndpoint === "checkOut" && {
                borderColor: palette.primary,
                backgroundColor: isDark ? "rgba(40, 83, 175, 0.16)" : "#E8F2FF",
              },
              checkOutCardStyle,
            ]}
          >
            <HapticPressable
              haptic="selection"
              activeScale={0.98}
              onPress={() =>
                setFocusedEndpoint((prev) =>
                  prev === "checkOut" ? "auto" : "checkOut"
                )
              }
              style={styles.endpointHeaderBtn}
              accessibilityLabel="Focus check-out date adjustment"
            >
              <Text
                style={[
                  styles.endpointLabel,
                  {
                    color:
                      focusedEndpoint === "checkOut"
                        ? palette.primary
                        : palette.subtext,
                  },
                ]}
              >
                CHECK-OUT
              </Text>
              <Text style={[styles.endpointDate, { color: palette.text }]}>
                {range?.end
                  ? format(range.end, "EEE, MMM d")
                  : range?.start
                  ? format(addDays(range.start, 1), "EEE, MMM d")
                  : "Select date"}
              </Text>
            </HapticPressable>

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
                <Minus size={13} color={palette.text} />
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
                <Plus size={13} color={palette.text} />
              </HapticPressable>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Drag & Select Tip */}
      <Text style={[styles.gestureTip, { color: palette.subtext }]}>
        Tap or long-press & drag across dates, or slide check-in/out left & right.
      </Text>

      {/* 2. Super Calendar MonthList */}
      <View style={styles.calendarWrap}>
        <CalendarThemeProvider value={customTheme}>
          <MonthList
            date={range?.start || today}
            selectedRange={range ?? undefined}
            minDate={today}
            weekStartsOn={0}
            weekRowHeight={42}
            monthHeaderHeight={36}
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
    gap: 8,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
  },
  endpointCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 4,
  },
  endpointHeaderBtn: {
    alignItems: "center",
    gap: 2,
  },
  endpointLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  endpointDate: {
    fontSize: 13,
    fontWeight: "700",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
    gap: 3,
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
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  calendarWrap: {
    height: 295,
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
});

import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react-native";
import { useAppTheme } from "../../../theme/useAppTheme";
import { calculateNights, formatFullDate } from "../../../lib/pricing";

interface DateRangePickerProps {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  checkIn,
  checkOut,
  onChange,
}) => {
  const { palette } = useAppTheme();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const initialDate = useMemo(() => {
    const parsed = new Date(`${checkIn}T12:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [checkIn]);

  const [viewYear, setViewYear] = useState(initialDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getUTCMonth());
  const [selectingEnd, setSelectingEnd] = useState(false);

  const monthLabel = useMemo(() => {
    const d = new Date(Date.UTC(viewYear, viewMonth, 1));
    return d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }, [viewYear, viewMonth]);

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
    const daysInMonth = new Date(
      Date.UTC(viewYear, viewMonth + 1, 0)
    ).getUTCDate();

    const cells: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(toIsoDate(viewYear, viewMonth, day));
    }
    return cells;
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  };

  const handleDayPress = (iso: string) => {
    if (iso < todayIso) return;
    if (!selectingEnd || iso <= checkIn) {
      const nextOut = iso >= checkOut ? addDaysIso(iso, 2) : checkOut;
      onChange(iso, nextOut);
      setSelectingEnd(true);
    } else {
      onChange(checkIn, iso);
      setSelectingEnd(false);
    }
  };

  const nights = calculateNights(checkIn, checkOut);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      {/* Selected Range Summary */}
      <View
        style={[
          styles.summaryRow,
          { backgroundColor: palette.surfaceMuted },
        ]}
      >
        <View style={styles.summaryCol}>
          <Text style={[styles.summaryCap, { color: palette.subtext }]}>
            CHECK-IN
          </Text>
          <Text style={[styles.summaryVal, { color: palette.text }]}>
            {formatFullDate(checkIn)}
          </Text>
        </View>
        <View
          style={[
            styles.nightsBadge,
            { backgroundColor: palette.primaryTint },
          ]}
        >
          <Calendar size={12} color={palette.primary} />
          <Text style={[styles.nightsText, { color: palette.primary }]}>
            {nights} {nights === 1 ? "night" : "nights"}
          </Text>
        </View>
        <View style={[styles.summaryCol, { alignItems: "flex-end" }]}>
          <Text style={[styles.summaryCap, { color: palette.subtext }]}>
            CHECK-OUT
          </Text>
          <Text style={[styles.summaryVal, { color: palette.text }]}>
            {formatFullDate(checkOut)}
          </Text>
        </View>
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <Pressable
          onPress={() => shiftMonth(-1)}
          style={[styles.navBtn, { backgroundColor: palette.surfaceMuted }]}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <ChevronLeft size={18} color={palette.text} />
        </Pressable>
        <Text style={[styles.monthTitle, { color: palette.text }]}>
          {monthLabel}
        </Text>
        <Pressable
          onPress={() => shiftMonth(1)}
          style={[styles.navBtn, { backgroundColor: palette.surfaceMuted }]}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <ChevronRight size={18} color={palette.text} />
        </Pressable>
      </View>

      {/* Weekday Labels */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((wd) => (
          <Text
            key={wd}
            style={[styles.weekdayText, { color: palette.muted }]}
          >
            {wd}
          </Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.grid}>
        {calendarCells.map((iso, idx) => {
          if (!iso) {
            return <View key={`empty_${idx}`} style={styles.dayCell} />;
          }
          const dayNum = Number(iso.slice(8, 10));
          const isPast = iso < todayIso;
          const isStart = iso === checkIn;
          const isEnd = iso === checkOut;
          const inRange = iso > checkIn && iso < checkOut;

          return (
            <Pressable
              key={iso}
              disabled={isPast}
              onPress={() => handleDayPress(iso)}
              style={[
                styles.dayCell,
                inRange && { backgroundColor: palette.primaryTint },
                (isStart || isEnd) && {
                  backgroundColor: palette.primary,
                  borderRadius: 10,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Select ${iso}`}
            >
              <Text
                style={[
                  styles.dayText,
                  {
                    color:
                      isStart || isEnd
                        ? "#FFFFFF"
                        : isPast
                          ? palette.muted
                          : palette.text,
                    opacity: isPast ? 0.45 : 1,
                    fontWeight: isStart || isEnd ? "700" : "500",
                  },
                ]}
              >
                {dayNum}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Quick Shortcuts */}
      <View style={styles.quickRow}>
        {[2, 3, 5, 7].map((n) => (
          <Pressable
            key={n}
            onPress={() => {
              onChange(checkIn, addDaysIso(checkIn, n));
              setSelectingEnd(false);
            }}
            style={[
              styles.quickChip,
              {
                backgroundColor:
                  nights === n ? palette.primaryTint : palette.surfaceMuted,
                borderColor: nights === n ? palette.primary : palette.border,
              },
            ]}
          >
            <Text
              style={[
                styles.quickText,
                { color: nights === n ? palette.primary : palette.subtext },
              ]}
            >
              {n} nights
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
  },
  summaryCol: {
    gap: 2,
  },
  summaryCap: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: "700",
  },
  nightsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  nightsText: {
    fontSize: 12,
    fontWeight: "700",
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  weekRow: {
    flexDirection: "row",
  },
  weekdayText: {
    width: "14.28%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.28%",
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
  dayText: {
    fontSize: 13,
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  quickText: {
    fontSize: 12,
    fontWeight: "600",
  },
});


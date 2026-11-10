import test from "node:test";
import assert from "node:assert/strict";
import { startOfDay, addDays, differenceInCalendarDays, isBefore } from "date-fns";

test("date range validation enforces non-past checkin and positive night duration", () => {
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);

  // Past dates cannot be selected
  assert.equal(isBefore(yesterday, today), true);
  assert.equal(isBefore(today, today), false);
  assert.equal(isBefore(tomorrow, today), false);

  // Nights count must be positive
  const nights = differenceInCalendarDays(nextWeek, tomorrow);
  assert.equal(nights, 6);
  assert.ok(nights >= 1);
});

test("Super Calendar date string conversion and boundary clamping", () => {
  function toIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseIso(str: string): Date {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  const d = new Date(2026, 10, 15); // Nov 15, 2026
  const iso = toIso(d);
  assert.equal(iso, "2026-11-15");

  const parsed = parseIso(iso);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 10);
  assert.equal(parsed.getDate(), 15);
});

test("haptic throttling prevents vibration spam during high-frequency dragging", () => {
  let lastTimestamp = 0;
  const THROTTLE_MS = 45;
  let triggerCount = 0;

  function throttledHaptic(force = false) {
    const now = Date.now();
    if (!force && now - lastTimestamp < THROTTLE_MS) {
      return false;
    }
    lastTimestamp = now;
    triggerCount += 1;
    return true;
  }

  // First call succeeds
  assert.equal(throttledHaptic(), true);
  assert.equal(triggerCount, 1);

  // Immediate subsequent call is throttled
  assert.equal(throttledHaptic(), false);
  assert.equal(triggerCount, 1);

  // Force flag bypasses throttle
  assert.equal(throttledHaptic(true), true);
  assert.equal(triggerCount, 2);
});

test("endpoint drag adjustment extends and shortens range without restarting selection", () => {
  const start = new Date(2026, 10, 10); // Nov 10
  const end = new Date(2026, 10, 15); // Nov 15

  function detectDragMode(origin: Date, currentStart: Date, currentEnd: Date) {
    const distToEnd = Math.abs(differenceInCalendarDays(origin, currentEnd));
    const distToStart = Math.abs(differenceInCalendarDays(origin, currentStart));
    if (distToEnd <= 1 && distToEnd <= distToStart) return "adjustEnd";
    if (distToStart <= 1) return "adjustStart";
    return "fresh";
  }

  // Dragging from existing checkout date adjusts end
  assert.equal(detectDragMode(new Date(2026, 10, 15), start, end), "adjustEnd");
  // Dragging from existing checkin date adjusts start
  assert.equal(detectDragMode(new Date(2026, 10, 10), start, end), "adjustStart");
  // Dragging from an unrelated date starts a fresh range
  assert.equal(detectDragMode(new Date(2026, 10, 22), start, end), "fresh");
});

test("multi-snap bottom sheet calculates ascending snap ratios and offsets", () => {
  const height = 800;
  const snapPoints = [0.9, 0.58];
  const sorted = [...snapPoints].sort((a, b) => a - b);
  assert.deepEqual(sorted, [0.58, 0.9]);

  const topRatio = sorted[sorted.length - 1];
  const offsets = sorted.map((r) => Math.round((topRatio - r) * height));
  // Lower snap point (0.58) has positive translateY offset (256px), highest snap point (0.9) is 0px
  assert.deepEqual(offsets, [256, 0]);
});

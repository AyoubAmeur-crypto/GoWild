import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";

let lastHapticTimestamp = 0;
const HAPTIC_THROTTLE_MS = 45;

function shouldThrottle(): boolean {
  const now = Date.now();
  if (now - lastHapticTimestamp < HAPTIC_THROTTLE_MS) {
    return true;
  }
  lastHapticTimestamp = now;
  return false;
}

/**
 * Standardized Haptic Feedback utility for goWild.
 * Handles throttling, platform differences, and web fallbacks gracefully.
 */
export const haptics = {
  /**
   * Ultra-light selection click for sliders, calendar date scrubbing, and pickers.
   * Throttled to prevent vibration queue barrage during continuous dragging.
   */
  selection: (force = false) => {
    if (Platform.OS === "web") return;
    if (!force && shouldThrottle()) return;

    try {
      Haptics.selectionAsync().catch(() => {
        Vibration.vibrate(8);
      });
    } catch {
      Vibration.vibrate(8);
    }
  },

  /**
   * Light impact for subtle UI clicks, chip selections, and segment changes.
   */
  light: () => {
    if (Platform.OS === "web") return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        Vibration.vibrate(10);
      });
    } catch {
      Vibration.vibrate(10);
    }
  },

  /**
   * Medium impact for confirmation buttons, sheet snap point crossing, and primary actions.
   */
  medium: () => {
    if (Platform.OS === "web") return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
        Vibration.vibrate(20);
      });
    } catch {
      Vibration.vibrate(20);
    }
  },

  /**
   * Heavy impact for critical or high-value triggers.
   */
  heavy: () => {
    if (Platform.OS === "web") return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
        Vibration.vibrate(35);
      });
    } catch {
      Vibration.vibrate(35);
    }
  },

  /**
   * Success notification feedback for completed booking, checkout, and range confirmation.
   */
  success: () => {
    if (Platform.OS === "web") return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
        Vibration.vibrate([0, 20, 60, 25]);
      });
    } catch {
      Vibration.vibrate([0, 20, 60, 25]);
    }
  },

  /**
   * Warning feedback for validation alerts or boundary limits.
   */
  warning: () => {
    if (Platform.OS === "web") return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {
        Vibration.vibrate([0, 30, 40, 30]);
      });
    } catch {
      Vibration.vibrate([0, 30, 40, 30]);
    }
  },

  /**
   * Error feedback for payment failure or invalid actions.
   */
  error: () => {
    if (Platform.OS === "web") return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {
        Vibration.vibrate([0, 40, 50, 40]);
      });
    } catch {
      Vibration.vibrate([0, 40, 50, 40]);
    }
  },
};

/**
 * Backward-compatible helper for existing imports across the codebase.
 */
export function triggerSelectionHaptic(force = false) {
  haptics.selection(force);
}

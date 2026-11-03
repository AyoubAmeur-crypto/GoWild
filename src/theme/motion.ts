/**
 * goWild Motion System
 * Standardized spring and timing configurations for fluid cross-platform animations
 */

export const Motion = {
  // Springs
  spring: {
    // Default interactive spring for tabs, switches, segmented controls
    interactive: {
      damping: 18,
      stiffness: 220,
      mass: 0.8,
    },
    // Snappy spring for small elements (toggles, icons)
    snappy: {
      damping: 16,
      stiffness: 300,
      mass: 0.6,
    },
    // Gentle spring for modal sheets and cards
    gentle: {
      damping: 22,
      stiffness: 160,
      mass: 1.0,
    },
    // Bouncy spring for playful reactions (e.g. favorite heart)
    bouncy: {
      damping: 12,
      stiffness: 240,
      mass: 0.7,
    },
  },

  // Standard durations in milliseconds
  durations: {
    instant: 100,
    fast: 180,
    normal: 260,
    slow: 400,
  },
} as const;

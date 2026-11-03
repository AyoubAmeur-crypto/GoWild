/**
 * goWild Semantic Design System Tokens
 * Derived from Grand Hotel Figma UI Kit (sim22KJgjq1zKePEhnJzdM)
 * harmonized with the canonical goWild geometric flower identity (#40B4F8 & #171725).
 */

export const Colors = {
  // Brand & Primary Actions (Grand Hotel Primary #2853AF + goWild Flower #40B4F8)
  primary: "#2853AF",
  primaryEnd: "#1E4292",
  primaryGradient: ["#2853AF", "#1E4292"] as const,
  brandSky: "#40B4F8",
  secondaryIce: "#E8F2FF",
  primaryLight: "rgba(40, 83, 175, 0.08)",
  primaryGlow: "rgba(64, 180, 248, 0.16)",

  // Semantic Feedback
  emerald: "#34977D",
  ratingGold: "#EDB900",
  danger: "#F41F52",
  warning: "#D97706",

  // Neutral Grayscale Scale (Figma #32127:1241 / #32146:7920)
  charcoal: "#171725",
  darkSlate: "#171725",
  black: "#000000",
  grayscale90: "#434E58",
  subtext: "#66707A", // Grayscale 80
  grayscale70: "#78828A",
  muted: "#9CA4AB", // Grayscale 60
  border: "#E9EBED", // Line
  borderLight: "#ECF1F6",
  surfaceIce: "#F5F8FD",
  surfaceSoft: "#F6F6F6",
  white: "#FEFEFE",
  pureWhite: "#FFFFFF",
  whiteOverlay: "rgba(255, 255, 255, 0.88)",
  darkOverlay: "rgba(23, 23, 37, 0.52)",
} as const;

export interface ThemePalette {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceIce: string;
  elevated: string;
  text: string;
  subtext: string;
  muted: string;
  border: string;
  primary: string;
  primaryStrong: string;
  brandSky: string;
  primaryTint: string;
  success: string;
  successTint: string;
  warning: string;
  warningTint: string;
  danger: string;
  dangerTint: string;
  ratingGold: string;
  cardOverlay: string;
}

export const LightPalette: ThemePalette = {
  isDark: false,
  background: "#FEFEFE",
  surface: "#FFFFFF",
  surfaceMuted: "#F5F8FD",
  surfaceIce: "#E8F2FF",
  elevated: "#FFFFFF",
  text: "#171725",
  subtext: "#66707A",
  muted: "#9CA4AB",
  border: "#E9EBED",
  primary: "#2853AF",
  primaryStrong: "#1E4292",
  brandSky: "#40B4F8",
  primaryTint: "#E8F2FF",
  success: "#34977D",
  successTint: "rgba(52, 151, 125, 0.12)",
  warning: "#D97706",
  warningTint: "rgba(217, 119, 6, 0.12)",
  danger: "#F41F52",
  dangerTint: "rgba(244, 31, 82, 0.10)",
  ratingGold: "#EDB900",
  cardOverlay: "rgba(23, 23, 37, 0.56)",
};

export const DarkPalette: ThemePalette = {
  isDark: true,
  background: "#0F131D",
  surface: "#171D2B",
  surfaceMuted: "#1E2638",
  surfaceIce: "rgba(64, 180, 248, 0.14)",
  elevated: "#20293D",
  text: "#F8FAFC",
  subtext: "#A3B1C6",
  muted: "#6E7D94",
  border: "#28334A",
  primary: "#40B4F8",
  primaryStrong: "#2853AF",
  brandSky: "#40B4F8",
  primaryTint: "rgba(64, 180, 248, 0.16)",
  success: "#3FB698",
  successTint: "rgba(63, 182, 152, 0.16)",
  warning: "#F59E0B",
  warningTint: "rgba(245, 158, 11, 0.16)",
  danger: "#FB4B74",
  dangerTint: "rgba(251, 75, 116, 0.16)",
  ratingGold: "#FACC15",
  cardOverlay: "rgba(9, 13, 22, 0.68)",
};

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  screenHorizontal: 20,
} as const;

export const Typography = {
  fontFamilies: {
    display: "System",
    heading: "System",
    body: "System",
  },
  sizes: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    displaySmall: 30,
    displayMedium: 36,
  },
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semiBold: "600" as const,
    bold: "700" as const,
  },
} as const;

export const Radii = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  card: 20,
  pill: 32,
  full: 9999,
} as const;

export const Shadows = {
  cardSubtle: {
    shadowColor: "#171725",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  heroCard: {
    shadowColor: "#171725",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 6,
  },
  ctaButton: {
    shadowColor: "#2853AF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 5,
  },
  floatingBar: {
    shadowColor: "#171725",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

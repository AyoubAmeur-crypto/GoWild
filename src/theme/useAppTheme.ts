import { useColorScheme } from "react-native";
import { DarkPalette, LightPalette, type ThemePalette } from "./tokens";
import { useSettingsStore } from "../stores/useSettingsStore";

export interface AppTheme {
  palette: ThemePalette;
  isDark: boolean;
  reducedMotion: boolean;
}

export function useAppTheme(): AppTheme {
  const systemScheme = useColorScheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const isDark =
    themeMode === "dark" || (themeMode === "system" && systemScheme === "dark");

  return {
    palette: isDark ? DarkPalette : LightPalette,
    isDark,
    reducedMotion,
  };
}


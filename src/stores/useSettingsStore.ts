import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CurrencyCode, LanguageCode } from "../types/domain";

export type ThemeMode = "light" | "dark" | "system";

function createInstallationToken(): string {
  const rand = Math.random().toString(36).slice(2, 12);
  const ts = Date.now().toString(36);
  return `gw_dev_${ts}_${rand}`;
}

interface SettingsState {
  currency: CurrencyCode;
  language: LanguageCode;
  themeMode: ThemeMode;
  darkMode: boolean;
  reducedMotion: boolean;
  notificationsEnabled: boolean;
  priceAlertsEnabled: boolean;
  hasCompletedOnboarding: boolean;
  clientToken: string;
  customApiGatewayUrl: string;
  setCurrency: (currency: CurrencyCode) => void;
  setLanguage: (language: LanguageCode) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setDarkMode: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setPriceAlertsEnabled: (enabled: boolean) => void;
  setCustomApiGatewayUrl: (url: string) => void;
  completeOnboarding: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: "MAD",
      language: "en",
      themeMode: "light",
      darkMode: false,
      reducedMotion: false,
      notificationsEnabled: true,
      priceAlertsEnabled: true,
      hasCompletedOnboarding: false,
      clientToken: createInstallationToken(),
      customApiGatewayUrl: "",

      setCurrency: (currency) => set({ currency }),
      setLanguage: (language) => set({ language }),
      setThemeMode: (themeMode) =>
        set({ themeMode, darkMode: themeMode === "dark" }),
      setDarkMode: (darkMode) =>
        set({ darkMode, themeMode: darkMode ? "dark" : "light" }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setNotificationsEnabled: (notificationsEnabled) =>
        set({ notificationsEnabled }),
      setPriceAlertsEnabled: (priceAlertsEnabled) =>
        set({ priceAlertsEnabled }),
      setCustomApiGatewayUrl: (url) =>
        set({ customApiGatewayUrl: url.trim().replace(/\/+$/, "") }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: "gowild-settings-v2",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

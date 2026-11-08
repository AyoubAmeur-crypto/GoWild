import React from "react";
import { Redirect } from "expo-router";
import { OnboardingScreen } from "../features/hotels/screens/OnboardingScreen";
import { useSettingsStore } from "../stores/useSettingsStore";

export default function WelcomeRoute() {
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding
  );

  if (hasCompletedOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  return <OnboardingScreen />;
}

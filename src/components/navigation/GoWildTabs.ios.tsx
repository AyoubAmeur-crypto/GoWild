import React from "react";
import { NativeTabs } from "expo-router/native-tabs";
import { useAppTheme } from "../../theme/useAppTheme";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { getCopy } from "../../lib/config";

export function GoWildTabs() {
  const { palette } = useAppTheme();
  const language = useSettingsStore((s) => s.language);
  const copy = getCopy(language);

  return (
    <NativeTabs tintColor={palette.primary} minimizeBehavior="automatic">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bookings">
        <NativeTabs.Trigger.Label>{copy.myTrips}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "suitcase", selected: "suitcase.fill" }}
          md={{ default: "luggage", selected: "luggage" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="favorites">
        <NativeTabs.Trigger.Label>{copy.savedHotels}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "heart", selected: "heart.fill" }}
          md={{ default: "favorite", selected: "favorite" }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person", selected: "person.fill" }}
          md={{ default: "person", selected: "person" }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

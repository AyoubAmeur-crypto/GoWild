import React from "react";
import { Platform } from "react-native";
import { GoWildTabs as IOSTabs } from "./GoWildTabs.ios";
import { GoWildTabs as AndroidTabs } from "./GoWildTabs.android";

export function GoWildTabs() {
  if (Platform.OS === "ios") {
    return <IOSTabs />;
  }
  return <AndroidTabs />;
}

import "../global.css";
import React from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { queryClient } from "../lib/queryClient";
import { useAppTheme } from "../theme/useAppTheme";

export default function RootLayout() {
  const { isDark, palette, reducedMotion } = useAppTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reducedMotion ? "none" : "default",
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search/index" />
        <Stack.Screen name="map/index" />
        <Stack.Screen name="hotel/[id]" />
        <Stack.Screen name="booking/review" />
        <Stack.Screen name="booking/confirmation/[id]" />
        <Stack.Screen name="auth/sign-in" />
        <Stack.Screen name="auth/sign-up" />
        <Stack.Screen name="notifications/index" />
      </Stack>
    </QueryClientProvider>
  );
}

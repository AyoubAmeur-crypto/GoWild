import "../global.css";
import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { queryClient } from "../lib/queryClient";
import { useAppTheme } from "../theme/useAppTheme";
import { BrandLogo } from "../components/ui/BrandLogo";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { isDark, palette, reducedMotion } = useAppTheme();
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(
      () => setShowLaunchSplash(false),
      reducedMotion ? 350 : 850
    );
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={showLaunchSplash ? "dark" : isDark ? "light" : "dark"} />
      <View style={styles.root}>
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

        {showLaunchSplash ? (
          <View style={styles.launchSplash} pointerEvents="auto">
            <BrandLogo variant="full" tone="light" height={62} />
          </View>
        ) : null}
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  launchSplash: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
});

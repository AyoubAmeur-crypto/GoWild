import { Tabs } from "expo-router/js-tabs";
import { GoWildGlassTabBar } from "./GoWildGlassTabBar";

export function GoWildTabs() {
  return (
    <Tabs
      tabBar={(props) => <GoWildGlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Explore" }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings" }} />
      <Tabs.Screen name="favorites" options={{ title: "Favorites" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

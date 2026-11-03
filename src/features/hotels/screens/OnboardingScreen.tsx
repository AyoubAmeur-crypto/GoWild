import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight } from "lucide-react-native";
import { BrandLogo } from "../../../components/ui/BrandLogo";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useAuthStore } from "../../../stores/useAuthStore";

// Warm dark espresso-walnut & amber luxury hotel interior (zero blue tones)
// so the #40B4F8 goWild flower mark, white wordmark, and #2853AF button pop sharply.
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1400&q=85";

export const OnboardingScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const user = useAuthStore((s) => s.user);

  const handleStart = () => {
    completeOnboarding();
    router.replace("/(tabs)");
  };

  const handleSignIn = () => {
    completeOnboarding();
    router.push("/auth/sign-in");
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Full-Screen Bleed Warm Luxury Hotel Photograph (No Overlays or Scrims) */}
      <Image
        source={{ uri: HERO_IMAGE }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={260}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top + 16, 40),
            paddingBottom: Math.max(insets.bottom + 20, 34),
          },
        ]}
      >
        {/* Prominent Centered goWild Logo in the Middle of the Screen */}
        <View style={styles.centerLogoStage}>
          <BrandLogo
            variant="full"
            tone="dark"
            height={68}
            style={styles.logoShadow}
          />
        </View>

        {/* Minimal Bottom Copy & High-Contrast Primary Button */}
        <View style={styles.bottomSection}>
          <Text style={styles.headline}>
            Find your next stay, anywhere.
          </Text>

          <View style={styles.actions}>
            <PrimaryButton
              label="Explore Hotels"
              onPress={handleStart}
              icon={<ArrowRight size={18} color="#FFFFFF" />}
              style={styles.ctaShadow}
            />

            {!user ? (
              <Pressable
                onPress={handleSignIn}
                style={styles.secondaryLink}
                accessibilityRole="button"
                accessibilityLabel="Sign in or create traveler account"
              >
                <Text style={styles.secondaryLinkText}>
                  Have an account?{" "}
                  <Text style={styles.secondaryLinkAccent}>Sign In</Text>
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1E1814",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  centerLogoStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 8,
  },
  bottomSection: {
    gap: 16,
  },
  headline: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    letterSpacing: -0.4,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.7)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  actions: {
    gap: 10,
  },
  ctaShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  secondaryLink: {
    paddingVertical: 6,
    alignItems: "center",
  },
  secondaryLinkText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  secondaryLinkAccent: {
    color: "#40B4F8",
    fontWeight: "700",
  },
});

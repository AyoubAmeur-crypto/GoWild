import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  ChevronRight,
  Globe,
  Moon,
  Sparkles,
  LifeBuoy,
  LogOut,
  UserCheck,
} from "lucide-react-native";
import type { CurrencyCode, LanguageCode } from "../../../types/domain";
import { useAppTheme } from "../../../theme/useAppTheme";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useAuthStore } from "../../../stores/useAuthStore";
import { AppConfig, getCopy } from "../../../lib/config";
import { BrandLogo } from "../../../components/ui/BrandLogo";
import { GlassSwitch } from "../../../components/ui/GlassSwitch";
import { PrimaryButton } from "../../../components/ui/PrimaryButton";
import {
  useLogoutAction,
  useUpdateProfileMutation,
} from "../../auth/hooks/useAuthActions";
import { EditProfileModal } from "../components/EditProfileModal";

const CURRENCIES: CurrencyCode[] = ["USD", "EUR", "GBP", "MAD", "JPY"];
const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

export const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, isDark } = useAppTheme();

  const user = useAuthStore((s) => s.user);
  const currency = useSettingsStore((s) => s.currency);
  const language = useSettingsStore((s) => s.language);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const priceAlertsEnabled = useSettingsStore((s) => s.priceAlertsEnabled);

  const setCurrency = useSettingsStore((s) => s.setCurrency);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setDarkMode = useSettingsStore((s) => s.setDarkMode);
  const setReducedMotion = useSettingsStore((s) => s.setReducedMotion);
  const setNotificationsEnabled = useSettingsStore(
    (s) => s.setNotificationsEnabled
  );
  const setPriceAlertsEnabled = useSettingsStore(
    (s) => s.setPriceAlertsEnabled
  );

  const [editModalOpen, setEditModalOpen] = useState(false);

  const updateProfileMutation = useUpdateProfileMutation();
  const logout = useLogoutAction();
  const copy = getCopy(language);

  const handleCurrencySelect = (next: CurrencyCode) => {
    setCurrency(next);
    if (user) {
      updateProfileMutation.mutate({ preferredCurrency: next });
    }
  };

  const handleLanguageSelect = (next: LanguageCode) => {
    setLanguage(next);
    if (user) {
      updateProfileMutation.mutate({ preferredLanguage: next });
    }
  };

  const bottomPad = Platform.OS === "android" ? 112 : 40;

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 12, 22),
            paddingBottom: bottomPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: palette.text }]}>
          {copy.profileAndSettings}
        </Text>

        {/* Traveler Account Card */}
        {user ? (
          <View
            style={[
              styles.accountCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.accountTop}>
              <View
                style={[
                  styles.avatarCircle,
                  { backgroundColor: palette.primary },
                ]}
              >
                <Text style={styles.avatarInitials}>
                  {user.firstName.slice(0, 1).toUpperCase()}
                  {user.lastName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.verifiedRow}>
                  <Text style={[styles.userName, { color: palette.text }]}>
                    {user.firstName} {user.lastName}
                  </Text>
                  <UserCheck size={15} color={palette.success} />
                </View>
                <Text style={[styles.userEmail, { color: palette.subtext }]}>
                  {user.email}
                </Text>
                <Text style={[styles.userPhone, { color: palette.muted }]}>
                  {user.phone}
                  {user.nationality ? ` · ${user.nationality}` : ""}
                </Text>
              </View>
            </View>

            <View style={styles.accountButtons}>
              <PrimaryButton
                label="Edit Traveler Details"
                variant="secondary"
                onPress={() => setEditModalOpen(true)}
                style={styles.compactBtn}
              />
              <Pressable
                onPress={logout}
                style={[
                  styles.signOutBtn,
                  { borderColor: palette.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <LogOut size={16} color={palette.danger} />
                <Text style={[styles.signOutText, { color: palette.danger }]}>
                  Sign Out
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.accountCard,
              {
                backgroundColor: palette.surface,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.guestBrandRow}>
              <BrandLogo variant="mark" height={42} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.userName, { color: palette.text }]}>
                  goWild Traveler Account
                </Text>
                <Text style={[styles.userEmail, { color: palette.subtext }]}>
                  Sign in to pre-fill guest checkout details and sync trips &
                  saved stays.
                </Text>
              </View>
            </View>
            <View style={styles.guestBtnRow}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Sign In"
                  onPress={() => router.push("/auth/sign-in")}
                  style={styles.compactBtn}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Create Account"
                  variant="secondary"
                  onPress={() => router.push("/auth/sign-up")}
                  style={styles.compactBtn}
                />
              </View>
            </View>
          </View>
        )}

        {/* Currency & Language Preferences */}
        <View
          style={[
            styles.groupCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={styles.groupHeader}>
            <Globe size={16} color={palette.primary} />
            <Text style={[styles.groupTitle, { color: palette.text }]}>
              Currency & Language
            </Text>
          </View>

          <Text style={[styles.subLabel, { color: palette.subtext }]}>
            Display Currency
          </Text>
          <View style={styles.pillRow}>
            {CURRENCIES.map((c) => {
              const selected = currency === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => handleCurrencySelect(c)}
                  style={[
                    styles.optionPill,
                    {
                      backgroundColor: selected
                        ? palette.primary
                        : palette.surfaceMuted,
                      borderColor: selected ? palette.primary : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      { color: selected ? "#FFFFFF" : palette.text },
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.subLabel, { color: palette.subtext }]}>
            Interface Language
          </Text>
          <View style={styles.pillRow}>
            {LANGUAGES.map((l) => {
              const selected = language === l.code;
              return (
                <Pressable
                  key={l.code}
                  onPress={() => handleLanguageSelect(l.code)}
                  style={[
                    styles.optionPill,
                    {
                      backgroundColor: selected
                        ? palette.primary
                        : palette.surfaceMuted,
                      borderColor: selected ? palette.primary : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      { color: selected ? "#FFFFFF" : palette.text },
                    ]}
                  >
                    {l.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Appearance & Accessibility */}
        <View
          style={[
            styles.groupCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={styles.groupHeader}>
            <Moon size={16} color={palette.primary} />
            <Text style={[styles.groupTitle, { color: palette.text }]}>
              Appearance & Motion
            </Text>
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: palette.text }]}>
                Dark Mode
              </Text>
              <Text style={[styles.settingSub, { color: palette.subtext }]}>
                Charcoal midnight theme across screens
              </Text>
            </View>
            <GlassSwitch
              value={isDark}
              onValueChange={setDarkMode}
              accessibilityLabel="Toggle dark mode"
            />
          </View>

          <View
            style={[styles.divider, { backgroundColor: palette.border }]}
          />

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: palette.text }]}>
                Reduce Motion
              </Text>
              <Text style={[styles.settingSub, { color: palette.subtext }]}>
                Minimize spring transitions for comfort
              </Text>
            </View>
            <GlassSwitch
              value={reducedMotion}
              onValueChange={setReducedMotion}
              accessibilityLabel="Toggle reduced motion"
            />
          </View>
        </View>

        {/* Notifications & Support */}
        <View
          style={[
            styles.groupCard,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <View style={styles.groupHeader}>
            <Bell size={16} color={palette.primary} />
            <Text style={[styles.groupTitle, { color: palette.text }]}>
              Notifications & Support
            </Text>
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: palette.text }]}>
                Reservation Status Updates
              </Text>
              <Text style={[styles.settingSub, { color: palette.subtext }]}>
                Confirmations, check-in reminders, cancellations
              </Text>
            </View>
            <GlassSwitch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
            />
          </View>

          <View
            style={[styles.divider, { backgroundColor: palette.border }]}
          />

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: palette.text }]}>
                Saved Hotel Rate Alerts
              </Text>
              <Text style={[styles.settingSub, { color: palette.subtext }]}>
                Notify when shortlisted stays drop in price
              </Text>
            </View>
            <GlassSwitch
              value={priceAlertsEnabled}
              onValueChange={setPriceAlertsEnabled}
            />
          </View>

          <View
            style={[styles.divider, { backgroundColor: palette.border }]}
          />

          <Pressable
            onPress={() => router.push("/notifications")}
            style={styles.navRow}
          >
            <Sparkles size={16} color={palette.primary} />
            <Text style={[styles.navRowText, { color: palette.text }]}>
              Open Notification Center
            </Text>
            <ChevronRight size={17} color={palette.muted} />
          </Pressable>

          <View
            style={[styles.divider, { backgroundColor: palette.border }]}
          />

          <Pressable
            onPress={() =>
              Linking.openURL(`mailto:${AppConfig.supportEmail}`).catch(
                () => {}
              )
            }
            style={styles.navRow}
          >
            <LifeBuoy size={16} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.navRowText, { color: palette.text }]}>
                Contact 24/7 Travel Support
              </Text>
              <Text style={[styles.settingSub, { color: palette.subtext }]}>
                {AppConfig.supportEmail} · {AppConfig.supportPhone}
              </Text>
            </View>
            <ChevronRight size={17} color={palette.muted} />
          </Pressable>
        </View>
      </ScrollView>

      {user ? (
        <EditProfileModal
          visible={editModalOpen}
          user={user}
          loading={updateProfileMutation.isPending}
          onClose={() => setEditModalOpen(false)}
          onSave={(vals) => {
            updateProfileMutation.mutate(vals, {
              onSuccess: () => setEditModalOpen(false),
            });
          }}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  accountCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  accountTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userName: {
    fontSize: 17,
    fontWeight: "700",
  },
  userEmail: {
    fontSize: 13,
    lineHeight: 18,
  },
  userPhone: {
    fontSize: 12,
  },
  accountButtons: {
    gap: 8,
  },
  guestBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  guestBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  compactBtn: {
    minHeight: 44,
    paddingVertical: 11,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: "700",
  },
  groupCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  subLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  optionPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  settingSub: {
    fontSize: 12,
    marginTop: 1,
  },
  divider: {
    height: 1,
    width: "100%",
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  navRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
});

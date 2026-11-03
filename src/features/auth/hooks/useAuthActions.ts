import { useMutation, useQueryClient } from "@tanstack/react-query";
import { goWildApi } from "../../../services/http/apiClient";
import { useAuthStore } from "../../../stores/useAuthStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useFavoritesStore } from "../../../stores/favoritesStore";
import type { AuthLoginInput, AuthRegisterInput } from "../../../lib/validation";
import type { CurrencyCode, LanguageCode } from "../../../types/domain";

export function useLoginMutation() {
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const setCurrency = useSettingsStore((s) => s.setCurrency);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setFavoriteIds = useFavoritesStore((s) => s.setFavoriteIds);

  return useMutation({
    mutationFn: (input: AuthLoginInput) => goWildApi.login(input),
    onSuccess: async ({ token, user }) => {
      setSession(token, user);
      setCurrency(user.preferredCurrency);
      setLanguage(user.preferredLanguage);
      try {
        const remoteFavs = await goWildApi.getFavorites();
        setFavoriteIds(remoteFavs.hotelIds);
      } catch {
        // non-blocking favorite sync
      }
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useRegisterMutation() {
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (input: AuthRegisterInput) => goWildApi.register(input),
    onSuccess: ({ token, user }) => {
      setSession(token, user);
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useUpdateProfileMutation() {
  const updateUser = useAuthStore((s) => s.updateUser);
  const setCurrency = useSettingsStore((s) => s.setCurrency);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  return useMutation({
    mutationFn: (patch: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      nationality?: string;
      preferredCurrency?: CurrencyCode;
      preferredLanguage?: LanguageCode;
    }) => goWildApi.updateProfile(patch),
    onSuccess: ({ user }) => {
      updateUser(user);
      setCurrency(user.preferredCurrency);
      setLanguage(user.preferredLanguage);
    },
  });
}

export function useLogoutAction() {
  const qc = useQueryClient();
  const clearSession = useAuthStore((s) => s.clearSession);

  return async () => {
    try {
      await goWildApi.logout();
    } catch {
      // clear local session even if network is unreachable
    }
    clearSession();
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
}


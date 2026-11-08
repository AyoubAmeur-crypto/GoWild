import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthenticatedUser } from "../types/domain";

interface AuthState {
  token: string | null;
  user: AuthenticatedUser | null;
  setSession: (token: string, user: AuthenticatedUser) => void;
  updateUser: (user: AuthenticatedUser) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,

      setSession: (token, user) => set({ token, user }),
      updateUser: (user) => set({ user }),
      clearSession: () => set({ token: null, user: null }),
    }),
    {
      name: "gowild-firebase-profile-v2",
      partialize: (state) => ({ user: state.user }),
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

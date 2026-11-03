import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface FavoritesState {
  favoriteIds: string[];
  toggleFavoriteLocal: (id: string) => boolean;
  setFavoriteIds: (ids: string[]) => void;
  isFavorite: (id: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favoriteIds: [],

      toggleFavoriteLocal: (id: string) => {
        const { favoriteIds } = get();
        const exists = favoriteIds.includes(id);
        if (exists) {
          set({ favoriteIds: favoriteIds.filter((item) => item !== id) });
          return false;
        }
        set({ favoriteIds: [id, ...favoriteIds] });
        return true;
      },

      setFavoriteIds: (ids: string[]) => {
        set({ favoriteIds: Array.from(new Set(ids)) });
      },

      isFavorite: (id: string) => {
        return get().favoriteIds.includes(id);
      },
    }),
    {
      name: "gowild-favorites-v2",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

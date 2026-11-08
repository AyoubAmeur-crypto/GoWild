import { onIdTokenChanged } from "firebase/auth";
import { firebaseAuth } from "./client";
import { useAuthStore } from "../../stores/useAuthStore";
import { queryClient } from "../../lib/queryClient";
import { useFavoritesStore } from "../../stores/favoritesStore";
import { goWildApi } from "../http/apiClient";

export function observeFirebaseSession(): () => void {
  try {
    return onIdTokenChanged(firebaseAuth(), async (identity) => {
      const previousId = useAuthStore.getState().user?.id;
      if (previousId !== identity?.uid) {
        await queryClient.cancelQueries();
        queryClient.clear();
        useAuthStore.getState().clearSession();
        useFavoritesStore.getState().setFavoriteIds([]);
      }
      if (!identity) { useAuthStore.getState().clearSession(); return; }
      try {
        const { user } = await goWildApi.getMe();
        if (firebaseAuth().currentUser?.uid === identity.uid) useAuthStore.getState().setSession(await identity.getIdToken(), user);
      } catch {
        // SDK owns auth persistence; the next profile request surfaces backend errors.
      }
    });
  } catch {
    useAuthStore.getState().clearSession();
    return () => {};
  }
}

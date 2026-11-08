import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FirebaseAuth from "firebase/auth";
import type { Persistence } from "firebase/auth";
import type { FirebaseApp } from "firebase/app";
export function initializePersistedAuth(app: FirebaseApp) {
  // Firebase's web declaration omits this export; Metro selects the RN implementation.
  const nativeAuth = FirebaseAuth as typeof FirebaseAuth & { getReactNativePersistence(storage: typeof AsyncStorage): Persistence };
  return nativeAuth.initializeAuth(app, { persistence: nativeAuth.getReactNativePersistence(AsyncStorage) });
}

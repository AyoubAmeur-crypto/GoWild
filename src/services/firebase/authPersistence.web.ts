import { browserLocalPersistence, initializeAuth, inMemoryPersistence } from "firebase/auth";
import type { FirebaseApp } from "firebase/app";
export function initializePersistedAuth(app: FirebaseApp) {
  return initializeAuth(app, { persistence: typeof window === "undefined" ? inMemoryPersistence : browserLocalPersistence });
}

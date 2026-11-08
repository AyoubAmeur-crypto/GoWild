import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { getFirebaseApp, functionsRegion } from "./config";
import { initializePersistedAuth } from "./authPersistence";

let authClient: Auth | undefined;
let functionsClient: Functions | undefined;
export function firebaseAuth(): Auth {
  if (!authClient) {
    const app = getFirebaseApp();
    try { authClient = initializePersistedAuth(app); }
    catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/already-initialized") authClient = getAuth(app);
      else throw error;
    }
    if (__DEV__ && process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
      const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ?? "127.0.0.1";
      connectAuthEmulator(authClient, `http://${host}:9099`, { disableWarnings: true });
    }
  }
  return authClient;
}
export function firebaseFunctions(): Functions {
  firebaseAuth(); // Auth and callable SDKs must share the same app instance.
  if (!functionsClient) {
    functionsClient = getFunctions(getFirebaseApp(), functionsRegion);
    if (__DEV__ && process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
      connectFunctionsEmulator(functionsClient, process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ?? "127.0.0.1", 5001);
    }
  }
  return functionsClient;
}

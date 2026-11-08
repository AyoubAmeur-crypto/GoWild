// Development CLI only: exercises the same Firebase callable SDK as Expo.
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from "firebase/auth";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
const email = process.env.GOWILD_TEST_EMAIL;
const password = process.env.GOWILD_TEST_PASSWORD;
if (!email || !password || Object.values(config).some((value) => !value)) {
  console.error("Set the public Firebase configuration plus GOWILD_TEST_EMAIL and GOWILD_TEST_PASSWORD for an existing test account. No service-account key is used.");
  process.exit(1);
}
const app = initializeApp(config);
try {
  const auth = getAuth(app);
  const functions = getFunctions(app, "europe-west1");
  if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
    const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFunctionsEmulator(functions, host, 5001);
  }
  await signInWithEmailAndPassword(auth, email, password);
  const response = await httpsCallable(functions, "testConnection")({});
  if (response.data?.success !== true) throw new Error("testConnection did not return success.");
  console.log(JSON.stringify(response.data, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Verification failed.");
  process.exitCode = 1;
} finally {
  await deleteApp(app);
}

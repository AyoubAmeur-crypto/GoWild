import { getApp, getApps, initializeApp } from "firebase/app";

export const firebasePublicConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
};
export const functionsRegion = "europe-west1";
export const hotelCallable = process.env.EXPO_PUBLIC_HOTEL_PROVIDER === "duffel" ? "duffelApi" : "liteApi";
export const googlePublicConfig = {
  ...firebasePublicConfig,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
};

export function getFirebaseApp() {
  if (!firebasePublicConfig.apiKey || !firebasePublicConfig.projectId || !firebasePublicConfig.appId || !firebasePublicConfig.authDomain) {
    throw new Error("Firebase public configuration is missing. Follow README/FIREBASE_PUBLIC_CONFIG.md and restart Expo.");
  }
  return getApps().some((app) => app.name === "gowild") ? getApp("gowild") : initializeApp(firebasePublicConfig, "gowild");
}

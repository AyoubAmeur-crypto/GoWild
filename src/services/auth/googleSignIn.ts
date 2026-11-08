import Constants, { ExecutionEnvironment } from "expo-constants";

export interface GoogleAuthConfig {
  apiKey: string;
  projectId: string;
  authDomain: string;
  googleWebClientId: string;
  googleIosClientId: string;
}

export async function getGoogleCredential(config: GoogleAuthConfig): Promise<{ idToken: string; tokenKind: "google" | "firebase" }> {
  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    (Constants as unknown as { appOwnership?: string }).appOwnership === "expo";

  if (isExpoGo) {
    throw new Error(
      "Google Sign-In is unavailable in Expo Go because the native 'RNGoogleSignin' module is not bundled in Expo Go. In Expo Go, please sign in or register below with Email & Password, or build the standalone APK."
    );
  }

  let GoogleSigninModule;
  try {
    GoogleSigninModule = await import("@react-native-google-signin/google-signin");
  } catch {
    throw new Error(
      "Google Sign-In native module ('RNGoogleSignin') is not registered in this binary. You are running in Expo Go. Please use Email & Password below, or install the standalone APK build."
    );
  }

  const { GoogleSignin, isSuccessResponse } = GoogleSigninModule;
  if (!config.googleWebClientId) throw new Error("Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in the public app configuration.");
  GoogleSignin.configure({ webClientId: config.googleWebClientId, iosClientId: config.googleIosClientId || undefined });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (!isSuccessResponse(result)) throw new Error("Google sign-in was cancelled.");
  if (!result.data.idToken) throw new Error("Google did not return an identity token.");
  return { idToken: result.data.idToken, tokenKind: "google" };
}

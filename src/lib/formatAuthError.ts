export function formatAuthError(error: unknown): string {
  if (!error) return "An unexpected error occurred.";
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes("auth/email-already-in-use")) {
    return "This email address is already registered. Please sign in with your password, or use a different email.";
  }
  if (
    raw.includes("auth/invalid-credential") ||
    raw.includes("auth/wrong-password") ||
    raw.includes("auth/user-not-found")
  ) {
    return "Incorrect email address or password. Please verify your credentials and try again.";
  }
  if (raw.includes("auth/weak-password")) {
    return "Password is too weak. Please use at least 8 characters.";
  }
  if (raw.includes("auth/invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (raw.includes("auth/operation-not-allowed")) {
    return "Email/Password sign-in is not enabled in Firebase Console. Please enable Email/Password under Authentication → Sign-in method in Firebase Console.";
  }
  if (raw.includes("auth/too-many-requests")) {
    return "Access to this account has been temporarily disabled due to many failed login attempts. Please try again later or reset your password.";
  }
  if (raw.includes("auth/network-request-failed")) {
    return "Network error. Please check your internet connection.";
  }
  if (raw.includes("storeClient") || raw.includes("Expo Go")) {
    return "Google Sign-In is unavailable in Expo Go because it requires native libraries. In Expo Go, please sign in or register below using Email & Password (or use an EAS APK build).";
  }

  const match = raw.match(/auth\/([a-z-]+)/);
  if (match) {
    return `Authentication failed (${match[1]}). Please check your input and try again.`;
  }

  return raw;
}


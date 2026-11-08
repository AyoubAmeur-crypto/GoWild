import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { firebaseAuth } from "../firebase/client";
import type { GoogleAuthConfig } from "./googleSignIn";
export async function getGoogleCredential(_config: GoogleAuthConfig): Promise<{ idToken: string; tokenKind: "google" | "firebase" }> {
  const result = await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
  return { idToken: await result.user.getIdToken(), tokenKind: "firebase" };
}

# Public Firebase and native build configuration

These values identify the app and are bundled into Expo. They are **not supplier secrets or service-account credentials**. The supplied project configuration is saved in the ignored root `.env`; `.firebaserc` selects `gowild-d3b29` for Firebase CLI operations. Copy `.env.example` on another machine, then restart Metro after changes.

| Variable | Value / where to find it |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project settings → General → registered Web app; the supplied value is in local `.env` |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | `gowild-d3b29.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | `gowild-d3b29` |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | `1:713960465346:web:44b68963f16dd20866ac5b` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `713960465346` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | `gowild-d3b29.firebasestorage.app` (optional; Storage is not used by this backend) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `713960465346-06l42vj4rqlvvbs17fck4nn9k4unb1i9.apps.googleusercontent.com` — Web OAuth client (`client_type: 3`) from the supplied Android JSON; also used by native Google sign-in |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | `713960465346-7blpqulvasfkobjngl4h0in7kaiprhe2.apps.googleusercontent.com` — `CLIENT_ID` from the supplied iOS plist for `com.gowild.app` |
| `EXPO_PUBLIC_HOTEL_PROVIDER` | `liteapi` (default) or `duffel`; deploy the corresponding callable |
| `EXPO_PUBLIC_USE_FIREBASE_EMULATORS` | `false` for hosted Firebase; `true` only in development with the demo project |
| `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` | `127.0.0.1` on desktop, `10.0.2.2` in Android emulator, or your computer's LAN IP for a physical device |
| `GOOGLE_MAPS_ANDROID_API_KEY` | Existing native build variable: restrict key to Android Maps SDK, package and signing fingerprints |

Functions region is fixed in client and server code to **`europe-west1`**. There is no API base URL, localhost BFF discovery, custom server session token, or standalone server port to configure.

The supplied measurement ID `G-Z7QJ40KL8E` is optional and is not initialized. Firebase Analytics is not needed for Authentication or callable functions, and the web Analytics snippet must not be used directly in the native app.

Enable **Email/Password** and **Google** in Firebase Authentication. Add `localhost` and the deployed web domain to Authorized domains where appropriate. Register Android package and iOS bundle identifier `com.gowild.app`, including Android development/Play signing fingerprints. Native Google sign-in requires a development build; the configured plugin reads the iOS callback scheme from the plist. No map, navigation, or screen design changes are part of this migration.

All backend operations require an email/password or Google Firebase session. Guest discovery now returns a sign-in-required error; anonymous sign-in is not enabled automatically. Firestore direct access remains denied even when signed in. The Functions SDK automatically attaches the current Firebase ID token and refreshes it through Firebase Auth.

See [setup/deployment](./FIREBASE_SETUP.md) and the separate [secret names](./FIREBASE_SECRETS.md).

## Android Google Sign-In audit — 2026-11-06

`app.json` sets `android.googleServicesFile` to `./google-services.json`; the existing `app.config.ts` preserves that Android configuration. The supplied JSON identifies project `gowild-d3b29` (number `713960465346`), Android package `com.gowild.app`, and Android Firebase app `1:713960465346:android:a8322a765bbfa3b166ac5b`. Keep the existing Firebase **Web app** configuration in `.env`: the Firebase JS SDK uses it on native platforms too. The Android JSON does not replace those environment variables.

The supplied Web OAuth client ID is now set in the ignored local `.env`. The existing native flow obtains a Google ID token, passes it to `GoogleAuthProvider.credential`, then calls Firebase `signInWithCredential` before fetching the authenticated `getProfile` callable. No React Native Firebase SDK or backend authentication changes are required. Installed Expo prebuild defaults already copy the Android JSON and apply the Google Services Gradle plugin when this file setting is present. The iOS plugin is now configured as described below.

Remaining external checks:

- The supplied JSON has no Android OAuth client (`client_type: 1`) or `android_info.certificate_hash`. This suggests the download predates Android signing registration; it does **not** prove the current console has no fingerprints. No project keystore or generated Android signing report is present locally.
- In Firebase project settings, select Android app `com.gowild.app` and verify the **SHA-1** for the certificate that signs the development build. Also register the corresponding SHA-256; verify EAS/release and Google Play app-signing certificates separately when those builds are used. SHA-1 is the Google Sign-In requirement; SHA-256 does not substitute for it. Obtain actual values from the build's signing report, EAS credentials, or Play Console rather than guessing.
- Confirm Google is enabled in Firebase Authentication. After adding fingerprints, download a fresh `google-services.json`; verify Android OAuth clients match the package and SHA-1. Android OAuth IDs are registered in Google/Firebase, not passed as `webClientId` in this implementation.
- iOS configuration is now supplied by the separate iOS plist, as described below. These values cannot be derived from this Android JSON.
- Rebuild/install the Android development app and complete real Google account consent. Expo Go cannot run this native module. Local unit/emulator/export checks do not verify Google consent, the installed app's certificate, or hosted provider enablement. The app also needs its existing `getProfile` callable available in the selected environment to complete the full sign-in flow.

References: [Google Sign-In configuration and SHA-1 registration](https://react-native-google-signin.github.io/docs/setting-up/get-config-file), [Firebase Google provider setup](https://firebase.google.com/docs/auth/android/google-signin), [Expo development build requirements](https://react-native-google-signin.github.io/docs/setting-up/expo).

## iOS Firebase and Google Sign-In audit — 2026-11-06

`app.json` sets `ios.googleServicesFile` to `./GoogleService-Info.plist` and preserves bundle identifier `com.gowild.app`. The plist matches project `gowild-d3b29`, project number `713960465346`, and iOS Firebase app `1:713960465346:ios:27b80f4e9d6ed94f66ac5b`. Its `CLIENT_ID` is populated in ignored local `.env` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; the existing Web OAuth ID remains unchanged. Keep the existing Firebase JS Web app identifiers in `.env` for SDK initialization.

The installed `@react-native-google-signin/google-signin` v17 plugin is registered once, without options, in `app.json`. This activates its Firebase plist mode: it copies the plist into the native app and adds `REVERSED_CLIENT_ID` to `CFBundleURLTypes`. Expo introspection verifies the exact callback scheme `com.googleusercontent.apps.713960465346-7blpqulvasfkobjngl4h0in7kaiprhe2`, alongside the existing `gowild` deep link. The previous conditional plugin entry in `app.config.ts` was removed; `GOOGLE_IOS_URL_SCHEME` is no longer needed or read. No manual duplicate URL type is necessary.

The existing `GoogleSignin.configure` receives both the Web and iOS client IDs, then passes Google's ID token through Firebase `GoogleAuthProvider.credential` and `signInWithCredential` before requesting the authenticated profile. The installed library's `hasPlayServices` safely returns true on iOS. No auth code changes are needed. The plist's `IS_SIGNIN_ENABLED: true` is a local configuration value, not verification of the current hosted Firebase provider settings.

Apple Maps is preserved: no iOS Maps key, Google Maps provider, Google Maps SDK dependency, or native Firebase SDK was added. The existing maps plugin receives only its Android key option, and the map component selects Google only on Android.

No local iOS OAuth identifiers are missing. Still required before claiming live success: confirm Google is enabled in hosted Firebase Authentication and the consent configuration allows the test account; rebuild/install an iOS development app with these native settings and complete real Google consent/callback/session verification. Expo Go cannot load this native module. The existing authenticated `getProfile` callable must be available in the chosen environment to finish app sign-in. No cloud deployment or settings changes were performed.

References: [installed-library Expo Firebase plugin mode](https://react-native-google-signin.github.io/docs/setting-up/expo), [GoogleSignin client ID configuration](https://react-native-google-signin.github.io/docs/original).

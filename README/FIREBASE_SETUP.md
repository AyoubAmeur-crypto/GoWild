# goWild managed Firebase backend

The backend is now **Firebase Cloud Functions v2 in Python 3.12**, configured to deploy in **`europe-west1`**. Expo uses Firebase Authentication and `httpsCallable`; Firestore is accessible only through authenticated callable functions. There is no standalone Node/Express server, BFF session database, REST proxy, Docker deployment, or manually provisioned Cloud Run service.

Firebase manages the underlying infrastructure for Functions v2. You deploy through Firebase CLI rather than separately managing that infrastructure. Existing app screens, navigation, and maps are preserved.

## 1. Prepare your Firebase project

Project: **`gowild-d3b29`** (selected in `.firebaserc`). The public configuration you supplied has been saved in the ignored root `.env`. See [public configuration](./FIREBASE_PUBLIC_CONFIG.md); supplier secret names are separately documented in [FIREBASE_SECRETS.md](./FIREBASE_SECRETS.md).

In [Firebase Console](https://console.firebase.google.com/):

1. Select `gowild-d3b29` and enable the **Blaze billing plan**, which Firebase requires for deploying functions. Configure a budget alert appropriate to your usage; do not assume a free-tier allowance is a spending cap.
2. Create the **Cloud Firestore Standard / Native-mode `(default)` database** with production rules. Prefer a location compatible with your EU data requirements; deployed functions are fixed to `europe-west1`. An existing database's region is not changed by this code.
3. Enable **Authentication → Email/Password** and **Google**. Configure authorized web domains and Google's support/consent settings. Create a dedicated test user for the first connection check.
4. Native Google login still needs the existing Android/iOS registrations, signing certificate fingerprints, and public OAuth IDs. Both identifiers are `com.gowild.app`. See [public configuration](./FIREBASE_PUBLIC_CONFIG.md).

Firebase Auth is the identity source. The SDK manages persistence and token refresh; passwords are sent to Firebase Auth, not to our functions or Firestore. There is no automatic anonymous login: sign in before using backend discovery or account features.

Official references: [Functions getting started and billing prerequisite](https://firebase.google.com/docs/functions/get-started), [callable functions](https://firebase.google.com/docs/functions/callable).

## 2. Install deployment dependencies

From the repository root, with Node/npm and Python 3.12 available:

```sh
npm install
python3.12 -m venv functions/venv
functions/venv/bin/pip install -r functions/requirements.txt
npx --yes --package firebase-tools firebase login
```

The CLI needs permission to deploy Functions and Firestore rules to the selected project. Functions use their managed runtime service account for Admin SDK access. **Do not download or place a service-account private key in the app or repository.** No `GOOGLE_APPLICATION_CREDENTIALS` file is needed for this workflow.

## 3. First deploy: authenticated testConnection

This function binds **no supplier secrets**, so deploy it before connecting hotel providers:

```sh
npx --yes --package firebase-tools firebase deploy --only firestore,functions:gowild:testConnection --project gowild-d3b29
```

`gowild` is the codebase declared in `firebase.json`; `testConnection` is the function name. On the first deployment, Firebase may ask to enable required build/runtime APIs and configure artifact cleanup. Review the Firebase CLI's project and billing details.

The function:

1. Rejects missing/invalid Firebase Authentication (`unauthenticated`).
2. Uses the verified `request.auth.uid`, never an owner supplied in request data.
3. Writes `connection_tests/{uid}` with the UID, region, and timestamp.
4. Returns `{ success: true, uid, region: "europe-west1", documentPath, checkedAt }` only after the write completes.

### Verify the hosted function

Create an email/password test user in Firebase Authentication. The development verification script signs in through the public Firebase SDK, then calls `testConnection` with the same Functions SDK used by Expo. It requires no Admin credentials.

For the repository's zsh shell, enter test credentials without putting the password in shell history:

```sh
read 'GOWILD_TEST_EMAIL?Firebase test email: '
read -s 'GOWILD_TEST_PASSWORD?Firebase test password: '
export GOWILD_TEST_EMAIL GOWILD_TEST_PASSWORD
npm run firebase:test-connection
unset GOWILD_TEST_EMAIL GOWILD_TEST_PASSWORD
```

The script loads public configuration from `.env`, authenticates the test account, and prints only the success response. In Firebase Console → Firestore, verify the matching `connection_tests/{uid}` document. A browser trying to read/write that document directly through the Firestore SDK or REST API must receive `permission-denied`, including while signed in. Firebase Console/Admin SDK access is controlled separately by IAM.

Expo code can call the existing exported helper after signing in:

```ts
import { goWildApi } from "./src/services/http/apiClient";
const result = await goWildApi.testConnection();
```

Do not initialize the provided web Analytics snippet in the native app. Analytics is optional and not used here.

## 4. Deploy the account functions

```sh
npx --yes --package firebase-tools firebase deploy --only functions:gowild:getProfile,functions:gowild:updateProfile,functions:gowild:getFavorites,functions:gowild:setFavorite,functions:gowild:listBookings,functions:gowild:getNotifications --project gowild-d3b29
```

| Callable | Request | Result |
| --- | --- | --- |
| `getProfile` | `{}` | `{ user }`; creates a UID-owned profile on first use |
| `updateProfile` | `{ patch }` | `{ user }`; validates an allowlist of traveler fields |
| `getFavorites` | `{}` | `{ hotelIds }` |
| `setFavorite` | `{ hotelId, saved }` | `{ hotelIds }` |
| `listBookings` | `{}` | `{ bookings }` for the authenticated UID |
| `getNotifications` | `{}` | `{ notifications }` derived from that user's reservations |

All callables require Firebase Authentication. Firestore rules deny **every** direct client read and write; Admin operations are only initiated by functions after authentication. No client-supplied user ID or legacy client token controls ownership.

Stored domain data lives under `users/{uid}` with favorites, cached hotel/offer snapshots, private quotes, reservation submission claims, and booking receipts in subcollections. Existing SQLite backups are preserved but are not used or automatically imported. Old BFF sessions are discarded; sign in with Firebase.

## 5. Configure and deploy one sandbox hotel provider

Choose the provider in the public Expo flag `EXPO_PUBLIC_HOTEL_PROVIDER`. Keep the actual credential in Secret Manager.

### LiteAPI

Obtain a **sandbox** key in the [LiteAPI dashboard](https://dashboard.liteapi.travel/), then:

```sh
npx --yes --package firebase-tools firebase functions:secrets:set LITEAPI_KEY --project gowild-d3b29
npx --yes --package firebase-tools firebase deploy --only functions:gowild:liteApi --project gowild-d3b29
```

Set `EXPO_PUBLIC_HOTEL_PROVIDER=liteapi` in local/build public configuration, then restart Expo.

### Duffel Stays

Obtain a **test** token with Stays access in the [Duffel dashboard](https://app.duffel.com/), then:

```sh
npx --yes --package firebase-tools firebase functions:secrets:set DUFFEL_ACCESS_TOKEN --project gowild-d3b29
npx --yes --package firebase-tools firebase deploy --only functions:gowild:duffelApi --project gowild-d3b29
```

Set `EXPO_PUBLIC_HOTEL_PROVIDER=duffel`, then restart Expo. This adapter requires a map location for destination searches; it does not fabricate place autocomplete results or silently convert supplier currencies. Repeat a search when dates/occupancy/currency change, because Duffel search-result IDs are contextual.

Each supplier callable accepts `{ action, ...data }` for `health`, `places` (LiteAPI), `featured`, `search`, `detail`, `offers`, `revalidate`, `book`, `booking`, or `cancel`. The typed `goWildApi` facade handles these requests so existing screen components do not change.

**Sandbox is enforced in code.** LiteAPI keys must start with `sand_`; Duffel tokens must start with `duffel_test_`. Other keys are rejected before any upstream request. No live traveler payment collection or production booking override is enabled. Sandbox reservations are marked `isSandbox=true`; only explicit supplier confirmation marks them confirmed. Cancellation status is verified with the supplier before being recorded as cancelled.

Quotes are user-owned and bound to the selected hotel, rate, dates, occupancy, currency and provider. Supplier prebook/quote tokens remain in private Firestore documents. Before booking, a Firestore transaction claims both the quote and idempotency key. A duplicate request returns the same receipt; changed payloads, reused quotes, and concurrent submissions are rejected. Ambiguous supplier outcomes retain the claim for reconciliation—never delete the claim or generate a new key blindly. No supplier write operation is retried automatically.

## 6. Local verification

```sh
npm run typecheck
npm test
npm run test:emulators
```

The emulator test needs Java 21+ and Python 3.12. It uses the safe `demo-gowild` project, mocked supplier responses, and local Auth/Firestore/Functions. It verifies the real callable auth boundary, UID isolation, profile/favorite persistence, deny-all Firestore rules, and durable reservation claims. It does not create real accounts, reservations, or charges.

For local emulator supplier bindings, create an ignored `functions/.secret.local` if absent:

```dotenv
LITEAPI_KEY=sand_emulator_placeholder
DUFFEL_ACCESS_TOKEN=duffel_test_emulator_placeholder
```

These are placeholders, never valid provider credentials. Tests do not contact supplier APIs. To preview Expo against emulators, use public config for project `demo-gowild`, set `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true`, choose the appropriate emulator host, and run `npm run firebase:emulators` plus `npm start`. Release builds ignore the emulator flag. Restore project `gowild-d3b29` and set the flag to `false` for hosted Firebase.

Check platform bundles:

```sh
EXPO_NO_TELEMETRY=1 npx expo export --platform ios --output-dir /tmp/gowild-ios-check
EXPO_NO_TELEMETRY=1 npx expo export --platform android --output-dir /tmp/gowild-android-check
EXPO_NO_TELEMETRY=1 npx expo export --platform web --output-dir /tmp/gowild-web-check
```

Native Google consent and actual supplier access still require your configured OAuth clients/sandbox credentials. Existing maps remain unchanged; their restricted Android Maps key and native build settings still apply. No deployment to `gowild-d3b29` is performed merely by adding the public Firebase config or running local checks.

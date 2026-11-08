<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/gowild-logo-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="assets/brand/gowild-logo-light.png" />
    <img alt="goWild Logo" src="assets/brand/gowild-logo-light.png" width="320" />
  </picture>

  <h3>Worldwide Hotel Discovery, Live Rate Revalidation &amp; Reservations</h3>

  <p>
    A production-oriented cross-platform travel &amp; hospitality mobile application built with <strong>Expo SDK 58</strong>, <strong>React Native 0.88</strong>, <strong>React 19.3</strong>, strict <strong>TypeScript 6.0</strong>, and a fully managed <strong>Firebase Functions v2 Python backend</strong>.
  </p>

  <p>
    <img alt="Expo SDK 58" src="https://img.shields.io/badge/Expo-SDK_58-171725?logo=expo&logoColor=white" />
    <img alt="React Native 0.88" src="https://img.shields.io/badge/React_Native-0.88.0-2853AF?logo=react&logoColor=white" />
    <img alt="React 19.3" src="https://img.shields.io/badge/React-19.3.0-40B4F8?logo=react&logoColor=171725" />
    <img alt="TypeScript Strict" src="https://img.shields.io/badge/TypeScript-6.0_Strict-3178C6?logo=typescript&logoColor=white" />
    <img alt="Firebase backend" src="https://img.shields.io/badge/Firebase-Python_Functions_v2-FFCA28?logo=firebase&logoColor=171725" />
  </p>
</div>


# goWild

Expo React Native hotel discovery and sandbox reservations, backed by **Firebase Authentication**, **Python 3.12 Cloud Functions v2**, and **Cloud Firestore**. Functions deploy in **`europe-west1`**. The existing screens, navigation, and maps are preserved.

The app signs in with Firebase email/password or Google and uses `httpsCallable` for all backend operations. Firestore rules deny every direct client read and write, including authenticated ones. Functions derive ownership from the verified Firebase UID and use the managed runtime identity for Firestore access.

LiteAPI and Duffel integrations run only in Python functions. Supplier credentials are bound from Firebase Secret Manager, and production supplier keys are rejected. Quotes are revalidated and bound to dates/guests/currency before a durable reservation claim is created. Provider confirmation is required before marking a sandbox reservation confirmed. No traveler card collection or production payment bypass is enabled.

There is no standalone Node/Express backend, embedded gateway fallback, REST proxy, service-account private key, or separately managed Cloud Run deployment.

## Setup

1. Follow [Firebase setup and deployment](README/FIREBASE_SETUP.md).
2. Review [public configuration](README/FIREBASE_PUBLIC_CONFIG.md) separately from [server secret names](README/FIREBASE_SECRETS.md).
3. Deploy and verify authenticated `testConnection` first, then the user-data functions and selected sandbox provider.
4. Start Expo with `npm start` and sign in. Native Google sign-in requires the existing development-build/OAuth setup.

The supplied Firebase project is `gowild-d3b29`. Adding its public config does not deploy functions or enable external provider access automatically.

## Structure

```text
src/app/                  Expo Router routes and existing layouts
src/features/             Existing UI and feature hooks
src/services/firebase/    Public config, Auth persistence and callable SDK initialization
src/services/http/        Typed goWildApi facade over Firebase callable functions
functions/main.py         Authenticated Python callable entry points
functions/gowild/         Validation, Firestore ownership and sandbox supplier operations
functions/tests/          Python unit tests and real emulator checks
firestore.rules           Deny all direct client access
README/                   Setup, public configuration, secrets and design references
```

## Verification

```sh
npm run typecheck
npm test
npm run test:emulators
```

Python dependencies must first be installed in `functions/venv` as documented in the setup guide. Emulator checks need Java 21+. Node is used for Expo/development tooling and frontend unit tests; it is not the deployed backend.

See [AGENTS.md](AGENTS.md) and [.agents/README.md](.agents/README.md) for engineering rules and [Figma audit](README/FIGMA_AUDIT.md) for the existing design system.

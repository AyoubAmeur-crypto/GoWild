# .agents/PROGRESS.md — Engineering Progress Tracker

## Completed
- **Phase 0 — Audit, Figma MCP Inspection, Provider Research & Agent Harness**:
  - Audited existing Expo SDK 58 / RN 0.88 / React 19.3 codebase and dependencies.
  - Verified canonical `goWild` logo (`assets/goWild (1080 x 600 px).png`) and generated lossless transparent brand assets in `assets/brand/`.
  - Inspected Grand Hotel Figma file (`sim22KJgjq1zKePEhnJzdM`) via Figma MCP: canvas tree + `Home #32127:1241` + `Map - Nearby Hotel #32141:3881` + `Detail #32146:7920` + `Search - Found #32143:5245` + `Filter #32145:5980` + `Request to book #32152:1759`.
  - Evaluated Amadeus (July 17, 2026 self-service shutdown verified), Booking.com Demand, Expedia Rapid, LiteAPI v3.0, and Duffel Stays v2 (`README/API_PROVIDER_EVALUATION.md`).
  - Created full `.agents/*` engineering harness and concise `AGENTS.md`.
- **Phase 1 — Domain Contracts, Validation & Secure BFF (`server/`)**:
  - Implemented `src/types/domain.ts`, `src/lib/validation.ts`, `src/lib/formResolver.ts`, `src/lib/pricing.ts`, and `src/services/providers/types.ts`.
  - Implemented `server/src/{config,errors,logger,httpClient,auth,db,app,index}.ts` + `LiteApiProvider`, `DuffelStaysProvider`, and `ExplicitDevFixtureProvider`.
- **Phase 2 & 3 — Mobile Feature Modules, Cross-Platform Navigation & 14-Screen System**:
  - Upgraded `src/theme/tokens.ts` & `src/theme/useAppTheme.ts` (light + dark palettes, Grand Hotel `#2853AF` + goWild `#40B4F8`).
  - Preserved iOS `NativeTabs` (`GoWildTabs.ios.tsx`) and Android `GoWildGlassTabBar` (`GoWildTabs.android.tsx`).
  - Built complete feature slices (`hotels`, `availability`, `bookings`, `auth`, `favorites`, `profile`, `maps`, `notifications`) and thin Expo Router routes (`src/app/`).
  - Removed obsolete Aspen prototype directories (`src/features/destinations`, `src/features/booking`, `src/mocks/destinations.ts`, `src/stores/bookingStore.ts`, `src/app/destination`).
- **Phase 4 — Verification & Automated Test Suite**:
  - `npm run typecheck` (`tsc --noEmit && tsc -p tsconfig.server.json --noEmit`): **0 errors** (`ZERO_ANY_CONFIRMED`).
  - `npm test` (`node --test tests/*.test.ts`): **13/13 passing** (`374ms`).
  - `HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo export --platform ios`: **Exit 0** (`3794 modules`, `7.3MB` Hermes `.hbc`, `0` server secret leaks).
  - `HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo export --platform android`: **Exit 0** (`3887 modules`, `7.5MB` Hermes `.hbc`, `0` server secret leaks).
  - `HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo export --platform web`: **Exit 0** (compiles `/api/[...route]` serverless API Gateway).
- **Phase 5 — Production Multi-Tier API Gateway & Slippy Street Map Upgrade**:
  - Added `server/src/storage.ts`, `server/src/gateway.ts`, `src/app/api/[...route]+api.ts`, and `eas.json` for zero-config `npx expo start` & one-command `npx eas deploy` cloud API Gateway hosting.
  - Added LAN/Tunnel auto-discovery (`src/lib/config.ts`), live Profile Gateway URL switcher (`ProfileScreen.tsx`), and `AsyncStorage`-persisted `embeddedGateway` (`src/services/gateway/embeddedGatewayCore.ts`) eliminating `BFF_UNREACHABLE`.
  - Upgraded `InteractiveHotelMap.tsx` + `MapDiscoveryScreen.tsx` with true Web-Mercator OpenStreetMap street tiles, pan/zoom gestures, and city quick-jump pills.
- **Phase 6 — Pure Photography Cards, Centered Header, Banner Cleanup & Pinch/Tap Map**:
  - Removed all dark photo half-overlays/scrims, star overlays, and green overlays across `HotelCard.tsx` and `OnboardingScreen.tsx` so hotel photography renders untouched.
  - Centered `<BrandLogo />` in the middle of the `HomeDiscoveryScreen.tsx` header and `OnboardingScreen.tsx`, and trimmed verbose copy across Home and Map.
  - Removed the yellow `"Expo API Gateway"` debug banner (`ProviderModeBanner.tsx`) and developer gateway telemetry box (`ProfileScreen.tsx`) while keeping the underlying multi-tier API Gateway active in the background.
  - Added smooth continuous two-finger pinch-to-zoom (`zoomFloat` `2.0..16.0` with fractional tile scaling) and tap-on-map / tap-on-pin navigation directly to hotels in `InteractiveHotelMap.tsx` and `MapDiscoveryScreen.tsx`.

## Current
- All planned implementation and verification gates for v1.0 are complete.

## Blocked (External Only)
- Live upstream supplier API calls require user-supplied `LITEAPI_KEY` or `DUFFEL_ACCESS_TOKEN` in `.env` (self-serve signup; zero code changes required once added).
- `npx expo-doctor` requires network access to `registry.npmjs.org` outside the isolated sandbox, and `npm run lint` (`expo lint`) requires installing `eslint` + `eslint-config-expo` from npm.

## Next
- Add `LITEAPI_KEY` (`sand_...` or live) or `DUFFEL_ACCESS_TOKEN` (`duffel_test_...` or live) to `.env`, set `GOWILD_PROVIDER=liteapi` (or `duffel`), and run `npm run server` alongside `npx expo start`.


## 2026-11-05 — Firestore, Firebase identity, native maps

Implemented asynchronous Firestore persistence, Firebase email/Google identity verification with revocable BFF sessions, shared standalone/Expo gateway logic, durable reservation claims with owner/payload-safe retries, explicit fixture opt-in, native Apple/Google maps and Leaflet web maps. Added Firestore rules/configuration and `README/FIREBASE_SETUP.md`. Existing SQLite files and the user's pre-existing `app.json` changes are preserved; no account/data import or remote deployment occurred.

Verification: `npm run typecheck` passed; `npm test` passed 15 tests with the separate emulator test skipped as intended without emulator environment variables. The explicit Auth/Firestore emulator run passed its full email/Google identity, profile persistence, sessions, favorites, quotes, reservations, concurrency, ownership and cancellation test. iOS, Android and web production exports passed. Headless Chrome verified the Google button and Leaflet tiles/10 markers with no page errors. Screenshots reviewed at `/tmp/gowild-sign-in.png` and `/tmp/gowild-map.png`. Fixed nested favorite controls in compact/map cards found during visual review. `git diff --check` passed.

Fixed a runtime-only Metro Firebase Admin ESM-wrapper failure by loading Admin SDK modules via Node `createRequire`. Node deployments must include production dependencies and run from the repository root.

External work: configure the actual Firebase project/IAM/OAuth clients, restricted Android Maps key and supplier credentials, then rebuild/test native apps. LiteAPI live traveler payment remains explicitly disabled until its Payment SDK integration is implemented. Duffel live reservations debit business balance; traveler payment collection needs separate orchestration. No live Google consent, supplier charge, or device frame-rate claim is made.

Latest user preference: all server components should be cloud-hosted. Target Firebase Auth + Firestore with the Node BFF on Google Cloud Run and supplier credentials in Secret Manager; user is preparing external project/provider values before further deployment work.


## 2026-11-05 — Managed Python Firebase backend (supersedes Node/Cloud Run milestone)

Implemented Python 3.12 Firebase Functions v2 in europe-west1: authenticated testConnection, profiles, favorites, reservation lists/notifications, LiteAPI and Duffel hotel/reservation operations. Each supplier callable binds only its own SecretParam; production credential prefixes are rejected. All direct Firestore client reads/writes remain denied. Expo now uses Firebase SDK Auth and httpsCallable; removed the standalone Node server, Expo REST proxy, embedded gateway and old server session machinery. Retained the typed goWildApi facade, SQLite backups and original UI/navigation/maps.

The user supplied public Firebase configuration for gowild-d3b29, saved to ignored root .env; .firebaserc selects that project. Public configuration and server secret names are documented separately in README/FIREBASE_PUBLIC_CONFIG.md and README/FIREBASE_SECRETS.md. README/FIREBASE_SETUP.md provides first-deploy testConnection, staged account/provider deployment and verification commands. No Firebase cloud deployment or real supplier call was performed.

Verification: TypeScript frontend/test checks passed; npm test passed 4 frontend unit cases and 11 Python backend cases. Real Auth/Firestore/Functions emulator checks passed authenticated/unauthenticated/invalid-token testConnection, UID isolation, profile/favorites persistence, deny-all direct REST access, atomic concurrent booking claims and owner/payload safety. The complete sandbox search/offers/revalidation/booking/retry/cancellation service flow passed using real Firestore and explicit mocked supplier HTTP. A Firebase JavaScript Auth + httpsCallable verification script also passed against the Python emulator function. iOS, Android and web production exports passed. Content-hash audit showed no changes to existing feature screens, navigation, app config or maps during this migration. No client Firestore imports and no standalone server TypeScript remain. git diff --check passed.

External configuration remaining: enable/confirm Blaze, Firestore and email/Google Auth in the actual project; supply OAuth client IDs and selected supplier sandbox secret; then deploy testConnection first using the documented command. Native Google consent and actual supplier access require external verification. Sandbox/production gating cannot be bypassed by an environment flag.

## 2026-11-06 — Android Firebase file and Google Sign-In audit

Added only `android.googleServicesFile: "./google-services.json"` to the existing `app.json`; the dynamic config preserves this value and Android package `com.gowild.app`. Verified the supplied JSON belongs to project `gowild-d3b29`, project number `713960465346`, and Android Firebase app `1:713960465346:android:a8322a765bbfa3b166ac5b`. Set the supplied type-3 Web OAuth client ID in ignored local `.env`, which previously lacked it. Preserved the Firebase JS Web app configuration, existing auth implementation, optional iOS plugin, UI, navigation and unrelated working-tree edits. No deployment or cloud configuration changes occurred.

Reviewed the native Google ID token → GoogleAuthProvider.credential → signInWithCredential → authenticated getProfile flow. The Android JSON contains no type-1 Android OAuth client or certificate hash; console SHA-1/SHA-256 registrations and actual Google provider enablement remain unverified. No local project keystore or signing report is available. iOS OAuth ID/URL scheme are also absent locally. Exact evidence and next steps are in README/FIREBASE_PUBLIC_CONFIG.md; no successful real Google consent/device login is claimed.

Verification: resolved Expo public config assertions passed; Expo introspection completed; installed Expo Google Services helpers enable the Gradle classpath/plugin for the configured file. `npm run typecheck` passed; `npm test` passed 4 frontend and 11 Python cases; `npm run test:emulators` passed against demo-gowild after retrying outside sandbox DNS/localhost restrictions. iOS and Android production exports passed together into `/tmp/gowild-google-signin-check`. `git diff --check` passed. These checks verify local configuration/build and existing callable infrastructure, not live Google OAuth or native signing.

## 2026-11-06 — iOS Firebase file and Google Sign-In configuration

Verified supplied GoogleService-Info.plist project gowild-d3b29, bundle com.gowild.app, sender 713960465346, iOS app 1:713960465346:ios:27b80f4e9d6ed94f66ac5b, CLIENT_ID and its corresponding REVERSED_CLIENT_ID. Added ios.googleServicesFile to app.json without changing the bundle identifier. Registered the installed v17 Google Sign-In plugin once in app.json using its no-options Firebase mode; removed the previous conditional plugin registration from app.config.ts. The plugin reads the callback directly from the plist, so GOOGLE_IOS_URL_SCHEME is no longer required. Populated EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in ignored local .env while preserving the existing Web OAuth/Firebase Web app configuration.

Expo introspection verified the exact com.googleusercontent.apps.713960465346-7blpqulvasfkobjngl4h0in7kaiprhe2 callback scheme appears once and the gowild deep link is preserved. No iOS Google Maps key/provider/SDK was added; installed maps plugin activates its Google subspec only for an iOS key, which remains absent. Source hash comparison confirms all 107 app/backend source files unchanged, including authentication, UI, navigation and Apple Maps. Existing GoogleSignin.configure receives both client IDs and passes Google's token to Firebase signInWithCredential before authenticated getProfile; no auth/backend changes needed.

Verification: npm run typecheck passed; npm test passed 4 frontend + 11 backend cases; iOS and Android production exports passed into /tmp/gowild-ios-firebase-check; demo-gowild emulator suite passed on retry after an intermittent concurrent-booking Firestore transaction lock timeout (ISS-012). git diff --check passed. No missing local iOS OAuth identifier remains; hosted Google provider/consent settings and actual native login still require verification in a rebuilt iOS app. Plist IS_SIGNIN_ENABLED does not prove hosted provider status. No native binary build, cloud settings changes, or deployment performed.

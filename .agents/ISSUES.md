# .agents/ISSUES.md — Observed Failures, Blockers & Resolution Log

## ISS-001: Figma Starter Plan REST API Rate Limit (HTTP 429) After 7 MCP Inspections
- **Observed**: 2026-11-03T19:02:24Z
- **Details**: After successfully fetching the root file structure (`sim22KJgjq1zKePEhnJzdM`, depth=2), both mandatory target nodes (`Home #32127:1241`, `Map - Nearby Hotel #32141:3881`), and 4 core neighboring screens (`Detail #32146:7920`, `Search - Found #32143:5245`, `Filter #32145:5980`, `Request to book #32152:1759`), subsequent calls (`32154:3046`, `32162:2109`, `104:2220`, `118:3175`) returned `Figma API rate limit hit (429). Retry after 399884 seconds. Your starter plan has limited API access.`
- **Resolution**: All global color variables, typography tokens, component sets, button variants, search/filter inputs, hotel cards, map markers, detail layouts, and booking review breakdowns were captured across the 7 completed MCP payloads. Secondary screens (`My Trips`, `Profile`, `Sign In`) apply the exact extracted Grand Hotel design tokens without inventing unverified Figma measurements.

## ISS-002: Amadeus Self-Service API Decommissioned (July 17, 2026)
- **Observed**: 2026-11-03T19:00:44Z
- **Details**: Official Amadeus developer announcements confirm that the Amadeus Self-Service Portal (`test.api.amadeus.com`, Hotel List v1, Hotel Search v3, Hotel Booking v2) was permanently shut down on July 17, 2026; Amadeus now operates exclusively on enterprise contracts.
- **Resolution**: Selected **LiteAPI v3.0** and **Duffel Stays API v2** as open self-serve providers alongside documented comparison of Amadeus Enterprise, Booking.com Demand API, and Expedia Rapid API in `README/API_PROVIDER_EVALUATION.md`.

## ISS-003: Sandbox Restrictions on `~/.expo/state.json`, `registry.npmjs.org`, and Loopback `connect()`
- **Observed**: 2026-11-03T19:05:22Z & 19:52:41Z
- **Details**:
  1. `npx expo-doctor` attempted `GET https://registry.npmjs.org/expo-doctor` (`E403` in network-isolated sandbox), and `npm run lint` (`expo lint`) prompted to install `eslint` (`No ESLint config found`).
  2. Default Expo CLI commands try to write telemetry to `~/.expo/state.json` (`EPERM` outside workspace).
  3. Sandboxed `node --test` blocked outbound TCP `connect 127.0.0.1` (`EPERM`).
- **Resolution**:
  - Prefixed Expo CLI commands with `HOME=/tmp EXPO_NO_TELEMETRY=1` for clean iOS/Android Metro bundle verification.
  - Added `app.inject(...)` stream-dispatch helper on `createGoWildServer` (`server/src/app.ts`) so full end-to-end BFF HTTP integration tests execute deterministically in network-isolated CI/sandboxes while `npm run server` listens on standard TCP `0.0.0.0:4010`.

## ISS-004: Live Upstream Supplier Credentials Not Present in Workspace
- **Observed**: 2026-11-03T19:05:00Z
- **Details**: No `.env` file with `LITEAPI_KEY` or `DUFFEL_ACCESS_TOKEN` exists in the repository yet.
- **Resolution**: Implemented spec-accurate `LiteApiProvider` and `DuffelStaysProvider` in `server/src/providers/`, verified against official schemas in automated tests, and configured `.env.example` so adding `LITEAPI_KEY` (`sand_...`) or `DUFFEL_ACCESS_TOKEN` (`duffel_test_...`) immediately activates live upstream traffic. Local development defaults explicitly to `GOWILD_PROVIDER=development_fixtures` with visible UI attribution banners.

## ISS-005: `@hookform/resolvers` v3.9.1 Incompatibility with Zod v4.6.7
- **Observed**: 2026-11-03T19:16:00Z
- **Details**: Installed `zod` is `4.6.7` while `@hookform/resolvers` is `3.9.1`; `@hookform/resolvers/zod` inspects legacy Zod v3 internals and throws at runtime under Zod v4.
- **Resolution**: Implemented a strictly typed `createZodFormResolver` in `src/lib/formResolver.ts` using `schema.safeParseAsync` and verified it in `tests/pricing-and-filters.test.ts`.

## ISS-006: React Native 0.88 `ScrollView` Ref Type Change
- **Observed**: 2026-11-03T19:49:07Z
- **Details**: Under React Native `0.88.0` + React `19.3.0`, `ScrollView` is typed as a function component returning `ScrollViewInstance` via `ref`, so `useRef<ScrollView>(null)` fails `tsc --noEmit`.
- **Resolution**: Updated ref typing in `HotelDetailScreen.tsx` to `useRef<React.ComponentRef<typeof ScrollView>>(null)`.

## ISS-007: `BFF_UNREACHABLE` When Running Expo Without Separate Port-4010 Server or Over Physical-Device Wi-Fi
- **Observed**: 2026-11-03T20:01:17Z
- **Details**: `src/lib/config.ts` defaulted solely to `http://localhost:4010` (`10.0.2.2:4010` on Android), causing `BFF_UNREACHABLE` across Home, Search, Map, and My Trips whenever `npm run server` wasn't running separately or when testing on a physical iOS/Android phone over LAN (`localhost` resolves to the phone itself). Additionally, `InteractiveHotelMap` rendered only an abstract SVG grid rather than live street tiles.
- **Resolution**:
  1. Built portable Web-standard API Gateway (`server/src/gateway.ts` + `server/src/storage.ts`) mounted directly inside Expo Router (`src/app/api/[...route]+api.ts`), so `npx expo start` and `npx eas deploy` serve `/api/*` natively with zero separate process required.
  2. Upgraded `src/lib/config.ts` (`expo-constants` `hostUri` LAN/Tunnel discovery) + `src/services/http/apiClient.ts` multi-origin gateway probing (`Custom Cloud URL` -> `EXPO_PUBLIC_API_BASE_URL` -> `Expo API Gateway :8081` -> `Standalone BFF :4010`) + `src/services/gateway/embeddedGateway.ts` (`AsyncStorage`-persisted Always-On Local Gateway failover when offline, never masking real upstream supplier errors).
  3. Upgraded `InteractiveHotelMap.tsx` to render true Web-Mercator OpenStreetMap street tiles (`tile.openstreetmap.org/{z}/{x}/{y}.png`) with pan/zoom gestures and quick city pills on `MapDiscoveryScreen.tsx`.


## ISS-008: Firebase Admin ESM wrappers fail inside Metro API runtime
- Observed 2026-11-05: web API requests failed with `Cannot read properties of undefined (reading 'Auth')` from `firebase-admin/lib/esm/auth/index.js`, despite successful exports and standalone Node tests.
- Fixed: load Admin SDK through Node `createRequire`, leaving the SDK's module semantics and dependencies intact. Reverified browser API/map flow, web export, Node tests, and Firebase emulator test. Deployment requires a Node runtime and installed production dependencies.

## ISS-009: External configuration and live payments
- The Firebase project, OAuth clients, Android Maps restrictions and supplier credentials must be configured/verified externally. Google sign-in requires a native development build; device performance was not profiled.
- Removed the LiteAPI adapter's fake production hosted checkout return link. Production booking is explicitly disabled until Payment SDK integration is complete. Duffel live balance booking is labeled as a business-funded reservation, without claiming traveler payment collection.
- Existing SQLite data is preserved but not automatically migrated to Firebase identities.


## ISS-010: Python Firestore emulator attempted Application Default Credentials lookup
- Observed during the managed-functions migration: Firebase Admin Python's Firestore client attempted ADC even with a local Firestore emulator, causing DefaultCredentialsError on a machine without downloaded service-account credentials.
- Fixed: functions/gowild/runtime.py uses an anonymous Firestore transport only when both FUNCTIONS_EMULATOR=true and FIRESTORE_EMULATOR_HOST are set. Callable user authentication is still required before DB access. Deployed functions retain their managed runtime identity. Emulator auth/rules/SDK/full sandbox lifecycle verification passed afterward. No private key was created.

## ISS-011: Android Google OAuth signing registration remains unverified — 2026-11-06

- The supplied google-services.json matches gowild-d3b29/com.gowild.app and contains a type-3 Web OAuth ID, but no type-1 Android OAuth client or SHA-1 certificate hash. SHA-256 registrations cannot be determined from this file. No project keystore/signing report exists locally; current console registration was not inspected.
- Fixed the missing Expo Android JSON path and missing local EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID using the supplied ID. No auth implementation changes were needed. Verify actual development signing SHA-1 and SHA-256 in Firebase, confirm Google Auth is enabled, download a fresh JSON after changes, and test native consent in a rebuilt development app. iOS client ID/URL scheme also remain absent locally. See README/FIREBASE_PUBLIC_CONFIG.md.
- The first required emulator invocation failed with ENOTFOUND registry.npmjs.org under sandbox restrictions. Retried with approved network/localhost access; the full demo-gowild emulator suite passed. No deployment occurred.

iOS follow-up (2026-11-06): the newly supplied GoogleService-Info.plist resolves the missing iOS OAuth ID and callback scheme. Configured ios.googleServicesFile and the no-options Google Sign-In plugin; populated EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID. GOOGLE_IOS_URL_SCHEME is no longer needed. iOS live consent and hosted provider enablement remain unverified; Android fingerprint verification remains separate.

## ISS-012: Intermittent Firestore emulator concurrency lock timeout — 2026-11-06

During iOS configuration verification, the unchanged emulator suite failed at functions/tests/emulator_check.py:76 when concurrent booking claims exhausted five Firestore transaction attempts with Aborted: 409 Transaction lock timeout. TypeScript, all 15 unit tests, platform exports and iOS Expo config/OAuth scheme validation passed. A clean retry of the full demo-gowild emulator suite passed (exit 0) without changing backend/test code; retain this intermittent emulator contention evidence independently of the iOS OAuth setup.

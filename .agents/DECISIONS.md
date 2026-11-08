# .agents/DECISIONS.md — Architecture Decision Log

## Configuration note — iOS Firebase Google Sign-In (2026-11-06)

Use the installed v17 Google Sign-In plugin's no-options Firebase mode, registered once in app.json. It reads REVERSED_CLIENT_ID from ios.googleServicesFile and configures the callback without an independent GOOGLE_IOS_URL_SCHEME environment variable. Populate the existing public iOS client ID variable from the plist; preserve Firebase JS initialization, auth code and Apple Maps. No native Firebase or iOS Google Maps SDK is added. This supersedes the earlier optional iOS URL scheme plugin setup.

## Configuration note — Android Firebase registration (2026-11-06)

Reference the supplied Android JSON from existing app.json, retain Firebase JS SDK initialization with the existing Web app identifiers, and set its public type-3 Web OAuth client ID through the existing environment variable. Expo's installed default Android prebuild plugins already handle the Google Services file and Gradle setup. Preserve the existing optional iOS URL scheme plugin and auth flow; do not introduce React Native Firebase or change architecture for this registration. Android signing registration and live Google consent remain external verification steps. No deployment authorized.

## ADR-001: Reject Amadeus Self-Service; Select LiteAPI v3.0 (Primary) + Duffel Stays v2 (Secondary)
- **Date**: 2026-11-03
- **Context**: Amadeus Self-Service Portal (`test.api.amadeus.com`, Hotel List v1, Hotel Search v3, Hotel Booking v2) was permanently decommissioned on **July 17, 2026**, leaving only enterprise-gated APIs. Booking.com Demand API and Expedia Rapid API also require pre-approved commercial partner contracts before sandbox credentials are issued.
- **Decision**: Implement a provider-neutral `HotelProvider` interface with **LiteAPI v3.0** (`api.liteapi.travel/v3.0` & `book.liteapi.travel/v3.0`) as the primary open self-serve adapter and **Duffel Stays v2** (`api.duffel.com/stays/*`) as the secondary open self-serve adapter, plus an explicitly labeled non-production `development_fixtures` adapter when running locally without external API keys.
- **Consequence**: Real live search, room rates, offer revalidation (`prebook` / `quotes`), sandbox booking, retrieval, and cancellation work immediately upon adding `LITEAPI_KEY` or `DUFFEL_ACCESS_TOKEN` in `.env`, with zero silent fallback on upstream errors.

## ADR-002: Zero-Dependency Native TypeScript BFF with `node:http` + `node:sqlite` + `zod`
- **Date**: 2026-11-03
- **Context**: Supplier secrets (`LITEAPI_KEY`, `DUFFEL_ACCESS_TOKEN`) and confirmed reservation persistence must never live solely in mobile AsyncStorage or `EXPO_PUBLIC_*` variables. Node `v24.20.0` is installed with native TypeScript execution (`process.features.typescript === 'strip'`) and `node:sqlite` (`DatabaseSync`).
- **Decision**: Build `server/` using Node 24's built-in `node:http`, `node:sqlite`, `node:crypto`, and the existing `zod` package, sharing TypeScript domain contracts with `src/`.
- **Consequence**: Persistent relational storage for users, sessions, favorites, offer quotes, and idempotent bookings without installing unapproved external packages.

## ADR-003: Lossless Pixel Alpha Extraction for `goWild` Brand Variants
- **Date**: 2026-11-03
- **Context**: `assets/goWild (1080 x 600 px).png` (2295×1275 RGBA) has an opaque `#FFFFFF` background, which clips awkwardly over hero photography or dark surfaces. Redrawing the 8-petal flower mark as hand-coded SVG is prohibited.
- **Decision**: Mathematically un-premultiply the `#FFFFFF` background from `assets/goWild (1080 x 600 px).png` into `assets/brand/gowild-mark.png`, `gowild-logo-light.png`, and `gowild-logo-dark.png`, preserving every pixel's exact geometry (`#40B4F8`).
- **Consequence**: 100% faithful geometric flower mark across light, ice, photographic, and dark surfaces.

## ADR-004: Preserve Native iOS `NativeTabs` & Android `GoWildGlassTabBar`
- **Date**: 2026-11-03
- **Context**: Expo SDK 58 supports `expo-router/native-tabs` on iOS and `expo-router/js-tabs` + `expo-blur` (`dimezisBlurViewSdk31Plus`) on Android.
- **Decision**: Keep platform-resolved `GoWildTabs.ios.tsx` and `GoWildTabs.android.tsx`, updating their active brand palette (`#2853AF` / `#40B4F8`), dark-mode tokens, and semantic accessibility labels (`Explore`, `Trips`, `Saved`, `Profile`).

## ADR-005: Multi-Tier Production API Gateway Architecture (Expo Server Routes + Cloud URL + Embedded Always-On Failover)
- **Date**: 2026-11-03
- **Context**: Relying exclusively on `http://localhost:4010` breaks single-command `npx expo start` workflows, physical-device LAN sessions, and offline launches (`BFF_UNREACHABLE`).
- **Decision**:
  1. Implement a Web-standard `Request -> Response` API Gateway (`server/src/gateway.ts` + dynamic SQLite/Edge storage `server/src/storage.ts`) mounted at `src/app/api/[...route]+api.ts` (compiles to `/api/[...route]` serverless function for `npx expo start` and `npx eas deploy`).
  2. Discover candidate origins via `expo-constants` (`hostUri`) + runtime-configurable Cloud Gateway URL in Profile (`useSettingsStore.customApiGatewayUrl`).
  3. Provide an `AsyncStorage`-persisted `embeddedGateway` (`src/services/gateway/embeddedGatewayCore.ts`) strictly for network-unreachable/offline transport failover (unless `EXPO_PUBLIC_STRICT_REMOTE_GATEWAY=true`), while **never** falling back when a remote gateway returns an upstream provider or application error (`4xx`/`5xx` JSON envelope).



## ADR — Firebase identity, Firestore persistence, native maps (2026-11-05)

At the user's request, replace SQLite with Firestore behind asynchronous GatewayStorage and consolidate duplicate standalone/Expo server logic. Use Firebase Auth for email/Google identities and retain hashed, revocable BFF bearer sessions so supplier APIs remain server-owned. Deny direct client Firestore writes. Preserve old SQLite files without silently importing accounts or changing reservation owners.

Use a Firestore transaction to claim each booking key before supplier submission; retain uncertain claims and their owner/input context for manual reconciliation. Never retry a supplier booking just because persistence or transport failed. Scope receipt replay to the owner and original payload.

Move mobile pan/zoom and rendering into native Apple/Google Maps; use Leaflet on web with vector pins. Disable automatic embedded demo fallback unless explicitly opted in. Disable the previous fake LiteAPI live checkout link, and label Duffel balance-funded reservations accurately. Full traveler payment orchestration remains separate work.


## ADR — Managed Firebase Python callable backend (2026-11-05)

User explicitly superseded the Node/Cloud Run architecture. Deploy Python 3.12 Firebase Functions v2 through Firebase CLI in europe-west1; no separate infrastructure deployment or service-account JSON. Keep goWildApi facade and all UI/maps stable. Use Firebase SDK Auth persistence and verified callable UID for ownership; deny all direct Firestore client access.

Separate public Firebase/OAuth configuration from supplier Secret Manager names. Deploy testConnection before suppliers; bind each provider secret only to its own callable. Enforce sandbox credential prefixes in code and retain durable idempotency/quote claims for ambiguous submissions. No production booking/payment bypass.

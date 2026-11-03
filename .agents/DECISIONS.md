# .agents/DECISIONS.md — Architecture Decision Log

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


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

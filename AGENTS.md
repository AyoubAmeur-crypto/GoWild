# AGENTS.md — goWild Engineering Rules

## 1. Mission & Identity
- **Product**: `goWild` — production-oriented global hotel discovery, comparison, availability pricing, and reservation mobile app + secure TypeScript BFF (`server/`).
- **Brand**: Canonical logo is `assets/goWild (1080 x 600 px).png` (derived transparent variants in `assets/brand/`). Never redraw or substitute the geometric blue flower mark (`#40B4F8`). Use `<BrandLogo />` (`src/components/ui/BrandLogo.tsx`).
- **Visual System**: Deep charcoal (`#171725`), royal cobalt primary (`#2853AF`), flower sky accent (`#40B4F8`), crisp white (`#FEFEFE` / `#FFFFFF`), ice surfaces (`#E8F2FF` / `#F5F8FD`). Restrained glass effects (`GlassSurface`, tab bar, floating overlays) — never excessive glassmorphism, never emojis as UI icons. Use `lucide-react-native` across UI; SF Symbols only inside `expo-router/native-tabs`.

## 2. Hard Technical Constraints
- **Stack**: Expo SDK 58 (`~58.0.19`), React Native `0.88.0`, React `19.3.0` (React Compiler + Typed Routes), TypeScript `~6.0.3` (`strict: true`, zero `any`), NativeWind v4, Reanimated `4.7.1`, TanStack Query v5, Zustand v5, React Hook Form + Zod v4.
- **Backend-for-Frontend (`server/`)**: Node 24 native TypeScript HTTP service (`node:http` + `node:sqlite` + `zod`) holding supplier secrets (`LITEAPI_KEY`, `DUFFEL_ACCESS_TOKEN`), user sessions, idempotent booking records, and offer revalidation quotes.
- **No Secrets in Client**: Never put supplier API keys or privileged booking tokens in `src/` or `EXPO_PUBLIC_*`. Only `EXPO_PUBLIC_API_BASE_URL` and non-sensitive feature flags belong in client config.
- **No Silent Mock Fallback**: When a real provider (`liteapi` or `duffel`) is selected and fails or lacks credentials, return explicit typed errors — never silently switch to `development_fixtures`. Development fixtures must be explicitly selected (`GOWILD_PROVIDER=development_fixtures`) and visibly labeled in UI.
- **Real Booking Lifecycle**: Revalidate offers immediately before checkout (`revalidateOffer`). Never collect raw card numbers in custom forms. Mark bookings `confirmed` only on verified provider confirmation; label sandbox or external checkout handoffs accurately.

## 3. Architecture Boundaries
- `src/app/` — Thin Expo Router route bindings only.
- `src/features/{hotels,availability,bookings,auth,favorites,profile,maps,notifications}/` — Feature-first modules.
- `src/components/navigation/` — `GoWildTabs.ios.tsx` (`NativeTabs` from `expo-router/native-tabs`) and `GoWildTabs.android.tsx` (`expo-router/js-tabs` + `GoWildGlassTabBar`).
- `src/components/ui/` — Shared design-system primitives.
- `src/services/{http,providers}/` — Typed HTTP client, DTO Zod schemas, and `HotelProvider` client/contract definitions.
- `src/stores/` — Persisted UI preferences, search draft, auth session token, and local favorites cache. TanStack Query owns remote hotels, availability, offers, and server bookings.

## 4. Mandatory Operating Loop & Deeper Docs
Read these before modifying architecture, APIs, or UI:
- Operating Manual & Loop: [`.agents/README.md`](.agents/README.md) · [`.agents/LOOP.md`](.agents/LOOP.md)
- Context & Architecture: [`.agents/PROJECT_CONTEXT.md`](.agents/PROJECT_CONTEXT.md) · [`.agents/ARCHITECTURE.md`](.agents/ARCHITECTURE.md)
- Contracts & Design System: [`.agents/API_CONTRACTS.md`](.agents/API_CONTRACTS.md) · [`.agents/DESIGN_SYSTEM.md`](.agents/DESIGN_SYSTEM.md)
- Execution Tracking: [`.agents/ROADMAP.md`](.agents/ROADMAP.md) · [`.agents/TASKS.md`](.agents/TASKS.md) · [`.agents/PROGRESS.md`](.agents/PROGRESS.md)
- Decisions, Testing & Issues: [`.agents/DECISIONS.md`](.agents/DECISIONS.md) · [`.agents/TESTING.md`](.agents/TESTING.md) · [`.agents/ISSUES.md`](.agents/ISSUES.md)
- Audits & Guides: [`README/FIGMA_AUDIT.md`](README/FIGMA_AUDIT.md) · [`README/API_PROVIDER_EVALUATION.md`](README/API_PROVIDER_EVALUATION.md) · [`README/SETUP.md`](README/SETUP.md) · [`README/DEMO.md`](README/DEMO.md)

## 5. Minimum Verification Gate
- `npx tsc --noEmit` (client + server)
- `npm test` (`node --test` unit + BFF/provider integration suite)
- `HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo export --platform ios --output-dir /tmp/gowild-ios-check` (and `--platform android`)

# .agents/TASKS.md — Actionable Engineering Tasks

- [x] **T0.1** Inspect repository, dependencies, Expo SDK 58 config, and canonical `goWild` logo (`assets/goWild (1080 x 600 px).png`).
- [x] **T0.2** Fetch Figma MCP data for primary (`32127:1241`), secondary (`32141:3881`), file canvas tree, and key journey frames (`32146:7920`, `32143:5245`, `32145:5980`, `32152:1759`).
- [x] **T0.3** Research official hotel APIs (Amadeus 2026 shutdown verification, Booking.com Demand, Expedia Rapid, LiteAPI v3.0, Duffel Stays v2) and document in `README/API_PROVIDER_EVALUATION.md`.
- [x] **T0.4** Extract lossless transparent brand variants (`gowild-mark.png`, `gowild-logo-light.png`, `gowild-logo-dark.png`) and author `.agents/*` + `README/FIGMA_AUDIT.md`.
- [x] **T1.1** Build shared domain contracts (`src/types/domain.ts`) and Zod schemas (`src/lib/validation.ts`) shared between mobile client and `server/`.
- [x] **T1.2** Build secure TypeScript BFF (`server/`) with `node:sqlite`, auth, rate limiting, structured logging, `LiteApiProvider`, `DuffelStaysProvider`, and explicit `DevFixtureProvider`.
- [x] **T1.3** Upgrade design tokens (`src/theme/tokens.ts` + dark mode hook), `<BrandLogo />`, and shared UI primitives (`SearchBar`, `RatingBadge`, `PriceDisplay`, `AmenityChip`, `Skeleton`, `EmptyState`, `ErrorState`, `ProviderModeBanner`).
- [x] **T1.4** Implement typed mobile HTTP client (`src/services/http/apiClient.ts`) + Zustand stores (`useSearchStore`, `useAuthStore`, `useFavoritesStore`, `useSettingsStore`) + TanStack Query hooks.
- [x] **T2.1** Implement Onboarding (`src/app/index.tsx`), cross-platform Tabs (`GoWildTabs.ios.tsx` / `GoWildGlassTabBar.tsx`), and Home Discovery (`src/app/(tabs)/index.tsx`).
- [x] **T2.2** Implement Search & Autocomplete + `DateRangePicker` + `GuestCounter` + `FilterSheet` (`src/app/search/index.tsx`) and Synchronized Map Discovery (`src/app/map/index.tsx`).
- [x] **T2.3** Implement Hotel Detail (`src/app/hotel/[id].tsx`) with `HotelGallery`, amenities, policies, reviews, and live `RoomOfferCard` selection.
- [x] **T3.1** Implement Booking Review & Offer Revalidation (`src/app/booking/review.tsx`), Confirmation Receipt (`src/app/booking/confirmation/[id].tsx`), and My Trips + Cancellation (`src/app/(tabs)/bookings.tsx`).
- [x] **T3.2** Implement Traveler Auth (`src/app/auth/sign-in.tsx`, `sign-up.tsx`), Favorites (`src/app/(tabs)/favorites.tsx`), Profile & Settings (`src/app/(tabs)/profile.tsx`), and Notifications (`src/app/notifications/index.tsx`).
- [x] **T4.1** Write and execute automated unit + BFF/provider integration tests (`tests/*.test.ts` — 10/10 passing), run `npm run typecheck` (0 errors), run iOS & Android Metro production exports (both exit 0), and finalize docs.

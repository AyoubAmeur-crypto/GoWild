# .agents/ROADMAP.md — Phased Delivery & Acceptance Criteria

## Phase 0 — Audit, Figma MCP, Provider Evaluation & Harness [COMPLETED]
- **Acceptance Criteria**:
  - Both mandatory Figma nodes (`32127:1241`, `32141:3881`) + neighboring journey frames inspected via Figma MCP and documented in `README/FIGMA_AUDIT.md`.
  - Official hotel APIs researched with current 2026 eligibility documented in `README/API_PROVIDER_EVALUATION.md`.
  - Exact brand mark & lockups sliced losslessly from `assets/goWild (1080 x 600 px).png`.
  - Complete `.agents/*` harness and root `AGENTS.md` created.

## Phase 1 — Brand, Shared UI Primitives, Navigation, Onboarding & Home Discovery [ACTIVE]
- **Acceptance Criteria**:
  - Updated semantic tokens (`src/theme/tokens.ts`) supporting light and dark palettes.
  - Reusable UI primitives (`BrandLogo`, `SearchBar`, `RatingBadge`, `PriceDisplay`, `AmenityChip`, `Skeleton`, `EmptyState`, `ErrorState`, `ProviderModeBanner`).
  - Preserved iOS `NativeTabs` (`expo-router/native-tabs`) and Android `GoWildGlassTabBar` (`expo-blur` + Reanimated) updated to new brand palette & dark mode.
  - Branded Onboarding screen (`src/app/index.tsx`) featuring real `BrandLogo` and value proposition.
  - Home Discovery (`src/app/(tabs)/index.tsx`) matching Figma `Home #32127:1241` hierarchy (Traveler/Location header, quick search trigger, location discovery banner, Most Popular horizontal hero carousel, property-type filter chips, Recommended hotel list, Recent Searches).

## Phase 2 — Secure BFF, Provider Adapters, Hotel Search, Filters, Detail & Synchronized Map
- **Acceptance Criteria**:
  - TypeScript BFF (`server/`) with SQLite (`node:sqlite`), Zod validation, rate limiting, timeouts, and structured logging.
  - `HotelProvider` implemented for **LiteAPI v3.0**, **Duffel Stays v2**, and explicit **Development Fixtures** (never silently substituted on provider error).
  - Search screen (`src/app/search/index.tsx`) with place autocomplete, sorting, FilterSheet (`#32145:5980` — price range, instant book/free cancellation, property types, amenities, star rating), and Search Result Cards (`#32143:5245`).
  - Map Discovery (`src/app/map/index.tsx`) matching Figma `Map - Nearby Hotel #32141:3881` with interactive coordinate markers/pins synchronized with horizontal floating hotel preview cards.
  - Hotel Detail (`src/app/hotel/[id].tsx`) matching Figma `Detail #32146:7920` with full-screen gallery modal, overview, rating, amenities, policies, location preview, and licensed/attributed reviews.

## Phase 3 — Dates, Guests, Live Availability, Room Offers & Itemized Pricing
- **Acceptance Criteria**:
  - Interactive `DateRangePicker` (calendar range selection with validation) and `GuestCounter` (rooms, adults, children + child age selectors).
  - Live `getRoomOffers` query keyed by `[hotelId, checkIn, checkOut, occupancy, currency]` with automatic invalidation on parameter change.
  - `RoomOfferCard` displaying bed config, occupancy limit, board basis (`Breakfast Included`, `Room Only`, etc.), refundable/non-refundable deadline badge, and per-night + total payable pricing.

## Phase 4 — Authentication, Synced Favorites, Traveler Profile & Preferences
- **Acceptance Criteria**:
  - Real BFF account registration, login, session persistence, and profile editing (`src/app/auth/sign-in.tsx`, `src/app/auth/sign-up.tsx`, `src/app/(tabs)/profile.tsx`).
  - Favorites tab (`src/app/(tabs)/favorites.tsx`) persisting locally and syncing with BFF when signed in.
  - Persistent Currency (`USD`, `EUR`, `GBP`, `MAD`, `JPY`), Language (`en`, `fr`), Dark Mode, Reduced Motion, and Notification preferences (`src/app/notifications/index.tsx`).

## Phase 5 — Offer Revalidation, Checkout Lifecycle, Booking History & Cancellation
- **Acceptance Criteria**:
  - Booking Review (`src/app/booking/review.tsx`) matching Figma `Request to book #32152:1759` with automatic pre-booking `revalidateOffer`, handling expired offers, sold-out rooms, and price-change alerts.
  - Validated lead guest form (`react-hook-form` + `zod`), itemized `PriceBreakdownCard`, cancellation policy summary, and compliant checkout action (LiteAPI/Duffel sandbox booking or external provider-hosted checkout via `expo-web-browser` — zero raw card PAN inputs).
  - Idempotency key (`Idempotency-Key`) protection against duplicate reservations.
  - Booking Confirmation receipt (`src/app/booking/confirmation/[id].tsx`) and My Trips (`src/app/(tabs)/bookings.tsx`) with Upcoming, Past/Completed, and Cancelled tabs + real cancellation action.

## Phase 6 — Automated Testing, Bundle Verification, Accessibility & Release Readiness
- **Acceptance Criteria**:
  - `npx tsc --noEmit` passes cleanly for mobile app and BFF server.
  - Automated `node --test` unit and integration suite verifies DTO mapping, Zod schemas, filter/price logic, offer revalidation, idempotent booking creation, cancellation state transitions, and zero silent fallback on provider errors.
  - Metro production export succeeds for both iOS and Android.
  - `README/SETUP.md`, `README/DEMO.md`, `.agents/PROGRESS.md`, and `.agents/ISSUES.md` finalized with reproducible commands.


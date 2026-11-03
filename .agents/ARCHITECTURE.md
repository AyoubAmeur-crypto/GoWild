# .agents/ARCHITECTURE.md — System Boundaries & Decisions

## 1. High-Level Topology
```text
[Expo React Native App (iOS / Android / Web)]
   ├── src/app/                  (Expo Router thin routes)
   ├── src/features/*            (Domain UI, RHF forms, TanStack Query hooks)
   ├── src/stores/*              (Zustand UI prefs, search draft, auth session, local favorites)
   └── src/services/http/        (Typed ApiClient + Zod response parsers + Direct Offline Dev Mode)
          │
          ▼ HTTPS / JSON (Bearer Session + Idempotency-Key)
[TypeScript BFF Server (server/src/index.ts)]
   ├── Auth & Traveler Service   (scrypt password hashing + session tokens)
   ├── Rate Limiter & Logger     (per-IP sliding window + structured JSON logs)
   ├── Persistent SQLite Store   (node:sqlite -> server/data/gowild.sqlite)
   └── HotelProvider Registry
        ├── LiteApiProvider      (https://api.liteapi.travel/v3.0 & book.liteapi.travel/v3.0)
        ├── DuffelStaysProvider  (https://api.duffel.com/stays/*, Duffel-Version: v2)
        └── DevFixtureProvider   (Explicit GOWILD_PROVIDER=development_fixtures only; blocked in prod)
```

## 2. Client Module Structure (`src/`)
- `src/app/` — Route bindings only:
  - `_layout.tsx` (Root Stack, QueryClientProvider, Auth/Theme hydration)
  - `index.tsx` (Branded onboarding & quick skip when already onboarded)
  - `(tabs)/_layout.tsx` -> `<GoWildTabs />`
  - `(tabs)/index.tsx` -> Home Discovery (`HomeDiscoveryScreen`)
  - `(tabs)/bookings.tsx` -> My Trips (`MyTripsScreen`)
  - `(tabs)/favorites.tsx` -> Saved Hotels (`FavoritesScreen`)
  - `(tabs)/profile.tsx` -> Traveler Profile & Settings (`ProfileScreen`)
  - `search/index.tsx` -> Full Search Form, Autocomplete, Date & Guest Sheet, Results & Filters (`SearchScreen`)
  - `map/index.tsx` -> Synchronized Map Discovery & Floating Preview Cards (`MapDiscoveryScreen`)
  - `hotel/[id].tsx` -> Hotel Detail, Gallery, Amenities, Policies, Reviews & Room Offers (`HotelDetailScreen`)
  - `booking/review.tsx` -> Offer Revalidation, Guest Details, Itemized Price Breakdown & Checkout (`BookingReviewScreen`)
  - `booking/confirmation/[id].tsx` -> Reservation Confirmation & Status Receipt (`BookingConfirmationScreen`)
  - `auth/sign-in.tsx` & `auth/sign-up.tsx` -> Traveler Account Authentication
  - `notifications/index.tsx` -> Booking Alerts & Notification Preferences

## 3. State Ownership Rules
- **TanStack Query**:
  - `['hotels', 'featured', currency]`
  - `['hotels', 'places', query]`
  - `['hotels', 'search', searchQueryObject]`
  - `['hotels', 'detail', hotelId, currency, language]`
  - `['availability', 'offers', hotelId, checkIn, checkOut, occupancy, currency]`
  - `['bookings', 'list', userId]` & `['bookings', 'detail', bookingId]`
  - Stale room offers are invalidated automatically whenever dates, occupancy, or currency change.
- **Zustand (`src/stores/`)**:
  - `useSearchStore`: check-in/out dates, occupancy (`adults`, `childrenAges`, `rooms`), destination query, active filters, and recent searches (max 8).
  - `useAuthStore`: authenticated `Traveler` profile + session token (persisted; synced with BFF `/api/auth/me`).
  - `useFavoritesStore`: saved hotel IDs + lightweight snapshots (persisted locally and synced to BFF when authenticated).
  - `useSettingsStore`: `currency`, `language`, `darkMode`, `reducedMotion`, `notificationsEnabled`, `hasCompletedOnboarding`.

## 4. Persistent Database (`server/src/db.ts`)
Uses Node 24's built-in `node:sqlite` (`DatabaseSync` with WAL mode and foreign keys enabled):
- `users`: `id`, `email`, `password_hash`, `first_name`, `last_name`, `phone`, `nationality`, `currency`, `language`, `created_at`
- `sessions`: `token_hash`, `user_id`, `expires_at`, `created_at`
- `favorites`: `user_id`, `hotel_id`, `created_at`
- `offer_quotes`: `quote_id`, `offer_id`, `provider_id`, `hotel_id`, `payload_json`, `expires_at`, `created_at`
- `bookings`: `id`, `user_id`, `idempotency_key` (UNIQUE), `provider_id`, `provider_booking_id`, `booking_reference`, `status`, `is_sandbox`, `checkout_url`, `hotel_snapshot_json`, `offer_snapshot_json`, `guest_json`, `price_json`, `cancellation_json`, `created_at`, `updated_at`


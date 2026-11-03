# 02 — Architecture & Data Flow

## Data Flow Diagram
```
                     ┌───────────────────────────────┐
                     │          Expo Router          │
                     │  index.tsx -> (tabs) -> [id]  │
                     └───────────────┬───────────────┘
                                     │
           ┌─────────────────────────┴────────────────────────┐
           ▼                                                  ▼
┌───────────────────────────────┐          ┌───────────────────────────────────┐
│     TanStack Query Hooks      │          │       Zustand Stores (Client)     │
│   (useDestinations, useDetail)│          │ (useFavoritesStore, useBookings)  │
└──────────────┬────────────────┘          └─────────────────┬─────────────────┘
               │                                             │
               ▼                                             ▼
┌───────────────────────────────┐          ┌───────────────────────────────────┐
│ Mock Service / Repository API │          │       AsyncStorage Persistence    │
│  (src/features/destinations/) │          │  (@react-native-async-storage)    │
└───────────────────────────────┘          └───────────────────────────────────┘
```

## Routing Hierarchy
- `/` — [`src/app/index.tsx`](file:///src/app/index.tsx): Fullscreen Onboarding / Splash.
- `/(tabs)` — Native bottom tab bar with 4 routes:
  - `index.tsx`: Explore & discovery feed.
  - `bookings.tsx`: Active & past reservations.
  - `favorites.tsx`: Saved destination bookmarks.
  - `profile.tsx`: Traveler profile and settings.
- `/destination/[id]` — [`src/app/destination/[id].tsx`](file:///src/app/destination/[id].tsx): Detail page with hero imagery, facilities, map modal, and booking flow.

## Layer Boundaries
1. **Routing (`src/app`)**: Route hooks (`useLocalSearchParams`, `useRouter`) only.
2. **Features (`src/features`)**:
   - `destinations/`: Card components, mock API, type definitions, query hooks.
   - `booking/`: Zod form schema, interactive booking sheet modal.
   - `favorites/`: Local toggle logic, bookmarks list.
3. **Stores (`src/stores`)**:
   - `favoritesStore.ts`: Set of destination IDs saved by user.
   - `bookingStore.ts`: Array of confirmed trips.
4. **Theme (`src/theme`)**: Color tokens, typography metrics, radii, and shadows directly mirrored from Figma styles.

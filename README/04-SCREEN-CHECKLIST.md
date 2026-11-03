# 04 — Screen Implementation Checklist

| Screen / Flow | Figma Node | Route | Status | Notes |
|---|---|---|---|---|
| **Onboarding / Welcome** | `#0:177` | `/index.tsx` | Completed & Verified | Fullscreen alpine hero, wordmark, gradient overlay, Explore CTA |
| **Explore / Discovery** | `#0:72` | `/(tabs)/index.tsx` | Completed & Verified | Live search bar, category filter chips, Popular horizontal cards, Recommended packages, Location selector modal |
| **Native Tabs Bar** | `#0:153` | `/(tabs)/_layout.tsx` | Completed & Verified | Authentic Apple system Liquid Glass using `expo-router/native-tabs` with SF Symbols |
| **Bookings Tab** | Feature | `/(tabs)/bookings.tsx` | Completed & Verified | Confirmed reservations with dates, guests, pricing, status badges, cancel interaction |
| **Favorites Tab** | Feature | `/(tabs)/favorites.tsx` | Completed & Verified | Wishlist with instant bookmark toggle and AsyncStorage persistence |
| **Profile Tab** | Feature | `/(tabs)/profile.tsx` | Completed & Verified | Traveler profile, badges, stats (Trips, Saved, Reviews), offline maps & notification switches |
| **Destination Detail** | `#0:14` | `/destination/[id].tsx`| Completed & Verified | Hero image, floating bookmark, review rating, map action, expandable storytelling description, facilities |
| **Booking Modal Sheet** | Feature | Modal in `[id].tsx` | Completed & Verified | Validated reservation form with dates, guests, price calculation (React Hook Form + Zod) |
| **Map Preview Modal** | Feature | Modal in `[id].tsx` | Completed & Verified | Interactive topographical map preview with coordinates |

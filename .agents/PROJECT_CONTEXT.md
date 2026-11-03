# .agents/PROJECT_CONTEXT.md — Product, Scope & Stack

## 1. Product Vision
**goWild** is a worldwide hotel discovery, comparison, availability pricing, and booking mobile application built with Expo / React Native and backed by a secure TypeScript Backend-for-Frontend (`server/`).

## 2. User Journeys
- **Core Journey**:
  `Onboarding -> Home Discovery -> Destination/Date/Guest Search -> Filter & Compare Hotels (List + Synchronized Map) -> Hotel Detail (Gallery, Amenities, Policies, Reviews) -> Room & Rate Plan Selection -> Offer Revalidation & Booking Review (Itemized Taxes/Fees) -> Provider Checkout / Sandbox Reservation -> Confirmation -> My Trips (Status & Cancellation)`.
- **Secondary Journeys**:
  - Recent searches & quick re-search
  - Saved Favorites (synced with account when signed in, persisted locally via Zustand)
  - Traveler Authentication (Sign up, Sign in, Sign out, persistent bearer session)
  - Profile, Traveler details, Currency (`USD`, `EUR`, `GBP`, `MAD`, `JPY`), Language (`en`, `fr`), Reduced Motion, Dark Mode, Notifications, and Help/Concierge info.

## 3. Verified Runtime & Stack
- **Node.js**: `v24.20.0` (native TypeScript execution `process.features.typescript === 'strip'`, built-in `node:sqlite`, `node:test`, `node:http`, `node:crypto`).
- **Mobile Framework**: Expo SDK `~58.0.19`, React Native `0.88.0`, React `19.3.0` (`reactCompiler: true`, `typedRoutes: true`).
- **Routing**: `expo-router` `~58.0.26`
  - iOS: `NativeTabs` (`expo-router/native-tabs`) + `expo-symbols`
  - Android/Web: `Tabs` (`expo-router/js-tabs`) + `GoWildGlassTabBar` (`expo-blur` + `react-native-reanimated` `4.7.1`)
- **State & Validation**: `@tanstack/react-query` `^5.104.5`, `zustand` `^5.0.16`, `@react-native-async-storage/async-storage` `2.2.0`, `react-hook-form` `^7.91.0`, `zod` `^4.6.7`.
- **Visual Baseline**:
  - Brand Identity: `assets/goWild (1080 x 600 px).png` (geometric 8-petal flower `#40B4F8` + bold sans wordmark).
  - UI Kit Baseline: Figma Community file `sim22KJgjq1zKePEhnJzdM` ("Grand Hotel - Hotel Booking App UI Kits").


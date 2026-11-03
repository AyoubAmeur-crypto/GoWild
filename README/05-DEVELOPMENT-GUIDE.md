# 05 — Development Guide

## Environment Prerequisites
- Node.js >= 20
- Expo CLI (`npx expo`)
- Xcode & iOS Simulator (iOS 26+ / iOS 27 for Liquid Glass NativeTabs)

## Running the Application
```bash
# Start development server with cache clear
npx expo start -c

# Launch directly into iOS simulator
npx expo start --ios
```

## Validating Changes
```bash
# Typecheck
npx tsc --noEmit

# Dependency diagnosis
npx expo-doctor
```

## State Management Guidelines
- Never store raw server queries in Zustand.
- Use `useDestinations()` and `useDestinationDetail(id)` via TanStack Query.
- Use `useFavoritesStore` only for persisting saved IDs.
- Use `useBookingStore` for managing user reservations.

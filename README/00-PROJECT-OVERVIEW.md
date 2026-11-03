# 00 — Project Overview: goWild

## Mission
`goWild` is a high-performance, design-faithful React Native / Expo mobile application built for outdoor travelers and alpine adventurers. Based on the "Aspen Travel App" community design by NickelFox, the application has been engineered to deliver a native iOS experience using Apple's system Liquid Glass navigation, fluid animations, and high visual fidelity.

## Key Highlights
1. **Design Precision**: Exact reconstruction of Figma frames (Onboarding, Explore Feed, Destination Detail).
2. **True Native iOS Navigation**: Uses Expo Router's `NativeTabs` from `expo-router/native-tabs` providing authentic UIKit tab bar blurring and minimization.
3. **Robust State Architecture**: Clear separation of server-cached destination catalog (`TanStack Query`) and client persistence (`Zustand` + `AsyncStorage`).
4. **Interactive Flows**:
   - Destination discovery by category (Location, Hotels, Food, Adventure).
   - Real-time search and filter.
   - Favorite / Save destinations with local persistence.
   - Interactive booking sheet with Zod validation.
   - Read more expandable text and facility viewer.

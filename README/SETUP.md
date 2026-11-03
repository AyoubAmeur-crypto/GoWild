# README/SETUP.md — Installation, API Gateway & Deployment Guide

## 1. Prerequisites
- **Node.js**: `v24.x` (verified on `v24.20.0` — provides native TypeScript execution and `node:sqlite`)
- **npm**: `v10+` / `v11+`
- **iOS**: Xcode + iOS Simulator or physical iPhone via Expo Go / Dev Build
- **Android**: Android Studio Emulator (API 31+ recommended for hardware-accelerated `dimezisBlurViewSdk31Plus`) or physical Android device

## 2. Always-On API Gateway Architecture (Zero `BFF_UNREACHABLE`)
`goWild` resolves `/api/*` requests through a 4-tier gateway hierarchy (`src/lib/config.ts` & `src/services/http/apiClient.ts`):
1. **Runtime Cloud Gateway Override**: Set or switch any `https://...` URL live inside **Profile -> API Gateway & Inventory** (no rebuild required).
2. **Environment Cloud Gateway (`EXPO_PUBLIC_API_BASE_URL`)**: Permanent production gateway URL (e.g., deployed via `npx eas deploy --prod`).
3. **Built-In Expo Server API Gateway (`src/app/api/[...route]+api.ts`)**: Automatically served by `npx expo start` on Simulator, Android Emulator (`10.0.2.2`), physical phones over Wi-Fi (`Constants.expoConfig.hostUri`), Expo Tunnel, and Web — **only one terminal needed**. Also probes standalone `npm run server` (`:4010`) automatically.
4. **Always-On Embedded Local Gateway (`src/services/gateway/embeddedGateway.ts`)**: If no remote HTTP server is reachable (offline / standalone launch), persists bookings, revalidated quotes, accounts, and favorites in `AsyncStorage` (visibly badged as non-production; never masks real upstream supplier errors). Set `EXPO_PUBLIC_STRICT_REMOTE_GATEWAY=true` if you want hard fail-closed remote-only enforcement.

## 3. Running Locally (Single Command)
```bash
npx expo start -c
```
Press `i` for iOS Simulator, `a` for Android Emulator, `w` for Web, or scan the QR code on your phone — `/api/*` routes, Home, Search, Street Map, Checkout, and My Trips work immediately.

*(Optional)* To run the standalone Node 24 + SQLite BFF on port `4010` independently (e.g., for Docker / Railway / Fly.io):
```bash
npm run server
```

## 4. Deploying a Permanent Cloud API Gateway (24/7 Production URL)
Because `app.json` configures `"web": { "output": "server" }` and `src/app/api/[...route]+api.ts` compiles into an Edge/Serverless function:
```bash
# 1. Export Web + Serverless API Gateway bundle
npx expo export --platform web

# 2. Deploy to Expo Hosting (Cloudflare Workers global edge network)
npx eas deploy --prod
```
Then set `EXPO_PUBLIC_API_BASE_URL=https://<your-slug>.expo.app` in `.env` (or paste that URL directly into **Profile -> API Gateway & Inventory** in the mobile app) so your app reaches the cloud gateway 24/7 even when your computer is off.

## 5. Configuring Live Hotel Suppliers (`.env`)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
- **LiteAPI v3.0**: Set `GOWILD_PROVIDER=liteapi` and `LITEAPI_KEY=sand_...` (from `https://dashboard.liteapi.travel`).
- **Duffel Stays v2**: Set `GOWILD_PROVIDER=duffel` and `DUFFEL_ACCESS_TOKEN=duffel_test_...` (from `https://app.duffel.com`).
- **Development Catalog**: Default `GOWILD_PROVIDER=development_fixtures` (no external keys required).

## 6. Verification Gate
```bash
npm run typecheck
npm test
HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo export --platform ios --output-dir /tmp/gowild-ios-check
HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo export --platform android --output-dir /tmp/gowild-android-check
HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo export --platform web --output-dir /tmp/gowild-web-check
```

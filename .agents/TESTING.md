# .agents/TESTING.md — Test Strategy & Verification Commands

## 1. Automated Verification Commands
| Check | Command | Scope |
| :--- | :--- | :--- |
| TypeScript Client | `npx tsc --noEmit` | Strict typecheck across `src/` & Expo Router typed routes |
| TypeScript Server & Tests | `npx tsc -p tsconfig.server.json --noEmit` | Strict typecheck across `server/` & `tests/` |
| Unit + BFF Integration Suite | `npm test` (`node --test tests/*.test.ts`) | Domain validation, provider DTO adapters, search/filter math, offer revalidation, idempotent booking & cancellation, auth & zero-silent-fallback |
| iOS Production Bundle | `HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo export --platform ios --output-dir /tmp/gowild-export-ios` | Full Metro + React Compiler + NativeWind bundle for iOS |
| Android Production Bundle | `HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo export --platform android --output-dir /tmp/gowild-export-android` | Full Metro + React Compiler + NativeWind bundle for Android |
| Dependency Health | `npx expo-doctor` | Requires npm registry network access (document if blocked by sandbox) |

## 2. Critical Scenarios Covered by `tests/`
1. **Provider Adapter Mapping (`LiteApiProvider` & `DuffelStaysProvider`)**:
   - Parses real LiteAPI v3.0 (`/data/hotels`, `/hotels/rates`, `/rates/prebook`, `/rates/book`, `/bookings/{id}`) and Duffel Stays v2 (`/stays/search`, `/stays/quotes`, `/stays/bookings`) payloads via Zod.
   - Rejects malformed upstream responses cleanly.
   - Verifies **zero silent fallback** to `development_fixtures` when `liteapi` or `duffel` returns `401`/`500` or lacks credentials.
2. **Search, Filtering & Pricing Math**:
   - Multi-night occupancy calculation, tax/fee itemization, currency conversion/formatting, price range, rating, property type, free-cancellation, and amenity filtering.
3. **Booking Lifecycle & Idempotency**:
   - Offer revalidation (`POST /api/offers/revalidate`) detects expired quotes, sold-out offers, and price changes.
   - Reservation creation (`POST /api/bookings` with `Idempotency-Key`) prevents duplicate bookings on retry.
   - Cancellation (`POST /api/bookings/:id/cancel`) transitions `confirmed -> cancelled` and persists timestamp & refund policy summary in SQLite.
## 3. Executed Verification Results (2026-11-03)
- `npm run typecheck` (`tsc --noEmit && tsc -p tsconfig.server.json --noEmit`): **PASS** (Exit 0, 0 errors, `ZERO_ANY_CONFIRMED`).
- `npm test` (`node --test tests/*.test.ts`): **PASS** (10/10 tests passing, 0 failures, `359ms`).
- `HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo export --platform ios --output-dir /tmp/gowild-export-ios`: **PASS** (Exit 0, `3791` modules, `7.3MB` Hermes `.hbc`, React Compiler enabled).
- `HOME=/tmp EXPO_NO_TELEMETRY=1 npx expo export --platform android --output-dir /tmp/gowild-export-android`: **PASS** (Exit 0, `3884` modules, `7.5MB` Hermes `.hbc`, React Compiler enabled).
- `npx expo-doctor` & `npm run lint`: Blocked only by sandbox npm-registry isolation (`E403` / `eslint` not pre-installed in `node_modules`).

# README/API_PROVIDER_EVALUATION.md — Hotel Inventory & Booking Provider Research

## 1. Executive Summary & Selection
Following verification against official 2026 provider documentation, **goWild** implements a provider-neutral `HotelProvider` boundary in `server/src/providers/` with:
1. **Primary Provider — LiteAPI v3.0 (by Nuitée)**: Instant self-serve sandbox & production access, 2M+ global properties, place autocomplete, static hotel content/photos/reviews, live room rates with itemized taxes & cancellation policies, pre-booking offer revalidation (`prebook`), idempotent booking creation (`book`), retrieval, and cancellation.
2. **Secondary Provider — Duffel Stays API v2**: Instant self-serve test & live access (`Duffel-Version: v2`), global accommodation search, live rate fetching, quote revalidation (`/stays/quotes`), reservation creation (`/stays/bookings`), and cancellation.
3. **Explicit Development Fixtures (`development_fixtures`)**: Non-production local development adapter clearly labeled in UI (`DEVELOPMENT FIXTURES — NON-PRODUCTION`), strictly isolated from production mode and **never** silently substituted when a real provider fails.

---

## 2. Official Provider Comparison (Verified November 2026)

| Criteria | Amadeus Hotel APIs | Booking.com Demand API (v3.2) | Expedia Rapid API (v3) | LiteAPI v3.0 (Selected Primary) | Duffel Stays API v2 (Selected Secondary) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **2026 Access & Eligibility** | **Enterprise Only.** Self-Service Portal (`test.api.amadeus.com`, Hotel List v1, Hotel Search v3, Hotel Booking v2) was **permanently shut down on July 17, 2026**. Requires corporate sales vetting & IATA/ARC accreditation. | **Gated Enterprise.** Restricted to approved Managed Affiliate Partners with a signed Booking.com commercial contract. | **Gated Partner.** Requires formal partner application, traffic/volume review, and mandatory pre-launch UI certification. | **Open Self-Serve.** Instant developer registration & free Sandbox API key (`sand_...`); no contract or card needed to test. | **Open Self-Serve.** Instant account creation & test bearer token (`duffel_test_...`); no minimum volume commitment. |
| **Geographic Coverage** | Global GDS properties | 28M+ global listings | 700k+ global properties | 2M+ global hotels, resorts & apartments | 1M+ global stays across major chains & aggregators |
| **Static Content & High-Res Photos** | Minimal in legacy GDS without Enterprise Content | Full high-res photos, policies & descriptions | Full property catalog, room photos & amenities | Full `/data/hotels` & `/data/hotel` with photos, descriptions, facilities, check-in times & `/data/reviews` | Included in `/stays/search` & accommodation objects (photos, amenities, ratings) |
| **Live Rates & Tax Breakdown** | Enterprise only | Yes (`accommodations/search`) | Yes (`regions` / `properties/availability`) | Yes (`POST /v3.0/hotels/rates` -> `retailRate.total`, `taxesAndFees`, `suggestedSellingPrice`) | Yes (`POST /stays/search` + `fetch_all_rates`) |
| **Offer Revalidation** | Enterprise offer pricing | `accommodations/preview` | Price check link | `POST /v3.0/rates/prebook` -> returns `prebookId`, updated price & policy | `POST /stays/quotes` -> returns `quo_...` locked quote |
| **Booking & Payment Compliance** | Enterprise card/account settlement | Partner PCI or Demand Payments | Partner PCI / EPS Checkout | Sandbox: `ACC_CREDIT_CARD` token; Production: **LiteAPI Payment SDK** (`usePaymentSdk: true`) so raw PAN never touches client/BFF | Duffel Balance (sandbox/funded) or Duffel Payments component |
| **Cancellation API** | Enterprise booking management | `orders/cancel` | `DELETE` itinerary room | `PUT /v3.0/bookings/{bookingId}` with refund evaluation | `POST /stays/bookings/{id}/actions/cancel` |

---

## 3. Security & Compliance Architecture
1. **Zero Client Secrets**: `LITEAPI_KEY` and `DUFFEL_ACCESS_TOKEN` are read exclusively inside `server/src/config.ts`. Startup validation warns if `EXPO_PUBLIC_*` contains any secret-shaped variable.
2. **Idempotency**: `POST /api/bookings` requires an `Idempotency-Key` header. Duplicate submissions return the existing reservation record from SQLite (`bookings.idempotency_key UNIQUE`) and forward `clientReference` to LiteAPI.
3. **Truthful Confirmation Semantics**:
   - **Live Production (`liteapi` / `duffel` live keys)**: Reservations transition to `confirmed` only after receiving a verified provider `bookingId` + supplier `hotelConfirmationCode` / `booking_reference`. When hosted payment is required, status is `pending` with `isExternalHandoff: true` until finalized.
   - **Provider Sandbox (`sand_...` / `duffel_test_...`)**: Marked `isSandbox: true` and badged `SANDBOX TEST RESERVATION` in receipts and My Trips.
   - **Development Fixtures (`development_fixtures`)**: Marked `isSandbox: true` (`providerId: 'development_fixtures'`) and badged `DEVELOPMENT SANDBOX — NOT A LIVE RESERVATION`. Disabled completely when `NODE_ENV=production`.


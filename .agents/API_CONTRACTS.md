# .agents/API_CONTRACTS.md — Domain Models, Provider Interface & BFF Endpoints

## 1. Core Domain Contracts (`src/types/domain.ts`)
All UI components consume exclusively these provider-agnostic domain types:
- `Hotel`: `{ id, providerId, name, starRating, reviewScore, reviewCount, propertyType, summary, description, location: HotelLocation, images: HotelImage[], amenities: Amenity[], policies: HotelPolicyInfo, lowestRate?: MoneyAmount, isFreeCancellationAvailable?: boolean, reviews?: HotelReview[] }`
- `HotelImage`: `{ id, url, caption?, isHero?: boolean }`
- `HotelLocation`: `{ address, city, state?, country, countryCode, postalCode?, latitude, longitude, distanceKm?: number }`
- `Amenity`: `{ code, label, category: 'connectivity' | 'wellness' | 'dining' | 'room' | 'service' | 'accessibility' }`
- `Occupancy`: `{ rooms: number, adults: number, childrenAges: number[] }`
- `HotelSearchQuery`: `{ destination?: string, placeId?: string, cityName?: string, countryCode?: string, latitude?: number, longitude?: number, radiusKm?: number, checkIn: string, checkOut: string, occupancy: Occupancy, currency: CurrencyCode, minPrice?: number, maxPrice?: number, minRating?: number, propertyTypes?: PropertyType[], amenities?: string[], freeCancellationOnly?: boolean, sortBy?: 'recommended' | 'price_asc' | 'price_desc' | 'rating_desc' }`
- `RoomOffer`: `{ offerId, hotelId, providerId, roomName, description?, maxOccupancy: number, bedSummary?: string, sizeSqm?: number, images: HotelImage[], amenities: Amenity[], ratePlan: RatePlan, price: PriceBreakdown, cancellationPolicy: CancellationPolicy, expiresAt: string }`
- `RatePlan`: `{ rateId, boardType: 'room_only' | 'breakfast_included' | 'half_board' | 'all_inclusive', boardLabel: string, paymentType: 'pay_now' | 'pay_at_property' | 'provider_checkout', isInstantConfirmation: boolean }`
- `PriceBreakdown`: `{ currency: CurrencyCode, nights: number, rooms: number, perNightBase: number, baseSubtotal: number, taxesAndFees: number, propertyFees: number, total: number, strikethroughTotal?: number, items: { label: string; amount: number; included: boolean }[] }`
- `CancellationPolicy`: `{ refundableTag: 'refundable' | 'non_refundable' | 'partial', freeCancellationUntil?: string, penaltyAmount?: number, currency?: CurrencyCode, summary: string }`
- `RevalidatedOffer`: `{ quoteId, offer: RoomOffer, priceChanged: boolean, previousTotal?: number, available: boolean, checkoutMode: 'sandbox_instant' | 'provider_hosted_checkout', hostedCheckoutUrl?: string, expiresAt: string }`
- `BookingStatus`: `'pending' | 'confirmed' | 'failed' | 'cancelled' | 'completed'`
- `Booking`: `{ id, idempotencyKey, providerId, providerDisplayName, providerBookingId?, bookingReference?, status: BookingStatus, isSandbox: boolean, isExternalHandoff: boolean, externalCheckoutUrl?: string, hotelId, hotelName, hotelCity, hotelCountry, hotelImageUrl, roomName, boardLabel, checkIn, checkOut, nights, occupancy: Occupancy, leadGuest: Traveler, specialRequests?: string, price: PriceBreakdown, cancellationPolicy: CancellationPolicy, createdAt, updatedAt, cancelledAt? }`

## 2. Provider Capability & Adapter Interface
```ts
export interface ProviderCapabilities {
  providerId: 'liteapi' | 'duffel' | 'development_fixtures';
  displayName: string;
  mode: 'production' | 'sandbox' | 'development_fixture';
  configured: boolean;
  supportsAutocomplete: boolean;
  supportsLiveRates: boolean;
  supportsOfferRevalidation: boolean;
  supportsDirectBooking: boolean;
  supportsHostedCheckout: boolean;
  supportsBookingRetrieval: boolean;
  supportsCancellation: boolean;
}

export interface HotelProvider {
  getCapabilities(): ProviderCapabilities;
  autocompletePlaces(query: string, language?: string): Promise<PlaceSuggestion[]>;
  searchHotels(query: HotelSearchQuery): Promise<HotelSearchResult>;
  getHotelDetails(id: string, currency?: CurrencyCode, language?: string): Promise<Hotel | null>;
  getHotelImages(id: string): Promise<HotelImage[]>;
  searchAvailability(hotelId: string, checkIn: string, checkOut: string, occupancy: Occupancy, currency: CurrencyCode): Promise< boolean >;
  getRoomOffers(hotelId: string, checkIn: string, checkOut: string, occupancy: Occupancy, currency: CurrencyCode): Promise<RoomOffer[]>;
  revalidateOffer(offerId: string, context: OfferContext): Promise<RevalidatedOffer>;
  createBooking?(request: CreateBookingProviderInput): Promise<ProviderBookingResult>;
  getBooking?(providerBookingId: string): Promise<ProviderBookingStatusResult | null>;
  cancelBooking?(providerBookingId: string): Promise<ProviderCancellationResult>;
}
```

## 3. BFF REST API (`server/src/index.ts`, Default `http://localhost:4010`)
- `GET  /api/health` -> Server health + active `ProviderCapabilities`
- `GET  /api/places?q=...` -> Validated `PlaceSuggestion[]`
- `GET  /api/hotels/featured?currency=USD` -> Curated/featured `Hotel[]` + provider metadata
- `POST /api/hotels/search` -> Validated `HotelSearchQuery` -> `{ hotels, total, capabilities }`
- `GET  /api/hotels/:id?currency=USD&lang=en` -> `Hotel` details + gallery + policies + reviews
- `POST /api/hotels/:id/offers` -> `{ checkIn, checkOut, occupancy, currency }` -> `RoomOffer[]`
- `POST /api/offers/revalidate` -> `{ offerId, hotelId, checkIn, checkOut, occupancy, currency }` -> `RevalidatedOffer`
- `POST /api/bookings` (Header `Idempotency-Key` required) -> Creates reservation via provider or provider checkout handoff, persists in SQLite
- `GET  /api/bookings` -> Returns user/session bookings from SQLite (refreshed against provider where supported)
- `GET  /api/bookings/:id` -> Single booking receipt + status
- `POST /api/bookings/:id/cancel` -> Executes provider cancellation (when supported) + updates SQLite ledger
- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `PATCH /api/auth/profile`
- `GET  /api/favorites` · `POST /api/favorites/:hotelId` · `DELETE /api/favorites/:hotelId`


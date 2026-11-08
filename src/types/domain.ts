/**
 * Shared Domain Contracts for goWild
 * Strictly decoupled from upstream supplier (LiteAPI / Duffel) wire formats.
 */

export type CurrencyCode = "USD" | "EUR" | "GBP" | "MAD" | "JPY";
export type LanguageCode = "en" | "fr";

export type PropertyType = "hotel" | "resort" | "villa" | "boutique" | "apartment";

export type AmenityCategory =
  | "connectivity"
  | "wellness"
  | "dining"
  | "room"
  | "service"
  | "accessibility";

export type BoardType =
  | "room_only"
  | "breakfast_included"
  | "half_board"
  | "all_inclusive";

export type PaymentType = "pay_now" | "pay_at_property" | "provider_checkout";

export type RefundableTag = "refundable" | "non_refundable" | "partial";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "completed";

export type HotelSortBy =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "rating_desc";

export type ProviderId = "liteapi" | "duffel" | "development_fixtures";

export type ProviderOperatingMode =
  | "production"
  | "sandbox"
  | "development_fixture";

export interface ProviderCapabilities {
  providerId: ProviderId;
  displayName: string;
  mode: ProviderOperatingMode;
  configured: boolean;
  supportsAutocomplete: boolean;
  supportsLiveRates: boolean;
  supportsOfferRevalidation: boolean;
  supportsDirectBooking: boolean;
  supportsHostedCheckout: boolean;
  supportsBookingRetrieval: boolean;
  supportsCancellation: boolean;
  statusMessage?: string;
}

export interface HotelImage {
  id: string;
  url: string;
  caption?: string;
  isHero?: boolean;
}

export interface HotelLocation {
  address: string;
  city: string;
  state?: string;
  country: string;
  countryCode: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
  distanceFromCenterKm?: number;
}

export interface Amenity {
  code: string;
  label: string;
  category: AmenityCategory;
}

export interface HotelPolicyInfo {
  checkInFrom: string;
  checkOutUntil: string;
  cancellationSummary: string;
  childrenPolicy: string;
  petsAllowed: boolean;
  importantNotes?: string;
}

export interface HotelReview {
  id: string;
  authorName: string;
  rating: number;
  date: string;
  title?: string;
  comment: string;
  sourceLabel: string;
}

export interface MoneyAmount {
  amount: number;
  currency: CurrencyCode;
}

export interface Hotel {
  id: string;
  providerId: ProviderId;
  name: string;
  starRating: number;
  reviewScore: number;
  reviewCount: number;
  propertyType: PropertyType;
  summary: string;
  description: string;
  location: HotelLocation;
  images: HotelImage[];
  amenities: Amenity[];
  policies: HotelPolicyInfo;
  lowestNightlyPrice?: MoneyAmount;
  compareAtNightlyPrice?: MoneyAmount;
  isFreeCancellationAvailable: boolean;
  isInstantConfirmation: boolean;
  isFeatured?: boolean;
  bedSummary?: string;
  bathSummary?: string;
  reviews: HotelReview[];
}

export interface Occupancy {
  rooms: number;
  adults: number;
  childrenAges: number[];
}

export interface PlaceSuggestion {
  placeId: string;
  title: string;
  subtitle: string;
  cityName: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  type: "city" | "landmark" | "hotel";
}

export interface HotelSearchQuery {
  destination?: string;
  placeId?: string;
  cityName?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  checkIn: string;
  checkOut: string;
  occupancy: Occupancy;
  currency: CurrencyCode;
  language?: LanguageCode;
  minPrice?: number;
  maxPrice?: number;
  minStarRating?: number;
  propertyTypes?: PropertyType[];
  amenities?: string[];
  freeCancellationOnly?: boolean;
  instantConfirmationOnly?: boolean;
  sortBy?: HotelSortBy;
}

export interface HotelSearchResponse {
  hotels: Hotel[];
  total: number;
  capabilities: ProviderCapabilities;
  appliedQuery: HotelSearchQuery;
}

export interface RatePlan {
  rateId: string;
  boardType: BoardType;
  boardLabel: string;
  paymentType: PaymentType;
  isInstantConfirmation: boolean;
}

export interface PriceLineItem {
  label: string;
  amount: number;
  included: boolean;
}

export interface PriceBreakdown {
  currency: CurrencyCode;
  nights: number;
  rooms: number;
  perNightBase: number;
  baseSubtotal: number;
  taxesAndFees: number;
  propertyFees: number;
  total: number;
  strikethroughTotal?: number;
  items: PriceLineItem[];
}

export interface CancellationPolicy {
  refundableTag: RefundableTag;
  freeCancellationUntil?: string;
  penaltyAmount?: number;
  currency?: CurrencyCode;
  summary: string;
}

export interface RoomOffer {
  offerId: string;
  hotelId: string;
  providerId: ProviderId;
  supplierName: string;
  roomName: string;
  description: string;
  maxAdults: number;
  maxChildren: number;
  bedSummary: string;
  sizeSqm?: number;
  availableUnits?: number;
  images: HotelImage[];
  amenities: Amenity[];
  ratePlan: RatePlan;
  price: PriceBreakdown;
  cancellationPolicy: CancellationPolicy;
  expiresAt: string;
}

export interface RevalidatedOffer {
  quoteId: string;
  offer: RoomOffer;
  available: boolean;
  priceChanged: boolean;
  previousTotal?: number;
  checkoutMode: "sandbox_instant" | "provider_hosted_checkout" | "supplier_balance" | "payment_unavailable";
  hostedCheckoutUrl?: string;
  expiresAt: string;
  capabilities: ProviderCapabilities;
}

export interface Traveler {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality?: string;
}

export interface AuthenticatedUser extends Traveler {
  id: string;
  preferredCurrency: CurrencyCode;
  preferredLanguage: LanguageCode;
  createdAt: string;
}

export interface Booking {
  id: string;
  idempotencyKey: string;
  providerId: ProviderId;
  providerDisplayName: string;
  providerBookingId?: string;
  bookingReference?: string;
  status: BookingStatus;
  isSandbox: boolean;
  isExternalHandoff: boolean;
  externalCheckoutUrl?: string;
  hotelId: string;
  hotelName: string;
  hotelCity: string;
  hotelCountry: string;
  hotelAddress: string;
  hotelImageUrl: string;
  roomName: string;
  boardLabel: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  occupancy: Occupancy;
  leadGuest: Traveler;
  specialRequests?: string;
  price: PriceBreakdown;
  cancellationPolicy: CancellationPolicy;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: "booking" | "price_alert" | "account";
  createdAt: string;
  read: boolean;
  bookingId?: string;
  hotelId?: string;
}


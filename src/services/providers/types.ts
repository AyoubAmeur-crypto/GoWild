import type {
  BookingStatus,
  CurrencyCode,
  Hotel,
  HotelImage,
  HotelSearchQuery,
  HotelSearchResponse,
  LanguageCode,
  Occupancy,
  PlaceSuggestion,
  ProviderCapabilities,
  RevalidatedOffer,
  RoomOffer,
  Traveler,
} from "../../types/domain.ts";

export interface OfferLookupContext {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  occupancy: Occupancy;
  currency: CurrencyCode;
}

export interface CreateProviderBookingRequest {
  idempotencyKey: string;
  quoteId: string;
  offer: RoomOffer;
  checkIn: string;
  checkOut: string;
  occupancy: Occupancy;
  leadGuest: Traveler;
  specialRequests?: string;
}

export interface ProviderBookingResult {
  providerBookingId: string;
  bookingReference: string;
  status: BookingStatus;
  isSandbox: boolean;
  isExternalHandoff: boolean;
  externalCheckoutUrl?: string;
}

export interface ProviderBookingStatusResult {
  providerBookingId: string;
  bookingReference?: string;
  status: BookingStatus;
  cancelledAt?: string;
}

export interface ProviderCancellationResult {
  providerBookingId: string;
  status: "cancelled";
  cancelledAt: string;
  refundSummary: string;
}

/**
 * Provider-neutral HotelProvider contract.
 * Implemented by LiteApiProvider, DuffelStaysProvider, and ExplicitDevFixtureProvider.
 */
export interface HotelProvider {
  getCapabilities(): ProviderCapabilities;

  autocompletePlaces(
    query: string,
    language?: LanguageCode
  ): Promise<PlaceSuggestion[]>;

  searchHotels(query: HotelSearchQuery): Promise<HotelSearchResponse>;

  getHotelDetails(
    id: string,
    currency?: CurrencyCode,
    language?: LanguageCode
  ): Promise<Hotel | null>;

  getHotelImages(id: string): Promise<HotelImage[]>;

  searchAvailability(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    occupancy: Occupancy,
    currency: CurrencyCode
  ): Promise<boolean>;

  getRoomOffers(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    occupancy: Occupancy,
    currency: CurrencyCode
  ): Promise<RoomOffer[]>;

  revalidateOffer(
    offerId: string,
    context: OfferLookupContext
  ): Promise<RevalidatedOffer>;

  createBooking?(
    request: CreateProviderBookingRequest
  ): Promise<ProviderBookingResult>;

  getBooking?(
    providerBookingId: string
  ): Promise<ProviderBookingStatusResult | null>;

  cancelBooking?(
    providerBookingId: string
  ): Promise<ProviderCancellationResult>;
}


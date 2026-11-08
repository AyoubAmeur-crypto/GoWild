import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Booking,
  CurrencyCode,
  Hotel,
  HotelSearchQuery,
  HotelSearchResponse,
  LanguageCode,
  Occupancy,
  PlaceSuggestion,
  ProviderCapabilities,
  RevalidatedOffer,
  RoomOffer,
} from "../../types/domain.ts";
import type { CreateBookingInput } from "../../lib/validation.ts";
import {
  calculateNights,
  computePriceBreakdown,
  convertFromUsd,
  filterAndSortHotels,
} from "../../lib/pricing.ts";
import {
  FIXTURE_HOTELS,
  FIXTURE_PLACES,
  type FixtureHotelSeed,
} from "../../mocks/hotelsFixtureCatalog.ts";

const STORAGE_BOOKINGS_KEY = "@gowild_inapp_bookings_v2";

let memoryStorage: Record<string, string> = {};

async function readStorage(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memoryStorage[key] ?? null;
  }
}

async function writeStorage(key: string, val: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, val);
  } catch {
    memoryStorage[key] = val;
  }
}

export const IN_APP_CAPABILITIES: ProviderCapabilities = {
  providerId: "development_fixtures",
  displayName: "goWild Native Booking Engine",
  mode: "development_fixture",
  configured: true,
  supportsAutocomplete: true,
  supportsLiveRates: true,
  supportsOfferRevalidation: true,
  supportsDirectBooking: true,
  supportsHostedCheckout: false,
  supportsBookingRetrieval: true,
  supportsCancellation: true,
  statusMessage: "Native in-app reservations are fully active and connected.",
};

function seedToHotel(seed: FixtureHotelSeed, currency: CurrencyCode): Hotel {
  const converted = convertFromUsd(seed.baseNightlyUsd, currency);
  return {
    id: seed.id,
    providerId: "development_fixtures",
    name: seed.name,
    starRating: seed.starRating,
    reviewScore: seed.reviewScore,
    reviewCount: seed.reviewCount,
    propertyType: seed.propertyType,
    summary: seed.summary,
    description: seed.description,
    location: seed.location,
    images: seed.images,
    amenities: seed.amenities,
    policies: seed.policies,
    lowestNightlyPrice: { amount: converted, currency },
    compareAtNightlyPrice: seed.discountRatio
      ? {
          amount: Math.round(converted / (1 - seed.discountRatio)),
          currency,
        }
      : undefined,
    isFreeCancellationAvailable: seed.isFreeCancellationAvailable,
    isInstantConfirmation: seed.isInstantConfirmation,
    isFeatured: seed.isFeatured,
    bedSummary: seed.bedSummary,
    bathSummary: seed.bathSummary,
    reviews: seed.reviews,
  };
}

export const InAppBookingProvider = {
  capabilities: IN_APP_CAPABILITIES,

  autocompletePlaces(q: string, _lang?: LanguageCode): PlaceSuggestion[] {
    const clean = q.trim().toLowerCase();
    if (!clean) return FIXTURE_PLACES.slice(0, 5);
    return FIXTURE_PLACES.filter(
      (p) =>
        p.title.toLowerCase().includes(clean) ||
        p.cityName.toLowerCase().includes(clean) ||
        p.country.toLowerCase().includes(clean)
    );
  },

  getFeaturedHotels(
    currency: CurrencyCode,
    _checkIn?: string,
    _checkOut?: string
  ): { hotels: Hotel[]; capabilities: ProviderCapabilities } {
    const hotels = FIXTURE_HOTELS.filter((h) => h.isFeatured).map((h) =>
      seedToHotel(h, currency)
    );
    return { hotels, capabilities: IN_APP_CAPABILITIES };
  },

  searchHotels(query: HotelSearchQuery): HotelSearchResponse {
    const all = FIXTURE_HOTELS.map((h) => seedToHotel(h, query.currency));
    const filtered = filterAndSortHotels(all, query);
    return {
      hotels: filtered,
      total: filtered.length,
      appliedQuery: query,
      capabilities: IN_APP_CAPABILITIES,
    };
  },

  getHotelDetails(
    id: string,
    currency: CurrencyCode,
    _lang?: LanguageCode
  ): { hotel: Hotel; capabilities: ProviderCapabilities } {
    const found = FIXTURE_HOTELS.find((h) => h.id === id) ?? FIXTURE_HOTELS[0];
    return {
      hotel: seedToHotel(found, currency),
      capabilities: IN_APP_CAPABILITIES,
    };
  },

  getRoomOffers(
    hotelId: string,
    params: {
      checkIn: string;
      checkOut: string;
      occupancy: Occupancy;
      currency: CurrencyCode;
    }
  ): { offers: RoomOffer[]; capabilities: ProviderCapabilities } {
    const hotel =
      FIXTURE_HOTELS.find((h) => h.id === hotelId) ?? FIXTURE_HOTELS[0];

    const offers: RoomOffer[] = hotel.rooms.map((room, idx) => {
      const perNightUsd = hotel.baseNightlyUsd * room.priceMultiplier;
      const price = computePriceBreakdown({
        perNightUsd,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        occupancy: params.occupancy,
        currency: params.currency,
        taxRate: 0.12,
        propertyFeePerNightUsd: 15,
      });

      return {
        offerId: `off_${hotel.id}_${room.code}_${idx}`,
        hotelId: hotel.id,
        providerId: "development_fixtures",
        supplierName: "goWild Direct",
        roomName: room.roomName,
        description: room.description,
        maxAdults: room.maxAdults,
        maxChildren: room.maxChildren,
        bedSummary: room.bedSummary,
        sizeSqm: room.sizeSqm,
        availableUnits: room.availableUnits,
        images: hotel.images.slice(0, 3),
        amenities: hotel.amenities.slice(0, 5),
        ratePlan: {
          rateId: `rate-${room.code}-${idx}`,
          boardType: idx % 2 === 1 ? "breakfast_included" : "room_only",
          boardLabel: idx % 2 === 1 ? "Breakfast Included" : "Room Only",
          paymentType: "pay_now",
          isInstantConfirmation: true,
        },
        price,
        cancellationPolicy: {
          refundableTag: "refundable",
          freeCancellationUntil: new Date(Date.now() + 86400000 * 2).toISOString(),
          summary: "Free cancellation up to 48 hours prior to check-in.",
        },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
    });

    return { offers, capabilities: IN_APP_CAPABILITIES };
  },

  revalidateOffer(input: {
    offerId: string;
    hotelId: string;
    checkIn: string;
    checkOut: string;
    occupancy: Occupancy;
    currency: CurrencyCode;
  }): { revalidated: RevalidatedOffer } {
    const offersRes = this.getRoomOffers(input.hotelId, input);
    const matched =
      offersRes.offers.find((o) => o.offerId === input.offerId) ??
      offersRes.offers[0];

    const revalidated: RevalidatedOffer = {
      quoteId: `quote_${input.hotelId}_${input.offerId}_${Date.now()}`,
      offer: matched,
      available: true,
      priceChanged: false,
      checkoutMode: "sandbox_instant",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      capabilities: IN_APP_CAPABILITIES,
    };

    return { revalidated };
  },

  async createBooking(
    input: CreateBookingInput,
    idempotencyKey: string
  ): Promise<{ booking: Booking; deduplicated: boolean }> {
    const existingRaw = await readStorage(STORAGE_BOOKINGS_KEY);
    const existingList: Booking[] = existingRaw ? JSON.parse(existingRaw) : [];

    const dedupe = existingList.find((b) => b.idempotencyKey === idempotencyKey);
    if (dedupe) {
      return { booking: dedupe, deduplicated: true };
    }

    const hotelSeed =
      FIXTURE_HOTELS.find((h) => h.id === input.hotelId) ?? FIXTURE_HOTELS[0];
    const nights = calculateNights(input.checkIn, input.checkOut);

    const price = computePriceBreakdown({
      perNightUsd: hotelSeed.baseNightlyUsd,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      occupancy: input.occupancy,
      currency: input.currency,
      taxRate: 0.12,
      propertyFeePerNightUsd: 15,
    });

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const bookingId = `gw_bk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const bookingRef = `GW-${randomSuffix}`;

    const newBooking: Booking = {
      id: bookingId,
      idempotencyKey,
      providerId: "development_fixtures",
      providerDisplayName: "goWild Direct",
      providerBookingId: `prov_${randomSuffix}`,
      bookingReference: bookingRef,
      status: "confirmed",
      isSandbox: true,
      isExternalHandoff: false,
      hotelId: hotelSeed.id,
      hotelName: hotelSeed.name,
      hotelCity: hotelSeed.location.city,
      hotelCountry: hotelSeed.location.country,
      hotelAddress: hotelSeed.location.address,
      hotelImageUrl: hotelSeed.images[0]?.url ?? "",
      roomName: "Deluxe King Room",
      boardLabel: "Breakfast Included",
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights,
      occupancy: input.occupancy,
      leadGuest: input.leadGuest,
      specialRequests: input.specialRequests,
      price,
      cancellationPolicy: {
        refundableTag: "refundable",
        summary: hotelSeed.policies.cancellationSummary,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newBooking, ...existingList];
    await writeStorage(STORAGE_BOOKINGS_KEY, JSON.stringify(updated));

    return { booking: newBooking, deduplicated: false };
  },

  async listBookings(): Promise<{
    bookings: Booking[];
    capabilities: ProviderCapabilities;
  }> {
    const raw = await readStorage(STORAGE_BOOKINGS_KEY);
    const bookings: Booking[] = raw ? JSON.parse(raw) : [];
    return { bookings, capabilities: IN_APP_CAPABILITIES };
  },

  async getBooking(
    bookingId: string
  ): Promise<{ booking: Booking; capabilities: ProviderCapabilities }> {
    const raw = await readStorage(STORAGE_BOOKINGS_KEY);
    const bookings: Booking[] = raw ? JSON.parse(raw) : [];
    const found = bookings.find((b) => b.id === bookingId);
    if (!found) {
      throw new Error(`Reservation "${bookingId}" was not found.`);
    }
    return { booking: found, capabilities: IN_APP_CAPABILITIES };
  },

  async cancelBooking(
    bookingId: string
  ): Promise<{ booking: Booking; refundSummary: string }> {
    const raw = await readStorage(STORAGE_BOOKINGS_KEY);
    const bookings: Booking[] = raw ? JSON.parse(raw) : [];
    const idx = bookings.findIndex((b) => b.id === bookingId);
    if (idx === -1) {
      throw new Error(`Reservation "${bookingId}" was not found.`);
    }

    const cancelled: Booking = {
      ...bookings[idx],
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    bookings[idx] = cancelled;
    await writeStorage(STORAGE_BOOKINGS_KEY, JSON.stringify(bookings));

    return {
      booking: cancelled,
      refundSummary:
        "Reservation cancelled successfully. A full refund has been credited to your payment method.",
    };
  },
};

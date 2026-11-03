import crypto from "node:crypto";
import { AppError } from "../errors.ts";
import {
  computePriceBreakdown,
  convertFromUsd,
  filterAndSortHotels,
  getDefaultDates,
} from "../../../src/lib/pricing.ts";
import {
  FIXTURE_HOTELS,
  FIXTURE_PLACES,
  type FixtureHotelSeed,
} from "../../../src/mocks/hotelsFixtureCatalog.ts";
import type {
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
} from "../../../src/types/domain.ts";
import type {
  CreateProviderBookingRequest,
  HotelProvider,
  OfferLookupContext,
  ProviderBookingResult,
  ProviderBookingStatusResult,
  ProviderCancellationResult,
} from "../../../src/services/providers/types.ts";

/**
 * Explicit Development Fixture Provider (NON-PRODUCTION).
 * Strictly isolated to local development when `GOWILD_PROVIDER=development_fixtures`.
 */
export class ExplicitDevFixtureProvider implements HotelProvider {
  private readonly statusLedger = new Map<string, ProviderBookingStatusResult>();

  public getCapabilities(): ProviderCapabilities {
    return {
      providerId: "development_fixtures",
      displayName: "goWild Dev Fixture Catalog (Non-Production)",
      mode: "development_fixture",
      configured: true,
      supportsAutocomplete: true,
      supportsLiveRates: true,
      supportsOfferRevalidation: true,
      supportsDirectBooking: true,
      supportsHostedCheckout: false,
      supportsBookingRetrieval: true,
      supportsCancellation: true,
      statusMessage:
        "Running in explicit Development Fixture mode. Configure LITEAPI_KEY or DUFFEL_ACCESS_TOKEN in .env for live supplier inventory.",
    };
  }

  public async autocompletePlaces(
    query: string,
    _language?: LanguageCode
  ): Promise<PlaceSuggestion[]> {
    const q = query.trim().toLowerCase();
    if (!q) return FIXTURE_PLACES.slice(0, 6);

    const placeMatches = FIXTURE_PLACES.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q)
    );

    const hotelMatches: PlaceSuggestion[] = FIXTURE_HOTELS.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.location.city.toLowerCase().includes(q)
    ).map((h) => ({
      placeId: `htl_${h.id}`,
      title: h.name,
      subtitle: `${h.location.city}, ${h.location.country}`,
      cityName: h.location.city,
      country: h.location.country,
      countryCode: h.location.countryCode,
      latitude: h.location.latitude,
      longitude: h.location.longitude,
      type: "hotel",
    }));

    return [...placeMatches, ...hotelMatches].slice(0, 8);
  }

  public async searchHotels(query: HotelSearchQuery): Promise<HotelSearchResponse> {
    const mapped = FIXTURE_HOTELS.map((seed) =>
      this.mapSeedToHotel(seed, query.currency, query.checkIn, query.checkOut, query.occupancy)
    );
    const results = filterAndSortHotels(mapped, query);
    return {
      hotels: results,
      total: results.length,
      capabilities: this.getCapabilities(),
      appliedQuery: query,
    };
  }

  public async getHotelDetails(
    id: string,
    currency: CurrencyCode = "USD",
    _language?: LanguageCode
  ): Promise<Hotel | null> {
    const seed = FIXTURE_HOTELS.find((h) => h.id === id);
    if (!seed) return null;
    const defaults = getDefaultDates();
    return this.mapSeedToHotel(seed, currency, defaults.checkIn, defaults.checkOut, {
      rooms: 1,
      adults: 2,
      childrenAges: [],
    });
  }

  public async getHotelImages(id: string): Promise<HotelImage[]> {
    const seed = FIXTURE_HOTELS.find((h) => h.id === id);
    return seed?.images ?? [];
  }

  public async searchAvailability(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    occupancy: Occupancy,
    currency: CurrencyCode
  ): Promise<boolean> {
    const offers = await this.getRoomOffers(hotelId, checkIn, checkOut, occupancy, currency);
    return offers.length > 0;
  }

  public async getRoomOffers(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    occupancy: Occupancy,
    currency: CurrencyCode
  ): Promise<RoomOffer[]> {
    const seed = FIXTURE_HOTELS.find((h) => h.id === hotelId);
    if (!seed) return [];

    const adultsPerRoom = Math.ceil(occupancy.adults / Math.max(1, occupancy.rooms));
    const offers: RoomOffer[] = [];
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const freeCancelDate = new Date(`${checkIn}T12:00:00Z`);
    freeCancelDate.setUTCDate(freeCancelDate.getUTCDate() - 2);
    const freeCancelIso = freeCancelDate.toISOString();

    for (const room of seed.rooms) {
      if (room.maxAdults < adultsPerRoom) continue;

      // Plan A: Flexible + Breakfast Included
      const flexUsd = seed.baseNightlyUsd * room.priceMultiplier * 1.08;
      const flexPrice = computePriceBreakdown({
        perNightUsd: flexUsd,
        checkIn,
        checkOut,
        occupancy,
        currency,
        discountRatio: seed.discountRatio,
      });

      offers.push({
        offerId: `fxoff_${seed.id}__${room.code}__flex`,
        hotelId: seed.id,
        providerId: "development_fixtures",
        supplierName: "goWild Dev Fixture Inventory",
        roomName: room.roomName,
        description: room.description,
        maxAdults: room.maxAdults,
        maxChildren: room.maxChildren,
        bedSummary: room.bedSummary,
        sizeSqm: room.sizeSqm,
        availableUnits: room.availableUnits,
        images: seed.images,
        amenities: seed.amenities.slice(0, 5),
        ratePlan: {
          rateId: `${room.code}_flex_bb`,
          boardType: "breakfast_included",
          boardLabel: "Breakfast Included · Flexible",
          paymentType: "pay_now",
          isInstantConfirmation: true,
        },
        price: flexPrice,
        cancellationPolicy: {
          refundableTag: "refundable",
          freeCancellationUntil: freeCancelIso,
          currency,
          summary: `Free cancellation until ${freeCancelIso.slice(0, 10)} (48h before check-in).`,
        },
        expiresAt,
      });

      // Plan B: Saver Room Only (Non-Refundable, 9% lower)
      const saverUsd = seed.baseNightlyUsd * room.priceMultiplier * 0.94;
      const saverPrice = computePriceBreakdown({
        perNightUsd: saverUsd,
        checkIn,
        checkOut,
        occupancy,
        currency,
      });

      offers.push({
        offerId: `fxoff_${seed.id}__${room.code}__saver`,
        hotelId: seed.id,
        providerId: "development_fixtures",
        supplierName: "goWild Dev Fixture Inventory",
        roomName: room.roomName,
        description: room.description,
        maxAdults: room.maxAdults,
        maxChildren: room.maxChildren,
        bedSummary: room.bedSummary,
        sizeSqm: room.sizeSqm,
        availableUnits: room.availableUnits,
        images: seed.images,
        amenities: seed.amenities.slice(0, 4),
        ratePlan: {
          rateId: `${room.code}_saver_ro`,
          boardType: "room_only",
          boardLabel: "Room Only · Advance Saver",
          paymentType: "pay_now",
          isInstantConfirmation: true,
        },
        price: saverPrice,
        cancellationPolicy: {
          refundableTag: "non_refundable",
          penaltyAmount: saverPrice.total,
          currency,
          summary: "Non-refundable Advance Saver rate. Full stay charged upon cancellation.",
        },
        expiresAt,
      });
    }

    return offers;
  }

  public async revalidateOffer(
    offerId: string,
    context: OfferLookupContext
  ): Promise<RevalidatedOffer> {
    if (offerId.includes("expired")) {
      throw new AppError(410, "OFFER_EXPIRED", "This room offer has expired. Please refresh rates.");
    }
    if (offerId.includes("soldout")) {
      throw new AppError(409, "OFFER_SOLD_OUT", "This room category just sold out for your dates.");
    }

    const offers = await this.getRoomOffers(
      context.hotelId,
      context.checkIn,
      context.checkOut,
      context.occupancy,
      context.currency
    );
    const match = offers.find((o) => o.offerId === offerId);
    if (!match) {
      throw new AppError(
        409,
        "OFFER_SOLD_OUT",
        "Selected room offer is unavailable for the requested dates and occupancy."
      );
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const quoteId = `fxquo_${crypto.randomBytes(8).toString("hex")}`;

    return {
      quoteId,
      offer: { ...match, expiresAt },
      available: true,
      priceChanged: false,
      checkoutMode: "sandbox_instant",
      expiresAt,
      capabilities: this.getCapabilities(),
    };
  }

  public async createBooking(
    request: CreateProviderBookingRequest
  ): Promise<ProviderBookingResult> {
    const providerBookingId = `fxbk_${crypto.randomBytes(6).toString("hex")}`;
    const bookingReference = `GW-DEV-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    this.statusLedger.set(providerBookingId, {
      providerBookingId,
      bookingReference,
      status: "confirmed",
    });

    return {
      providerBookingId,
      bookingReference,
      status: "confirmed",
      isSandbox: true,
      isExternalHandoff: false,
    };
  }

  public async getBooking(
    providerBookingId: string
  ): Promise<ProviderBookingStatusResult | null> {
    return (
      this.statusLedger.get(providerBookingId) ?? {
        providerBookingId,
        status: "confirmed",
      }
    );
  }

  public async cancelBooking(
    providerBookingId: string
  ): Promise<ProviderCancellationResult> {
    const cancelledAt = new Date().toISOString();
    this.statusLedger.set(providerBookingId, {
      providerBookingId,
      status: "cancelled",
      cancelledAt,
    });
    return {
      providerBookingId,
      status: "cancelled",
      cancelledAt,
      refundSummary: "Sandbox test reservation cancelled in development fixture ledger.",
    };
  }

  private mapSeedToHotel(
    seed: FixtureHotelSeed,
    currency: CurrencyCode,
    checkIn: string,
    checkOut: string,
    occupancy: Occupancy
  ): Hotel {
    const breakdown = computePriceBreakdown({
      perNightUsd: seed.baseNightlyUsd * 0.94,
      checkIn,
      checkOut,
      occupancy,
      currency,
      discountRatio: seed.discountRatio,
    });

    const compareNightly = seed.discountRatio
      ? convertFromUsd(seed.baseNightlyUsd / (1 - seed.discountRatio), currency)
      : undefined;

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
      lowestNightlyPrice: {
        amount: breakdown.perNightBase,
        currency,
      },
      compareAtNightlyPrice: compareNightly
        ? { amount: compareNightly, currency }
        : undefined,
      isFreeCancellationAvailable: seed.isFreeCancellationAvailable,
      isInstantConfirmation: seed.isInstantConfirmation,
      isFeatured: seed.isFeatured,
      bedSummary: seed.bedSummary,
      bathSummary: seed.bathSummary,
      reviews: seed.reviews,
    };
  }
}

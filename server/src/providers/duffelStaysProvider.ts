import { z } from "zod";
import { AppError, ProviderNotConfiguredError } from "../errors.ts";
import { requestUpstreamJson, type FetchLike } from "../httpClient.ts";
import { calculateNights, filterAndSortHotels, roundMoney } from "../../../src/lib/pricing.ts";
import { FIXTURE_PLACES } from "../../../src/mocks/hotelsFixtureCatalog.ts";
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
} from "../../../src/types/domain.ts";
import type {
  CreateProviderBookingRequest,
  HotelProvider,
  OfferLookupContext,
  ProviderBookingResult,
  ProviderBookingStatusResult,
  ProviderCancellationResult,
} from "../../../src/services/providers/types.ts";

const DuffelAccommodationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  rating: z.number().nullable().optional(),
  review_score: z.number().nullable().optional(),
  review_count: z.number().nullable().optional(),
  photos: z
    .array(
      z.object({
        url: z.string(),
      })
    )
    .optional(),
  amenities: z
    .array(
      z.object({
        type: z.string().optional(),
        description: z.string(),
      })
    )
    .optional(),
  location: z
    .object({
      geographic_coordinates: z
        .object({
          latitude: z.number(),
          longitude: z.number(),
        })
        .optional(),
      address: z
        .object({
          line_one: z.string().optional(),
          city_name: z.string().optional(),
          country_code: z.string().optional(),
          postal_code: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  rooms: z
    .array(
      z.object({
        name: z.string(),
        rates: z.array(
          z.object({
            id: z.string(),
            total_amount: z.string(),
            total_currency: z.string(),
            tax_amount: z.string().nullable().optional(),
            board_type: z.string().optional(),
            cancellation_timeline: z
              .array(
                z.object({
                  before: z.string().optional(),
                  refund_amount: z.string().optional(),
                })
              )
              .optional(),
          })
        ),
      })
    )
    .optional(),
});

const DuffelSearchResultItemSchema = z.object({
  id: z.string(),
  cheapest_rate_total_amount: z.string(),
  cheapest_rate_currency: z.string(),
  accommodation: DuffelAccommodationSchema,
});

export interface DuffelStaysProviderOptions {
  accessToken: string;
  baseUrl: string;
  timeoutMs?: number;
  fetchFn?: FetchLike;
}

export class DuffelStaysProvider implements HotelProvider {
  private readonly opts: DuffelStaysProviderOptions;

  constructor(opts: DuffelStaysProviderOptions) {
    this.opts = opts;
  }

  private get isConfigured(): boolean {
    return this.opts.accessToken.trim().length > 0;
  }

  private get isTestToken(): boolean {
    return this.opts.accessToken.trim().startsWith("duffel_test_");
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ProviderNotConfiguredError("Duffel Stays v2", "DUFFEL_ACCESS_TOKEN");
    }
  }

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.opts.accessToken.trim()}`,
      "Duffel-Version": "v2",
    };
  }

  public getCapabilities(): ProviderCapabilities {
    const configured = this.isConfigured;
    const isSandbox = this.isTestToken;
    return {
      providerId: "duffel",
      displayName: isSandbox ? "Duffel Stays v2 (Test)" : "Duffel Stays v2",
      mode: isSandbox ? "sandbox" : "production",
      configured,
      supportsAutocomplete: true,
      supportsLiveRates: true,
      supportsOfferRevalidation: true,
      supportsDirectBooking: isSandbox,
      supportsHostedCheckout: !isSandbox,
      supportsBookingRetrieval: true,
      supportsCancellation: true,
      statusMessage: configured
        ? "Connected to Duffel Stays API v2."
        : "DUFFEL_ACCESS_TOKEN is missing in server environment.",
    };
  }

  public async autocompletePlaces(
    query: string,
    _language?: LanguageCode
  ): Promise<PlaceSuggestion[]> {
    this.assertConfigured();
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return FIXTURE_PLACES.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)
    );
  }

  public async searchHotels(query: HotelSearchQuery): Promise<HotelSearchResponse> {
    this.assertConfigured();
    const matchedPlace = FIXTURE_PLACES.find(
      (p) =>
        p.cityName.toLowerCase() ===
        (query.cityName ?? query.destination ?? "").trim().toLowerCase()
    );
    const lat = query.latitude ?? matchedPlace?.latitude ?? 48.8566;
    const lng = query.longitude ?? matchedPlace?.longitude ?? 2.3522;

    const guests = [
      ...Array.from({ length: query.occupancy.adults }, () => ({ type: "adult" })),
      ...query.occupancy.childrenAges.map((age) => ({ type: "child", age })),
    ];

    const resp = await requestUpstreamJson<{
      data?: { results?: unknown[] };
    }>({
      providerName: "Duffel Stays",
      url: `${this.opts.baseUrl}/stays/search`,
      method: "POST",
      headers: this.authHeaders,
      body: {
        data: {
          check_in_date: query.checkIn,
          check_out_date: query.checkOut,
          rooms: query.occupancy.rooms,
          guests,
          free_cancellation_only: query.freeCancellationOnly ?? false,
          location: {
            radius: query.radiusKm ?? 12,
            geographic_coordinates: {
              latitude: lat,
              longitude: lng,
            },
          },
        },
      },
      idempotentRetry: true,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const nights = calculateNights(query.checkIn, query.checkOut);
    const rawList = Array.isArray(resp?.data?.results) ? resp.data.results : [];
    const hotels: Hotel[] = [];

    for (const item of rawList) {
      const parsed = DuffelSearchResultItemSchema.safeParse(item);
      if (!parsed.success) continue;
      const total = Number(parsed.data.cheapest_rate_total_amount);
      hotels.push(
        this.mapDuffelAccommodation(
          parsed.data.id,
          parsed.data.accommodation,
          query.currency,
          Number.isFinite(total) ? roundMoney(total / nights, query.currency) : undefined
        )
      );
    }

    const filtered = filterAndSortHotels(hotels, query);
    return {
      hotels: filtered,
      total: filtered.length,
      capabilities: this.getCapabilities(),
      appliedQuery: query,
    };
  }

  public async getHotelDetails(
    id: string,
    currency: CurrencyCode = "USD"
  ): Promise<Hotel | null> {
    this.assertConfigured();
    const resp = await requestUpstreamJson<{
      data?: { accommodation?: unknown };
    }>({
      providerName: "Duffel Stays",
      url: `${this.opts.baseUrl}/stays/search_results/${encodeURIComponent(
        id
      )}/actions/fetch_all_rates`,
      method: "POST",
      headers: this.authHeaders,
      idempotentRetry: true,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const parsed = DuffelAccommodationSchema.safeParse(resp?.data?.accommodation);
    if (!parsed.success) return null;
    return this.mapDuffelAccommodation(id, parsed.data, currency);
  }

  public async getHotelImages(id: string): Promise<HotelImage[]> {
    const hotel = await this.getHotelDetails(id);
    return hotel?.images ?? [];
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
    this.assertConfigured();
    const resp = await requestUpstreamJson<{
      data?: { accommodation?: unknown };
    }>({
      providerName: "Duffel Stays",
      url: `${this.opts.baseUrl}/stays/search_results/${encodeURIComponent(
        hotelId
      )}/actions/fetch_all_rates`,
      method: "POST",
      headers: this.authHeaders,
      idempotentRetry: true,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const parsed = DuffelAccommodationSchema.safeParse(resp?.data?.accommodation);
    if (!parsed.success) return [];

    const nights = calculateNights(checkIn, checkOut);
    const offers: RoomOffer[] = [];
    for (const room of parsed.data.rooms ?? []) {
      for (const rate of room.rates) {
        const total = roundMoney(Number(rate.total_amount), currency);
        const taxes = roundMoney(Number(rate.tax_amount ?? 0), currency);
        const baseSubtotal = roundMoney(Math.max(0, total - taxes), currency);
        const hasRefundTimeline = (rate.cancellation_timeline?.length ?? 0) > 0;
        const deadline = rate.cancellation_timeline?.[0]?.before;

        offers.push({
          offerId: rate.id,
          hotelId,
          providerId: "duffel",
          supplierName: "Duffel Stays",
          roomName: room.name,
          description: `${room.name} (${rate.board_type ?? "room_only"})`,
          maxAdults: occupancy.adults,
          maxChildren: occupancy.childrenAges.length,
          bedSummary: "Standard Bedding",
          images: [],
          amenities: [],
          ratePlan: {
            rateId: rate.id,
            boardType:
              rate.board_type === "breakfast" ? "breakfast_included" : "room_only",
            boardLabel:
              rate.board_type === "breakfast" ? "Breakfast Included" : "Room Only",
            paymentType: this.isTestToken ? "pay_now" : "provider_checkout",
            isInstantConfirmation: true,
          },
          price: {
            currency,
            nights,
            rooms: occupancy.rooms,
            perNightBase: roundMoney(baseSubtotal / Math.max(1, nights * occupancy.rooms), currency),
            baseSubtotal,
            taxesAndFees: taxes,
            propertyFees: 0,
            total,
            items: [
              { label: `${nights} nights × ${occupancy.rooms} room`, amount: baseSubtotal, included: true },
              { label: "Taxes & fees", amount: taxes, included: true },
            ],
          },
          cancellationPolicy: {
            refundableTag: hasRefundTimeline ? "refundable" : "non_refundable",
            freeCancellationUntil: deadline,
            summary: hasRefundTimeline
              ? `Free cancellation available before ${deadline ?? "deadline"}.`
              : "Non-refundable rate.",
          },
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });
      }
    }
    return offers;
  }

  public async revalidateOffer(
    offerId: string,
    context: OfferLookupContext
  ): Promise<RevalidatedOffer> {
    this.assertConfigured();
    const resp = await requestUpstreamJson<{
      data?: {
        id?: string;
        total_amount?: string;
        tax_amount?: string;
      };
    }>({
      providerName: "Duffel Stays",
      url: `${this.opts.baseUrl}/stays/quotes`,
      method: "POST",
      headers: this.authHeaders,
      body: { data: { rate_id: offerId } },
      idempotentRetry: false,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const quoteId = resp?.data?.id;
    if (!quoteId) {
      throw new AppError(409, "OFFER_SOLD_OUT", "Duffel quote creation failed: rate unavailable.");
    }

    const nights = calculateNights(context.checkIn, context.checkOut);
    const total = roundMoney(Number(resp.data?.total_amount ?? 0), context.currency);
    const taxes = roundMoney(Number(resp.data?.tax_amount ?? 0), context.currency);
    const base = roundMoney(Math.max(0, total - taxes), context.currency);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return {
      quoteId,
      offer: {
        offerId,
        hotelId: context.hotelId,
        providerId: "duffel",
        supplierName: "Duffel Stays",
        roomName: "Confirmed Quote Room",
        description: "Locked Duffel Stays rate quote",
        maxAdults: context.occupancy.adults,
        maxChildren: context.occupancy.childrenAges.length,
        bedSummary: "Standard Bedding",
        images: [],
        amenities: [],
        ratePlan: {
          rateId: offerId,
          boardType: "room_only",
          boardLabel: "Quoted Rate",
          paymentType: this.isTestToken ? "pay_now" : "provider_checkout",
          isInstantConfirmation: true,
        },
        price: {
          currency: context.currency,
          nights,
          rooms: context.occupancy.rooms,
          perNightBase: roundMoney(base / Math.max(1, nights * context.occupancy.rooms), context.currency),
          baseSubtotal: base,
          taxesAndFees: taxes,
          propertyFees: 0,
          total,
          items: [
            { label: `${nights} nights`, amount: base, included: true },
            { label: "Taxes & fees", amount: taxes, included: true },
          ],
        },
        cancellationPolicy: {
          refundableTag: "refundable",
          summary: "Subject to Duffel quote cancellation timeline.",
        },
        expiresAt,
      },
      available: true,
      priceChanged: false,
      checkoutMode: this.isTestToken ? "sandbox_instant" : "provider_hosted_checkout",
      expiresAt,
      capabilities: this.getCapabilities(),
    };
  }

  public async createBooking(
    request: CreateProviderBookingRequest
  ): Promise<ProviderBookingResult> {
    this.assertConfigured();
    const resp = await requestUpstreamJson<{
      data?: {
        id?: string;
        reference?: string;
        booking_reference?: string;
        status?: string;
      };
    }>({
      providerName: "Duffel Stays",
      url: `${this.opts.baseUrl}/stays/bookings`,
      method: "POST",
      headers: this.authHeaders,
      body: {
        data: {
          quote_id: request.quoteId,
          email: request.leadGuest.email,
          phone_number: request.leadGuest.phone.replace(/[^\d+]/g, ""),
          guests: [
            {
              given_name: request.leadGuest.firstName,
              family_name: request.leadGuest.lastName,
            },
          ],
          accommodation_special_requests: request.specialRequests,
          metadata: { idempotency_key: request.idempotencyKey },
        },
      },
      idempotentRetry: false,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const id = resp?.data?.id;
    if (!id) {
      throw new AppError(502, "PROVIDER_UPSTREAM_ERROR", "Duffel booking creation returned no ID.");
    }

    return {
      providerBookingId: id,
      bookingReference: resp.data?.booking_reference ?? resp.data?.reference ?? id,
      status: resp.data?.status === "confirmed" ? "confirmed" : "pending",
      isSandbox: this.isTestToken,
      isExternalHandoff: false,
    };
  }

  public async getBooking(
    providerBookingId: string
  ): Promise<ProviderBookingStatusResult | null> {
    this.assertConfigured();
    const resp = await requestUpstreamJson<{
      data?: { id?: string; booking_reference?: string; status?: string; cancelled_at?: string };
    }>({
      providerName: "Duffel Stays",
      url: `${this.opts.baseUrl}/stays/bookings/${encodeURIComponent(providerBookingId)}`,
      headers: this.authHeaders,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    if (!resp?.data?.id) return null;
    const status: BookingStatus =
      resp.data.status === "cancelled"
        ? "cancelled"
        : resp.data.status === "confirmed"
        ? "confirmed"
        : "pending";
    return {
      providerBookingId: resp.data.id,
      bookingReference: resp.data.booking_reference,
      status,
      cancelledAt: resp.data.cancelled_at,
    };
  }

  public async cancelBooking(
    providerBookingId: string
  ): Promise<ProviderCancellationResult> {
    this.assertConfigured();
    await requestUpstreamJson({
      providerName: "Duffel Stays",
      url: `${this.opts.baseUrl}/stays/bookings/${encodeURIComponent(
        providerBookingId
      )}/actions/cancel`,
      method: "POST",
      headers: this.authHeaders,
      idempotentRetry: false,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    return {
      providerBookingId,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      refundSummary: "Cancelled via Duffel Stays API v2.",
    };
  }

  private mapDuffelAccommodation(
    resultId: string,
    acc: z.infer<typeof DuffelAccommodationSchema>,
    currency: CurrencyCode,
    lowestNightly?: number
  ): Hotel {
    return {
      id: resultId,
      providerId: "duffel",
      name: acc.name,
      starRating: Math.min(5, Math.max(1, Math.round(acc.rating ?? 4))),
      reviewScore: acc.review_score ? Math.min(5, Number((acc.review_score > 5 ? acc.review_score / 2 : acc.review_score).toFixed(1))) : 4.5,
      reviewCount: acc.review_count ?? 0,
      propertyType: "hotel",
      summary: (acc.description ?? acc.name).slice(0, 140),
      description: acc.description ?? `Book ${acc.name} via Duffel Stays.`,
      location: {
        address: acc.location?.address?.line_one ?? "",
        city: acc.location?.address?.city_name ?? "",
        country: acc.location?.address?.country_code ?? "",
        countryCode: acc.location?.address?.country_code ?? "US",
        postalCode: acc.location?.address?.postal_code,
        latitude: acc.location?.geographic_coordinates?.latitude ?? 0,
        longitude: acc.location?.geographic_coordinates?.longitude ?? 0,
      },
      images: (acc.photos ?? []).map((p, idx) => ({
        id: `${resultId}-photo-${idx}`,
        url: p.url,
        isHero: idx === 0,
      })),
      amenities: (acc.amenities ?? []).slice(0, 8).map((a, idx) => ({
        code: a.type ?? `amenity_${idx}`,
        label: a.description,
        category: "service",
      })),
      policies: {
        checkInFrom: "15:00",
        checkOutUntil: "11:00",
        cancellationSummary: "See rate plan timeline for exact refund deadline.",
        childrenPolicy: "Subject to property occupancy limits.",
        petsAllowed: false,
      },
      lowestNightlyPrice:
        lowestNightly !== undefined ? { amount: lowestNightly, currency } : undefined,
      isFreeCancellationAvailable: true,
      isInstantConfirmation: true,
      reviews: [],
    };
  }
}

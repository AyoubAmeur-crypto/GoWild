import { z } from "zod";
import { AppError, ProviderNotConfiguredError } from "../errors.ts";
import { requestUpstreamJson, type FetchLike } from "../httpClient.ts";
import { calculateNights, filterAndSortHotels, roundMoney } from "../../../src/lib/pricing.ts";
import type {
  Amenity,
  BoardType,
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
  RefundableTag,
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

const LiteApiPlaceSchema = z.object({
  placeId: z.string(),
  displayName: z.string(),
  formattedAddress: z.string().optional(),
});

const LiteApiHotelSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  stars: z.number().optional(),
  starRating: z.number().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
  main_photo: z.string().optional(),
  hotelDescription: z.string().optional(),
  hotelFacilities: z.array(z.string()).optional(),
  hotelImages: z
    .array(
      z.object({
        url: z.string(),
        caption: z.string().optional(),
        defaultImage: z.boolean().optional(),
      })
    )
    .optional(),
  checkinCheckoutTimes: z
    .object({
      checkin: z.string().optional(),
      checkout: z.string().optional(),
    })
    .optional(),
});

const LiteApiMoneyItemSchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

const LiteApiTaxSchema = z.object({
  included: z.boolean().optional(),
  description: z.string().optional(),
  amount: z.number(),
  currency: z.string().optional(),
});

const LiteApiRateSchema = z.object({
  rateId: z.string().optional(),
  name: z.string().optional(),
  maxOccupancy: z.number().optional(),
  adultCount: z.number().optional(),
  childCount: z.number().optional(),
  boardType: z.string().optional(),
  boardName: z.string().optional(),
  retailRate: z.object({
    total: z.array(LiteApiMoneyItemSchema).min(1),
    suggestedSellingPrice: z.array(LiteApiMoneyItemSchema).optional(),
    taxesAndFees: z.array(LiteApiTaxSchema).nullable().optional(),
  }),
  cancellationPolicies: z
    .object({
      refundableTag: z.string().optional(),
      cancelPolicyInfos: z
        .array(
          z.object({
            cancelTime: z.string().optional(),
            amount: z.number().optional(),
            currency: z.string().optional(),
          })
        )
        .nullable()
        .optional(),
    })
    .optional(),
});

const LiteApiRoomTypeSchema = z.object({
  offerId: z.string(),
  supplier: z.string().optional(),
  rates: z.array(LiteApiRateSchema).min(1),
});

const LiteApiHotelRatesItemSchema = z.object({
  hotelId: z.string(),
  roomTypes: z.array(LiteApiRoomTypeSchema).default([]),
});

export interface LiteApiProviderOptions {
  apiKey: string;
  dataBaseUrl: string;
  bookBaseUrl: string;
  checkoutReturnUrl: string;
  timeoutMs?: number;
  fetchFn?: FetchLike;
}

export class LiteApiProvider implements HotelProvider {
  private readonly opts: LiteApiProviderOptions;

  constructor(opts: LiteApiProviderOptions) {
    this.opts = opts;
  }

  private get isConfigured(): boolean {
    return this.opts.apiKey.trim().length > 0;
  }

  private get isSandboxKey(): boolean {
    return this.opts.apiKey.trim().startsWith("sand_");
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new ProviderNotConfiguredError("LiteAPI v3.0", "LITEAPI_KEY");
    }
  }

  private get authHeaders(): Record<string, string> {
    return {
      "X-API-Key": this.opts.apiKey.trim(),
    };
  }

  public getCapabilities(): ProviderCapabilities {
    const configured = this.isConfigured;
    const isSandbox = this.isSandboxKey;
    return {
      providerId: "liteapi",
      displayName: isSandbox ? "LiteAPI v3.0 (Sandbox)" : "LiteAPI v3.0",
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
        ? isSandbox
          ? "Connected to LiteAPI v3.0 Sandbox (live test rates & sandbox booking)."
          : "Connected to LiteAPI v3.0 Production (Payment SDK checkout required)."
        : "LITEAPI_KEY is missing in server environment.",
    };
  }

  public async autocompletePlaces(
    query: string,
    language: LanguageCode = "en"
  ): Promise<PlaceSuggestion[]> {
    this.assertConfigured();
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const url = `${this.opts.dataBaseUrl}/data/places?textQuery=${encodeURIComponent(
      trimmed
    )}&language=${encodeURIComponent(language)}`;

    const raw = await requestUpstreamJson<{ data?: unknown[] }>({
      providerName: "LiteAPI",
      url,
      headers: this.authHeaders,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const items = Array.isArray(raw?.data) ? raw.data : [];
    const results: PlaceSuggestion[] = [];
    for (const item of items.slice(0, 8)) {
      const parsed = LiteApiPlaceSchema.safeParse(item);
      if (!parsed.success) continue;
      const parts = (parsed.data.formattedAddress ?? parsed.data.displayName)
        .split(",")
        .map((s) => s.trim());
      const country = parts[parts.length - 1] ?? "";
      results.push({
        placeId: parsed.data.placeId,
        title: parsed.data.displayName,
        subtitle: parsed.data.formattedAddress ?? parsed.data.displayName,
        cityName: parsed.data.displayName,
        country,
        countryCode: country.length === 2 ? country.toUpperCase() : "US",
        latitude: 0,
        longitude: 0,
        type: "city",
      });
    }
    return results;
  }

  public async searchHotels(query: HotelSearchQuery): Promise<HotelSearchResponse> {
    this.assertConfigured();

    const params = new URLSearchParams();
    if (query.placeId) {
      params.set("placeId", query.placeId);
    } else if (query.cityName || query.destination) {
      params.set("cityName", (query.cityName ?? query.destination ?? "Paris").trim());
      if (query.countryCode) params.set("countryCode", query.countryCode);
    } else if (query.latitude !== undefined && query.longitude !== undefined) {
      params.set("latitude", String(query.latitude));
      params.set("longitude", String(query.longitude));
      params.set("radius", String((query.radiusKm ?? 15) * 1000));
    } else {
      params.set("cityName", "Paris");
      params.set("countryCode", "FR");
    }
    params.set("limit", "25");

    const listResp = await requestUpstreamJson<{ data?: unknown[] }>({
      providerName: "LiteAPI",
      url: `${this.opts.dataBaseUrl}/data/hotels?${params.toString()}`,
      headers: this.authHeaders,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const rawHotels = Array.isArray(listResp?.data) ? listResp.data : [];
    const parsedHotels = rawHotels
      .map((item) => LiteApiHotelSummarySchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => r.data);

    if (parsedHotels.length === 0) {
      return {
        hotels: [],
        total: 0,
        capabilities: this.getCapabilities(),
        appliedQuery: query,
      };
    }

    const hotelIds = parsedHotels.slice(0, 20).map((h) => h.id);
    const ratesResp = await requestUpstreamJson<{ data?: unknown[] }>({
      providerName: "LiteAPI",
      url: `${this.opts.dataBaseUrl}/hotels/rates`,
      method: "POST",
      headers: this.authHeaders,
      body: {
        hotelIds,
        checkin: query.checkIn,
        checkout: query.checkOut,
        currency: query.currency,
        guestNationality: query.countryCode ?? "US",
        occupancies: this.mapOccupancies(query.occupancy),
      },
      idempotentRetry: true,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const nights = calculateNights(query.checkIn, query.checkOut);
    const rateMap = new Map<
      string,
      { nightly: number; compareNightly?: number; refundable: boolean }
    >();

    for (const rawRateItem of Array.isArray(ratesResp?.data) ? ratesResp.data : []) {
      const parsedRate = LiteApiHotelRatesItemSchema.safeParse(rawRateItem);
      if (!parsedRate.success) continue;
      let lowestTotal = Number.POSITIVE_INFINITY;
      let compareTotal: number | undefined;
      let anyRefundable = false;

      for (const rt of parsedRate.data.roomTypes) {
        for (const rate of rt.rates) {
          const total = rate.retailRate.total[0]?.amount;
          if (typeof total === "number" && total < lowestTotal) {
            lowestTotal = total;
            compareTotal = rate.retailRate.suggestedSellingPrice?.[0]?.amount;
          }
          if (rate.cancellationPolicies?.refundableTag === "RFN") {
            anyRefundable = true;
          }
        }
      }

      if (Number.isFinite(lowestTotal)) {
        rateMap.set(parsedRate.data.hotelId, {
          nightly: roundMoney(lowestTotal / nights, query.currency),
          compareNightly:
            compareTotal && compareTotal > lowestTotal
              ? roundMoney(compareTotal / nights, query.currency)
              : undefined,
          refundable: anyRefundable,
        });
      }
    }

    const mappedHotels: Hotel[] = parsedHotels.map((h) => {
      const rateSummary = rateMap.get(h.id);
      return this.mapLiteHotelToDomain(h, query.currency, rateSummary);
    });

    const finalHotels = filterAndSortHotels(mappedHotels, query);
    return {
      hotels: finalHotels,
      total: finalHotels.length,
      capabilities: this.getCapabilities(),
      appliedQuery: query,
    };
  }

  public async getHotelDetails(
    id: string,
    currency: CurrencyCode = "USD",
    language: LanguageCode = "en"
  ): Promise<Hotel | null> {
    this.assertConfigured();
    const resp = await requestUpstreamJson<{ data?: unknown }>({
      providerName: "LiteAPI",
      url: `${this.opts.dataBaseUrl}/data/hotel?hotelId=${encodeURIComponent(
        id
      )}&language=${encodeURIComponent(language)}`,
      headers: this.authHeaders,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const parsed = LiteApiHotelSummarySchema.safeParse(resp?.data);
    if (!parsed.success) return null;
    return this.mapLiteHotelToDomain(parsed.data, currency);
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
    const offers = await this.getRoomOffers(
      hotelId,
      checkIn,
      checkOut,
      occupancy,
      currency
    );
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
    const resp = await requestUpstreamJson<{ data?: unknown[] }>({
      providerName: "LiteAPI",
      url: `${this.opts.dataBaseUrl}/hotels/rates`,
      method: "POST",
      headers: this.authHeaders,
      body: {
        hotelIds: [hotelId],
        checkin: checkIn,
        checkout: checkOut,
        currency,
        guestNationality: "US",
        occupancies: this.mapOccupancies(occupancy),
      },
      idempotentRetry: true,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const nights = calculateNights(checkIn, checkOut);
    const items = Array.isArray(resp?.data) ? resp.data : [];
    const offers: RoomOffer[] = [];

    for (const rawItem of items) {
      const parsed = LiteApiHotelRatesItemSchema.safeParse(rawItem);
      if (!parsed.success) continue;

      for (const rt of parsed.data.roomTypes) {
        const primaryRate = rt.rates[0];
        if (!primaryRate) continue;
        offers.push(
          this.mapLiteRoomOffer(
            hotelId,
            rt.offerId,
            rt.supplier ?? "LiteAPI Network",
            primaryRate,
            nights,
            occupancy.rooms,
            currency
          )
        );
      }
    }
    return offers;
  }

  public async revalidateOffer(
    offerId: string,
    context: OfferLookupContext
  ): Promise<RevalidatedOffer> {
    this.assertConfigured();
    const usePaymentSdk = !this.isSandboxKey;

    const resp = await requestUpstreamJson<{
      data?: {
        prebookId?: string;
        offerId?: string;
        hotelId?: string;
        priceDifferencePercent?: number;
        roomTypes?: unknown[];
      };
    }>({
      providerName: "LiteAPI",
      url: `${this.opts.bookBaseUrl}/rates/prebook`,
      method: "POST",
      headers: this.authHeaders,
      body: {
        offerId,
        usePaymentSdk,
      },
      idempotentRetry: false,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const prebookId = resp?.data?.prebookId;
    if (!prebookId) {
      throw new AppError(
        409,
        "OFFER_SOLD_OUT",
        "Selected room offer is no longer available from the supplier."
      );
    }

    const nights = calculateNights(context.checkIn, context.checkOut);
    let mappedOffer: RoomOffer | undefined;

    const roomTypes = Array.isArray(resp?.data?.roomTypes) ? resp.data.roomTypes : [];
    if (roomTypes.length > 0) {
      const parsedRt = LiteApiRoomTypeSchema.safeParse(roomTypes[0]);
      if (parsedRt.success && parsedRt.data.rates[0]) {
        mappedOffer = this.mapLiteRoomOffer(
          context.hotelId,
          offerId,
          parsedRt.data.supplier ?? "LiteAPI Network",
          parsedRt.data.rates[0],
          nights,
          context.occupancy.rooms,
          context.currency
        );
      }
    }

    if (!mappedOffer) {
      const freshOffers = await this.getRoomOffers(
        context.hotelId,
        context.checkIn,
        context.checkOut,
        context.occupancy,
        context.currency
      );
      mappedOffer = freshOffers.find((o) => o.offerId === offerId) ?? freshOffers[0];
    }

    if (!mappedOffer) {
      throw new AppError(409, "OFFER_SOLD_OUT", "Selected room offer sold out during revalidation.");
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const priceDiff = resp?.data?.priceDifferencePercent ?? 0;

    return {
      quoteId: prebookId,
      offer: { ...mappedOffer, expiresAt },
      available: true,
      priceChanged: Math.abs(priceDiff) > 0.01,
      checkoutMode: this.isSandboxKey ? "sandbox_instant" : "provider_hosted_checkout",
      hostedCheckoutUrl: usePaymentSdk
        ? `${this.opts.checkoutReturnUrl}?prebookId=${encodeURIComponent(prebookId)}`
        : undefined,
      expiresAt,
      capabilities: this.getCapabilities(),
    };
  }

  public async createBooking(
    request: CreateProviderBookingRequest
  ): Promise<ProviderBookingResult> {
    this.assertConfigured();

    if (!this.isSandboxKey) {
      // Production LiteAPI requires LiteAPI Payment SDK transaction completion; never fake confirmation
      return {
        providerBookingId: `pending_${request.quoteId}`,
        bookingReference: request.quoteId,
        status: "pending",
        isSandbox: false,
        isExternalHandoff: true,
        externalCheckoutUrl: `${this.opts.checkoutReturnUrl}?prebookId=${encodeURIComponent(
          request.quoteId
        )}`,
      };
    }

    const resp = await requestUpstreamJson<{
      data?: {
        bookingId?: string;
        hotelConfirmationCode?: string;
        status?: string;
      };
    }>({
      providerName: "LiteAPI",
      url: `${this.opts.bookBaseUrl}/rates/book`,
      method: "POST",
      headers: this.authHeaders,
      body: {
        prebookId: request.quoteId,
        clientReference: request.idempotencyKey,
        holder: {
          firstName: request.leadGuest.firstName,
          lastName: request.leadGuest.lastName,
          email: request.leadGuest.email,
          phone: request.leadGuest.phone,
        },
        guests: [
          {
            occupancyNumber: 1,
            firstName: request.leadGuest.firstName,
            lastName: request.leadGuest.lastName,
            email: request.leadGuest.email,
            remarks: request.specialRequests ?? "",
          },
        ],
        payment: {
          method: "ACC_CREDIT_CARD",
        },
      },
      idempotentRetry: false,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const bookingId = resp?.data?.bookingId;
    const rawStatus = (resp?.data?.status ?? "").toUpperCase();
    if (!bookingId) {
      throw new AppError(
        502,
        "PROVIDER_UPSTREAM_ERROR",
        "LiteAPI did not return a verified bookingId."
      );
    }

    const status: BookingStatus =
      rawStatus === "CONFIRMED"
        ? "confirmed"
        : rawStatus === "FAILED"
        ? "failed"
        : "pending";

    return {
      providerBookingId: bookingId,
      bookingReference: resp?.data?.hotelConfirmationCode ?? bookingId,
      status,
      isSandbox: true,
      isExternalHandoff: false,
    };
  }

  public async getBooking(
    providerBookingId: string
  ): Promise<ProviderBookingStatusResult | null> {
    this.assertConfigured();
    const resp = await requestUpstreamJson<{
      data?: {
        bookingId?: string;
        hotelConfirmationCode?: string;
        status?: string;
      };
    }>({
      providerName: "LiteAPI",
      url: `${this.opts.bookBaseUrl}/bookings/${encodeURIComponent(providerBookingId)}`,
      headers: this.authHeaders,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    if (!resp?.data?.bookingId) return null;
    const raw = (resp.data.status ?? "").toUpperCase();
    const status: BookingStatus =
      raw === "CONFIRMED"
        ? "confirmed"
        : raw.startsWith("CANCELLED")
        ? "cancelled"
        : raw === "COMPLETED"
        ? "completed"
        : "pending";

    return {
      providerBookingId: resp.data.bookingId,
      bookingReference: resp.data.hotelConfirmationCode,
      status,
    };
  }

  public async cancelBooking(
    providerBookingId: string
  ): Promise<ProviderCancellationResult> {
    this.assertConfigured();
    const resp = await requestUpstreamJson<{
      data?: {
        bookingId?: string;
        status?: string;
        cancellationFee?: number;
      };
    }>({
      providerName: "LiteAPI",
      url: `${this.opts.bookBaseUrl}/bookings/${encodeURIComponent(providerBookingId)}`,
      method: "PUT",
      headers: this.authHeaders,
      idempotentRetry: false,
      timeoutMs: this.opts.timeoutMs,
      fetchFn: this.opts.fetchFn,
    });

    const cancelledAt = new Date().toISOString();
    const fee = resp?.data?.cancellationFee;
    return {
      providerBookingId,
      status: "cancelled",
      cancelledAt,
      refundSummary:
        typeof fee === "number" && fee > 0
          ? `Cancelled via LiteAPI (supplier cancellation fee: ${fee}).`
          : "Cancelled via LiteAPI within refundable window.",
    };
  }

  private mapOccupancies(occupancy: Occupancy): { adults: number; children: number[] }[] {
    const rooms = Math.max(1, occupancy.rooms);
    const baseAdults = Math.max(1, Math.floor(occupancy.adults / rooms));
    const list: { adults: number; children: number[] }[] = [];
    for (let i = 0; i < rooms; i++) {
      list.push({
        adults: i === 0 ? occupancy.adults - baseAdults * (rooms - 1) : baseAdults,
        children: i === 0 ? occupancy.childrenAges : [],
      });
    }
    return list;
  }

  private mapLiteHotelToDomain(
    raw: z.infer<typeof LiteApiHotelSummarySchema>,
    currency: CurrencyCode,
    rateSummary?: { nightly: number; compareNightly?: number; refundable: boolean }
  ): Hotel {
    const lat = raw.location?.latitude ?? raw.latitude ?? 0;
    const lng = raw.location?.longitude ?? raw.longitude ?? 0;
    const images: HotelImage[] =
      raw.hotelImages && raw.hotelImages.length > 0
        ? raw.hotelImages.slice(0, 10).map((img, idx) => ({
            id: `${raw.id}-img-${idx}`,
            url: img.url,
            caption: img.caption,
            isHero: idx === 0 || img.defaultImage,
          }))
        : raw.main_photo
        ? [{ id: `${raw.id}-hero`, url: raw.main_photo, isHero: true }]
        : [];

    const amenities: Amenity[] = (raw.hotelFacilities ?? []).slice(0, 10).map((f) => ({
      code: f.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      label: f,
      category: /wifi|internet/i.test(f)
        ? "connectivity"
        : /pool|spa|sauna|gym|fitness/i.test(f)
        ? "wellness"
        : /breakfast|restaurant|bar|dining/i.test(f)
        ? "dining"
        : "service",
    }));

    const cleanDesc = (raw.hotelDescription ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      id: raw.id,
      providerId: "liteapi",
      name: raw.name,
      starRating: Math.min(5, Math.max(1, Math.round(raw.starRating ?? raw.stars ?? 4))),
      reviewScore: raw.rating && raw.rating > 0 ? Math.min(5, Number((raw.rating > 5 ? raw.rating / 2 : raw.rating).toFixed(1))) : 4.5,
      reviewCount: raw.reviewCount ?? 0,
      propertyType: "hotel",
      summary: cleanDesc.slice(0, 140) || `${raw.name} in ${raw.city ?? "city center"}`,
      description: cleanDesc || `Discover verified rates and rooms at ${raw.name}.`,
      location: {
        address: raw.address ?? raw.city ?? "",
        city: raw.city ?? "",
        country: raw.country ?? "",
        countryCode: (raw.country ?? "US").slice(0, 2).toUpperCase(),
        latitude: lat,
        longitude: lng,
      },
      images,
      amenities,
      policies: {
        checkInFrom: raw.checkinCheckoutTimes?.checkin ?? "15:00",
        checkOutUntil: raw.checkinCheckoutTimes?.checkout ?? "11:00",
        cancellationSummary: "Refer to individual room rate plan for exact refund deadlines.",
        childrenPolicy: "Occupancy pricing adapts to declared child ages.",
        petsAllowed: false,
      },
      lowestNightlyPrice: rateSummary
        ? { amount: rateSummary.nightly, currency }
        : undefined,
      compareAtNightlyPrice: rateSummary?.compareNightly
        ? { amount: rateSummary.compareNightly, currency }
        : undefined,
      isFreeCancellationAvailable: rateSummary?.refundable ?? false,
      isInstantConfirmation: true,
      reviews: [],
    };
  }

  private mapLiteRoomOffer(
    hotelId: string,
    offerId: string,
    supplierName: string,
    rate: z.infer<typeof LiteApiRateSchema>,
    nights: number,
    rooms: number,
    currency: CurrencyCode
  ): RoomOffer {
    const total = roundMoney(rate.retailRate.total[0].amount, currency);
    const taxesList = rate.retailRate.taxesAndFees ?? [];
    const taxesTotal = roundMoney(
      taxesList.reduce((acc, t) => acc + t.amount, 0),
      currency
    );
    const baseSubtotal = roundMoney(Math.max(0, total - taxesTotal), currency);
    const perNightBase = roundMoney(baseSubtotal / Math.max(1, nights * rooms), currency);
    const compareTotal = rate.retailRate.suggestedSellingPrice?.[0]?.amount;

    const rawBoard = (rate.boardType ?? rate.boardName ?? "RO").toUpperCase();
    const boardType: BoardType = rawBoard.includes("BB") || rawBoard.includes("BREAKFAST")
      ? "breakfast_included"
      : rawBoard.includes("HB")
      ? "half_board"
      : rawBoard.includes("AI")
      ? "all_inclusive"
      : "room_only";

    const rfTag = (rate.cancellationPolicies?.refundableTag ?? "NRFN").toUpperCase();
    const refundableTag: RefundableTag =
      rfTag === "RFN" ? "refundable" : rfTag === "PRFN" ? "partial" : "non_refundable";
    const deadline = rate.cancellationPolicies?.cancelPolicyInfos?.[0]?.cancelTime;

    return {
      offerId,
      hotelId,
      providerId: "liteapi",
      supplierName,
      roomName: rate.name ?? "Standard Guest Room",
      description: `${rate.boardName ?? "Standard rate"} provided via ${supplierName}.`,
      maxAdults: rate.adultCount ?? rate.maxOccupancy ?? 2,
      maxChildren: rate.childCount ?? 1,
      bedSummary: "Standard Bedding",
      images: [],
      amenities: [],
      ratePlan: {
        rateId: rate.rateId ?? offerId,
        boardType,
        boardLabel:
          rate.boardName ??
          (boardType === "breakfast_included" ? "Breakfast Included" : "Room Only"),
        paymentType: this.isSandboxKey ? "pay_now" : "provider_checkout",
        isInstantConfirmation: true,
      },
      price: {
        currency,
        nights,
        rooms,
        perNightBase,
        baseSubtotal,
        taxesAndFees: taxesTotal,
        propertyFees: 0,
        total,
        strikethroughTotal:
          compareTotal && compareTotal > total
            ? roundMoney(compareTotal, currency)
            : undefined,
        items: [
          {
            label: `${nights} ${nights === 1 ? "night" : "nights"} × ${rooms} ${
              rooms === 1 ? "room" : "rooms"
            }`,
            amount: baseSubtotal,
            included: true,
          },
          {
            label: "Taxes & supplier fees",
            amount: taxesTotal,
            included: true,
          },
        ],
      },
      cancellationPolicy: {
        refundableTag,
        freeCancellationUntil: deadline,
        summary:
          refundableTag === "refundable"
            ? deadline
              ? `Free cancellation before ${deadline}.`
              : "Free cancellation eligible under supplier terms."
            : "Non-refundable rate plan.",
      },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }
}

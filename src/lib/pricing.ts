import type {
  CurrencyCode,
  Hotel,
  HotelSearchQuery,
  Occupancy,
  PriceBreakdown,
} from "../types/domain.ts";

export const CURRENCY_META: Record<
  CurrencyCode,
  { symbol: string; rateFromUsd: number; decimals: number; label: string }
> = {
  USD: { symbol: "$", rateFromUsd: 1, decimals: 2, label: "US Dollar ($)" },
  EUR: { symbol: "€", rateFromUsd: 0.92, decimals: 2, label: "Euro (€)" },
  GBP: { symbol: "£", rateFromUsd: 0.79, decimals: 2, label: "British Pound (£)" },
  MAD: { symbol: "MAD ", rateFromUsd: 9.85, decimals: 0, label: "Moroccan Dirham (MAD)" },
  JPY: { symbol: "¥", rateFromUsd: 152.4, decimals: 0, label: "Japanese Yen (¥)" },
};

export function convertFromUsd(amountUsd: number, currency: CurrencyCode): number {
  const meta = CURRENCY_META[currency];
  const raw = amountUsd * meta.rateFromUsd;
  return meta.decimals === 0 ? Math.round(raw) : Math.round(raw * 100) / 100;
}

export function roundMoney(amount: number, currency: CurrencyCode): number {
  const decimals = CURRENCY_META[currency].decimals;
  return decimals === 0 ? Math.round(amount) : Math.round(amount * 100) / 100;
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  options?: { compact?: boolean }
): string {
  const meta = CURRENCY_META[currency];
  const decimals = options?.compact ? 0 : meta.decimals;
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${meta.symbol}${formatted}`;
}

export function getDefaultDates(now: Date = new Date()): {
  checkIn: string;
  checkOut: string;
} {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() + 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 3);
  return {
    checkIn: start.toISOString().slice(0, 10),
    checkOut: end.toISOString().slice(0, 10),
  };
}

export function calculateNights(checkIn: string, checkOut: string): number {
  const inTime = Date.parse(`${checkIn}T00:00:00Z`);
  const outTime = Date.parse(`${checkOut}T00:00:00Z`);
  if (Number.isNaN(inTime) || Number.isNaN(outTime) || outTime <= inTime) {
    return 1;
  }
  return Math.max(1, Math.round((outTime - inTime) / (1000 * 60 * 60 * 24)));
}

export function formatDateRangeShort(checkIn: string, checkOut: string): string {
  const inDate = new Date(`${checkIn}T12:00:00Z`);
  const outDate = new Date(`${checkOut}T12:00:00Z`);
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) {
    return `${checkIn} - ${checkOut}`;
  }
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(inDate)} – ${fmt(outDate)}`;
}

export function formatFullDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function computePriceBreakdown(params: {
  perNightUsd: number;
  checkIn: string;
  checkOut: string;
  occupancy: Occupancy;
  currency: CurrencyCode;
  taxRate?: number;
  propertyFeePerNightUsd?: number;
  discountRatio?: number;
}): PriceBreakdown {
  const nights = calculateNights(params.checkIn, params.checkOut);
  const rooms = Math.max(1, params.occupancy.rooms);
  const extraAdultMultiplier =
    params.occupancy.adults > rooms * 2
      ? 1 + (params.occupancy.adults - rooms * 2) * 0.12
      : 1;
  const childMultiplier =
    params.occupancy.childrenAges.length > 0
      ? 1 + params.occupancy.childrenAges.length * 0.05
      : 1;

  const adjustedPerNightUsd =
    params.perNightUsd * extraAdultMultiplier * childMultiplier;
  const perNightBase = convertFromUsd(adjustedPerNightUsd, params.currency);
  const baseSubtotal = roundMoney(perNightBase * nights * rooms, params.currency);

  const taxRate = params.taxRate ?? 0.125;
  const taxesAndFees = roundMoney(baseSubtotal * taxRate, params.currency);

  const propFeeUsd = (params.propertyFeePerNightUsd ?? 18) * nights * rooms;
  const propertyFees = convertFromUsd(propFeeUsd, params.currency);

  const total = roundMoney(
    baseSubtotal + taxesAndFees + propertyFees,
    params.currency
  );

  const strikethroughTotal =
    params.discountRatio && params.discountRatio > 0
      ? roundMoney(total / (1 - params.discountRatio), params.currency)
      : undefined;

  return {
    currency: params.currency,
    nights,
    rooms,
    perNightBase,
    baseSubtotal,
    taxesAndFees,
    propertyFees,
    total,
    strikethroughTotal,
    items: [
      {
        label: `${nights} ${nights === 1 ? "night" : "nights"} × ${rooms} ${
          rooms === 1 ? "room" : "rooms"
        }`,
        amount: baseSubtotal,
        included: true,
      },
      {
        label: "Municipal & occupancy taxes",
        amount: taxesAndFees,
        included: true,
      },
      {
        label: "Property & service fee",
        amount: propertyFees,
        included: true,
      },
    ],
  };
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export function filterAndSortHotels(
  hotels: Hotel[],
  query: HotelSearchQuery
): Hotel[] {
  const qText = (query.destination ?? query.cityName ?? "").trim().toLowerCase();

  const filtered = hotels.filter((hotel) => {
    if (qText.length > 0 && query.latitude === undefined) {
      const hay = `${hotel.name} ${hotel.location.city} ${hotel.location.country} ${hotel.location.address}`.toLowerCase();
      if (!hay.includes(qText)) {
        return false;
      }
    }

    if (
      query.latitude !== undefined &&
      query.longitude !== undefined &&
      query.radiusKm !== undefined
    ) {
      const dist = haversineDistanceKm(
        query.latitude,
        query.longitude,
        hotel.location.latitude,
        hotel.location.longitude
      );
      if (dist > query.radiusKm) return false;
    }

    const nightly = hotel.lowestNightlyPrice?.amount;
    if (query.minPrice !== undefined && nightly !== undefined && nightly < query.minPrice) {
      return false;
    }
    if (query.maxPrice !== undefined && nightly !== undefined && nightly > query.maxPrice) {
      return false;
    }

    if (query.minStarRating !== undefined && hotel.starRating < query.minStarRating) {
      return false;
    }

    if (
      query.propertyTypes &&
      query.propertyTypes.length > 0 &&
      !query.propertyTypes.includes(hotel.propertyType)
    ) {
      return false;
    }

    if (query.freeCancellationOnly && !hotel.isFreeCancellationAvailable) {
      return false;
    }

    if (query.instantConfirmationOnly && !hotel.isInstantConfirmation) {
      return false;
    }

    if (query.amenities && query.amenities.length > 0) {
      const hotelCodes = new Set(hotel.amenities.map((a) => a.code));
      for (const reqCode of query.amenities) {
        if (!hotelCodes.has(reqCode)) return false;
      }
    }

    return true;
  });

  const sorted = [...filtered];
  const sortBy = query.sortBy ?? "recommended";
  sorted.sort((a, b) => {
    const priceA = a.lowestNightlyPrice?.amount ?? Number.MAX_SAFE_INTEGER;
    const priceB = b.lowestNightlyPrice?.amount ?? Number.MAX_SAFE_INTEGER;
    switch (sortBy) {
      case "price_asc":
        return priceA - priceB;
      case "price_desc":
        return priceB - priceA;
      case "rating_desc":
        return b.reviewScore - a.reviewScore || b.reviewCount - a.reviewCount;
      case "recommended":
      default:
        return (
          Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) ||
          b.reviewScore - a.reviewScore
        );
    }
  });

  return sorted;
}


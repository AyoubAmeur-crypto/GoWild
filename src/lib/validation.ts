import { z } from "zod";

export const CurrencyCodeSchema = z.enum(["USD", "EUR", "GBP", "MAD", "JPY"]);
export const LanguageCodeSchema = z.enum(["en", "fr"]);
export const PropertyTypeSchema = z.enum([
  "hotel",
  "resort",
  "villa",
  "boutique",
  "apartment",
]);
export const HotelSortBySchema = z.enum([
  "recommended",
  "price_asc",
  "price_desc",
  "rating_desc",
]);

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const OccupancySchema = z.object({
  rooms: z.number().int().min(1).max(8),
  adults: z.number().int().min(1).max(16),
  childrenAges: z.array(z.number().int().min(0).max(17)).max(10),
});

export const HotelSearchQuerySchema = z
  .object({
    destination: z.string().trim().max(120).optional(),
    placeId: z.string().trim().max(120).optional(),
    cityName: z.string().trim().max(80).optional(),
    countryCode: z.string().trim().length(2).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    radiusKm: z.number().min(1).max(200).optional(),
    checkIn: IsoDateSchema,
    checkOut: IsoDateSchema,
    occupancy: OccupancySchema,
    currency: CurrencyCodeSchema.default("USD"),
    language: LanguageCodeSchema.optional(),
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    minStarRating: z.number().int().min(1).max(5).optional(),
    propertyTypes: z.array(PropertyTypeSchema).optional(),
    amenities: z.array(z.string().trim().min(1)).optional(),
    freeCancellationOnly: z.boolean().optional(),
    instantConfirmationOnly: z.boolean().optional(),
    sortBy: HotelSortBySchema.optional(),
  })
  .refine((val) => val.checkOut > val.checkIn, {
    message: "Check-out date must be after check-in date",
    path: ["checkOut"],
  });

export const RoomOffersRequestSchema = z
  .object({
    checkIn: IsoDateSchema,
    checkOut: IsoDateSchema,
    occupancy: OccupancySchema,
    currency: CurrencyCodeSchema.default("USD"),
  })
  .refine((val) => val.checkOut > val.checkIn, {
    message: "Check-out date must be after check-in date",
    path: ["checkOut"],
  });

export const RevalidateOfferInputSchema = z.object({
  offerId: z.string().min(2),
  hotelId: z.string().min(1),
  checkIn: IsoDateSchema,
  checkOut: IsoDateSchema,
  occupancy: OccupancySchema,
  currency: CurrencyCodeSchema.default("USD"),
});

export const TravelerInputSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "First name must be at least 2 characters")
    .max(60),
  lastName: z
    .string()
    .trim()
    .min(2, "Last name must be at least 2 characters")
    .max(60),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,20}$/, "Enter a valid phone number (e.g. +1 415 555 0192)"),
  nationality: z.string().trim().length(2).optional(),
});

export const CreateBookingInputSchema = z.object({
  quoteId: z.string().min(2, "Valid revalidated quote ID is required"),
  offerId: z.string().min(2),
  hotelId: z.string().min(1),
  checkIn: IsoDateSchema,
  checkOut: IsoDateSchema,
  occupancy: OccupancySchema,
  currency: CurrencyCodeSchema,
  leadGuest: TravelerInputSchema,
  specialRequests: z.string().trim().max(500).optional(),
  acceptedPolicies: z.literal(true, {
    error: "Please review and accept the cancellation & property policies",
  }),
});

export const AuthRegisterSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required").max(60),
  lastName: z.string().trim().min(2, "Last name is required").max(60),
  email: z.string().trim().email("Valid email address is required"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,20}$/, "Valid international phone is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  preferredCurrency: CurrencyCodeSchema.default("USD"),
  preferredLanguage: LanguageCodeSchema.default("en"),
});

export const AuthLoginSchema = z.object({
  email: z.string().trim().email("Valid email address is required"),
  password: z.string().min(1, "Password is required").max(128),
});

export const ProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(2).max(60).optional(),
  lastName: z.string().trim().min(2).max(60).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s()-]{7,20}$/)
    .optional(),
  nationality: z.string().trim().length(2).optional(),
  preferredCurrency: CurrencyCodeSchema.optional(),
  preferredLanguage: LanguageCodeSchema.optional(),
});

export type CreateBookingInput = z.infer<typeof CreateBookingInputSchema>;
export type TravelerInput = z.infer<typeof TravelerInputSchema>;
export type AuthRegisterInput = z.infer<typeof AuthRegisterSchema>;
export type AuthLoginInput = z.infer<typeof AuthLoginSchema>;


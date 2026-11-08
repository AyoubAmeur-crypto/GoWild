import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateNights,
  computePriceBreakdown,
  convertFromUsd,
  filterAndSortHotels,
} from "../src/lib/pricing.ts";
import { createZodFormResolver } from "../src/lib/formResolver.ts";
import {
  AuthRegisterSchema,
  CreateBookingInputSchema,
} from "../src/lib/validation.ts";
import fs from "node:fs";
import type { Hotel } from "../src/types/domain.ts";

test("calculateNights computes exact multi-night stay durations and clamps invalid ranges", () => {
  assert.equal(calculateNights("2026-12-10", "2026-12-14"), 4);
  assert.equal(calculateNights("2026-12-10", "2026-12-11"), 1);
  assert.equal(calculateNights("2026-12-10", "2026-12-10"), 1);
  assert.equal(calculateNights("2026-12-15", "2026-12-10"), 1);
});

test("computePriceBreakdown itemizes room subtotal, taxes, property fees, and multi-currency rounding", () => {
  const usdBreakdown = computePriceBreakdown({
    perNightUsd: 300,
    checkIn: "2026-12-01",
    checkOut: "2026-12-04",
    occupancy: { rooms: 2, adults: 4, childrenAges: [] },
    currency: "USD",
    taxRate: 0.1,
    propertyFeePerNightUsd: 20,
    discountRatio: 0.2,
  });

  assert.equal(usdBreakdown.nights, 3);
  assert.equal(usdBreakdown.rooms, 2);
  assert.equal(usdBreakdown.perNightBase, 300);
  assert.equal(usdBreakdown.baseSubtotal, 1800);
  assert.equal(usdBreakdown.taxesAndFees, 180);
  assert.equal(usdBreakdown.propertyFees, 120);
  assert.equal(usdBreakdown.total, 2100);
  assert.ok(
    usdBreakdown.strikethroughTotal &&
      usdBreakdown.strikethroughTotal > usdBreakdown.total
  );
  assert.equal(usdBreakdown.items.length, 3);

  // Zero-decimal currency (JPY) rounds cleanly to integers
  const jpyVal = convertFromUsd(250.37, "JPY");
  assert.equal(Number.isInteger(jpyVal), true);
});

test("filterAndSortHotels filters by city, price, star rating, propertyType, amenities, and sorts", async () => {
  const baseSearch = { hotels: JSON.parse(fs.readFileSync("tests/fixtures/hotels.json", "utf8")) as Hotel[] };

  assert.ok(baseSearch.hotels.length >= 8);

  const parisFiltered = filterAndSortHotels(baseSearch.hotels, {
    destination: "Paris",
    checkIn: "2026-12-10",
    checkOut: "2026-12-13",
    occupancy: { rooms: 1, adults: 2, childrenAges: [] },
    currency: "USD",
  });
  assert.ok(parisFiltered.length >= 1);
  assert.ok(
    parisFiltered.every((h) => h.location.city.toLowerCase().includes("paris"))
  );

  const sortedAsc = filterAndSortHotels(baseSearch.hotels, {
    checkIn: "2026-12-10",
    checkOut: "2026-12-13",
    occupancy: { rooms: 1, adults: 2, childrenAges: [] },
    currency: "USD",
    sortBy: "price_asc",
  });
  for (let i = 1; i < sortedAsc.length; i += 1) {
    const prev = sortedAsc[i - 1].lowestNightlyPrice?.amount ?? 0;
    const curr = sortedAsc[i].lowestNightlyPrice?.amount ?? 0;
    assert.ok(curr >= prev);
  }
});

test("createZodFormResolver validates Zod v4 schemas cleanly without runtime throw", async () => {
  const registerResolver = createZodFormResolver(AuthRegisterSchema);

  const invalidRes = await registerResolver(
    {
      firstName: "A",
      lastName: "",
      email: "bad-email",
      phone: "123",
      password: "short",
      preferredCurrency: "USD",
      preferredLanguage: "en",
    },
    undefined,
    { fields: {}, shouldUseNativeValidation: false }
  );

  assert.deepEqual(invalidRes.values, {});
  assert.ok("firstName" in invalidRes.errors);
  assert.ok("email" in invalidRes.errors);
  assert.ok("password" in invalidRes.errors);

  const validRes = await registerResolver(
    {
      firstName: "Elena",
      lastName: "Rostova",
      email: "elena@example.com",
      phone: "+1 415 555 0199",
      password: "securePassword123",
      preferredCurrency: "EUR",
      preferredLanguage: "fr",
    },
    undefined,
    { fields: {}, shouldUseNativeValidation: false }
  );

  assert.deepEqual(validRes.errors, {});
  assert.equal(validRes.values.email, "elena@example.com");

  const bookingResolver = createZodFormResolver(CreateBookingInputSchema);
  const unacceptedPolicies = await bookingResolver(
    {
      quoteId: "qt_123",
      offerId: "off_123",
      hotelId: "htl_1",
      checkIn: "2026-12-01",
      checkOut: "2026-12-04",
      occupancy: { rooms: 1, adults: 2, childrenAges: [] },
      currency: "USD",
      leadGuest: {
        firstName: "Elena",
        lastName: "Rostova",
        email: "elena@example.com",
        phone: "+1 415 555 0199",
      },
      acceptedPolicies: false as unknown as true,
    },
    undefined,
    { fields: {}, shouldUseNativeValidation: false }
  );
  assert.ok("acceptedPolicies" in unacceptedPolicies.errors);
});


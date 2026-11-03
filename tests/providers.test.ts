import test from "node:test";
import assert from "node:assert/strict";
import { LiteApiProvider } from "../server/src/providers/liteApiProvider.ts";
import { DuffelStaysProvider } from "../server/src/providers/duffelStaysProvider.ts";
import { readServerConfig } from "../server/src/config.ts";
import {
  ProviderNotConfiguredError,
  ProviderUpstreamError,
} from "../server/src/errors.ts";

function jsonResponse(payload: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("LiteApiProvider fails explicitly when API key is missing (never falls back to mocks)", async () => {
  const unconfigured = new LiteApiProvider({
    apiKey: "",
    dataBaseUrl: "https://api.liteapi.travel/v3.0",
    bookBaseUrl: "https://book.liteapi.travel/v3.0",
    checkoutReturnUrl: "gowild://booking/confirmation",
  });

  assert.equal(unconfigured.getCapabilities().configured, false);

  await assert.rejects(
    () =>
      unconfigured.searchHotels({
        destination: "Paris",
        checkIn: "2026-12-10",
        checkOut: "2026-12-13",
        occupancy: { rooms: 1, adults: 2, childrenAges: [] },
        currency: "USD",
      }),
    (err: unknown) => err instanceof ProviderNotConfiguredError
  );
});

test("LiteApiProvider propagates upstream 500 error without silent mock fallback", async () => {
  const provider = new LiteApiProvider({
    apiKey: "sand_test_key_123",
    dataBaseUrl: "https://api.liteapi.travel/v3.0",
    bookBaseUrl: "https://book.liteapi.travel/v3.0",
    checkoutReturnUrl: "gowild://booking/confirmation",
    fetchFn: async () =>
      jsonResponse({ error: { message: "Gateway timeout" } }, 503),
  });

  await assert.rejects(
    () => provider.autocompletePlaces("Paris"),
    (err: unknown) => err instanceof ProviderUpstreamError
  );
});

test("LiteApiProvider maps search, room rates, prebook revalidation, sandbox booking, and cancellation", async () => {
  const provider = new LiteApiProvider({
    apiKey: "sand_live_simulation_key",
    dataBaseUrl: "https://api.liteapi.travel/v3.0",
    bookBaseUrl: "https://book.liteapi.travel/v3.0",
    checkoutReturnUrl: "gowild://booking/confirmation",
    fetchFn: async (input) => {
      const url = String(input);
      if (url.includes("/data/hotels")) {
        return jsonResponse({
          data: [
            {
              id: "lp_paris_01",
              name: "Maison Vendome",
              address: "12 Place Vendome",
              city: "Paris",
              country: "FR",
              stars: 5,
              rating: 9.4,
              reviewCount: 412,
              latitude: 48.8675,
              longitude: 2.3294,
              main_photo: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa",
              hotelFacilities: ["Free WiFi", "Spa", "Swimming Pool"],
            },
          ],
        });
      }

      if (url.includes("/hotels/rates")) {
        return jsonResponse({
          data: [
            {
              hotelId: "lp_paris_01",
              roomTypes: [
                {
                  offerId: "off_lp_991",
                  supplier: "LiteAPI Direct",
                  rates: [
                    {
                      rateId: "rt_1",
                      name: "Deluxe Courtyard King",
                      adultCount: 2,
                      childCount: 1,
                      boardType: "BB",
                      boardName: "Breakfast Included",
                      retailRate: {
                        total: [{ amount: 960, currency: "USD" }],
                        taxesAndFees: [
                          {
                            included: true,
                            description: "City tax",
                            amount: 60,
                            currency: "USD",
                          },
                        ],
                      },
                      cancellationPolicies: {
                        refundableTag: "RFN",
                        cancelPolicyInfos: [
                          {
                            cancelTime: "2026-12-08T18:00:00Z",
                            amount: 0,
                            currency: "USD",
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        });
      }

      if (url.includes("/rates/prebook")) {
        return jsonResponse({
          data: {
            prebookId: "pb_quote_777",
            offerId: "off_lp_991",
            hotelId: "lp_paris_01",
            priceDifferencePercent: 0,
          },
        });
      }

      if (url.includes("/rates/book")) {
        return jsonResponse({
          data: {
            bookingId: "lite_bk_555",
            hotelConfirmationCode: "VENDOME-555",
            status: "CONFIRMED",
          },
        });
      }

      if (url.includes("/bookings/lite_bk_555")) {
        return jsonResponse({
          data: {
            bookingId: "lite_bk_555",
            status: "CANCELLED",
          },
        });
      }

      return jsonResponse({ data: [] });
    },
  });

  const caps = provider.getCapabilities();
  assert.equal(caps.mode, "sandbox");
  assert.equal(caps.supportsDirectBooking, true);

  const searchRes = await provider.searchHotels({
    cityName: "Paris",
    countryCode: "FR",
    checkIn: "2026-12-10",
    checkOut: "2026-12-13",
    occupancy: { rooms: 1, adults: 2, childrenAges: [] },
    currency: "USD",
  });

  assert.equal(searchRes.hotels.length, 1);
  assert.equal(searchRes.hotels[0].name, "Maison Vendome");
  assert.equal(searchRes.hotels[0].lowestNightlyPrice?.amount, 320);

  const reval = await provider.revalidateOffer("off_lp_991", {
    hotelId: "lp_paris_01",
    checkIn: "2026-12-10",
    checkOut: "2026-12-13",
    occupancy: { rooms: 1, adults: 2, childrenAges: [] },
    currency: "USD",
  });
  assert.equal(reval.quoteId, "pb_quote_777");
  assert.equal(reval.offer.price.total, 960);

  const bk = await provider.createBooking({
    idempotencyKey: "idem_unit_001",
    quoteId: reval.quoteId,
    offer: reval.offer,
    checkIn: "2026-12-10",
    checkOut: "2026-12-13",
    occupancy: { rooms: 1, adults: 2, childrenAges: [] },
    leadGuest: {
      firstName: "Elena",
      lastName: "Rostova",
      email: "elena@example.com",
      phone: "+33 1 42 68 55 00",
    },
  });
  assert.equal(bk.status, "confirmed");
  assert.equal(bk.bookingReference, "VENDOME-555");
});

test("DuffelStaysProvider maps /stays/search, /stays/quotes, and /stays/bookings cleanly", async () => {
  const duffel = new DuffelStaysProvider({
    accessToken: "duffel_test_token_abc",
    baseUrl: "https://api.duffel.com",
    fetchFn: async (input) => {
      const url = String(input);
      if (url.includes("/stays/search")) {
        return jsonResponse({
          data: {
            results: [
              {
                id: "srr_01",
                cheapest_rate_total_amount: "750.00",
                cheapest_rate_currency: "USD",
                accommodation: {
                  id: "acc_tokyo_01",
                  name: "Aman Tokyo Sanctuary",
                  rating: 5,
                  review_score: 9.6,
                  review_count: 280,
                  photos: [
                    {
                      url: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb",
                    },
                  ],
                  location: {
                    geographic_coordinates: {
                      latitude: 35.6852,
                      longitude: 139.763,
                    },
                    address: {
                      line_one: "1-5-6 Otemachi",
                      city_name: "Tokyo",
                      country_code: "JP",
                    },
                  },
                },
              },
            ],
          },
        });
      }

      if (url.includes("/stays/quotes")) {
        return jsonResponse({
          data: {
            id: "quo_duf_123",
            total_amount: "750.00",
            tax_amount: "75.00",
          },
        });
      }

      if (url.includes("/stays/bookings")) {
        return jsonResponse({
          data: {
            id: "bok_duf_999",
            booking_reference: "DUF-999",
            status: "confirmed",
          },
        });
      }

      return jsonResponse({ data: {} });
    },
  });

  const res = await duffel.searchHotels({
    latitude: 35.68,
    longitude: 139.76,
    checkIn: "2026-12-01",
    checkOut: "2026-12-04",
    occupancy: { rooms: 1, adults: 2, childrenAges: [] },
    currency: "USD",
  });
  assert.equal(res.hotels.length, 1);
  assert.equal(res.hotels[0].lowestNightlyPrice?.amount, 250);

  const quote = await duffel.revalidateOffer("rat_01", {
    hotelId: "acc_tokyo_01",
    checkIn: "2026-12-01",
    checkOut: "2026-12-04",
    occupancy: { rooms: 1, adults: 2, childrenAges: [] },
    currency: "USD",
  });
  assert.equal(quote.quoteId, "quo_duf_123");

  const booked = await duffel.createBooking({
    idempotencyKey: "idem_duf_1",
    quoteId: quote.quoteId,
    offer: quote.offer,
    checkIn: "2026-12-01",
    checkOut: "2026-12-04",
    occupancy: { rooms: 1, adults: 2, childrenAges: [] },
    leadGuest: {
      firstName: "Kenji",
      lastName: "Sato",
      email: "kenji@example.com",
      phone: "+81 3 5555 0100",
    },
  });
  assert.equal(booked.status, "confirmed");
  assert.equal(booked.bookingReference, "DUF-999");
});

test("ServerConfig blocks development_fixtures in production and blocks EXPO_PUBLIC_ secret leaks", () => {
  assert.throws(
    () =>
      readServerConfig({
        nodeEnv: "production",
        provider: "development_fixtures",
      }),
    /strictly prohibited when NODE_ENV=production/
  );

  process.env.EXPO_PUBLIC_LITEAPI_KEY = "leaked_secret";
  try {
    assert.throws(
      () => readServerConfig(),
      /Security violation: privileged credential/
    );
  } finally {
    delete process.env.EXPO_PUBLIC_LITEAPI_KEY;
  }
});


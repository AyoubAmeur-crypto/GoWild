import test from "node:test";
import assert from "node:assert/strict";
import { createGoWildServer } from "../server/src/app.ts";

test("End-to-end BFF lifecycle: auth, favorites, search, offer revalidation, expired quote check, idempotency, ownership, and cancellation", async (t) => {
  const app = createGoWildServer({
    nodeEnv: "test",
    port: 0,
    sqliteDbPath: ":memory:",
    provider: "development_fixtures",
    rateLimitMaxPerMinute: 500,
  });

  t.after(async () => {
    await app.close();
  });

  // 1. Health & Capabilities
  const healthRes = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(healthRes.statusCode, 200);
  const healthBody = healthRes.json<{
    status: string;
    capabilities: { providerId: string; mode: string };
  }>();
  assert.equal(healthBody.status, "ok");
  assert.equal(healthBody.capabilities.providerId, "development_fixtures");
  assert.equal(healthBody.capabilities.mode, "development_fixture");

  // 2. Register & Authenticated Profile
  const regRes = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    body: {
      firstName: "Ayoub",
      lastName: "Traveler",
      email: "ayoub@gowild.travel",
      phone: "+1 415 555 0111",
      password: "superSecretPassword99",
      preferredCurrency: "EUR",
      preferredLanguage: "en",
    },
  });
  assert.equal(regRes.statusCode, 201);
  const regData = regRes.json<{
    token: string;
    user: { id: string; email: string; preferredCurrency: string };
  }>();
  assert.ok(regData.token.startsWith("gw_sess_"));
  assert.equal(regData.user.preferredCurrency, "EUR");

  const authHeaders = {
    Authorization: `Bearer ${regData.token}`,
    "Content-Type": "application/json",
  };

  // 3. Favorites sync
  const favAddRes = await app.inject({
    method: "POST",
    url: "/api/favorites/gw_fix_paris_lumiere",
    headers: authHeaders,
    body: {},
  });
  assert.equal(favAddRes.statusCode, 200);
  const favList = favAddRes.json<{ hotelIds: string[] }>();
  assert.deepEqual(favList.hotelIds, ["gw_fix_paris_lumiere"]);

  // 4. Search validation (rejects checkOut <= checkIn)
  const badSearch = await app.inject({
    method: "POST",
    url: "/api/hotels/search",
    body: {
      destination: "Paris",
      checkIn: "2026-12-15",
      checkOut: "2026-12-10",
      occupancy: { rooms: 1, adults: 2, childrenAges: [] },
      currency: "EUR",
    },
  });
  assert.equal(badSearch.statusCode, 400);

  // 5. Valid Hotel Search & Room Offers
  const goodSearch = await app.inject({
    method: "POST",
    url: "/api/hotels/search",
    body: {
      destination: "Paris",
      checkIn: "2026-12-10",
      checkOut: "2026-12-13",
      occupancy: { rooms: 1, adults: 2, childrenAges: [6] },
      currency: "EUR",
    },
  });
  assert.equal(goodSearch.statusCode, 200);
  const searchData = goodSearch.json<{
    hotels: { id: string; name: string }[];
  }>();
  assert.ok(searchData.hotels.length >= 1);
  const targetHotelId = searchData.hotels[0].id;

  const offersRes = await app.inject({
    method: "POST",
    url: `/api/hotels/${targetHotelId}/offers`,
    body: {
      checkIn: "2026-12-10",
      checkOut: "2026-12-13",
      occupancy: { rooms: 1, adults: 2, childrenAges: [6] },
      currency: "EUR",
    },
  });
  assert.equal(offersRes.statusCode, 200);
  const offersData = offersRes.json<{
    offers: { offerId: string; price: { total: number; currency: string } }[];
  }>();
  assert.ok(offersData.offers.length >= 2);
  const chosenOffer = offersData.offers[0];
  assert.equal(chosenOffer.price.currency, "EUR");

  // 6. Revalidate Offer
  const revalRes = await app.inject({
    method: "POST",
    url: "/api/offers/revalidate",
    headers: authHeaders,
    body: {
      offerId: chosenOffer.offerId,
      hotelId: targetHotelId,
      checkIn: "2026-12-10",
      checkOut: "2026-12-13",
      occupancy: { rooms: 1, adults: 2, childrenAges: [6] },
      currency: "EUR",
    },
  });
  assert.equal(revalRes.statusCode, 200);
  const revalData = revalRes.json<{
    revalidated: { quoteId: string; offer: { offerId: string } };
  }>();
  assert.ok(revalData.revalidated.quoteId.length > 4);

  // 7. Expired Quote Rejection
  const expiredQuoteRes = await app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: {
      ...authHeaders,
      "Idempotency-Key": "idem_expired_quote_test",
    },
    body: {
      quoteId: "non_existent_or_expired_quote",
      offerId: chosenOffer.offerId,
      hotelId: targetHotelId,
      checkIn: "2026-12-10",
      checkOut: "2026-12-13",
      occupancy: { rooms: 1, adults: 2, childrenAges: [6] },
      currency: "EUR",
      leadGuest: {
        firstName: "Ayoub",
        lastName: "Traveler",
        email: "ayoub@gowild.travel",
        phone: "+1 415 555 0111",
      },
      acceptedPolicies: true,
    },
  });
  assert.equal(expiredQuoteRes.statusCode, 409);

  // 8. Idempotent Booking Creation + Duplicate Request Deduplication
  const bookingPayload = {
    quoteId: revalData.revalidated.quoteId,
    offerId: chosenOffer.offerId,
    hotelId: targetHotelId,
    checkIn: "2026-12-10",
    checkOut: "2026-12-13",
    occupancy: { rooms: 1, adults: 2, childrenAges: [6] },
    currency: "EUR",
    leadGuest: {
      firstName: "Ayoub",
      lastName: "Traveler",
      email: "ayoub@gowild.travel",
      phone: "+1 415 555 0111",
    },
    specialRequests: "Quiet courtyard room",
    acceptedPolicies: true,
  };

  const createRes1 = await app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: {
      ...authHeaders,
      "Idempotency-Key": "idem_booking_paris_001",
    },
    body: bookingPayload,
  });
  assert.equal(createRes1.statusCode, 201);
  const createBody1 = createRes1.json<{
    booking: { id: string; status: string };
    deduplicated: boolean;
  }>();
  assert.equal(createBody1.deduplicated, false);
  assert.equal(createBody1.booking.status, "confirmed");

  // Exact retry with same Idempotency-Key returns 200 with deduplicated=true & identical booking ID
  const createRes2 = await app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: {
      ...authHeaders,
      "Idempotency-Key": "idem_booking_paris_001",
    },
    body: bookingPayload,
  });
  assert.equal(createRes2.statusCode, 200);
  const createBody2 = createRes2.json<{
    booking: { id: string };
    deduplicated: boolean;
  }>();
  assert.equal(createBody2.deduplicated, true);
  assert.equal(createBody2.booking.id, createBody1.booking.id);

  // 9. Ownership Isolation: unauthenticated stranger cannot access this booking
  const strangerRes = await app.inject({
    method: "GET",
    url: `/api/bookings/${createBody1.booking.id}`,
    headers: { "X-Client-Token": "stranger_device_999" },
  });
  assert.equal(strangerRes.statusCode, 404);

  // 10. Notifications reflect confirmed reservation
  const notifRes = await app.inject({
    method: "GET",
    url: "/api/notifications",
    headers: authHeaders,
  });
  assert.equal(notifRes.statusCode, 200);
  const notifBody = notifRes.json<{ notifications: { id: string }[] }>();
  assert.ok(notifBody.notifications.length >= 2);

  // 11. Cancel Booking & Verify Status Transition
  const cancelRes = await app.inject({
    method: "POST",
    url: `/api/bookings/${createBody1.booking.id}/cancel`,
    headers: authHeaders,
    body: {},
  });
  assert.equal(cancelRes.statusCode, 200);
  const cancelBody = cancelRes.json<{
    booking: { status: string; cancelledAt?: string };
  }>();
  assert.equal(cancelBody.booking.status, "cancelled");
  assert.ok(cancelBody.booking.cancelledAt);
});

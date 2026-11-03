import test from "node:test";
import assert from "node:assert/strict";
import { createGoWildGateway } from "../server/src/gateway.ts";
import { InMemoryGatewayStorage } from "../server/src/storage.ts";
import {
  createEmbeddedGateway,
  type KeyValueStorageLike,
} from "../src/services/gateway/embeddedGatewayCore.ts";
import type {
  Booking,
  Hotel,
  ProviderCapabilities,
  RevalidatedOffer,
  RoomOffer,
} from "../src/types/domain.ts";

test("API Gateway (Web Request/Response) executes full discovery, revalidation, idempotent booking, and cancellation", async () => {
  const gateway = createGoWildGateway({
    nodeEnv: "test",
    sqliteDbPath: ":memory:",
    provider: "development_fixtures",
  });

  try {
    // 1. Health check
    const healthRes = await gateway.handleRequest(
      new Request("https://gowild.expo.app/api/health")
    );
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as {
      status: string;
      gateway: { runtime: string; storageBackend: string };
      capabilities: ProviderCapabilities;
    };
    assert.equal(healthJson.status, "ok");
    assert.equal(healthJson.gateway.runtime, "expo-api-gateway");
    assert.equal(healthJson.gateway.storageBackend, "sqlite");

    // 2. Featured hotels
    const featuredRes = await gateway.handleRequest(
      new Request("https://gowild.expo.app/api/hotels/featured?currency=EUR")
    );
    assert.equal(featuredRes.status, 200);
    const featuredJson = (await featuredRes.json()) as { hotels: Hotel[] };
    assert.ok(featuredJson.hotels.length >= 6);
    const targetHotel = featuredJson.hotels[0];

    // 3. Room offers
    const offersRes = await gateway.handleRequest(
      new Request(`https://gowild.expo.app/api/hotels/${targetHotel.id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkIn: "2027-05-10",
          checkOut: "2027-05-13",
          occupancy: { rooms: 1, adults: 2, childrenAges: [] },
          currency: "EUR",
        }),
      })
    );
    assert.equal(offersRes.status, 200);
    const offersJson = (await offersRes.json()) as { offers: RoomOffer[] };
    assert.ok(offersJson.offers.length > 0);
    const selectedOffer = offersJson.offers[0];

    // 4. Revalidate offer
    const revalRes = await gateway.handleRequest(
      new Request("https://gowild.expo.app/api/offers/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: selectedOffer.offerId,
          hotelId: targetHotel.id,
          checkIn: "2027-05-10",
          checkOut: "2027-05-13",
          occupancy: { rooms: 1, adults: 2, childrenAges: [] },
          currency: "EUR",
        }),
      })
    );
    assert.equal(revalRes.status, 200);
    const revalJson = (await revalRes.json()) as { revalidated: RevalidatedOffer };
    assert.ok(revalJson.revalidated.quoteId);

    // 5. Create booking + verify Idempotency-Key deduplication
    const bookingPayload = {
      quoteId: revalJson.revalidated.quoteId,
      offerId: selectedOffer.offerId,
      hotelId: targetHotel.id,
      checkIn: "2027-05-10",
      checkOut: "2027-05-13",
      occupancy: { rooms: 1, adults: 2, childrenAges: [] },
      currency: "EUR",
      leadGuest: {
        firstName: "Ayoub",
        lastName: "Ameur",
        email: "ayoub@gowild.travel",
        phone: "+212600112233",
      },
      acceptedPolicies: true,
    };

    const createRes1 = await gateway.handleRequest(
      new Request("https://gowild.expo.app/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Token": "gw_client_gateway_test_01",
          "Idempotency-Key": "idem_gateway_test_123456",
        },
        body: JSON.stringify(bookingPayload),
      })
    );
    assert.equal(createRes1.status, 201);
    const bk1 = (await createRes1.json()) as {
      booking: Booking;
      deduplicated: boolean;
    };
    assert.equal(bk1.deduplicated, false);
    assert.equal(bk1.booking.status, "confirmed");

    const createRes2 = await gateway.handleRequest(
      new Request("https://gowild.expo.app/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Token": "gw_client_gateway_test_01",
          "Idempotency-Key": "idem_gateway_test_123456",
        },
        body: JSON.stringify(bookingPayload),
      })
    );
    assert.equal(createRes2.status, 200);
    const bk2 = (await createRes2.json()) as {
      booking: Booking;
      deduplicated: boolean;
    };
    assert.equal(bk2.deduplicated, true);
    assert.equal(bk2.booking.id, bk1.booking.id);

    // 6. Cancel booking
    const cancelRes = await gateway.handleRequest(
      new Request(
        `https://gowild.expo.app/api/bookings/${bk1.booking.id}/cancel`,
        {
          method: "POST",
          headers: { "X-Client-Token": "gw_client_gateway_test_01" },
        }
      )
    );
    assert.equal(cancelRes.status, 200);
    const cancelled = (await cancelRes.json()) as { booking: Booking };
    assert.equal(cancelled.booking.status, "cancelled");
  } finally {
    gateway.close();
  }
});

test("API Gateway supports edge-compatible InMemoryGatewayStorage and enforces strict provider errors without silent fallback", async () => {
  const edgeStorage = new InMemoryGatewayStorage();
  const gateway = createGoWildGateway(
    {
      nodeEnv: "test",
      provider: "liteapi",
      liteApi: {
        apiKey: "",
        dataBaseUrl: "https://api.liteapi.travel/v3.0",
        bookBaseUrl: "https://book.liteapi.travel/v3.0",
        checkoutReturnUrl: "gowild://booking/confirmation",
      },
    },
    undefined,
    edgeStorage
  );

  try {
    const res = await gateway.handleRequest(
      new Request("https://gowild.expo.app/api/hotels/featured?currency=USD")
    );
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "PROVIDER_NOT_CONFIGURED");
  } finally {
    gateway.close();
  }
});

test("Always-On Embedded Local Gateway persists bookings, quotes, and accounts across restarts", async () => {
  const backingMap = new Map<string, string>();
  const mockAsyncStorage: KeyValueStorageLike = {
    getItem: async (k) => backingMap.get(k) ?? null,
    setItem: async (k, v) => {
      backingMap.set(k, v);
    },
  };

  const gw1 = createEmbeddedGateway(mockAsyncStorage);
  const featured = await gw1.dispatch({
    method: "GET",
    path: "/api/hotels/featured?currency=USD",
  });
  assert.equal(featured.statusCode, 200);
  const hotels = (featured.payload as { hotels: Hotel[] }).hotels;
  assert.ok(hotels.length > 0);
  const hotel = hotels[0];

  const offersRes = await gw1.dispatch({
    method: "POST",
    path: `/api/hotels/${hotel.id}/offers`,
    body: {
      checkIn: "2027-06-15",
      checkOut: "2027-06-18",
      occupancy: { rooms: 1, adults: 2, childrenAges: [] },
      currency: "USD",
    },
  });
  const offer = (offersRes.payload as { offers: RoomOffer[] }).offers[0];

  const revalRes = await gw1.dispatch({
    method: "POST",
    path: "/api/offers/revalidate",
    body: {
      offerId: offer.offerId,
      hotelId: hotel.id,
      checkIn: "2027-06-15",
      checkOut: "2027-06-18",
      occupancy: { rooms: 1, adults: 2, childrenAges: [] },
      currency: "USD",
    },
  });
  assert.equal(revalRes.statusCode, 200);
  const quote = (revalRes.payload as { revalidated: RevalidatedOffer }).revalidated;

  const bookRes = await gw1.dispatch({
    method: "POST",
    path: "/api/bookings",
    headers: {
      "X-Client-Token": "gw_dev_restart_token",
      "Idempotency-Key": "idem_embedded_restart_001",
    },
    body: {
      quoteId: quote.quoteId,
      offerId: offer.offerId,
      hotelId: hotel.id,
      checkIn: "2027-06-15",
      checkOut: "2027-06-18",
      occupancy: { rooms: 1, adults: 2, childrenAges: [] },
      currency: "USD",
      leadGuest: {
        firstName: "Nadia",
        lastName: "Bennani",
        email: "nadia@example.com",
        phone: "+33612345678",
      },
      acceptedPolicies: true,
    },
  });
  assert.equal(bookRes.statusCode, 201);

  // Instantiate a brand-new gateway over the same AsyncStorage backing map (simulates app relaunch)
  const gwAfterRestart = createEmbeddedGateway(mockAsyncStorage);
  const listRes = await gwAfterRestart.dispatch({
    method: "GET",
    path: "/api/bookings",
    headers: { "X-Client-Token": "gw_dev_restart_token" },
  });
  assert.equal(listRes.statusCode, 200);
  const persistedBookings = (listRes.payload as { bookings: Booking[] }).bookings;
  assert.equal(persistedBookings.length, 1);
  assert.equal(persistedBookings[0].hotelId, hotel.id);
  assert.equal(persistedBookings[0].status, "confirmed");
});

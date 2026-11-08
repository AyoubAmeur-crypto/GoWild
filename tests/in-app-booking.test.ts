import { test } from "node:test";
import assert from "node:assert/strict";
import { InAppBookingProvider } from "../src/services/providers/inAppBookingProvider.ts";
import type { CreateBookingInput } from "../src/lib/validation.ts";

test("InAppBookingProvider provides featured hotels in MAD", async () => {
  const { hotels, capabilities } = InAppBookingProvider.getFeaturedHotels("MAD");
  assert.ok(hotels.length > 0, "Should have featured hotels");
  assert.equal(capabilities.supportsDirectBooking, true);
  const first = hotels[0];
  assert.ok(first.lowestNightlyPrice, "Hotel should have lowest nightly price");
  assert.equal(first.lowestNightlyPrice?.currency, "MAD");
  assert.ok(first.lowestNightlyPrice?.amount > 0, "Price should be positive in MAD");
});

test("InAppBookingProvider generates valid room offers with price breakdown", async () => {
  const { offers } = InAppBookingProvider.getRoomOffers("gw-htl-riad-zitoune", {
    checkIn: "2026-12-01",
    checkOut: "2026-12-04",
    occupancy: { adults: 2, rooms: 1, childrenAges: [] },
    currency: "MAD",
  });

  assert.ok(offers.length > 0, "Should generate room offers");
  const offer = offers[0];
  assert.equal(offer.price.currency, "MAD");
  assert.equal(offer.price.nights, 3);
  assert.ok(offer.price.total > offer.price.baseSubtotal, "Total should include taxes/fees");
  assert.equal(offer.cancellationPolicy.refundableTag, "refundable");
});

test("InAppBookingProvider creates native booking, saves to ledger, and permits cancellation", async () => {
  const bookingInput: CreateBookingInput = {
    quoteId: "quote-test-123",
    offerId: "off-deluxe-1",
    hotelId: "gw-htl-riad-zitoune",
    checkIn: "2026-12-10",
    checkOut: "2026-12-13",
    occupancy: { adults: 2, rooms: 1, childrenAges: [] },
    currency: "MAD",
    leadGuest: {
      firstName: "Ayoub",
      lastName: "Ameur",
      email: "ayoub@example.com",
      phone: "+212 600 000 000",
    },
    specialRequests: "High floor quiet room",
    acceptedPolicies: true,
  };

  const idempotencyKey = `idemp-test-${Date.now()}`;
  const { booking, deduplicated } = await InAppBookingProvider.createBooking(
    bookingInput,
    idempotencyKey
  );

  assert.equal(deduplicated, false);
  assert.ok(booking.id.startsWith("gw_bk_"), "ID should follow goWild format");
  assert.ok(booking.bookingReference?.startsWith("GW-"), "Booking reference should start with GW-");
  assert.equal(booking.status, "confirmed");
  assert.equal(booking.leadGuest.firstName, "Ayoub");
  assert.equal(booking.hotelId, "gw-htl-riad-zitoune");
  assert.equal(booking.price.currency, "MAD");

  // Retrieve
  const detail = await InAppBookingProvider.getBooking(booking.id);
  assert.equal(detail.booking.id, booking.id);
  assert.equal(detail.booking.bookingReference, booking.bookingReference);

  // List
  const list = await InAppBookingProvider.listBookings();
  const found = list.bookings.find((b) => b.id === booking.id);
  assert.ok(found, "Booking should be in list of trips");

  // Cancel
  const cancelRes = await InAppBookingProvider.cancelBooking(booking.id);
  assert.equal(cancelRes.booking.status, "cancelled");
  assert.ok(cancelRes.booking.cancelledAt);

  const updatedDetail = await InAppBookingProvider.getBooking(booking.id);
  assert.equal(updatedDetail.booking.status, "cancelled");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isTrustedNuiteeUrl,
  isVerifiedNuiteeHotelId,
  buildNuiteeOccupanciesParam,
  buildNuiteeSearchUrl,
  buildNuiteeHotelUrl,
  base64Encode,
  DEFAULT_NUITEE_BOOKING_URL,
} from "../src/services/providers/nuiteeBookingService.ts";

test("isTrustedNuiteeUrl enforces HTTPS and whitelisted domains", () => {
  assert.equal(isTrustedNuiteeUrl("https://ayoub-ameur-7p9zu.nuitee.link"), true);
  assert.equal(
    isTrustedNuiteeUrl("https://ayoub-ameur-7p9zu.nuitee.link/hotels?checkin=2026-12-01"),
    true
  );
  assert.equal(isTrustedNuiteeUrl("https://partner.nuitee.link/hotels/lp123"), true);
  assert.equal(isTrustedNuiteeUrl("http://ayoub-ameur-7p9zu.nuitee.link"), false, "Must reject plain HTTP");
  assert.equal(isTrustedNuiteeUrl("https://malicious-site.com/nuitee.link"), false, "Must reject foreign domains");
  assert.equal(isTrustedNuiteeUrl("javascript:alert(1)"), false, "Must reject non-HTTP schemes");
  assert.equal(isTrustedNuiteeUrl(""), false, "Must reject empty strings");
});

test("isVerifiedNuiteeHotelId distinguishes real LiteAPI IDs from mock/prototype IDs", () => {
  assert.equal(isVerifiedNuiteeHotelId("lp4aa75"), true);
  assert.equal(isVerifiedNuiteeHotelId("lp9823ab"), true);
  assert.equal(isVerifiedNuiteeHotelId("123456"), true);
  assert.equal(isVerifiedNuiteeHotelId("hotel-grand-azure"), false);
  assert.equal(isVerifiedNuiteeHotelId("hotel-aspen-meadows"), false);
  assert.equal(isVerifiedNuiteeHotelId("mock-resort"), false);
  assert.equal(isVerifiedNuiteeHotelId("demo-suite"), false);
  assert.equal(isVerifiedNuiteeHotelId("fixture-boutique"), false);
  assert.equal(isVerifiedNuiteeHotelId(""), false);
  assert.equal(isVerifiedNuiteeHotelId(undefined), false);
  assert.equal(isVerifiedNuiteeHotelId(null), false);
});

test("buildNuiteeOccupanciesParam serializes and base64 encodes occupancy", () => {
  const param = buildNuiteeOccupanciesParam({
    adults: 2,
    childrenAges: [],
    rooms: 1,
  });
  const decoded = Buffer.from(param, "base64").toString("utf-8");
  assert.deepEqual(JSON.parse(decoded), [{ adults: 2, children: [] }]);

  const withKids = buildNuiteeOccupanciesParam({
    adults: 2,
    childrenAges: [8, 6],
    rooms: 1,
  });
  const decodedKids = Buffer.from(withKids, "base64").toString("utf-8");
  assert.deepEqual(JSON.parse(decodedKids), [{ adults: 2, children: [8, 6] }]);
});

test("buildNuiteeSearchUrl sets checkin, checkout, occupancies, and MAD currency", () => {
  const url = buildNuiteeSearchUrl({
    checkIn: "2026-11-20",
    checkOut: "2026-11-25",
    occupancy: { adults: 2, childrenAges: [], rooms: 1 },
    currency: "MAD",
  });

  assert.ok(url.startsWith(DEFAULT_NUITEE_BOOKING_URL + "/hotels"));
  assert.ok(url.includes("checkin=2026-11-20"));
  assert.ok(url.includes("checkout=2026-11-25"));
  assert.ok(url.includes("currency=MAD"));
  assert.ok(url.includes("occupancies="));
});

test("buildNuiteeHotelUrl routes verified IDs directly and falls back for mock IDs", () => {
  const verified = buildNuiteeHotelUrl("lp4aa75", {
    checkIn: "2026-12-01",
    checkOut: "2026-12-05",
    currency: "MAD",
  });
  assert.equal(verified.isDirectHotelLink, true);
  assert.ok(verified.url.includes("/hotels/lp4aa75?"));
  assert.ok(verified.url.includes("currency=MAD"));

  const mock = buildNuiteeHotelUrl("hotel-grand-azure", {
    checkIn: "2026-12-01",
    checkOut: "2026-12-05",
    currency: "MAD",
  });
  assert.equal(mock.isDirectHotelLink, false, "Mock IDs must fall back to search/listing page");
  assert.ok(mock.url.startsWith(DEFAULT_NUITEE_BOOKING_URL + "/hotels?"));
  assert.ok(!mock.url.includes("/hotel-grand-azure"));
});


"""Sandbox-only supplier adapters. Fixed upstream URLs; no credentials in responses/logs."""
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from urllib.parse import quote
import httpx
from gowild.errors import fail
from gowild.models import Stay, Search


def expiry() -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()


def amount(value, currency: str) -> float:
    try:
        number = Decimal(str(value))
        if not number.is_finite() or number < 0:
            raise ValueError()
        return float(number.quantize(Decimal("1" if currency == "JPY" else "0.01"), rounding=ROUND_HALF_UP))
    except (InvalidOperation, ValueError, TypeError):
        fail("data-loss", "The supplier returned an invalid monetary amount.", "PROVIDER_UPSTREAM_ERROR")


def price(total, tax, currency: str, stay: dict) -> dict:
    total, tax = amount(total, currency), amount(tax or 0, currency)
    nights = (date.fromisoformat(stay["checkOut"]) - date.fromisoformat(stay["checkIn"])).days
    rooms = stay["occupancy"]["rooms"]
    base = amount(max(0, total - tax), currency)
    return {"currency": currency, "nights": nights, "rooms": rooms, "perNightBase": amount(base / (nights * rooms), currency), "baseSubtotal": base, "taxesAndFees": tax, "propertyFees": 0, "total": total,
            "items": [{"label": f"{nights} nights × {rooms} rooms", "amount": base, "included": True}, {"label": "Taxes and fees", "amount": tax, "included": True}]}


def capabilities(provider: str, configured=True) -> dict:
    return {"providerId": provider, "displayName": "LiteAPI Sandbox" if provider == "liteapi" else "Duffel Stays Test", "mode": "sandbox", "configured": configured,
            "supportsAutocomplete": provider == "liteapi", "supportsLiveRates": True, "supportsOfferRevalidation": True, "supportsDirectBooking": True,
            "supportsHostedCheckout": False, "supportsBookingRetrieval": True, "supportsCancellation": True, "statusMessage": "Sandbox only. No production hotel booking or traveler payment is enabled."}


def filter_hotels(hotels: list[dict], query: dict) -> list[dict]:
    result = []
    for hotel in hotels:
        nightly = hotel.get("lowestNightlyPrice", {}).get("amount")
        if query.get("minPrice") is not None and (nightly is None or nightly < query["minPrice"]):
            continue
        if query.get("maxPrice") is not None and (nightly is None or nightly > query["maxPrice"]):
            continue
        if query.get("minStarRating") and hotel["starRating"] < query["minStarRating"]:
            continue
        if query.get("propertyTypes") and hotel["propertyType"] not in query["propertyTypes"]:
            continue
        if query.get("amenities") and not set(query["amenities"]).issubset({item["code"] for item in hotel["amenities"]}):
            continue
        if query.get("freeCancellationOnly") and not hotel["isFreeCancellationAvailable"]:
            continue
        if query.get("instantConfirmationOnly") and not hotel["isInstantConfirmation"]:
            continue
        result.append(hotel)
    sort = query.get("sortBy")
    if sort in ("price_asc", "price_desc"):
        result.sort(key=lambda hotel: hotel.get("lowestNightlyPrice", {}).get("amount", float("inf")), reverse=sort == "price_desc")
    elif sort == "rating_desc":
        result.sort(key=lambda hotel: hotel["reviewScore"], reverse=True)
    return result


class Supplier:
    def __init__(self, provider: str, credential: str, transport=None):
        if provider not in ("liteapi", "duffel"):
            fail("invalid-argument", "Unsupported hotel provider.")
        self.provider, self.credential, self.transport = provider, credential.strip(), transport
        prefix = "sand_" if provider == "liteapi" else "duffel_test_"
        if not self.credential:
            fail("failed-precondition", "Set the selected supplier's sandbox credential in Firebase Secret Manager.", "PROVIDER_NOT_CONFIGURED")
        if not self.credential.startswith(prefix):
            fail("failed-precondition", "Production supplier credentials are disabled until production approval and payment integration.", "SANDBOX_REQUIRED")

    def request(self, method: str, path: str, body=None, book=False) -> dict:
        if self.transport:
            return self.transport(method, path, body)
        base = ("https://book.liteapi.travel/v3.0" if book else "https://api.liteapi.travel/v3.0") if self.provider == "liteapi" else "https://api.duffel.com"
        headers = {"X-API-Key": self.credential} if self.provider == "liteapi" else {"Authorization": f"Bearer {self.credential}", "Duffel-Version": "v2"}
        try:
            # In particular: no automatic retries for bookings, prebooks or cancellation.
            response = httpx.request(method, base + path, json=body, headers=headers, timeout=25, follow_redirects=False)
            if response.status_code == 404:
                fail("not-found", "The supplier could not find this hotel, rate, or reservation.")
            if response.status_code >= 400:
                fail("unavailable", "The sandbox supplier rejected the request. Check provider access and retry discovery; reconcile any submitted booking first.", "PROVIDER_UPSTREAM_ERROR")
            data = response.json()
            if not isinstance(data, dict) or data.get("error") or data.get("errors"):
                raise ValueError()
            return data
        except (httpx.HTTPError, ValueError):
            fail("unavailable", "The sandbox supplier response was unavailable. A booking submission must be reconciled before retrying.", "PROVIDER_UPSTREAM_ERROR")

    def places(self, query: str, language: str) -> list[dict]:
        if self.provider != "liteapi":
            fail("unimplemented", "For Duffel, choose a map location; place autocomplete is not supported by this adapter.", "PROVIDER_CAPABILITY_UNSUPPORTED")
        if len(query) < 2:
            return []
        data = self.request("GET", f"/data/places?textQuery={quote(query)}&language={language}")
        return [{"placeId": item["placeId"], "title": item["displayName"], "subtitle": item.get("formattedAddress", item["displayName"]), "cityName": item["displayName"], "country": item.get("country", ""), "countryCode": item.get("countryCode", "ZZ"), "latitude": item.get("latitude", 0), "longitude": item.get("longitude", 0), "type": "city"} for item in data.get("data", [])[:8] if item.get("placeId") and item.get("displayName")]

    def hotel(self, identifier: str, raw: dict) -> dict:
        duffel = self.provider == "duffel"
        location = raw.get("location") or {}
        coordinates = location.get("geographic_coordinates", location)
        address = location.get("address") or {}
        lat, lng = coordinates.get("latitude", raw.get("latitude")), coordinates.get("longitude", raw.get("longitude"))
        if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
            fail("data-loss", "The supplier did not provide valid hotel coordinates.", "PROVIDER_UPSTREAM_ERROR")
        photos = raw.get("photos", []) if duffel else raw.get("hotelImages", [])
        images = [{"id": f"{identifier}-{index}", "url": item["url"], "isHero": index == 0} for index, item in enumerate(photos) if item.get("url")]
        if not images and raw.get("main_photo"):
            images = [{"id": f"{identifier}-main", "url": raw["main_photo"], "isHero": True}]
        name = str(raw.get("name", "Property"))
        description = raw.get("description" if duffel else "hotelDescription") or name
        amenities = [{"code": str(item.get("type", index)), "label": item["description"], "category": "service"} for index, item in enumerate(raw.get("amenities", [])) if item.get("description")] if duffel else [{"code": str(item).lower().replace(" ", "_"), "label": str(item), "category": "service"} for item in raw.get("hotelFacilities", [])]
        score = raw.get("review_score" if duffel else "rating") or 0
        return {"id": identifier, "providerId": self.provider, "name": name, "starRating": min(5, max(0, raw.get("rating" if duffel else "stars") or raw.get("starRating") or 0)), "reviewScore": min(5, score / 2 if score > 5 else score), "reviewCount": raw.get("review_count" if duffel else "reviewCount") or 0,
                "propertyType": "hotel", "summary": str(description)[:140], "description": description,
                "location": {"address": address.get("line_one", "") if duffel else raw.get("address", ""), "city": address.get("city_name", "") if duffel else raw.get("city", ""), "country": address.get("country_code", "") if duffel else raw.get("country", ""), "countryCode": address.get("country_code", "ZZ") if duffel else raw.get("countryCode", "ZZ"), "latitude": lat, "longitude": lng},
                "images": images, "amenities": amenities, "policies": {"checkInFrom": (raw.get("checkinCheckoutTimes") or {}).get("checkin", "15:00"), "checkOutUntil": (raw.get("checkinCheckoutTimes") or {}).get("checkout", "11:00"), "cancellationSummary": "See the selected rate for cancellation conditions.", "childrenPolicy": "Subject to the selected occupancy and property policy.", "petsAllowed": False},
                "isFreeCancellationAvailable": False, "isInstantConfirmation": False, "reviews": []}

    def detail(self, hotel_id: str) -> dict:
        if self.provider == "liteapi":
            raw = self.request("GET", f"/data/hotel?hotelId={quote(hotel_id, safe='')}").get("data")
        else:
            raw = self.request("POST", f"/stays/search_results/{quote(hotel_id, safe='')}/actions/fetch_all_rates").get("data", {}).get("accommodation")
        if not raw:
            fail("not-found", "Hotel not found.")
        return self.hotel(hotel_id, raw)

    @staticmethod
    def occupancies(stay: dict) -> list[dict]:
        occupancy = stay["occupancy"]
        rooms, adults = occupancy["rooms"], occupancy["adults"]
        return [{"adults": adults // rooms + (1 if index < adults % rooms else 0), "children": occupancy["childrenAges"] if index == 0 else []} for index in range(rooms)]

    def lite_rates(self, stay: dict, hotel_ids: list[str]) -> list[dict]:
        return self.request("POST", "/hotels/rates", {"hotelIds": hotel_ids, "checkin": stay["checkIn"], "checkout": stay["checkOut"], "currency": stay["currency"], "guestNationality": "US", "occupancies": self.occupancies(stay)}).get("data", [])

    def lite_offer(self, hotel_id: str, room: dict, stay: dict) -> dict:
        rates = room.get("rates", [])
        if not rates or not room.get("offerId"):
            fail("data-loss", "The supplier returned an incomplete rate.", "PROVIDER_UPSTREAM_ERROR")
        rate = rates[0]
        retail = rate.get("retailRate") or {}
        totals = retail.get("total") or []
        if not totals or totals[0].get("currency") != stay["currency"]:
            fail("failed-precondition", "Supplier rate currency differs from the search currency.", "CURRENCY_MISMATCH")
        taxes = retail.get("taxesAndFees") or []
        included_tax = sum(float(item["amount"]) for item in taxes if item.get("included", True))
        property_fees = sum(float(item["amount"]) for item in taxes if not item.get("included", True))
        policy = rate.get("cancellationPolicies") or {}
        refundable = {"RFN": "refundable", "PRFN": "partial"}.get(policy.get("refundableTag"), "non_refundable")
        deadlines = policy.get("cancelPolicyInfos") or []
        board = str(rate.get("boardType", "RO")).upper()
        breakdown = price(totals[0]["amount"], included_tax, stay["currency"], stay)
        breakdown["propertyFees"] = amount(property_fees, stay["currency"])
        if property_fees:
            breakdown["items"].append({"label": "Fees payable at property", "amount": breakdown["propertyFees"], "included": False})
        offer = {"offerId": room["offerId"], "hotelId": hotel_id, "providerId": "liteapi", "supplierName": room.get("supplier", "LiteAPI"), "roomName": rate.get("name", "Guest room"), "description": rate.get("name", "Guest room"), "maxAdults": rate.get("adultCount", stay["occupancy"]["adults"]), "maxChildren": rate.get("childCount", len(stay["occupancy"]["childrenAges"])), "bedSummary": "See property room details", "images": [], "amenities": [],
                 "ratePlan": {"rateId": rate.get("rateId", room["offerId"]), "boardType": "breakfast_included" if board in ("BI", "BB") else "half_board" if board == "HB" else "all_inclusive" if board == "AI" else "room_only", "boardLabel": rate.get("boardName", "Room only"), "paymentType": "pay_now", "isInstantConfirmation": True}, "price": breakdown,
                 "cancellationPolicy": {"refundableTag": refundable, "summary": "Review the supplier cancellation terms before confirming."}, "expiresAt": expiry()}
        if deadlines and deadlines[0].get("cancelTime"):
            offer["cancellationPolicy"]["freeCancellationUntil"] = deadlines[0]["cancelTime"]
        return offer

    def duffel_offer(self, hotel_id: str, room: dict, rate: dict, stay: dict) -> dict:
        currency = rate.get("total_currency")
        if currency != stay["currency"]:
            fail("failed-precondition", f"This Duffel rate is priced in {currency}; select that currency.", "CURRENCY_MISMATCH")
        if rate.get("payment_method", "balance") != "balance":
            fail("unimplemented", "This sandbox rate requires a card payment flow that is not enabled.", "PAYMENT_UNAVAILABLE")
        timeline = rate.get("cancellation_timeline") or []
        cancellation = {"refundableTag": "refundable" if timeline else "non_refundable", "summary": "See the supplier cancellation timeline."}
        # A deadline is free cancellation only if the documented refund equals the full rate.
        full_refund = [item for item in timeline if item.get("before") and amount(item.get("refund_amount", 0), currency) == amount(rate["total_amount"], currency)]
        if full_refund:
            cancellation["freeCancellationUntil"] = full_refund[0]["before"]
        return {"offerId": rate["id"], "hotelId": hotel_id, "providerId": "duffel", "supplierName": "Duffel Stays Test", "roomName": room["name"], "description": room["name"], "maxAdults": stay["occupancy"]["adults"], "maxChildren": len(stay["occupancy"]["childrenAges"]), "bedSummary": "See property room details", "images": [], "amenities": [], "ratePlan": {"rateId": rate["id"], "boardType": "breakfast_included" if rate.get("board_type") == "breakfast" else "room_only", "boardLabel": rate.get("board_type", "Room only"), "paymentType": "pay_now", "isInstantConfirmation": True}, "price": price(rate["total_amount"], rate.get("tax_amount", 0), currency, stay), "cancellationPolicy": cancellation, "expiresAt": expiry()}

    def offers(self, hotel_id: str, stay: dict) -> list[dict]:
        if self.provider == "liteapi":
            return [self.lite_offer(hotel_id, room, stay) for item in self.lite_rates(stay, [hotel_id]) if item.get("hotelId") == hotel_id for room in item.get("roomTypes", [])]
        accommodation = self.request("POST", f"/stays/search_results/{quote(hotel_id, safe='')}/actions/fetch_all_rates").get("data", {}).get("accommodation", {})
        return [self.duffel_offer(hotel_id, room, rate, stay) for room in accommodation.get("rooms", []) for rate in room.get("rates", []) if rate.get("total_currency") == stay["currency"] and rate.get("payment_method", "balance") == "balance"]

    def search(self, query: dict) -> list[dict]:
        if self.provider == "liteapi":
            params = "limit=20"
            if query.get("placeId"):
                params += "&placeId=" + quote(query["placeId"], safe="")
            elif query.get("latitude") is not None:
                params += f'&latitude={query["latitude"]}&longitude={query["longitude"]}&radius={query["radiusKm"] * 1000}'
            else:
                params += "&cityName=" + quote(query.get("cityName") or query.get("destination") or "Paris") + "&countryCode=" + quote(query.get("countryCode") or "FR")
            raw_hotels = self.request("GET", "/data/hotels?" + params).get("data", [])[:20]
            if not raw_hotels:
                return []
            rates = {item["hotelId"]: item for item in self.lite_rates(query, [item["id"] for item in raw_hotels])}
            hotels = []
            for raw in raw_hotels:
                if raw["id"] not in rates:
                    continue
                hotel = self.hotel(raw["id"], raw)
                offers = [self.lite_offer(raw["id"], room, query) for room in rates[raw["id"]].get("roomTypes", [])]
                if not offers:
                    continue
                cheapest = min(offers, key=lambda item: item["price"]["total"])
                hotel["lowestNightlyPrice"] = {"amount": amount(cheapest["price"]["total"] / (cheapest["price"]["nights"] * cheapest["price"]["rooms"]), query["currency"]), "currency": query["currency"]}
                hotel["isFreeCancellationAvailable"] = any(item["cancellationPolicy"]["refundableTag"] == "refundable" for item in offers)
                hotel["isInstantConfirmation"] = True
                hotels.append(hotel)
        else:
            if query.get("latitude") is None and (query.get("cityName") or query.get("destination")):
                fail("invalid-argument", "Choose a map location to search Duffel Stays.")
            guests = [{"type": "adult"} for _ in range(query["occupancy"]["adults"])] + [{"type": "child", "age": age} for age in query["occupancy"]["childrenAges"]]
            data = self.request("POST", "/stays/search", {"data": {"check_in_date": query["checkIn"], "check_out_date": query["checkOut"], "rooms": query["occupancy"]["rooms"], "guests": guests, "free_cancellation_only": query.get("freeCancellationOnly", False), "location": {"radius": query["radiusKm"], "geographic_coordinates": {"latitude": query.get("latitude", 48.8566), "longitude": query.get("longitude", 2.3522)}}}}).get("data", {})
            hotels = []
            nights = (date.fromisoformat(query["checkOut"]) - date.fromisoformat(query["checkIn"])).days
            for item in data.get("results", [])[:25]:
                currency = item["cheapest_rate_currency"]
                if currency != query["currency"]:
                    fail("failed-precondition", f"Duffel returns {currency} rates for this search; select that currency.", "CURRENCY_MISMATCH")
                hotel = self.hotel(item["id"], item["accommodation"])
                hotel["lowestNightlyPrice"] = {"amount": amount(float(item["cheapest_rate_total_amount"]) / (nights * query["occupancy"]["rooms"]), currency), "currency": currency}
                hotel["isFreeCancellationAvailable"] = bool(query.get("freeCancellationOnly"))
                hotel["isInstantConfirmation"] = True
                hotels.append(hotel)
        return filter_hotels(hotels, query)

    def revalidate(self, offer: dict, context: dict) -> tuple[dict, str]:
        updated = deepcopy(offer)
        if self.provider == "liteapi":
            data = self.request("POST", "/rates/prebook", {"offerId": offer["offerId"], "usePaymentSdk": False}, book=True).get("data", {})
            identifier = data.get("prebookId")
            if data.get("roomTypes"):
                # Preserve the selected offer identity; never substitute another rate.
                room = {**data["roomTypes"][0], "offerId": offer["offerId"]}
                updated = self.lite_offer(offer["hotelId"], room, context)
            elif data.get("priceDifferencePercent"):
                fail("failed-precondition", "Supplier pricing changed without a complete rate response. Refresh room rates.", "OFFER_EXPIRED")
        else:
            data = self.request("POST", "/stays/quotes", {"data": {"rate_id": offer["offerId"]}}).get("data", {})
            identifier = data.get("id")
            currency = data.get("total_currency", data.get("currency"))
            if currency != context["currency"]:
                fail("failed-precondition", "The supplier quote currency changed.", "CURRENCY_MISMATCH")
            updated["price"] = price(data["total_amount"], data.get("tax_amount", 0), currency, context)
        if not identifier:
            fail("failed-precondition", "This offer is no longer available.", "OFFER_SOLD_OUT")
        updated["expiresAt"] = expiry()
        return updated, identifier

    def book(self, supplier_quote: str, payload: dict, key: str) -> dict:
        guest = payload["leadGuest"]
        if self.provider == "liteapi":
            data = self.request("POST", "/rates/book", {"prebookId": supplier_quote, "clientReference": key, "holder": guest, "guests": [{"occupancyNumber": index + 1, "firstName": guest["firstName"], "lastName": guest["lastName"], "email": guest["email"]} for index in range(payload["occupancy"]["rooms"])], "payment": {"method": "ACC_CREDIT_CARD"}}, book=True).get("data", {})
            identifier, reference = data.get("bookingId"), data.get("hotelConfirmationCode")
        else:
            data = self.request("POST", "/stays/bookings", {"data": {"quote_id": supplier_quote, "email": guest["email"], "phone_number": "".join(char for char in guest["phone"] if char.isdigit() or char == "+"), "guests": [{"given_name": guest["firstName"], "family_name": guest["lastName"]}], "accommodation_special_requests": payload.get("specialRequests", ""), "metadata": {"idempotency_key": key}}}).get("data", {})
            identifier, reference = data.get("id"), data.get("booking_reference", data.get("reference"))
        if not identifier:
            fail("unavailable", "The supplier did not return a reservation ID. Reconcile this submission before retrying.", "PROVIDER_UPSTREAM_ERROR")
        return {"providerBookingId": identifier, "bookingReference": reference or identifier, "status": self.status(data.get("status"))}

    @staticmethod
    def status(raw) -> str:
        status = str(raw or "").upper()
        return "confirmed" if status == "CONFIRMED" else "cancelled" if status.startswith("CANCELLED") else "failed" if status == "FAILED" else "completed" if status == "COMPLETED" else "pending"

    def retrieve(self, identifier: str) -> dict:
        path = f"/bookings/{quote(identifier, safe='')}" if self.provider == "liteapi" else f"/stays/bookings/{quote(identifier, safe='')}"
        data = self.request("GET", path, book=True).get("data", {})
        if not data.get("bookingId" if self.provider == "liteapi" else "id"):
            fail("data-loss", "Supplier reservation retrieval returned no ID.", "PROVIDER_UPSTREAM_ERROR")
        return {"status": self.status(data.get("status"))}

    def cancel(self, identifier: str) -> dict:
        if self.provider == "liteapi":
            self.request("PUT", f"/bookings/{quote(identifier, safe='')}", book=True)
        else:
            self.request("POST", f"/stays/bookings/{quote(identifier, safe='')}/actions/cancel")
        # Verify the supplier's actual status; HTTP success alone is insufficient.
        return self.retrieve(identifier)

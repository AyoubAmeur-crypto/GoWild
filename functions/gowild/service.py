from datetime import datetime, timedelta, timezone
import uuid
from gowild.errors import fail
from gowild.models import Book, BookingId, Detail, Favorite, HotelStay, Places, Revalidate, Search, UpdateProfile
from gowild.providers import capabilities
from gowild.store import Store, now


class Service:
    def __init__(self, store: Store, supplier=None):
        self.store, self.supplier = store, supplier

    def profile(self, identity: dict) -> dict:
        return {"user": self.store.profile(identity)}

    def update_profile(self, data: dict, identity: dict) -> dict:
        patch = UpdateProfile.model_validate(data).patch.json_data()
        self.store.profile(identity)
        return {"user": self.store.patch_profile(patch)}

    def favorites(self) -> dict:
        return {"hotelIds": self.store.favorites()}

    def set_favorite(self, data: dict) -> dict:
        parsed = Favorite.model_validate(data)
        return {"hotelIds": self.store.set_favorite(parsed.hotelId, parsed.saved)}

    def list_bookings(self) -> dict:
        return {"bookings": self.store.bookings()}

    def notifications(self) -> dict:
        result = []
        for booking in self.store.bookings()[:20]:
            result.append({"id": f'booking-{booking["id"]}-{booking["status"]}', "title": f'Sandbox reservation {booking["status"]}', "body": booking["hotelName"], "category": "booking", "createdAt": booking["updatedAt"], "read": False, "bookingId": booking["id"], "hotelId": booking["hotelId"]})
        return {"notifications": result}

    def _hotel_key(self, hotel_id: str) -> str:
        return self.supplier.provider + ":" + hotel_id

    def hotel(self, hotel_id: str) -> dict:
        # Duffel search-result IDs can expire. Preserve the selected user's snapshot.
        cached = self.store.get("hotels", self._hotel_key(hotel_id))
        if cached:
            return cached["hotel"]
        hotel = self.supplier.detail(hotel_id)
        self.store.save("hotels", self._hotel_key(hotel_id), {"hotel": hotel})
        return hotel

    def dispatch(self, action: str, data: dict) -> dict:
        caps = capabilities(self.supplier.provider)
        if action == "health":
            return {"status": "ok", "timestamp": now(), "gateway": {"runtime": "Firebase Python Functions v2 (europe-west1)", "storageBackend": "firestore"}, "capabilities": caps}
        if action == "places":
            parsed = Places.model_validate(data)
            return {"places": self.supplier.places(parsed.q, parsed.lang), "capabilities": caps}
        if action in ("featured", "search"):
            if action == "featured":
                allowed = {"currency", "checkIn", "checkOut"}
                if set(data) - allowed:
                    fail("invalid-argument", "Unsupported featured-search fields.")
                today = datetime.now(timezone.utc).date()
                query = Search.model_validate({"checkIn": data.get("checkIn") or (today + timedelta(days=7)).isoformat(), "checkOut": data.get("checkOut") or (today + timedelta(days=10)).isoformat(), "occupancy": {"rooms": 1, "adults": 2, "childrenAges": []}, "currency": data.get("currency", "USD")}).json_data()
            else:
                if set(data) != {"query"}:
                    fail("invalid-argument", "Expected a hotel search query.")
                query = Search.model_validate(data["query"]).json_data()
            hotels = self.supplier.search(query)
            for hotel in hotels:
                self.store.save("hotels", self._hotel_key(hotel["id"]), {"hotel": hotel, "context": {name: query[name] for name in ("checkIn", "checkOut", "occupancy", "currency")}})
            return {"hotels": hotels, "total": len(hotels), "capabilities": caps, "appliedQuery": query}
        if action == "detail":
            parsed = Detail.model_validate(data)
            hotel = self.hotel(parsed.hotelId)
            if hotel.get("lowestNightlyPrice", {}).get("currency", parsed.currency) != parsed.currency:
                # Detail is not a currency conversion API; rates are fetched separately.
                hotel = {key: value for key, value in hotel.items() if key not in ("lowestNightlyPrice", "compareAtNightlyPrice")}
            return {"hotel": hotel, "capabilities": caps}
        if action == "offers":
            parsed = HotelStay.model_validate(data)
            context = parsed.context()
            cached = self.store.get("hotels", self._hotel_key(parsed.hotelId))
            if self.supplier.provider == "duffel" and (not cached or cached.get("context") != context):
                fail("failed-precondition", "Repeat the Duffel hotel search for these dates, guests and currency.", "OFFER_EXPIRED")
            offers = self.supplier.offers(parsed.hotelId, context)
            for offer in offers:
                self.store.save("offers", self._hotel_key(offer["offerId"]), {"offer": offer, "context": {"hotelId": parsed.hotelId, **context}})
            return {"offers": offers, "capabilities": caps}
        if action == "revalidate":
            parsed = Revalidate.model_validate(data)
            context = parsed.json_data()
            saved = self.store.get("offers", self._hotel_key(parsed.offerId))
            expected = {key: value for key, value in context.items() if key != "offerId"}
            if not saved or saved["context"] != expected:
                fail("failed-precondition", "Select a room rate matching these dates and guests before revalidation.", "OFFER_EXPIRED")
            if datetime.fromisoformat(saved["offer"]["expiresAt"]) <= datetime.now(timezone.utc):
                fail("failed-precondition", "This room offer expired. Refresh room rates.", "OFFER_EXPIRED")
            hotel = self.hotel(parsed.hotelId)
            offer, private_quote_id = self.supplier.revalidate(saved["offer"], context)
            quote_id = "qt_" + uuid.uuid4().hex
            old_total = saved["offer"]["price"]["total"]
            result = {"quoteId": quote_id, "offer": offer, "available": True, "priceChanged": offer["price"]["total"] != old_total, "previousTotal": old_total, "checkoutMode": "sandbox_instant", "expiresAt": offer["expiresAt"], "capabilities": caps}
            self.store.save("quotes", quote_id, {"provider": self.supplier.provider, "supplierQuoteId": private_quote_id, "context": context, "public": result, "hotel": hotel})
            return {"revalidated": result}
        if action == "book":
            parsed = Book.model_validate(data)
            payload = parsed.input.json_data()
            existing = self.store.claim_booking(parsed.idempotencyKey, payload, self.supplier.provider)
            if existing:
                return {"booking": existing, "deduplicated": True}
            saved = self.store.get("quotes", payload["quoteId"])
            # Any failure from this point retains the claim for manual reconciliation.
            remote = self.supplier.book(saved["supplierQuoteId"], payload, parsed.idempotencyKey)
            hotel, offer = saved["hotel"], saved["public"]["offer"]
            timestamp = now()
            booking = {"id": "bk_" + uuid.uuid4().hex, "idempotencyKey": parsed.idempotencyKey, "providerId": self.supplier.provider, "providerDisplayName": caps["displayName"], **remote, "isSandbox": True, "isExternalHandoff": False,
                       "hotelId": payload["hotelId"], "hotelName": hotel["name"], "hotelCity": hotel["location"]["city"], "hotelCountry": hotel["location"]["country"], "hotelAddress": hotel["location"]["address"], "hotelImageUrl": hotel["images"][0]["url"] if hotel["images"] else "", "roomName": offer["roomName"], "boardLabel": offer["ratePlan"]["boardLabel"], "checkIn": payload["checkIn"], "checkOut": payload["checkOut"], "nights": offer["price"]["nights"], "occupancy": payload["occupancy"], "leadGuest": payload["leadGuest"], "specialRequests": payload.get("specialRequests", ""), "price": offer["price"], "cancellationPolicy": offer["cancellationPolicy"], "createdAt": timestamp, "updatedAt": timestamp}
            self.store.record_booking(parsed.idempotencyKey, booking)
            return {"booking": booking, "deduplicated": False}
        if action in ("booking", "cancel"):
            parsed = BookingId.model_validate(data)
            record = self.store.booking(parsed.bookingId, self.supplier.provider)
            booking = record["booking"]
            if not booking.get("isSandbox"):
                fail("failed-precondition", "Production reservation operations are disabled.", "SANDBOX_REQUIRED")
            if action == "cancel":
                if booking["status"] != "cancelled":
                    self.store.claim_cancellation(parsed.bookingId)
                    remote = self.supplier.cancel(booking["providerBookingId"])
                    if remote["status"] != "cancelled":
                        fail("failed-precondition", "Supplier cancellation is not confirmed. Retrieve the reservation before retrying.")
                    booking = {**booking, "status": "cancelled", "cancelledAt": now(), "updatedAt": now()}
                    self.store.update_booking(booking)
                return {"booking": booking, "refundSummary": "Sandbox cancellation verified with the supplier. No traveler payment was collected."}
            remote = self.supplier.retrieve(booking["providerBookingId"])
            if remote["status"] != booking["status"]:
                booking = {**booking, **remote, "updatedAt": now()}
                self.store.update_booking(booking)
            return {"booking": booking, "capabilities": caps}
        fail("invalid-argument", "Unknown supplier operation.")

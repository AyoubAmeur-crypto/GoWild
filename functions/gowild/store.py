import hashlib
import json
from datetime import datetime, timezone
from google.cloud import firestore
from gowild.errors import fail


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class Store:
    def __init__(self, db: firestore.Client, uid: str):
        self.db, self.uid = db, uid
        self.user = db.collection("users").document(uid)

    def collection(self, name: str):
        return self.user.collection(name)

    def profile(self, identity: dict) -> dict:
        @firestore.transactional
        def upsert(tx):
            existing = self.user.get(transaction=tx)
            if existing.exists:
                return existing.to_dict()
            names = str(identity.get("name", "")).split()
            profile = {"id": self.uid, "email": identity.get("email", ""), "firstName": names[0] if names else "", "lastName": " ".join(names[1:]), "phone": "", "preferredCurrency": "USD", "preferredLanguage": "en", "createdAt": now()}
            tx.create(self.user, profile)
            return profile
        return upsert(self.db.transaction())

    def patch_profile(self, patch: dict) -> dict:
        self.user.update(patch)
        return self.user.get().to_dict()

    def favorites(self) -> list[str]:
        docs = [snap.to_dict() for snap in self.collection("favorites").stream()]
        return [item["hotelId"] for item in sorted(docs, key=lambda item: item["createdAt"], reverse=True)]

    def set_favorite(self, hotel_id: str, saved: bool) -> list[str]:
        ref = self.collection("favorites").document(digest(hotel_id))
        if saved:
            ref.set({"hotelId": hotel_id, "createdAt": now()})
        else:
            ref.delete()
        return self.favorites()

    def save(self, collection: str, identifier: str, value: dict):
        self.collection(collection).document(digest(identifier)).set(value)

    def get(self, collection: str, identifier: str) -> dict:
        return self.collection(collection).document(digest(identifier)).get().to_dict() or {}

    def bookings(self) -> list[dict]:
        return sorted([snap.to_dict()["booking"] for snap in self.collection("bookings").stream()], key=lambda item: item["createdAt"], reverse=True)

    def booking(self, booking_id: str, provider: str | None = None) -> dict:
        record = self.get("bookings", booking_id)
        if not record or (provider and record["booking"]["providerId"] != provider):
            fail("not-found", "Reservation not found.")
        return record

    def claim_booking(self, key: str, payload: dict, provider: str) -> dict | None:
        """Claim request + quote atomically; NEVER call a supplier inside a transaction."""
        ref = self.collection("booking_requests").document(digest(key))
        quote_ref = self.collection("quotes").document(digest(payload["quoteId"]))
        fingerprint = digest(json.dumps({"provider": provider, "input": payload}, sort_keys=True, separators=(",", ":")))

        @firestore.transactional
        def claim(tx):
            previous = ref.get(transaction=tx).to_dict()
            quote = quote_ref.get(transaction=tx).to_dict()
            if previous:
                if previous["fingerprint"] != fingerprint:
                    fail("already-exists", "This key was used with different reservation details.", "CONFLICT")
                if previous.get("booking"):
                    return previous["booking"]
                fail("aborted", "This reservation is already submitting or needs supplier reconciliation. Do not submit a new key.", "BOOKING_IN_PROGRESS")
            if not quote or quote["provider"] != provider:
                fail("not-found", "Revalidate this offer before booking.", "OFFER_EXPIRED")
            context = {name: payload[name] for name in ("hotelId", "offerId", "checkIn", "checkOut", "occupancy", "currency")}
            if quote["context"] != context:
                fail("failed-precondition", "Reservation details differ from the revalidated offer.", "QUOTE_MISMATCH")
            if datetime.fromisoformat(quote["public"]["expiresAt"]) <= datetime.now(timezone.utc):
                fail("failed-precondition", "The offer expired. Revalidate availability.", "OFFER_EXPIRED")
            if quote.get("bookingRequest"):
                fail("already-exists", "This quote already has a reservation submission.", "CONFLICT")
            tx.create(ref, {"fingerprint": fingerprint, "idempotencyKey": key, "input": payload, "provider": provider, "state": "submitting", "createdAt": now()})
            tx.update(quote_ref, {"bookingRequest": digest(key)})
            return None
        return claim(self.db.transaction())

    def record_booking(self, key: str, booking: dict):
        batch = self.db.batch()
        batch.create(self.collection("bookings").document(digest(booking["id"])), {"booking": booking})
        batch.update(self.collection("booking_requests").document(digest(key)), {"state": "recorded", "booking": booking})
        batch.commit()

    def update_booking(self, booking: dict):
        self.collection("bookings").document(digest(booking["id"])).update({"booking": booking})
        # Retry receipts should reflect the latest known state too.
        self.collection("booking_requests").document(digest(booking["idempotencyKey"])).update({"booking": booking})

    def claim_cancellation(self, booking_id: str):
        ref = self.collection("bookings").document(digest(booking_id))

        @firestore.transactional
        def claim(tx):
            record = ref.get(transaction=tx).to_dict()
            if not record:
                fail("not-found", "Reservation not found.")
            if record.get("cancellationStartedAt"):
                fail("aborted", "Cancellation is already submitting or requires reconciliation.", "CANCELLATION_IN_PROGRESS")
            tx.update(ref, {"cancellationStartedAt": now()})
        claim(self.db.transaction())

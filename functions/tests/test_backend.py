import inspect
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import TestCase
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main
from firebase_functions.https_fn import CallableRequest, AuthData, HttpsError
from gowild.models import Book, Search
from gowild.providers import Supplier, price
from pydantic import ValidationError


def stay():
    start = datetime.now(timezone.utc).date() + timedelta(days=30)
    return {"checkIn": start.isoformat(), "checkOut": (start + timedelta(days=3)).isoformat(), "occupancy": {"rooms": 1, "adults": 2, "childrenAges": []}, "currency": "USD"}


def lite_room(total=330):
    return {"offerId": "offer_1", "rates": [{"name": "Deluxe", "rateId": "rate_1", "retailRate": {"total": [{"amount": total, "currency": "USD"}], "taxesAndFees": [{"amount": 30, "included": True}, {"amount": 9, "included": False}]}, "cancellationPolicies": {"refundableTag": "RFN"}}]}


class CallableTests(TestCase):
    def request(self, authenticated=True):
        return CallableRequest(data={}, raw_request=MagicMock(), auth=AuthData(uid="alice", token={"email": "alice@example.com"}) if authenticated else None)

    def test_connection_rejects_guest_before_db_access(self):
        with patch("firebase_admin.firestore.client") as client:
            with self.assertRaises(HttpsError) as error:
                inspect.unwrap(main.testConnection)(self.request(False))
            self.assertEqual(error.exception.code.value, "unauthenticated")
            client.assert_not_called()

    def test_connection_writes_only_verified_uid(self):
        with patch("firebase_admin.firestore.client") as client:
            ref = client.return_value.collection.return_value.document.return_value
            ref.path = "connection_tests/alice"
            req = self.request()
            req.data["uid"] = "victim"  # A supplied owner is never authoritative.
            result = inspect.unwrap(main.testConnection)(req)
            client.return_value.collection.assert_called_once_with("connection_tests")
            client.return_value.collection.return_value.document.assert_called_once_with("alice")
            self.assertEqual(ref.set.call_args.args[0]["uid"], "alice")
            self.assertEqual(result["success"], True)
            self.assertEqual(result["region"], "europe-west1")

    def test_all_callables_enforce_auth_before_db_access(self):
        names = ["getProfile", "updateProfile", "getFavorites", "setFavorite", "listBookings", "getNotifications", "liteApi", "duffelApi"]
        for name in names:
            with self.subTest(name=name), patch("firebase_admin.firestore.client") as client:
                with self.assertRaises(HttpsError):
                    inspect.unwrap(getattr(main, name))(self.request(False))
                client.assert_not_called()
                endpoint = getattr(main, name).__firebase_endpoint__
                self.assertEqual(endpoint.region, ["europe-west1"])
                self.assertEqual(endpoint.platform, "gcfv2")

    def test_connection_needs_no_supplier_secret(self):
        self.assertFalse(main.testConnection.__firebase_endpoint__.secretEnvironmentVariables)
        self.assertEqual(main.liteApi.__firebase_endpoint__.secretEnvironmentVariables, [{"key": "LITEAPI_KEY"}])
        self.assertEqual(main.duffelApi.__firebase_endpoint__.secretEnvironmentVariables, [{"key": "DUFFEL_ACCESS_TOKEN"}])


class ProviderTests(TestCase):
    def test_production_keys_are_rejected_without_upstream_request(self):
        for provider, credential in [("liteapi", "prod_key"), ("duffel", "duffel_live_key"), ("liteapi", "")]:
            with self.subTest(provider=provider), self.assertRaises(HttpsError):
                Supplier(provider, credential, MagicMock())

    def test_missing_dates_and_changed_occupancy_are_rejected(self):
        data = stay()
        with self.assertRaises(ValidationError):
            Search.model_validate({**data, "checkOut": data["checkIn"]})
        with self.assertRaises(ValidationError):
            Search.model_validate({**data, "occupancy": {"rooms": 2, "adults": 1, "childrenAges": []}})
        with self.assertRaises(ValidationError):
            Search.model_validate({**data, "currency": "FAKE"})

    def test_money_and_currency_are_not_silently_relabelled(self):
        supplier = Supplier("liteapi", "sand_test", MagicMock())
        offer = supplier.lite_offer("hotel_1", lite_room(), stay())
        self.assertEqual(offer["price"]["total"], 330)
        self.assertEqual(offer["price"]["taxesAndFees"], 30)
        self.assertEqual(offer["price"]["propertyFees"], 9)
        self.assertEqual(offer["price"]["baseSubtotal"], 300)
        with self.assertRaises(HttpsError):
            supplier.lite_offer("hotel_1", lite_room(), {**stay(), "currency": "EUR"})

    def test_liteapi_prebook_and_book_use_sandbox_payment_only(self):
        transport = MagicMock(side_effect=[{"data": {"prebookId": "private_prebook", "roomTypes": [lite_room(360)]}}, {"data": {"bookingId": "sandbox_booking", "status": "CONFIRMED", "hotelConfirmationCode": "TEST123"}}])
        supplier = Supplier("liteapi", "sand_test", transport)
        original = supplier.lite_offer("hotel_1", lite_room(), stay())
        updated, quote = supplier.revalidate(original, stay())
        self.assertEqual(updated["price"]["total"], 360)
        self.assertFalse(transport.call_args_list[0].args[2]["usePaymentSdk"])
        payload = {**stay(), "leadGuest": {"firstName": "Test", "lastName": "Traveler", "email": "test@example.com", "phone": "+212600112233"}}
        booking = supplier.book(quote, payload, "stable_key_123")
        self.assertEqual(booking["status"], "confirmed")
        self.assertEqual(transport.call_args_list[1].args[2]["payment"], {"method": "ACC_CREDIT_CARD"})
        self.assertEqual(transport.call_count, 2)

    def test_missing_provider_confirmation_remains_pending(self):
        supplier = Supplier("liteapi", "sand_test", lambda *_: {"data": {"bookingId": "pending_1"}})
        result = supplier.book("quote_1", {**stay(), "leadGuest": {"firstName": "Test", "lastName": "Traveler", "email": "test@example.com"}}, "key_12345")
        self.assertEqual(result["status"], "pending")

    def test_duffel_quote_currency_change_is_rejected(self):
        supplier = Supplier("duffel", "duffel_test_x", lambda *_: {"data": {"id": "quote_1", "total_amount": "300", "total_currency": "EUR"}})
        with self.assertRaises(HttpsError):
            supplier.revalidate({"offerId": "rate_1"}, stay())

    def test_cancellation_requires_verified_supplier_status(self):
        transport = MagicMock(side_effect=[{"data": {}}, {"data": {"bookingId": "bk_1", "status": "PENDING"}}])
        supplier = Supplier("liteapi", "sand_test", transport)
        self.assertEqual(supplier.cancel("bk_1")["status"], "pending")
        self.assertEqual(transport.call_count, 2)

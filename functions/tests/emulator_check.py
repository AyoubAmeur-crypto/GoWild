"""Real callable/Auth/Firestore emulator smoke test; no live provider requests."""
import concurrent.futures
import subprocess
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from google.cloud.firestore import Client
from google.auth.credentials import AnonymousCredentials
from gowild.store import Store, digest
from firebase_functions.https_fn import HttpsError

assert os.environ.get("GCLOUD_PROJECT") == "demo-gowild", "Emulator checks must use the demo project."
assert os.environ.get("FIRESTORE_EMULATOR_HOST") and os.environ.get("FIREBASE_AUTH_EMULATOR_HOST"), "Start through firebase emulators:exec."
db = Client(project="demo-gowild", credentials=AnonymousCredentials())
base = "http://127.0.0.1:5001/demo-gowild/europe-west1/"
auth_base = "http://" + os.environ["FIREBASE_AUTH_EMULATOR_HOST"] + "/identitytoolkit.googleapis.com/v1/"


def account():
    response = httpx.post(auth_base + "accounts:signUp?key=demo-key", json={"email": f"test-{uuid.uuid4()}@example.com", "password": "TestPassword123!", "returnSecureToken": True})
    response.raise_for_status()
    return response.json()


def call(name, data=None, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return httpx.post(base + name, json={"data": data or {}}, headers=headers, timeout=60)


alice, bob = account(), account()
uid, token = alice["localId"], alice["idToken"]
assert call("testConnection").status_code == 401
assert call("testConnection", token="invalid").status_code == 401
response = call("testConnection", {"uid": bob["localId"]}, token)
assert response.status_code == 200, response.text
result = response.json()["result"]
assert result["success"] and result["uid"] == uid
assert db.document(result["documentPath"]).get().to_dict()["uid"] == uid
assert not db.collection("connection_tests").document(bob["localId"]).get().exists
assert call("getProfile").status_code == 401
profile = call("getProfile", token=token).json()["result"]["user"]
assert profile["id"] == uid
assert call("updateProfile", {"patch": {"preferredCurrency": "MAD"}}, token).status_code == 200
assert call("getProfile", token=token).json()["result"]["user"]["preferredCurrency"] == "MAD"
assert call("updateProfile", {"patch": {"id": bob["localId"]}}, token).status_code == 400
assert call("setFavorite", {"hotelId": "hotel/123", "saved": True}, token).status_code == 200
assert call("getFavorites", token=token).json()["result"]["hotelIds"] == ["hotel/123"]
assert call("getFavorites", token=bob["idToken"]).json()["result"]["hotelIds"] == []
# Firestore rules reject direct SDK/REST access even with a valid Firebase user token.
url = "http://" + os.environ["FIRESTORE_EMULATOR_HOST"] + f"/v1/projects/demo-gowild/databases/(default)/documents/connection_tests/{uid}"
assert httpx.get(url, headers={"Authorization": f"Bearer {token}"}).status_code == 403
assert httpx.patch(url, headers={"Authorization": f"Bearer {token}"}, json={"fields": {"uid": {"stringValue": uid}}}).status_code == 403

# Verify a durable atomic booking claim through real Firestore transactions.
store = Store(db, uid)
context = {"hotelId": "hotel_1", "offerId": "offer_1", "checkIn": "2027-12-10", "checkOut": "2027-12-13", "occupancy": {"rooms": 1, "adults": 2, "childrenAges": []}, "currency": "USD"}
quote_id = str(uuid.uuid4())
store.save("quotes", quote_id, {"provider": "liteapi", "context": context, "public": {"expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()}})
payload = {**context, "quoteId": quote_id}
key = str(uuid.uuid4())


def claim():
    try:
        return Store(db, uid).claim_booking(key, payload, "liteapi")
    except HttpsError as error:
        return error.code.value


with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
    claims = list(executor.map(lambda _: claim(), range(2)))
assert claims.count(None) == 1 and claims.count("aborted") == 1, claims
try:
    Store(db, uid).claim_booking(str(uuid.uuid4()), payload, "liteapi")
    raise AssertionError("A second key must not reuse the quote.")
except HttpsError:
    pass
booking = {"id": "bk_1", "providerId": "liteapi", "idempotencyKey": key, "createdAt": "2026-11-05", "status": "pending"}
store.record_booking(key, booking)
assert Store(db, uid).claim_booking(key, payload, "liteapi") == booking
try:
    store.claim_booking(key, {**payload, "currency": "EUR"}, "liteapi")
    raise AssertionError("Changed retry payload must fail.")
except HttpsError:
    pass
try:
    Store(db, bob["localId"]).booking("bk_1")
    raise AssertionError("Another user cannot access this booking.")
except HttpsError:
    pass
assert call("listBookings", token=token).json()["result"]["bookings"][0]["id"] == "bk_1"
# Full domain flow through the exact Python service + adapters, with real Firestore
# and explicitly mocked supplier HTTP. No external reservation is created.
from gowild.providers import Supplier
from gowild.service import Service
future = datetime.now(timezone.utc).date() + timedelta(days=30)
flow_context = {"checkIn": future.isoformat(), "checkOut": (future + timedelta(days=3)).isoformat(), "occupancy": {"rooms": 1, "adults": 2, "childrenAges": []}, "currency": "USD"}
rate = {"offerId": "flow_offer", "rates": [{"rateId": "flow_rate", "name": "Sandbox room", "retailRate": {"total": [{"amount": 330, "currency": "USD"}], "taxesAndFees": [{"amount": 30, "included": True}]}, "cancellationPolicies": {"refundableTag": "RFN"}}]}
provider_state = {"status": "CONFIRMED", "book_calls": 0}


def fixture_transport(method, path, body):
    if path.startswith("/data/hotels?"):
        return {"data": [{"id": "flow_hotel", "name": "Sandbox Hotel", "city": "Paris", "country": "France", "latitude": 48.85, "longitude": 2.35, "hotelImages": [{"url": "https://example.com/hotel.jpg"}]}]}
    if path == "/hotels/rates":
        return {"data": [{"hotelId": "flow_hotel", "roomTypes": [rate]}]}
    if path == "/rates/prebook":
        return {"data": {"prebookId": "private_prebook", "roomTypes": [rate]}}
    if path == "/rates/book":
        provider_state["book_calls"] += 1
        return {"data": {"bookingId": "supplier_booking", "status": "CONFIRMED", "hotelConfirmationCode": "SANDBOX123"}}
    if path == "/bookings/supplier_booking":
        if method == "PUT":
            provider_state["status"] = "CANCELLED"
        return {"data": {"bookingId": "supplier_booking", "status": provider_state["status"]}}
    raise AssertionError(f"Unexpected supplier fixture request: {method} {path}")


supplier = Supplier("liteapi", "sand_explicit_fixture", fixture_transport)
service = Service(Store(db, uid), supplier)
search_result = service.dispatch("search", {"query": flow_context})
assert search_result["hotels"][0]["lowestNightlyPrice"]["amount"] == 110
assert service.dispatch("offers", {"hotelId": "flow_hotel", **flow_context})["offers"][0]["offerId"] == "flow_offer"
revalidated = service.dispatch("revalidate", {"hotelId": "flow_hotel", "offerId": "flow_offer", **flow_context})["revalidated"]
assert revalidated["quoteId"] != "private_prebook"
flow_payload = {**flow_context, "hotelId": "flow_hotel", "offerId": "flow_offer", "quoteId": revalidated["quoteId"], "leadGuest": {"firstName": "Test", "lastName": "Traveler", "email": alice["email"], "phone": "+212600112233"}, "acceptedPolicies": True}
flow_key = str(uuid.uuid4())
try:
    service.dispatch("book", {"idempotencyKey": flow_key, "input": {**flow_payload, "currency": "EUR"}})
    raise AssertionError("Changed quote context must be rejected before supplier booking.")
except HttpsError:
    pass
receipt = service.dispatch("book", {"idempotencyKey": flow_key, "input": flow_payload})
assert receipt["booking"]["status"] == "confirmed" and receipt["booking"]["isSandbox"]
assert provider_state["book_calls"] == 1
retry = Service(Store(db, uid), supplier).dispatch("book", {"idempotencyKey": flow_key, "input": flow_payload})
assert retry["deduplicated"] and retry["booking"]["id"] == receipt["booking"]["id"]
assert provider_state["book_calls"] == 1
try:
    Service(Store(db, bob["localId"]), supplier).dispatch("booking", {"bookingId": receipt["booking"]["id"]})
    raise AssertionError("Another user must not retrieve a reservation.")
except HttpsError:
    pass
cancelled = service.dispatch("cancel", {"bookingId": receipt["booking"]["id"]})
assert cancelled["booking"]["status"] == "cancelled"
assert service.dispatch("booking", {"bookingId": receipt["booking"]["id"]})["booking"]["status"] == "cancelled"
assert Store(db, uid).claim_booking(flow_key, flow_payload, "liteapi")["status"] == "cancelled"
print("PASS: sandbox search → offers → revalidation → booking → exact retry → verified cancellation, using real Firestore and mocked supplier HTTP.")

# Exercise Firebase JS Auth + httpsCallable, not just hand-written protocol requests.
js_env = {**os.environ, "EXPO_PUBLIC_FIREBASE_API_KEY": "demo-key", "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN": "demo-gowild.firebaseapp.com", "EXPO_PUBLIC_FIREBASE_PROJECT_ID": "demo-gowild", "EXPO_PUBLIC_FIREBASE_APP_ID": "demo-app-id", "EXPO_PUBLIC_USE_FIREBASE_EMULATORS": "true", "EXPO_PUBLIC_FIREBASE_EMULATOR_HOST": "127.0.0.1", "GOWILD_TEST_EMAIL": alice["email"], "GOWILD_TEST_PASSWORD": "TestPassword123!"}
subprocess.run(["node", "scripts/verify-connection.mjs"], env=js_env, check=True, timeout=45)
print("PASS: authenticated testConnection, UID isolation, profiles, favorites, deny-all rules, durable booking claims and ownership.")

# goWild managed architecture

Expo React Native UI → Firebase Auth + Firebase JS `httpsCallable` (`europe-west1`) → Python Firebase Functions v2 → private Firestore / sandbox supplier APIs. No standalone Node/Express server, Expo REST proxy, embedded fallback, or manual Cloud Run deployment remains.

## Frontend boundaries

Existing feature modules, route bindings, visual components, navigation and maps are preserved. `src/services/firebase` initializes the public Firebase app, persistent Auth SDK and Functions SDK. `src/services/http/apiClient.ts` preserves the typed `goWildApi` facade for existing hooks, but uses authenticated callable requests. Firebase owns credential persistence and token refresh; Zustand only caches the user profile and an in-memory sign-in indicator. No direct Firestore client SDK is imported.

## Managed backend

`functions/main.py` defines authenticated callable entry points. `testConnection` authenticates before writing `connection_tests/{uid}` and binds no secrets. User-data callables create/update profiles, favorites, reservation lists and derived notifications. `liteApi` and `duffelApi` dispatch validated hotel/reservation operations; each binds only its own Secret Manager parameter. All functions deploy to `europe-west1`.

`functions/gowild/models.py` validates requests; `store.py` scopes domain documents to `users/{uid}`; `providers.py` implements fixed-URL sandbox supplier HTTP calls; `service.py` owns domain orchestration. Managed runtime credentials provide Admin access. Anonymous DB transport is used only inside the local Functions/Firestore emulator environment, never instead of callable user authentication.

## Firestore

- `connection_tests/{uid}`: authenticated first-deployment verification.
- `users/{uid}`: traveler profile; no passwords or BFF sessions.
- `users/{uid}/favorites/{hash}`: saved IDs.
- `users/{uid}/hotels/{hash}` and `offers/{hash}`: user/context-bound provider snapshots.
- `users/{uid}/quotes/{hash}`: private supplier quote token, public quote, context and expiry.
- `users/{uid}/booking_requests/{hash}`: request fingerprint, durable submission claim and receipt.
- `users/{uid}/bookings/{hash}`: reservation receipt and cancellation claim.

Rules deny every direct client read/write, even with a Firebase user token. Callable ownership never uses client-supplied UIDs. A Firestore transaction claims both booking key and quote before supplier submission. Supplier writes are not automatically retried; ambiguous outcomes retain their claim for reconciliation. Quotes bind provider, hotel, rate, dates, guests and currency. Only verified supplier confirmation/cancellation sets those states.

## Configuration

Public Firebase/OAuth configuration: `README/FIREBASE_PUBLIC_CONFIG.md`; server secret names: `README/FIREBASE_SECRETS.md`; deploy/verify: `README/FIREBASE_SETUP.md`. Project `gowild-d3b29`; all supplier operations remain sandbox-only. Old local SQLite files are preserved as backups and are not used or automatically migrated.

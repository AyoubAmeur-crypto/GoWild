# Current callable API contracts

All calls use the Firebase JS Functions SDK in `europe-west1` and require Firebase Authentication. No REST API or BFF session tokens remain. Domain response interfaces in `src/types/domain.ts` remain compatible with existing UI hooks.

| Callable | Request | Response |
| --- | --- | --- |
| testConnection | {} | { success, uid, region, documentPath, checkedAt } |
| getProfile | {} | { user } |
| updateProfile | { patch } | { user } |
| getFavorites | {} | { hotelIds } |
| setFavorite | { hotelId, saved } | { hotelIds } |
| listBookings | {} | { bookings } |
| getNotifications | {} | { notifications } |
| liteApi / duffelApi | { action, ...data } | Provider-independent domain response |

Supplier actions: health, places (LiteAPI only), featured, search ({ query }), detail, offers, revalidate, book ({ input, idempotencyKey }), booking, cancel. The facade retains the original goWildApi method names. Client auth register/login use Firebase Auth directly; functions never receive account passwords.

Request models reject unknown fields, invalid dates/occupancy/currencies and owner injection. All booking quote context must match. HttpsError provides typed callable failures and sanitized app-code details. No raw supplier response, private quote/payment token, credential, or user data is copied into error logs.

Both suppliers are sandbox-only. Production keys are rejected; no live payment function exists. No automatic fixture fallback or currency relabeling is permitted.

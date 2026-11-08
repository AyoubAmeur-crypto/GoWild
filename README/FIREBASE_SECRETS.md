# Server-only secret names

Public app identifiers are documented separately in [FIREBASE_PUBLIC_CONFIG.md](./FIREBASE_PUBLIC_CONFIG.md).

| Secret Manager name | Bound callable | Accepted credential |
| --- | --- | --- |
| `LITEAPI_KEY` | `liteApi` | LiteAPI sandbox key beginning `sand_` |
| `DUFFEL_ACCESS_TOKEN` | `duffelApi` | Duffel test token beginning `duffel_test_` |

Set only the provider you plan to deploy:

```sh
npx --yes --package firebase-tools firebase functions:secrets:set LITEAPI_KEY --project gowild-d3b29
# Or, for Duffel:
npx --yes --package firebase-tools firebase functions:secrets:set DUFFEL_ACCESS_TOKEN --project gowild-d3b29
```

The CLI prompts for the secret value. Each supplier callable binds only its own `SecretParam`; `testConnection` and user-data functions bind neither supplier secret. Do not put these values in `.env.example`, Expo app config, `src/`, `EXPO_PUBLIC_*`, or chat.

For local emulators only, an ignored `functions/.secret.local` can contain the same names. The local checks use clearly marked placeholder values and never contact a supplier. Use actual sandbox credentials only for deliberate supplier verification. This file is never the source of deployed secrets.

Cloud Functions uses its managed runtime identity for Admin SDK access. No downloaded service-account private key or `GOOGLE_APPLICATION_CREDENTIALS` file is required. When rotating a secret, redeploy its bound function to use the new version.

Production supplier keys are rejected in code. No traveler card collection, live payment endpoint, or production booking bypass is exposed. A future production release needs provider approval and verified payment orchestration; changing an environment flag alone cannot enable it.

# Verification — managed Firebase backend

## Local prerequisites

Install npm dependencies, then `python3.12 -m venv functions/venv` and `functions/venv/bin/pip install -r functions/requirements.txt`. Emulator checks also need Java 21+.

## Required gate

- `npm run typecheck`: frontend and shared/frontend test TypeScript.
- `npm test`: Node frontend pricing/filter/form tests + Python Functions backend tests.
- `npm run test:emulators`: Auth, Firestore and Python callable Functions in the safe demo-gowild project. Uses real callable auth, SDK transport and database rules; supplier HTTP is explicitly mocked.
- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios --output-dir /tmp/gowild-ios-check` and Android equivalent. Web export verifies shared Auth/Functions initialization and existing Leaflet bundle.

`functions/tests/test_backend.py` tests auth-before-DB, verified UID ownership, region/v2/secret bindings, credential sandbox enforcement, stay validation, currency correctness, sandbox booking confirmation and cancellation verification. `functions/tests/emulator_check.py` exercises callable Auth boundaries, profiles/favorites, deny-all direct Firestore rules, concurrent durable claims and full sandbox service lifecycle, then runs the Firebase JavaScript SDK verification script.

## Hosted verification

Deploy testConnection first using README/FIREBASE_SETUP.md, then run `npm run firebase:test-connection` with an existing test account supplied via environment variables. No service-account key is required. Supplier sandbox and native OAuth/device verification require external project credentials and remain separate from local automated proof.

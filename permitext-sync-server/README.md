# Permitext Sync Server

Local Phase 5 backend scaffold for the iOS app's account and sync contract.

It now supports two runtime shapes:

- local Node server for development and smoke testing
- Vercel Function deployment for hosted testing
- Neon Postgres persistence when Vercel provides a database URL

## Run

```sh
node server.mjs
```

Defaults:

- URL: `http://localhost:8787`
- Data file: `data/sync-store.json` when no database URL is configured

Override with:

```sh
PORT=8787 PERMITEXT_SYNC_DATA_PATH=/tmp/permitext-sync-store.json node server.mjs
```

Enable internal lifetime grant admin routes with:

```sh
PERMITEXT_SYNC_ADMIN_TOKEN=dev-secret node server.mjs
```

Apple sign-in requests may include the identity token issued by Sign in with Apple. When a token is present, the server verifies the Apple signature, issuer, expiration, subject, and configured audience. Every Vercel deployment requires a valid identity token automatically. Local development can opt into the same policy with `PERMITEXT_REQUIRE_APPLE_IDENTITY_TOKEN=1`:

```sh
APPLE_BUNDLE_ID=com.randycodex.permitext \
APPLE_SERVICE_ID=com.example.permitext.web \
APPLE_ALLOWED_CLIENT_IDS=com.example.extra.client \
PERMITEXT_REQUIRE_APPLE_IDENTITY_TOKEN=1 \
node server.mjs
```

The web app uses Sign in with Apple JS when `APPLE_SERVICE_ID` is configured. In Apple Developer, the Service ID must allow the production domain and return URL:

```text
Domain: permitext-sync.vercel.app
Return URL: https://permitext-sync.vercel.app/account/apple/callback
```

Without `APPLE_SERVICE_ID`, production web sign-in is disabled instead of creating a browser-only account that cannot match iOS. Localhost can still use the browser-local fallback for development, or set `PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN=1` to allow it explicitly.

If a browser already has a temporary `web:` account from the earlier checkout flow, the web app can link it during Apple sign-in. The backend retargets saved records to the new `apple:` account, transfers the server-owned entitlement, and invalidates the old browser session.

Passkey registration and sign-in are disabled until the backend implements a complete server-challenge WebAuthn verification ceremony. Existing passkey records remain readable only for administrative cleanup and account export. Older clients receive HTTP `410` from passkey registration and sign-in attempts.

Hosted account sessions are multi-device and store only a SHA-256 token hash. Each sign-in creates a distinct session with a 30-day default expiry; `PERMITEXT_SESSION_TTL_SECONDS` can set a different duration of at least one hour. Existing plaintext sessions are migrated to the hashed table on successful use and removed from the legacy session table. `POST /account/sign-out` revokes only the current device session.

The HTTP perimeter rejects request bodies larger than 1 MiB by default. `PERMITEXT_MAX_REQUEST_BODY_BYTES` can set a limit from 64 KiB through 10 MiB. HTML responses use a Content Security Policy, Apple callback scripts use a per-response nonce, and all responses include baseline anti-framing, MIME-sniffing, referrer, and browser-permission headers.

Sensitive write routes also have in-process burst limits and return HTTP `429` with `Retry-After`. These limits protect an individual Node/Vercel instance; production must also use Vercel Firewall rate limiting for enforcement shared across serverless instances.

The web workspace stores signed-in mutations in a durable browser outbox before sending them. Entries are coalesced by account and record, replay on reload, reconnect, or tab foregrounding, and retry transient failures with bounded exponential delay. Server-newer records move to a separate conflict list instead of retrying forever. Settings shows waiting/conflict counts and requires an explicit **Use server** or **Keep mine** choice for conflicts. Note and tag edits enter the outbox before their network debounce begins.

After the web workspace has a full baseline, later pulls send the server event cursor and merge only records changed since that cursor. Reloads still begin with a full pull, and a content-map version change forces a full replacement so canonical section-ID repairs cannot be hidden by an old checkpoint.

Configure paid entitlement sources with:

```sh
STRIPE_SECRET_KEY=sk_live_... \
STRIPE_PRO_PRICE_ID=price_... \
STRIPE_WEBHOOK_SECRET=whsec_... \
STOREKIT_PRO_PRODUCT_ID=com.randycodex.permitext.pro.monthly \
APPLE_BUNDLE_ID=com.randycodex.permitext \
APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS=... \
PERMITEXT_REQUIRE_APPLE_TRANSACTION_ROOT_PIN=1 \
PERMITEXT_PUBLIC_BASE_URL=https://permitext-sync.vercel.app \
node server.mjs
```

Stripe Checkout only creates the web checkout session. Web Pro access is granted or revoked by signed Stripe webhook events. Apple Pro access is granted only after the iOS app sends Apple's signed StoreKit transaction JWS to the backend.

## Deploy To Vercel

This folder is Vercel-ready.

- Root Directory: `permitext-sync-server`
- Preset: `Other`
- Entrypoint: `api/index.mjs`
- Routing: `vercel.json` rewrites clean paths like `/account/sign-in` to the Vercel function

When a Neon database is connected through Vercel, the server uses the first available database URL from:

- `PERMITEXT_SYNC_DATABASE_URL`
- `DATABASE_URL`
- `STORAGE_URL`
- `POSTGRES_URL`
- `NEON_DATABASE_URL`

The Neon schema is created automatically on first request. The current Postgres schema is `normalized-v3`:

- `permitext_users`
- `permitext_entitlements`
- `permitext_sessions`
- `permitext_account_sessions`
- `permitext_passkey_credentials`
- `permitext_saved_items`
- `permitext_annotations`
- `permitext_projects`
- `permitext_project_items`
- `permitext_comments`
- `permitext_sync_events`
- `permitext_user_content_records`
- `permitext_sync_state`

`permitext_user_content_records` and `permitext_sync_state` remain as compatibility mirrors for the existing iOS/web mutation contract. New saved sections, paragraph notes/tags, projects, and project membership are also written into first-class relational tables so the backend can scale past the prototype JSON shape. Local development still falls back to the JSON file store if no database URL is present.

On Postgres, `sync/push` and `sync/pull` use a direct per-user repository instead of reading and rewriting the global store. A push applies conditional row upserts and sync-event inserts in one Neon HTTP transaction; a pull reads only that user's canonical records. Account sessions, profiles, checkout authentication, verified payment entitlements, lifetime grants, and legacy passkey cleanup also use targeted or transactional rows. The JSON file adapter intentionally keeps the simpler whole-file behavior for local smoke testing. Hosted legacy-account merge/repair requests fail safely without changing data until a fully transactional cross-account migration is implemented and verified against Postgres.

## Endpoints

- `GET /health`
- `GET /.well-known/apple-app-site-association`
- `POST /account/sign-in`
- `POST /account/sign-out`
- `POST /account/attach-local-data`
- `POST /account/profile`
- `POST /sync/push`
- `POST /sync/pull`
- `POST /billing/web/checkout`
- `POST /billing/stripe/webhook`
- `POST /billing/apple/transactions/verify`
- `POST /admin/lifetime-grants/grant`
- `POST /admin/lifetime-grants/revoke`
- `POST /admin/accounts/delete-legacy-passkey-users`
- `POST /admin/accounts/restore-checklist`
- `GET /admin/storage/summary`

Admin routes require:

```http
Authorization: Bearer <PERMITEXT_SYNC_ADMIN_TOKEN>
```

Storage summary verifies which persistence layer is live and returns table counts plus the latest sync event cursor:

```sh
curl https://permitext-sync.vercel.app/admin/storage/summary \
  -H "Authorization: Bearer $PERMITEXT_SYNC_ADMIN_TOKEN"
```

Postgres integration verification runs only when a database URL is configured. It starts a local server against that database, writes a synthetic account, checks normalized tables and event-cursor pull behavior, then cleans up the synthetic rows:

```sh
PERMITEXT_SYNC_DATABASE_URL="$DATABASE_URL" npm run verify:postgres
```

## Sync Cursor

`POST /sync/push` returns both the accepted/rejected mutation IDs and the latest server event cursor:

```json
{
  "acceptedMutationIDs": [],
  "rejectedMutationIDs": [],
  "latestEventID": 123,
  "syncRevision": 123,
  "entitlement": null,
  "serverTime": "2026-06-27T00:00:00.000Z"
}
```

Entitlements are server-owned. Sync batches can include local user content mutations, but any client-provided `batch.entitlement` value is ignored; paid access should be written only by verified Apple/web payment handlers or admin grant routes.

Each sync push is limited to 100 mutations so one request cannot create an unbounded database transaction. Current iOS automatic sync batches are smaller than this limit.

`POST /sync/pull` still accepts the original timestamp `since` field, but hosted Postgres deployments can also use the event cursor:

```json
{
  "auth": { "accountUserID": "apple:USER" },
  "sinceEventID": 123,
  "contentMapVersion": 2
}
```

The response includes `latestEventID`/`syncRevision`, `contentMapVersion`, and the current mutations affected after that cursor. The server honors an event cursor only when the client content-map version matches its canonical section-map schema; older clients receive the full canonical state so identifier repairs are not hidden. File-backed local development returns `0` for the cursor and keeps the timestamp-compatible behavior.

Legacy passkey cleanup removes only accounts whose stored user ID starts with `passkey:`. It exists to clean records created before unlinked passkey sign-in was blocked:

```sh
curl -X POST https://permitext-sync.vercel.app/admin/accounts/delete-legacy-passkey-users \
  -H "Authorization: Bearer $PERMITEXT_SYNC_ADMIN_TOKEN"
```

Restore checklist summarizes account restore readiness for one user:

```sh
curl -X POST https://permitext-sync.vercel.app/admin/accounts/restore-checklist \
  -H "Authorization: Bearer $PERMITEXT_SYNC_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userID":"apple:YOUR_APPLE_USER_ID"}'
```

Production identity restore can be tested with:

```sh
PERMITEXT_RUN_PRODUCTION_IDENTITY_RESTORE=1 \
PERMITEXT_PRODUCTION_TEST_USER="$APPLE_USER_ID" \
PERMITEXT_PRODUCTION_TEST_APPLE_IDENTITY_TOKEN="$APPLE_IDENTITY_TOKEN" \
npm run verify:production:identity
```

That test requires a current Sign in with Apple identity token and writes one stable smoke account to the configured production backend.

Local mode remains intentionally simple and file-backed for integration testing. Hosted mode is intended to run on Vercel with Neon Postgres for durable storage.

## iOS Local HTTP Mode

In a DEBUG build, point the app at this server with:

```swift
PermitextBackendConfiguration.setDebugHTTPBaseURL("http://localhost:8787")
```

For a physical iPhone, replace `localhost` with the Mac's LAN IP address.

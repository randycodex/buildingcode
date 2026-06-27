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

Configure passkey web credentials metadata with:

```sh
APPLE_TEAM_ID=YOURTEAMID APPLE_BUNDLE_ID=com.randycodex.permitext node server.mjs
```

Apple sign-in requests may include the identity token issued by Sign in with Apple. When a token is present, the server verifies the Apple signature, issuer, expiration, subject, and configured audience. Set `PERMITEXT_REQUIRE_APPLE_IDENTITY_TOKEN=1` after production Apple client IDs are configured to reject tokenless Apple sign-ins:

```sh
APPLE_BUNDLE_ID=com.randycodex.permitext \
APPLE_SERVICE_ID=com.example.permitext.web \
APPLE_ALLOWED_CLIENT_IDS=com.example.extra.client \
PERMITEXT_REQUIRE_APPLE_IDENTITY_TOKEN=1 \
node server.mjs
```

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

The Neon schema is created automatically on first request. The current Postgres schema is `normalized-v2`:

- `permitext_users`
- `permitext_entitlements`
- `permitext_sessions`
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

## Endpoints

- `GET /health`
- `GET /.well-known/apple-app-site-association`
- `POST /account/sign-in`
- `POST /account/attach-local-data`
- `POST /account/profile`
- `POST /sync/push`
- `POST /sync/pull`
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

`POST /sync/pull` still accepts the original timestamp `since` field, but hosted Postgres deployments can also use the event cursor:

```json
{
  "auth": { "accountUserID": "apple:USER" },
  "sinceEventID": 123
}
```

The response includes `latestEventID`/`syncRevision` and the mutations after that cursor. File-backed local development returns `0` for the cursor and keeps the timestamp-compatible behavior.

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
PERMITEXT_RUN_PRODUCTION_IDENTITY_RESTORE=1 npm run verify:production:identity
```

That test writes one stable synthetic smoke account to the configured production backend.

Local mode remains intentionally simple and file-backed for integration testing. Hosted mode is intended to run on Vercel with Neon Postgres for durable storage.

## iOS Local HTTP Mode

In a DEBUG build, point the app at this server with:

```swift
PermitextBackendConfiguration.setDebugHTTPBaseURL("http://localhost:8787")
```

For a physical iPhone, replace `localhost` with the Mac's LAN IP address.

For production passkeys, the app also needs the Associated Domains entitlement:

```text
webcredentials:your-domain.com
```

That domain must serve the same Apple App Site Association payload over HTTPS at:

```text
https://your-domain.com/.well-known/apple-app-site-association
```

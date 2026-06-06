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

The `permitext_sync_state` table is created automatically on first request. Local development still falls back to the JSON file store if no database URL is present.

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

Admin routes require:

```http
Authorization: Bearer <PERMITEXT_SYNC_ADMIN_TOKEN>
```

Legacy passkey cleanup removes only accounts whose stored user ID starts with `passkey:`. It exists to clean records created before unlinked passkey sign-in was blocked:

```sh
curl -X POST https://permitext-sync.vercel.app/admin/accounts/delete-legacy-passkey-users \
  -H "Authorization: Bearer $PERMITEXT_SYNC_ADMIN_TOKEN"
```

Production identity restore can be tested with:

```sh
PERMITEXT_RUN_PRODUCTION_IDENTITY_RESTORE=1 npm run verify:production:identity
```

That test writes one stable synthetic smoke account to the configured production backend.

This is intentionally simple and file-backed. It is for local integration testing before choosing production hosting, auth verification, and durable storage.

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

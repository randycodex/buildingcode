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

Verify the deployed backend is reachable and using durable storage:

```sh
npm run verify:production
```

Override the target URL when needed:

```sh
PERMITEXT_SYNC_PRODUCTION_URL=https://your-deployment.vercel.app npm run verify:production
```

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

Admin routes require:

```http
Authorization: Bearer <PERMITEXT_SYNC_ADMIN_TOKEN>
```

The local development path is intentionally simple and file-backed. Hosted testing should use the Neon-backed Postgres adapter.

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

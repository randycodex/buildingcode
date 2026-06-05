# Permitext Sync Server

Local Phase 5 backend scaffold for the iOS app's account and sync contract.

## Run

```sh
node server.mjs
```

Defaults:

- URL: `http://localhost:8787`
- Data file: `data/sync-store.json`

Override with:

```sh
PORT=8787 PERMITEXT_SYNC_DATA_PATH=/tmp/permitext-sync-store.json node server.mjs
```

Enable internal lifetime grant admin routes with:

```sh
PERMITEXT_SYNC_ADMIN_TOKEN=dev-secret node server.mjs
```

## Endpoints

- `GET /health`
- `POST /account/sign-in`
- `POST /account/attach-local-data`
- `POST /sync/push`
- `POST /sync/pull`
- `POST /admin/lifetime-grants/grant`
- `POST /admin/lifetime-grants/revoke`

Admin routes require:

```http
Authorization: Bearer <PERMITEXT_SYNC_ADMIN_TOKEN>
```

This is intentionally simple and file-backed. It is for local integration testing before choosing production hosting, auth verification, and durable storage.

## iOS Local HTTP Mode

In a DEBUG build, point the app at this server with:

```swift
PermitextBackendConfiguration.setDebugHTTPBaseURL("http://localhost:8787")
```

For a physical iPhone, replace `localhost` with the Mac's LAN IP address.

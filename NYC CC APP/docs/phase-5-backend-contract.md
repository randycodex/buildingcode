# Phase 5 Backend Contract

This contract captures the backend surface expected by the Permitext iOS app during Phase 5. The app keeps SQLite as the fast offline cache, but signed-in users sync through these endpoints.

## Backend Mode

The iOS app defaults to the local development backend.

- `permitext.backend.mode`: `localDev` or `http`
- `permitext.backend.apiBaseURL`: runtime override for the HTTP base URL
- `PermitextBackendAPIBaseURL`: optional Info.plist fallback for the HTTP base URL

When mode is `http`, the app posts JSON to the paths below under the configured base URL. Dates are ISO 8601.

Backend source:

- Path: `permitext-sync-server`
- Local default URL: `http://localhost:8787`
- Local storage: JSON file for integration testing only

Hosted production:

- URL: `https://permitext-sync.vercel.app`
- Storage: Neon/Postgres when a database URL is configured
- Health check: `GET /health` returns the active storage kind

Production storage plan:
- `docs/phase-5-production-storage.md`

## Account

### `POST /account/sign-in`

Request:

```json
{
  "credential": {
    "provider": "apple",
    "providerUserID": "apple-user-id",
    "displayName": "Optional Name",
    "signedInAt": "2026-06-04T00:00:00Z"
  }
}
```

Response:

```json
{
  "account": {
    "appUserID": "stable-backend-user-id",
    "authProvider": "apple",
    "authProviderUserID": "apple-user-id",
    "appleUserID": "apple-user-id",
    "publicUsername": null,
    "displayName": "Optional Name",
    "signedInAt": "2026-06-04T00:00:00Z",
    "migrationState": "notStarted",
    "backendSessionToken": "opaque-session-token"
  },
  "entitlement": null
}
```

The backend owns `appUserID`. Login identity and public identity must stay separate.

`backendSessionToken` is an opaque bearer token returned only to the client. The app persists it in Keychain rather than in the account metadata stored in `UserDefaults`. Postgres stores only its SHA-256 hash in `permitext_account_sessions`; sessions are device-specific, expire after 30 days by default, and can be individually revoked. Existing plaintext sessions migrate to the hashed table on successful use.

### `POST /account/sign-out`

The authenticated request revokes only the supplied session token. Other signed-in devices remain connected.

Passkey support is disabled. `credential.provider = "passkey"` and `POST /account/passkeys/link` return HTTP `410` until the backend implements server-issued challenges and complete WebAuthn registration/assertion verification. Existing passkey storage remains only for administrative cleanup and export compatibility.

The local scaffold serves:

- `GET /.well-known/apple-app-site-association`

Configure it with:

- `APPLE_TEAM_ID`
- `APPLE_BUNDLE_ID`

Future passkey requirements:

- The public API domain must use HTTPS.
- The iOS target needs `com.apple.developer.associated-domains`.
- The entitlement must include `webcredentials:<domain>`.
- The same domain must serve the Apple App Site Association file at `/.well-known/apple-app-site-association`.

### `POST /account/attach-local-data`

Request:

```json
{
  "account": {
    "appUserID": "stable-backend-user-id",
    "authProvider": "apple",
    "authProviderUserID": "apple-user-id",
    "appleUserID": "apple-user-id",
    "publicUsername": null,
    "displayName": "Optional Name",
    "signedInAt": "2026-06-04T00:00:00Z",
    "migrationState": "notStarted",
    "backendSessionToken": "opaque-session-token"
  }
}
```

Response:

```json
"localDataAttached"
```

The first sign-in must attach local data without destructive replacement.

### `POST /account/profile`

Request:

```json
{
  "auth": {
    "accountUserID": "stable-backend-user-id",
    "bearerToken": "opaque-session-token"
  },
  "publicUsername": "optional-public-handle",
  "displayName": "Optional Name"
}
```

Response:

```json
{
  "account": {
    "appUserID": "stable-backend-user-id",
    "publicUsername": "optional-public-handle"
  }
}
```

The backend owns public username uniqueness. Public username remains separate from Apple or passkey login identity.

## Sync

All sync endpoints include bearer auth when available:

```http
Authorization: Bearer <token>
```

The local scaffold requires this bearer token after a user has signed in.

The backend rejects bodies larger than 1 MiB by default and returns HTTP `413`. Sensitive write endpoints may return HTTP `429` with a `Retry-After` header when a client exceeds the burst limit.

### `POST /sync/push`

Request:

```json
{
  "auth": {
    "accountUserID": "stable-backend-user-id",
    "bearerToken": null
  },
  "batch": {
    "user": {
      "id": "stable-backend-user-id",
      "authProvider": "apple",
      "authProviderUserID": "apple-user-id",
      "publicUsername": null,
      "displayName": "Optional Name",
      "updatedAt": "2026-06-04T00:00:00Z"
    },
    "entitlement": null,
    "mutations": []
  }
}
```

Response:

```json
{
  "acceptedMutationIDs": [],
  "rejectedMutationIDs": [],
  "serverTime": "2026-06-04T00:00:00Z"
}
```

`acceptedMutationIDs` confirms which local queue items can be marked synced.
`rejectedMutationIDs` confirms which local queue items must stay unresolved because the server has newer data or refused the write.

The iPhone queue recovers claims left `inFlight` for more than ten minutes and automatically retries transient failures with exponential delays from 5 through 40 seconds. After five failed attempts an item remains visible as failed until the user explicitly retries, preventing an unbounded retry loop.

Queue lifecycle time and mutation version time are stored separately. Claiming, failing, or retrying a request never makes unchanged content appear newer. Once the server accepts a queue item, the matching local bookmark, annotation, project, or project membership is marked synced in the same SQLite transaction.

Server-newer rejections appear in iPhone Settings as explicit conflicts. **Use server** applies the current remote mutation and resolves the failed queue item. **Keep mine** deliberately assigns a new mutation version before uploading the local copy. A generic retry never changes mutation precedence.

Supported mutation kinds:

- `savedItem`: bookmarked/saved sections
- `annotation`: notes and tags
- `project`: project folders
- `projectSection`: project membership
- `continuity`: selected jurisdiction/version/section, active project, comparison mode, recently viewed sections
- `codeVersionClear`: destructive local clear actions by scope

Backend validation rules:

- A push contains at most 100 mutations.
- Each mutation must be a single-key object.
- `auth.accountUserID` and `batch.user.id` must match.
- The mutation kind must be one of the supported kinds above.
- `record.userID` must match the authenticated `accountUserID`.
- Every mutation must expose a stable record ID.
- Every mutation must include a valid `updatedAt` timestamp.
- Incoming mutations older than the stored server record must be rejected, not silently accepted.

Swift encodes each mutation as a single-key object:

```json
{ "savedItem": { "id": "user:saved:version:section", "userID": "stable-backend-user-id" } }
```

### `POST /sync/pull`

Request:

```json
{
  "auth": {
    "accountUserID": "stable-backend-user-id",
    "bearerToken": null
  },
  "since": "2026-06-04T00:00:00Z",
  "sinceEventID": 123,
  "contentMapVersion": 2
}
```

Response:

```json
{
  "userID": "stable-backend-user-id",
  "pulledAt": "2026-06-04T00:00:00Z",
  "latestEventID": 123,
  "contentMapVersion": 2,
  "mutations": []
}
```

Hosted Postgres pulls honor `sinceEventID` only when `contentMapVersion` matches the canonical section-ID map. A missing or stale map version receives the full canonical state so server-side identifier repairs are not hidden behind an event checkpoint.

The app applies only safe server changes. Local pending edits are protected and reported as conflicts instead of being overwritten. Preview-only pulls and pulls with skipped or conflicted remote records must not advance the local pull checkpoint, otherwise unapplied server records could be hidden from later sync runs.

When a pull includes a `projectSection` mutation, the backend should also include the parent `project` mutation when it can resolve one, even if the parent project is older than the requested `since` checkpoint. Fresh installs need the folder record before they can apply project membership safely.

When a safe pull includes a newer `continuity` mutation, the app writes it into `ContinuityStore` and refreshes the in-memory view model so recent sections, selected code/version, active project, and comparison mode can restore immediately after sign-in or reinstall.

## Internal Lifetime Grants

The local scaffold exposes internal admin routes when `PERMITEXT_SYNC_ADMIN_TOKEN` is set:

- `POST /admin/lifetime-grants/grant`
- `POST /admin/lifetime-grants/revoke`
- `POST /admin/accounts/delete-legacy-passkey-users`
- `POST /admin/accounts/restore-checklist`
- `POST /admin/accounts/export`

Request:

```json
{ "userID": "stable-backend-user-id" }
```

Required header:

```http
Authorization: Bearer <PERMITEXT_SYNC_ADMIN_TOKEN>
```

Legacy passkey cleanup removes only users whose stored `appUserID` starts with `passkey:`. It is for records created before unlinked passkey sign-in was blocked.

Restore checklist returns profile, entitlement, session, passkey, and synced mutation counts for one user. Use it to verify a reinstall/passkey restore path without querying storage directly.

Account export returns the exact stored account, entitlement, passkey credential IDs, session presence, and mutation list for one user. Use it only for internal debugging when a restore appears incomplete and counts are not enough to identify the missing record.

## Ownership Rules

- Backend owns users, entitlements, lifetime Pro grants, projects, saved items, annotations, and continuity for signed-in users.
- SQLite remains the offline cache and local write path.
- Server state becomes source of truth only after sign-in and safe migration.
- Public username is optional and separate from Apple identity.
- Lifetime grants are entitlement records, not hard-coded client flags.

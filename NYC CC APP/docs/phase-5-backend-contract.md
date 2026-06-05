# Phase 5 Backend Contract

This contract captures the backend surface expected by the Permitext iOS app during Phase 5. The app keeps SQLite as the fast offline cache, but signed-in users sync through these endpoints.

## Backend Mode

The iOS app defaults to the local development backend.

- `permitext.backend.mode`: `localDev` or `http`
- `permitext.backend.apiBaseURL`: runtime override for the HTTP base URL
- `PermitextBackendAPIBaseURL`: optional Info.plist fallback for the HTTP base URL

When mode is `http`, the app posts JSON to the paths below under the configured base URL. Dates are ISO 8601.

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
    "migrationState": "notStarted"
  },
  "entitlement": null
}
```

The backend owns `appUserID`. Login identity and public identity must stay separate.

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
    "migrationState": "notStarted"
  }
}
```

Response:

```json
"localDataAttached"
```

The first sign-in must attach local data without destructive replacement.

## Sync

All sync endpoints include bearer auth when available:

```http
Authorization: Bearer <token>
```

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
  "serverTime": "2026-06-04T00:00:00Z"
}
```

Supported mutation kinds:

- `savedItem`: bookmarked/saved sections
- `annotation`: notes and tags
- `project`: project folders
- `projectSection`: project membership
- `continuity`: selected jurisdiction/version/section, active project, comparison mode, recently viewed sections
- `codeVersionClear`: destructive local clear actions by scope

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
  "since": "2026-06-04T00:00:00Z"
}
```

Response:

```json
{
  "userID": "stable-backend-user-id",
  "pulledAt": "2026-06-04T00:00:00Z",
  "mutations": []
}
```

The app applies only safe server changes. Local pending edits are protected and reported as conflicts instead of being overwritten.

## Ownership Rules

- Backend owns users, entitlements, lifetime Pro grants, projects, saved items, annotations, and continuity for signed-in users.
- SQLite remains the offline cache and local write path.
- Server state becomes source of truth only after sign-in and safe migration.
- Public username is optional and separate from Apple identity.
- Lifetime grants are entitlement records, not hard-coded client flags.

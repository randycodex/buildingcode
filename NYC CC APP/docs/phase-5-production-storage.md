# Phase 5 Production Storage Plan

The local sync server is intentionally file-backed. A production backend should keep the same HTTP contract while moving storage to durable tables with per-user ownership and server-side conflict checks.

## Tables

### `users`

- `id`: stable app user ID, primary key
- `auth_provider`: `apple`, `passkey`, or future provider
- `auth_provider_user_id`: provider-owned user identifier
- `apple_user_id`: optional Apple user identifier
- `public_username`: optional, unique when set
- `display_name`: optional
- `migration_state`: local data migration state
- `created_at`
- `updated_at`

### `entitlements`

- `user_id`: primary key, references `users.id`
- `plan`: `free` or `pro`
- `source`: `storeKit`, `lifetimeGrant`, or `none`
- `granted_user_id`: user ID for internal grants
- `expires_at`: optional
- `updated_at`

### `user_content_records`

- `record_id`: stable sync record ID, primary key
- `user_id`: indexed, references `users.id`
- `entity_kind`: `savedItem`, `annotation`, `project`, `projectSection`, `continuity`, or `codeVersionClear`
- `code_version`: indexed
- `payload`: full JSON mutation payload
- `updated_at`: indexed
- `deleted_at`: optional tombstone
- `server_version`: monotonic integer for optimistic concurrency

### `sync_checkpoints`

- `user_id`
- `device_id`: optional when device identity is added
- `last_pull_at`
- `last_push_at`
- `last_error`
- `updated_at`

## Required Indexes

- `users(auth_provider, auth_provider_user_id)` unique
- `users(public_username)` unique where `public_username` is not null
- `user_content_records(user_id, updated_at)`
- `user_content_records(user_id, code_version, entity_kind)`
- `entitlements(source, granted_user_id)`

## Conflict Rules

- The backend must reject mutations where `record.userID` does not match the authenticated user.
- The backend must reject unknown mutation kinds before writing.
- Last-write-wins is acceptable only when the incoming `updatedAt` is newer than the stored record.
- Deleted records remain as tombstones until every active device has had a chance to pull them.
- Public usernames are never derived from Apple identity.

## Migration Rule

The first successful sign-in attaches local data to the signed-in `appUserID`. The backend should never delete existing local work during this attach step. If the same user already has remote records, the app merges safe server records locally and uploads still-pending local work afterward.

# ADR 005 — Idempotent issuance saga and staged-file recovery

- **Status:** Accepted (Phase 0)
- **Date:** 2026-08-03

## Decision

Issuance is a **server-authorized, idempotent saga**. Blob/object storage cannot join a Postgres transaction; therefore reservation and commit are transactional, while file bytes use deterministic staged keys and recovery.

### Saga steps

1. Authorize, validate dependencies, bind **idempotency key**.
2. **DB transaction:** reserve question-local issue version + pending issuance record (uniqueness constraints).
3. Generate deterministic content/hashes; upload to a **deterministic staged object key** (retry-safe).
4. **DB transaction:** save Manifest v3, issued wrapper, links, activity; mark pending record **issued**.
5. Publish/resolve the deterministic object reference.
6. Retry with the same key, or clean abandoned staged objects via a recovery job.

### Failure invariants

- No visible half-issued record.
- Failed issue returns to clearly **unissued Approved** with durable error and safe retry.
- Exactly one `(questionID, issueVersion)` and one resolvable Manifest/file set per successful issue.
- Supersession creates a new version and marks prior **Superseded**; prior remains readable.

### UI state model

`Draft → Ready for approval → Approved → Issuing → Issued → Superseded`

“Final” / “record locked” styling must not appear before server-confirmed issuance.

## Consequences

- Phase 1 lands pending-issuance state and recovery before enabling Issue UI.
- Tests force failure at each saga boundary (see implementation plan §15.7).

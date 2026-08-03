# ADR 004 — Offline Question transport / outbox

- **Status:** Accepted (Phase 0)
- **Date:** 2026-08-03

## Decision

**Canonical question commands remain server-authorized and idempotent.** Offline support is not “generic Foundation JSON exists locally.”

### Transport design

1. **Local store** (IndexedDB / SQLite): last confirmed Question artifacts + working drafts.
2. **Incremental pull:** extend the shared change feed for Question-artifact pull.
3. **Outbox:** a dedicated **idempotent Question-command outbox**, or an equivalent extension of the existing mutation-kind outbox with the same conflict semantics.
4. The outbox is **transport only**, not a second domain store.
5. **Approval and issuance** require authoritative online server validation. Offline drafts may exist but must remain clearly unissued.

### Explicit non-claims

- Presence of Foundation artifacts in local cache ≠ offline edit support.
- Cold reload, queued replay, `expectedVersion` conflicts, permission loss, and feature-flag rollback with queued commands must be proven before enabling mutation types.

## Consequences

- Phase 1 implements transport behind the disabled capability flag.
- iOS mutation gate is separate from decoder compatibility gate.
- Issuance attempted offline or from stale state is rejected or held as unissued draft.

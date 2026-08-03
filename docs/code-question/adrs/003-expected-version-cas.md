# ADR 003 — Atomic `expectedVersion` compare-and-swap

- **Status:** Accepted (Phase 0)
- **Date:** 2026-08-03

## Decision

All mutable Code Question domain writes use the repository’s existing **optimistic `expectedVersion`** convention with **atomic compare-and-swap inside the storage adapter / database write**, not a handler-level read → check → write race.

### Rules

1. Client/server commands carry `expectedVersion` for the target record.
2. Storage updates succeed only when the stored version equals `expectedVersion`; otherwise return an explicit conflict.
3. Successful writes increment version in the same atomic operation that applies the mutation.
4. Immutable records (`evidenceSnapshotV2`, published conclusion revisions, analysis descriptors, issued wrappers, Manifests) do not use in-place mutation; they create new versions/revisions.
5. Local-first clients must insert **mutation + outbox** atomically before any iOS/web offline mutation capability is enabled for that command type.

## Consequences

- Concurrent Editor/Reviewer edits surface conflicts instead of silent last-write-wins.
- Phase 1 handlers reuse Project Foundation conflict policies (`explicit-revision` vs `immutable`) per artifact kind.
- Tests for Phase 1 must prove concurrent mutations return conflicts.

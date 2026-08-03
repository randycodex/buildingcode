# ADR 006 — Report Draft v2 and Manifest v3 adapters

- **Status:** Accepted (Phase 0)
- **Date:** 2026-08-03

## Decision

Reuse `reportDraft` / `reportManifest` / generated files / hashing. Do **not** invent a parallel editor or mutate stored v1/v2 payloads.

### Draft v2

- Typed draft: `recordType: codeDecisionMemo` with `questionID`.
- Current draft-v1 normalizer strips unknown fields → add **explicit v1→v2 adapters**.
- Never rewrite stored v1 payloads in place.
- Generic advanced Report Draft remains under More.

### Manifest v3

- Adds question snapshot, Evidence Set/snapshot identities, approval, evidence roles/qualifications/applicability, conclusion revision, and issue lineage.
- Retain v1/v2 readers.
- Never mutate stored Manifest v1/v2 payloads.

### Issued wrapper

- Immutable `issuedDecisionRecord` references Manifest v3 + files, component versions/hashes, issue number, Issued/Superseded status, actors, predecessor/successor, supersession reason, and structured semantic manifest for web/iOS parity.

## Consequences

- Phase 1 extends `report-contract.mjs` additively with adapters and tests.
- Old clients preserve-and-ignore unknown records; fixtures prove they do not coerce new fields inside known records.

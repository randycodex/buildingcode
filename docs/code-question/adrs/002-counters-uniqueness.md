# ADR 002 — Dedicated counters and uniqueness

- **Status:** Accepted (Phase 0)
- **Date:** 2026-08-03

## Decision

Allocate sequence numbers with **database uniqueness constraints and transactional counters** (or equivalent compare-and-insert with unique retry). Never allocate by “read max + 1” without a lock.

### Uniqueness scopes

| Sequence | Scope key | Format / meaning |
| --- | --- | --- |
| Question display number | `(projectID, questionNumber)` | `Q-001` style; unique per Project |
| Evidence Set version | `(questionID, evidenceSetVersion)` | Monotonic per question |
| Issued version | `(questionID, issueVersion)` | Monotonic per question; independent of Project report sequence |
| Report / Manifest history | Existing Project/report sequences | Retained where Report Manifest history requires them |

### Implementation choice

- Prefer **dedicated counter rows or serial allocation tables** keyed by the scope above, written inside the same transaction that inserts the versioned record.
- Enforce **UNIQUE** constraints so concurrent writers fail closed and retry with a new value or surface conflict.
- Idempotency keys for create/issue/analysis commands bind to the intended logical operation so retries do not mint duplicate versions.

## Consequences

- Phase 1 storage work must land counters before enabling create/issue handlers.
- Concurrent issue attempts cannot produce two rows with the same `(questionID, issueVersion)`.
- Display ID formatting (`formatQuestionDisplayID`) is pure; uniqueness is storage-only.

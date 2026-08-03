# ADR 001 — Artifact granularity

- **Status:** Accepted (Phase 0)
- **Date:** 2026-08-03

## Decision

Use **first-class Project Foundation artifact kinds** (and explicit child records where needed) for Code Question domain objects, rather than embedding critical structure in undifferentiated Notebook prose or generic JSON bags.

### Artifact kinds

| Kind | Granularity | Notes |
| --- | --- | --- |
| `codeQuestion` | One per professional question | Project-scoped; owns pointers to current revisions, not mutable workflow stage |
| `questionInput` | One record per fact/assumption/unknown | Kind + state + revision lineage; never bury in free prose |
| `evidenceSnapshotV2` | One immutable passage/grid snapshot | Content-hashable; reusable across Evidence Sets |
| `questionEvidenceSet` | Versioned approved set per question | `(questionID, version)`; entries reference snapshots + role/eligibility metadata |
| `questionAnalysis` | Immutable descriptor only | Links to existing Research answer; does not copy generated text |
| `professionalConclusion` | Immutable published revisions | Working draft may autosave separately; approval targets one revision |
| `issuedDecisionRecord` | Immutable wrapper | References Report Manifest v3 + generated files + lineage |

### Relationship style

- **Link, do not duplicate** canonical sources, Research answers, Working Notes, and Workboards.
- Per-user Define/Evidence/Analyze/Review/Issue **stage** is workspace state, not a field on `codeQuestion`.
- Shared readiness/review/approval/issue state lives on the respective versioned records.

## Consequences

- Phase 1 extends `project-foundation-contract` artifact/link target lists additively.
- Migration must not invent a Code Question from ambiguous notes; promotion is explicit.
- Tests assert kinds and normalization in `code-question-contract.mjs`.

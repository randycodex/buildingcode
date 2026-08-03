# Phase 3 notes — Define

## Delivered

- Pure module: `public/code-question-define.js`
  - Definition records with revision + `expectedVersion` CAS
  - Structured inputs: confirmedFact / assumption / unknown (never confusable)
  - Input revision history and change indicators
  - Anchored Fact Requests
  - Dependency fingerprint; marks analysis/conclusion/approval/draft stale on change
  - `deriveDefineReadiness` (unknowns block approval/issuance; does not mutate issue state)
  - Offline mutation queue with conflict reporting (no silent drop)
- UI: Definition pane in flag-gated Code Question shell
- Tests: `tests/code-question-define-contract.mjs`

## Roles

- Owner/Editor: edit
- Viewer/Reviewer: read-only presentation

## Not in Phase 3

- Server hydration of question definitions (local working store in workspace state)
- Evidence / Analyze / Review / Issue column content

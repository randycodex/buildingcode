# Phase 1 notes — contracts, storage, permissions, migrations

## Delivered

- Foundation: Code Question artifact kinds, link targets, membership, conflict policies, activity actions.
- Organization permissions for edit / evidence propose-approve / analyze / conclusion / review / issue / supersede, mapped onto Owner/Editor/Reviewer/Viewer.
- Collaboration: versioned `requestType`, expanded targets, legacy kind adapters; never store `reopened` status.
- Reports: Draft v2 (`codeDecisionMemo`) + Manifest v3 with adapters that do not rewrite stored v1/v2 payloads.
- Commands: `code-question-commands.mjs` — CAS, counters, issuance saga, outbox entries, bootstrap migration.
- Server routes under `projects/code-questions/*`, all gated by `permitext:codeQuestionWorkspace` / `PERMITEXT_CODE_QUESTION_WORKSPACE=1` (default off).
- Storage ports on file store + Postgres (counters, pending issuance, outbox, CAS).
- iOS: optional Code Question fields on `ProjectFoundationArtifactPayload` + decode test.

## Enablement

Default: **disabled**. Enable only for internal/opt-in:

```bash
PERMITEXT_CODE_QUESTION_WORKSPACE=1
```

Or capability option `codeQuestionWorkspaceEnabled: true` on capabilityContract/syncContract.

## Not in Phase 1

- Visible workspace shell / stage control (Phase 2)
- Full Research-bound analysis handler (Phase 5)
- PDF/HTML issue materialization of Code Memos (Phase 7)
- User-content promotion UI (Phase 8)

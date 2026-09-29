# Project foundation database read scope

## Finding

The scoped Project foundation request called `userContentMutations` twice (legacy migration and project discovery), and `coordinationAssigneesForProject` once. Each used `readStore()`. With PostgreSQL, that reached `readNormalizedStore()`, loading all users, entitlements, transaction ownership, subscription states, sessions, passkey ownership and normalized content mutations across accounts. Only afterward did the callers select one owner or a few authorized members. This is a deployment-wide read-volume problem, separate from local JSON-file parsing. Existing response filters do not mean those global reads were cheap; this finding does not establish cross-account response disclosure.

## Implemented change

Replace mutation snapshot reads with an adapter method selecting only the storage owner's mutations, retaining all five normalized-table branches, legacy generic kinds and record-ID ordering. Replace the assignee snapshot with an ID-scoped query returning only display name and public username after each candidate's Project permission check. Empty authorized-member lists make no profile query. Preserve schema/legacy initialization.

Do not skip legacy migration because a checkpoint exists: late-arriving legacy sections still need migration. Do not cache owner mutations across requests, change permissions, expose additional profile fields, or remove generic readStore for unrelated legitimate whole-store operations. File storage still parses its JSON file; this change is not represented as a local file-store latency fix.

## Verification boundary

Actual consumer and adapter tests pass with a sentinel rejecting global-store reads. SQL-spy assertions verify an owner predicate in every mutation UNION branch and an explicit ID list for minimal profile fields. File-adapter parity covers unrelated owners, retained deletion records and all legacy kinds; assignee tests cover inactive/non-view members, duplicate IDs, missing profiles, fallback names, sorting and empty-query avoidance. These tests inspect generated SQL and execute JavaScript adapter behavior; they do not execute that SQL against a live PostgreSQL instance. Existing local HTTP migration checks pass: unchanged migration does not rewrite storage, and a legacy section arriving after the checkpoint is subsequently migrated. Project foundation/organization contracts, backend-performance checks and Project A/B Note/Report HTTP handoff pass. Live PostgreSQL latency, hosted responses and physical-device behavior are not verified by these checks.

Commands passed:

- `node tests/foundation-owner-query-scope.mjs`
- `node tests/project-foundation-migration-steady-state.mjs`
- `node tests/project-foundation-contract.mjs`
- `node tests/organization-contract.mjs`
- `node tests/backend-performance-contract.mjs`
- `node tests/research-project-report-handoff-http.mjs`
- `node --check app.mjs` and `git diff --check`

The new scope contract is included in `smoke`. The eliminated work is structurally verified; no milliseconds-saved claim is made. Remaining foundation costs include owner-wide legacy migration and Research reads, plus local file-store parsing. Next acceptance should use an isolated PostgreSQL test fixture or authenticated hosted fixture before extrapolating local timings to production.

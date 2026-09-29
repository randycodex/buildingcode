# Project foundation database read scope

## Finding

The scoped Project foundation request called `userContentMutations` twice (legacy migration and project discovery), and `coordinationAssigneesForProject` once. Each used `readStore()`. With PostgreSQL, that reached `readNormalizedStore()`, loading all users, entitlements, transaction ownership, subscription states, sessions, passkey ownership and normalized content mutations across accounts. Only afterward did the callers select one owner or a few authorized members. This is a deployment-wide read-volume problem, separate from local JSON-file parsing. Existing response filters do not mean those global reads were cheap; this finding does not establish cross-account response disclosure.

## Implemented change

Replace mutation snapshot reads with an adapter method selecting only the storage owner's mutations, retaining all five normalized-table branches, legacy generic kinds and record-ID ordering. Replace the assignee snapshot with an ID-scoped query returning only display name and public username after each candidate's Project permission check. Empty authorized-member lists make no profile query. Preserve schema/legacy initialization.

Do not skip legacy migration because a checkpoint exists: late-arriving legacy sections still need migration. Do not cache owner mutations across requests, change permissions, expose additional profile fields, or remove generic readStore for unrelated legitimate whole-store operations. File storage still parses its JSON file; this change is not represented as a local file-store latency fix.

## Verification boundary

Actual consumer and adapter tests pass with a sentinel rejecting global-store reads. SQL-spy assertions verify an owner predicate in every mutation UNION branch and an explicit ID list for minimal profile fields. File-adapter parity covers unrelated owners, retained deletion records and all legacy kinds; assignee tests cover inactive/non-view members, duplicate IDs, missing profiles, fallback names, sorting and empty-query avoidance. These tests inspect generated SQL and execute JavaScript adapter behavior; they do not execute that SQL against a live PostgreSQL instance. Existing local HTTP migration checks pass: unchanged migration does not rewrite storage, and a legacy section arriving after the checkpoint is subsequently migrated. Project foundation/organization contracts, backend-performance checks and Project A/B Note/Report HTTP handoff pass. Local PostgreSQL execution is now verified below; hosted latency/responses and physical-device behavior remain unverified.

Commands passed:

- `node tests/foundation-owner-query-scope.mjs`
- `node tests/project-foundation-migration-steady-state.mjs`
- `node tests/project-foundation-contract.mjs`
- `node tests/organization-contract.mjs`
- `node tests/backend-performance-contract.mjs`
- `node tests/research-project-report-handoff-http.mjs`
- `node --check app.mjs` and `git diff --check`

The new scope contract is included in `smoke`. The eliminated work is structurally verified; no milliseconds-saved claim is made. Remaining foundation costs include owner-wide legacy migration and Research reads, plus local file-store parsing. The isolated PostgreSQL follow-up below closes SQL-execution validation. Authenticated hosted measurement is still needed before any production timing claim.

## Live isolated PostgreSQL acceptance — September 28

The previously unexecuted SQL boundary is now covered on a fresh disposable PostgreSQL18.6 instance. The existing guarded loopback harness used shipped HTTP handlers and Neon query encoding with a test-only local transport. New actual adapter cases seed two owners across all five mutation tables and verify ID ordering, deleted rows, permitted generic kinds, exclusion of duplicate/unknown generic kinds, missing-owner behavior, and minimal profile fields. The entire readiness suite passes: **1,830 SQL requests, 63 Serializable batches, 46 repeatable-read/read-only batches, maximum7 concurrent connections**. Four concurrent move/completion races, rollback, account linking, export/deletion and private-image isolation also pass. External database/provider requests:0. [Result/provenance](PERF_16_LOCAL_POSTGRES_ACCEPTANCE_2026-09-28.json).

An existing export test incorrectly assumed the Trash table did not yet exist. Core schema initializes it. The test now compares the table inventory before/after export and verifies separate-owner Trash content through the existing export/deletion assertions. No production behavior changed for that correction.

The cluster was stopped and its signed runtime image detached after testing. Raw synthetic logs/data remain only in the task temporary directory. This verifies SQL execution and local integration, **not** Neon cloud transport, hosted latency, CDN behavior, or iPhone performance. No deployment occurred.

Full `npm run smoke` also passes on the combined source. Its stale static assertions were updated for the Saved helper's optional argument, edition-preserving Recently Viewed navigation, independent supplemental Research columns and visible keyboard focus. Research grouping now executes the actual helper to verify primary pairing, supplemental independence and deduplication. These test repairs did not alter runtime/UI behavior.

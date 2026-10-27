# Research v2 local validation — 2026-10-26

This is local development evidence, not production, physical-device, or independent
legal accuracy verification. No push or deployment was performed.

## Paid Luna evaluation

- Run: `2026-10-27T01-54-29-244Z-8ca81c5b`.
- Engine SHA-256: `2eebb12c5ac9d480907d2bd99d37bd0abf047ad74237ce8a4e198fdbd2de41a1`.
- Model: `gpt-6-luna`; Standard service; `store:false`; no tools, web retrieval,
  embeddings, or model fallback.
- Final cohort: 12 cases; 32 provider calls.
- Original automated result: 11/12.
- Corrected automated result on the same saved answers: 12/12.
- Median complete engine time: 8.94 s.
- Total cumulative API cost estimate for all paid evaluation iterations and the
  two live browser turns: **$0.020137 of $7** across 76 provider calls.
- Uncertain or unsettled calls: 0.
- Remaining evaluation allowance: **$6.979863** at this checkpoint.

| Case | Engine result | Corrected developer check | Calls | Engine time |
| --- | --- | --- | --- | --- |
| name | reviewed | Pass | 4 | 9.27 s |
| ramp-explanation | supported_with_limits | Pass | 2 | 8.51 s |
| accessible-numeric-condition | supported_with_limits | Pass | 4 | 17.03 s |
| missing-handrail | supported_with_limits | Pass | 2 | 5.58 s |
| missing-private-document | supported_with_limits | Pass | 2 | 7.72 s |
| corridor-applicability | supported_with_limits | Pass | 4 | 20.14 s |
| edition-conflict | supported_with_limits | Pass | 2 | 8.67 s |
| followup-correction | supported_with_limits | Pass | 2 | 10.57 s |
| unsupported-topic | supported_with_limits | Pass | 2 | 4.58 s |
| unsupported-user-instruction | supported_with_limits | Pass | 4 | 35.40 s |
| table-footnotes | supported_with_limits | Pass | 2 | 9.22 s |
| selected-evidence-only | supported_with_limits | Pass | 2 | 6.12 s |

The original unsupported-instruction regex matched a negated statement:
“does not establish that a 1:10 ramp is compliant.” The revised expectation
requires both the supplied general limit and an explicit refusal or limitation,
with a supplied citation. Regression examples reject an affirmative unsupported
approval. Regrading made **zero** additional model calls. The original run's
answers, flags, reviews, source text, and usage remain unchanged; the regrade is
stored separately.

Earlier development exposed an answer/claim-map exception mismatch. The writer
now preserves material qualifications in both, and every repair receives a fresh
review against the identical evidence package. This is not evidence that Luna
self-review catches every substantive error.

## Software and browser verification

Passed focused checks:

- `npm run test:research-v2`: frozen passage-only input, Luna-only requests,
  mechanical citation failures, repair/review sequence, failed-draft withholding,
  cancellation before dispatch, concurrent budget reservations, uncertain costs,
  restart durability, real HTTP auth/replay/revision checks, missing-document
  completion, exact source persistence, and the local-only switch.
- Existing Fast Research HTTP regression: original streamed/unreviewed mode,
  replay, authorization, and incomplete-output rejection.
- Related-provision client and HTTP checks: edition identity, source review before
  inclusion, exact-text/hash checks, and stale-result isolation.
- Reader-only scope and Saved Evidence exact-text checks.
- Research → Notebook → Report reference and immutable-answer handoff.
- Existing conversation-in-place and draft-refresh-isolation checks.
- Web shell caching and offline-shell coherence checks.

The browser used the actual new interface, existing Reader, local HTTP endpoints,
canonical 2022 BC passages, persistent local history, and real paid Luna calls.
Verified: search → Reader review → explicit inclusion → first answer → another
passage during the conversation → preserved draft → follow-up → reload/reopen →
original answer evidence inspection. The first answer retains one passage while
the current conversation and second answer have two.

The first browser pass found a draft handoff conflict with the workspace's
per-conversation instance draft. The adapter now updates both durable draft state
and the current instance. The exact follow-up survived reattachment after the
actual cached client was updated. The local copied assets required by the existing
offline shell were supplied through ignored dependency links.

The final Research panel was inspected at desktop size and at a 390 px viewport.
Its narrow content width was 352 px with no horizontal content overflow; the
composer remained visible. The numbered list is available through Questions on
narrow screens. No console errors were observed in the exercised flow.

## Retained evidence and remaining gates

Reproducible runners and expectation checks are committed. Raw run records,
original summaries, separate regrade, budget ledger, and isolated local stores are
under `permitext-sync-server/data/` and intentionally excluded from Git. The live
server and CLI evaluation share one budget ledger.

The checks are developer-authored and use Luna's own substantive review. Broader
human-reviewed expected outcomes, representative discovery-recall measurement,
long-conversation evaluation, physical-device acceptance, and production rollout
remain required before release. No migration of real user history has been tested
or performed, and no old answer was regenerated.

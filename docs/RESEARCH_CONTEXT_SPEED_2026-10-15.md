# Research project scope, retrieval speed, and Notes placement

Implementation branch: `codex/research-context-speed`, based on production source `53630f5e75ae5828147890cff387a57e4d3eb7e8`.

## Behavior

A standalone ambiguous correction such as “no no, this is a new project -” now asks whether the user means new work at the attached property or a different property. This response makes no code determination, changes no saved project facts/link, consumes no model calls or Research turn, and uses the existing canonical clarification persistence path. Mixed questions that also request a legal determination do not take this shortcut. Persistence rejects modified clarification claims and requires a linked Project.

The investigator, writer, and reviewer distinguish existing-property inventory from proposed uses. An explicitly different-property scenario must exclude the attached site's facts without claiming that chat changed the saved Project link.

Within each investigation round, independent searches overlap. Results and corpus-plan expansions merge in the original query order; the next round still waits for all searches. A failed search prevents publication of a partial packet. Concurrent query embeddings can share one provider request only within the same HTTP turn. The existing serialized provider boundary, pre-dispatch budget reservation, settlement, unknown-outcome handling, query-vector cache, and source-version checks remain in place. A batch maps each returned vector by index and charges once. No evidence budget, jurisdiction/edition boundary, applicability check, citation check, or fresh full-answer review was removed.

Saving an Assistant reference Note no longer opens or links a Notes column into Research. A separate “Open note in Research” action opts in. Legacy automatic Notes memberships fall back to Notebook; new explicit choices survive reload. Closing Notes ends its Research opt-in. Notes content is preserved.

## Validation

- `npm run test:research-context-speed`: exact three-question HTTP replay with provider doubles, canonical clarification rejection tests, concurrent-search ordering/failure checks, batched-vector mapping and accounting, open-investigation/recovery tests, and workflow/navigation tests.
- `npm run check`: full repository check (result recorded below).
- Local rendered browser: create reference Note without opening Notes; open Notebook and verify exact answer reference; return to Research with Notes hidden; explicitly open Notes in Research; reload; close Notes; reopen it in Notebook and verify Research remains clear.
- Live replay uses isolated account/project/conversation IDs and the current corpus, with the visible project's 43 saved facts. Production records and history are untouched. Paid runs share a pre-dispatch $12 cap; raw requests/responses and ledger remain outside Git.

## Timing interpretation

Live-model runs are observations, not a general latency guarantee. Provider timing and investigator choices vary, and local execution is not hosted production. The initial setup runs omitted first passage search, then broad-current-corpus recall; their timings are excluded from the final before/after comparison. The final comparison uses passage search, semantic vectors, broad current-corpus recall, the same 2022 Project code version, and Luna-only writer/reviewer/investigator roles. Both sides cover the same 54,298 indexed passages at initial retrieval. Every substantive answer must retain passing verification and citations.

Matched isolated replay (one conversation per implementation; seconds):

| Turn | Production-source baseline | Final candidate | Provider calls, before → after |
| --- | ---: | ---: | ---: |
| How to determine the use group | 46.08 | 48.26 | 8 → 7 |
| Which groups apply to this project | 36.19 | 41.35 | 9 → 6 |
| Ambiguous new-project correction | 50.52 | 0.25 | 9 → 0 |
| Total | 132.79 | 89.86 | 26 → 13 |

The whole conversation was 32% faster, entirely because the correction no longer triggers legal research. This sample does **not** establish faster substantive answers: those were about 7.34 seconds slower in total. Batched embeddings reduce requests, but investigator choices, source selection, provider latency, and repairs still dominate. Both final substantive answers passed their first full review and retained exact citations; the clarification makes no legal claim and is deliberately not labelled verified. Both runs reopened with six messages and the original attached Project.

The originally observed hosted conversation took 84.58, 68.25, and 87.81 seconds. Those production timings are context, not a controlled before/after measurement. An intermediate candidate exposed an over-broad context instruction and a bad draft citation; existing review blocked delivery, repaired, and re-reviewed. Its 177.82-second first turn is retained in the raw test evidence and excluded from the final-code comparison, not concealed as a successful optimization. The final instruction limits clarification to an ambiguous correction.

Focused context/speed suite, Project summary, writer policy, Note navigation, source-edition integrity, and readiness/recovery checks passed. Local rendered Notes save/open/reload/close behavior passed. Three stale VM fixtures were minimally repaired after reproducing their failures on the unchanged baseline (missing Reader navigation map, nested DOM append, and visited-workflow normalizer).

The aggregate `npm run check` is **not green**. Remaining failures reproduce on the unchanged baseline: zoning architecture V2 expects full-answer rewrite to be disabled; evidence-folders expects an old Reader width declaration; evidence-retrieval evaluation data declare v29 while the implementation is v68. These unrelated policy/dataset assertions were not weakened. Check chains were resumed after individual failures; this is not a claim that all repository checks ran or passed.

All three live negative controls were rejected: invented proposed occupancy facts, forged citation identities, and a claim that chat detached/deleted the saved Project. All 85 provider requests settled. Total estimated test spend, including setup/intermediate runs and negative controls: $0.4398, within the approved $12 cap. This is usage-based estimated cost, not an invoice.

Local result artifact: `research-context-speed-results.json` in this task's visualization directory. Screenshots: `notes-saved-research.jpg` and `notes-explicit-open.jpg`. Raw isolated replay data and the spend ledger remain at `/tmp/permitext-context-replay-20261015/`; no credentials, auth-store contents, or project fixture data are committed. No push or production deployment was performed.

## UpCodes implications

Expose the attached Project and proposed-work scope together. Jurisdiction, code basis, and source choices should be visible, persistent inputs to retrieval, with unresolved scope clearly marked. A site record is not a proposed design. Source controls must retain governing parents, definitions, exceptions, and cross-references; narrowing the menu must not hide dependencies or imply applicability. These UI controls are a subsequent product decision, not part of this implementation.

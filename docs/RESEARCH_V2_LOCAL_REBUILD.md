# Research v2: local rebuild

Status: first working local version. Branch: `codex/research-rebuild`.
Base: `3e2d57c8c5de5c32e42b29333a80e1d8c30e867e`.
The existing Research version remains the default. No push or deployment is authorized.

## Product contract

Research helps users find relevant provisions, understand exact passages they
include, and develop answers with inspectable support and explicit limitations.

- Left: a numbered list of research questions. Each opens its conversation.
- Right: a simple question/answer thread and a composer at the bottom.
- Passage attachments display citation and edition only, for example
  `BC § 1012.2 · 2022`. Selecting a chip reveals its exact text and removal action.
- Passages can be added before the first question and between follow-ups.
  Adding a passage retains the draft and never submits it.
- Reader remains the actual existing Reader. Candidate discovery opens sources
  there and displays exact text before explicit inclusion.
- Questions without evidence lead to library search; they do not generate legal
  answers from model memory. Candidate search is not an applicability finding.
- Completed conversations save automatically into the existing history store.

## Evidence and answer contract

1. Code authority comes only from the exact included Reader passages. Keep source
   IDs, jurisdiction, edition, source version, text, and text fingerprints.
2. A linked Project does not authorize its address, context, facts, notes, or
   property lookups. Current and previous user statements are supplied as user
   material. Questions do not establish project conditions.
3. Previous assistant replies provide conversational context, not legal authority.
   New source-based claims must be supported by the current included evidence.
4. A turn freezes the question, exact evidence, and supplied history before any
   model call. Source or conversation revision conflicts reject a late completion.
5. Each successful answer uses the existing immutable answer/evidence records.
   Removing or adding a passage affects future questions, never earlier snapshots.
6. Old conversations are read with their retained answers and sources. Opening one
   in v2 does not migrate its scope or regenerate its answers. An explicit new
   question uses the v2 passage boundary.
7. Missing source text, facts, definitions, tables, footnotes, and exceptions are
   identified when material. A bounded supported explanation can still be useful.
8. No automatic truncation of passage text or conversation history is permitted.
   Over-budget input is rejected with an explicit message.

## New pipeline

`freeze inputs → Luna draft → identity checks → Luna substantive review → finalize`

At most one repair and a fresh full review may follow. There are at most four
model calls, all `gpt-6-luna`, Standard service, `store:false`, without tools or
web retrieval. The reviewer checks the entire narrative and the claim map against
the same frozen evidence, including conditions, exceptions, edition conflicts,
units, and invented facts. The final answer retains its review outcome and input
history/fingerprints. A review pass is an AI result, not proof of compliance.

A failed review withholds the rejected draft and returns an incomplete-result
message. Its text is not saved as a supported answer. The caller retains its draft
and passages. Server-side replay returns an already completed answer without new
provider calls, even when the completion advanced the conversation revision.

## Boundaries and modules

- `research-v2-engine.mjs`: frozen input, prompts, answer/review schemas, mechanical
  checks, and one bounded repair. Provider transport is injected.
- `research-v2-budget.mjs`: durable spend reservations, settlement, and the Luna
  client. Failures without usage consume their full reservation.
- `public/research-v2.js` and `.css`: the new interface with injected workspace,
  history, source-review, and Reader adapters. Generated content uses text nodes.
- Existing auth, entitlements, selected-text validation, source freshness checks,
  Research turn reservations, atomic message commit, and immutable answer storage
  are retained. The old generation/repair pipeline is not called by a v2 turn.
- The API requires `PERMITEXT_RESEARCH_V2=1` and rejects v2 in Vercel or production.
  The UI opt-in is local-host only, `?research=v2`; it survives Reader navigation
  in the tab session. `?research=legacy` returns to the existing interface.

## Paid evaluation budget

The user authorized **$7 total** for this rebuild's paid Luna tests. CLI evaluation
and the live local server share
`permitext-sync-server/data/research-v2-evaluation/budget-ledger.json`.

Each call reserves a conservative input/output maximum before dispatch. The
ledger uses an exclusive filesystem lock and atomic replacement; restarting a
process cannot reset it. Uncertain calls retain the full reservation. There are
no automatic provider retries. Both normal application spend controls and this
evaluation ledger apply to live browser requests.

Published Luna Standard rates were checked on 2026-10-26: $0.10 input, $0.01 cached
input, and $0.50 output per million tokens. Reservations allow higher cache-write
and Fast rates. Returned token usage is recorded conservatively; this is an API
cost estimate, not invoice reconciliation.

Sources: https://developers.openai.com/api/docs/models/gpt-6-luna and
https://developers.openai.com/api/docs/pricing.

## Running locally

From `permitext-sync-server` in this worktree:

```sh
npm run test:research-v2
npm run eval:research-v2 -- --paid
npm run start:research-v2 -- --live
```

The live launcher reads the existing Keychain key without printing it, binds to
127.0.0.1:8807, creates an isolated local development account, and prints a local
bootstrap URL. It uses its own store under `data/research-v2-local/`; it does not
connect to production storage or the user's real history. No new credentials,
packages, or provider migration are required. The existing checkout is untouched.

## Verification and next gates

The focused tests cover frozen scope, identity failures, repair/review ordering,
bounded failure, preflight cancellation, atomic budget reservations, uncertain
cost, restart durability, canonical selected text, HTTP auth and stale revisions,
replay, evidence gaps, immutable saved records, and the local-only switch.

The live evaluation cases cover naming, slope conditions, a numeric comparison,
missing handrails, an absent private document, corridor applicability, edition
conflict, a corrected follow-up fact, an unrelated question, unsupported user
instructions, table/footnote dependencies, and excluded neighboring text.

These are developer-authored automated expectations plus Luna's own review.
They are **not** a human-reviewed legal accuracy benchmark. A self-review pass or
a successful HTTP response does not establish correctness.

Before release: obtain independent human outcomes for a broader evaluation set;
measure complete discovery coverage separately from interpretation; test much
longer conversations, old client compatibility, physical devices, and realistic
latency/cost distributions; then choose rollout and rollback criteria. Automatic
Project fact inclusion, external source acquisition, and extra answer modes are
outside this first version. No migration, merge, push, or deployment has occurred.

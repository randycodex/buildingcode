# Retrieval latency follow-up

Local candidate based on production 9b368a8e1. Not deployed by this change.

## Changes

- Begin the unchanged, reserved semantic query before CPU-only lexical work, yielding so existing sibling query batching can dispatch. Rejections are observed immediately and propagated before canonical candidate body admission. Provider accounting and serialization remain in place.
- Load independent authorized corpus partitions concurrently, await all outcomes, and merge in the same corpus order. Failed partitions still fail closed.
- Reuse title tokens by catalog object and exact title. A changed title invalidates its entry; weak references do not retain discarded catalogs.
- Avoid constructing section-number regexes for catalog titles that cannot contain Scope or Applicability. All existing exact-title, authority, chapter and canonical-body checks remain.
- Score every semantic passage as before, but copy full source objects only for selected hits. Floating-point arithmetic, tie order, offset deduplication and limits remain identical.

Luna models, reasoning efforts, tiers, investigator rounds, source budgets, canonical citation checks, reviewer instructions and fresh repair review are unchanged. No answer/project-fact cache, approximate ranking, corpus narrowing or shortened source text was introduced.

## Evidence preservation and tests

- Three full offline evidence packets have identical SHA256 values to the base commit, ignoring only existing observation timestamps and elapsed time.
- Six full investigator/reviewer evidence packets from recorded-provider replay match the prior prepared-final-1 sequence exactly after excluding retrievedAt. These replays test plumbing/evidence preservation, not fresh model accuracy. Changed live property observations and isolated account/project IDs are not asserted equal.
- Five full-library semantic comparisons over 54,298 passages produce exactly identical hits, scores and nested passages to the original implementation, with varying limits, passage counts and thresholds.
- New scheduling contract verifies startup order, unchanged full discovery output/query and propagated reservation failure. Semantic contract adds explicit equal-score, duplicate-offset, threshold and source-mutation cases.
- Passed semantic passages, semantic query context, hosted semantic spend, open investigation, open investigation HTTP, chapter scope, admitted chapter scopes, passage ranking, indexed containment, indexed assembly, latency and prepared-index contracts. The HTTP contract retains rejection and fresh repair review controls.

Profiling and replay artifacts are outside Git under /tmp/permitext-context-replay-20261015 and /tmp/permitext-retrieval-*. Private facts/provider payloads are not committed.

## Fresh live-model replay

Two separate local server processes, fresh isolated conversations, the same original three questions and saved 43-fact project fixture. Actual model calls; no production conversation changes. End-to-end HTTP wall times:

| Question | First sequence | Confirmation |
| --- | ---: | ---: |
| how do you determine the use group for this site? | 32.56 s | 30.38 s |
| for this specific project, which use groups apply to it? | 27.93 s | 26.60 s |
| no no, this is a new project - | 0.18 s | 0.20 s |

All four substantive answers passed fresh review without repair. Both correction turns kept the linked project and made no provider calls. These outcomes are not independent proof of legal accuracy.

Retrieval was 18.08 / 11.35 seconds in the first sequence and 15.23 / 15.40 seconds in confirmation. Investigation model time is included in retrieval: 9.46 / 7.42 and 8.56 / 10.81 seconds, respectively. The first request loads indexes; each follow-up uses the same local process. Provider variation is material: first sequence follow-up review took 8.74 seconds, versus 3.96 in confirmation.

The previous production measurements were 26.95 / 24.69 seconds retrieval and 40.02 / 37.74 seconds total. Local results cannot establish equivalent hosted savings. No production sub-30-second claim is justified; neither fresh initial question met that target in these two sequences.

Estimated new provider cost: $0.2068. Shared conservative campaign ledger: $1.7257 of the authorized $12; all requests settled. Estimates are not invoice-confirmed charges.

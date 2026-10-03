# Retrieval evaluation and next work — October 2, 2026

The optional passage and meaning search improves the development set, but the frozen candidate does not pass production acceptance. The 70 reserved turns produced **56 correct answers, 11 withheld answers, one minor issue, one material scope error and one ambiguous test question**. That is 56/69 gradable turns, or 81.2%, under assistant source review. Twenty-four of 35 conversations passed both turns. This is not professional adjudication or a product-wide accuracy estimate.

The main remaining problem is selecting the governing provision with its applicability context. Several failures retrieve a related rule from another code book or zoning chapter. One answer retrieves the right principal rule but adds an unrelated special-district provision as an apparent general qualification; the verifier amplifies that mistake.

## Changes and verification

The local implementation adds optional exact numbered-passage search and meaning search over the authorized current corpus. Source locators and hashes are checked against canonical text; tables, parent conditions, exceptions and internal references are preserved when a complete excerpt fits. Explicit subsection references retain priority. Follow-ups preserve checked source identity and edition while concentrating ranking on the current detail. Bounded citation removal also withdraws stale exclusive bindings before full verification.

Answer models remain GPT-6 Luna, low effort for writing and medium for verification. Seventeen focused contracts passed, including actual corpus, edition, selected-evidence, exact-reference, table, budget and verification boundaries. See `validation.json`.

| Observed run | Turns | Correct | Minor | Withheld | Material error | Ambiguous key |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline development | 30 | 20 | 0 | 10 | 0 | 0 |
| Revised full development, V3 | 30 | 28 | 1 | 1 | 0 | 0 |
| V4 targeted check | 9 | 8 | 0 | 1 | 0 | 0 |
| Frozen candidate, reserved set | 70 | 56 | 1 | 11 | 1 | 1 |

The V4 check corrected the clipped stair exception and retained the unresolved dormitory-candle retrieval gap. It is not a new full 30-turn result. A later exact-reference regression fix is included in the frozen candidate. Earlier experiments and their regressions remain recorded rather than being discarded from the report.

Questions and source keys were frozen before paid answers. Candidate source hashes, configuration and vectors were frozen before the reserved set was opened; those hashes remained unchanged. Keys never enter normal retrieval or the writer. Review does not use the application's verifier verdict as ground truth. The held-out turns share 35 conversation families and source chapters. One flawed question is flagged separately; its frozen wording/key is not silently repaired.

## What needs to improve next

1. **Carry and use applicability.** Every fragment needs its canonical chapter, code-book, district and use context. Use known project/scenario facts to prioritize compatible governing provisions. A phrase such as “in all districts” must retain its enclosing special-district scope. Eight failed turns lacked the governing provision, often while parallel BC/PC/MC or R/M zoning text was supplied.
2. **Complete the rule packet.** Retrieve applicable parent conditions, exceptions, definitions and tables with the operative rule. Two failed turns had incomplete context. Governing text should not be sacrificed to unrelated candidates or presented as complete after clipping.
3. **Preserve the user's subject through nonanswers.** The last verified answer may only explain why its sources are insufficient. Its citations do not automatically establish the next turn's governing book. Retain the user's actual gas/fire/zoning subject and project facts when the preceding answer does not resolve it.
4. **Fix false rejection and source-binding errors.** One complete handrail answer was rejected because the deterministic check mistook the enacted phrase “for guidance or support” for web guidance. Another turn failed after an unrelated waiver citation was added. Check actual source provenance and scope rather than treating isolated words or every retrieved provision as a required claim.
5. **Refresh sources and evaluate independently.** Import official editions/amendments with version/effective-date metadata, rebuild changed index entries and invalidate stale caches. This updates the corpus, not the answer model's training. Freeze a fresh representative set after the next changes, including project-linked questions, and have independent code professionals review its keys. Do not tune against this reserved set and then reuse its score as a fresh accuracy claim.

## Cost, speed and rollout

This campaign used **$0.823705255 of the $13.97 authorization**, with 1,057 accounted provider calls, 199 answer turns and no unsettled calls. The prepared library embeddings cost $0.14076258. Cost is calculated from captured usage at the recorded evaluation rates; it is not an invoice reconciliation. No ChatGPT Instant comparison was needed for these source-specific diagnoses.

The reserved run's median HTTP turn took 9.49 seconds; p90 took 18.88 seconds. Fixture-wide retrieval preflight warmed corpus/query caches. These are local measurements, not production response times, and the fixtures contain no structured project facts.

Production enablement is rejected. Prepared binary vectors alone use a 53.1 MB artifact, but the full local passage-index build plus binary load retained about 1.13 GB process RSS and took 9.73 seconds before alignment/query/model work. Prepare/share the passage index and verify hosted cold starts, concurrent memory and cache duplication. Query embeddings must also join normal application reservation/settlement accounting; the isolated runner already accounts for them. Verify project-linked browser conversations, prepared-artifact availability, refresh and fallback before rollout. This campaign did not deploy or enable the new search in production.

The authoritative cost ledger, frozen records and source reviews are in this directory. Raw provider requests/responses and prepared vectors are preserved outside Git at `/Users/randy/.codex/artifacts/permitext-retrieval-improvement-2026-10-02/`. See `heldout-summary.json`, `campaign-summary.json`, `candidate-freeze.json`, `semantic-loading.json` and `candidate-code-review.json` for the detailed evidence.

# Permitext Zoning Research — Expanded Batch 1 Cohort

Date: August 30, 2026

Working branch: `codex/zoning-research-beta1`

Status: **30/30 NO-COST PREFLIGHT PASSED; PARTIAL PAID RESULT RETAINED; PUBLIC ACCESS DISABLED**

## Owner disposition

The Permitext owner approved source Cases 2, 4, 5, 6, 7, 8, 9, 10, and 12 for evaluation testing only after the current-source and calculation review. Cases 5, 10, and 12 are intentionally explicit-uncertainty tests: approval means their expected answer must refuse an unsupported property-specific conclusion, not that their hypothetical projects are approved.

The following cases remain drafts outside the expanded cohort:

- Case 1: revise and narrow before another owner review.
- Case 3: hold as a near-duplicate of the existing R7A height test.
- Case 11: hold until incorporated visual-map evidence can be governed safely.

This disposition is not professional zoning sign-off, public Zoning Research release, paid-run authorization, pricing authorization, deployment authorization, or permission to alter the original 21-case benchmark.

## Frozen cohort boundary

- `permitext-sync-server/evals/zoning-cases.json` remains the unchanged 21-case parent. Its SHA-256 is `90b9cf4c5c3ea40522103d42a9b8ec052b044cf42be019cae53eed61cfa008a6`.
- `permitext-sync-server/evals/zoning-cases-expanded-batch-1.json` is a separate frozen 30-case cohort: the original 21 cases followed by the nine approved Batch 1 cases.
- The generated cohort records the exact parent, intake, and source-document hashes and fails closed if the parent changes.
- The paid authorization state is `consumed`. The one authorized 30-case run is bound to result `5e394dd0-fce2-4fd7-8c5a-cb05dcb29e53`, and no further cumulative spend cap exists. A future paid run requires a new explicit owner authorization and a new explicit cumulative cap.
- `researchEligibility`, professional sign-off, and public-release authorization all remain false.

## No-cost verification

The following commands passed without an API key or paid model request:

- `npm run test:zoning-candidate-batch`: 12 source cases mapped, nine owner-approved, three held, 42 official sections mapped, original cohort still 21 cases.
- `npm run test:zoning-expanded-batch-1`: immutable-parent, owner-review, cohort-count, source-hash, selected-passage, uncertainty, and paid-lock contracts passed.
- `npm run eval:zoning:expanded-batch-1`: all 30 cases passed canonical-evidence preflight and Permitext conversation creation; total model tokens and estimated model cost remained zero.

The three deliberate fact-gap cases adapt to `insufficient evidence`. Every selected section is bounded to at most 11,800 characters, including targeted extracts from the 268,071-character ZR 12-10 definitions section and the 19,900-character ZR 27-111 definitions section.

## What this proves and does not prove

This proves that the separate cohort is reproducible, owner-governed, canonically mapped, passage-bounded, and usable by Permitext's Research conversation-creation path without enabling Zoning or spending money. The subsequently authorized one-repetition semantic run spent $3.247980 under its $5 cap, completed 28 operations, failed two operations without charging a user, and passed 12 of 28 graded answers. It is retained as partial diagnostic evidence in [PERMITEXT_ZONING_EXPANDED_SEMANTIC_RESULT_2026-08-30.md](./PERMITEXT_ZONING_EXPANDED_SEMANTIC_RESULT_2026-08-30.md). It does not prove that the model answers all 30 cases correctly and does not authorize another paid run.

## Next gate

Complete owner re-review of the two answer keys that conflict with the selected enacted evidence, finish the no-cost regression and cost-reduction work, and only then decide whether to authorize a clean semantic confirmation with a new cumulative spend cap. Public Zoning Research must remain disabled until semantic quality, updated cost evidence, and web/iOS acceptance all pass.

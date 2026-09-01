# Permitext Zoning Research — remediation successor 3 v15 confirmation result

Date: August 31, 2026

Source branch: `codex/zoning-research-beta1`

Authorization package commit: `8fe33ab45f8d2d4b4653207aee47d8bb557c68b3`

Execution commit: `1fde866860433e9152d00bd78cc324e825034956`

Dataset SHA-256: `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`

Run ID: `fe0367c2-2c62-41e3-bc4c-1fc168fae68e`

## Authorization and boundary

The owner explicitly authorized exactly package commit `8fe33ab45f8d2d4b4653207aee47d8bb557c68b3` for all 30 ordered cases, one repetition, with a maximum cumulative API spend of `$5`. Execution commit `1fde866860433e9152d00bd78cc324e825034956` differed from the locked server package only in the fresh authorization record. Authorization ID `23d686fc-1a01-4cf0-8242-7c894f67ecbd` entered its durable non-reusable attempt state before provider dispatch and is now consumed by this run.

Provider web support was disabled. The 24,000-character evidence candidate, public Zoning Research, deployment, merge, push, pricing or allowance changes, professional Zoning signoff, and customer charges remained disabled or unauthorized. The runner stopped after the first execution error. No second v15 run is authorized.

## Retained terminal result

- Status: `partial`.
- Evidence preflight: 30/30 ready before provider dispatch.
- Attempted operations: three, in exact frozen order.
- Completed operations: two; both passed grading, at 4.00/4 and 3.84/4.
- Failed operation: one; it failed closed before grading and recorded no failed user-turn charge.
- Unattempted operations: 27 because the stop-on-first-execution-error guard halted the run as designed.
- Paid requests: nine settled and zero pending.
- Total settled and conservatively reconciled API spend: `$0.249778`, below the `$5` cap.
- Production-operation cost: `$0.217096`, including `$0.085813` of failed closed work.
- Independent-judge cost: `$0.032682`.
- Charging integrity: two isolated evaluation turns were charged to the evaluation grant; the failed operation did not consume a user turn; no customer account was involved.

Machine evidence:

- `permitext-sync-server/evals/results/2026-09-01T01-20-39-269Z-fe0367c2-2c62-41e3-bc4c-1fc168fae68e.json` — SHA-256 `0ce9050c8aa4e7d59b42a524b1c20372b7535bc1b42efa0527a56bf3357f0e58`.
- `permitext-sync-server/evals/results/2026-09-01T01-20-39-269Z-fe0367c2-2c62-41e3-bc4c-1fc168fae68e.md` — SHA-256 `4ce4144d54d62b297355f25a5b6a5cd2d26b877f83dbdac4e84fc762f38e15d6`.
- `permitext-sync-server/evals/zoning-successor-remediation-3-v15-confirmation-paid-authorization.json` — consumed-state SHA-256 `0ef1e44e90ab0b7802913e4a3bc2785889875324eec1579a30e13331e14455a5`.

## Case outcomes

Passed grading:

- `zr-rules-of-construction` — 4.00/4; `$0.047402` production cost.
- `zr-use-group-table` — 3.84/4; `$0.083881` production cost.

Failed closed before grading:

- `zr-appendix-map-boundaries` — two bounded attempts; `$0.085813` failed-work cost; `RESEARCH_VERIFICATION_FAILED`. Both attempts encountered `zoning_missing_mapped_location`; no `zoning_map_inference` issue recurred.

The remaining 27 ordered cases were not attempted. Neither case changed by remediation successor 3 reached execution, so this result does not semantically confirm either owner-approved correction.

## Privacy-bounded failure classification

The initial attempt cited Appendix J but did not retain the required overall map/location boundary. Its 11 retained triggering field clauses were classified as direct conclusions and none as source rules or location boundaries. The bounded revision cited Appendix J and restored the overall address-or-BBL plus official-map boundary. However, all 12 retained triggering clauses were still classified as direct conclusions and none as source rules or location boundaries, so it also failed closed.

No generated failed-answer text, customer identifier, provider request identifier, or raw message content is needed for this classification. V15 successfully recognized the revised overall required-input boundary, but that did not resolve the separate clause-level source-rule versus direct-conclusion classification. The result does not justify weakening the parcel safeguard. A fresh no-cost diagnosis must use only the bounded hashes, flags, approved prompt/evidence, and matched safe/unsafe controls; it must not reconstruct or rescore the unavailable answer.

## Economics and reliability

The two completed production operations cost `$0.065641` mean/p50, `$0.080233` p90, and `$0.083881` maximum. Including failed production work gives `$0.108548` per completed turn and a mechanical projection of `$10.85` per 100 all-Zoning turns. Completed-turn latency was 17.386 seconds mean/p50, 25.496 seconds p90, and 27.523 seconds maximum.

This projection is not decision-ready. The run completed only two turns against the 20-turn minimum, stopped at the third case, and did not reach either changed remediation-successor-3 case. The result records `sampleReady: false`, `targetReady: false`, and `readyForPricingDecision: false`. The `$10.85` figure is a non-controlling partial signal. Remediation successor 2's `$20.18` failed-work-amortized projection per 100 all-Zoning turns and `$20.72` 100%-Zoning mixed-month p90 remain controlling for current risk planning.

## Decision and next gate

Retain this as an integrity-valid terminal partial diagnostic, not a complete 30-case v15 confirmation. Do not enable public Zoning Research or the evidence-budget candidate, change the `$20` price or 100-turn allowance, merge, push, or deploy from it. Semantic, reliability, cost, exact-release web/TestFlight physical-iPhone, and final public-release gates remain open.

The next step is a no-cost diagnosis of why the revision preserved the overall required-input boundary while every retained triggering clause still looked like a direct property conclusion rather than a generic source rule. Any later semantic rerun requires a materially justified repair, a distinct locked package, a new exact owner authorization for all 30 ordered cases and one repetition, and a new cumulative cap no higher than `$5`. This consumed authorization cannot be reused.

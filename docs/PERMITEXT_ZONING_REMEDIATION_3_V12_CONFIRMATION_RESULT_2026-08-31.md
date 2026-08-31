# Permitext Zoning Research — remediation successor 3 v12 confirmation result

Date: August 31, 2026

Source branch: `codex/zoning-research-beta1`

Authorization package commit: `67fbd6ca25d69b9f59d07dfb3b556ca16d134b39`

Execution commit: `bf13a7128edc0dc9d53c62611eaa660a35e0cf73`

Dataset SHA-256: `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`

Run ID: `6e370831-82c1-4480-9253-2ea8ceb908ec`

## Authorization and boundary

The owner explicitly authorized exactly package commit `67fbd6ca25d69b9f59d07dfb3b556ca16d134b39` for all 30 ordered cases, one repetition, with a maximum cumulative API spend of `$5`. Execution commit `bf13a7128edc0dc9d53c62611eaa660a35e0cf73` differed from the locked package only in the fresh authorization record. Authorization ID `31dd8aa9-3b2c-4fc8-8988-1b542735ac78` entered its durable non-reusable attempt state before provider dispatch and is now consumed by this run.

Provider web support was disabled. The 24,000-character evidence candidate, public Zoning Research, deployment, merge, push, pricing or allowance changes, professional Zoning signoff, and customer charges remained disabled or unauthorized. The runner stopped after the first execution error. No second v12 run is authorized.

## Retained terminal result

- Status: `partial`.
- Evidence preflight: 30/30 ready before provider dispatch.
- Attempted operations: three, in exact frozen order.
- Completed operations: two; both passed grading at 4.00/4.
- Failed operation: one; it failed closed before grading and recorded `charged: false`.
- Unattempted operations: 27 because the stop-on-first-execution-error guard halted the run as designed.
- Paid requests: eight settled and zero pending.
- Total settled and conservatively reconciled API spend: `$0.212014`, below the `$5` cap.
- Production-operation cost: `$0.185138`, including `$0.092284` of failed closed work.
- Independent-judge cost: `$0.026876`.
- Charging integrity: two isolated evaluation turns were charged to the evaluation grant; the failed operation did not consume a user turn; no customer account was involved.

Machine evidence:

- `permitext-sync-server/evals/results/2026-08-31T22-37-43-979Z-6e370831-82c1-4480-9253-2ea8ceb908ec.json` — SHA-256 `9491fb2c50cddabe0592359453721ec6036218538181132c5099ac0abeb34cbb`.
- `permitext-sync-server/evals/results/2026-08-31T22-37-43-979Z-6e370831-82c1-4480-9253-2ea8ceb908ec.md` — SHA-256 `772b65bd26a291ee9ea649162a73c48262ac26b10f73ff97807958e0c8f85429`.
- `permitext-sync-server/evals/zoning-successor-remediation-3-v12-confirmation-paid-authorization.json` — consumed-state SHA-256 `b6a7fdbb00f5a7b7f587cb3e9557fe2d673464df69962e4afd01a1df79c2af48`.

## Case outcomes

Passed grading:

- `zr-rules-of-construction` — 4.00/4; `$0.047900` production cost.
- `zr-use-group-table` — 4.00/4; `$0.044954` production cost.

Failed closed before grading:

- `zr-appendix-map-boundaries` — two production requests; `$0.092284` failed-work cost; `RESEARCH_VERIFICATION_FAILED`. Both bounded attempts encountered `zoning_missing_mapped_location`; the revision also encountered `zoning_map_inference`.

The remaining 27 ordered cases were not attempted. Neither case changed by remediation successor 3 reached execution, so this result does not semantically confirm either owner-approved correction.

## Privacy-bounded failure classification

Both retained attempt diagnostics record `sourceBoundaryQuestion: true`, `citedAppendixJ: true`, and `mappedLocationBoundaryPresent: true`. Every retained triggering clause is recorded as `locationBoundary: false`, `sourceRule: false`, and `directConclusion: true`. The revision additionally triggered `zoning_map_inference`.

No generated failed-answer text, customer identifier, provider request identifier, or raw message content was retained. The evidence therefore proves that v12 continued to reject the third case safely, but it does not justify treating the stop as merely the same v11 false positive or weakening either safeguard. The added map-inference issue requires a fresh no-cost diagnosis before any proposed successor.

## Economics and reliability

The two completed production operations cost `$0.046427` mean/p50, `$0.047605` p90, and `$0.047900` maximum. Including failed production work gives `$0.092569` per completed turn and a mechanical projection of `$9.26` per 100 all-Zoning turns. Completed-turn latency was 13.920 seconds mean/p50, 15.074 seconds p90, and 15.363 seconds maximum.

This projection is not decision-ready. The run completed only two turns against the 20-turn minimum, stopped at the third case, and did not reach either changed remediation-successor-3 case. The result records `sampleReady: false`, `targetReady: false`, and `readyForPricingDecision: false`. The `$9.26` figure is a non-controlling partial signal. Remediation successor 2's `$20.18` failed-work-amortized projection per 100 all-Zoning turns and `$20.72` 100%-Zoning mixed-month p90 remain controlling for current risk planning.

## Decision and next gate

Retain this as an integrity-valid terminal partial diagnostic, not a complete 30-case v12 confirmation. Do not enable public Zoning Research or the evidence-budget candidate, change the `$20` price or 100-turn allowance, merge, push, or deploy from it. Semantic, reliability, cost, exact-release web/TestFlight physical-iPhone, and final public-release gates remain open.

The next step is no-cost diagnosis of the retained `zoning_missing_mapped_location` plus `zoning_map_inference` combination while preserving the current fail-closed map and parcel protections. Any later semantic rerun requires a materially justified repair, a distinct locked package, a new exact owner authorization for all 30 ordered cases and one repetition, and a new cumulative cap no higher than `$5`. This consumed authorization cannot be reused.

# Permitext Zoning Research — remediation successor 3 v11 confirmation result

Date: August 31, 2026

Source branch: `codex/zoning-research-beta1`

Authorization package commit: `8d075b442083db3536de0ff9e90372802ddeadaa`

Execution commit: `42f1429cc8f32f987788474e955f36918aef2658`

Machine-evidence commit: `d6e70fe7e`

Dataset SHA-256: `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`

Run ID: `eea4db77-5144-47b8-9a89-b364d1e973ca`

## Authorization and boundary

The owner explicitly authorized exactly package commit `8d075b442083db3536de0ff9e90372802ddeadaa` for all 30 ordered cases, one repetition, with a maximum cumulative API spend of `$5`. The only `permitext-sync-server` change from that locked package to execution commit `42f1429cc8f32f987788474e955f36918aef2658` was the fresh authorization record. Authorization ID `ee72ca2f-5410-4ce9-a6d6-30deb8ff5169` entered its durable, non-reusable attempt state before provider dispatch and is now consumed by this run.

Provider web support was disabled. The 24,000-character evidence candidate, public Zoning Research, deployment, merge, push, pricing or allowance changes, professional Zoning signoff, and customer charges remained disabled or unauthorized. The runner stopped after the first execution error. No second paid run is authorized.

## Retained terminal result

- Status: `partial`.
- Evidence preflight: 30/30 ready before provider dispatch.
- Attempted operations: three, in exact frozen order.
- Completed operations: two; both passed grading at 4.00/4.
- Failed operation: one; it failed closed before grading and did not consume a user turn.
- Unattempted operations: 27 because the stop-on-first-execution-error guard halted the run as designed.
- Paid requests: 10 settled and zero pending.
- Total settled and conservatively reconciled spend: `$0.304077`, below the `$5` cap.
- Production-operation cost: `$0.271585`, including `$0.096092` of failed closed work.
- Independent-judge cost: `$0.032492`.
- Charging integrity: two isolated evaluation turns were charged to the evaluation grant; the failed operation recorded `charged: false`; no customer account was involved.

Machine evidence:

- `permitext-sync-server/evals/results/2026-08-31T21-10-26-190Z-eea4db77-5144-47b8-9a89-b364d1e973ca.json` — SHA-256 `66542a5848ccb7113d73056fa078aee345f5ad7fdace63ed4578a71c817f794c`.
- `permitext-sync-server/evals/results/2026-08-31T21-10-26-190Z-eea4db77-5144-47b8-9a89-b364d1e973ca.md` — SHA-256 `67abb7849f5f4d275131fd820f6e483cd351e3fe918c8c5cc02f9381f5d12c5b`.
- `permitext-sync-server/evals/zoning-successor-remediation-3-v11-confirmation-paid-authorization.json` — consumed-state SHA-256 `3625175f43ec9d0977183569e8809fa838ad4a19504ac1222b2a7cd845a8df0a`.

## Case outcomes

Passed grading:

- `zr-rules-of-construction` — 4.00/4; three production requests; `$0.087325` production cost.
- `zr-use-group-table` — 4.00/4; three production requests; `$0.088168` production cost.

Failed closed before grading:

- `zr-appendix-map-boundaries` — two production requests; `$0.096092` failed-work cost; `RESEARCH_VERIFICATION_FAILED` after the initial answer and one bounded revision both encountered `zoning_missing_mapped_location`.

The remaining 27 ordered cases were not attempted. Neither case changed by remediation successor 3 reached execution, so this result does not semantically confirm either owner-approved correction.

## Privacy-bounded failure classification

Both retained attempt diagnostics recorded `sourceBoundaryQuestion: true`, `citedAppendixJ: true`, and `mappedLocationBoundaryPresent: true`. They did not record `zoning_missing_location_identifier`. The answer therefore included the required property-identifier and official-map boundary, but v11 classified many separate answer clauses as `directConclusion: true` and `sourceRule: false`.

No generated answer text, customer identifier, provider request identifier, or raw message content is needed for this classification. No-cost matched probes reproduced the failure across ordinary category-level descriptions of the two Appendix J paths while matched parcel-specific claims remained an independent rejection requirement. This classifies the stop as an over-broad deterministic source-rule recognizer, not a frozen case/evidence defect and not evidence that a parcel-specific conclusion should be allowed.

## Economics and reliability

The two completed production operations cost `$0.087747` mean/p50, `$0.088084` p90, and `$0.088168` maximum. Including failed production work gives `$0.135793` per completed turn and a mechanical projection of `$13.58` per 100 all-Zoning turns. Completed-turn latency was 25.510 seconds mean/p50, 34.233 seconds p90, and 36.414 seconds maximum.

This projection is not decision-ready. The run completed only two turns against the 20-turn minimum, stopped at the third case, and did not reach either changed remediation-successor-3 case. The result records `sampleReady: false`, `targetReady: false`, and `readyForPricingDecision: false`. The `$13.58` figure is a non-controlling partial signal. Remediation successor 2's `$20.18` failed-work-amortized projection per 100 all-Zoning turns and `$20.72` 100%-Zoning mixed-month p90 remain controlling for current risk planning.

## Decision and next gate

Retain this as an integrity-valid terminal partial diagnostic, not a complete 30-case v11 confirmation. Do not enable public Zoning Research or the evidence-budget candidate, change the `$20` price or 100-turn allowance, merge, push, or deploy from it. Semantic, reliability, cost, exact-release web/TestFlight physical-iPhone, and final public-release gates remain open.

The next step is no-cost repair and regression verification of the reproduced source-rule false positive. Any later semantic rerun requires a distinct locked package, a new exact owner authorization for all 30 ordered cases and one repetition, and a new cumulative cap no higher than `$5`. This consumed authorization cannot be reused.

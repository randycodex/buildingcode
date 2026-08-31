# Permitext Zoning Research — remediation successor 3 v13 confirmation result

Date: August 31, 2026

Source branch: `codex/zoning-research-beta1`

Authorization package commit: `39b8c62941022c07560ee746c29a60922907cb94`

Execution commit: `16ded32b122fc00c615b2d4b59dfc7520d2a9cfb`

Dataset SHA-256: `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`

Run ID: `b7227309-2c20-46ed-a641-dda9f6d3548d`

## Authorization and boundary

The owner explicitly authorized exactly package commit `39b8c62941022c07560ee746c29a60922907cb94` for all 30 ordered cases, one repetition, with a maximum cumulative API spend of `$5`. Execution commit `16ded32b122fc00c615b2d4b59dfc7520d2a9cfb` differed from the locked package only in the fresh authorization record. Authorization ID `dc46f544-f4f9-4085-b8f5-f29ab5412936` entered its durable non-reusable attempt state before provider dispatch and is now consumed by this run.

Provider web support was disabled. The 24,000-character evidence candidate, public Zoning Research, deployment, merge, push, pricing or allowance changes, professional Zoning signoff, and customer charges remained disabled or unauthorized. The runner stopped after the first execution error. No second v13 run is authorized.

## Retained terminal result

- Status: `partial`.
- Evidence preflight: 30/30 ready before provider dispatch.
- Attempted operations: three, in exact frozen order.
- Completed operations: two; both passed grading at 4.00/4.
- Failed operation: one; it failed closed before grading and recorded no failed user-turn charge.
- Unattempted operations: 27 because the stop-on-first-execution-error guard halted the run as designed.
- Paid requests: 10 settled and zero pending.
- Total settled and conservatively reconciled API spend: `$0.289697`, below the `$5` cap.
- Production-operation cost: `$0.263113`, including `$0.093516` of failed closed work.
- Independent-judge cost: `$0.026584`.
- Charging integrity: two isolated evaluation turns were charged to the evaluation grant; the failed operation did not consume a user turn; no customer account was involved.

Machine evidence:

- `permitext-sync-server/evals/results/2026-08-31T23-26-35-678Z-b7227309-2c20-46ed-a641-dda9f6d3548d.json` — SHA-256 `15bfc6d6bca27a650dace958fe33a4ac761a9176b00f06aba74586e666723315`.
- `permitext-sync-server/evals/results/2026-08-31T23-26-35-678Z-b7227309-2c20-46ed-a641-dda9f6d3548d.md` — SHA-256 `2a493aca160386123e7c44f4e426b05ffcb12ef417a8050977386a38a3684517`.
- `permitext-sync-server/evals/zoning-successor-remediation-3-v13-confirmation-paid-authorization.json` — consumed-state SHA-256 `1f5aff577b856a608edcf152df2ea93680eb70a7756b190917e387ed24175038`.

## Case outcomes

Passed grading:

- `zr-rules-of-construction` — 4.00/4; `$0.087567` production cost.
- `zr-use-group-table` — 4.00/4; `$0.082029` production cost.

Failed closed before grading:

- `zr-appendix-map-boundaries` — two bounded attempts; `$0.093516` failed-work cost; `RESEARCH_VERIFICATION_FAILED`. Both attempts encountered `zoning_missing_mapped_location`. The v12 revision-only `zoning_map_inference` issue did not recur.

The remaining 27 ordered cases were not attempted. Neither case changed by remediation successor 3 reached execution, so this result does not semantically confirm either owner-approved correction.

## Privacy-bounded failure classification

Both retained attempt diagnostics record `sourceBoundaryQuestion: true`, `citedAppendixJ: true`, and `mappedLocationBoundaryPresent: true`. Every retained triggering clause is recorded as `locationBoundary: false`, `sourceRule: false`, and `directConclusion: true`. V13's clause-local map-inference repair therefore removed the separate v12 map-inference false positive, but the source-rule/direct-conclusion classification still rejected the generated answer.

No generated failed-answer text, customer identifier, provider request identifier, or raw message content was retained. The evidence proves that v13 continued to fail closed at the third case. It does not prove that all triggering clauses were safe source rules or justify weakening the parcel safeguard. A fresh no-cost diagnosis must use only the bounded hashes, flags, approved prompt/evidence, and matched safe/unsafe controls; it must not reconstruct or rescore the unavailable answer.

## Economics and reliability

The two completed production operations cost `$0.084798` mean/p50, `$0.087014` p90, and `$0.087568` maximum. Including failed production work gives `$0.131556` per completed turn and a mechanical projection of `$13.16` per 100 all-Zoning turns. Completed-turn latency was 18.444 seconds mean/p50, 20.523 seconds p90, and 21.043 seconds maximum.

This projection is not decision-ready. The run completed only two turns against the 20-turn minimum, stopped at the third case, and did not reach either changed remediation-successor-3 case. The result records `sampleReady: false`, `targetReady: false`, and `readyForPricingDecision: false`. The `$13.16` figure is a non-controlling partial signal. Remediation successor 2's `$20.18` failed-work-amortized projection per 100 all-Zoning turns and `$20.72` 100%-Zoning mixed-month p90 remain controlling for current risk planning.

## Decision and next gate

Retain this as an integrity-valid terminal partial diagnostic, not a complete 30-case v13 confirmation. Do not enable public Zoning Research or the evidence-budget candidate, change the `$20` price or 100-turn allowance, merge, push, or deploy from it. Semantic, reliability, cost, exact-release web/TestFlight physical-iPhone, and final public-release gates remain open.

The next step is a no-cost diagnosis of the remaining `zoning_missing_mapped_location` classification while preserving the current fail-closed map and parcel protections. Any later semantic rerun requires a materially justified repair, a distinct locked package, a new exact owner authorization for all 30 ordered cases and one repetition, and a new cumulative cap no higher than `$5`. This consumed authorization cannot be reused.

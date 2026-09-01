# Permitext Zoning Research — remediation successor 3 v14 confirmation result

Date: August 31, 2026

Source branch: `codex/zoning-research-beta1`

Authorization package commit: `2c2c000571855bb9f1101d15be0c6bb53feb45c4`

Execution commit: `ff128db6aca10c454467c2b45219c95a4adee1c3`

Dataset SHA-256: `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`

Run ID: `6a100e20-a5d8-4f60-81b3-92c5ed1eaec6`

## Authorization and boundary

The owner explicitly authorized exactly package commit `2c2c000571855bb9f1101d15be0c6bb53feb45c4` for all 30 ordered cases, one repetition, with a maximum cumulative API spend of `$5`. Execution commit `ff128db6aca10c454467c2b45219c95a4adee1c3` differed from the locked server package only in the fresh authorization record. Authorization ID `1fa351ac-a897-4d80-9883-fa1854398cd8` entered its durable non-reusable attempt state before provider dispatch and is now consumed by this run.

Provider web support was disabled. The 24,000-character evidence candidate, public Zoning Research, deployment, merge, push, pricing or allowance changes, professional Zoning signoff, and customer charges remained disabled or unauthorized. The runner stopped after the first execution error. No second v14 run is authorized.

## Retained terminal result

- Status: `partial`.
- Evidence preflight: 30/30 ready before provider dispatch.
- Attempted operations: three, in exact frozen order.
- Completed operations: two; both passed grading at 4.00/4.
- Failed operation: one; it failed closed before grading and recorded no failed user-turn charge.
- Unattempted operations: 27 because the stop-on-first-execution-error guard halted the run as designed.
- Paid requests: nine settled and zero pending.
- Total settled and conservatively reconciled API spend: `$0.258424`, below the `$5` cap.
- Production-operation cost: `$0.224404`, including `$0.089324` of failed closed work.
- Independent-judge cost: `$0.034020`.
- Charging integrity: two isolated evaluation turns were charged to the evaluation grant; the failed operation did not consume a user turn; no customer account was involved.

Machine evidence:

- `permitext-sync-server/evals/results/2026-09-01T00-09-30-472Z-6a100e20-a5d8-4f60-81b3-92c5ed1eaec6.json` — SHA-256 `6dfda65a06c95ad0cdd90364b5cc28cae3801ce9fcaab09abfaf24c1f0926b8e`.
- `permitext-sync-server/evals/results/2026-09-01T00-09-30-472Z-6a100e20-a5d8-4f60-81b3-92c5ed1eaec6.md` — SHA-256 `de6902172aa86cdb3988961d2f655db316ea9eff4d129193b24693e103b50cc1`.
- `permitext-sync-server/evals/zoning-successor-remediation-3-v14-confirmation-paid-authorization.json` — consumed-state SHA-256 `8815940412be2456286e1f2034641c7a45979a145828bed5d55f4a750b883185`.

## Case outcomes

Passed grading:

- `zr-rules-of-construction` — 4.00/4; `$0.088430` production cost.
- `zr-use-group-table` — 4.00/4; `$0.046650` production cost.

Failed closed before grading:

- `zr-appendix-map-boundaries` — two bounded attempts; `$0.089324` failed-work cost; `RESEARCH_VERIFICATION_FAILED`. Both attempts encountered `zoning_missing_mapped_location`; no `zoning_map_inference` issue recurred.

The remaining 27 ordered cases were not attempted. Neither case changed by remediation successor 3 reached execution, so this result does not semantically confirm either owner-approved correction.

## Privacy-bounded failure classification

The initial attempt cited Appendix J and retained the overall map/location boundary, but all 10 triggering field clauses were classified as direct conclusions and none as source rules or location boundaries. The bounded revision cited Appendix J and produced two clauses recognized as source rules, including one supported-point explanation that was not a direct conclusion. However, the revision lost the required overall mapped-location boundary and retained other direct-conclusion triggers, so it still failed closed.

No generated failed-answer text, customer identifier, provider request identifier, or raw message content is needed for this classification. The evidence proves that the v14 prompt changed the retained diagnostic shape but did not produce a verified third answer. It does not justify weakening the parcel safeguard. A fresh no-cost diagnosis must use only the bounded hashes, flags, approved prompt/evidence, and matched safe/unsafe controls; it must not reconstruct or rescore the unavailable answer.

## Economics and reliability

The two completed production operations cost `$0.067540` mean/p50, `$0.084252` p90, and `$0.088430` maximum. Including failed production work gives `$0.112202` per completed turn and a mechanical projection of `$11.22` per 100 all-Zoning turns. Completed-turn latency was 16.295 seconds mean/p50, 16.773 seconds p90, and 16.892 seconds maximum.

This projection is not decision-ready. The run completed only two turns against the 20-turn minimum, stopped at the third case, and did not reach either changed remediation-successor-3 case. The result records `sampleReady: false`, `targetReady: false`, and `readyForPricingDecision: false`. The `$11.22` figure is a non-controlling partial signal. Remediation successor 2's `$20.18` failed-work-amortized projection per 100 all-Zoning turns and `$20.72` 100%-Zoning mixed-month p90 remain controlling for current risk planning.

## Decision and next gate

Retain this as an integrity-valid terminal partial diagnostic, not a complete 30-case v14 confirmation. Do not enable public Zoning Research or the evidence-budget candidate, change the `$20` price or 100-turn allowance, merge, push, or deploy from it. Semantic, reliability, cost, exact-release web/TestFlight physical-iPhone, and final public-release gates remain open.

The next step is a no-cost diagnosis of why the initial answer preserved the boundary while no source rule was recognized, and why the revision recognized bounded source rules while losing the required boundary. Any later semantic rerun requires a materially justified repair, a distinct locked package, a new exact owner authorization for all 30 ordered cases and one repetition, and a new cumulative cap no higher than `$5`. This consumed authorization cannot be reused.

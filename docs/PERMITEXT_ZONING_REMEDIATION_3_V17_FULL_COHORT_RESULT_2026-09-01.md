# Permitext Zoning Remediation Successor 3 — V17 Full-Cohort Result

Date: September 1, 2026

Branch: `codex/zoning-research-beta1`

Authorized package: `e0c1c5d2846707641a6352fcdf0a397736724fda`

Execution commit: `0b8c7dca4ef33cd70f2889a5d61eea2add02d993`

Evidence commit: `2bce676734458060967b63132439a2f06aa4483f`

Run ID: `d2fdc1c4-7099-430d-9d33-2b759021afd2`

Status: terminal full-cohort diagnostic; authorization consumed; semantic, reliability, and cost gates failed

## Outcome

The bounded continuation policy worked as designed. The run attempted all 30 ordered cases instead of stopping at the first safe verification failure. It retained 20 completed charged evaluation turns and 10 terminal `RESEARCH_VERIFICATION_FAILED` operations. Every failed operation recorded `charged: false`, at least one settled provider request, zero pending requests, and no telemetry failure. Web support remained disabled.

Seventeen of the 20 graded answers passed. Three completed answers failed the strict quality gate:

| Case | Score |
| --- | ---: |
| Amendment History | 3.70/4 |
| Insufficient rear yard equivalent on a deep through lot | 3.24/4 |
| Conversion of a pre-1991 C6-2 office building to 100 apartments | 3.94/4 |

Ten cases failed closed before grading. They expose multiple distinct verification groups: mapped-location/applicability boundaries, effective-date linkage, Zoning Lot definition branches, the lowered-yard measurement fact, parking-geography evidence limits, and the MIH historical-zoning-lot requirement. This is broader than the repeated Appendix J case-3 stop. The result does not justify weakening any deterministic safety rule or rescoring an unavailable failed answer.

## Integrity and spend

| Measure | Result |
| --- | ---: |
| Ordered operations retained | 30/30 |
| Completed and graded | 20 |
| Graded passes | 17/20 |
| Graded failures | 3/20 |
| Fail-closed operations | 10/30 |
| Failed operations charged | 0 |
| Paid provider requests | 99 |
| Pending provider requests | 0 |
| Actual diagnostic API spend | `$3.663231` |
| Authorized ceiling | `$5.00` |
| Web searches | 0 |

The actual diagnostic spend includes the separate evaluation judge. The production-cost projection below excludes that evaluation-only judge and uses the retained production Research operation ledger.

## Production economics

This is the first remediation-successor-3 result to satisfy the 20-completed-turn minimum, so it replaces the earlier two-turn mechanical projections and remediation-successor-2 partial sensitivity as the controlling all-Zoning operating-cost evidence.

| Measure | Result |
| --- | ---: |
| Completed-turn cost p50 | `$0.095714` |
| Completed-turn cost p90 | `$0.150298` |
| Maximum completed-turn cost | `$0.268037` |
| Failed-work operating cost | `$1.018470` |
| Amortized cost per completed turn | `$0.158562` |
| Projected production model cost per 100 completed all-Zoning turns | `$15.86` |
| Target band | `$4–$6` per 100 turns |
| Target result | above target; failed |

The sample is ready for the cost comparison, but not ready for a pricing or release decision: `sampleReady: true`, `targetReady: false`, and `readyForPricingDecision: false`. The `$15.86` projection is model cost before Apple commission, tax, refunds, infrastructure, or support. It does not change the existing `$20` price or 100-turn allowance. It also does not alter the separate V6 non-Zoning Research result of `$5.74` p50 and `$6.06` p90 per fully used 100-turn month.

## Evidence bindings

| Evidence | SHA-256 |
| --- | --- |
| Consumed authorization JSON | `5474123dc94e2c934eb556bc05e1bce823f743d1db39cde8f65cecfade1487aa` |
| Result JSON | `920312f79917d2ca2cf08ecc1b7b762c4339a446fc5a66a2f824ecfe39e67787` |
| Result Markdown | `62098900ff821939c0f30d85115617331843f31c8d27a89c8e23e006835ebec4` |
| Frozen cohort | `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc` |

The one-time authorization is consumed and cannot be reused. No retry is authorized.

## Decision and recommendation

Public Zoning Research remains disabled because all three controlling gates fail:

- semantic quality: 17/20 graded answers passed, not a clean cohort;
- reliability: only 20/30 operations completed; and
- cost: `$15.86` per 100 completed all-Zoning turns is above the `$4–$6` target.

The fastest safe Beta 1 path is to defer AI-assisted Zoning Research from the public Beta while keeping the existing Zoning Reader and Search capability. Core Construction Code Research can continue toward Beta 1 on its already passing V6 quality/economics evidence. This is a recommendation, not an executed scope change.

The alternative is a substantial Zoning redesign before another paid run: reduce irrelevant supplemental evidence, lower the 95% verification-revision rate, improve first-answer compliance with deterministic boundaries, and establish a lower-cost routing strategy without weakening quality. Repeating the same Terra-heavy V17 shape as V18 is not recommended and no additional paid run should be prepared from this result alone.

No public enablement, evidence-budget activation, price or allowance change, merge, push, deployment, TestFlight release, or final public release was authorized or performed.

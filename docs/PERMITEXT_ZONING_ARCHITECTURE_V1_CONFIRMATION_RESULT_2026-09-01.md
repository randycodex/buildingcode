# Permitext Zoning Architecture V1 — Successor Confirmation Result

Date: September 1, 2026

Run ID: `90f42d5b-b758-4df4-98af-933350f036e7`

Authorized package: `6f222ac1a0d5375cef14a3f10299d8b8e06b9112`

Execution commit: `5e3263505a33c2dff2055558be19e274aab5d36a`

Status: **ALL 30 ORDERED CASES ATTEMPTED ONCE; CONFIRMATION FAILED; AUTHORIZATION CONSUMED; NO RETRY AUTHORIZED**

## Direct answer

The Architecture V1 execution and safety controls worked, including the successor repair that allowed the run to continue after an exact prerequisite rejection. The architecture did not pass the Beta 1 confirmation gate.

All 30 frozen cases were attempted in order exactly once. The five cases expected to require project or official-map prerequisites stopped before provider access. Of the 25 generation-ready cases, 14 returned customer-ready answers and 11 were blocked by the bounded verifier for material omissions, scope errors, unsupported requirements, or unresolved applicability facts. The independent Terra judge passed 12 of the 14 delivered answers at `4.00/4.00`; two delivered answers failed at `3.89/4.00` and `3.06/4.00`.

This is useful evidence that the fail-closed system is operating. It is also evidence that the Luna-only answer path is not yet reliable enough for public Zoning Research. Public access, deployment, pricing or allowance changes, and the disabled 24,000-character candidate remain unauthorized.

## Terminal outcomes

| Outcome | Count | Interpretation |
| --- | ---: | --- |
| Full-score delivered answers | 12 | Passed every deterministic and semantic gate at `4.00/4.00` |
| Delivered quality failures | 2 | Reached judging but failed an exact rubric gate |
| Bounded-verifier blocks | 11 | Provider work settled, but no customer answer and no turn charge |
| Prerequisite boundaries | 5 | Rejected before provider access, with no customer answer and no turn charge |
| Total ordered operations | 30 | Complete cohort order, one repetition, no duplicates |

The 14 completed answers are `56%` of the 25 generation-ready cases. Twelve of 14 judged answers passed (`85.7%`), but only 12 of the 25 generation-ready cases both completed and passed (`48%`). Including the five correct prerequisite boundaries, 17 of 30 cases had an acceptable terminal outcome (`56.7%`). These rates do not clear the semantic or reliability gate.

The two judged failures were:

- `zr-candidate-b1-r6a-uap-insufficient-affordable-area`, `3.89/4.00`: the answer covered four of five required concepts but did not state the qualifying residential FAR calculation clearly enough.
- `zr-candidate-b1-deep-through-lot-vertical-yard`, `3.06/4.00`: the answer missed four of eight required concepts and made an unqualified compliance conclusion without resolving the regulated dimension/orientation and related applicability facts.

The 11 verifier-blocked cases were `zr-use-group-table`, `zr-amendment-history`, `zr-r7a-standard-height`, `zr-inner-transit-zone-new-unit-parking`, `zr-zoning-lot-contiguity-definition`, `zr-cellar-floor-area-definition`, `zr-candidate-b1-r6-parking-unverified-transit-zone`, `zr-candidate-b1-mx-nonadditive-far`, `zr-candidate-b1-nonconforming-warehouse-enlargement`, `zr-candidate-b1-c6-2-office-residential-conversion`, and `zr-candidate-b1-city-of-yes-transition`.

The five zero-request prerequisite boundaries were `zr-appendix-map-boundaries`, `zr-missing-location-facts`, `zr-mapped-district-missing`, `zr-through-lot-historic-shallow-condition`, and `zr-candidate-b1-mih-historical-zoning-lot`.

## Settled cost and routing ledgers

| Ledger | Requests | Actual USD | Pending |
| --- | ---: | ---: | ---: |
| Production answer and bounded verification | 28 | `$0.103877` | 0 |
| Evaluation-only Terra judge | 14 | `$0.288109` | 0 |
| Combined diagnostic | 42 | `$0.391986` | 0 |

The combined diagnostic stayed `$4.608014` below the authorized `$5` cap. Completed Production turns cost `$0.048093`; failed verifier work cost `$0.055784`. Amortizing all Production work across the 14 completed turns gives `$0.007420` per completed turn, or `$0.74` per 100. That is below the intended `$4`–`$6` operating band, but the economics sample is not ready because fewer than 20 turns completed and the failure rate is high. It does not authorize a pricing or allowance decision.

All 25 model-attempted cases used Luna first; no Production answer escalated to Terra and no full-answer rewrite ran. The separate judge used Terra for all 14 completed answers. Completed-turn latency was `11.154s` p50, `15.306s` p90, and `20.471s` maximum.

## Safety and charging integrity

- every prerequisite boundary recorded `status: rejected`, `charged: false`, zero provider requests, and zero pending requests;
- every verifier block recorded `status: failed`, `RESEARCH_VERIFICATION_FAILED`, `charged: false`, one or two settled provider requests, and zero pending requests;
- only the 14 completed and saved answers recorded `charged: true`;
- web support remained disabled;
- no non-allowlisted execution failure was continued;
- the run record is `partial` because not every case produced a passing answer, not because execution stopped early;
- the one-use authorization is consumed and the guard blocks re-dispatch.

## Evidence and integrity

- [machine result](../permitext-sync-server/evals/results/2026-09-01T14-35-20-650Z-90f42d5b-b758-4df4-98af-933350f036e7.json), SHA-256 `551ea803cb2e7758f9952874e2ea86dd31cb2b7c17abde3eb487a19f51a0cb0f`
- [review report](../permitext-sync-server/evals/results/2026-09-01T14-35-20-650Z-90f42d5b-b758-4df4-98af-933350f036e7.md), SHA-256 `a8c7730617681ea8b211fbc01167e54f084d26b26eac7e54dc77fbed112eef77`
- consumed authorization SHA-256: `74161dd63bc0f29487c1fb0bf5be62329226e9c43c1b9ea5a324fb1d2b143b2e`
- raw-evidence commit: `fd461ca9a`

The no-cost consumed-state guard binds the exact authorization, result files, run ID, execution commit, ordered operation count, terminal outcome counts, settled cost ledger, and failed/rejected charging rules. It also proves the consumed authorization cannot dispatch again.

## Controlling decision

Architecture V1 is retained as a successful execution-and-safety experiment and a failed quality/reliability confirmation. The next work is no-cost diagnosis of the 11 verifier-blocked answers and two judged failures, followed by a revised architecture and a distinct locked package if another paid confirmation is warranted. This result itself does not authorize another paid run, public Zoning Research, professional Zoning sign-off, merge, push, deployment, price or allowance changes, or the 24,000-character candidate.

# Permitext Zoning Architecture V2.1 — Confirmation Result

Date: September 1, 2026

Run ID: `06e55e77-4419-4732-b7ca-825afabc3bc2`

Authorized package: `0c5eda19a62b4873aebaf47ef015197a5d4f15e6`

Execution commit: `a1162d426fa77ee9036530296e3dd61a9efc6328`

Status: **ALL 30 ORDERED CASES ATTEMPTED ONCE; DELIVERED-ANSWER QUALITY IMPROVED; COMPLETION AND RELIABILITY GATES NOT CLEARED; AUTHORIZATION CONSUMED; NO RETRY AUTHORIZED**

## Direct answer

Architecture V2.1 made delivered answers materially more accurate and reduced the repair rate among delivered answers, but it did not make Zoning Research reliable enough for public Beta 1.

All 30 frozen cases reached exactly one terminal operation in order. Thirteen produced customer-shaped answers, five exhausted bounded verification without a customer answer or turn charge, and 12 stopped before provider use because required property, map, historical, or structured-table evidence was unresolved. The independent Terra judge passed 12 of 13 delivered answers (`92.3%`); eight received `4.00/4.00`, four passed at `3.69–3.84`, and one failed at `3.77/4.00`.

Compared with Architecture V2, delivered-answer pass rate improved from `76.2%` to `92.3%` and the bounded-repair rate among delivered answers fell from `42.9%` to `15.4%`. However, delivered answers fell from 21 to 13, verifier blocks rose from three to five, and pre-generation boundaries rose from six to 12 because six additional structured-evidence cases failed closed. The stricter architecture is safer and more accurate when it answers, but less useful because it answers too few cases.

## Terminal outcomes

| Outcome | Count | Interpretation |
| --- | ---: | --- |
| Delivered answers passing every required rubric | 12 | Eight full-score answers plus four required-rubric passes at `3.69–3.84` |
| Delivered quality failures | 1 | Reached judging but failed a material semantic gate |
| Deterministic verifier blocks | 5 | Provider work settled, but no customer answer and no turn charge |
| Prerequisite boundaries | 6 | Rejected before provider access and no turn charge |
| Structured-evidence boundaries | 6 | Rejected before provider access and no turn charge |
| Total ordered operations | 30 | Complete cohort order, one repetition, no duplicates |

Thirteen of the 24 cases classified as generation-ready by the no-cost preflight delivered an answer (`54.2%`). Thirteen of the 18 cases that reached provider work delivered an answer (`72.2%`). Twelve of 13 delivered answers passed, but only 12 of the full 30-case cohort both delivered and passed (`40.0%`).

The five verifier-blocked cases were:

- `zr-special-district-demolition`: the answer did not preserve the exact Special Downtown Brooklyn District scope;
- `zr-c3-professional-office`: the answer did not expressly preserve unresolved special-purpose-district, authorization, special-permit, or variance pathways;
- `zr-inner-transit-zone-new-unit-parking`: the bounded repair still failed to bind the zero-space result to the December 5, 2024 effective date and controlling source;
- `zr-zoning-lot-contiguity-definition`: the answer and repair omitted that a zoning lot may or may not coincide with an official tax-map lot;
- `zr-cellar-floor-area-definition`: the answer and repair did not bind the cellar rule to the controlling source or keep the lowered-yard measurement fact unresolved.

The sole delivered quality failure was `zr-candidate-b1-deep-through-lot-vertical-yard` at `3.77/4.00`. It remained useful enough to deliver, but did not satisfy every owner-approved semantic rubric.

## Cost and routing ledgers

| Ledger | Requests | Settled USD | Pending |
| --- | ---: | ---: | ---: |
| Production answers, verification, and bounded repairs | included in 42 | `$0.511598` | 0 |
| Evaluation-only Terra judge | included in 42 | `$0.299034` | 0 |
| Combined diagnostic | 42 | `$0.810632` | 0 |

The run finished `$4.189368` below the authorized `$5` cap. Every request settled and the conservative upper equals actual spend.

Completed Production turns averaged `$0.030796`; p50 was `$0.033287`, p90 was `$0.073006`, and the maximum was `$0.095542`. Failed Production work cost `$0.111250`. Amortizing all Production work across 13 completed turns gives `$0.039354` per completion, or `$3.94` per 100 completed turns. That projection is below the existing `$4–$6` target band, but the sample is not decision-ready because only 13 turns completed; `readyForPricingDecision` remains false.

Completed-turn latency was `15.283s` p50, `32.426s` p90, and `54.575s` maximum. Two of 13 delivered turns used the one permitted source-bounded repair (`15.4%`). Web support and the 24,000-character evidence candidate remained disabled, and no full-answer rewrite ran.

## Safety, charging, and one-use integrity

- all 30 cases were attempted once in the frozen order;
- all 13 completed answers recorded a customer charge and zero pending provider requests;
- all five verifier blocks recorded `RESEARCH_VERIFICATION_FAILED`, no customer charge, settled provider work, and zero pending requests;
- all 12 prerequisite or evidence boundaries recorded no customer charge, zero provider requests, and zero pending requests;
- public Research, deployment, professional sign-off, pricing or allowance changes, web support, and the 24,000-character candidate remained unauthorized;
- authorization ID `1dd05bd4-a98d-4b44-8de5-f0e2a79b890f` is consumed and cannot dispatch again.

## Evidence and integrity

- [machine result](../permitext-sync-server/evals/results/2026-09-01T21-37-38-497Z-06e55e77-4419-4732-b7ca-825afabc3bc2.json), SHA-256 `ac389904942b84b13a0934a6ea40cc46079de402f19ab1f0199491c093b1c9d6`
- [review report](../permitext-sync-server/evals/results/2026-09-01T21-37-38-497Z-06e55e77-4419-4732-b7ca-825afabc3bc2.md), SHA-256 `898b9c7e2a29685ea28220c79c7595e66542b4bcaf00d615c433ad0001a72323`
- consumed authorization SHA-256: `932db83353b6770cdb791a93628b970d0073bb89587b262c1ec9a0a1c2ff47d4`

The no-cost consumed-state guard binds the exact authorization, result files, run ID, execution commit, ordered operation count, outcome counts, settled cost ledgers, zero-pending state, and failed/rejected charging rules. It also proves that the consumed authorization cannot dispatch again.

## Controlling decision

This was the final planned paid 30-case architecture confirmation. Do not prepare or run another numbered package automatically.

The result does not clear public Zoning Research: delivered-answer quality improved, but customer-facing completion and reliability regressed and the cost sample is too small for a pricing decision. The next evidence should come from actual product behavior, including the owner's production Research example, and from professional review—not another repetition of this same paid cohort. Public Zoning Research remains disabled pending a deliberate product decision, exact-release web/iOS acceptance, physical-iPhone acceptance, and final owner approval.

# Permitext Research Commercialization — Current Plan

Last updated: August 27, 2026

Working branch: `codex/research-commercialization`

This is the current source of truth for the Research workstream. The parent Beta 1 plan is [PERMITEXT_BETA1_MASTER_PLAN.md](./PERMITEXT_BETA1_MASTER_PLAN.md).

## Objective

Ship a Research system that:

- uses Luna first and escalates difficult or failed answers to Terra;
- preserves Terra-level reliability on material code conclusions;
- costs no more than approximately $4–$6 per 100 fully used included turns;
- charges one user turn only for a successfully completed and saved answer;
- behaves consistently on web and iOS through the shared backend;
- keeps enacted text, Project facts, uncertainty, citations, and the non-official interpretation boundary visible.

## Completed

- [x] Added Luna-first / Terra-escalation routing and model-neutral user wording.
- [x] Added model, cost, latency, verification, and escalation telemetry.
- [x] Preserved one-charge-per-completed-user-question semantics; internal retries and provider failures do not consume additional turns.
- [x] Added deterministic citation, evidence-boundary, applicability, and answer-quality checks around the models.
- [x] Aligned Research trust, deletion, authority, and Project-context handling across web and iOS.
- [x] Added commercialization benchmark infrastructure, spend caps, frozen configuration, and completion checks.
- [x] Ran the first complete 20-case frozen hybrid cohort after restoring provider credit.
- [x] Recorded and pushed the benchmark report.

### First complete cohort result

- 20 of 20 Research operations completed; no provider failures.
- Operating answer cost: $1.069039 total, approximately $5.35 per 100 turns.
- Latency: 20.388 seconds p50 and 37.349 seconds p90.
- 9 cases passed every exact evaluation rubric.
- 11 cases completed but missed one or more expected qualifications, missing facts, or evidence-boundary statements.
- Full evaluation cost including the separate grader: $1.726035.

Retained report:

- `permitext-sync-server/evals/results/2026-08-27T21-53-23-508Z-bf772b34-fb6e-4b54-b303-7adab469edb5.md`

## In progress now

- [x] Preserve every Project fact explicitly marked unknown through initial generation and revision.
- [x] Treat owner/applicant claims, positions, assertions, and representations as facts requiring verification—not as proven project facts.
- [x] Give the verifier the same structured unresolved-fact map used by the answer model.
- [x] Strengthen the generic selected-evidence instructions so answers state what the supplied provision cannot establish and preserve material provisos or second-sentence rules.
- [x] Add no-cost contract tests for these safeguards.
- [x] Run the normal no-cost Research suites and the repository-wide `npm run check` gate.

The safeguards are committed and pushed, and the no-cost repository gate passes.

## Paid validation after the no-cost tests pass

- [x] Rerun only the previously failed cases under an explicit spend cap.
- [x] Review the new answers for both quality and cost; do not accept an evaluator score blindly where the legal conclusion is still questionable.
- [ ] If the targeted cases improve without regressions, run one new complete frozen cohort.
- [ ] Compare quality, p50/p90 latency, Luna/Terra escalation rate, and projected cost per 100 turns with the first cohort.

First targeted attempt: the Certificate-of-Occupancy case correctly remained uncharged but failed before grading because automatic web support routed around the intentionally disabled Zoning Research corpus and produced an attribution conflict. It cost $0.134553 in provider calls. The source-policy repair now prevents an intentionally blocked corpus from triggering automatic web support; explicit official-guidance requests remain available.

### Targeted rerun result

Eleven completed targeted cases were evaluated with prompt v30: the repaired Certificate-of-Occupancy case plus the ten remaining first-cohort failures. There were no provider failures.

- 5 passed every prior exact rubric gate.
- 6 scored from 3.65 through 3.96 out of 4 but failed at least one exact completeness item.
- Operating Research cost was $0.733283.
- Total evaluation cost including the independent Terra grader was $1.119755.

The review separated actual answer gaps from evaluator overreach. A conceptual omission, unsafe claim, unsupported citation, or materially inadequate uncertainty remains fatal. Missing-fact recognition now uses the existing 3-of-4 passing threshold rather than requiring every ancillary checklist item to appear verbatim; otherwise a useful 3.96 answer could fail solely for omitting a peripheral filing note. Three answers still have genuine required-concept gaps and remain targeted for repair: movable-seat approved-record context, sidewalk-cafe approved-capacity and electrical boundaries, and garage ventilation quantity/rate/capacity boundaries.

Prompt v31 adds a material-completeness review that names distinct approved records, quantities, rates, capacities, dimensions, system-design inputs, and expressly implicated technical or agency conditions instead of collapsing them into phrases such as “full design” or “other requirements.” It also prohibits irrelevant permit or agency checklist padding.

## Commercial decision gate

Proceed toward paid Research only if all of the following are true:

- [ ] No material forbidden claim or unsupported compliance conclusion remains.
- [ ] Exact citation and required-qualification behavior is acceptable.
- [ ] Provider failures and internal retries remain free to the user.
- [ ] Projected operating model cost is at or below the $4–$6 per 100-turn target, including realistic p90 usage.
- [ ] Web and the current iOS/TestFlight client both decode and display the shared response contract correctly.

If quality requires too many Terra calls to meet the cost target, reduce the included monthly allowance or create a higher Research tier. Do not silently subsidize Terra-only usage inside the current $20 plan.

## After the quality and economics gate

- [ ] Test and activate visible 25-turn and 100-turn purchase options on web and iOS.
- [ ] Calculate pack prices from measured p50 and p90 hybrid costs plus payment fees, taxes, refunds, infrastructure, support, and margin.
- [ ] Verify Stripe fulfillment, App Store consumables, restore/reconciliation, exhausted-allowance screens, and cross-platform balances end to end.
- [ ] Deploy the compatible backend first, verify production, then prepare and test the next iOS build.

## Deliberately deferred

- Zoning Research remains outside public Research until its citations, tables, maps, amendments, applicability, and evaluation gates are trustworthy.
- No production deployment, merge to `main`, TestFlight update, or public pricing change is part of the current remediation step.
- A larger AI-assisted blind evaluation set can be discussed after the current 20-case remediation is complete.

## Immediate next action

Pass the repository-wide no-cost gate for prompt v31, then rerun only the three remaining conceptual failures under a capped paid diagnostic. Run a new immutable full cohort only if those three improve without a material regression.

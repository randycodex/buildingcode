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

The first v31 diagnostic reran the three conceptual failures and showed that prompt wording alone was insufficient. Movable seating completed at 3.82, sidewalk café failed closed before charging because both the initial answer and its bounded revision misstated the dining-surface percentage, and the Luna garage answer completed at 3.64. Total provider and grader spend was $0.186111; only the two completed Research operations reached the charged-completion state. No further paid retry was made on the same implementation.

The resulting engineering changes are intentionally narrow and source-governed:

- the draft movable-seat rubric no longer requires Permitext to guess or name PACO authority that is outside the selected evidence;
- an objectively detected per-dining-surface percentage error is repaired only when the answer already cites the exact enacted BC 1108.2.9.1 passage, and the corrected point is bound to that passage;
- questions expressly asking what can and cannot be concluded route to Terra because they require material evidence-boundary judgment rather than a simple Luna lookup.

The next capped rerun passed movable seating at 3.79/4 and garage ventilation at 4.00/4. The sidewalk-café answer completed without a verification failure and scored 3.83/4; direct review found that it correctly covered every supplied provision and safety boundary. Its only fatal draft rubric combined those material requirements with heater, lighting, and electrical topics absent from both the question and selected evidence. That unreviewed draft rubric is being narrowed to the actual bounded question rather than forcing unrelated checklist content into user answers.

After the draft rubric was narrowed, the final sidewalk-only diagnostic completed and charged normally but scored 3.62/4. This exposed a real product defect rather than another evaluation-scope problem: the internal verifier accepted two source paraphrases that were not precise enough. The answer substituted an accessible “dining surface” for the enacted requirement governing accessible seating and standing spaces, and it broadened BC 3111.4 from the enumerated awning, enclosure, fixture, equipment, and removable-platform components to “furniture or equipment.” The Research operation cost $0.079986; total diagnostic cost including the independent grader was $0.131224.

The new source-bound paraphrase repair corrects those two statements only when the answer already cites the exact enacted BC 1108.2.9.1 or BC 3111.4 evidence. It also corrects the associated structured missing-fact text and makes the internal quality gate reject the dining-surface substitution if the repair is ever bypassed. The retained paid answer now passes the deterministic answer-quality gate after repair, and the complete repository-wide `npm run check` gate passes without paid model calls.

The final capped sidewalk-only confirmation passed 4.00/4: 9/9 required concepts, 11/11 required missing-fact conditions, all five required citations, and no unsupported claim or critical failure. The production Research turn took 40.285 seconds and cost $0.083952; total diagnostic cost including the independent grader was $0.131864. It used Terra for the complex answer, Luna verification, and one bounded repair for a false evidence-limitation statement. This clears the final targeted blocker for a new frozen cohort.

### Frozen v2 cohort attempt

The immutable v2 cohort began from commit `de87dbc07780c597dde6f65cfb94f7457d433148` with 20/20 cases evidence-ready. It is retained as a partial operational diagnostic, not a quality or commercialization result:

- 11 Research turns completed: 8 passed and 3 were subthreshold.
- The mixed-occupancy plumbing answer misstated the division of authority between the Building Code and Table 403.1 and did not state the shared-facility evidence boundary directly.
- The legacy fire-alarm answer did not state clearly that a separate qualifying building/occupancy-wide trigger cannot automatically be confined to the enlarged portion.
- The garage answer correctly rejected the proposed controls but again hid detector quantity, airflow rate, and capacity inside a generic full-design limitation.
- Case 12 timed out at the provider. The next eight cases encountered immediate network/provider failures; all nine failed turns remained uncharged.
- Actual settled evaluation cost was $0.985185. Because requests without a billable response cannot safely be assumed free, 19 failed-attempt reservations remained conservative and brought the recorded upper bound to $3.935989 under the $4.00 cap.

The provider client now reports nested network causes instead of only `TypeError`, and future frozen cohorts stop on the first case error so one outage cannot cascade across the remaining suite. The incomplete evidence is retained at `permitext-sync-server/evals/results/2026-08-27T23-21-46-942Z-b53d4522-4a59-49cb-b625-47760ffa7a37.md`.

### Targeted v2 remediation confirmation

After the provider health check succeeded, the three subthreshold v2 cases were rerun separately through the production Research path with a $0.75 per-case cap and stop-on-error enabled:

- mixed-occupancy plumbing passed 4.00/4 in 35.604 seconds; the Research operation cost $0.092032 and the full diagnostic including the independent grader cost $0.123114;
- legacy fire-alarm scope passed 3.84/4 in 26.518 seconds; the Research operation cost $0.049017 and the full diagnostic cost $0.090223; all required concepts, missing facts, and citations passed, with only a nonmaterial citation-relevance description losing one point;
- garage ventilation controls passed 4.00/4 in 13.316 seconds; the Research operation cost $0.023273 and the full diagnostic cost $0.042860.

The three Research operations cost $0.164322 in total and the complete diagnostics cost $0.256197. None produced a provider error, unsupported claim, forbidden claim, or critical failure. These targeted results clear the three v2 defects for a new frozen cohort; they do not replace the required complete cohort.

### Frozen v3 cohort attempt

The immutable v3 cohort began from remediated application commit `ac024f04788ae7552e98198c4db9813437691c26`. It passed the former provider-timeout point and is retained as another partial operational diagnostic:

- 15 Research turns completed: 14 passed and one was marked failed only because an otherwise correct English answer ended one missing-fact sentence with a stray Armenian word.
- The three v2 remediation cases passed again: mixed plumbing 4.00/4, legacy fire alarm 3.68/4 with all required gates satisfied, and garage ventilation 4.00/4.
- Case 16 failed safely after both the initial answer and bounded revision put an automatically retrieved web-guidance statement inside enacted-code supported points. No user answer was returned and the turn was not charged.
- The case expressly asked for a conclusion “Based on” four named Administrative Code provisions. Automatic web support was unnecessary for that bounded question and increased cost and attribution risk.
- Completed-turn operating cost was $0.932010. The failed verification consumed $0.121499 of provider work, bringing total operating cost to $1.053509. The incomplete sample's projected $7.02 per 100 turns is not a commercialization result because it amortizes that failed turn over only 15 completions.
- Completed-turn latency was 24.771 seconds p50 and 36.407 seconds p90.

Permitext now treats an express “Based on [named provisions]” question as section-bounded unless the user also requests an external lookup. English Research narrative sanitation also removes isolated letters from other writing systems while preserving Latin text, numbers, punctuation, symbols, and units. The partial evidence is retained at `permitext-sync-server/evals/results/2026-08-27T23-55-01-805Z-d91a79dc-85f5-4e76-9374-0d477c1cdcbe.md`.

The targeted occupancy confirmation then passed 4.00/4 in 45.936 seconds. Telemetry confirmed that web support was neither requested nor searched, with `selected_evidence_boundary` recorded as the reason. The Research operation cost $0.119429 and the full diagnostic including the independent grader cost $0.150251. One bounded repair removed an improper request to reconfirm an established Project fact. This clears the v3 fail-fast blocker for a new frozen cohort.

### Frozen v4 cohort attempt

The immutable v4 cohort began from the section-bounded and English-sanitation fixes and stopped safely when the OpenAI API credit balance was exhausted:

- 18 Research turns completed: 17 passed every exact rubric gate and one scored 3.47/4 because it applied BC 1101.3.1 categorically while prior-code-building status remained an unverified applicant representation.
- All 16 cases preceding that answer passed, including every prior v2 and v3 remediation case. The next roof-recovering case also passed 4.00/4.
- Case 19 received `credit_balance_exhausted`; the failed user turn was not charged, and case 20 was not attempted because stop-on-error was active.
- Completed-turn operating cost was $1.108311. The recorded $1.449590 operating upper bound includes a conservative $0.341280 reservation for the failed provider request and therefore is not a valid projected cost-per-100 result.
- Completed-turn cost was $0.046152 p50 and $0.116791 p90. Latency was 26.260 seconds p50 and 42.932 seconds p90.
- The incomplete sample cannot decide pricing or the 100-turn allowance because it contains only 18 completed turns and one unresolved provider reservation.

The retained partial evidence is `permitext-sync-server/evals/results/2026-08-28T00-17-54-753Z-e737d550-b07d-4e8d-9f7b-4bf9e8853009.md`.

The BC 1101.3.1 defect is now covered by a generic deterministic consistency gate. When supplied BC 1101.3 ancestor text limits the descendant rule to prior-code buildings and that status remains represented or unresolved, every project-specific accessibility consequence must remain conditional on confirming the prior-code-building and alteration/change context. The answer prompt and independent verifier carry the same boundary. The saved v4 answer now fails that local gate, while a properly conditional answer passes. The affected case is evidence-ready through Permitext's conversation flow in mock mode without a paid model call.

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

Complete the no-cost repository gate and commit the v4 evidence plus the BC 1101.3.1 safeguard. After the OpenAI API account has available credit, run one capped targeted confirmation of the repaired mercantile-to-business case and the provider-interrupted BC 1019.3 case. If both pass, create a new immutable v5 profile and run all 20 cases under the $4.00 hard cap with stop-on-error. Use only a complete cohort to decide quality, p50/p90 latency, hybrid routing behavior, and projected cost per 100 turns. Do not proceed to public paid Research while full-cohort evidence remains incomplete.

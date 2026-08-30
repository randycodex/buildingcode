# Permitext Zoning Research — successor failure triage

Date: August 30, 2026

Status: **NO-COST TRIAGE COMPLETE; ONE OWNER ANSWER-KEY DECISION AND SEMANTIC CONFIRMATION OPEN**

This record classifies every failure in retained run `5480ed8f-6d0c-46b1-a108-d12e8e13b7da` without changing that immutable result. It records only no-cost code, source, and contract analysis. No model call, new paid authorization, price or allowance change, merge, push, deployment, or public Zoning enablement occurred.

## Graded failures

### Evaluator defects — product answers were not disproved

| Case | Finding | No-cost repair |
| --- | --- | --- |
| `zr-use-group-table` | The answer correctly cited both the selected prose/table passage and the separately selected canonical structured table. The evaluator knew the second source ID was in Permitext's evidence package but compared its text only with `exactPassages`, so it falsely rejected the structured-table citation. | The Zoning adapter now exposes the exact independently reviewed structured text as `reviewedStructuredPassages`; deterministic citation validation and the judge receive it without trusting model-authored text. |
| `zr-r7a-standard-height` | The same evaluator blind spot rejected two canonical structured-table passages. Its semantic dimensions otherwise passed. | Same source-independent structured-passage repair. |
| `zr-amendment-history` | Permitext supplied and cited official amendment-history metadata, but the evaluator discarded that same-section structured passage and showed the judge only current ZR 42-00 prose. The judge then penalized the answer for using metadata it had not been shown. | The adapter now supplies the exact reviewed amendment-history text independently. The original judge result is not retroactively changed; a later authorized run must confirm the repaired judge input. |

The regression keeps forged-passage checks intact: a structured citation passes only when its text matches the separately reviewed adapter record, and a mutated structured passage still fails.

### Product completeness defects — new deterministic safeguards added

| Case | Retained defect | New no-cost safeguard |
| --- | --- | --- |
| `zr-missing-location-facts` | The answer requested the dated lot-area fact but omitted the separately unresolved December 19, 2017 existing-facility/use status and its possible distinct paths. | A dated existing facility/building/use condition expressly left unresolved by the question must now be named separately in `missingFacts`. |
| `zr-r7a-lot-coverage` | The arithmetic was correct, but `8,000 square feet permitted coverage` could read as an entitled footprint and omitted independently applicable yard/open-area constraints. | A basic lot-coverage calculation must be described as a numerical cap, with independently applicable yard, open-area, or other bulk rules preserved. |
| `zr-zoning-lot-contiguity-definition` | The answer addressed the historical single-ownership route and current routes but omitted the separate historical lot-of-record branch. | When the supplied Zoning Lot definition contains branches (a) through (d), the historical lot-of-record branch must be addressed independently. |
| `zr-cellar-floor-area-definition` | The answer began `Yes` while concluding the storage cellar did not count, and it dismissed rather than preserved the unresolved post-December 5, 1990 lowered-yard measurement rule. | The gate detects a direct yes/no polarity conflict for the question's `count as` predicate and separately requires the lowered-yard fact in `missingFacts` when the selected definition contains that unresolved clause. |
| `zr-candidate-b1-r6-parking-unverified-transit-zone` | The Inner/Outer/beyond-Greater calculations were correct, but the answer only defined special parking areas as part of Greater Transit Zone and did not say a separately applicable special parking area or special district could change the result. | Parking-geography answers must preserve a supplied special-parking-area or special-district path as a potentially different route, not merely repeat its name. |

The retained answers for all five cases reproduce the new issue types in a no-cost post-run check. That check is diagnostic only and does not rescore the frozen paid result.

### Answer-key/evidence defect — owner disposition required

`zr-candidate-b1-deep-through-lot-vertical-yard` is not a product-answer failure on the selected evidence. The frozen successor key names unselected `ZR 24-382`, a 180-foot trigger, and a midpoint tolerance of five feet. The case actually selects current `ZR 23-343`, whose supplied text uses a 190-foot trigger, a height tier, and a midpoint tolerance of 10 feet. Permitext applied the selected current evidence and the judge expressly recognized that mismatch.

The no-cost preflight now detects any explicit `ZR ...` answer-key reference absent from the selected evidence. It reports this case `BLOCKED` and stops a future live run before its first model request. Current successor preflight is therefore intentionally 29/30, not 30/30.

Recommended owner disposition: replace only this case's expected conclusion and required concepts with the source-bound ZR 23-343 result already reflected in the retained answer—60 feet above 75 feet for the stated 200-foot depth, midpoint or within 10 feet, a 30-foot deficiency only if the supplied dimension is the regulated depth, and preserved geometry, exception, and obstruction uncertainty. Do not change the frozen run or prior successor in place; create a separately versioned remediation successor after approval.

## Execution failures

| Case | Classification | Current no-cost disposition |
| --- | --- | --- |
| `zr-candidate-b1-c6-2-office-residential-conversion` | Reliability: invalid structured response after the existing bounded retry. The retained aggregate metric proves two provider requests but did not preserve whether the last response was provider-incomplete, unparseable, or rejected by interpretation/evidence-binding validation. The nine selected sections are within the existing 12-point schema bound, so there is no deterministic case-size rejection. | The existing single structured retry now explicitly requests concise, non-repetitive schema content. Privacy-safe operation telemetry now records only `provider_incomplete`, `structured_output_parse`, `interpretation_validation`, or `evidence_binding_validation`, plus the provider's safe incomplete reason when available; it retains no question, answer, evidence, or raw response. Exact historical subcause is not recoverable from the frozen run, so end-to-end confirmation remains open and no extra retry or paid diagnostic was added. |
| `zr-candidate-b1-city-of-yes-transition` | Safe-boundary delivery: both revisions omitted the explicit need for verified dated prior substantive Zoning text, so the verifier correctly refused the answer. | A deterministic, non-substantive boundary repair now appends that current transition text may preserve prior rules without reproducing them and identifies the dated enacted or official archived pre-amendment text needed. The eligibility conclusion remains model/source bound. Semantic confirmation is still open. |
| `zr-candidate-b1-mih-historical-zoning-lot` | Verifier interaction: the scenario expressly establishes MIH-area status, but the final revision was rejected for lacking an address/BBL as if mapped MIH status were unknown. The retained aggregate issue classes also show repeated-fact, fact/evidence, and missed-material-conclusion failures. | Explicitly confirmed MIH-area status now counts as the supplied mapped fact, removing the contradictory location demand. A case-matched deterministic regression separately rejects (1) granting the exception from the unit and floor-area thresholds alone, (2) treating current tax lots or their 2025 combination as proof of the historical zoning lot, and (3) omitting official evidence of both the MIH establishment date and historical zoning-lot configuration. The no-cost contract passes; end-to-end semantic confirmation remains open. |

## Verification completed without provider spend

- Zoning adapter contract passes with canonical structured table and amendment metadata supplied independently to scoring.
- Research evaluator self-test accepts exact reviewed structured text and rejects a mutated replacement.
- Zoning safety v4 contract passes the five observed graded product-defect regressions, the complete case-matched MIH historical-lot regression, and deterministic historical-text boundary repair.
- The broader Research safety suite passes with no paid calls.
- Current successor preflight stops at 29/30 solely because the deep-through-lot key names unselected ZR 24-382.
- Future invalid-answer operations distinguish the structured failure stage in aggregate-only telemetry; the retained office operation cannot be retroactively classified.
- Public Zoning Research remains disabled and the prior one-time authorization remains consumed.

## Next gate

1. Obtain the owner's exact disposition for the deep-through-lot key; do not infer professional Zoning approval.
2. Retain the office aggregate diagnostic improvement; the three execution-failure paths still need a later authorized semantic confirmation, and the office historical subcause cannot be recovered from the frozen result.
3. Retain the 24,000-character evidence-budget candidate as disabled while completing no-cost reliability and cost work.
4. Freeze a new exact remediation successor only after any substantive key change is approved.
5. Require a new explicit one-run authorization and cumulative cap for any semantic confirmation.

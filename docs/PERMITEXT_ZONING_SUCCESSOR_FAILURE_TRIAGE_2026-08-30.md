# Permitext Zoning Research — successor failure triage

Date: August 30, 2026

Status: **NO-COST TRIAGE COMPLETE; THREE OWNER CASE DISPOSITIONS AND SEMANTIC CONFIRMATION OPEN**

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

### Answer-key/evidence blockers — owner dispositions required

The strengthened adapter now recognizes bare `Section`, grouped `Sections`, section-symbol, ranged, suffix, and Appendix forms, not only references explicitly prefixed by `ZR`. That exposes two additional frozen-key mismatches:

| Case | Fail-closed finding | Recommended narrow disposition |
| --- | --- | --- |
| `zr-special-district-demolition` | A required concept names unselected ZR 101-70 while the selected ZR 101-04 passage already establishes that ZR 101-75 applies in the Atlantic Avenue Subdistrict. | Rephrase only that scope concept to say selected ZR 101-04 establishes the applicability of selected ZR 101-75. Preserve the question, selected evidence, substantive prerequisites, exception, and forbidden claims. |
| `zr-narrow-attached-rear-yard` | A required concept names unselected ZR 23-34 while selected ZR 23-342 itself states the shallow-lot modification and preserves other exceptions. | Rephrase only the exception concept to preserve the selected shallow-lot modification and separately evidenced exceptions without naming unselected ZR 23-34. Preserve the question, 30-foot rule, 10-foot deficiency, selected evidence, and forbidden claims. |

These are not product-answer failures. They are frozen answer-key/evidence inconsistencies and require explicit owner approval before a separately versioned successor changes either concept.

Case `zr-candidate-b1-deep-through-lot-vertical-yard` has the third, substantive applicability blocker. The selected `ZR 23-343` supplies the residential branch's 190-foot threshold, 40-foot requirement at or below 75 feet, 60-foot requirement above 75 feet, and midpoint tolerance of 10 feet. The frozen successor key instead imports unselected Chapter 4 rule `ZR 24-382`, so it cannot be substantiated from the supplied record. A later official-source re-audit also found that the frozen question never says whether the zoning lot contains a community-facility use; under `ZR 24-31`, that missing fact can make the Chapter 4 path material. The record therefore supports the selected residential branch but does not establish it as the only possible branch. Full source audit: [PERMITEXT_ZONING_CASE23_APPLICABILITY_AUDIT_2026-08-30.md](./PERMITEXT_ZONING_CASE23_APPLICABILITY_AUDIT_2026-08-30.md).

The no-cost preflight reports all three cases `BLOCKED` and stops a future live run before its first model request. Current successor preflight is therefore intentionally 27/30, not 30/30.

Recommended owner disposition: keep this a narrow residential case by adding the explicit fact that the building and zoning lot contain no community-facility use, then replace only its expected conclusion and required concepts with the ZR 23-343 result—40 feet at or below 75 feet, 60 feet above 75 feet, respective 10-foot and 30-foot deficiencies if the supplied dimension is the regulated depth, 25 vertical feet in the upper tier, and midpoint or within 10 feet. Preserve the selected evidence, existing forbidden claims, every other question fact, geometry/exception/obstruction uncertainty, and all other cases. The broader alternative would require adding the Chapter 3/4 applicability sections and revising the missing-fact and forbidden-claim fields to evaluate both branches. Do not change the frozen run or prior successor in place; create a separately versioned remediation successor only after explicit approval of one coherent scope.

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
- Current successor preflight stops at 27/30 because three keys name unselected ZR 101-70, 23-34, or 24-382; current Case 23 applicability review confirms the selected ZR 23-343 residential branch while recording community-facility status as an unresolved material fact in the frozen question.
- The separate no-cost 27/30 ready-case evidence-budget advisory preserves every exact selected and deterministic required section at the disabled 24,000-character candidate, binds counted stored passage text to its content hashes and the implementation source state, records a 28.8% average evidence-character reduction plus identity and passage-hash differences, and makes no semantic or cost-acceptance claim.
- Future invalid-answer operations distinguish the structured failure stage in aggregate-only telemetry; the retained office operation cannot be retroactively classified.
- Public Zoning Research remains disabled and the prior one-time authorization remains consumed.

## Next gate

1. Obtain the owner's exact approval for all three source-bound case dispositions: the two narrow concept rephrasings above and one coherent Case 23 scope—preferably the narrow residential-only fact plus ZR 23-343 replacement recorded in the applicability audit; do not infer professional Zoning approval.
2. Retain the office aggregate diagnostic improvement; the three execution-failure paths still need a later authorized semantic confirmation, and the office historical subcause cannot be recovered from the frozen result.
3. Retain the 24,000-character evidence-budget candidate as disabled; its ready-case advisory is complete, but the corrected full successor and semantic comparison remain open.
4. Freeze a new exact remediation successor only after all three case corrections are approved.
5. Require a new explicit one-run authorization and cumulative cap for any semantic confirmation.

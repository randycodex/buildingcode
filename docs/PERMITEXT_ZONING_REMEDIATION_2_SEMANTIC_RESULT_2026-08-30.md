# Permitext Zoning Research — remediation successor 2 semantic result

Date: August 30, 2026
Source branch: `codex/zoning-research-beta1`
Source commit: `98c383b45fbd4f80f56cfc409c150af85d38c096`
Dataset SHA-256: `459b2273b7ebd209d4519bf9206b6135dc2fc7706052fa9b333c4bf5e63e8a8b`
Run ID: `f35eed33-cb4e-4b7b-a719-86b072271660`

## Authorization and boundary

The owner explicitly authorized exactly one complete run of all 30 ordered remediation-successor-2 cases, one repetition, with a maximum cumulative API spend of `$5`. The separate exact-SHA authorization was committed before execution and automatically changed from `authorized` to `consumed` after the runner retained exactly one machine-result file.

This authorization did not enable the disabled 24,000-character evidence candidate, public Zoning Research, deployment, merge, push, pricing or allowance changes, professional Zoning sign-off, or customer charges. No second paid run is authorized.

## Retained result

- Status: `partial`.
- Evidence preflight: 30/30 ready before the first provider request.
- Operations: 30 total; 15 completed and 15 failed closed.
- Reliability: 50% completion; the 20-completed-turn minimum was not met.
- Graded answers: 13 passed and two failed, or 13/15 among completed answers.
- Provider requests: 84 settled; 69 production-path requests and 15 independent grader requests; zero pending.
- Total paid evaluation spend: `$3.357895`, including independent grading, under the `$5` cap.
- Production operating cost: `$3.026264`; failed production work cost `$1.738294`.
- Completed-turn operating cost: `$0.085865` mean, `$0.086199` p50, `$0.150451` p90, and `$0.167127` maximum.
- Failed-work-amortized operating cost: `$0.201751` per completed turn, projecting `$20.18` per 100 all-Zoning turns.
- Charging integrity: all 15 completed turns were charged to the isolated evaluation grant; all 15 failed operations were uncharged; no customer was involved.

Machine evidence:

- `permitext-sync-server/evals/results/2026-08-30T22-42-25-264Z-f35eed33-cb4e-4b7b-a719-86b072271660.json`
- `permitext-sync-server/evals/results/2026-08-30T22-42-25-264Z-f35eed33-cb4e-4b7b-a719-86b072271660.md`

## Case outcomes

Passed grading:

- `zr-rules-of-construction`
- `zr-use-group-table`
- `zr-appendix-map-boundaries`
- `zr-special-district-demolition`
- `zr-amendment-history`
- `zr-r7a-standard-height`
- `zr-through-lot-historic-shallow-condition`
- `zr-c3-professional-office`
- `zr-inner-transit-zone-new-unit-parking`
- `zr-new-divided-zoning-lot`
- `zr-nonconforming-use-discontinuance`
- `zr-candidate-b1-mx-nonadditive-far`
- `zr-candidate-b1-nonconforming-warehouse-enlargement`

Completed but failed grading:

- `zr-missing-location-facts` — one required concept was not fully covered.
- `zr-zoning-lot-contiguity-definition` — one required concept was not fully covered.

Failed closed before grading:

- `zr-mapped-district-missing`
- `zr-r7a-standard-far`
- `zr-r7a-affordable-far-qualification`
- `zr-r7a-lot-coverage`
- `zr-narrow-attached-rear-yard`
- `zr-residential-building-spacing`
- `zr-c4-4-residential-use`
- `zr-cellar-floor-area-definition`
- `zr-candidate-b1-r6a-uap-insufficient-affordable-area`
- `zr-candidate-b1-deep-through-lot-vertical-yard`
- `zr-candidate-b1-r6-parking-unverified-transit-zone`
- `zr-candidate-b1-r7a-r8a-weighted-far`
- `zr-candidate-b1-c6-2-office-residential-conversion`
- `zr-candidate-b1-city-of-yes-transition`
- `zr-candidate-b1-mih-historical-zoning-lot`

The corrected Special District case passed. The corrected narrow-rear-yard and deep-through-lot cases did not reach grading because a separate over-broad deterministic definition trigger rejected them. The City-of-Yes and MIH cases also failed closed, so their earlier source and wording repairs are not end-to-end acceptance evidence.

## Failure classification and no-cost follow-up

Ten operations recorded `zoning_definition_branch_omission`. One was the actual Zoning Lot definition case and completed after revision. The other nine merely used “zoning lot” as a project noun; requiring every ZR 12-10 formation branch was unrelated to their questions and caused all nine to fail closed.

Three operations recorded the MIH historical-lot requirement. The actual MIH small-development case properly required that safeguard. Two unrelated affordable-housing questions inherited it only because their evidence packages contained the MIH provision; both failed closed.

Zoning safety v6 narrowed the definition-branch trigger to questions that actually ask how tax lots or lots of record form a zoning lot, and narrowed the MIH historical-lot trigger to questions that actually ask about the MIH small-development exception or its thresholds. Counterexamples cover ordinary FAR, lot-coverage, building-spacing, residential-use, and outside-MIH affordable-housing questions. All 15 retained completed answers replayed through v6 with zero deterministic issues at that checkpoint. This no-cost repair directly addresses false-positive triggers implicated in ten failed operations, but it does not change or rescore the immutable paid result and does not prove those operations would complete on another run.

Independent parallel no-cost review then justified Zoning safety v7:

- full and abbreviated dates are treated as equivalent only when tied to the same filing, permit, approval, foundation, certificate, or amendment event and a compatible before/after/on relationship; negated dates, unrelated `Co` text, and common certificate-of-occupancy aliases have direct counterexamples;
- an exact bare `No` remains unsafe for an unresolved MIH exception, while `No final qualification determination can be made` is not misclassified as a categorical denial;
- bounded cross-sentence MIH historical-lot and tax-lot coreference is accepted, while each historical evidence request must bind a concrete title, survey, deed, declaration, legal-description, ownership, configuration, or equivalent record class to a historical date or context without borrowing an unrelated current record;
- a positive statement that a mapped district or official map is required before a determination is recognized as a boundary rather than a categorical parcel conclusion, while clause-local grants, street-address questions, and compact BBL questions remain fail-closed when mapped status is unresolved;
- an answer that already acknowledges the source-established post-December 5, 1990 lowered-yard uncertainty can place it in `missingFacts` once and idempotently, while unconditional direct or supporting cellar conclusions remain failed;
- mere evidence that a Greater Transit Zone includes special parking areas cannot be converted into a unique special-parking result; the answer must disclose the missing rule and request the controlling enacted provision; and
- actual Zoning Lot formation questions require the selected-evidence distinction that a zoning lot may or may not coincide with a lot shown on the official tax map, and a correct sentence cannot mask a later categorical nonidentity overstatement.

That review also found two frozen case/evidence defects that were not changed. `zr-missing-location-facts` asks for an existing-facility conforming/nonconforming-law concept that its selected evidence does not supply; the narrow recommendation is to keep the December 19, 2017 lot-area fact and remove that concept unless separately reviewed enacted authority is added. For the alternative claimed by `zr-candidate-b1-r6-parking-unverified-transit-zone`, selected ZR 12-10 evidence establishes only that the Greater Transit Zone includes special parking areas; no selected passage supplies the unique special-parking rule or any special-district provision. A successor must add reviewed enacted authority or narrow the rubric, and should remove the unsupported special-district requirement. These changes require owner-approved successor governance.

The five execution paths remain unconfirmed: the mapped-district boundary, cellar lowered-yard fact, parking evidence/retrieval path, City-of-Yes web-attribution/effective-date path, and the actual MIH historical-lot path. The failed answer bodies were not retained, so exact terminal wording cannot be reconstructed safely. The two graded failures also remain unconfirmed; v7 adds a direct contract for the Zoning Lot tax-map concept but does not rescore the answer.

## Updated subscriber sensitivity

The latest failed-work-amortized sample materially worsens the preliminary 100-turn sensitivity:

| Zoning share | Provider p90 | Web p90 contribution | iOS 15% p90 contribution |
| ---: | ---: | ---: | ---: |
| 0% | `$6.06` | `$4.16` | `$2.14` |
| 25% | `$9.74` | `$0.48` | `-$1.54` |
| 50% | `$13.40` | `-$3.18` | `-$5.20` |
| 100% | `$20.72` | `-$10.50` | `-$12.52` |

This is a sensitivity from an unreliable, incomplete sample, not a pricing result. The semantic, reliability, and cost gates fail. The `$20` price and 100-turn allowance remain unchanged assumptions, and public Zoning Research remains disabled.

## Decision

Retain the immutable result and Zoning safety v7. Do not change the two frozen cases until the owner approves their successor dispositions. Do not run another paid cohort without that new exact frozen successor, complete no-cost review of its remaining paths, a new explicit owner authorization, and a new cumulative cap. Even a future clean run would still require cost acceptance and exact-release web and physical-iPhone verification before public enablement.

# Permitext Research: counted backlog

Inventory date: September 9, 2026. Runtime baseline: `e728f32550d4e00ce9208d061bfc93e049994c88`.

**The retained evidence identifies 7 scoped repair work items and 3 validation work items.** These are groups of known findings, not a proven count of independent software defects. One repair can affect several questions, and review of currently unmatched answers may identify further work.

All **110 numbered questions** remain included. Their latest recorded attempts delivered 96 answers and failed to deliver 14. Of the delivered answers, 21 have recorded substance or scope gaps and 15 have presentation gaps. Another 33 have positive core reviews and 3 have explicit whole-answer development passes. Matching standalone reviews were not located for the latest answers to 24 questions.

## Evidence status

| Latest retained evidence | Questions |
| --- | ---: |
| No delivered answer in latest attempt | 14 |
| Delivered; substance or scope gap | 21 |
| Delivered; presentation gap | 15 |
| Prior core review only | 33 |
| Prior whole-answer development pass | 3 |
| Latest answer review not located | 24 |
| Total | 110 |

These results span different runtime versions. They do not establish current-baseline accuracy. Historical failures may have subsequent local repairs awaiting live confirmation. A core review is narrower than complete answer acceptance. The three complete development passes are ZR-01, ZR-14 and ZR-21; professional approval and current-version confirmation remain separate.

Presentation-only findings are separated from substantive or scope findings. Where both occur, the case remains in the substantive/scope group. Missing review evidence is not classified as a failed answer. Earlier ZR-06 citation and mapped-scope failures are not carried forward as defects of its later delivered answer without a matching review.

## Repair work

Five work items are open; two have partial local repairs awaiting confirmation. Work-item case lists overlap and must not be added together. Source selection fixes were committed locally at `e728f3255`; their full offline Research suite passed before the pause. No live quality or speed improvement is claimed from those local checks.

### R1 — Keep conclusions consistent with conditions and conflicting source passages

Status: open. Area: Conditions and exceptions.

Affected questions: CC-04, FGC-02, MC-09, ZR-18, ZR-19, DOBNOW-003, DOBNOW-004, DOBNOW-014, DOBNOW-022.

Closure: The delivered main conclusion and every supporting claim preserve the applicable condition; a caveat elsewhere cannot contradict or repair an unconditional claim.

### R2 — Retain the material source scope and required answer branches

Status: open. Area: Complete sources and answers.

Affected questions: ZR-04, ZR-09, ZR-13, ZR-16, DOBNOW-002, DOBNOW-013, DOBNOW-015, DOBNOW-016, DOBNOW-020, DOBNOW-021, DOBNOW-024.

Closure: Complete source passages reach drafting and verification, and each material benchmark concept is present without inventing missing project facts. Any proposed reference correction is documented separately.

### R3 — Respect established facts and ask only decision-relevant questions

Status: open. Area: Conditions and exceptions.

Affected questions: ZR-08, ZR-12, ZR-13, ZR-17, FGC-12, GAP-03, GAP-06, GAP-07, CC-02, CC-05.

Closure: Stated facts remain conditional premises rather than being unnecessarily reopened; missing facts are requested only when they can change the asked conclusion.

### R4 — Confirm mapped-location and definition checks accept supported uncertainty

Status: partly-repaired-awaiting-confirmation. Area: Answer verification.

Affected questions: ZR-03, ZR-07, ZR-20.

Closure: Current retained-draft and negative-control checks pass, followed by accepted live answers for the affected cases; unsafe parcel conclusions remain rejected.

Local evidence: [research-zoning-original-code-regressions.mjs](../tests/research-zoning-original-code-regressions.mjs), [research-storage-scope-live-contract.mjs](../tests/research-storage-scope-live-contract.mjs), [research-zoning-mapped-review-http-contract.mjs](../tests/research-zoning-mapped-review-http-contract.mjs).

### R5 — Match DOB source selection and verification to the requested decision

Status: partly-repaired-awaiting-confirmation. Area: Complete sources and answer verification.

Affected questions: DOBNOW-004, DOBNOW-008, DOBNOW-014, DOBNOW-017, DOBNOW-020, DOBNOW-022, DOBNOW-023.

Closure: Authority and field questions retain material conditions without unrelated readiness demands; complete PDF groups and missing-group rejection work in the live path. No failed semantic verdict is overridden.

Local evidence: [research-owner-focused-source-validation-2026-09-09.json](../evals/results/research-owner-focused-source-validation-2026-09-09.json), [research-official-pdf-http-contract.mjs](../tests/research-official-pdf-http-contract.mjs).

### R6 — Bind volunteered exception claims to their actual authorities

Status: open. Area: Citation accuracy.

Affected questions: GAP-14.

Closure: Every volunteered temporary, interim or partial occupancy exception is supported at the point of use, or omitted when outside the question; the answer delivers within its reserved cost.

### R7 — Remove repeated rules, unrelated branches and unasked navigation

Status: open. Area: Answer format.

Affected questions: CC-03, DOBNOW-018, FGC-03, FGC-04, MC-15, GAP-05, PC-05, GAP-11, PC-12, MC-01, MC-12, PC-13, DOBNOW-001, DOBNOW-006, DOBNOW-015.

Closure: The complete delivered answer follows direct answer, rule/citation, application and material qualifications without repeated generated fields or unasked instructions. Substantive fixes retain their own closure requirements.

## Validation work

### V1 — Review latest answers without a matched retained answer review

Status: pending-review. 24 questions in scope.

Closure: Each unmatched answer receives a source-bound, complete-answer review; unresolved older findings are checked rather than assumed fixed.

### V2 — Confirm all 110 questions against one identified current baseline

Status: pending-confirmation. 110 questions in scope.

Closure: All cases have current, source-bound delivery and whole-answer acceptance evidence; historical core matches and model verifier passes do not count as complete acceptance.

### V3 — Measure representative latency and cost of acceptable answers

Status: pending-confirmation. 110 questions in scope.

Closure: A prepriced, authorized sample measures full-turn p50/p90 latency and cost including failures and repairs; report development estimates separately from invoices and subscription economics.

## Execution order and stopping rules

1. Review the 24 unmatched latest answers from retained artifacts, beginning with ZR-06 so its later delivered result is assessed rather than its older failed draft. No API requests are needed for this review. Retain any source or review limitation explicitly.
2. Prioritize R1 and R5 for the demonstrated timing contradiction and verification-scope failure; group related cases rather than repeating only the same two examples. Preserve R2, R3, R4, R6 and R7 and every affected question.
3. Complete local regressions and preserve the full 110-case scope before a newly priced, single-use live comparison. Do not replay consumed drivers or infer that remaining allowance covers the complete cohort.
4. A case closes only with a delivered answer that meets its unchanged substantive reference, material qualifications, point-specific citations and presentation requirements. An automatic verifier pass alone is insufficient. Proposed reference corrections remain separate from scoring.
5. Report progress as changes to this backlog: resolved, awaiting confirmation, open or newly evidenced. Speed/cost acceptance is separate from content acceptance.

## Budget and scope

This inventory made **zero paid provider calls and zero network calls**. The current authorization is $8.50; retained conservative spending is $7.921699, leaving **$0.578301**. Recorded usage estimates total $4.18561632. These are ledger figures; the API account balance and invoice were not checked. The older historical campaign remains separate.

No Project, Notebook, Reports, export, UI or phone workflow was exercised. Nothing was pushed or deployed. Original questions, answer keys, source evidence and failed results were preserved.

## All 110 questions

The result and review links identify the actual saved evidence for each question. Every row still requires current-baseline acceptance. Repair IDs show the shared work items; V2 and V3 apply to the entire cohort. V1 marks a latest answer without a matched standalone review.

| Question | Topic | Latest retained status | Work | Evidence |
| --- | --- | --- | --- | --- |
| CC-01 | Scissor stair counted as two exits | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-pilot-2026-09-07.json) |
| CC-02 | Single stair in a six-story residential building | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| CC-03 | Occupancy classification of a residential multipurpose room | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-fixture-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-fixture-confirmation-review-2026-09-08.json) |
| CC-04 | Plumbing fixtures for an accessory assembly space | Delivered; substance or scope gap | R1 | [result](../evals/results/research-owner-live-fixture-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-fixture-confirmation-review-2026-09-08.json) |
| CC-05 | Building Code evidence versus an HCR requirement | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-01 | Rules of construction | Prior whole-answer development pass |  | [result](../evals/results/research-owner-live-zoning-direct-rule-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-zoning-direct-rule-answer-review-2026-09-08.json) |
| ZR-02 | Use Group I table | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-zoning-source-repair-v2-2026-09-09.json) · [review](../evals/results/research-owner-zoning-source-repair-answer-review-2026-09-09.json) |
| ZR-03 | Appendix J map boundaries | No delivered answer in latest attempt | R4 | [result](../evals/results/research-owner-api-round2-live-section-reference-2026-09-09.json) · [review](../evals/results/research-owner-section-reference-answer-review-2026-09-09.json) |
| ZR-04 | Special-district demolition | No delivered answer in latest attempt | R2 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-05 | Amendment history | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-zoning-repair-preservation-2026-09-09.json) · [review](../evals/results/research-owner-zoning-repair-preservation-answer-review-2026-09-09.json) |
| ZR-06 | Missing location facts | Latest answer review not located | V1 | [result](../evals/results/research-owner-api-round2-live-mapped-review-2026-09-09.json) |
| ZR-07 | Mapped district missing | No delivered answer in latest attempt | R4 | [result](../evals/results/research-owner-api-round2-live-zoning-repair-preservation-2026-09-09.json) · [review](../evals/results/research-owner-zoning-repair-preservation-answer-review-2026-09-09.json) |
| ZR-08 | R7A standard FAR | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-live-quality-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-quality-confirmation-review-2026-09-08.json) |
| ZR-09 | R7A qualifying-affordable-housing FAR | Delivered; substance or scope gap | R2 | [result](../evals/results/research-owner-api-round2-live-section-reference-2026-09-09.json) · [review](../evals/results/research-owner-section-reference-answer-review-2026-09-09.json) |
| ZR-10 | R7A standard height | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-11 | R7A lot coverage | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-zoning-repair-preservation-2026-09-09.json) · [review](../evals/results/research-owner-zoning-repair-preservation-answer-review-2026-09-09.json) |
| ZR-12 | Narrow attached-building rear yard | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-13 | Through-lot historical shallow condition | No delivered answer in latest attempt | R2, R3 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-14 | Residential building spacing | Prior whole-answer development pass |  | [result](../evals/results/research-owner-live-zoning-direct-rule-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-zoning-direct-rule-answer-review-2026-09-08.json) |
| ZR-15 | C3 professional office | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-16 | C4-4 residential use | Delivered; substance or scope gap | R2 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-17 | Inner Transit Zone new-unit parking | No delivered answer in latest attempt | R3 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-18 | Newly assembled divided zoning lot | Delivered; substance or scope gap | R1 | [result](../evals/results/research-owner-api-round2-live-repair-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| ZR-19 | Zoning-lot contiguity definition | Delivered; substance or scope gap | R1 | [result](../evals/results/research-owner-api-round2-live-lot-history-2026-09-09.json) · [review](../evals/results/research-owner-lot-history-answer-review-2026-09-09.json) |
| ZR-20 | Cellar floor-area definition | No delivered answer in latest attempt | R4 | [result](../evals/results/research-owner-api-round2-live-section-reference-2026-09-09.json) · [review](../evals/results/research-owner-section-reference-answer-review-2026-09-09.json) |
| ZR-21 | Discontinuance of a non-conforming use | Prior whole-answer development pass |  | [result](../evals/results/research-owner-live-zoning-expansion-2026-09-08.json) · [review](../evals/results/research-owner-zoning-expansion-answer-review-2026-09-08.json) |
| DOBNOW-001 | Alteration without a CO-triggering change | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-api-round2-live-dob-safety-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-safety-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-002 | Existing element retained in reconstruction | Delivered; substance or scope gap | R2 | [result](../evals/results/research-owner-api-round2-live-dob-source-coverage-2026-09-09.json) · [review](../evals/results/research-owner-dob-source-coverage-answer-review-2026-09-09.json) |
| DOBNOW-003 | Subsequent plumbing filing | No delivered answer in latest attempt | R1 | [result](../evals/results/research-owner-api-round2-live-decision-scope-2026-09-09.json) · [review](../evals/results/research-owner-decision-scope-answer-assessment-2026-09-09.json) |
| DOBNOW-004 | PAA for an approved-scope change | No delivered answer in latest attempt | R1, R5 | [result](../evals/results/research-owner-api-round2-live-dob-companion-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-companion-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-005 | Small-business response | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-dob-source-coverage-2026-09-09.json) · [review](../evals/results/research-owner-dob-source-coverage-answer-review-2026-09-09.json) |
| DOBNOW-006 | MPP enrollment boundary | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-api-round2-live-dob-companion-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-companion-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-007 | Complete roof replacement | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-dob-source-coverage-2026-09-09.json) · [review](../evals/results/research-owner-dob-source-coverage-answer-review-2026-09-09.json) |
| DOBNOW-008 | More than 50 percent of gross floor area | Delivered; substance or scope gap | R5 | [result](../evals/results/research-owner-api-round2-live-dob-safety-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-safety-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-009 | Excavation exactly 12 feet | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-dob-source-coverage-2026-09-09.json) · [review](../evals/results/research-owner-dob-source-coverage-answer-review-2026-09-09.json) |
| DOBNOW-010 | Plumbing impact on sprinkler/standpipe supply | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-dob-safety-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-safety-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-011 | Standpipe outage longer than 24 hours | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-dob-safety-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-safety-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-012 | Stormwater disjunctive thresholds | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-dob-companion-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-companion-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-013 | Occupied residential units during construction | Delivered; substance or scope gap | R2 | [result](../evals/results/research-owner-api-round2-live-dob-safety-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-safety-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-014 | Rent-regulated-unit data conflict | No delivered answer in latest attempt | R1, R5 | [result](../evals/results/research-owner-api-round2-live-dob-companion-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-companion-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-015 | Condo/co-op board stakeholder | Delivered; presentation gap | R2, R7 | [result](../evals/results/research-owner-api-round2-live-dob-companion-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-companion-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-016 | Loft Law flag and affected IMD unit | Delivered; substance or scope gap | R2 | [result](../evals/results/research-owner-api-round2-live-guidance-precision-2026-09-09.json) · [review](../evals/results/research-owner-guidance-precision-answer-review-2026-09-09.json) |
| DOBNOW-017 | Basement ADU radon/vapor document | No delivered answer in latest attempt | R5 | [result](../evals/results/research-owner-api-round2-live-dob-companion-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-companion-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-018 | Wetland-area required documents | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-document-summary-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-document-summary-review-2026-09-08.json) |
| DOBNOW-019 | New Builders Pavement Plan filing | Prior core review only |  | [result](../evals/results/research-owner-live-document-summary-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-document-summary-review-2026-09-08.json) |
| DOBNOW-020 | LPC-calendared property | No delivered answer in latest attempt | R2, R5 | [result](../evals/results/research-owner-api-round2-live-dob-safety-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-safety-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-021 | Insufficient facts for code review year | Delivered; substance or scope gap | R2 | [result](../evals/results/research-owner-api-round2-live-dob-safety-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-safety-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-022 | Insufficient facts for Professional Certification | No delivered answer in latest attempt | R1, R5 | [result](../evals/results/research-owner-api-round2-live-dob-companion-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-companion-confirmation-answer-review-2026-09-09.json) |
| DOBNOW-023 | Filing representative attestation boundary | No delivered answer in latest attempt | R5 | [result](../evals/results/research-owner-api-round2-live-decision-scope-2026-09-09.json) · [review](../evals/results/research-owner-decision-scope-answer-assessment-2026-09-09.json) |
| DOBNOW-024 | Letter of Completion readiness | Delivered; substance or scope gap | R2 | [result](../evals/results/research-owner-api-round2-live-dob-companion-confirmation-2026-09-09.json) · [review](../evals/results/research-owner-dob-companion-confirmation-answer-review-2026-09-09.json) |
| FGC-01 | High-pressure natural gas piping | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) |
| FGC-02 | Gas appliance in a bathroom | Delivered; substance or scope gap | R1 | [result](../evals/results/research-owner-live-scope-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-scope-confirmation-v2-review-2026-09-08.json) |
| FGC-03 | Large appliance using indoor combustion air | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-source-confirmation-review-2026-09-08.json) |
| FGC-04 | Concealed gas-piping union | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-source-confirmation-review-2026-09-08.json) |
| FGC-05 | Operating gas piping before required testing | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) |
| FGC-06 | Minimum pressure test for a 2-psig system | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) |
| FGC-07 | Gas piping in a public corridor | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) |
| FGC-08 | Using a valve as a pressure-test bulkhead | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-fountain-expansion-2026-09-08.json) |
| FGC-09 | Supporting gas piping from another pipe | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-fountain-expansion-2026-09-08.json) |
| FGC-10 | Appliance shutoff valve eight feet away | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-fountain-expansion-2026-09-08.json) |
| FGC-11 | Appliance shutoff valve mounted 72 inches high | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| FGC-12 | Appliance supplied at pressure above its design pressure | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| FGC-13 | Flexible connector to a water heater | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-fountain-expansion-2026-09-08.json) |
| FGC-14 | Commercial range on casters without restraint | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| FGC-15 | Type 1 gas clothes dryer and the meaning of “not required to be vented” | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| MC-01 | Air-conditioned office relying only on operable windows | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-api-round2-live-repair-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| MC-02 | Outdoor-air intake six feet from a side lot line | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-routing-confirmation-v2-2026-09-08.json) |
| MC-03 | Recirculating ventilation air between apartments | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) |
| MC-04 | Transfer air used as toilet-room makeup air | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) |
| MC-05 | Fan disconnect used as emergency ventilation control | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-attribution-confirmation-2026-09-08.json) |
| MC-06 | Mechanical ventilation of an uninhabited crawl space | Prior core review only |  | [result](../evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-source-confirmation-review-2026-09-08.json) |
| MC-07 | Dryer exhaust combined with bathroom exhaust | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) |
| MC-08 | Bathroom exhaust terminating in an attic | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-fountain-expansion-2026-09-08.json) |
| MC-09 | Environmental exhaust four feet from an outdoor-air intake | Delivered; substance or scope gap | R1 | [result](../evals/results/research-owner-api-round2-live-percentage-scope-2026-09-09.json) · [review](../evals/results/research-owner-focused-technical-answer-review-2026-09-09.json) |
| MC-10 | Apartment exhaust two feet from a neighboring apartment window | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-technical-expansion-2026-09-08.json) |
| MC-11 | Screen on a clothes-dryer exhaust termination | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| MC-12 | Fire damper in a dryer exhaust duct | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| MC-13 | Type I hood over a medium-duty appliance | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-focused-technical-2026-09-09.json) · [review](../evals/results/research-owner-focused-technical-answer-review-2026-09-09.json) |
| MC-14 | Mixed appliances under one hood | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| MC-15 | Kitchen makeup air not interlocked with exhaust | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-api-round2-live-focused-technical-2026-09-09.json) · [review](../evals/results/research-owner-focused-technical-answer-review-2026-09-09.json) |
| GAP-01 | Using the 1968 Building Code for new plumbing and mechanical work | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) |
| GAP-02 | Assuming replacement equipment is automatically permit-exempt | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) |
| GAP-03 | Permit-exempt work that violates zoning or another code | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-api-round2-live-focused-technical-2026-09-09.json) · [review](../evals/results/research-owner-focused-technical-answer-review-2026-09-09.json) |
| GAP-04 | Permit exemption and other agency approvals | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-attribution-confirmation-2026-09-08.json) |
| GAP-05 | Occupied dwelling-unit information on a permit application | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-source-confirmation-review-2026-09-08.json) |
| GAP-06 | Permit with no work started for fourteen months | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-api-round2-live-work-premise-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| GAP-07 | Owner’s duty to maintain an old building | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| GAP-08 | Permit obtained through a material false statement | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-focused-technical-2026-09-09.json) · [review](../evals/results/research-owner-focused-technical-answer-review-2026-09-09.json) |
| GAP-09 | Unapproved alternative material | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| GAP-10 | Concealing work before required inspection | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| GAP-11 | Satisfactory inspection as approval of a code violation | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-quality-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-quality-confirmation-review-2026-09-08.json) |
| GAP-12 | Final inspection before work is complete | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| GAP-13 | Place of assembly operating with only a Certificate of Occupancy | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| GAP-14 | Occupancy before a required Certificate of Occupancy | No delivered answer in latest attempt | R6 | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| GAP-15 | Continuing work after a stop-work order | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-work-premise-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-01 | One toilet facility for a 28-person café | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-routing-confirmation-v2-2026-09-08.json) |
| PC-02 | Drinking fountain in a restaurant that serves water | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) |
| PC-03 | Replacing all required drinking fountains with bottle fillers | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-plumbing-repair-confirmation-v2-2026-09-08.json) |
| PC-04 | Central apartment laundry without a floor drain | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-repair-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-05 | Commercial food-waste disposer without DEP approval | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-source-confirmation-review-2026-09-08.json) |
| PC-06 | Cold water only at a public restroom lavatory | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-07 | 30-inch-by-30-inch shower with a 20-inch entry | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-08 | Replacing 75 percent of men’s water closets with urinals | Latest answer review not located | V1 | [result](../evals/results/research-owner-live-technical-expansion-2026-09-08.json) |
| PC-09 | Shower valve set to 125°F | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-10 | Water heater above a finished office without a drain pan | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-repair-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-11 | Three-inch sanitary piping at 1/16 inch per foot | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-12 | Reducing a drain from four inches to three inches downstream | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-quality-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-quality-confirmation-review-2026-09-08.json) |
| PC-13 | Double-trapping a sink | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-14 | Two-inch trap arm ten feet from the vent | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-15 | Basement fixtures subject to sewer backflow | Prior core review only |  | [result](../evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-source-confirmation-review-2026-09-08.json) |

## Reproduction and audit

The [machine-readable inventory](../evals/results/research-owner-backlog-2026-09-09.json) retains the complete 110-case mapping, reviewed findings, input hashes, exact run identities and count definitions. The [report script](../scripts/report-research-owner-backlog-20260909.mjs) verifies retained ledger hashes, rejects ambiguous review bindings, excludes supplemental/verifier-only probes and refuses live execution. Its explicit manual triage lists are evaluation-only and never enter model prompts.

Run `node scripts/report-research-owner-backlog-20260909.mjs` from `permitext-sync-server` to inspect counts without writing artifacts or calling providers. `--output` accepts a new output path and refuses overwrite. The inventory does not amend any runtime verification verdict, benchmark approval or user question.

Validation completed: all 110 unique case entries and document rows agree; all 78 recorded evidence/generator hashes match the files read; every case remains assigned to full-cohort quality and cost validation; every unmatched answer has an explicit review task. Attempting `--run-live` is rejected before any provider dispatch. `git diff --check` passed. No additional Research test suite or paid test was run for the inventory itself.

- The seven repair items are a scoped grouping of known findings, not a proven total of independent bugs. Case overlap is intentional; do not sum work-item case counts.
- Latest-attempt results span different code and prompt versions. Failed old attempts can have subsequent local repairs; those repairs need separate confirmation.
- Positive prior core reviews are narrower than complete answer acceptance. Three explicit whole-answer development passes remain historical, not current-baseline or professional approval.
- No matched review means no matching standalone answer-review JSON was located in the scanned files. It does not prove the answer is wrong or that no review exists elsewhere.
- All original and added questions remain in scope. The supplemental PDF-BPP probe and verifier-only checks are excluded from the 110-case count.
- The reference key and source snapshots have evolved; historical passing judgments must be revalidated before current acceptance. No answer-key or runtime verdict was changed by this inventory.

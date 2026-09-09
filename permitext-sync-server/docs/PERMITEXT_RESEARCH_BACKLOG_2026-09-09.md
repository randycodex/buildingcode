# Permitext Research: counted backlog

Inventory revision 2: September 9, 2026. Runtime baseline: `79686cee4513d8d487bec2d187ed6324f77bb0ec`.

**Seven scoped repair work items remain, along with two pending validation items. The review of all 24 previously unmatched answers is complete.** These are groups of known findings, not a proven count of independent software defects. One repair can affect several questions.

All **110 numbered questions** remain included. Their latest recorded attempts delivered 96 answers and failed to deliver 14. Of the delivered answers, 30 have recorded substance or scope gaps and 22 have presentation gaps. Another 33 have positive core reviews and 11 have explicit whole-answer development passes. Every latest answer now has a matched development review.

## Change since the first inventory

The 24 previously unmatched saved answers were reviewed without provider or network calls: **8 meet the reference in their saved sample, 9 have substance/scope/citation gaps, and 7 need presentation cleanup**. These classifications resolve missing review evidence; they are not 16 newly failing live tests. The findings fit the seven existing repair items. The [first inventory](../evals/results/research-owner-backlog-2026-09-09.json) remains unchanged.

The latest storage-use answer includes the formerly missing reconstruction and nonconforming-use branches, and the reviewed points have supporting sources. Its old failed draft is not counted as the latest result; repetition remains a presentation issue. The review also reproduced two old fact-extraction problems in the current local code: a new piping system is promoted to a new-construction building, and a stated two-unit system design is stored with an unknown dwelling-unit count. Those reproductions are attached to R3 and require no paid confirmation to establish the local parser behavior.

## Evidence status

| Latest retained evidence | Questions |
| --- | ---: |
| No delivered answer in latest attempt | 14 |
| Delivered; substance or scope gap | 30 |
| Delivered; presentation gap | 22 |
| Prior core review only | 33 |
| Whole-answer development pass on saved sample | 11 |
| Latest answer review not located | 0 |
| Total | 110 |

These results span different runtime versions. They do not establish current-baseline accuracy. Historical failures may have subsequent local repairs awaiting live confirmation. A core review is narrower than complete answer acceptance. The 11 complete development passes are CC-01, ZR-01, ZR-14, ZR-21, FGC-05, FGC-13, MC-02, MC-07, MC-08, PC-02, PC-08. Professional approval and current-version confirmation remain separate.

Presentation-only findings are separated from substantive or scope findings. Where both occur, the case remains in the substantive/scope group. A missing point-level citation is not cured by a top-level citation or another correctly cited point. MC-04 records an ambiguity about applying recirculation restrictions to transfer air; it is not a complete mechanical-design determination.

## Repair work

Five work items are open; two have partial local repairs awaiting confirmation. Work-item case lists overlap and must not be added together. Source selection fixes were committed locally at `e728f3255`; their full offline Research suite passed before the pause. No live quality or speed improvement is claimed from those local checks.

### R1 — Keep conclusions consistent with conditions and conflicting source passages

Status: open. Area: Conditions and exceptions.

Affected questions: CC-04, FGC-02, MC-09, ZR-18, ZR-19, DOBNOW-003, DOBNOW-004, DOBNOW-014, DOBNOW-022, MC-03, MC-04, GAP-01.

Closure: The delivered main conclusion and every supporting claim preserve the applicable condition; a caveat elsewhere cannot contradict or repair an unconditional claim.

Local preparation, September 9: the shared [claim-scope instruction](../research-claim-scope.mjs) now reaches code drafting and semantic verification, as well as official-guidance drafting and verification. It requires claim-adjacent conditions, consistent main text and secondary fields, and distinguishes a conditional document requirement from an unsupported sequence. Secondary claims remain subject to complete conditions and citations; unasked claims should be omitted. This directly addresses the retained timing contradiction, added before-selection/before-response requirements and collateral claims with missing conditions. It is a prompt change awaiting live confirmation, not proof those answers now pass.

The source-relationship detector also compares the PAA locked-field list with an editing permission for the same field. The field name comes from fetched source text; no case ID or expected answer enters runtime. Both complete paragraph/FAQ contexts and their source/claim/hash bindings remain available. The comparison disappears for unrelated questions, missing sources, removed restrictions or removed permissions. The ordinary semantic verifier still decides whether scope resolves the apparent conflict; no failed verdict is overridden.

Validation: `npm run test:research-chat` passed. The [claim-scope contract](../tests/research-claim-scope-contract.mjs) checks 220 code request envelopes using all 110 question texts and synthetic source sentinels, plus both official-guidance stages with the retained PAA sources. These are request/coverage checks, not 110 generated-answer evaluations. The [fixed-source request comparison](../evals/results/research-claim-scope-request-comparison-2026-09-09.json) preserves all source passages, facts, candidate prose, schemas, models, reasoning settings and output budgets between old and new requests. It records an additional 987 bytes per timing-case request and 3,290 bytes per PAA-case request. No live latency or answer-quality improvement is established. The full local suite log is `/tmp/permitext-claim-scope-research-suite-20260909.log`.

### R2 — Retain the material source scope and required answer branches

Status: open. Area: Complete sources and answers.

Affected questions: ZR-04, ZR-09, ZR-13, ZR-16, DOBNOW-002, DOBNOW-013, DOBNOW-015, DOBNOW-016, DOBNOW-020, DOBNOW-021, DOBNOW-024, MC-04, MC-10.

Closure: Complete source passages reach drafting and verification, and each material benchmark concept is present without inventing missing project facts. Any proposed reference correction is documented separately.

### R3 — Respect established facts and ask only decision-relevant questions

Status: open. Area: Conditions and exceptions.

Affected questions: ZR-08, ZR-12, ZR-13, ZR-17, FGC-12, GAP-03, GAP-06, GAP-07, CC-02, CC-05, FGC-01, FGC-07, MC-03, GAP-02.

Closure: Stated facts remain conditional premises rather than being unnecessarily reopened; missing facts are requested only when they can change the asked conclusion.

Local repair addendum, September 9: the `20260909-building-and-system-fact-scope-v7` parser removes the false new-building status from FGC-01 and separates a system's served dwelling units from the building's total units. It preserves direct building descriptions, negation, uncertainty, hypothetical scope and follow-up facts; legacy positive facts are rechecked against their original wording. New/existing equipment and new building permits no longer establish building status.

The MC-03 diagnosis is now more precise: the word **part**, not **designed**, triggers the sentence's qualification. Before this repair, the current prompt already retained the complete two-unit statement as a supplied qualified premise, with no unknown-fact prompt. The remaining reproduced defect was the shared storage key: that system statement could erase a previously supplied building-wide unit count. The repair gives the system its own key and preserves both scopes. It does not declare a proposed system built or its count to be the total number of units in the building.

The [110-question parser audit](../evals/results/research-fact-subject-scope-audit-2026-09-09.json) records changes only for FGC-01 and MC-03; the other 108 question projections are unchanged. The [subject-scope regression](../tests/research-fact-subject-scope-contract.mjs) covers equipment/building wording, system-versus-total counts, qualified quantities, follow-ups and legacy revalidation. These are local parser repairs, not new generated-answer passes. R3 and the full-answer acceptance counts remain open and unchanged.

Validation: `npm run test:research-chat` passed on the final parser source, including the new subject-scope contract and the existing qualified-facts contract. The audit's source hashes and 110 case rows were verified; live execution and result overwrite were rejected. No paid calls were made and the $0.578301 remaining conservative allowance is unchanged. The full local suite log is `/tmp/permitext-fact-subject-research-suite-final-20260909.log`.

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

### R6 — Bind each retained claim to all of its supporting authorities

Status: open. Area: Citation accuracy.

Affected questions: GAP-14, MC-05, PC-01.

Closure: Mixed-source points and additional narrative claims retain every needed source identity, or unasked claims are omitted. Top-level citations or a separate correctly cited point do not cure a missing binding in another point. Occupancy-exception claims remain included in this repair.

### R7 — Remove repeated rules, unrelated branches and unasked navigation

Status: open. Area: Answer format.

Affected questions: CC-03, DOBNOW-018, FGC-03, FGC-04, MC-15, GAP-05, PC-05, GAP-11, PC-12, MC-01, MC-12, PC-13, DOBNOW-001, DOBNOW-006, DOBNOW-015, ZR-06, FGC-01, FGC-06, FGC-07, FGC-08, FGC-09, FGC-10, MC-05, MC-10, GAP-01, GAP-02, GAP-04, PC-01, PC-03.

Closure: The complete delivered answer follows direct answer, rule/citation, application and material qualifications without repeated generated fields or unasked instructions. Substantive fixes retain their own closure requirements.

## Validation work

### V1 — Review latest answers without a matched retained answer review

Status: retained-answer-review-complete. 24 questions in scope.

Closure: Each unmatched answer receives a source-bound, complete-answer review; unresolved older findings are checked rather than assumed fixed.

Completed evidence: [24-answer source-bound review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json). Older core-only reviews elsewhere still require full answer acceptance under V2.

### V2 — Confirm all 110 questions against one identified current baseline

Status: pending-confirmation. 110 questions in scope.

Closure: All cases have current, source-bound delivery and whole-answer acceptance evidence; historical core matches and model verifier passes do not count as complete acceptance.

### V3 — Measure representative latency and cost of acceptable answers

Status: pending-confirmation. 110 questions in scope.

Closure: A prepriced, authorized sample measures full-turn p50/p90 latency and cost including failures and repairs; report development estimates separately from invoices and subscription economics.

## Execution order and stopping rules

1. The two demonstrated parser scope defects under R3 are locally repaired with negative controls and a 110-question parser comparison. Continue the remaining R3 answer-level findings; preserve the distinction between supplied qualified premises and actual missing facts.
2. Confirm the new R1 claim-scope instructions and PAA source comparison using a freshly priced, committed-source API package within the remaining authorized allowance. Include the PAA conflict alongside the timing case; preserve R5 actor-authority confirmation and all other repair groups rather than treating two cases as the complete scope.
3. Complete local regressions before a newly priced, single-use live comparison. Do not replay consumed drivers or infer that the remaining allowance covers the complete cohort.
4. A case closes only with a delivered answer meeting its unchanged substantive reference, material qualifications, point-specific citations and presentation requirements. An automatic verifier pass alone is insufficient. Proposed reference corrections remain separate from scoring.
5. Report changes against this backlog. Current-baseline validation and representative speed/cost acceptance remain open for all 110 questions.

## Budget and scope

This inventory and the 24-answer review made **zero paid provider calls and zero network calls**. The current authorization is $8.50; retained conservative spending is $7.921699, leaving **$0.578301**. Recorded usage estimates total $4.18561632. These are ledger figures; the API account balance and invoice were not checked. The older historical campaign remains separate.

No Project, Notebook, Reports, export, UI or phone workflow was exercised. Nothing was pushed or deployed. Original questions, answer keys, source evidence and failed results were preserved.

## All 110 questions

Each row links its latest saved result and matched review. Every row still requires current-baseline acceptance. V2 and V3 apply to the entire cohort. V1 marks the 24 now-reviewed answers; that review task is complete.

| Question | Topic | Latest retained status | Work | Evidence |
| --- | --- | --- | --- | --- |
| CC-01 | Scissor stair counted as two exits | Whole-answer development pass on saved sample | V1 | [result](../evals/results/research-owner-live-pilot-2026-09-07.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| CC-02 | Single stair in a six-story residential building | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| CC-03 | Occupancy classification of a residential multipurpose room | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-fixture-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-fixture-confirmation-review-2026-09-08.json) |
| CC-04 | Plumbing fixtures for an accessory assembly space | Delivered; substance or scope gap | R1 | [result](../evals/results/research-owner-live-fixture-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-fixture-confirmation-review-2026-09-08.json) |
| CC-05 | Building Code evidence versus an HCR requirement | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-01 | Rules of construction | Whole-answer development pass on saved sample |  | [result](../evals/results/research-owner-live-zoning-direct-rule-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-zoning-direct-rule-answer-review-2026-09-08.json) |
| ZR-02 | Use Group I table | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-zoning-source-repair-v2-2026-09-09.json) · [review](../evals/results/research-owner-zoning-source-repair-answer-review-2026-09-09.json) |
| ZR-03 | Appendix J map boundaries | No delivered answer in latest attempt | R4 | [result](../evals/results/research-owner-api-round2-live-section-reference-2026-09-09.json) · [review](../evals/results/research-owner-section-reference-answer-review-2026-09-09.json) |
| ZR-04 | Special-district demolition | No delivered answer in latest attempt | R2 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-05 | Amendment history | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-zoning-repair-preservation-2026-09-09.json) · [review](../evals/results/research-owner-zoning-repair-preservation-answer-review-2026-09-09.json) |
| ZR-06 | Missing location facts | Delivered; presentation gap | R7, V1 | [result](../evals/results/research-owner-api-round2-live-mapped-review-2026-09-09.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| ZR-07 | Mapped district missing | No delivered answer in latest attempt | R4 | [result](../evals/results/research-owner-api-round2-live-zoning-repair-preservation-2026-09-09.json) · [review](../evals/results/research-owner-zoning-repair-preservation-answer-review-2026-09-09.json) |
| ZR-08 | R7A standard FAR | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-live-quality-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-quality-confirmation-review-2026-09-08.json) |
| ZR-09 | R7A qualifying-affordable-housing FAR | Delivered; substance or scope gap | R2 | [result](../evals/results/research-owner-api-round2-live-section-reference-2026-09-09.json) · [review](../evals/results/research-owner-section-reference-answer-review-2026-09-09.json) |
| ZR-10 | R7A standard height | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-11 | R7A lot coverage | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-zoning-repair-preservation-2026-09-09.json) · [review](../evals/results/research-owner-zoning-repair-preservation-answer-review-2026-09-09.json) |
| ZR-12 | Narrow attached-building rear yard | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-13 | Through-lot historical shallow condition | No delivered answer in latest attempt | R2, R3 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-14 | Residential building spacing | Whole-answer development pass on saved sample |  | [result](../evals/results/research-owner-live-zoning-direct-rule-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-zoning-direct-rule-answer-review-2026-09-08.json) |
| ZR-15 | C3 professional office | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-16 | C4-4 residential use | Delivered; substance or scope gap | R2 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-17 | Inner Transit Zone new-unit parking | No delivered answer in latest attempt | R3 | [result](../evals/results/research-owner-api-round2-live-original-code-2026-09-09.json) · [review](../evals/results/research-owner-original-code-answer-review-2026-09-09.json) |
| ZR-18 | Newly assembled divided zoning lot | Delivered; substance or scope gap | R1 | [result](../evals/results/research-owner-api-round2-live-repair-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| ZR-19 | Zoning-lot contiguity definition | Delivered; substance or scope gap | R1 | [result](../evals/results/research-owner-api-round2-live-lot-history-2026-09-09.json) · [review](../evals/results/research-owner-lot-history-answer-review-2026-09-09.json) |
| ZR-20 | Cellar floor-area definition | No delivered answer in latest attempt | R4 | [result](../evals/results/research-owner-api-round2-live-section-reference-2026-09-09.json) · [review](../evals/results/research-owner-section-reference-answer-review-2026-09-09.json) |
| ZR-21 | Discontinuance of a non-conforming use | Whole-answer development pass on saved sample |  | [result](../evals/results/research-owner-live-zoning-expansion-2026-09-08.json) · [review](../evals/results/research-owner-zoning-expansion-answer-review-2026-09-08.json) |
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
| FGC-01 | High-pressure natural gas piping | Delivered; substance or scope gap | R3, R7, V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| FGC-02 | Gas appliance in a bathroom | Delivered; substance or scope gap | R1 | [result](../evals/results/research-owner-live-scope-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-scope-confirmation-v2-review-2026-09-08.json) |
| FGC-03 | Large appliance using indoor combustion air | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-source-confirmation-review-2026-09-08.json) |
| FGC-04 | Concealed gas-piping union | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-source-confirmation-review-2026-09-08.json) |
| FGC-05 | Operating gas piping before required testing | Whole-answer development pass on saved sample | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| FGC-06 | Minimum pressure test for a 2-psig system | Delivered; presentation gap | R7, V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| FGC-07 | Gas piping in a public corridor | Delivered; substance or scope gap | R3, R7, V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| FGC-08 | Using a valve as a pressure-test bulkhead | Delivered; presentation gap | R7, V1 | [result](../evals/results/research-owner-live-fountain-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| FGC-09 | Supporting gas piping from another pipe | Delivered; presentation gap | R7, V1 | [result](../evals/results/research-owner-live-fountain-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| FGC-10 | Appliance shutoff valve eight feet away | Delivered; presentation gap | R7, V1 | [result](../evals/results/research-owner-live-fountain-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| FGC-11 | Appliance shutoff valve mounted 72 inches high | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| FGC-12 | Appliance supplied at pressure above its design pressure | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| FGC-13 | Flexible connector to a water heater | Whole-answer development pass on saved sample | V1 | [result](../evals/results/research-owner-live-fountain-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| FGC-14 | Commercial range on casters without restraint | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| FGC-15 | Type 1 gas clothes dryer and the meaning of “not required to be vented” | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| MC-01 | Air-conditioned office relying only on operable windows | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-api-round2-live-repair-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| MC-02 | Outdoor-air intake six feet from a side lot line | Whole-answer development pass on saved sample | V1 | [result](../evals/results/research-owner-live-routing-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| MC-03 | Recirculating ventilation air between apartments | Delivered; substance or scope gap | R1, R3, V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| MC-04 | Transfer air used as toilet-room makeup air | Delivered; substance or scope gap | R1, R2, V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| MC-05 | Fan disconnect used as emergency ventilation control | Delivered; substance or scope gap | R6, R7, V1 | [result](../evals/results/research-owner-live-attribution-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| MC-06 | Mechanical ventilation of an uninhabited crawl space | Prior core review only |  | [result](../evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-source-confirmation-review-2026-09-08.json) |
| MC-07 | Dryer exhaust combined with bathroom exhaust | Whole-answer development pass on saved sample | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| MC-08 | Bathroom exhaust terminating in an attic | Whole-answer development pass on saved sample | V1 | [result](../evals/results/research-owner-live-fountain-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| MC-09 | Environmental exhaust four feet from an outdoor-air intake | Delivered; substance or scope gap | R1 | [result](../evals/results/research-owner-api-round2-live-percentage-scope-2026-09-09.json) · [review](../evals/results/research-owner-focused-technical-answer-review-2026-09-09.json) |
| MC-10 | Apartment exhaust two feet from a neighboring apartment window | Delivered; substance or scope gap | R2, R7, V1 | [result](../evals/results/research-owner-live-technical-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| MC-11 | Screen on a clothes-dryer exhaust termination | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| MC-12 | Fire damper in a dryer exhaust duct | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| MC-13 | Type I hood over a medium-duty appliance | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-focused-technical-2026-09-09.json) · [review](../evals/results/research-owner-focused-technical-answer-review-2026-09-09.json) |
| MC-14 | Mixed appliances under one hood | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| MC-15 | Kitchen makeup air not interlocked with exhaust | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-api-round2-live-focused-technical-2026-09-09.json) · [review](../evals/results/research-owner-focused-technical-answer-review-2026-09-09.json) |
| GAP-01 | Using the 1968 Building Code for new plumbing and mechanical work | Delivered; substance or scope gap | R1, R7, V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| GAP-02 | Assuming replacement equipment is automatically permit-exempt | Delivered; substance or scope gap | R3, R7, V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| GAP-03 | Permit-exempt work that violates zoning or another code | Delivered; substance or scope gap | R3 | [result](../evals/results/research-owner-api-round2-live-focused-technical-2026-09-09.json) · [review](../evals/results/research-owner-focused-technical-answer-review-2026-09-09.json) |
| GAP-04 | Permit exemption and other agency approvals | Delivered; presentation gap | R7, V1 | [result](../evals/results/research-owner-live-attribution-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
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
| PC-01 | One toilet facility for a 28-person café | Delivered; substance or scope gap | R6, R7, V1 | [result](../evals/results/research-owner-live-routing-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| PC-02 | Drinking fountain in a restaurant that serves water | Whole-answer development pass on saved sample | V1 | [result](../evals/results/research-owner-live-premise-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| PC-03 | Replacing all required drinking fountains with bottle fillers | Delivered; presentation gap | R7, V1 | [result](../evals/results/research-owner-live-plumbing-repair-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| PC-04 | Central apartment laundry without a floor drain | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-repair-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-05 | Commercial food-waste disposer without DEP approval | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-source-confirmation-review-2026-09-08.json) |
| PC-06 | Cold water only at a public restroom lavatory | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-07 | 30-inch-by-30-inch shower with a 20-inch entry | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-08 | Replacing 75 percent of men’s water closets with urinals | Whole-answer development pass on saved sample | V1 | [result](../evals/results/research-owner-live-technical-expansion-2026-09-08.json) · [review](../evals/results/research-owner-unmatched-answer-review-2026-09-09.json) |
| PC-09 | Shower valve set to 125°F | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-10 | Water heater above a finished office without a drain pan | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-repair-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-11 | Three-inch sanitary piping at 1/16 inch per foot | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-12 | Reducing a drain from four inches to three inches downstream | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-live-quality-confirmation-2026-09-08.json) · [review](../evals/results/research-owner-quality-confirmation-review-2026-09-08.json) |
| PC-13 | Double-trapping a sink | Delivered; presentation gap | R7 | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-14 | Two-inch trap arm ten feet from the vent | Prior core review only |  | [result](../evals/results/research-owner-api-round2-live-code-coverage-2026-09-08.json) · [review](../evals/results/research-owner-api-round2-answer-review-2026-09-08.json) |
| PC-15 | Basement fixtures subject to sewer backflow | Prior core review only |  | [result](../evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json) · [review](../evals/results/research-owner-source-confirmation-review-2026-09-08.json) |

## Reproduction and audit

The [revision 2 inventory](../evals/results/research-owner-backlog-v2-2026-09-09.json) retains all 110 case definitions, latest-attempt bindings, reviewed findings and input hashes. The [report script](../scripts/report-research-owner-backlog-20260909.mjs) checks retained ledger hashes, rejects ambiguous review bindings and refuses live execution. The supplemental review is pinned by its hash and contains explicit manual dispositions; untriaged reviews are not automatically accepted. These evaluation-only findings never enter model prompts.

Run `node scripts/report-research-owner-backlog-20260909.mjs` from `permitext-sync-server` to inspect the current inventory without writing artifacts or calling providers. `--output` requires a new output path. Historical snapshots are not overwritten.

Revision 2 validation passed: all 24 reviewed answer projections, source/result identities and expected-answer hashes match retained evidence; all 110 case definitions and latest attempts are unchanged from revision 1; all 110 document rows have matching reviews and remain assigned to current-baseline and speed/cost validation. The seven repair items are preserved, V1 is complete, the budget is unchanged, and live execution of the inventory remains rejected. The 60-case source-review contract and `git diff --check` also passed. No Research-generation test was run for this review.

- The seven repair items are a scoped grouping of known findings, not a proven total of independent bugs. Case overlap is intentional; do not sum work-item case counts.
- Latest-attempt results span different code and prompt versions. Failed old attempts can have subsequent local repairs; those repairs need separate confirmation.
- Positive prior core reviews are narrower than complete answer acceptance. All explicit whole-answer development passes remain saved-sample findings, not current-baseline or professional approval.
- No matched review means no matching standalone answer-review JSON was located in the scanned files. It does not prove the answer is wrong or that no review exists elsewhere.
- All original and added questions remain in scope. The supplemental PDF-BPP probe and verifier-only checks are excluded from the 110-case count.
- The reference key and source snapshots have evolved; historical passing judgments must be revalidated before current acceptance. No answer-key or runtime verdict was changed by this inventory.

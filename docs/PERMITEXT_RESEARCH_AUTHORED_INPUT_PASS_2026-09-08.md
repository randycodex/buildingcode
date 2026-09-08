# Research authored-input and source-boundary pass

This local pass checks the full 110-question scope: the original 50 cases and the additional 60 code questions. It corrects three missing-fact expectations and lets a source-only Appendix J explanation proceed through the existing verification path. It makes no paid API requests and does not establish that all 110 generated answers pass.

## Reference-answer corrections

| Case | Correction | Preserved requirement |
|---|---|---|
| CC-01, scissor stair | Accept the Group R-2 occupancy and 15-foot door separation supplied in the question. | The enclosure rating, separating-construction rating, and masonry or accepted equivalent remain unresolved. |
| CC-02, single exit | Move the instruction to check other applicable requirements out of the missing-Project-facts list. The expected answer is unchanged. | Occupancy and construction type remain material; the answer still limits its conclusion to the selected allowance. |
| CC-03, multipurpose room | Accept the supplied net area and normal furniture arrangement. | The accessory relationship and any other intended functions remain material. The selected 900 / 15 = 60 calculation is unchanged. |

The amendments are recorded in `evals/research-answer-key-amendments.json` and reflected in the [reconciled key](PERMITEXT_RECONCILED_RESEARCH_ANSWER_KEY_2026-09-07.md). Their status is **development correction pending professional review**. Original questions, selected passages, Project facts, approved source records, and prior diagnostic results remain unchanged. The legacy paid evaluator rejects these amended original references before provider configuration or dispatch.

## Authored-input coverage

The new `ownerResearchScopeInput` adapter sends only the question/scenario, code version, supplied Project facts and selected evidence to the actual production corpus planner and evidence assembler. It preserves 47 authored pins, including eight exact selected passages. Whole-section Zoning pins resolve through the canonical section catalog. Unknown selected sections produce an explicit failure instead of disappearing. A contract covers all 110 cases and verifies that changing evaluator answers, rubrics, authorities or reviewer notes cannot change those inputs.

The diagnostic records source IDs, section references, text hashes, completeness/truncation metadata and Zoning readiness. It inspects the web trigger with web support enabled but fetches no external document. It does not run authentication, the full HTTP handler, answer generation, semantic grading, saving or public-eligibility checks. Merely finding a reference is not a completeness or accuracy grade.

The before/after local comparison preserves all 110 input hashes and selected-source records. All eight selected passages survive assembly exactly after whitespace normalization. Every case receives some source material. MC-01 has no exact parent reference labeled MC 403, but does receive MC 403.1 and MC 403.3.1.1, along with MC 401.2. This is an exact-reference mismatch, not proof that its answer is unsupported or complete.

## Appendix J planner correction

ZR-03 asks what the selected Appendix J material establishes and what site-specific conclusion cannot be made without the applicable map and location. The prior planner required mapped status before allowing even that explanation. The planner now recognizes this narrow source-boundary request using the existing Appendix J safety classifier. It retains the property/map path, citation and source-hash controls, and semantic verification. It does not assert any parcel's mapped status.

Negative controls cover appended property questions, “our parcel,” a street address, a BBL, and changing the question to request a conclusion that *can* be made. These still stop before provider dispatch when mapped status is absent. Existing safety tests continue to reject unsupported parcel conclusions and unsafe map/table interpretations.

The retained 30-case architecture replay changes only the matching Appendix J case: 25 cases are now ready and five remain zero-provider boundaries. The other 29 case outcomes are preserved; all 16 previously accepted answers remain accepted by deterministic checks and all five known semantic failures remain rejected. The earlier replay is preserved; the new record is `evals/results/zoning-source-boundary-no-cost-preflight-2026-09-08.json`. Its cost figures are static projections, not observed service costs.

Within the 110-case source diagnostic, ZR-06, ZR-07 and ZR-13 still stop for missing property/map or historical-lot facts. Their expected conditional explanations need further work; a safe refusal is not counted as an equivalent answer.

## Explicit DOB NOW form questions

The audit also exposed two missed workflow triggers: the roof question in DOBNOW-007 and the IMD-impact question in DOBNOW-016. Both explicitly name DOB NOW but lack a filing/document verb recognized by the previous router. The router now recognizes requests about answering a question in that named portal. An unidentified form is not assumed to be DOB NOW. Mixed questions about code compliance retain the enacted-evidence path, and explicit no-web or selected-text-only requests still suppress web support. This enables ordinary official-source discovery; it does not supply an answer, choose a document page or establish a new live workflow result.

## Current limits

The campaign has provider attempts for 41 numbered owner cases: 35 of the additional 60 and six of the original 50. That leaves 69 without a provider attempt in this campaign. This source diagnostic adds no live answer coverage or latency samples. Corrected references still require professional review, and representative full-service speed and cost measurements remain outstanding.

The additional-file review remains 53 retained answers and seven revisions; its original intake hash still matches the supplied text file. MC-15's separately recorded current-consolidation refresh remains pending. This pass does not remove that source-freshness limitation.

No additional API credit was used. The 19 settled paid packages retain a conservative authorization total of $7.853484, leaving $0.146516 within the owner's $8 authorization. This is a reservation-based diagnostic ledger, not the API account balance. No push, deployment or phone testing occurred.

## Validation record

Implementation commit: `7232b6b4d`. The full `npm run check` and `npm run test:research-chat` commands passed. The final narrow DOB NOW routing addition passed the source-policy and source-selection contracts, including all 60 technical-question controls. The Zoning planner, safety and architecture contracts also passed with no paid calls.

The final all-case source/planning diagnostic is [research-owner-authored-source-diagnostic-2026-09-08.json](../permitext-sync-server/evals/results/research-owner-authored-source-diagnostic-2026-09-08.json). It identifies the implementation commit, hashes its relevant source files and all 19 historical paid ledgers, and records one result for each of the 110 cases. Its fetch guard forbids network calls; no expected answer is used to retrieve or select evidence. Reference comparisons occur only after source assembly.

The committed-source run completed with 110 cases, 1,412 source records, all eight exact selections preserved and zero network/provider calls. A final comparison verifies unchanged authored inputs and source records for all 110 cases. Only ZR-03 changes planner disposition, and only DOBNOW-007 and DOBNOW-016 change their web-support trigger. All recorded current-source hashes were rechecked after the run.

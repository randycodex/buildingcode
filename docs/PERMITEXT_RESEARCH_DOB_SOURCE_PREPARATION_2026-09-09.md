# DOB source preparation

The next paid evaluation should follow a repair to question context and document retrieval. A public-source inspection of all 24 DOB questions found two distinct gaps, without calling an answering API or testing a Project workflow.

The user's source file groups these questions under **Part III — DOB NOW Expediter / Workflow Evaluation Cases**. Thirteen exact scenario-plus-question inputs do not independently trigger the DOB workflow route when removed from that heading. A separate probe with an explicit workflow-topic prefix routes all 24. This establishes a context omission to resolve transparently; it does not authorize inserting reference answers or reviewer expectations into Research. The benchmark, actual questions, and production routing were not changed in this preparation step.

Both known official PDFs were retrieved through Permitext's bounded document parser: the [Application User Guide](https://www.nyc.gov/assets/buildings/pdf/dob_now_application_user_guide.pdf) has 38 pages and the [Build release notes](https://www.nyc.gov/assets/buildings/pdf/dob_now_build_release_notes.pdf) have 159 pages in this retrieval. Every page had extractable text. Extractable text does not verify diagrams or table geometry.

The current page selector misses the guide's relevant page for two inspected questions:

| Case | Selected guide pages | Relevant guide page |
| --- | --- | --- |
| DOBNOW-008, more-than-50-percent alteration question | 18, 20, 35 | 23 |
| DOBNOW-021, code-review-year selection | 5, 9, 15 | 19 |

A generic term-frequency ranking experiment recovered page 23 for DOBNOW-008 but still missed page 19 for DOBNOW-021. That experiment was not implemented. A retrieval fix needs to preserve question meaning, relevant neighboring conditions and source attribution across the whole document set, rather than merely swapping one scoring formula.

The retained JSON records all 24 questions, raw and separately contextualized route results, selected pages, official document hashes and source-code hashes. It contains no generated answers or paid judge results. This source-selection probe is not the actual model web-search candidate set, full HTTP readiness, current source completeness, or live filing guidance. Other FAQ and service-notice sources and conflicts remain to be checked.

Two public document requests and zero API calls were made. Provider coverage stays 83 of 110 numbered questions attempted. The current API allowance and cost figures are unchanged from `PERMITEXT_RESEARCH_REPAIR_PRESERVATION_2026-09-09.md`. The source preparation record is `permitext-sync-server/evals/results/research-owner-dob-source-preparation-2026-09-09.json`.

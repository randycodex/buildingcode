# Original code and Zoning question pass

The bounded live pass attempted 13 previously untested questions: eight delivered an answer and five failed verification. Seven delivered answers match the expected core conclusion; one lacks the requested amendment-history evidence. This is development evidence, not approval of eight complete professional answers. Coverage is now 83 of the 110 numbered questions attempted, with 27 still unattempted.

The batch used 23 provider requests. Its reconstructed usage cost is **$0.43815554** and its conservative authorization cost is **$0.818582**, below the $2 batch cap. The current $8 round totals $2.07817479 in usage estimates and $4.150641 conservatively, leaving **$3.849359** of conservative authorization. All requests settled. These amounts do not represent an account-balance or invoice check; the historical campaign remains separate.

HTTP duration was 14.607 seconds at p50 and 26.245 seconds at p90 across these 13 attempts, including failures. This small development batch is not a representative customer performance or profitability benchmark.

## Answer findings

| Cases | Finding | Next work |
|---|---|---|
| CC-02, CC-05 | Correct core conditions or authority distinction; duplicated and expanded missing facts | Consolidate missing facts and distinguish a rule-level answer from a complete project review |
| ZR-02 | Correct principal table comparisons; an unrelated table is cited for the legend, violating the selected-table-only scope | Preserve the selected table's legend and exact cell notations; remove the need for unrelated table retrieval |
| ZR-04 | No delivered answer; the draft names the subdistrict but omits its parent special district | Carry both scope names into the response |
| ZR-05 | Delivered a truthful evidence limitation, but omitted the requested amendment events | Supply the official structured history source and establish its freshness |
| ZR-07 | No delivered answer; the boundary check rejects an explicit statement that the permitted FAR cannot yet be selected | Recognize equivalent uncertainty wording while retaining rejection of appended property approvals |
| ZR-10 | Core calculation and applicable height branches match | Preserve this result in regression checks |
| ZR-11 | No delivered answer; the draft and repair mention the required modification routes, but the literal matcher misses the hyphenated wording | Verify hyphen handling with real retained drafts and negative cases |
| ZR-12 | Correct standard-rule answer; extra applicability questions interrupt it | Keep the direct standard-rule result and separate potential modification review |
| ZR-13 | No delivered answer; asks for a height fact that cannot change the stated calculation | Remove irrelevant missing facts and preserve the categorical exceptions |
| ZR-15 | Underlying use result and separate-approval limitation match | Preserve this result in regression checks |
| ZR-16 | Underlying use result matches; the table's additional-conditions notation should be explicit | Preserve the notation alongside the relevant conditions |
| ZR-17 | No delivered answer; reopens an expressly established location fact with an assumption | Apply stipulated facts directly and retain accurate existing-unit source bindings |

The selected [official ZR 42-111 table](https://zr.planning.nyc.gov/article-iv/chapter-2/42-111) includes its own legend and the M1 additional-conditions notation for outdoor racket courts. The [official ZR 101-75 page](https://zr.planning.nyc.gov/article-x/chapter-1/101-75) retains the two prerequisites and its unusual “letter trust” wording. The public History link on [ZR 42-00](https://zr.planning.nyc.gov/article-iv/chapter-2/42-00) returned 404 during the review; current amendment metadata is still unverified.

## Unattempted cases

Five cases were stopped offline and are explicitly recorded as not dispatched, with no HTTP Research operation or provider cost:

- ZR-03 and ZR-06: Appendix J selections require visual-source review.
- ZR-09: the whole-section projection exceeds the passage limit for 27-111 and 12-10.
- ZR-19 and ZR-20: the whole-section projection of 12-10 exceeds the passage limit.

An authored section reference is not necessarily an instruction to highlight the entire section. Resolve that input projection faithfully rather than dropping references, enlarging passage limits, or inventing reviewed visuals. Preliminary offline assembly also shows incomplete glossary targeting: the zoning-lot question retrieves a short alias, and the cellar/floor-area question retrieves only the base-plane definition. A smaller passage alone would not establish source completeness.

The other 22 unattempted questions concern DOB workflows. Check their guidance-routing context before dispatch. Some supplied scenarios do not explicitly name the portal; preserve their wording and avoid assuming missing context solely from the expected answer.

## Verification and retained records

The driver was committed at `ec4c26915`. All 28 recorded source hashes match that commit. The canonical preflight and live initial requests match; all 18 authored input hashes were independently checked. CC-02 and CC-05 preserved exact selected passages and supplied facts in isolated Research conversation fixtures. No Project, Notebook, Report, export, phone, or rendered UI workflow was tested. No deployment occurred.

The cost reporter now keeps not-dispatched cases separate from HTTP attempts. Re-running the preceding round's retained audit reproduced every prior attempt and summary metric; the new audit excludes the five skipped cases and reconciles all 23 new calls. No additional provider request was needed for accounting or answer review.

Records in `permitext-sync-server/evals/results/`:

- `research-owner-api-round2-original-code-preflight-2026-09-09.json`
- `research-owner-api-round2-live-original-code-2026-09-09.json`
- `research-owner-api-round2-original-code-cost-audit-2026-09-09.json`
- `research-owner-original-code-answer-review-2026-09-09.json`
- `research-owner-original-code-source-refresh-2026-09-09.json`

The live driver is consumed and must not be replayed. Repair the identified defects offline before preparing another bounded confirmation. Full answer quality, the remaining questions, and live confirmation of subsequent fixes remain open.

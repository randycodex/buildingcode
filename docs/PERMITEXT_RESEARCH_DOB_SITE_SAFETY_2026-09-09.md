# DOB source scope and site-safety confirmation

The retained DOBNOW-008 attempt failed after retrieving the general percentage question but missing the scoped site-safety material. This change adds the missing official documents, preserves their page context, and corrects an overbroad statement in the development reference. Live quality confirmation remains pending at this implementation checkpoint.

## Source and answer handling

For an ordinary DOB NOW site-safety workflow question, Research now fetches the Application User Guide, 2022 code-change presentation and related family-building service notice directly. This removes an initial search request on this route. Runtime still fetches and validates each document; catalog metadata and test fixtures do not supply answers. An explicit different source request or an enacted-code question retains its existing routing boundary.

The [2022 presentation](https://www.nyc.gov/assets/buildings/pdf/2022_code_changes_dobnow.pdf), page 17, places the SSP/Construction Superintendent statement within a family-building heading and includes a registered-General-Contractor condition. The [related notice](https://www.nyc.gov/assets/buildings/pdf/code_site_safety_1-3_family_sn.pdf) names the relevant job categories. These passages must not be generalized into a universal exemption. Publication date alone does not settle an apparent conflict with another source. The preceding visual source review is retained in `research-owner-dob008-source-scope-review-2026-09-09.json`.

The shared summary and verification instructions preserve measured quantities, units, operative actions, heading scope and unresolved conflicts. When only some documents can be validated, the source package and final evidence limitations identify the missing documents and unverified conditions. A supported narrow finding may still be delivered with the unresolved applicability clearly stated.

## Reference integrity

`dobnow008-scoped-site-safety-exception-20260909` corrects only evaluation reference fields. The direct answer accepts the stated documented 60 percent gross-floor-area alteration calculation. Final site-safety applicability remains conditional; it does not change that percentage answer. The correction is **pending professional review**.

The source packet, scenario and question remain unchanged. The parser now derives the packet's original approval status and review date, allowing an amendment to preserve that history explicitly. The legacy-reference guard rejects scoring the former answer as the current approved reference.

Compared with `b7b46dfbe`, all 110 model inputs are identical, including 47 authored evidence references and eight exact selections. Reference answers and reviewer expectations remain excluded from model input. Earlier inspection artifacts describe their recorded commits; a prior whole-key-equality assertion is not a valid check after this explicitly recorded reference amendment.

## Offline validation

- PDF ranking checks include the guide's percentage question, presentation pages 16 and 17, complete family-heading context, and the notice's job categories.
- Actual isolated Research HTTP requests with synthetic PDFs and mocked providers check generation, verification and persistence for DOBNOW-001, 008 and 021. The direct site-safety route uses two provider doubles; it also handles two unavailable documents without inventing their exceptions. Unsupported summaries and invalid PDFs still fail.
- Reference validation checks all 50 original cases, pending amendment status, original approval history, unchanged input projection and obsolete-reference rejection.
- Source selection retains the 60 added technical-question boundaries, exact-source requests and enacted-code routing.
- `env -u OPENAI_API_KEY -u PERMITEXT_RUN_PAID_RESEARCH_EVALS npm run test:research-chat` passed, exit 0. Log: `/tmp/permitext-site-safety-full-suite-20260909.log`. All provider responses in these checks were mocked or intercepted; no paid API dispatch.
- `git diff --check` passed.

## Bounded live package

The new single-use driver is `scripts/run-research-owner-api-round2-dob-safety-confirmation-20260909.mjs`. It confirms repaired cases 001, 008, 020 and 021, then attempts previously untested cases 003, 004, 006, 010, 011, 012 and 013. One HTTP turn per case; no manual retries or separate paid judge. It preserves preceding results and the full 110-case scope.

Before dispatch, the exact committed source must pass an actual HTTP preflight with every provider request intercepted. Public NYC document GETs are allowed in that preflight so the direct site-safety summary can be bound to its fetched pages. A changed initial request prevents paid dispatch. The driver requires the three site-safety documents and relevant guide/presentation pages before that case can proceed.

The batch maximum is $1.50, with a $0.50 per-turn ceiling, five provider requests per turn and 55 overall. It requires enough remaining conservative allowance to reserve a complete next turn. The fresh $8 round had $5.417557 conservatively accounted before this batch, leaving $2.582443. Historical $7.887898 is separate. The batch retains actual provider usage and conservative accounting, including failed work. [Official API pricing](https://developers.openai.com/api/docs/pricing) was checked September 9; configured standard Terra/Luna rates and web-search fees match that source.

No Project workflow, phone, UI, filing or deployment is exercised. Source/tests, live delivery, professional acceptance and production readiness remain separate evidence layers.

## Retained live result

The package ran once at `4f557f3d9e12987b70bb6f3532bf220ce4869236` and is consumed. Do not replay its live driver. Its exact-commit preflight intercepted every provider request, fetched three public PDFs, and passed all 11 inputs before dispatch.

| Measure | Result |
| --- | --- |
| Questions attempted | 11 |
| Answers delivered | 8 |
| Verification failures | 3 |
| Actual provider requests / pending | 32 / 0 |
| Public document GETs during live run | 17 |
| Provider usage estimate, including tool/cache-write fees | $0.43499860 |
| Conservative batch accounting | $0.771194 |
| Full HTTP duration p50 / p90 | 14.222 / 22.474 seconds |
| Fresh $8 round usage estimate / conservative accounting | $3.20868407 / $6.188751 |
| Remaining conservative authorization | $1.811249 |
| Full numbered cohort attempted | 98 of 110 |

These are provider-only observations from mixed development tests on isolated local accounts, not production billing or customer-month economics. Failed work is included. Delivery is not professional acceptance; cost per strictly accepted answer remains unknown.

The alteration-routing, percentage, fire-protection-water-supply and 36-hour outage answers establish useful core improvements. The percentage answer still labels an unresolved applicability relationship as a conflict. The address-only answer remains incomplete and adds an unasked electrical branch. The subsequent-filing answer overgeneralizes LOC completion and reopens an unnecessary LAA hypothetical. The PAA answer misses material limits and the official Work on Floors disagreement. The occupied-unit answer misses owner attestation and adds unasked inspection branches. Landmark, MPP and stormwater turns fail verification because of unsupported additions or ambiguous field application.

Independent source review confirms that the [current DOB FAQ](https://www.nyc.gov/site/buildings/industry/dob-now-build-faqs.page) supplies relevant completion distinctions and an Alt-CO subsequent-filing TPP exception. The [PAA page](https://www.nyc.gov/site/buildings/industry/post-approval-amendment-paa.page) and FAQ differ on Work on Floors. The [DEP page](https://www.nyc.gov/site/dep/water/stormwater-permits.page) makes City-owned-sewer drainage a separate applicability condition. These missing sources must be considered before turning a general user-guide statement into a universal result. New professional approval is not implied.

Evidence is retained in:

- `research-owner-api-round2-dob-safety-confirmation-preflight-2026-09-09.json`
- `research-owner-api-round2-live-dob-safety-confirmation-2026-09-09.json`
- `research-owner-api-round2-dob-safety-confirmation-cost-audit-2026-09-09.json`
- `research-owner-dob-safety-confirmation-answer-review-2026-09-09.json`

The cost audit and manual review bind the consumed result by SHA-256. The review records every case, its input and delivered-answer hashes, remaining defects, and the full-cohort coverage. All earlier outcomes and costs remain intact.

## Offline repair after live review

The PAA question exposed a routing collision: the pattern for `legal` also matched the prefix of `legalization`. Adding a word boundary lets a filing-status question use official guidance while preserving the enacted-evidence route for a separate legal or code-applicability question. Of all 110 inputs, only DOBNOW-004 changes its guidance-only routing decision.

Source-selection checks pass for the actual PAA question, positive and negative legalization premises, and mixed legal/technical requests. An isolated actual HTTP regression with synthetic PDFs and mocked providers now proves that DOBNOW-004 reaches official-document summary, independent verification and persistence without irrelevant enacted citations. This is an offline routing repair; it does not reclassify the retained live answer or prove that the missing PAA/FAQ coverage is complete.

After that repair, the complete offline `test:research-chat` suite passed again with the paid-evaluation environment unset (exit 0; `/tmp/permitext-legalization-full-suite-20260909.log`). Retained-result hashes, all 11 review rows, settled accounting and 98-plus-12 cohort coverage were also verified without network access.

The next work is to retrieve the relevant companion sources, preserve exact field and owner-statement scope, and distinguish actual source conflicts from missing applicability relationships. The remaining 12 unattempted cases are ZR-03, 06, 09, 19 and 20, and DOBNOW-014, 015, 016, 017, 022, 023 and 024. Earlier quality failures also remain open. No further paid dispatch occurred after this batch.

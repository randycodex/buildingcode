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

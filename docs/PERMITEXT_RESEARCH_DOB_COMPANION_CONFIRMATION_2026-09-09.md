# DOB companion-source confirmation and remaining Research work

The eleven-question API batch at `1dfe61e4d427742a47fa84ed0e52d344d2dec71e` completed with five delivered answers and six verification failures. No requests remain pending. The source additions helped the stormwater answer, but delivery is not acceptance: the subsequent-filing answer still omitted a supplied exception, and the PAA draft still failed to reconcile contradictory guidance.

The goal remains all 110 numbered questions. This batch brings provider-attempted coverage to 105/110; ZR-03, ZR-06, ZR-09, ZR-19 and ZR-20 remain unattempted. Earlier answer-quality failures remain open as well.

## Retained API evidence

All paths below are relative to `permitext-sync-server/`.

- Live result: `evals/results/research-owner-api-round2-live-dob-companion-confirmation-2026-09-09.json`.
- No-API preflight: `evals/results/research-owner-api-round2-dob-companion-confirmation-preflight-2026-09-09.json`.
- Independent retained-ledger accounting: `evals/results/research-owner-api-round2-dob-companion-confirmation-cost-audit-2026-09-09.json`.
- Manual review of every delivered answer and failed draft: `evals/results/research-owner-dob-companion-confirmation-answer-review-2026-09-09.json`.

The driver is consumed and must not be replayed. It made 30 provider requests and 22 public-document GETs, with no manual retries or separate paid judge. The batch usage estimate including cache-write rates and search fees is **$0.37844080**; conservative accounting is **$0.650016**. All eleven HTTP attempts, including failures, had a median duration of **13.631 seconds** and nearest-rank p90 of **24.728 seconds**.

The fresh authorized $8 round totals **$3.58712487 estimated usage** and **$6.838767 conservative accounting**, leaving **$1.161233 under the conservative authorization**. Historical testing is separate. These are retained-usage calculations, not a verified provider invoice or account balance. Cost per professionally accepted answer remains unknown; mixed development versions and repeated cases do not establish subscription economics.

## Findings

| Case | Result | Development finding |
| --- | --- | --- |
| DOBNOW-003 | Delivered; quality failure | Correct same-job subsequent route, but universal LOC and initiation timing despite supplied specialized completion and pre-filing qualifications. |
| DOBNOW-004 | Blocked | Correct PAA route and several limits; draft treats Work on Floors as settled despite contradictory sources. Some additional verifier objections misread the draft or supplied facts. |
| DOBNOW-006 | Delivered | Core No without MPP acceptance is supported; unasked program details remain too long. |
| DOBNOW-012 | Delivered | Inclusive impervious-area threshold, specific field, document timing, DEP drainage and exclusions are now addressed. |
| DOBNOW-014 | Blocked | Main DHCR record-conflict answer is supported; a second paragraph adds a procedural sequence not stated by the source. |
| DOBNOW-015 | Delivered | Both owner and Board attestations are correctly required; citation title could identify the release more clearly. |
| DOBNOW-016 | Blocked | Release-note text extraction misses the image table mapping the IMD answer to the required submission. |
| DOBNOW-017 | Blocked | Core ADU responses and certificate conditions are present; verifier rejects the TCO expansion. Draft includes unasked details. |
| DOBNOW-022 | Blocked | Incomplete facts prevent a recommendation, but draft adds a broad process sequence; verification partly misreads the conditional conclusion. |
| DOBNOW-023 | Blocked | Guide alone lacks explicit representative-role restrictions; relevant FAQ was not retrieved. Draft adds an unnecessary date interpretation. |
| DOBNOW-024 | Delivered | Core readiness and owner/AOR action are supported; live-record qualification can be clearer and repetition shorter. |

These are development assessments, not new professional approvals. No reference answer was changed to make a generated answer pass.

## Local repairs after the API batch

**Loft Board source coverage.** The [DOB service notice](https://www.nyc.gov/assets/buildings/pdf/26_lb_dn-sn.pdf) supplies readable text for the decision table missing from extraction of [release-note page 19](https://www.nyc.gov/assets/buildings/pdf/dob_now_build_release_notes.pdf#page=19). Both pages were rendered and visually compared in this development review. The notice and release notes are now fetched together with the application guide for the matching workflow. The service-notice PDF hash is `3f59cec0e8946db320a73934029ba31b14e0216b277916dee24cd5e5a941dfe5`; the release PDF hash is `03c2b6c9eac3f540be3911f8813b3e1a3591c25f78c7bc721d19d3ce3678b9e0`. Fixtures record source and rendered-image hashes. This repairs source coverage for this workflow; it does not implement general OCR or claim that future PDF versions have been visually verified.

**Stakeholder source coverage.** Representative-attestation/submission questions now fetch the complete Owner and Professionals sections of the [DOB NOW FAQ](https://www.nyc.gov/site/buildings/industry/dob-now-build-faqs.page), alongside the guide. The FAQ distinguishes preparation/access from submission powers and identifies the owner's own attestation step. Other FAQ workflows remain outside these scoped sections.

**Source conditions and verification.** HTML passage text now includes its original heading and FAQ question so the qualification stays attached to the answer in the primary model input. PDF page text, source hashes, citation pairs and saved-answer integrity version remain unchanged. Drafting and verification instructions require checking uncited narrowing passages, applying stipulated facts before reopening them, and distinguishing a bounded recommendation from a legal prohibition. Verification must identify an error actually present in the answer. Missing support, source conflicts and changed conditions still fail verification. Unexpanded acronyms can be retained as the source writes them; chronology and process order must not be invented.

The new source routes bypass the initial paid discovery call while retaining generation and verification. The offline HTTP checks show two provider response doubles on those routes. A live speed or cost improvement has not yet been measured for the repaired version.

## Validation and next steps

The focused source-selection, HTML attribution, summary binding/integrity and offline HTTP contracts passed. The HTTP checks retain actual evaluation questions, confirm the complete exceptions and new source material reach both model requests, and preserve rejection/accounting behavior. Mock responses do not establish semantic correctness.

`scripts/inspect-research-dob-source-conditions-20260909.mjs --fetch-public-documents` passed with 13 public NYC GETs, zero provider calls and zero paid API cost. Its retained result is `evals/results/research-owner-dob-source-conditions-inspection-2026-09-09.json`. All 110 authored inputs, 47 references and eight actual selected passages are retained. Only DOBNOW-016 and DOBNOW-023 change discovery routes; no case changes its guidance-only eligibility. Five fetched-source packages include the required conditions, with source-code hashes recorded for this implementation.

The full `env -u OPENAI_API_KEY -u PERMITEXT_RUN_PAID_RESEARCH_EVALS npm run test:research-chat` suite also passed with exit code 0; its local log is `/tmp/permitext-loft-full-suite-20260909.log`. This includes the updated source-context contracts, other Research regressions, and request-binding/budget checks. Syntax and `git diff --check` passed. No Project/Notebook/Reports/export flow, phone or rendered UX workflow was exercised. These changes are local; no push or deployment occurred.

Remaining work is to fix the five unattempted Zoning request packages without turning section references into fabricated highlights, inspect the relevant Appendix J visual evidence, and run a newly bound, budgeted preflight before more paid testing. The repaired DOB answers also need live confirmation. Preserve the full 110-case acceptance scope and use the remaining conservative allowance deliberately; request more API budget only if needed.

## Subsequent live confirmation: Loft Board PDF route

The earlier coverage counts and budget above describe that historical batch. The later mapped-review ledger records provider attempts for all 110 numbered cases, without claiming that all were delivered or accepted. At `42482e3e8268f18489de2035627197cac8c8276b`, a new single-use driver confirmed the repaired DOBNOW-016 PDF route using the unchanged authored question and scenario. Runtime behavior was unchanged after the preceding full Research suite passed.

The current service-notice PDF was fetched with the same public-request headers used by Permitext and visually inspected in full. Its SHA-256 still matches `3f59cec0e8946db320a73934029ba31b14e0216b277916dee24cd5e5a941dfe5`. The committed-source preflight fetched all three official PDFs, verified that the missing Yes/No submission mapping and source-supported sequence reached the actual summary request, and intercepted provider dispatch at zero cost. Its maximum initial request reservation was $0.121035 within the $0.50 turn cap.

The live turn delivered HTTP 200 in **35.556 seconds**, with one Terra summary and one Luna verification, no retries, no paid search, three successful public PDF GETs and zero pending provider requests. Verification passed. The answer correctly applies the stated IMD-impact facts to the Certification route, includes the Narrative Statement, and distinguishes an issued clearance from merely submitting a request. Its citations identify the service notice page and release-note page. These claims were reviewed against the supplied passages and the rendered service notice, separately from the model's pass verdict.

The case remains **core supported, with answer-key and presentation gaps**. It excludes LNO for the stated scenario but does not explain the No/commercial-unit alternative required by the key. It omits the key's source-supported sequence of adding the request after the job filing is submitted. It also presents the general either-clearance statement before applying the scenario-specific route and duplicates the server's authority disclosure. These issues were not hidden by the successful delivery or repaired source coverage; no reference answer or approval status was changed.

The generated paragraphs contain **127 words**, compared with 210 in the earlier failed draft, excluding links and server-added labels. However, drafting took **29.821 seconds** and verification **2.639 seconds**; the earlier failed full attempt took 25.498 seconds. This is not evidence of a speed improvement. The trace does not separate provider queue time from generation time. Direct document retrieval removed the former paid search call, but that did not make this individual request faster.

The retained audit estimates **$0.01280125** for this turn and **$0.023742 conservatively**, compared with $0.05746935 and $0.084072 for the earlier failed attempt. The current $8 round now totals **$7.492540 conservatively**, leaving **$0.507460**. These are recorded-usage calculations using the checked [OpenAI prices](https://developers.openai.com/api/docs/pricing), not a provider-account balance or a claim about typical subscriber costs.

Retained evidence, relative to `permitext-sync-server/`:

- `evals/results/research-owner-api-round2-loft-pdf-preflight-2026-09-09.json`
- `evals/results/research-owner-api-round2-live-loft-pdf-2026-09-09.json`
- `evals/results/research-owner-api-round2-loft-pdf-cost-audit-2026-09-09.json`
- `evals/results/research-owner-loft-pdf-answer-review-2026-09-09.json`

The driver is consumed and must not be replayed. The raw answer, verifier result, source hashes, unchanged input hash, cost ledger and separate assistant review are retained. This confirms the repaired PDF-backed workflow source path; it does not implement general OCR or establish that arbitrary scanned PDFs work. Remaining answer quality, speed and full-cohort acceptance work stays open. No Project/Notebook/Reports/export workflow, phone, UI, live filing, push or deployment was exercised.

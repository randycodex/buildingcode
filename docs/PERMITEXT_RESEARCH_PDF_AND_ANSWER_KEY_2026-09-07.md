# Research PDF support and answer-key reconciliation

Date: September 7, 2026. Scope: local implementation and verification; no paid Research, deployment, or public-release change.

## Result

Official supporting guidance can now be bound to retrieved PDF text as well as HTML. The answering path retains PDF page links, page numbers, source-byte SHA-256 fingerprints, and extraction limitations through validation and finalization. Web sources remain supporting material; this does not convert guidance into enacted law.

The [reconciled 50-case answer key](./PERMITEXT_RECONCILED_RESEARCH_ANSWER_KEY_2026-09-07.md) restores all 24 DOB NOW scenarios, the five Construction Code cases' selected passages and project facts, and the reviewed Zoning questions and source snapshot. It preserves the corrected rubrics and limited source-approval states. The supplied iCloud Markdown is unchanged.

The presentation contract now explicitly orders answers as direct answer, governing rule with citation, application/calculation, and material exceptions or missing facts. A condition that changes a Yes/No belongs in the opening answer. This is a reasoning order, not four mandatory headings. Existing question-specific paragraphs, tables, and checklists remain available.

## PDF behavior and bounds

- Retrieval accepts HTTPS HTML/PDF sources from the existing approved official domains and checks redirects against the same policy.
- HTML retains its 1.5 MB body limit. PDFs allow up to 15 MB, 200 pages, 1,000,000 extracted characters, and 18,000 characters per page. Exceeding a limit fails the source rather than silently truncating it.
- The retrieval deadline is 12 seconds. Parsing runs in a terminable Node worker with a 256 MB old-generation heap limit and a separate default 10-second extraction deadline, bounded by the enclosing retrieval deadline.
- PDF.js `5.4.149` is pinned for compatibility with the repository's existing supported Node versions. JavaScript evaluation is disabled; no external PDF resource URLs are supplied to the parser.
- Whole page text is retained, with at most three selected pages per PDF and at most three official sources per binding operation. Selection uses document text, not words in its URL, as evidence of relevance.
- Password-protected, malformed, and textless documents return explicit source failures. Blank/textless pages in mixed documents are disclosed. Scans need a verified text layer or OCR; this implementation does not add OCR.
- Text extraction is not proof of diagram interpretation, screenshot content, or complex table geometry. Those limitations remain attached to saved guidance. Page links support direct professional review.
- There is no cache of mutable official documents. HTTP retrieval still checks the source on each request. The heavy PDF parser is loaded only inside the worker, so ordinary HTML/code lookups do not initialize it.
- Explicit Vercel `includeFiles` covers the PDF worker, PDF.js module/worker files, and platform-specific canvas dependencies. An isolated local copy of those included files successfully extracted the two-page DOB notice. Deployment behavior has not been measured.

The file tracer found the new worker but reported PDF.js parsing warnings and did not independently discover all of its dynamic dependencies; explicit inclusion and the isolated-copy check address that local packaging gap. The tracer also reported a warning for an existing Clerk module.

## Official-document verification

All three PDFs were downloaded from DOB on September 7, 2026, parsed locally, and selected pages were rendered and visually compared with the extracted text. These are parser observations, not an end-to-end Research benchmark.

| Official source | Pages | Bytes | Local extraction sample | Visually checked page |
| --- | ---: | ---: | ---: | --- |
| [Builders Pavement Plan service notice](https://www.nyc.gov/assets/buildings/pdf/bpp_build-sn.pdf) | 2 | 148,880 | 745 ms | 1: August 17 filing transition, Standard Plan Review, BPP5 authorization, and separate existing-BIS-job table |
| [DOB NOW Application User Guide](https://www.nyc.gov/assets/buildings/pdf/dob_now_application_user_guide.pdf) | 38 | 773,792 | 351 ms | 7: fewer-than-100 small-business threshold, business-owner stakeholder, and separate MPP enrollment question |
| [DOB NOW Build release notes](https://www.nyc.gov/assets/buildings/pdf/dob_now_build_release_notes.pdf) | 159 | 6,378,447 | 459 ms | 10: ADU conditions, NB/Alt-CO scope, Basement/Cellar, Final CO timing, waiver and no-deferral rules |

Source SHA-256 fingerprints:

- BPP notice: `06c223de1b461d95b55c1caa95f581198ce2e79a43286483a16f2c83731af3ab`
- Application guide: `9befc1cc76dd0efbfb76fed2960c262f1c4a61fc8dd786f9c30341251cc852b5`
- Release notes: `03c2b6c9eac3f540be3911f8813b3e1a3591c25f78c7bc721d19d3ce3678b9e0`

The first request for the release-note PDF returned HTTP 403; a subsequent ordinary browser-user-agent request succeeded. Extraction support cannot guarantee that an official host will permit every fetch. Runtime failures retain the source-unavailable boundary.

## Evaluation use

Run `npm run eval:research:reconciled-key` in `permitext-sync-server` to validate source fingerprints, family counts, restored scenarios, reviewed corrections, and generated Markdown consistency. To regenerate the Markdown after an explicit reconciliation, run `node evals/research-answer-key-reconciliation.mjs --write`.

`reconciledResearchEvaluationInput()` explicitly selects only the scenario/question, code version, project facts, and selected evidence. Expected answers, required concepts, forbidden claims, and reviewer notes remain outside answering-model input. The consolidated set does not replace existing golden sets or erase retained paid-run results.

The 30 additional Zoning cases found in the repository are identified for future use but are not silently added to this 50-case set. The reconciled prose preserves recorded review scope and is not a new independent professional approval. No new generated-answer quality score is claimed.

## Verification

Focused PDF extraction/attribution, cancellation, malformed/encrypted/textless input, bounds, stable page/hash identity, saved guidance metadata, and answer-key isolation checks passed. The complete server `npm run check` and `npm run smoke` passed, including no-cost Research, source-policy, edition, governance, recovery, and HTTP workflow checks. The focused PDF and reconciliation checks also passed after the final metadata and rubric assertions were added.

The dependency audit reported two existing high-severity findings involving `@vercel/routing-utils` and `path-to-regexp`; neither is introduced by PDF.js. No unrelated dependency upgrade was performed.

## Remaining measurement boundary

No Production or physical-device PDF-supported Research answer was generated. The three single-run parser timings do not establish p50/p90 answer latency or a user-visible speed improvement. A later explicitly bounded live cohort is needed to measure generated-answer quality, total response time, source-host reliability, and cost on the reconciled scenarios.

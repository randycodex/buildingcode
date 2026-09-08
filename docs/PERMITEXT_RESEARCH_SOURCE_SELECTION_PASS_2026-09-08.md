# Permitext Research — Source-selection pass

September 8, 2026. Local implementation and verification; no deployment and no additional paid API calls in this pass.

The September 7 live pilot exposed two source-selection failures: ordinary DOB filing questions did not trigger official web guidance, and the R7A FAR question lost its structured table while being classified as a definition question. This pass repairs those paths and reviews the owner's 60 additional code cases.

## Result

| Path | Change | Verified evidence |
|---|---|---|
| Builders Pavement Plan filing | Recognizes the ordinary workflow question and freshly fetches DOB's BPP service-notice PDF before attempting model-assisted discovery. | Local authenticated Research HTTP completion with attributed PDF page, document hash, noncontrolling source label, and zero provider requests. A replay using the previously downloaded official PDF preserves Standard Plan Review, BPP5, and the August 17, 2026 date. |
| Wetlands filing documents | Recognizes the DOB NOW workflow and retrieves the official release notes. Topic terms keep unrelated release-note pages out of the answer. | The saved official release notes resolve pages 12–13. Page 155 about MIH is excluded. A synthetic multi-page HTTP test preserves the DEC determination, permit/waiver condition, page citations and zero provider requests. |
| R7A basic FAR | Treats the numerical application as a calculation even when it also names the FAR definition. Discovery retains the section's own table grid; assembly distinguishes hyphenated zoning table numbers and preserves the surrounding section and footnotes. | The actual application corpus/discovery/assembly path resolves ZR 23-22 without answer-key hints or supplied table grids. Its deterministic context requires 42,000 / 10,000 = 4.2 and the 10,000 × 4.0 = 40,000-square-foot standard ceiling. Removing the grid still blocks readiness. |
| Technical versus procedural questions | Mixed legal questions retain the enacted-evidence path. Explicit no-web and source-only instructions suppress automatic guidance. A specifically requested different document bypasses the catalog shortcut. | Source-policy checks include all 60 newly supplied technical/administrative questions and follow-up/topic-change examples. |

The catalog contains document locations and topic terms, not prewritten answers. Documents pass the existing approved-domain, redirect, byte-limit, timeout, extraction and attribution checks on each retrieval. If the direct source is unavailable or lacks a relevant passage, the existing bounded official-search path remains available. The provider request guardrails and subscriber allowance are unchanged.

## Validation

- `npm run check` passed. The final topic-filter and evaluation-provenance additions subsequently passed the focused source-policy, source-selection, HTML/PDF attribution, HTTP and review-validation checks.
- `npm run smoke` passed.
- The current 30-case zoning preflight passes all gates: 24 ready cases, 6 zero-model boundaries, 16 retained accepted answers preserved, and 5 retained semantic failures rejected. This is deterministic regression evidence, not a new model-quality score or observed service-cost estimate.
- The historical preflight used by an earlier paid authorization remains unchanged. The current replay is recorded separately in `evals/results/zoning-source-selection-no-cost-preflight-2026-09-08.json`.
- The new 60-case source-review record preserves original wording, corrected answers, source links, captured-passage hashes, and a question-only evaluation-input allowlist. Review validation prevents silently changing intake provenance or claiming professional approval.

## Limits and next work

The speed improvement verified here is elimination of provider calls for successful catalog-backed workflow excerpts. End-to-end network latency and answer quality have not been remeasured in a new paid run. No p50/p90 improvement is claimed from offline timing.

PDF answers still preserve whole pages. The BPP replay is 523 words, so a shorter answer that retains all material conditions remains a presentation task. Scanned text, diagrams and complex PDF table geometry remain outside independent extraction verification.

The pilot's construction-code completeness findings and the useful conditional response for missing property facts remain outstanding. The next live confirmation should focus on the repaired FAR, BPP and wetlands cases before expanding the paid cohort. The owner's original approximately $8 authorization is retained; this pass consumed none of it.

The companion [60-case review](PERMITEXT_60_CODE_CASES_SOURCE_REVIEW_2026-09-08.md) records 53 retained answers and 7 revisions. MC-15 has an explicitly pending current-consolidation refresh after endpoint timeouts; its 2022 published rule was verified. These cases are development evaluation material and have not been promoted to independent professional approval.

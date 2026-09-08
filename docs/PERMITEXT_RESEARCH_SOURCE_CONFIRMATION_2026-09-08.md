# Research answer confirmation — September 8, 2026

Seven of eight live questions returned answers that passed the main-answer development review. The eighth, a basic FAR calculation, failed while saving its evidence. This is progress after retrieval repairs, not a release-readiness result or a full 60-case live evaluation.

## Live results

Source commit: `1b6a193ff13021af401d537ed025d1a49af04b26`. Eight independent local HTTP conversations, one attempt each, existing Luna/Terra routing, no expected answers or grading references supplied to the model. Eighteen provider calls settled; none remained pending.

| Case | Delivered result | Full request time | Review |
|---|---|---:|---|
| FGC-03 — combined appliance input | Answer | 37.132 s | Correct conditional treatment of individual versus combined input after verification caught the first draft's aggregate-threshold error. Outdoor-opening and DEP details can be trimmed. |
| FGC-04 — concealed union | Answer | 9.684 s | Correct prohibition and accessible-location distinction. The additional appliance-union distance is peripheral. |
| MC-06 — crawl-space ventilation | Answer | 6.903 s | Correct supply/exhaust requirements, half-rate comparison and higher/later humidity trigger. |
| MC-15 — makeup-air controls | Answer | 13.388 s | Correct automatic simultaneous-operation requirement. Extra air-balance/documentation detail can be trimmed. Current-consolidation refresh of MC 508.1 remains pending in the source review. |
| GAP-05 — occupied-unit information | Answer | 19.473 s | Correct required counts, threshold, 20-unit application and amendment before occupancy. One repair added unresolved counts; the tenant-protection-plan paragraph broadens the response. |
| PC-05 — commercial disposer | Answer | 9.047 s | Correct PC 413.3 citation and DEP approval distinction. Domestic product standards and further installation details can be trimmed. |
| PC-15 — sewer backwater | Answer | 10.834 s | Correct accessible valve and permitted fixture, branch or building-drain locations; no imported prohibition on the building-drain arrangement. |
| ZR-08 — basic R7A FAR | HTTP 500 | 13.581 s | The draft calculated 4.2 FAR, a 40,000-square-foot ceiling and 2,000-square-foot excess, but lacked the FAR definition and could not be saved. Undelivered text does not pass. |

The sample's full-request p50 is 10.834 seconds and p90 is 37.132 seconds, using nearest-rank percentiles and including the failed request. These are eight selected questions, not service-wide performance estimates. The earlier pilot used different questions, so it is not a controlled before/after latency comparison. Every answer draft in this batch used Terra under the existing routing; this does not establish Luna-first economics at subscriber scale.

Returned usage estimates this batch at **$0.546209**, including the cache-write premium; there were no web-tool calls. With the earlier pilot, the cumulative estimate is **$1.066613**. The cumulative conservative provider-cost bound is **$2.162891**. These are usage-based calculations, not an invoice or an account-balance reading. Rates were checked against [OpenAI standard pricing](https://developers.openai.com/api/docs/pricing). The earlier zero-call guard stop remains a separate failed attempt with no incurred provider cost.

## FAR repairs after the live failure

The table's prepared hash binds its own reference, table text and grid. Assembly correctly retained the surrounding section and footnotes but then compared that expanded passage against the table-only hash while saving. Research now carries the exact table text separately, validates its original hash, and independently hashes the surrounding passage. Tampered table text and grids still fail. Evidence snapshots are validated before provider spending.

The ZR definitions section also lost its HTML heading structure in the application's canonical resolver. That structure is now retained internally when selecting definition entries, and the FAR abbreviation expands to the enacted definition label for zoning retrieval. The complete FAR entry, including multiple buildings on one zoning lot, is supplied instead of the opening alphabetical material.

The saved-provider-response HTTP replay now completes and reopens the historical answer with both hashes intact, the full section footnote and the FAR definition. This replay validates persistence, not the old draft's semantic quality. It makes zero external requests. A separate one-question live confirmation is prepared with a $0.85 maximum; its immutable result will establish the post-repair live outcome.

## Validation and remaining work

The source-selection, project-foundation, referenced-table, definition-excerpt, source-edition and evidence-assembly contracts passed. The complete Research chat suite passed, including PDF, ramp and selected-passage regressions. The main check (`npm --ignore-scripts run check`) and `npm run smoke` also passed. The owner retrieval diagnostics retain **44/60** complete exact-reference cases and **9/10** additional variants, with zero network calls. After retaining definition headings, average source text is 16,159 characters for the 60 cases, still about 62% below the 42,371-character baseline.

The 60-case review revised seven answer keys; those corrections remain separate from model results. Sixteen cases still lack at least one reviewed reference, and the apartment-return-air variant still misses MC 403.2.1. Concise PDF presentation, the original room-classification/plumbing-follow-up completeness issues, useful responses when property facts are absent, and broader held-out evaluations remain open. No professional approval, Production deployment, public zoning enablement, price, allowance or native-device verification is implied.

Evidence: [60-case source review](PERMITEXT_60_CODE_CASES_SOURCE_REVIEW_2026-09-08.md), [raw live results](../permitext-sync-server/evals/results/research-owner-live-source-confirmation-v2-2026-09-08.json), [manual review and cost calculations](../permitext-sync-server/evals/results/research-owner-source-confirmation-review-2026-09-08.json), [FAR persistence replay](../permitext-sync-server/tests/research-owner-far-http-contract.mjs).

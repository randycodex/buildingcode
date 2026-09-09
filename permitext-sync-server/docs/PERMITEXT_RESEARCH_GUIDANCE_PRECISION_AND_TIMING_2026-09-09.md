# Research guidance precision and timing — 2026-09-09

The initial offline implementation started from `beb08208d` and was saved as `af9bcfe34`. It prepared more precise guidance answers and better latency diagnosis without a live provider request. The subsequent bounded live comparison is recorded below; offline checks alone do not establish answer-quality or speed improvement.

## Evidence and decision

The latest retained DOBNOW-016 answer delivered successfully, but its approval paragraph started with a general choice before applying the known branch. It also omitted a source-supported filing sequence and repeated the server's authority disclosure. The detailed assessment remains in `evals/results/research-owner-loft-pdf-answer-review-2026-09-09.json`; it is not strict quality acceptance.

Reading the 18 live-result packages bound by `evals/results/research-owner-api-round2-loft-pdf-cost-audit-2026-09-09.json` gives 29 `permitext_official_guidance_summary` calls, all using Terra:

| Draft-call measure | Milliseconds |
| --- | ---: |
| Minimum | 2,445 |
| Median | 4,098 |
| Nearest-rank p90 | 8,705 |
| Maximum, latest DOBNOW-016 | 29,821 |

These are drafting durations across mixed development revisions and repeated cases, not full Research response times or a production latency distribution. The latest full HTTP attempt took 35,556 ms. One unusually slow draft does not establish a routing defect; no model or routing change is included here.

## Changes

- Official guidance prompt v6 applies supplied facts to the applicable source branch, states its required action and approval condition directly, and retains explicit prerequisites material to the requested action. It still prohibits deriving process order from page layout or inventing conditions, and preserves material exceptions and unresolved facts.
- The independent verifier is instructed to check material source-stated prerequisites as well as explicitly requested steps. Citation binding, mandatory verification, and the existing saved-summary integrity version are preserved. Drafting leaves the generic authority label to the server while keeping source-specific approval limits in the answer.
- Each existing internal provider phase event now includes at most two dispatched-attempt timing records: time waiting for headers, time reading/parsing the body, HTTP status, and body-read outcome. A body that never started has a null duration; a request rejected before dispatch has no attempt record. Retries remain separately visible within the overall phase duration.

Headers can arrive after generation in a non-streaming response. The new measurement is not provider queue time or time to first token. Reservation work, settlement, and retry waits remain in the overall phase duration. Timing records contain no question, draft, account identity, credentials, request IDs, or error text and do not enter answer content or cost records.

## Validation

Provider client and cost-usage contracts passed with external credentials removed. Tests use a controlled clock for separate header/body timing, retain cost settlement after malformed JSON, preserve the original interrupted-call failure even when an observer throws, distinguish blocked dispatch from a failed fetch, and retain separate attempts during retries.

The full offline `npm run test:research-chat` suite passed (exit 0), including official PDF HTTP delivery, mandatory verifier rejection, source attribution, saved-answer integrity, and the remaining Research regressions. Its first run stopped because the PDF HTTP test expected prompt v5; that assertion now expects v6 while continuing to require the unchanged saved-summary integrity version. The first log is `/tmp/permitext-guidance-timing-research-suite-20260909.log`; the passing log is `/tmp/permitext-guidance-timing-research-suite-v2-20260909.log`.

## Scope and budget before live confirmation

The next comparison was designed to test whether v6 improves the delivered answer without producing excessive prerequisite checks or false verifier failures. It also required a decision on the benchmark's alternative-clearance distinction. The outcome and that decision follow below.

All 110 authored cases remain in scope. This change does not establish that all cases deliver, meet their expected answers, or are professionally accepted. No Project workflow, UI, phone, push, deployment, or pricing change was exercised.

No API spending occurred in the implementation pass. Before the comparison, the round stood at $7.492540 conservatively accounted against its $8 authorization, leaving $0.507460; the usage-derived provider estimate was $3.95237992. These are not live account balances or provider invoices. Paid comparisons require newly bound, budget-checked requests; previously consumed evaluation drivers must not be replayed.

## Live comparison at `9c37e169f622cb053ab17c64518f6ead6a586be2`

The new single-use driver `scripts/run-research-owner-api-round2-guidance-precision-20260909.mjs` capped one unassigned HTTP Research turn at $0.20 and two provider requests. It completed after a zero-provider-call preflight. The authored question and answer-key hashes match the preceding test, and all three declared official PDFs reached the initial summary. No answer-key text or rubric entered drafting or verification.

Preflight request hash: `b4a3dba14a8c8dd376ea0a7605e7460e2f1edbbc522dbe9daf1811b60ea8c780`. The initial request's maximum reservation was $0.122240. The actual turn made two provider calls, no paid search or retry, and ended with zero pending reservations.

| Measure | Previous PDF confirmation | Guidance v6 comparison |
| --- | ---: | ---: |
| Full HTTP duration | 35.556 s | 14.751 s |
| Draft duration | 29.821 s | 7.292 s |
| Verification duration | 2.639 s | 4.448 s |
| Draft paragraph words, excluding citations and server label | 127 | 155 |
| Usage-derived provider estimate | $0.01280125 | $0.01523570 |
| Conservative accounted cost | $0.023742 | $0.027449 |

The delivered answer now states the applicable Certification requirement directly and restores the submit-job-filing-then-add-request sequence. Its independent verifier passed. It still omits the benchmark's short No/commercial-unit/LNO distinction and expands into Scope of Work, Documents and Signatures tab instructions. This is improved core application and sequence, with unresolved completeness and concision gaps; it is not strict quality acceptance.

The original reviewed benchmark is retained. Its alternative-clearance distinction prevents treating the two clearances as interchangeable, which is material to the requested approval boundary. The [current official service notice](https://www.nyc.gov/assets/buildings/pdf/26_lb_dn-sn.pdf) still supports that distinction. The key was not relaxed to fit the generated answer.

Measured transport time to headers was 7.253 s for drafting and 4.448 s for verification; reading the retained response bodies took 39 ms and 1 ms. Most provider-call time therefore preceded response headers. This does not isolate provider queue time from generation. The earlier draft was a latency outlier, so this single faster response does not prove a causal or general speed improvement from v6.

Evidence:

- `evals/results/research-owner-api-round2-guidance-precision-preflight-2026-09-09.json`
- `evals/results/research-owner-api-round2-live-guidance-precision-2026-09-09.json`
- `evals/results/research-owner-api-round2-guidance-precision-cost-audit-2026-09-09.json`
- `evals/results/research-owner-guidance-precision-answer-review-2026-09-09.json`

The retained audit completed without network or provider calls. The new conservative cumulative total is **$7.519989**, leaving **$0.480011** within the authorized $8 round. Its cumulative usage-derived estimate is **$3.96761562**, using the standard prices rechecked on the [official pricing page](https://developers.openai.com/api/docs/pricing) on September 9. No account balance or invoice was checked.

The next comparison should broaden to another unresolved workflow, such as the filing-representative case whose source coverage was repaired offline, while retaining this case's two remaining gaps. All 110 cases remain in scope, and no general quality acceptance follows from these two successful Loft responses.

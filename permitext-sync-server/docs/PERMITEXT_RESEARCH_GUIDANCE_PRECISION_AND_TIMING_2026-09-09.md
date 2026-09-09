# Research guidance precision and timing — 2026-09-09

This local follow-up starts from `beb08208d`. It prepares more precise guidance answers and better latency diagnosis. No live provider request was made, and no answer-quality or speed improvement is claimed from the offline checks.

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

## Remaining work and budget

Live confirmation must still test whether v6 improves the delivered answer without producing excessive prerequisite checks or false verifier failures. The benchmark's requirement to explain an alternative branch that the narrow question does not request also remains a reconciliation question; neither the answer key nor its grade was changed to make this answer pass.

All 110 authored cases remain in scope. This change does not establish that all cases deliver, meet their expected answers, or are professionally accepted. No Project workflow, UI, phone, push, deployment, or pricing change was exercised.

No new API spending occurred. The current round remains at $7.492540 conservatively accounted against its $8 authorization, leaving $0.507460. Its usage-derived provider estimate remains $3.95237992; neither figure is a live account balance or provider invoice. Any next paid comparison needs a newly bound, budget-checked request; previously consumed evaluation drivers must not be replayed.

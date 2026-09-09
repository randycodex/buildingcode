# Research guidance qualification review — September 9, 2026

The two latest live workflow answers were delivered and received passing verifier results while still omitting material conditions. Their unchanged benchmark assessment and cost ledger are retained in `PERMITEXT_RESEARCH_WORKFLOW_COVERAGE_2026-09-09.md`. This local repair strengthens the verification contract; it does not establish corrected live answers.

## Implementation

Official guidance prompt v7 requires the existing semantic verification call to review every supplied passage, including uncited passages. Each passage receives a finding: addressed, missing or misstated, or not material to the question and volunteered claims. The review includes short exact condition quotations, references to actual draft paragraphs or gap fields, and a reason. Unknown facts must not be used to dismiss a material conditional requirement; unrelated topics do not require a checklist.

The server binds the review to the complete question, facts, source text and draft. It rejects missing or duplicate passage reviews, stale bindings, invented or cross-passage quotations, nonexistent answer references and a top-level pass that also reports a missing condition. A pre-existing substantive verification failure remains a failure. The review cannot add an automatic retry or separate judge.

New saved guidance summaries use integrity version v2 and retain the source identifiers, document hashes, review and its digest. Existing v1 summaries remain readable with their prior integrity checks. Removing or changing the review invalidates a v2 record. These are integrity records, not signatures or professional approval.

The drafting response fields, model routing, 2,200-token draft limit and 1,800-token verifier limit are unchanged. The new review increases verifier input and output content within those limits; its actual latency, cost, omission detection and false-rejection rate require live measurement. Larger source packets could exhaust the output allowance. No new semantic success is inferred from the local fixtures.

## Verification and scope

The focused qualification-review and existing guidance-summary contracts passed, covering contradictory approvals, omitted review entries, stale inputs, invalid quotation/reference bindings, preservation of an earlier failed verdict, legacy saved summaries and v2 review tampering. The isolated Research HTTP contract passed with simulated official documents and provider responses. It demonstrates that missing reviews and acknowledged omissions fail without additional calls. Fixtures test transport and rejection behavior; they do not constitute model-quality acceptance.

The full offline `npm run test:research-chat` suite passed (exit 0) with the API key removed from its environment. The standalone HTTP log is `/tmp/permitext-guidance-qualification-http-20260909.log`; the full regression log is `/tmp/permitext-guidance-qualification-suite-20260909.log`. JavaScript syntax and `git diff --check` also passed. No Project workflow, UI, phone, account pricing, push or deployment is included. All 110 numbered cases and their unchanged authored expectations remain in scope.

No new paid provider request was made for this repair. The conservative authorized-round total remains **$7.593176 of $8**, leaving **$0.406824**; the retained usage-derived estimate remains **$4.00698307**. Neither is a live account balance. Further paid confirmation needs a fresh committed-source preflight and single-use driver within the remaining authorization; consumed drivers must not be replayed.

## Next measurement

Compare the checker against the retained incomplete answers and complete source packets before accepting any new answer. A model can still incorrectly label a passage not material or claim that its condition is addressed. Confirm the actual live review, answer completeness, response length, elapsed time and total provider cost; preserve failed outcomes. Bind the new qualification-review module in the fresh driver's source manifest and retain the actual verifier input for audit, rather than relying on reconstruction. This repair establishes enforceable review structure, not a proof that the underlying judgment is correct.

## Live v7 comparison at `f8070a14b78bd55f0fc882353a00f552f01a3bfb`

The single-use qualification-review driver completed two unassigned Research HTTP turns after a zero-provider-call preflight. Both initial requests matched that preflight and the preceding comparison's initial request hashes. The questions and answer key remained unchanged. Actual draft and verifier request bodies are retained with only the isolated-account safety identifier replaced; their normalized hashes match the outgoing requests. Full verifier passages equal the initial source packets, including uncited qualifications.

| Case | HTTP result | Full duration | Draft | Verifier | Usage-derived estimate | Conservative cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| DOBNOW-023 | 502, verification rejected | 22.718 s | 5.234 s | 15.082 s | $0.02334030 | $0.043672 |
| DOBNOW-003 | 502, verification rejected | 19.221 s | 6.464 s | 11.242 s | $0.01884760 | $0.033988 |

The representative draft still omitted the conditional board attestation. The checker correctly identified that omission, but also objected to applicant submission despite support in the guide and companion FAQ, and demanded generic account setup beyond the requested permission question. Three copied quotations failed exact-substring validation, including ellipsis shortcuts. This is not a successful delivered answer.

The subsequent-filing draft now describes the conditional NB/Alteration-CO LOC exception and identifies the unknown job type. It still omits the filing-extension distinction, the creation-timing qualification and the complete initial-filing CO completion path. Its submission-timing sentence must not be misreported as an explicit universal prohibition on earlier creation. The provider passed this draft, but the server rejected an ellipsis quotation and a changed-capitalization quotation. The draft prompt was unchanged, so the improved LOC discussion is a different sample, not proof that the new verifier improves drafting.

The complete reviews and source links are retained in `evals/results/research-owner-qualification-review-answer-assessment-2026-09-09.json`, alongside the qualification-review preflight, live result and cost audit. These two observations show additional verification latency and no accepted delivery. They do not justify calling the checker commercially ready.

All four provider calls settled, with no paid search or retry. The package cost was **$0.04218790 by recorded usage**, or **$0.077660 conservatively**. The round now totals **$7.670836 conservatively**, leaving **$0.329164** under $8. The cumulative usage-derived estimate is **$4.04917097**, including cache-write rates rechecked on the [official standard pricing page](https://developers.openai.com/api/docs/pricing) on September 9. No account balance or invoice was checked. This consumed driver must not be replayed.

## Subsequent local repair: prompt v8 and qualification review v2

The server now creates numbered source spans using sentence boundaries. The checker selects span indices instead of copying source quotations. Each selected span is resolved to its exact source text before saving the review, and its passage, source hash and draft references remain bound. Catalogue generation preserves all original text, including whitespace and a complete merged tail when a source exceeds 128 spans. Altered catalogues, invalid or duplicate indices and stale inputs are rejected. Semantic failures still fail; this change does not certify that a selected condition was understood correctly.

The review instructions also require considering all cited passages together before alleging missing support, and distinguish material requirements from generic account setup and navigation details. Those judgments remain model-dependent and unconfirmed by a new live call.

The responsibilities FAQ alone opts into ranking complete, explicitly linked question-and-answer pairs within its declared headings. Shared preambles or other non-FAQ material retain whole-section handling, and each selected FAQ keeps its complete question, answer and heading. The subsequent-filings section retains whole-section handling so adjacent timing and completion qualifications remain available.

A fresh public-document check selected 3,166 characters from the responsibilities FAQ instead of 12,540, with the role prohibition, owner attestation and applicant-submission context preserved. Every selected claim is an exact substring of the earlier full section text. This is a reduction in that FAQ component, not a measured reduction in overall Research time or total request size. Evidence is `evals/results/research-owner-stakeholder-faq-focus-2026-09-09.json`.

The span catalogue duplicates source text inside the verifier input but reduces copied output. Its net token cost and latency require measurement. Source selection, the isolated PDF HTTP contract, focused qualification/HTML/saved-summary contracts and the full offline Research suite all passed. Logs are under `/tmp/permitext-guidance-qualification-live-20260909/` (`source-selection.log`, `span-http.log`, `span-suite.log`). No further paid calls followed the local repair. All 110 numbered cases and remaining benchmark gaps are preserved; the next live comparison requires a new committed-source preflight and an affordable single-use package.

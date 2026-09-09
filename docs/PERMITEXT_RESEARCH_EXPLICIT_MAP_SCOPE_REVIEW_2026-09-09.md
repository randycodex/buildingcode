# Explicit semantic review for unresolved mapped applicability

This local pass starts from `5208fa9ea`. The remaining ZR-06 wording failures arise because the lexical map check can propagate a suspected property reference across a whole field. Adding more accepted sentence templates has not generalized to subsequent generated answers. The original lexical check and its adversarial tests remain intact.

The new conditional path can send that unresolved lexical finding to the semantic verifier already required for the answer. This is admission to review, not permission to deliver. It is available only for a conditional property-map explanation, with mandatory semantic verification, supplied ZR sources and an otherwise passing set of citation, coverage, materiality and answer-quality checks. Recognized direct property/actor determinations remain blocked before that call. The rule is not enabled for mock delivery, ordinary deterministic-only answers, historical-law reconstruction or unrelated safety failures.

The verifier must return one explicit scope verdict for every listed answer unit: the main answer, distinct compatibility summaries, every supporting point including headings, and uncertainty/source-limit fields. Units refer to fields in the existing proposed-answer JSON instead of repeating the narrative in the request. Identical compatibility text is grouped. Each source explanation must identify sources from that unit's actual bound source IDs. A unit containing any property determination, including a prohibition or asserted premise, must be rejected; uncertain scope must also be rejected.

The review is bound to hashes of the exact answer and source identities/text. Missing units, duplicate units, unknown or unbound sources, empty explanations, mismatched hashes, changed answers/evidence, project findings and uncertainty all fail. An ordinary `pass: true` response is insufficient. A successful scope review does not excuse an ordinary substantive verifier rejection or any other deterministic issue. Successful output retains the original lexical findings alongside the explicit review record. There is no additional model request, retry or rewrite in this path; the existing one-draft/one-verifier maximum stays in force.

Conditional drafting and verification instructions now agree that the direct answer/application and the distinct supported rules form the response together. They do not require the full rules to be repeated in both fields. Generated brevity and actual review reliability still require live confirmation.

## Offline evidence

- The actual retained storage draft is eligible for explicit scope review, without rewriting its wording. Its two omitted historical branches still fail the separate coverage check.
- The protocol contract rejects stale, missing, duplicate, mismatched and unbound review records and retains ordinary verifier rejection and unrelated safety issues.
- The real unassigned Research HTTP test covers 11 outcomes using provider doubles. Its completeness contrast deliberately adds the missing historical alternatives to the retained draft; that is a handwritten test input, not a newly generated answer. The fuller reconstruction wording that previously failed the lexical parser now reaches explicit scope review. Both rejecting and malformed review responses leave the draft unsaved and the app turn uncharged.
- The existing mapped-safety adversarial contract passed unchanged. The full `npm run test:research-chat` suite and `npm run test:zoning-architecture-v2` passed (exit 0). An initial suite run exposed missing dependencies in the offline request-builder extraction harness; those dependencies were added and the entire suite rerun successfully. No runtime gate was relaxed to address that test-harness failure.

Logs:

- `/tmp/permitext-mapped-review-retained-20260909.log`
- `/tmp/permitext-mapped-review-protocol-20260909.log`
- `/tmp/permitext-mapped-review-http-20260909.log`
- `/tmp/permitext-mapped-review-safety-20260909.log`
- `/tmp/permitext-mapped-review-architecture-20260909.log`
- `/tmp/permitext-mapped-review-research-suite-20260909.log`

## Bounded live confirmation

`run-research-owner-api-round2-mapped-review-20260909.mjs` is a new single-use driver for the unchanged authored ZR-06 question and five section references. It retains the previous terminal ledger and all earlier evidence, binds the committed runtime and actual intercepted request, checks that the historical-branch obligations reached the draft, and records whether explicit map-scope review was requested. It does not force that review when the newly generated draft passes the lexical check normally.

Maximum: one HTTP turn, two provider requests, $0.50 total, no separate judge or manual retry. The prior conservative $8-round total is $7.375051, leaving $0.624949 before this confirmation. The driver must first pass its zero-provider-call preflight at the committed source revision. No answer key is supplied to planning, drafting or verification. A terminal driver result is not automatically a passed answer.

All 110 numbered cases and the outstanding official-PDF/live-quality work remain in scope. No Project/Notebook/Reports/export workflow, UI, phone, push or deployment work is included. The current objective remains incomplete.

## Recorded live result

The committed-source preflight passed at `b8287253e6d05c2e414763de70504f990ae721a6`, with zero provider calls. The single-use live driver subsequently completed ZR-06 with HTTP 200 in **37.133 seconds**. Drafting took 22.802 seconds and verification took 13.331 seconds. Both provider requests completed; none remain pending. There was no retry, separate judge, web search or document request in this attempt. The successful app turn was charged.

The generated wording triggered explicit map-scope review. The verifier supplied all ten required unit verdicts, with bound sources and the matching packet hash. Scope review and ordinary substantive verification passed; the final answer retains the original lexical map findings and the explicit review record. The other deterministic coverage, citation and quality checks passed. No source-binding repair was needed on this draft.

Review against the reconciled ZR-06 key and retained supplied passages found the requested distinctions in the delivered answer: no determination for the unidentified property; the conditional table allowance; separate Subarea 1 and Subarea 2 paths; the performance-standard condition; missing location/map evidence; and the dated documentation, enlargement, reconstruction and nonconforming-use alternatives. The previously omitted reconstruction and undocumented-facility branches are present. The answer preserves the omitted-detail limitation on the selected excerpt. This is a bounded assistant review of one answer, not professional acceptance or a claim that all 110 cases pass.

Brevity and speed remain open. A whitespace-token count of the draft's main answer is 236 words, with another 410 in supported-point headings and explanations. The prior failed draft had 241 and 387 respectively. Compatibility summaries, citation metadata and uncertainty fields are excluded from those counts. The new answer also has 126 words of missing facts, a 24-word follow-up and 33 words of additional evidence needs; these fields repeat some of the same requests. These are stored-text measurements, not a rendered UI inspection. The prior failed attempt took 25.182 seconds, so this successful delivery is not evidence of a latency improvement.

This attempt's usage-based API estimate is **$0.052773**, with a conservative reservation of **$0.093747**. The retained audit puts the current $8 round at **$7.468798 conservatively**, leaving **$0.531202**. These are ledger calculations, not a live provider-account balance. The audit made zero network or provider calls. Historical attempts span different revisions and include failures; they do not establish typical subscriber cost or the cost per professionally accepted answer.

Retained evidence:

- [Committed-source preflight](../permitext-sync-server/evals/results/research-owner-api-round2-mapped-review-preflight-2026-09-09.json)
- [Raw live result and delivered answer](../permitext-sync-server/evals/results/research-owner-api-round2-live-mapped-review-2026-09-09.json)
- [Read-only cumulative cost audit](../permitext-sync-server/evals/results/research-owner-api-round2-mapped-review-cost-audit-2026-09-09.json)

The live driver is consumed and must not be replayed. Next work should first use offline checks to reduce repeated content and address the remaining answer defects, then select bounded live confirmations within the remaining authorization. Official-PDF live quality still needs confirmation. Runtime and evidence remain local; nothing was pushed or deployed.

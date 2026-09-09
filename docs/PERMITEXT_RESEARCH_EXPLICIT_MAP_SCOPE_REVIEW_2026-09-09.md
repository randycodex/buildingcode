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

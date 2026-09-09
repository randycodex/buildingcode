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

# Research tester feedback and regression review

The feedback loop is: tester report → owner investigation → source-reviewed expected answer → approved reference → recorded comparison after a fix. It does not automatically change a prompt, train a model, or certify an answer.

## Tester controls

Web Research offers **Add feedback details** beside the thumbs controls. Native Research uses its feedback sheet. Both accept helpful, incorrect/misleading, missing information, citation problem, too slow, too much explanation, or other feedback. Optional ratings record whether the answer was usable as written, needed corrections, or was unusable, and whether outside checking was none, brief, or substantial. A supporting reference and comment can explain a correction.

The server captures the original answer, question, citations, available context, enacted passages and official attributed excerpts. New Research answers retain their operation ID and official-source snapshot so a report can be paired with the operation's time and estimated API cost. Older answers may lack those fields; they remain unestablished rather than reconstructed from guesses. Ordinary clients receive only their feedback fields and a neutral review status, never private owner notes or regression cases.

## Owner review

1. Sign in and open `/admin/` → **Feedback candidates**. On a hosted deployment, configure `PERMITEXT_INTERNAL_OWNER_USER_IDS` with the owner's exact account user ID. The server checks owner access on every data, triage, case and export request. Local development retains its existing authenticated loopback access.
2. Triage the report and inspect its original answer/evidence. Open **Create a regression case** and enter the question, facts, expected answer, required points and forbidden claims. Use the accepted answer order: direct answer → cited rule → application/calculation → exceptions or missing facts.
3. Select evidence supporting the expected answer. If the source was missing from the original research, add the official URL, edition/date and exact excerpt you checked. These excerpts are explicitly reviewer-supplied, not automatically fetched or independently verified.
4. Save a draft, inspect it, and **Approve saved revision** with a reviewer and source-review notes. Approval applies only to persisted text. Editing an approved reference returns it to draft; earlier revisions and comparisons are retained.
5. After a fix, select a reported answer and inspect **Answer and context being compared**. Confirm its question/facts match the reference, then record a human pass or fail with explanatory notes. This action runs no model/API test. Historical comparisons remain tied to their exact reference hash; they do not prove a later revision passed.
6. Export an approved case for the engineering regression backlog. Exports contain preserved answers, context and evidence, including comparison snapshots: treat them as private research records. Editing the reference question alone does not anonymize the original snapshots.

## Free checks

```
npm run test:research-feedback
npm run eval:feedback:validate -- /absolute/path/to/export.json
```

The validator verifies approved-reference and passage hashes, and summarizes recorded human comparisons. It does **not** generate answers, judge semantics or make paid calls. This format is separate from the legacy `eval:research` runner; the latter does not accept custom feedback-case files. Engineering still reproduces the issue, fixes it, adds an appropriate automated regression, and validates real answer quality under a separately authorized API budget. Human pass/fail records support that review; they are not automatic model evaluations.

## Reading the dashboard

Usefulness rates describe explicitly rated answers, not all answers or verified correctness. The owner view displays rating coverage and outside-checking counts. Estimated API cost per usable answer remains unestablished until all completed live turns in the period have ratings, all operation costs are known, and no operation is unfinished. Failed/cancelled-operation costs are included. It is an API-cost measure, not total business cost.

## Local verification for this change

- Focused unit/HTTP checks use disposable storage, synthetic answers and an external-fetch prohibition. They cover owner authorization in hosted mode, evidence retention, rating validation, stale writes, review integrity, exports, recorded comparisons and incomplete metrics.
- Browser inspection uses the real web Research and owner console against the isolated fixture (`node tests/research-feedback-contract.mjs --serve`). No answer generation or Project workflow is required.
- The native `permitext` Debug simulator build passed. Physical-device feedback interaction and production PostgreSQL execution were not exercised by this check.
- Deployment and an updated native distribution are separate release steps; local implementation does not establish production availability.

# Code Question Phase 6 — Review

Phase 6 presents the existing Project Coordination model as an auditable Code Question review workflow while preserving legacy thread and comment compatibility.

## Delivered

- Review Requests labeled as Fact Request, Evidence Review, Interpretation Review, or Revision Request through versioned `requestType` values and compatible legacy `kind` values.
- Anchors to the Code Question, selected inputs, approved Evidence Set, bounded analysis, and professional conclusion.
- Open, Waiting, Resolved, and Dismissed states, with Reopen creating a new review round while retaining earlier comments and transitions.
- Immutable review comments and passive History entries with actor and timestamp.
- Blocking requests that prevent both conclusion approval and issuance while Open or Waiting.
- A separate immutable conclusion-approval artifact and server-authorized approval command.
- Existing shared Coordination threads remain the authoritative editable collaboration records and can be opened from the Code Question review surface.

Due dates and priority were not added because the current Coordination policy does not define them. The global Reviews inbox remains optional and is deferred; question-local and Project Coordination views provide the Phase 6 workflow.

## Verification

- `npm run test:code-question`
- `node tests/offline-contract.mjs`
- `npm run check`
- `npm run smoke`
- Rendered localhost lifecycle in the current browser tab: blocking, immutable response, waiting, resolution, reopen/round 2, second resolution, and separate conclusion approval.

The capability remains default-disabled and requires `PERMITEXT_CODE_QUESTION_WORKSPACE=1` or the local query opt-in.

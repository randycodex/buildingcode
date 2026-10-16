# Assistant context sidebar

Implements the user's sketch on `codex/research-context-speed`, following `37d3d4f9a`. Local implementation only; no push or deployment.

## Layout and behavior

The Assistant has a 320px context/history sidebar and a conversation area with a 600px minimum. Five compact icon controls with hover tooltips and accessible names keep the original proposal's related entries together: Project, Work (building use and proposed work), Code (jurisdiction, project default, searched editions), Sources (selected passages and answer citations), and Settings. The user left this grouping to implementation judgment after noting the earlier seven-entry proposal. The original **+ New chat** pill remains anchored at the bottom, as explicitly requested.

The attached Project appears under Project, and proposed work appears under Work. The duplicate summary block above the detail panel was removed at the user's request. Clicking the active context icon again closes its details and gives that space to conversation history; clicking any icon opens its panel. The closed state persists with the workspace. Context details and conversation history scroll independently. The user requested removal of the added sidebar-collapse arrow; the sidebar stays open, and the original menu/close actions align at the right edge of its header. Legacy collapse state is discarded. Empty Assistants show a new-conversation composer rather than history alone.

Work edits use the existing `/research/conversations/project-context` endpoint and server limits. Proposed work, proposed uses, and additional facts are kept separate from saved existing-property records. A draft can be configured before its first question; its context is validated and saved before the model request starts. New chat inherits the current saved design context only when it belongs to the same Project and has no pending context review. Unreviewed facts cannot bypass that review by starting a new chat. History selection replaces the context together with the conversation while retaining the history DOM, filter, and scroll. Existing answers retain the original fact snapshot. Context changes are blocked during an active answer.

Code and Sources expose actual project defaults, searched editions, selected passages, and exact answer source links. They preserve the current automatic retrieval and citation mechanisms; this implementation does not introduce new codebook restrictions or jurisdiction overrides. Settings exposes the existing safeguards, allowance, and account settings. No new answer-style or model-routing preference is represented as functional.

Draft context and selected panel persist in the existing account/workspace-scoped Research view state. They are cleared/restored with the owning workspace and account. The web shell versions include the new context module.

## Verification

- `npm run test:assistant-context`: scope/fact limits and preservation, layout normalization, workspace/account draft isolation, atomic conversation/context switching, latest-request guards, column replacement, Project binding, Notes placement, Reader widths, and shell cache coverage. Passed.
- `tests/workspace-startup-restore-contract.mjs` and `tests/project-information-columns-contract.mjs`: passed.
- Syntax and staged whitespace checks: passed.
- Rendered local browser with a disposable account and Project: set proposed work before the first question; reload draft; submit a mock Research question; confirm the three work facts reached its saved fact-usage snapshot; edit and reload context; confirm the older answer retained the earlier facts; open an exact citation in Reader; reload the view; return from New chat through history with the current context and footer intact.
- Browser test mode mocked model answers and used no paid model requests. Official public NYC property lookup populated the test site's existing-property records. Production records were not modified.

The broad `research-list-summary-contract.mjs` remains blocked by its pre-existing Notebook-to-Report assertion at line 667. The same failure was reproduced against the unchanged prior client. The aggregate suite is not claimed to be green.

Local preview: http://127.0.0.1:8794/workspace. Disposable test data are outside Git at `/tmp/permitext-sidebar-ui-20261015/`. Screenshots are stored in this task's visualization directory.

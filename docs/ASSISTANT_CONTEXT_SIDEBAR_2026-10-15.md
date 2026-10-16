# Assistant context sidebar

Implements the user's sketch on `codex/research-context-speed`, following `37d3d4f9a`. This document describes the final Work-only sidebar prepared for the authorized main release. Deployment and authenticated production acceptance must be checked separately.

## Layout and behavior

The Assistant has a 320px context/history sidebar and a conversation area with a 600px minimum. **Work is the only context button.** After reviewing the earlier five-icon version, the user explicitly chose to remove Project, Code, Sources, and Settings for this release. Project selection remains in the existing top menu, citations and source details remain with each answer, and Reader retains its passage research actions. Account allowance remains in Settings. No new codebook or building-type selector is claimed. Proposed uses remains an editable text field under Work. The original **+ New chat** pill stays at the bottom.

Proposed work appears under Work. The duplicate summary block above the detail panel was removed at the user's request. Clicking Work again closes its details and gives that space to conversation history; clicking it again restores the form. The closed state persists with the workspace. The divider between context and conversation history supports pointer dragging and keyboard resizing, keeps both areas usable, and persists its position per workspace. Context details and conversation history scroll independently. Conversation and date-group headings use sentence case. The user requested removal of the added sidebar-collapse arrow; the sidebar stays open, and the original menu/close actions align at the right edge of its header. Legacy collapse state is discarded. Empty Assistants show a new-conversation composer rather than history alone.

Work edits use the existing `/research/conversations/project-context` endpoint and server limits. Proposed work, proposed uses, and additional facts are kept separate from saved existing-property records. A draft can be configured before its first question; its context is validated and saved before the model request starts. New chat inherits the current saved design context only when it belongs to the same Project and has no pending context review. Unreviewed facts cannot bypass that review by starting a new chat. History selection replaces the context together with the conversation while retaining the history DOM, filter, and scroll. Existing answers retain the original fact snapshot. Context changes are blocked during an active answer.

The Proposed work picker uses the existing custom dropdown with shared column-menu styling and stays within the left sidebar. Browser checks confirmed matching menu/item appearance, pointer and keyboard selection, Escape dismissal, draft persistence after reload, and cleanup when returning through history.

The work choices now follow the [NYC DOB source review and Permitext scope mapping](ASSISTANT_WORK_CATEGORIES_2026-10-15.md). The UI links to DOB project guidance and distinguishes a research scope from its eventual filing type.

The retained Work form sends explicit user facts through the existing Research context endpoint. Removing informational panels does not change automatic retrieval, code-basis resolution, source dependency recovery, citation checks, or full-answer verification. Removed panel selections migrate to Work without losing drafts or the saved divider position; an explicitly closed panel stays closed.

Draft context and selected panel persist in the existing account/workspace-scoped Research view state. They are cleared/restored with the owning workspace and account. The web shell versions include the new context module.

## Verification

- `npm run test:assistant-context`: scope/fact limits and preservation, layout normalization, workspace/account draft isolation, atomic conversation/context switching, latest-request guards, column replacement, Project binding, Notes placement, Reader widths, and shell cache coverage. Passed.
- `tests/workspace-startup-restore-contract.mjs` and `tests/project-information-columns-contract.mjs`: passed.
- Syntax and staged whitespace checks: passed.
- Rendered local browser with a disposable account and Project: set proposed work before the first question; reload draft; submit a mock Research question; confirm the three work facts reached its saved fact-usage snapshot; edit and reload context; confirm the older answer retained the earlier facts; open an exact citation in Reader; reload the view; return from New chat through history with the current context and footer intact.
- Browser test mode mocked model answers and used no paid model requests. Official public NYC property lookup populated the test site's existing-property records. Production records were not modified.
- Rendered divider verification: dragged in both directions, exercised keyboard minimum/maximum and arrow adjustments, and confirmed the chosen position survived closing, reloading, and reopening Work. Conversations and date headings render in sentence case.

The broad `research-list-summary-contract.mjs` remains blocked by its pre-existing Notebook-to-Report assertion at line 667. The same failure was reproduced against the unchanged prior client. The aggregate suite is not claimed to be green.

Local preview: http://127.0.0.1:8794/workspace. Disposable test data are outside Git at `/tmp/permitext-sidebar-ui-20261015/`. Screenshots are stored in this task's visualization directory.


## Release preparation checks

- Final Work-only `test:assistant-context` passed, including migration from all four removed panels.
- `test:research-context-speed`, `test:research-latency`, verification-report and startup-restore contracts passed; offline provider fixtures exercised fresh review and rejection without live model calls.
- Deploy content and prepared Research assets verified. The locked client build passed after replacing the worktree-only dependency symlink with a fresh `npm ci`; the primary checkout's dependencies were not modified.
- Full aggregate verification is not claimed; the pre-existing list-summary assertion above remains documented.

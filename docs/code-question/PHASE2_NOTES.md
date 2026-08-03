# Phase 2 notes — Project and Question workspace shell

## Delivered

- Pure shell module: `public/code-question-workspace.js` (stages, arrangements, pane keys, deep links, filters, project/question switch).
- Workspace state: `codeQuestionWorkspace` layout field with normalization that drops stale `cq:` panes on Project/question change; old layouts still load.
- Flag-gated UI in `public/app.js` when `code-question-workspace` capability is enabled:
  - Question index pane (search, create local draft, archive/restore, open)
  - Lifecycle stage control (`aria-current="step"`) — does **not** mutate review/issue state
  - Add column / More menu for Working Notes, Workboard, Report Draft, Legacy path
  - Deep links: `#cq/project/{id}/question/{id}/stage/{stage}`
  - Project color inheritance on CQ panes
- Supporting tools remain available; nothing deleted.
- Offline shell precache bumped to include new assets (`permitext-pro-shell-v423`).

## Enablement

Still **default disabled**. Enable with:

```bash
PERMITEXT_CODE_QUESTION_WORKSPACE=1
```

(and capability contract `code-question-workspace.enabled: true` once server opts the account in).

## Intentionally deferred to later phases

- Full Define / Evidence / Analyze / Review / Issue column content (Phases 3–7)
- Server-backed question list hydration in the index (local draft list only for shell UX)
- Tool deletion or permanent nav removal of Notebook/Workboard

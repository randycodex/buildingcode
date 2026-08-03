# ADR 007 — Permission mapping

- **Status:** Accepted (Phase 0)
- **Date:** 2026-08-03

## Decision

**Do not invent a new role system.** Map Code Question capabilities onto existing organization roles (Owner, Editor, Reviewer, Viewer) and extend capability contracts additively. All enforcement is server-side as well as UI.

### Default matrix (initial product policy)

| Capability | Owner | Editor | Reviewer | Viewer |
| --- | --- | --- | --- | --- |
| Create/edit Code Questions | Yes | Yes | Comment/request only | No |
| Add/edit Project inputs | Yes | Yes | Request changes | No |
| Propose evidence | Yes | Yes | Review feedback | No |
| Approve/reject evidence | Yes | No | Yes when assigned/authorized | No |
| Run bounded analysis | Yes | Yes | Optional, policy-controlled | No |
| Draft professional conclusion | Yes | Yes | Suggest/request | No |
| Open Review Requests | Yes | Yes | Yes | No |
| Resolve assigned Review Requests | Yes | Yes | Yes | No |
| Approve conclusion | Yes | No | Yes when assigned/authorized | No |
| Issue / supersede | Yes | No by default | No | No |
| Read issued/historical | Yes | Yes | Yes | Yes if Project access permits |

### Feature capability

- Workspace feature flag / capability: `permitext:codeQuestionWorkspace` / `code-question-workspace`.
- **Default: disabled** until rollout stages allow opt-in.
- When disabled: no new navigation, no new creation commands exposed as product path.

### Policy notes

- Editors propose evidence; Reviewers/Owners approve (preserves current split).
- Broader Editor issue authority requires a separate explicit product-policy decision.
- Firm policy may tighten approval/issuance further.

## Consequences

- Phase 1 adds granular server capabilities without renaming Owner/Editor/Reviewer/Viewer.
- Unauthorized direct API calls are rejected regardless of UI state.

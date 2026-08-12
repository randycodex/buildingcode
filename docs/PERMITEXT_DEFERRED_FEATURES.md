# Permitext Deferred Features

This register preserves working capabilities that are intentionally outside the
release-critical workflow. A deferred feature must remain recoverable unless a
separate entry documents a concrete technical reason for deletion.

## Status meanings

- **Hidden**: preserved, but unavailable through normal release navigation.
- **Frozen**: preserved and maintained for compatibility, with no new product
  development planned during the current release cycle.
- **Disabled**: execution is blocked as well as hidden.
- **Deleted**: implementation or data was removed for a documented technical
  reason.

## Workboard

| Field | Decision |
| --- | --- |
| Status | Hidden and frozen |
| Deferred on | 2026-08-11 |
| Product reason | Workboard is not required for the release-critical Project -> Ask -> Research -> Evidence -> Conclusion -> Save -> Export workflow. |
| Web release surface | Hide the top-toolbar entry point, do not restore Workboard columns in ordinary workspaces, and omit Workboard from Notebook and Code Decision legacy-source navigation. |
| iOS release surface | Already hidden: there is no Workboard editor, preview, Project Hub section, or capability promotion in the current SwiftUI views. |
| Preserved web implementation | `permitext-sync-server/src/workboard.jsx`, Workboard styles/assets, detached-window support, local IndexedDB records, server sync routes, private assets, and flattened previews. |
| Preserved iOS implementation | Workboard record decoding, sync compatibility, Project foundation preview models, diagnostics, and backend transport support. |
| Preserved downstream compatibility | Existing Workboard records, images, previews, immutable report sources, account deletion coverage, and sync-conflict recovery. |
| Development state | Freeze feature development except for security, privacy, data integrity, compatibility, or restoration work. |
| Restore | Set the centralized web release visibility for `workboard` to `true`, restore the toolbar button to the default toolbar order, then re-verify web navigation, persisted workspace restoration, detached windows, sync, report previews, and the intended iOS presentation. |
| Delete only if | A migration or dependency removal provides a concrete technical reason and includes an explicit data-retention/export plan. |

### Verification required while deferred

- Workboard does not appear in ordinary web navigation or Project workflows.
- Previously open Workboard columns do not return in an ordinary workspace.
- Workboard code, stored records, previews, and report compatibility remain intact.
- iOS does not advertise or display Workboard, while existing records still
  decode safely and account deletion language remains accurate.

## Research history management controls

| Field | Decision |
| --- | --- |
| Status | Hidden and frozen |
| Deferred on | 2026-08-11 |
| Product reason | The release-critical Previous chats list needs only the original question and creation date. Per-chat renaming, deletion, Project reassignment, and Code Decision linking add management choices before reopening Research. |
| Web release surface | Show the original question and creation date as the single conversation entry point. Hide per-chat rename, delete, Project assignment, and active-decision linking controls. |
| Preserved implementation | Keep all existing rename, delete, Project assignment, and Code Decision linking handlers, routes, authorization, persistence, and UI construction behind the centralized release visibility boundary. |
| Preserved data | Conversation titles, Project links, Code Decision links, messages, sources, and timestamps remain unchanged. Existing conversations derive their original question from the first user message when a stored starter question is absent. |
| Restore | Set `releaseSurfaceVisibility.researchHistoryManagement` to `true`, then re-verify per-chat actions, Project assignment, Code Decision linking, keyboard focus, and narrow-column layout. |
| Delete only if | A replacement management workflow is shipped with an explicit migration and data-retention plan. |

## Research conversation evidence pane

| Field | Decision |
| --- | --- |
| Status | Hidden and frozen |
| Deferred on | 2026-08-11 |
| Product reason | The separate evidence pane, expand-all control, and resizable split duplicate evidence details already available with the Research answer and interrupt the release-critical conversation flow. |
| Web release surface | Hide the upper Research evidence pane, its passage expansion control, and its horizontal resize divider. Let the conversation use the full column height. |
| Preserved implementation | Keep evidence assembly, source records, passage rendering, expansion behavior, split-state compatibility, and divider behavior behind the centralized release visibility boundary. |
| Preserved data | Selected and automatically retrieved evidence, citations, source snapshots, code-basis metadata, and immutable Research answer records remain unchanged. |
| Restore | Set `releaseSurfaceVisibility.researchConversationEvidencePane` to `true`, then re-verify evidence scrolling, expand/collapse behavior, keyboard and pointer resizing, saved split ratios, and narrow-column layout. |
| Delete only if | A replacement evidence inspection workflow is shipped and existing evidence records remain reviewable and exportable. |

## Firm and collaboration workspace

| Field | Decision |
| --- | --- |
| Status | Hidden and frozen |
| Deferred on | 2026-08-11 |
| Product reason | Firm administration, invitations, shared-role navigation, and organization Project Hubs are outside the release-critical individual Project -> Ask -> Research -> Evidence -> Conclusion -> Save -> Export workflow. |
| Web release surface | Hide the Firm & Collaboration Settings card and do not load its organization administration UI during ordinary Settings rendering. |
| iOS release surface | Hide the Firm & Collaboration Settings card, do not load organization lists for that card, and do not route firm invitation links into a hidden Settings workflow. |
| Preserved web implementation | Keep organization creation, invitations, member and seat administration, Project transfer, firm controls, shared Project access, collaboration routes, and settings rendering behind `releaseSurfaceVisibility.firmCollaboration`. |
| Preserved iOS implementation | Keep organization models, backend transport, invitation parsing and acceptance, `OrganizationProjectHubView`, offline snapshots, role-aware presentation, and tests behind `PermitextReleaseSurfaceVisibility.firmCollaboration`. |
| Preserved data | Existing organizations, memberships, invitations, shared Projects, collaboration records, reports, and account-deletion coverage remain unchanged. |
| Restore | Set both web and iOS Firm Collaboration release flags to `true`, then re-verify invitation links, organization loading, role-aware Project Hub access, offline snapshots, member administration, and web/iOS Settings presentation. |
| Delete only if | A replacement collaboration model is shipped with explicit membership, shared-record, invitation, retention, and export migrations. |

## Coordination

| Field | Decision |
| --- | --- |
| Status | Hidden and frozen |
| Deferred on | 2026-08-12 |
| Product reason | Coordination requests, assignments, and review-thread columns are outside the release-critical Project -> Ask -> Research -> Evidence -> Conclusion -> Save -> Export workflow. |
| Web release surface | Hide the Project Coordination tool, Project summary, Notebook and evidence-review entry points, Report action, and persisted Coordination columns. Direct open calls are blocked while hidden. |
| iOS release surface | Hide the Coordination section in the native Project Hub. Do not add a replacement or nonfunctional handoff control. |
| Preserved web implementation | Keep Coordination panes, composer, threads, statuses, comments, permissions, routes, sync, and compatibility adapters behind `releaseSurfaceVisibility.coordination`. |
| Preserved iOS implementation | Keep Coordination models, snapshot decoding, transport, and Project Hub section behind `PermitextReleaseSurfaceVisibility.coordination`. |
| Preserved data | Existing requests, responses, assignees, statuses, linked targets, timestamps, and activity records remain unchanged. |
| Restore | Set the web and iOS Coordination visibility flags to `true`, then re-verify every Project tool entry point, persisted panes, permissions, thread transitions, linked records, narrow columns, and web/iOS parity. |
| Delete only if | A replacement review workflow ships with an explicit migration and retention/export plan for existing Coordination records. |

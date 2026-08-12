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

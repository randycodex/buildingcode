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

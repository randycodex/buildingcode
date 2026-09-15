# Column UX continuation

Updated September 14, 2026. Implements the consolidated September 12–13 column review authorized in this task. Preserve existing web visual decisions and native iPhone navigation; there is no iPad product. Navigation experiments remain proposals, not required redesigns. Physical phone validation is deferred at the owner's request; complete Simulator and local verification first. Publication is separate from local completion.

## Requirements and evidence

- [x] Research: persist unsent new questions and follow-ups, explicit conversation/History views, supplemental columns, and workspace layout without automatic submission. Implemented in b7bb9784d, pushed to origin/codex/research-continuity. Composer, layout, context-recovery, deletion and offline contracts pass. Signed-in browser verification remains pending.
- [ ] Research: meaningful titles, inspectable project/evidence context, non-color bulk selection, accessible information disclosure; audit native draft restoration.
- [ ] Notebook: correct native linked-note identity/navigation; preserve original editing state; handle renamed/deleted/unavailable links and actionable save failures. Compact note picker and focused insertion without disrupting writing.
- [ ] Reader: source/edition/chapter/passage orientation; predictable preview/keep behavior and restoration; tables, text resizing and keyboard use. Preserve native independent reading sessions.
- [ ] Report: protect source/version identity and issued contents; emphasize draft with focused Add sources; clarify save/version/export and retain disclosure state.
- [ ] Saved: pinned project tools; evidence reachability; clear source/title/excerpt/private-note hierarchy; distinguish project removal from Saved removal and verify recoverability on both platforms.
- [ ] Project context/facts: optional blanks collapsed; relevant unknowns visible; imported sources/retrieval metadata and partial lookup warnings inspectable on web and iPhone.
- [ ] Search: preserve query/filter/selection/scroll; useful paragraph parent identity and previews; content-sensitive rows; accurate grouping/counts; native long-title and Dynamic Type behavior.
- [ ] Detail: clear passage identity and Open in Reader; content-sized notes, private-note identification and actionable save failures.
- [ ] Account: modal/sheet; distinct offline library/local-save/synced guarantees, archive recovery/update path and focus restoration.
- [ ] Workspace/global: explain general workspaces as layouts over shared material, preserve project ownership and stable restoration; visible keyboard focus, non-color selection and coherent spacing.

## Verification

For each changed surface: focused contracts, UX audit/alignment checks, app-shell offline checks when applicable, rendered web checks, and native build/Simulator checks. Record failures on the unchanged baseline separately. Never count source inspection as rendered or physical-device validation.

Baseline test issues confirmed against b979339c5: web-account-isolation-contract.mjs fails at saved[0].userID; startup-critical-path-contract.mjs lacks document.querySelector in its VM fixture. These are outstanding, not passing gates.

## Deferred physical iPhone checklist

- [ ] Large text and touch targets in changed lists, references and property feedback.
- [ ] Reading-session restoration and tables during background/foreground and relaunch.
- [ ] Unsent drafts, interrupted saves, offline recovery and account isolation with real lifecycle interruptions.
- [ ] Reference navigation back to the original note and editing position; keyboard behavior.

## September 14 continuation checkpoint

Implemented on codex/column-ux-continuation:
- Web: removed the blanket suppression of keyboard focus while retaining quiet pointer focus. Visible focus verified on the rendered Saved toolbar control.
- iPhone Notebook: linked Notebook notes have distinct names/icons and an Open linked Note action. A separate read-only sheet preserves the original editor; existing unavailable/access-revoked handling remains in the destination.
- iPhone project lookup: displays backend partial-result warnings, uses an information indicator for partial results, and ignores stale-address responses.

Verification: UX audit, all eight UX/alignment contracts, offline contracts, property-context contract and Notebook-reference availability contract pass. Xcode Simulator build succeeds. Native interaction/Dynamic Type verification and light-theme web verification remain open; no physical phone validation claimed. The checkboxes above deliberately remain open for requirements not fully audited.

# UX-06 keyboard focus — September 28

Status: implemented and locally verified for the bounded cases below; broader UX-06 acceptance remains incomplete.

## Change

Removed blanket keyboard-outline suppression. Supported controls use the neutral semantic `--focus-ring` token with a2px inset outline, avoiding toolbar clipping. Composite Search fields show one ring around the whole field. Pointer-focused buttons retain no outline. No native UI changes.

Shell assets are `20260928-keyboard-focus-v587`, shell cache `permitext-pro-shell-v1230`. Required offline tests exposed an older offline-storage generation (v1224/v581) that did not match the worker; all shell consumers now agree. Immutable code/figure cache identities remain unchanged.

## Rendered evidence

Local workspace at `http://localhost:8787/workspace`, separate local data store, existing guest browser state. No account sign-out, owner data edits or paid Research.

- Before: keyboard-focused Saved had `outline: none 0px` and no shadow.
- After: toolbar focus ring is visible without clipping. Search uses one surrounding ring; result buttons and disclosures use visible rings.
- Keyboard sequence: Search input → Clear → Building2022 disclosure → collapse/expand → result opening. Disclosure retains focus and updates expanded state; result remains focused after its asynchronous Reader destination completes.
- Account opened by keyboard; Escape returned focus to Account. Groups pointer click had no keyboard outline; Escape retained its trigger.
- No browser console errors were captured in this bounded flow.
- Light theme was checked in an isolated component fixture using production CSS with dark media queries disabled. This is not a full application light-theme or signed-in workflow test; Mac appearance was not changed.
- Focus-ring contrast: light Search18.16:1, light white surface19.42:1, dark Search16.11:1 (rendered alpha background composited over black), dark black surface19.13:1. These values cover the changed ring, not every existing label/icon.

![Dark workspace Search focus](UX_06_DARK_FOCUS_2026-09-28.png)

![Light component fixture Search focus](UX_06_LIGHT_FOCUS_2026-09-28.png)

## Automated checks

`audit:ux-ui`, full `test:ux-alignment`, and `test:offline` pass. Several pre-existing contract fixtures still expected retired wording/layout or omitted new in-place-refresh dependencies. Updated tests now require recoverable Trash wording, current Saved/Unassigned titles, retained missing-facts content, both cancellation and stale-navigation guards, visible and accessible save-state feedback, and account-scoped refresh ordering. No product behavior was reverted to satisfy stale assertions.

## Remaining

Full signed-in Saved actions, all dialogs and pane operations, full application light-theme walkthrough, assistive-technology checks and native VoiceOver/Dynamic Type remain separate. No Production deployment, main merge or release is implied.

## Populated fixture follow-up

Verified the synthetic signed-in workspace using production app code on loopback, without owner data or paid Research. Saved opens with Space; selection mode toggles, Enter selects a passage and exposes project/delete actions, and Cancel exits selection. No delete or assignment was submitted.

Found and fixed a dialog return-focus bug: workspace menu actions removed their focused menu item before opening a dialog, so New Project captured the page body as its previous focus. Menu actions now focus the connected menu anchor (falling back to the workspace toolbar button) before running the action. This gives dialogs a durable return target.

Rendered verification after reloading the fix:
- New Project initially focuses Name; reverse Tab reaches Cancel and wraps to the last color control, keeping focus in the dialog.
- Escape closes New Project and returns focus to Choose workspace or project, with its visible focus ring.
- Manage Projects initially focuses Close; Escape likewise returns to the workspace trigger.
- The retained Research fixture draft remains present after reload.

Assets are now `20260928-dialog-focus-v594`, shell `permitext-pro-shell-v1237`. UX audit, full UX alignment and offline suites pass. This expands the bounded keyboard evidence; it does not close all Saved actions, dialogs, pane operations, screen-reader, full light-theme or native accessibility acceptance.

![Workspace trigger focused after cancelling New Project](UX_06_DIALOG_RETURN_2026-09-28.png)

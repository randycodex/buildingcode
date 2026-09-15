# Column UX closeout

This is the finite closeout sequence for the authorized column plan, not a new design backlog. The detailed implementation/evidence history remains in PERMITEXT_COLUMN_UX_CONTINUATION.md. Source implementation, executable contracts, rendered checks, authenticated checks and physical-device checks are separate states. A pass is not complete merely because its code exists.

## 1. Saved recovery

Local implementation and recovery checks completed: project-specific removal labels, native Project Undo and native Saved Undo. Two SQLite tests pass, including newer-note/link preservation and deleted-project handling. Rendered guest Save -> Remove -> Undo passed in Reader 1 and independent Reader 2; test passages returned to their initial unsaved states. Recovery is session-local. Signed-in propagation remains part of the authenticated integration gate; physical checks are deferred. Do not reopen for unrelated Saved redesigns.

## 2. Research and workspace clarity

Implemented: web/native composer persistence, web conversation/layout restoration, native context actions and disclosure. The promised non-color bulk-selection cue and general-workspace explanation are now implemented. Workspace explanation was rendered locally; UI/offline contracts pass. Existing title fallback and context disclosure were inspected. Authenticated history selection/context interaction belongs to the final signed-in integration gate. No further design work or paid Research run is required by this pass.

## 3. Reader and Search verification

Implemented: source orientation, derived Reader behavior, web query/filter/page/selection/scroll restoration, native query/filter/row restoration, paragraph destinations and complete authored Search filtering. Native Recently viewed nonzero position restoration passed after an actual terminate/relaunch at Text Size 9; text wrapped, and original size/query/filter were restored. Native Return submitted a section-number query and the destination table rendered within the Reader. Horizontal table gestures remain unverified with the Simulator driver and are explicitly on the deferred phone checklist; no defect is inferred. Available local checks for this pass are finished, with that device gate still open. The legacy SQLite Search limit is a separately identified limitation, not a reason to repeatedly rework the validated authored Search path. Address only failures that prevent the agreed workflow.

## 4. Notebook, Report and project facts verification

Implemented: native linked-note identity/navigation, web Report draft-first source picker and pending-save protection, native fact provenance and partial-lookup feedback. Run the connected reference/edit/return and draft/save/export/disclosure checks once, using existing supported test surfaces where available. Record authenticated checks requiring account access separately rather than claiming they passed from source tests. Preserve immutable issued reports and unavailable-source warnings.

Rendered native conflict recovery passed using the existing isolated DEBUG fixture: the local draft remained visible, Review latest version showed both versions, and Save my draft over version 2 retained the draft and cleared the conflict. The fixture's Synced label is local transport evidence only, not live account sync. Linked-note return and live Report checks remain open.

## 5. Account and final integration

Implemented: web Account modal and verified keyboard focus/close behavior. Verify local-save versus sync wording, archive recovery and native Account on available surfaces. Reconcile every original requirement to evidence or an explicit remaining access gate. Review and commit intended changes; preserve DO NOT DELETE.png. Report local commit, remote push and deployment separately. No deployment is implied by UI completion.

Native guest Account was rendered as a sheet with Close Account, explicit not-signed-in account/sync state, and sign-in guidance. Returned the app from the conflict fixture to its normal guest launch. Authenticated entitlement, archive recovery and live sync remain unverified. The local server was started on localhost:8787 for owner sign-in, but inspection confirmed its .env.local has no Clerk configuration. Sign in used the existing browser-only fallback; Sign Out therefore does not establish a real authenticated user. Neither this session nor the separate 8788 review session proves live account sync.

Owner-reported unresponsive localhost controls were traced to a stale cached legacy-workspace-restore module missing the imported legacyWorkspaceRestoreReceipt export. Updated its asset URL and the coherent shell/app cache versions in commit 3d986fbd0. Both offline contracts pass; rendered Account opens after reload. No browser storage was cleared.

Remaining access requirement: a supported Clerk development configuration (publishable key, JWT verification key or secret, frontend API and hosted account portal URLs, permitted localhost origin), plus a test account with access to Project/Notebook/Report features. Existing production configuration was not copied into localhost and no entitlement was bypassed. Real sign-in, live save/sync, archive recovery and authenticated Report export are still open; isolated fixture results cannot satisfy these gates.

## Deferred by the user

## Production verification update

The owner supplied a signed-in production tab and authorized pushes/deployment for testing. Lifetime Pro was observed in Account. Main and production advanced to 4b6042e89, then 5be5e9259; the latter was READY in Vercel and the public release endpoint reported the same commit. Local Clerk setup is therefore no longer the blocker for web checks.

In the isolated `UX verification — Sep 14` project, the sample Note title/body survived reload. Report introduction saved and survived reload. Add sources displayed the sample Note; adding it marked the block USER-AUTHORED and disabled duplicate inclusion. Done adding sources collapsed the picker. Export created VERSION 1 with two included items and a Download Web PDF control. The PDF bytes/rendering have not been inspected; clicking download alone is not completion evidence. Cross-device sync, source-return behavior and immutable-version comparison remain open.

The owner requested that new projects not automatically open Questions. The first default-state change passed contracts but failed live creation because the account-state module retained an older transitive import. After aligning that import in 5be5e9259, `UX final layout check — Sep 14` opened only Saved and retained that state after reload. Existing sample projects were preserved, including `UX layout verification — Sep 14`; nothing was deleted. Questions default is now rendered-verified on production.

The owner explicitly forbids destructive actions. Preserve the repository, deployments, databases, domain, accounts, existing work and sample projects. Do not use deletion-based acceptance checks on the live account. Physical iPhone verification remains deferred.

Production Research: an unsent sample question in the final layout test project survived reload with New chat restored. Context/privacy disclosure opened. History selection exposed a checked accessible state and a literal checkmark; Cancel restored ordinary history without deleting or editing the conversation. No question was submitted. These observations verify new-chat draft recovery and selection, not sent follow-up recovery or model output.

Report output limitation: the browser download-event capture failed, and the historical-version action invokes the print flow without exposing its output through the available browser tool. No downloaded sample PDF has been identified. Keep PDF content/rendering and historical-version comparison unverified rather than repeating the same clicks or changing export code on this evidence alone.

Physical iPhone: touch targets/Dynamic Type, interruption/background recovery, reading sessions/tables, reference return/keyboard behavior. No physical-device completion claim. Authenticated flows are not automatically deferred with the phone: complete available checks and identify exact access requirements if the remaining checks cannot run.

## Stop rule for scope growth

No additional visual redesign, architecture cleanup, new feature or unrelated legacy fix. Reopen a completed pass only for a concrete failing requirement. Existing green tests do not need repetition absent a relevant code change or failure. Completion still requires the original plan; this sequence changes execution order, not the requested end state.

Production Notebook reference verification: created `UX reference check` in the sample project, inserted a reference to `UX sample note`, opened its original body, returned through the note picker, and reloaded. The original reference-check text and its one linked note survived. Renaming the target to `UX sample note — renamed` updated the reference label; opening it retained the same body. Restored the sample target's original title. No existing user note was edited or removed. This covers web insertion, navigation, return, reload and rename identity; native linked-note return and deleted/unavailable-source presentation remain separate gates.

Native linked-note return now rendered-verified in the Simulator using an isolated DEBUG-only two-note fixture (`--native-notebook-reference-fixture`). The linked target opens in a separate sheet with a disabled title and read-only body. Done returns to the original editable title/body/reference. An edited original title survived a second open/Done round trip. Debug build passed. Returned to the normal guest launch afterward. This verifies navigation/edit preservation, not authenticated cross-device sync or physical keyboard behavior.

# Column UX closeout

This is the finite closeout sequence for the authorized column plan, not a new design backlog. The detailed implementation/evidence history remains in PERMITEXT_COLUMN_UX_CONTINUATION.md. Source implementation, executable contracts, rendered checks, authenticated checks and physical-device checks are separate states. A pass is not complete merely because its code exists.

## Historical evidence

The following dated/checkpoint prose records the sequence of work. For current done/not-done status, use the current checklist in [PERMITEXT_COLUMN_UX_CONTINUATION.md](PERMITEXT_COLUMN_UX_CONTINUATION.md#current-checklist--september-15) and the reconciled table below. Later evidence supersedes earlier pending statements.

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

Local Report PDF render check: generated the existing mixed-source manifest with the actual PDF exporter and inspected all three pages. Source classifications, Research limitations, manifest/version metadata, footer numbering and professional-use notice were readable without overlap. Found the test's old PNG triggered the image-failure fallback despite its byte-length assertion passing. Replaced it with a valid synthetic PNG and added an assertion for the embedded image dimensions. Re-rendered page 3 and confirmed the image appears with the notice/footer intact; Report contract passes. This is local exporter/fixture evidence only; production download and live historical-version comparison remain unverified.

Native unavailable reference: the missing-note path previously offered only a generic retry message. Added specific missing/inaccessible guidance for file-not-found and HTTP 403/404. A nonexistent reference in the isolated DEBUG fixture rendered that explanation with Retry and Done; Done restored the original title, body and both references. No note was deleted to produce this case. Simulator build passed and normal guest launch was restored. Live permission revocation is not claimed by this fixture.

Production Account read-only verification: Lifetime Pro and 98 remaining included Research turns were visible. Offline Access explicitly describes downloading the enacted-code library. Archived Projects reports no archived projects, so no live restore check is possible without creating an archive. Review older workspace data explains that four browser records remain preserved and isolated because ownership is unverified, offers a diagnostic download/support link, and warns against clearing site data. No import, archive, restoration, download or deletion was performed. Collapsed the disclosure and closed Account with Escape; focus returned to Account. The recovery explanation is verified; recovery mutations and cross-device sync remain unverified.

Native fact-row rendering verified using the actual ProjectStructuredFactRow in a DEBUG-only fixture. An empty unknown fact showed Not provided and Unknown. A sourced fact's initially collapsed Source details disclosed stored retrieval text and a separately labeled update date. Screenshot inspection at Simulator text size 5 showed wrapped provenance without clipping. Restored size 3 and normal guest launch. Debug build passed. This verifies row presentation, not a live property lookup or authenticated project synchronization.

## Reconciled remaining gates — September 15

This table supersedes stale “pending” statements in earlier chronological checkpoints; it does not turn fixture checks into live-account evidence.

| Surface | Verified implementation/interaction | Still unverified |
| --- | --- | --- |
| Research | Draft/context/layout contracts; native private draft-cache test; production unsent new-chat reload and selection mark; context disclosure | Authenticated native lifecycle and live sent-conversation follow-up restoration (no paid request has been made) |
| Notebook | Production insertion/open/return/reload/rename; native separate read-only linked sheet with edited-original return; missing-reference explanation; isolated conflict recovery | Live native account sync/revocation and physical editing-position/keyboard behavior |
| Reader | Source/destination contracts; actual native paragraph and table destination; independent Saved Undo; Search position restoration | Physical horizontal table gestures and interruption lifecycle |
| Report | Production draft save/reload/source insertion/version creation; pending-save executable contract; local three-page PDF visual inspection and embedded-image assertion | Production PDF delivery/content and historical-version output comparison |
| Saved | Scope and account-isolation contracts; real SQLite preservation tests; rendered independent-reader Save/Remove/Undo | Authenticated sync propagation and physical gestures |
| Project facts | Source/partial-response contract; production optional fields and successful lookup/Cancel inspected; native actual fact-row source/unknown presentation | Live partial-lookup interaction and authenticated native project view |
| Search | Production paragraph previews; local web pagination/selection/scroll reload; native query/filter/row/paragraph/count tests and rendered relaunch at large text | Physical interruption/keyboard behavior and signed-in lifecycle |
| Detail | Identity/private-note/actions implementation and existing contracts | Signed-in failure/retry presentation under actual network interruption |
| Account | Production entitlement/offline/recovery disclosure; web close/focus; native guest sheet | Live archive restore (none available), authenticated native sync, update installation |
| Workspace/global | General-workspace explanation; layout/recovery contracts; production new-project Saved-only reload; keyboard focus and non-color selection | Cross-device account lifecycle and physical acceptance |

No destructive live-data acceptance test is authorized. None should be inferred from this table. The existing non-destructive isolated tests remain evidence for recovery logic; they do not establish live sync. Physical items remain deferred by the owner. Remaining live-account/tool-dependent checks must be reported explicitly, not replaced by additional cosmetic work or repeated green contracts.

Production property lookup: entered a public landmark address in the sample project's editor without saving. The UI showed Looking up official NYC property data, normalized the address and reported 30 sourced facts from NYC Planning. Cancelled; reopening Edit Project confirmed the original blank address and description. No project update was saved. This verifies the successful lookup feedback and cancellation, not a partial response. A partial upstream response cannot be deterministically induced through the current production UI; its existing contract remains the available evidence.


## Independent verification completed after owner follow-up

Executed isolated project-manager archive/restore and cancellation/scope checks, NYC property fallback contract, Research new/follow-up composer restoration, and Report pending-save failure/continuity. All pass. These do not use live account data or paid Research.

Added `tests/column-failure-recovery.mjs` to the UX suite. It executes the actual project lookup and Detail-note closures with controlled responses: partial warnings, stale lookup rejection, lookup failure/retry, retained note text, sync-error Retry, late callbacks/timers, disconnected panels, local-only status and local-storage failure. Found and fixed web lookup warnings being discarded. A temporary localhost page using those handlers and production styles displayed the warning and sync-error Retry; Retry changed to Synced while the textarea value remained intact. The simulated Synced label is not live sync evidence. The temporary page is not part of the product.

Added an issued-Report snapshot independence assertion: changing draft inputs afterward does not mutate the issued snapshot. Report contract, all UX alignment checks (including the new recovery test), and both offline installer contracts pass. The warning fix is committed on the continuation branch, not yet production-deployed. Remaining live/native/physical boundaries in the checklist are unchanged; the independent controlled cases above no longer require user assistance.


## September 15 superseding checkpoint

Physical build 66 was installed and briefly verified signed in: tab selection held, the direct project-note editor had Done without Save, and linked-note open/return preserved the original content. Done still exposed an extra Notebook list in that build. See `PERMITEXT_COLUMN_UX_TESTFLIGHT_66.md` for the precise evidence limits. Current branch Reader/Search/Notebook changes are not a new installed release. The current implementation checklist and remaining definition/link and Simulator verification work are in `PERMITEXT_COLUMN_UX_CONTINUATION.md`.

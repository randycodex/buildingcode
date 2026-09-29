# First-release cross-device Saved and Notebook reliability

Status: in progress. Owner confirmed both devices use the separate test account and explicitly authorized test Project/Saved/Note creation. Web Pro access is confirmed. No test-account credentials or personal identifiers belong in this document.

## Prerequisites

1. Owner signs into the same separate test account on iPhone and web; no agent-driven main-account signout or test seeding.
2. Confirm test-record creation is allowed. Record native build and actual web URL/deployment; production web and performance preview are distinct versions. Last installed native build is41.32; revalidate if it changes.
3. Record initial visible Project/Saved counts and chosen source scope. Use only a unique test prefix, e.g. `Release check Sep28`, and preserve existing records.
4. No Instruments, simulator, speed benchmark, source disabling, paid Research or account deletion is part of this check.

## Bounded sequence and evidence

1. On web, create one clearly labeled test Project. Confirm it appears on iPhone after normal sync; record any manual refresh needed. A matching name alone is not enough when duplicates exist: compare identity through ordinary available UI/authorized readback.
2. Save one actual2022 passage on iPhone without assignment. Confirm the same citation/body appears in web Unassigned. Do not reuse an already saved passage or interpret its preexisting appearance as new-sync proof.
3. Assign that test save to the new Project on web. Confirm iPhone membership and that it is no longer incorrectly shown as Unassigned. Check save count stays one rather than producing a duplicate.
4. Create a test Note in the Project on one device. On the other, verify its title and distinctive body marker, then append a different marker using the supported editor. Verify both markers on the original device after sync. Do not overwrite simultaneous unsaved edits.
5. Relaunch native app and reload web after saves are visibly complete. Confirm Project, membership, citation/edition and Note body remain intact.
6. Verify bounded background/foreground recovery. Connectivity interruption is a subsequent named step only where supported and controllable; do not change host networking or claim an offline pass from an online reload.
7. Record actual result for each step, including platform/version and whether UI/readback agrees. Stop and preserve local drafts if any write fails; do not delete/recreate records to conceal failure.

## Completion and boundaries

Passing establishes the chosen two-way Project/Saved/Note journey on the tested artifacts. It does not prove concurrent conflicting edits, account isolation, large-account scaling, full offline behavior or TestFlight/App Store acceptance. Existing isolated local and PostgreSQL tests supply separate account-isolation evidence; physical account switching needs its own explicit controlled sequence.

Leave created test records in place for owner inspection unless cleanup is authorized through the normal recoverable product flow. Record only a concise sanitized outcome and links to evidence. No current cross-device pass is claimed.

## Preliminary source review

No new defect was demonstrated. Existing native logic preserves the pull cursor after push acknowledgement and leaves an entity unresolved while sibling queue items remain. Web transport checks identity after fetch and JSON parsing, and acknowledgement matches queued entry identity/time to avoid discarding newer edits. Existing native tests cover several persistence/account/conflict cases; their presence is not a claim of current device execution.

The bounded host regression now passes: `npm run test:native-saved-queue-reopen` (macOS/Xcode command-line tools, no simulator). It compiles39 unchanged production UserDataStore methods, production schema/migrations and the full SQLiteConnection. Synthetic fixture: save to Project1, claim upload, move to Project2 and back while that upload is outstanding, acknowledge the old batch, fail the newer batch, close/reopen the actual SQLite database, retry and acknowledge. The newer assignment remains pending until its own final acknowledgement; retry preserves operation order, payload and edit timestamp. Temporary compilation with the unresolved-sibling guard removed fails at the independent pending-state assertion, demonstrating regression sensitivity. Temporary compiler/database artifacts are removed in finally. No production fix was necessary. Log: `/tmp/permitext-saved-queue-host.log`.

This is local queue durability evidence only. Transport failure is represented through the production failed-queue method; no actual network or cross-device delivery is exercised. It does not replace the cross-device rendered sequence above. Owner arranged Lifetime Pro access for the separate account; no entitlement grant was performed by this task.

## Live acceptance checkpoint

Production web at `https://permitext.com/workspace` displayed release `55302eded237` in its feedback link before the test. This differs from performance-branch preview v606 and must not be described as its hosted private-account acceptance. Native last verified installed build41.32.

Created `Release check Sep28` Project with a synthetic-only description and `Release sync check` Note containing `WEB-A: synthetic sync marker for Release check Sep28.` Web reported Synced; full reload restored Project, selected Note and exact marker. Mirroring then showed the same Project and Note/body on iPhone, establishing bounded web-to-native delivery.

A second text block was added on iPhone. Remote text entry was unreliable and clipboard paste timed out; the owner reported direct typing worked. Actual resulting text was `B:urn sync marker from iPhone.` (not the requested complete IOS-B marker). Both devices rendered that exact text. Web full reload retained both paragraphs, establishing bounded native-to-web delivery and persistence.

Native continued to show “Saving…” and remote Done/back/tab taps had no visible effect, although Mirroring Home/App Switcher worked. After confirming both paragraphs persisted on web, Permitext was closed through App Switcher and reopened. Project, Note and both paragraphs remained; the editor showed “Synced” and Done/navigation worked. This establishes online native reopen recovery, not a diagnosis of the earlier stuck state. No Instruments was used. Recovery screenshot: `/tmp/permitext-note-reopen-synced.png`.

A single unassigned save was created using the native Reader bookmark action. Native Unassigned count changed from zero to one and showed Building Code 2022, Chapter 1, **102.3 Application of references**. Caveat for follow-up: the chapter viewport before the toolbar save displayed 101.1 and nearby text, so the toolbar's selected-section targeting needs a separate bounded check; do not claim the intended visible paragraph was saved. The actual saved citation was inspected in its detail card.

**Release blocker found:** production web's Project workspace provides no direct visible Unassigned destination. Saved shows only current Project content; workspace menu and Manage Projects do not expose Unassigned. Source review confirms this also exists on the current performance branch: technical General is hidden, Project Saved is scoped, and the Unassigned tile is inside a hidden section. A named ordinary workspace is an indirect route, but users should not need to create one to find existing saves. A focused direct-navigation fix is implemented and locally verified; hosted acceptance remains pending. Preserve the one unassigned record for verification; web assignment and full cross-device Saved acceptance remain pending.

No test records deleted, source settings changed, Research run or Instruments capture performed. A separate edit/revert autosave status defect was identified and is now fixed with a host regression (details below); it is not established as the cause of the observed phone behavior. Physical acceptance of that fix remains pending.


## Direct Unassigned navigation fix — local acceptance

Web asset generation `20260928-unassigned-navigation-v607`, shell1250 adds an explicit **Unassigned saves** workspace-menu action. It reuses a non-Project workspace or restores the hidden technical fallback; it does not create a user Project. It preserves Project snapshots and Saved pane identities, clears only the destination Saved filters, confirms pending workspace transitions and fences account changes.

Behavioral production-function tests cover a Project-only registry, existing General, existing ordinary workspace, repeated navigation without duplication, cancellation, account change and preserved Project layout/evidence identity. Project-workspace, startup/restore, research-list-summary and shell-rollout contracts pass. Full `npm run smoke` also passed (exit0; `/tmp/permitext-unassigned-smoke.log`).

Rendered local acceptance used the isolated small fixture on port8818 (12 synthetic saves: six assigned, six unassigned). From Synthetic Project1, the menu action opened all six unassigned 2014 passages. Switching back restored its three assigned 2022 passages and Project tools. Screenshot: `/tmp/permitext-unassigned-web-fixed.png`. The local browser used natural worker update/reopen to load the versioned change. This is not Production or authenticated cross-device acceptance of v607. The production test account's single Unassigned save remains untouched for that next check.

Hosted exact-byte verification now passes for v607 HTML, app, offline storage and service worker on READY preview commit `29f92805e24fe8b1948c6e9dfae5b6679aa44e91`; cache headers also match the intended policy. Evidence: [preview identity](PERF_PREVIEW_UNASSIGNED_2026-09-28.json). The preview requires its own test-account sign-in, requested from the owner. Production remains unchanged; authenticated assignment is still pending.


## Native autosave status correction

Confirmed defect: an edit set “Saving…”, but reverting to the last synchronized content before the 650ms debounce returned early without resetting status or durably replacing the changed draft. The correction cancels the obsolete debounce and caches the reverted state before displaying “Synced”. It preserves pending/in-flight save receipts and conflict review instead of treating local equality as proof that an uncertain server write never happened.

`npm run test:native-notebook-autosave-revert` passes on the Mac without simulator/device runtime. It compiles production autosave/save/cache/acknowledgement methods and models against a controlled network adapter and a real temporary draft JSON file. Cases: revert before dispatch (zero writes), revert during a held write (compensating versioned save after acknowledgement), failed/uncertain receipt retained through draft-file reopen, disk failure, and unresolved conflict. A compiled pre-fix mutant fails the status assertion. Log: `/tmp/permitext-note-revert-host.log`. Temporary test files are cleaned automatically.

This does not prove the earlier Mirroring/app navigation symptom was caused by the status defect. Native Release build41.33 is being prepared for actual app acceptance;41.32 remains the last verified installed build until installation is independently confirmed.

# First-release cross-device Saved and Notebook reliability

Status: in progress. Owner confirmed both devices use the separate test account and explicitly authorized test Project/Saved/Note creation. Web Pro access is confirmed. No test-account credentials or personal identifiers belong in this document.

## Current checkpoint — September29

Web-to-native Project/Note and native-to-web Note delivery passed with the exact recorded paragraphs. Production v607 Unassigned navigation and durable web Project assignment also passed. iPhone receipt of that assignment is now verified on41.34. Native41.34 is now installed and launch-verified; the executable and Reader source hashes match the prepared provenance. Physical edit/revert and ordinary-section101.2 bookmark checks now pass alongside chapter-top101.1.

The chronological findings below include superseded pending/fix/build statements; the September29 outcome sections and this checkpoint govern next actions. Preserve the existing single102.3 test save and Note. No repeat record creation is needed.

## Prerequisites

1. Owner signs into the same separate test account on iPhone and web; no agent-driven main-account signout or test seeding.
2. Confirm test-record creation is allowed. Record native build and actual web URL/deployment; production web and performance preview are distinct versions. Last verified installed native build is41.33;41.34 is prepared but uninstalled. Revalidate after installation.
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

This does not prove the earlier Mirroring/app navigation symptom was caused by the status defect. Native Release build41.33 built successfully and passed strict code-signature verification from commit `8935b694e`; [build provenance](RELEASE_41_33_BUILD.json). After the owner reconnected, CoreDevice installation succeeded, the installed-app query confirmed1.0/build41.33, and launch succeeded. Rendered acceptance is pending.


## Confirmed Reader bookmark targeting follow-up

Source/corpus review explains the earlier102.3 save at the Chapter1 top. Native chapter-top navigation correctly chooses the first document block, but `currentBookmarkSectionID` falls back to remembered section ID when the current heading has no exact prepared-section match. Actual2022Building Chapter1 starts with a chapter heading (no section number), then group101 (no exact leaf record);101.1 is ID1, whereas remembered102.3 is ID13. Both unresolved headings can therefore save staleID13. Fix this source-identity defect next; use actual corpus metadata and retain ordinary valid-section targeting. No fix or phone acceptance is claimed yet.


## Owner pause checkpoint

Owner needed the phone within two minutes and offered to pause; work paused at this safe point. Build41.33 is installed and launched. Mirroring confirmed the test Project and Note reopened, both prior paragraphs were intact, and status displayed “Synced”. No new note edit was performed; physical edit/revert acceptance remains open. Phone interaction stopped.

Preview test-account sign-in and authenticated Unassigned assignment remain pending. The confirmed native bookmark-targeting fix has a partial, uncommitted edit in `NativeChapterTextReaderView.swift`; its agent was interrupted at the pause. Do not treat that edit as reviewed, tested, built or installed. Resume by inspecting that diff and completing its actual-corpus regression before preparing another native build.41.33 contains only the committed autosave fix.


## September29 — Reader bookmark correction

Resumed on `codex/reader-save-target` from merged main `0c729b7d1`. The preserved partial correction is now reviewed and covered by an actual-corpus host regression. Chapter/group headings resolve the first valid descendant using the existing code-scoped section lookup; numeric groups stop at sibling boundaries. Unknown/unloaded targets and pending navigation disable saving instead of reusing remembered or initial section IDs.

`npm run test:native-reader-bookmark-target` passes: the actual bundled2022Building Chapter1 chapter heading and group101 resolve to101.1/ID1 despite remembered102.3/ID13; an ordinary102.3 heading still resolves toID13. Equal HTML heading levels, sibling and code boundaries, unknown/unloaded targets and pending navigation are covered. A compiled pre-fix mutant fails the actual-corpus assertion. Existing native metadata and parser contracts also pass. Log: `/tmp/permitext-bookmark-target-test.log`.

Release build41.34 succeeded and passed strict signature verification without simulator, device use or Instruments; [provenance](RELEASE_41_34_BUILD.json). It is not installed;41.33 remains the last verified installed version. Physical acceptance remains required: open Chapter1 from its card after previously visiting102.3, save at the chapter top, and verify101.1 in Unassigned; verify ordinary102.3 save separately. Preserve the existing test save until its cross-device assignment check is complete; do not silently delete it to conceal the prior mismatch.


## September29 — Production web acceptance after merge

`https://permitext.com` now serves exact merged-source bytes for v607 HTML/app/offline-storage/service-worker, with intended cache headers. [HTTP evidence](PRODUCTION_WEB_2026-09-29.json). This verifies those public artifacts, not every deployed backend file.

Using the existing authorized separate Pro test-account session, reloaded Production and opened the new **Unassigned saves** menu action. The one native-created2022Building102.3 “Application of references” appeared with the same body previously observed on iPhone. Assigned it through Select saved evidence → Add to project → Release check Sep28. The operation completed and Unassigned showed “No unassigned saves”. Opened the Project and fully reloaded: exactly one102.3 passage remained in its Saved evidence. Notebook still showed `Release sync check` with both exact prior paragraphs. Screenshot: `/tmp/permitext-production-assignment-20260929.png`.

This establishes native-created save delivery to Production web and durable web assignment. iPhone receipt of the new membership, zero Unassigned count there, and native reopen after assignment remain pending. The prior preview sign-in request is superseded for this journey because owner-authorized main merge made v607 available in the existing Production session. No additional records, deletions, Research calls, account changes, simulator or Instruments.

## September29 resumed device session

CoreDevice installed and launched41.34; installed-app query confirms1.0/build41.34. Executable and Reader source hashes match RELEASE_41_34_BUILD.json; strict signature verification passes. Mirroring connects. Account inspection shows the owner main account, not the authorized separate test identity; no Saved or Note mutations were performed. Requested owner switch to the existing test account before bookmark/sync write acceptance. Installation is complete; functional acceptance remains pending.

## September29 physical41.34 acceptance: assignment and chapter-top save

Owner switched to authorized test account; Account displayed its expected identity, Lifetime Pro and Synced. Project Release check Sep28 shows one assigned2022 Building102.3 passage. Its detail confirms Application of references, correct body and Project folder chip. Unassigned initially zero. Existing Release sync check Note preview retained both exact recorded paragraphs. An additional Untitled Note exists; it was not created or edited during this session. Screenshot: /tmp/permitext-41-34-assignment.png.

Opened2022 Building Reader Chapter1 at top (chapter/group headings and101.1 visible). Bookmark was empty. Saving once, then Done, produced one Unassigned entry101.1 Title. Detail confirms2022 Building, SectionBC101 General,101.1 and correct title text; no Project membership. Original102.3 remains assigned and Project count one. Screenshot: /tmp/permitext-41-34-bookmark1011.png. Preserve both test saves. This verifies the chapter-top target on the physical build; ordinary in-chapter section targeting, edit/revert, interruption, native accessibility and distribution remain separate open checks.

## September29 resumed acceptance: ordinary bookmark and edit/revert

On installed41.34, Jump within chapter selected101.2 Scope in2022 Building Chapter1. The header and leading text both showed101.2, with an empty bookmark. One save produced a second Unassigned record. Opening it confirms101.2 Scope,2022 edition and correct full Scope body. Existing101.1 remains once in Unassigned and Project102.3 remains assigned. Screenshot: /tmp/permitext-41-34-bookmark1012.png. This ordinary-section case uses101.2 instead of re-saving/removing the already-assigned102.3.

Existing Release sync check Note initially showed Synced and both recorded paragraphs. Typed one temporary x and deleted it; observed Saving during this separated edit, then Done/reopen showed exact original text and Synced. A second rapid x/BackSpace pair in one tool call returned Synced while the editor remained open, without requiring relaunch. This is physical rendered edit/revert acceptance; it does not measure the debounce interval or server request count. Done completed normally. Screenshot: /tmp/permitext-41-34-note-revert-synced.png. No original text, Project assignment or unrelated Untitled Note was changed.

Remaining: mixed-use/background/connectivity interruption, native accessibility, authenticated web candidate and distribution acceptance. No Instruments or simulator used.

## September29 physical background/foreground check

On41.34, existing test Note showed both original paragraphs and Synced. Home Screen then App Switcher return retained both paragraphs and Synced, with Done responsive. Switched to Reader:2022 Building101.2 Scope and filled bookmark retained. A second Home/App Switcher return retained the same Reader target and bookmark. No crash or stuck state observed in these bounded online transitions. This is not process termination, connectivity loss, memory pressure or sustained-duration acceptance. Owner asked to perform one direct offline Note read/recovery check because disabling phone Wi-Fi interrupts Mirroring; response pending.

## September29 physical offline read and reconnect

Owner performed requested direct-phone Airplane Mode/Wi-Fi-off Note-opening check and reported “they opened.” On Mirroring reconnect, Project displayed an Offline snapshot banner and retained both Note paragraphs. Opening Release sync check showed exact original paragraphs and Synced. Returning to Project removed the Offline snapshot banner; assigned102.3 remained. Screenshot: /tmp/permitext-41-34-offline-return.png. Offline opening is owner-observed; post-reconnect content/status are agent-observed. This closes bounded offline read/reconnect, not offline editing, process termination, conflict or server-write acknowledgement.

## September29 physical process termination and reopen

On installed41.34 with the authorized test Project visible and no active edit, CoreDevice identified Permitext PID15455, sent SIGKILL, and successfully launched com.randycodex.permitext again. Saved reopened with one Project-assigned record and two Unassigned saves. Opening Release check Sep28 retained102.3 and both existing Notes. Release sync check displayed both exact original paragraphs and Synced. Screenshot: /tmp/permitext-41-34-process-restart-note.png. No records were modified.

Reader reopened at Building Code2022 chapter cards, rather than the previous101.2 reading position; the second slot showed Another reading. Opening Chapter1 rendered the correct chapter top with the101.1 bookmark filled. Screenshot: /tmp/permitext-41-34-process-restart-reader.png. This proves bounded saved-work readback and usable Reader after process termination, not restoration of the prior Reader position/second source, interrupted unsaved-write durability, offline editing, or sustained-use acceptance. Reader restart continuity needs source/product-intent review before calling it a defect or passing that requirement. No Instruments or simulator.

### Restart continuity review outcome

Tapping the second Reader after restart restored Mechanical Code2022 correctly; its initial Another reading label was a lazy-loading summary, not lost source selection. BrowseView keeps openedChapter in view-local State and does not restore that route at initialization. Persisted lastOpenedChapter feeds warming, while explicit chapter-card taps intentionally open the chapter top. This explains the observed behavior and does not establish a saved-work loss defect. Automatic chapter resume after full process termination is a potential UX enhancement, not a newly added first-release blocker; existing tab-return continuity and explicit chapter-top behavior must be preserved. No runtime change made.

# First-release performance and UX priority checklist

> **September30 owner constraint:** Do not submit to the App Store or release the app. Continue phone-independent verification only for now. Read-only inspection of the already-triggered Xcode Cloud build is permitted; do not interpret a passing archive as submission authorization.

> **Owner scope update — September29:** All remaining accessibility tasks are deferred for now, including VoiceOver, Dynamic Type and broader assistive-technology checks on web/iOS. They are unverified backlog, not current release prerequisites. Preserve completed fixes and evidence. This update supersedes older accessibility requirements below until the owner resumes them.

Date: September 28, 2026. Status: priority order updated at the owner’s request. Owner has resumed implementation and authorized cleanup of unnecessary artifacts; release remains separately authorized.

The owner asked which work matters most before first release. This checklist separates minimum release acceptance from the larger optimization backlog. The full [performance and UX plan](../PERMITEXT_PERFORMANCE_AND_UX_PRIORITY_PLAN_2026-09-22.md) remains incomplete. Remaining full-plan requirements retain their status; lower-priority work is not marked complete.

## September29 draft recovery update

Complete application transport-loss recovery now passes locally: two edits survived failed offline navigation and a later reopened tab, and the latest draft reached canonical server version3 with a Synced UI. A fresh origin without offline preparation could not reopen during the outage; A subsequent supported offline download, disconnected reload, retained Note edit and correct Saved detail now pass locally; see [prepared offline acceptance](../ux/UX_11_PREPARED_OFFLINE_NOTEBOOK_2026-09-29.md). Physical/hosted acceptance remains open. See [bounded evidence](../ux/UX_11_TRANSPORT_RECOVERY_2026-09-29.md). No phone or Production acceptance is implied.

## Current scope — speed tuning paused on iOS and web

Owner reports the iOS app feels fast and explicitly asked to pause web speed work too. Further speed tuning, benchmark expansion and routine Instruments captures are paused on both platforms. Resume them only for a specific reproduced delay or owner request. No Instruments use is planned for the next reliability/UX work; a concrete freeze, crash or memory fault may justify a short targeted diagnostic later.

Continue saved-work/sync correctness, source identity/account safety, interruption recovery, essential functional UX, and actual release-artifact verification. Complete verification of the already-implemented web update reliability fix. Subjective speed feedback is positive product evidence, not a timing benchmark. Preserve unfinished measurement items as paused rather than claiming they passed; the overall plan remains incomplete.

## Do these first

Work one task at a time. This ordering supersedes older execution-order sections in the master plan and remaining-work queue.

| Order | Work | Why first | Phone needed? |
| --- | --- | --- | --- |
| 0 | Resolve host disk pressure and bound future trace size | Profiling cannot finish reliably and risks exhausting the Mac | No |
| 1 | Saved work, sync, source identity and account isolation | Lost work or wrong code text is unacceptable | Yes for final iOS/web acceptance |
| 2 | Fix the known multi-tab web update/cache defect | An update can break a still-open workspace | No |
| Paused | Further iOS/web speed tuning and performance measurements | Owner prioritizes reliability and release checks now | Not scheduled |
| 4 | One sustained-use and interruption check | Catch crashes, memory problems and failed recovery | Yes |
| 5 | Essential functional UX gaps (accessibility deferred) | Users must understand state and complete primary tasks | Partly |
| 6 | Verify the actual TestFlight and hosted release candidate | Local success does not prove the shipped experience | Yes |

If a prerequisite is unavailable, advance the next independent item without claiming the blocked item passed. Fix a newly reproduced data-loss, source-correctness or crash issue ahead of routine timing work.

## Performance, correctness and reliability

### 0. Resolve disk pressure before further builds or profiling — cleanup complete; capture discipline required

- Current checkpoint:54GiB free after authorized cleanup; [removed/retained artifacts and capture limits](PERF_STORAGE_CHECKPOINT_2026-09-28.md). No new recording started.
- Audit storage and identify exact removable generated artifacts, their ownership and whether any active process needs them. Preserve source, owner data, valid evidence and installed-build provenance.
- Perform cleanup only within the authorized scope and repository safeguards; this plan update itself does not authorize deletion.
- Before another trace, establish a recording-duration/size limit and enough free space for temporary save expansion. The failed41.32 attempt briefly consumed more than7GiB and exhausted available space; do not repeat that setup unchanged.
- Acceptance: verified usable free space, documented retained/removed artifacts and a bounded capture approach. No new capture solely to repeat an already-passed functional check.


### 1. Saved work, source identity and account safety — release blocker

Execution protocol: [cross-device sync acceptance](RELEASE_CROSS_DEVICE_SYNC_ACCEPTANCE_2026-09-28.md). Owner authorized synthetic records in the separate Pro test account on both devices. Project delivery and two-way Note persistence after web reload/native reopen pass on the observed artifacts. Production v607 now passes exact-byte and signed-in Unassigned navigation checks. The native-created test passage was assigned on web and retained exactly once after reload; iPhone receipt of that membership now passes on installed41.34:102.3 remains assigned once, with the correct edition and body. Native previously remained at “Saving…” with ineffective remote taps, then recovered after reopen with all text intact; cause remains unconfirmed. See the protocol for exact version boundaries and follow-ups.

- September29: confirmed native chapter-top save could select a stale remembered section. Correction, actual-corpus host regression, signed Release build41.34, installation and bounded physical acceptance pass. Chapter-top save resolves101.1; ordinary-section save resolves101.2; both reopen correctly. Note edit/revert returns to Synced with the original paragraphs retained. See the linked protocol for exact cases.
- Verify Saved, including Unassigned, project assignment, Notes and available Report workflows survive relaunch and agree between iOS and web.
- Use a separately authorized synthetic account for writes, account switching, populated scenarios and failed-save recovery. Do not stress or delete owner data.
- Preserve exact edition, section identity, citation and permissions when reopening a saved result, following a reference or enabling a disabled source.
- Acceptance: persisted readback and rendered results after relaunch; no silent lost edits, wrong-edition passage, account leakage or false successful-save state.
- Existing evidence: local synthetic workspace save/recovery/assignment/Notebook reload checks and isolated PostgreSQL integration pass. This does not establish populated native or authenticated hosted acceptance. Those remain open.

### 2. Web update and hosted integration — release blocker for broken existing sessions

- Correct the identified forced-worker-activation/cache-deletion risk for existing tabs. Test two controlled tabs, delayed lazy assets, interrupted update, recovery and natural cleanup without forced reload or loss of unsaved work.
- Inspect uncontrolled-document and first-install behavior explicitly; do not claim all multi-tab cases from a one-tab test or arbitrary retained-cache count.
- Verify the exact hosted release assets and one authorized signed-in workspace journey, including private response behavior.
- Existing evidence: local interrupted shell update/recovery and exact-byte hosted v605/shell1248 asset verification pass. Multi-tab fix now passes actual-function regressions and local two-tab lazy-asset/lifecycle acceptance; [evidence](PERF_MULTITAB_ROLLOUT_2026-09-28.md). Hosted v606 identity now passes; see `PERF_PREVIEW_WAITING_UPDATE_2026-09-28.json`. Subsequent web614 staging sign-in, Project/Note/Saved reload and fresh no-store/MISS private responses pass; see RELEASE_STAGING_PRIVATE_READBACK_2026-09-29.json. Populated latency is owner-paused; Production acceptance remains open.

### 3. Core speed tuning and measurement — paused by owner

- The41.32 trace failed to save and is unavailable for analysis. Preserve existing41.30 evidence. Do not repeat profiling just to fill this measurement gap while speed work is paused.
- Verify launch to usable Reader, current/recent/unopened chapter, varied Search and result-detail opening. Distinguish tap-to-visible behavior from callbacks and profiled samples.
- Acceptance: correct content and position, responsive input, no reproducible severe freeze or stuck loading. Record actual timings and sample limits. A short gesture trace cannot prove entire-chapter or sustained-use smoothness.
- Existing evidence: startup Saved hydration stall fixed; prior varied Search/detail and named table/figure/definition checks exist.41.32 installed and launch-verified; owner confirmed chapter gestures; trace save failed with exit17 under severe host disk pressure; no usable timing trace was retained. Do not repeat before resolving recorder/storage constraints.
- Do not block release solely to improve a modest host microbenchmark or obtain unsupported p95 claims. Any proposed numeric release budget must be stated explicitly and tested before claiming it passed.

### 4. Sustained use and interruption — release blocker for crashes, lost state or stuck recovery

- One defined mixed-use physical session: chapters, varied Search, details, Saved and navigation, followed by background/foreground and a brief connectivity interruption.
- Verify recovery and rendered state without Instruments. Investigate concrete crashes, persistent loading or lost position. Memory profiling remains paused unless a specific observed fault justifies targeted diagnosis.
- Acceptance: no crash, persistent loading, data loss or inaccessible prepared content; failures give accurate recovery guidance. Bound offline claims to supported surfaces; do not add offline Report as acceptance work.
- September29 physical41.34: bounded online Note/Reader background and foreground checks pass. Owner confirmed prepared Note opening offline; after reconnect, the original paragraphs and Synced status were visible and the offline banner cleared. Subsequent41.35 acceptance closes bounded offline editing/reopen/reconnect: the owner confirmed offline retention and Mirroring showed the marker retained with Synced after reconnect. Process termination during an unacknowledged write and sustained-duration coverage remain open. See the cross-device protocol for evidence boundaries.
- Remaining: representative physical sustained-use and remaining recovery coverage. Do not substitute repeated concrete searches.

## UX/UI — release-critical only

### 5. Essential functional UX — accessibility checks deferred by owner

- Resolve incorrect saving/loading states, hidden or missing saved work, wrong context/edition, inaccessible primary controls and broken navigation.
- All remaining accessibility checks are owner-deferred, including native VoiceOver, Dynamic Type and broader web keyboard/assistive-technology acceptance. Preserve completed fixes; do not schedule further accessibility testing or phone-setting changes.
- Reuse existing successful checks unless related code changed. Cosmetic preferences, secondary panel polish and exhaustive variants are separate backlog items.
- Existing evidence: substantial local UX01–11 work and selected physical functional checks. Broader accessibility is deferred; final distribution acceptance remains open.

## Final integration gate

### 6. Actual release candidate — final gate

- Identify reviewed source SHA, deployment, native version/build and intended release surface.
- Verify the intended TestFlight build and hosted web candidate; development installation and local tests are distinct evidence.
- Recheck the release-critical journey on those actual artifacts, retain rollback/recovery information and record known limitations.
- Merge, Production promotion and App Store submission require their own authorization. This checklist does not authorize them.
- This is scoped to the performance/UX plan; billing, legal, privacy, support and other release-readiness work require their own applicable checklist and are not certified here.

## Lower priority — after the release-critical checks

These remain tracked in the full plan. Only downloadable editions already have an explicit release deferral; no other item is silently closed.

1. Full downloadable editions: already explicitly owner-deferred; keep every bundled edition and current source controls.
2. Further matching/cache micro-optimizations without a reproducible user-visible problem.
3. Exhaustive percentile studies, extreme account-size stress beyond representative release use and wider device/browser matrices. Representative correctness, speed and account safety remain first-release work.
4. Cosmetic redesign, secondary layout refinements and nonessential interaction polish.
5. Hidden collaboration/coordination: preserve existing compatibility boundaries; do not restore these to close an audit item.

## Stop rules for repeated testing

- Each run must answer a named unresolved question or verify changed behavior.
- Reuse passed functional evidence when the affected code is unchanged.
- A profiler failure is not an app failure. Preserve the artifact and report the exact limitation; do not silently restart unchanged captures.
- Keep installation, local correctness, physical acceptance, hosted acceptance and distribution acceptance distinct.

September29 image recovery: actual editor/file-picker upload under complete application transport loss now passes local staging, decoded image retention across pane close/reopen, permanent image reference after recovery and subsequent online reload. See [image evidence](../ux/UX_11_IMAGE_UPLOAD_RECOVERY_2026-09-29.md). This is bounded local evidence, not native/hosted or every image-outage variant.

### September30 recovery acceptance update

The bounded unacknowledged offline Note edit → force-close → reopen offline → reconnect case passes. Owner confirmed retention; fresh Production web readback independently shows `RESTART-Sep30: unsent recovery check` with all earlier content intact. See RELEASE_CROSS_DEVICE_SYNC_ACCEPTANCE_2026-09-28.md. Mixed-use and distribution-device acceptance remain open; accessibility/speed work remain deferred and App Store submission prohibited.

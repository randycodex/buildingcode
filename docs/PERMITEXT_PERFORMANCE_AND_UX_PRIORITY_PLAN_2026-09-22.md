# Permitext performance and UX/UI priority plan

> **Owner scope update — September29:** All remaining accessibility tasks are deferred for now, including VoiceOver, Dynamic Type and broader assistive-technology checks on web/iOS. They are unverified backlog, not current release prerequisites. Preserve completed fixes and evidence. This update supersedes older accessibility requirements below until the owner resumes them.

Date: 2026-09-22

Current first-release priority order: [release checklist](performance/PERF_FIRST_RELEASE_CHECKLIST_2026-09-28.md). This order supersedes historical task sequencing, preserves the full backlog, and does not authorize release. Owner has resumed implementation.

Current sequential work and consolidated open gates: [remaining execution](performance/PERF_REMAINING_EXECUTION_2026-09-25.md).

Status: Incomplete. Last reconciled September30,2026. Speed tuning is owner-paused on iOS and web. Continue reliability and release acceptance. The current checkpoint below supersedes older narrative checkpoints and their next-action/build claims.

Basis: Source inspection, production web inspection, physical-iPhone walkthrough, public API samples, and an isolated reproduction of the Saved annotation defect.

## Current scope — speed tuning paused on iOS and web

Owner reports the iOS app feels fast and explicitly asked to pause web speed work too. Further speed tuning, benchmark expansion and routine Instruments captures are paused on both platforms. Resume them only for a specific reproduced delay or owner request. No Instruments use is planned for the next reliability/UX work; a concrete freeze, crash or memory fault may justify a short targeted diagnostic later.

Continue saved-work/sync correctness, source identity/account safety, interruption recovery, essential functional UX, and actual release-artifact verification. Complete verification of the already-implemented web update reliability fix. Subjective speed feedback is positive product evidence, not a timing benchmark. Preserve unfinished measurement items as paused rather than claiming they passed; the overall plan remains incomplete.

## Current execution status — September29

Work one bounded task at a time. No simulator or routine Instruments. Do not repeat already-passed Search, table, figure, text-recovery or public-asset identity cases unless related runtime code changes. Physical-device, local host/browser, preview, Production and distribution evidence remain distinct.

| Layer | Verified state | Still required |
| --- | --- | --- |
| Main | PR67 merged at `0c729b7d1`; obsolete performance branch deleted | PR69 remains draft/open; later candidate not merged |
| Candidate | `codex/reader-save-target`, [PR69](https://github.com/randycodex/buildingcode/pull/69): native bookmark-target correction, web Notebook accessible name, Saved selection semantics and Project placeholder contrast, Report title and Reader reference keyboard focus plus dependency security patches (web614/shell1257/Notebook19) | Native interruption and distribution acceptance |
| Installed iPhone | 41.35 installed; remembered Reader source label survives restart before lazy loading. Prior41.34 assignment, bookmarks, Note, background/offline-read and process-restart evidence retained | Mixed-use/interruption; accessibility deferred |
| Prepared iPhone | Signed41.34, actual-corpus bookmark regression passes; executable/current Reader source hashes verified | Physical chapter-top101.1 and ordinary101.2 targeting pass; retain artifact provenance |
| Production web | v607 exact public assets; native-created102.3 delivered, assigned to test Project and retained once after reload | iPhone assignment receipt passes on41.34; current candidate is not Production |
| Candidate sandbox | 04e8f59b9: web614/shell1257/Notebook19 deployed to the isolated `permitext-apple-sandbox.vercel.app`; exact seven-file hashes and headers pass, including patched Notebook bundle; browser fallback disabled | Normal staging sign-in and bounded Project/Note/Saved reload journey now pass at staging.permitext.com with the authorized Pro test account; [current checkpoint](performance/RELEASE_STAGING_AUTH_SETUP_2026-09-29.md). Fresh server Project/Saved/Note readback and four no-store/MISS private responses also pass; TestFlight remains separate |
| Local reliability | Full smoke; multi-tab update; complete transport-loss draft recovery; prepared offline Notebook/Saved; actual image upload recovery; [pending Note A→B→A isolation/recovery](ux/UX_11_ACCOUNT_DRAFT_RECOVERY_2026-09-29.md) | Native interruption/account boundaries and any remaining explicitly scoped recovery cases |

Evidence: [cross-device protocol](performance/RELEASE_CROSS_DEVICE_SYNC_ACCEPTANCE_2026-09-28.md), [41.34 provenance](performance/RELEASE_41_34_BUILD.json), [integration](performance/RELEASE_CANDIDATE_INTEGRATION_2026-09-29.md), [preview identity](performance/PERF_PREVIEW_614_IDENTITY_2026-09-29.json), [prepared offline](ux/UX_11_PREPARED_OFFLINE_NOTEBOOK_2026-09-29.md), [image recovery](ux/UX_11_IMAGE_UPLOAD_RECOVERY_2026-09-29.md).

Latest dependency gate: Tiptap/Undici patches, rebuilt Notebook19, full local smoke and rendered editor round-trip pass; [evidence](performance/RELEASE_DEPENDENCY_PATCHES_2026-09-29.md). Hosted614 exact seven-file identity and headers now pass; bounded authenticated candidate persistence/private-response acceptance now passes; see [redacted server evidence](performance/RELEASE_STAGING_PRIVATE_READBACK_2026-09-29.json).

September30 phone-independent review: clean runtime, unchanged native source since41.35, PR69 mergeable with successful Vercel checks. Independent Note readback is blocked by a reproduced Production sign-out/account-mismatch bug. Local615 recovery fix passes focused contracts and full smoke; hosted verification and rollout remain open. App Store Connect confirms latest uploaded build92 predates the current native candidate; fresh distribution provenance is required. The temporary41.35 executable is absent; preserve historical evidence and verify a fresh distribution artifact separately. [Review](performance/RELEASE_PHONE_INDEPENDENT_REVIEW_2026-09-30.md).

### Next actions in priority order

1. **Native correctness:** 41.35 is installed; prior41.34 test-account assignment receipt and chapter-top101.1 save now pass. Ordinary101.2 targeting, existing Project membership, exact Note paragraphs and physical edit/revert status also pass. Preserve existing test records; next is the mixed-use interruption check.
2. **Native interruption:** bounded online Note/Reader background returns pass. Owner-confirmed offline Note opening and agent-observed reconnect/content retention now pass. Physical offline Note edit/reopen/reconnect now passes: owner confirmed offline retention and agent observed the preserved third block become Synced after reconnect. Process termination during an unacknowledged write and sustained interruption remain unverified. Complete remaining interruption scope without Instruments; stop for concrete loss, crash or stuck state. Do not substitute another unchanged Search timing run.
3. **Accessibility — deferred by owner:** all remaining accessibility checks are outside current work and release prerequisites. Original phone settings remain unchanged. Reader reference keyboard continuity now verified after correction; Project placeholder contrast measured in both themes. Report Light appearance/title navigation now checked; Escape focus loss fixed. Saved/Notebook/Search plus initial Reader and New Project now have bounded actual Light appearance evidence; Project placeholder contrast corrected and Dark restored ([evidence](ux/UX_06_KEYBOARD_FOCUS_2026-09-28.md)). Existing Notebook textbox-name correction is locally rendered-verified.
4. **Candidate/release:** authenticated web candidate journey now passes in its bounded scope. Remaining: intended TestFlight build, source/build/deployment linkage and owner-approved merge/distribution. Current Production test-account verification does not certify a different preview.
5. **Backlog retained:** performance measurements/tuning remain paused; downloadable editions remain owner-deferred; firm collaboration remains hidden/excluded. Cosmetic and exhaustive variants are not substitutes for missing release gates.

Phone-independent work must target a named open requirement above; do not rerun successful local recovery cases merely because the phone is unavailable. The [first-release checklist](performance/PERF_FIRST_RELEASE_CHECKLIST_2026-09-28.md) defines the acceptance scope. The full numbered plan below remains intact.

## Historical implementation checkpoints — September28

The following records preserve what was known at each checkpoint. Their “current”, “next”, installed-build, branch and deployment statements are historical; use the September29 checkpoint above for execution.

### Multi-tab update correction — September28

v606/shell1249 now waits for controlled older tabs to close before activation. Actual-function tests, full smoke and a real two-tab delayed Notebook-asset import during simulated GET transport loss pass; old cache cleanup follows natural activation. [Evidence and boundaries](performance/PERF_MULTITAB_ROLLOUT_2026-09-28.md). Hosted v606 identity, private populated acceptance and native41.32 timing remain open. Cleanup left54GiB free; no new Instruments recording was started.

### Historical verification checkpoint — September28

The shell coherence fix `62f117759` now has exact-byte hosted preview acceptance for workspace HTML, app, offline-storage and service worker, with correct cache headers and unchanged corpus revisions. [Evidence](performance/PERF_PREVIEW_SHELL_COHERENCE_2026-09-28.json). Local interrupted-update/recovery passes separately; broad multi-tab/private offline acceptance remains open. Owner confirmed linked definitions open on installed41.30. Candidate41.32 is locally built and signed but not installed or physically accepted.

### Large-image acceptance update — September 28

A single 4032×3024 synthetic Notebook image now passes real HTTP upload/readback and desktop render/reopen after reload. [Evidence and limits](ux/UX_11_LARGE_IMAGE_2026-09-28.md). The initial reload-selection finding is now fixed and rendered-verified; see [selection follow-up](ux/UX_11_NOTEBOOK_RELOAD_SELECTION_2026-09-28.md). No native memory/frame-rate or multi-image stress claim.

### Latest completed work

1. Native startup is readiness-driven; chapter opening uses validated native preparation with bounded current/recent warming. Explicit chapter-top opening and independent Reader continuity were corrected.
2. Search uses lightweight matching, persistent completed-result caching, scope-aware reuse and lazy rows. Detail opening avoids unrelated Saved work and prepares targeted rich content. Historical parent context, open-sheet replacement, retained queries and interrupted reference loading were corrected. Existing callback pilots are not displayed-frame timings or robust percentile claims.
3. Notebook image display uses bounded downsampling. Database-bound sync checkpoints, shared-load cancellation and bounded caches are implemented. A physical mixed-use memory pilot exists; it does not establish frame/stall or memory-pressure acceptance.
4. Web chapter response size, in-chapter search, independent workspace hydration, typing persistence/cancellation, revision-safe content caching and first-use chapter assembly were improved. Bounded populated desktop workflows and integration preflight passed; the later matched account-size comparison exposes an unresolved scaling cost.
5. September28 integration review found the metadata resolver excluded from server and browser revision guards. Fixes `e86629387` and `4e0e9da3b` add revision protection and refresh shell/module versions. Full public-cache and web-shell-cache suites pass, including first-request resolver identity, ETags/304s and invalid revision rejection. No web UX/UI redesign was performed.
6. Owner directly confirmed **2022 Building Figure3301.9.1.4(1)** renders and **Table601** renders with rightmost columns reachable. These specific checks are closed. Earlier owner confirmation of horizontal access in722.2.4 remains accepted. See the [physical acceptance record](performance/PERF_18_PHYSICAL_ACCEPTANCE_CHECKLIST.md).

The confirmed chapter trace led to a bounded12-chapter definition-selection cache, with exact source/chapter identity and unchanged per-section matcher rules.4,060 real-registry host cases pass; Release41.31 compilation and strict signature verification pass, and installed41.30 is unchanged. [Implementation and acceptance limits](performance/PERF_18_DEFINITION_SELECTION_REUSE_2026-09-28.md).

Conservative definition-decoration reuse now passes12,453 exact-output cases and Release41.32 build/signature verification. The host benefit is modest; main regex matching remains.41.32 is a local candidate only, installed41.30 is unchanged. [Evidence](performance/PERF_18_DEFINITION_DECORATION_2026-09-28.md). Local interrupted-shell-update/recovery now passes with v605/shell1248, including failed-file retention and successful retry. [Evidence and limits](performance/PERF_SHELL_ROLLOUT_2026-09-28.md). Next: immutable hosted-preview verification; full private/offline and multi-tab lazy-asset behavior remain open.

### Historical provenance and blockers — September28

- Work is pushed through `ac78d8287` on `codex/permitext-performance` in draft [PR67](https://github.com/randycodex/buildingcode/pull/67), before this documentation update. Main merge, Production promotion, TestFlight and App Store release are not established.
- Local candidate **1.0(41.30)** compiles and passes strict signature verification, combining the chapter metadata correction with Research Drafts grouping. It supersedes the local41.29 artifact and is **installed and launch-verified**; see `performance/PERF_18_RELEASE_41_30_BUILD.json`.
- Last verified installed development-signed Release is **1.0(41.30)**, with exact source/artifact provenance in `performance/PERF_18_RELEASE_41_30_BUILD.json`, coverage disabled and local performance recorder enabled. Its99.631-second chapter recording now has confirmed Chapter16/33 gestures:112 hitches (max158.360ms),28 potential delays (max98.920ms), no interval over250ms. Owner also confirmed linked definitions open correctly. This bounded capture does not establish a controlled speedup or full chapter smoothness. See `performance/PERF_18_RELEASE_41_30_CHAPTER_FRAMES.json`. Phone now reports **iOS27.0.1**; earlier27.0samples are not a controlled same-OS comparison.
- Immutable Vercel preview for `8170f9ae3` passed six public HTTP cache representations on September28: exact-byte ETags, empty304, matching immutable pins and uncached409 for wrong pins. Cookie-aware authenticated access resolved the previous redirect blocker. See `performance/PERF_PREVIEW_ACCEPTANCE_2026-09-28.md`. Asset identity and private/error exclusions subsequently passed; successful authenticated private responses, CDN hit rate and Production remain separate checks.
- USB profiling succeeded. Two41.27 startup profiles support the Saved-stall correction. Chapter frame captures on41.27/41.28 identify repeated per-update parsing and remaining metadata work. The41.28 trace has an unresolved CPU-sampling gap; do not declare broad smoothness or a seven-second app freeze. All recordings have finished; phone-independent analysis continues. See the physical checklist and paired JSON records.
- Separate populated native test-account access remains pending. The owner approved deferring production edition downloads on September28. Owner data must stay intact; no bundled content removal has been approved.

### Historical first-release order — superseded by current checklist

0. Resolve disk pressure and bound recorder size before another build/capture.
1. Verify saved-work persistence, iOS/web sync, edition/citation identity and account safety.
2. Fix and verify the known multi-tab web update/cache defect.
3. Finish representative iPhone launch, chapter, Search and result-detail acceptance.
4. Run one sustained-use/interruption check.
5. Close task-blocking UX and basic accessibility gaps; postpone cosmetic work.
6. Verify the actual TestFlight and hosted release candidate before release approval.

See the [detailed checklist](performance/PERF_FIRST_RELEASE_CHECKLIST_2026-09-28.md) for actions, acceptance criteria, prerequisites and lower-priority work.41.32 is installed; its latest trace failed to save under disk pressure and cannot be analyzed. Older installed-build/next-action statements below are historical. Owner subsequently resumed implementation and authorized removal of unnecessary artifacts.

### Earlier remaining-work breakdown (use the first-release order above)

1. **Fix measured startup Saved hydration, then finish performance acceptance:** September28 Time Profiler captured three815–873ms main-thread hangs in refreshBookmarks → authored HTML excerpt extraction, once on content opening and twice during startup sync. Fix5ba332139 is installed as41.27; two matching10-second profiles show zero >250ms hangs, with Saved row construction on a background thread. Owner reports the existing Saved item present. This closes the measured stall correction, not broader startup/account acceptance. See `performance/PERF_18_RELEASE_41_26_STARTUP_HANGS.json`. Remaining measurement work: controlled startup/readiness, current/recent/not-recent chapter comparison, displayed-frame/main-thread stalls, memory-pressure recovery and remaining offline/interruption/navigation cases. Keep successful functional checks closed; do not replace missing measurements with repeated callback pilots.
2. **Populated Saved/sync and account isolation:** use an authorized separate fixture account for legitimate updates, relaunch, account switching and size comparisons. Existing host tests and the owner’s single Saved item cannot prove this physical matrix.
3. **Hosted web acceptance:** public revision/conditional/immutable contracts and a bounded chapter window now pass on the immutable preview; asset identity, uncached error/rejection responses, guest Reader loading and the new +Reader insertion path now pass on preview. Successful authenticated private responses, cross-version browser cache rollout and Production remain open. Production verification remains a separate gate.
4. **Integration/release:** retain content, account, offline and independent Reader invariants; finish applicable acceptance before merging/publishing. Development installation is not distribution acceptance.
5. **PERF17 deferred by owner:** retain all bundled editions and the installer prototype. Finish active-source controls and current performance acceptance for this release. Transport, catalog/app integration, compatibility, cache/reference handling, migration and physical download acceptance belong to a later release; this is deferral, not feature completion.
6. **UX/UI:** owner resumed phone-independent work on September28. Existing UX01–03 fixes are on main; broader UX acceptance is incomplete. See the status summary before the detailed UX list below.

| Task | Implemented or established | Remaining acceptance or work |
| --- | --- | --- |
| PERF-01 | Measurement hooks, startup test repair, baseline captures | Complete physical scenario matrix and defensible sample counts/percentiles |
| PERF-02 | Readiness-driven launch; fixed hold removed | Broader signed-out/offline/interruption device matrix |
| PERF-03 | Fast native chapter preparation and bounded current/recent warming | Controlled cold/warm and displayed-frame measurements; broader navigation/content matrix. Named figure/Table601 checks pass |
| PERF-04 | Lightweight matching and persistent completed-result cache; phone cache hits verified | Broad cold-process/offline/resource acceptance |
| PERF-05 | Lazy individual result rows and bounded preview work | Full traversal, accessibility variants and measured device scrolling |
| PERF-06 | Lightweight Saved controls and targeted rich passage extraction | Valid end-to-end physical detail-opening trace and broader acceptance |
| PERF-07 | Bounded caches, shared loads, cancellation and memory purge contracts | Aggregate device memory, OS pressure and post-purge latency |
| PERF-08 | Database-bound sync checkpoints; physical correctness tests | Production contention and Release timing |
| PERF-09 | Compact web body windows; content parity and local rendered checks | Production/CDN and signed-in acceptance |
| PERF-10 | Lightweight in-chapter search; complete index and local checks | Production and remaining offline interaction acceptance |
| PERF-11 | Independent web pane mounting/hydration; +Reader catalog wait removed and exact preview verified | Production/device rollout and cross-version cache verification |
| PERF-12 | Coalesced typing persistence and obsolete-request cancellation; locally complete | Physical timing and rollout verification |
| PERF-13 | Revision-safe public content caching; locally complete | Production/CDN and physical timing |
| PERF-14 | Measured first-use body assembly bottleneck fixed locally | Production and physical timing |
| PERF-15 | Desktop traces support a documented no-change decision | Revisit only if device/lower-powered traces justify more work |
| PERF-16 | Populated workflow checks pass; matched visible workload exposes account-size cost. Report query scoping is implemented, without demonstrated overall browser speedup | Browser/request attribution and account-scale remediation; physical, production and extended stress boundaries |
| PERF-17 | Downloadable-edition inventory and integrity-checked prototype | Owner-approved deferred to a later release; keep all content bundled and retain prototype |
| PERF-18 | Native source controls/guards; web scope, account isolation and full offline acceptance | Physical controls, source-scope timing, then integration/release verification |

Use the detailed task sections and linked evidence for exact limits. “Implemented” does not mean physical acceptance, Production, TestFlight or App Store availability. The status above is authoritative over historical checkpoint wording below.

## Earlier implementation direction — chapter-first checkpoint

The following records the earlier chapter-first decision and its evidence at that time; its task sequence is historical.


1. **Keep startup readiness-driven (PERF-02).** The owner permits a few seconds of useful preparation, but there is no required five-second delay. Show usable content as soon as it is ready; do not wait for the entire corpus.
2. **Chapter implementation completed; broader acceptance remains open: PERF-03 plus the minimum warmup coordination from PERF-07.** Return validated native chapters immediately, without waiting for unused HTML, anchors, or section details. Prioritize the last-opened chapter, then recent chapters from the selected edition. Resolve history through catalog identities rather than decoding rich passages.
3. **Bound background preparation.** Use the existing four-document / 48 MiB cache limits, with current/recent candidates occupying the shortlist before default chapters. Visible cards must not launch an unrestricted sweep. Preparation runs after content is usable; explicit chapter opening and search cancel speculative consumers. Preserve shared-load cancellation semantics and corpus validation. Four candidates are a count ceiling, not a guarantee they all fit the byte budget.
4. **Do not promise every chapter is instantly readable.** Uncached chapters still require preparation. Current measurements also include about 1.5 seconds of viewport restoration; preserve accurate passage positioning while investigating that delay separately. Do not remove settling checks merely to expose an earlier frame.
5. **PERF-04 remains the next task, not folded into this change.** A development Release build 41.3 trace measured `concrete` all-edition search at 29,314.3 ms, with 28,495.3 ms in the first edition search interval. This establishes a serious delay, but does not isolate decoding versus matching CPU cost. Preserve complete all-edition results and exact matching when fixing it.
6. **Acceptance and provenance.** PERF-01 and PERF-02 still have the coverage gaps recorded in their measurement documents. The redundant iOS Search chips were removed separately in `a937e0ef2`. Changes on the performance branch are not evidence of a production or TestFlight release. Finish device validation and record remaining gaps before marking PERF-03 complete.
7. **Sequence remains one task at a time.** Finish chapter preparation and bounded warming, then rich-text-independent search (PERF-04), then the remaining PERF-05/06/07 work in the original delivery sequence. Broader cache eviction, memory-pressure, and scheduling work in PERF-07 remains open.

## 1. Objective and scope

Make Permitext launch, open chapters, search, open results, and restore a working workspace as quickly as practical while preserving complete and trustworthy behavior.

The two implementation lists are separate:

1. **Performance:** reduce actual waiting, unnecessary preparation, main-thread work, repeated transport, and memory pressure.
2. **UX/UI:** repair inconsistent outcomes and improve clarity, navigation, feedback, accessibility, and discoverability.

The Saved discrepancy belongs at the top of UX/UI because it is a correctness and trust problem, even though its repair involves data-handling code. It must not be treated as cosmetic polish.

### 1.1 Priority definitions

| Priority | Meaning | Scheduling rule |
| --- | --- | --- |
| P0 | Correctness issue or prerequisite for trustworthy verification | Address first; do not claim completion while it remains open. |
| P1 | Primary reading/search/workspace experience | Implement in the first optimization batches, using the dependencies below. |
| P2 | Secondary friction or an optimization whose value requires additional profiling | Implement after the primary paths, or sooner if new measurements demonstrate greater impact. |

Numbers indicate the recommended order within each list. Dependencies and the combined delivery sequence in section 4 determine how the lists fit together. A P2 task should not displace an unfinished P1 task without new evidence.

### 1.2 Evidence labels

1. **Observed:** reproduced on the rendered app or measured through a request.
2. **Source-confirmed:** the work or behavior exists in the audited source; its user-visible cost may still need measurement.
3. **Proposal:** a recommended design or implementation direction that needs validation.
4. **Coverage gap:** an area that was not fully exercised and must not be represented as verified.

### 1.3 Audited baseline and limits

1. Local main and the production revision checked during the audit were `4da2e1fa1`.
2. Native observations came from the installed iPhone app, version `1.0 (41)`, a development build. This does not establish the exact source revision of that binary or Release/TestFlight/App Store performance.
3. iOS launch, chapter, and search paths were inspected, but no Release-build Instruments baseline was captured. No percentage improvement or native millisecond saving is established yet.
4. The signed-in account exposed Reader, Search, Saved, and Research history. No active or archived Projects were available for a populated Project/Notebook/Report walkthrough.
5. Public API timings below are individual samples, not p50/p95 measurements, screen-render times, or proven infrastructure cold/warm timings.
6. The broad audit was read-only. This document authorizes no deployment, account-content migration, paid Research evaluation, or release submission by itself.

| Public request | First sample | Repeat sample | Interpretation |
| --- | ---: | ---: | --- |
| Search `egress` | 2.01 s | 65 ms | Significant variability; trace matching, initialization, and transport before assigning a cause. |
| Search `1005.3.1` | 1.41 s | 215 ms | Direct-reference search also needs first-use investigation. |
| Chapter 33 summary | 571 ms | 115 ms | Summary response was approximately 355 KB decoded. |
| Chapter 33, five-body window | 613 ms | 1.01 s | Response was approximately 360 KB decoded despite including only five section bodies. |
| Full Chapter 33 body | Exceeded a 20 s client timeout once | Not repeated | Reliability/performance signal requiring reproduction, not a demonstrated universal failure. |

### 1.4 Non-negotiable preservation requirements

1. Preserve all installed/searchable editions and complete matching results. Faster first results must not silently become fewer results.
2. Preserve exact official text, tables, figures, source identity, edition identity, and applicable source-validation checks.
3. Preserve offline reading and search where currently supported; distinguish an unavailable corpus from a genuine zero-result search.
4. Preserve text selection, annotations, citations, links, chapter continuity, and remembered reading position.
5. Preserve account isolation, pending mutations, local drafts, deletion records, conflict recovery, and historical-edition identity.
6. Preserve the two permanent native Reader destinations and the independent-column desktop workspace.
7. Preserve floating native bottom controls and transparent surrounding space. Do not introduce an opaque full-width bottom strip as part of optimization.
8. Preserve current entitlement rules. Performance work must not change pricing, allowances, or access boundaries.
9. Preserve Research evidence and authority boundaries. This plan does not change its reasoning model, retrieval scope, paid-call policy, or generated-answer behavior.
10. Preserve existing useful optimizations: web search pagination, progressive chapter bodies, native prepared-document validation, and reusable workspace panes.

## 2. Performance — numbered implementation priorities

### 1. PERF-01 — Establish trustworthy measurements and repair the startup test gate

**Priority:** P0 prerequisite.

**Surfaces:** iOS, web, and relevant backend requests.

**Evidence:** Source-confirmed instrumentation gap and observed test-harness failure.

**Problem:** Native `firstUsableContent` ends when data becomes ready, before accounting for the launch splash and actual usable presentation. Existing native preparation timings do not measure the whole tap-to-readable interaction. The web startup contract failed with `ReferenceError: setupAccountProfile is not defined` in its test context; this was not an observed production crash.

**Work to do:**

1. Repair the startup test fixture so it includes the current startup dependencies and actually exercises the intended path. Do not remove the assertion or stub away the behavior being tested merely to make it pass.
2. Record separate native milestones for process launch, initial data ready, first usable presentation, chapter tap, selected passage visible, search input, first results, complete results, and result tap-to-readable.
3. Preserve preparation-level signposts for diagnosis, but stop labeling preparation completion as user-visible completion.
4. Capture a Release/Profile baseline on the available physical phone. Record device, OS, binary version, build configuration, corpus revision, account fixture size, network conditions, and thermal state.
5. Capture web browser traces for startup, restored workspace, typing, result opening, reader scrolling, and pane operations. Record long tasks, request waterfalls, transferred/decoded bytes, DOM growth, and interaction delays.
6. Separate first-use, repeat-use, process-relaunch, offline, and cache-purged scenarios. Force-quitting an app does not prove the OS file cache is cold.
7. Use repeatable runs for p50 and p95. A practical starting protocol is at least 30 samples for key short interactions, with outliers retained and explained; use a documented smaller count for expensive manual scenarios and do not call it a robust percentile baseline.
8. Define numerical budgets from that baseline and the supported-device target before accepting optimizations. Publish the budgets and sample counts rather than inventing a speed claim from one good run.

**Dependencies:** None. Can proceed alongside UX-01.

**Done when:** Measurements describe what the user actually waits for; the startup test runs meaningfully; baseline results and remaining device gaps are recorded. The absence of an oldest-supported-device run remains explicit until performed.

**Source pointers:** `CodeLibraryViewModel.swift` — `isInitialContentLoaded` / `firstUsableContent`; `permitext-sync-server/tests/startup-critical-path-contract.mjs`; `EntitlementAndSyncContractTests.swift` — `testEveryBundledChapterPreparesDisplayContentFromColdCache`.

### 2. PERF-02 — Remove the fixed iOS launch hold

**Priority:** P1.

**Surface:** iOS launch.

**Evidence:** Source-confirmed one-second sleep followed by a 0.35-second splash transition.

**Work to do:**

1. Replace the timer prerequisite with actual readiness of the first useful screen.
2. Allow essential library preparation to continue as required; preserve honest loading and error states when preparation is incomplete.
3. Ensure branding transitions do not delay touch interaction after the screen is ready.
4. Check first installation, ordinary signed-in launch, signed-out launch, offline launch, background return, and interrupted initialization.
5. Compare launch-to-usable, immediate chapter opening, and immediate search against PERF-01. Removing the splash must not merely reveal an unresponsive screen or shift the same wait into the first tap.

**Dependencies:** PERF-01 measurement milestones.

**Done when:** No fixed timer prevents use of an already-ready screen; first-frame presentation is clean; immediate Reader and Search actions remain responsive and correct.

**Source pointer:** `NYC CC APP/permitext/PermitextApp.swift` — launch root gating and `.task` around lines 331–360 in the audited revision.

### 3. PERF-03 — Shorten native chapter tap-to-readable work

**Priority:** P1.

**Surface:** iOS Reader chapter navigation.

**Evidence:** Source-confirmed extra work awaited after native preparation succeeds.

**Implementation update:** Native fast return, bounded current/recent warming, requested-category selection, shared-load handoff, warmup resumption and explicit chapter-top restoration are implemented. Development Release **41.6** is installed. Two Chapter 10 card openings prepared in **7.704/12.437 ms** and emitted content appearance at **198.771/166.026 ms**; a separate Search-return check preserved the scrolled viewport. One startup sample reached first usable content in **2,126.653 ms** from model initialization, not OS launch. The targeted correction is validated; broader cold/warm percentile and long-content/table/figure acceptance remains open, so PERF-03 is not marked fully accepted. See `docs/performance/PERF_03_CURRENT_RECENT_CHAPTERS.md`. Persistent search caching remains PERF-04 and is not implemented here. Optional edition downloads are a separate PERF-17 proposal.

**Work to do:**

1. Trace the successful-native, unavailable-native, validation-failure, and cancellation routes separately.
2. When a validated native opening is ready, return it without awaiting unrelated HTML fallback preparation, anchor extraction, and ten section-detail loads.
3. Keep fallback available when actually required. Do not remove validation or suppress a native preparation error by displaying mismatched content.
4. Narrow attributed-text preparation before first display to the selected passage and genuinely necessary visible content. The current nearby range can include many blocks and nested list items.
5. After first useful presentation, prepare the current/recent chapter shortlist within the existing four-document / 48 MiB budget. Fill unused slots with likely chapters; do not sweep every chapter or eagerly prepare unused HTML fallback. Explicit navigation/search supersedes speculative work. This pulls only the necessary priority coordination from PERF-07 forward.
6. Preserve the selected anchor and remembered viewport so a faster first paint does not produce a later jump.
7. Test large chapters, deep links into the middle, tables, figures, long lists, rapid chapter switching, and cancellation during preparation.

**Dependencies:** PERF-01; coordinate with PERF-07.

**Done when:** Native chapter opening no longer awaits unused fallback preparation; tap-to-readable improves beyond normal measurement noise; initial scroll and subsequent fast scrolling do not regress.

**Source pointers:** `CodeLibraryViewModel.swift` — `prepareChapterForOpening`, `warmChapterReaderEntry`; `NativeChapterTextReaderView.swift` — `loadDocument` and attributed-text prewarming.

### 4. PERF-04 — Make native search matching independent of rich passage loading

**Current task (owner authorized):** Implement exact generated search text and persistent completed-result caching. Chapter changes are committed through `c177c8062`; their remaining broad release matrix is still recorded under PERF-03. Search changes are implemented and installed as development Release 41.7; host parity and targeted device rendering pass. Persisted concrete results and actual cache-hit events are verified on the installed phone. Two warm full-query operations took 68.017/67.568 ms; final-input-to-results-ready took 320.349/316.303 ms including debounce. A warmed-corpus uncached uppercase query took 147.277 ms; a post-restart persistent hit took 41.942 ms (prefix queries warmed stores). Broad cold-process/offline/resource acceptance remains open. Targeted implementation work is complete; following the owner’s detail-card emphasis, PERF-06 is the next bounded task before PERF-05. See `docs/performance/PERF_04_SEARCH_TEXT_AND_RESULT_CACHE.md`.

**Priority:** P1.

**Surface:** iOS all-edition and scoped search.

**Evidence:** Source-confirmed candidate verification through `officialText`, which can load and decode rich section files.

**Work to do:**

1. Measure candidate lookup, per-section reads/decodes, exact-match verification, ranking, snippet work, and per-edition publication separately.
2. Build or extend a compact searchable-text representation keyed by corpus revision, edition, section, and canonical target identity.
3. Preserve phrase, punctuation, normalization, section-number, and ranking semantics. Use positional postings or lightweight text verification where necessary; do not approximate exact matches to gain speed.
4. Keep rich tables, figures, and display blocks out of match verification. Load them when opening content; derive visible snippets from the lightweight text representation where possible.
5. Add a direct-reference path for section-number queries if profiling demonstrates that general text matching is doing unnecessary work for them.
6. Preserve progressive publication across editions, complete coverage, stable final ordering, and cancellation. Do not make a narrower default scope the performance fix.
7. Version the generated index with the corpus and provide a safe compatibility/fallback route for stale or missing indexes.
8. Compare old/new results across broad words, exact phrases, direct section numbers, punctuation, historical editions, no-match queries, and offline operation.

9. Add a bounded, persistent cache of completed public-text search results. Key entries by query normalized using the actual engine semantics, scope and installed edition set, corpus revisions, and search-engine/index schema version. Persist canonical result identities and ranking; avoid storing rich passage bodies. Keep account-specific saves/annotations out of this cache and recompute them for the active account.
10. Reuse a valid complete entry immediately on repeat searches, including after relaunch. Never persist a cancelled, partial, or failed all-edition run as a complete result set. Apply count and byte limits with least-recently-used eviction; retain a safe normal-search fallback for corruption or missing targets.
11. Invalidate on corpus or engine changes, not merely elapsed time or any app update. Ship a corpus revision/manifest with text updates, including updates delivered outside the App Store. An unrelated binary update can retain compatible entries. Do not show old-corpus results as current enacted text while rebuilding.
12. Optionally refresh the most-used invalidated queries after current reading/search work is idle, within PERF-07's work budget. Test repeat queries, relaunch/offline reuse, edition changes, changed text, changed ranking, interrupted writes, cancellation, corruption, and eviction. Measure first-time and cached latency separately; caching must not conceal a slow first search.

**Dependencies:** PERF-01. UX-03 should accurately describe incremental results during implementation.

**Done when:** Matching avoids rich-content decoding for ordinary candidates; result identities and intended ranking agree with the reference behavior; first-result and completion time improve without increasing memory beyond the agreed budget.

**Source pointers:** `AuthoredCodeStore.swift` — `search`, `officialText`, `preparedSectionData`; `CodeLibraryViewModel.swift` — `searchAllEditions`.

### 5. PERF-05 — Make expanded native search groups lazy at the result level

**September 23 implementation:** Individual headers/results now sit directly in the lazy stack; preview extraction is capped at two workers with queued cancellation and stale-response guards. Counts, complete arrays and edition-aware identities remain unchanged. Production limiter host stress tests and generic unsigned iOS Release compilation pass without a phone or simulator. Focused physical UI acceptance passed for2022/2014 concrete passage text/references, repeated opening and return position; inspected card rendering passes. Full traversal, accessibility variants and measured scrolling performance remain open. See `docs/performance/PERF_05_LAZY_SEARCH_RESULTS.md`.

**Priority:** P1.

**Surface:** iOS Search results and previews.

**Evidence:** Source-confirmed ordinary result stacks inside lazy outer grouping; 322 results were observed in one expanded edition group.

**Work to do:**

1. Refactor the grouped presentation so individual result rows are lazily materialized; preserve family and edition headings.
2. Start preview work for visible or near-visible rows only, with bounded concurrency.
3. Cancel or disregard obsolete preview tasks when the query, scope, edition expansion, or destination changes.
4. Key row and preview identity by edition plus canonical result identity, not section number alone.
5. Keep result counts and the complete result collection independent of which rows have been rendered.
6. Verify that expanding a large group, scrolling quickly, collapsing it, and returning from Reader preserve stable positions and accessible focus.

**Dependencies:** PERF-01. Can improve rendering before PERF-04 is complete; integrate afterward.

**Done when:** Expanding a large group does not instantiate or hydrate every result; first-screen rows appear promptly; all results remain reachable; scrolling and preview cancellation stay correct.

**Source pointer:** `NYC CC APP/permitext/Views/SearchView.swift` — grouped `LazyVStack` / `ForEach(group.results)` and row preview tasks.

### 6. PERF-06 — Remove unrelated Saved rebuilding from search-result opening

**Current task:** Lightweight Saved controls with guarded complete-evidence export and unused fallback-formatting removal are implemented. Build 41.8 still showed a 3,452.736 ms detail opening dominated by passage data. Targeted rich extraction now avoids sibling parsing and repeated heading-prefix scans; 40 content-parity cases pass, and host extraction for the tested passage fell from 4,118.149 to 9.863 ms. Development Release 41.9 is installed; 2022 detail text/references render correctly. Actual device timing and broader acceptance remain open. Signed development Release41.11 is now installed; six physical unit tests and focused2022/2014 Search UI acceptance pass, and owner verified horizontal table access. The saved USB recording exported on September 23 but contains no detail-opening events, so it supplies no device latency evidence. Owner authorized proceeding with PERF-05 without phone/simulator while keeping PERF-06 physical acceptance open. Production session-transition host checks pass for account switch, sign-out and same-account rollover. See `docs/performance/PERF_06_SEARCH_DETAIL_OPENING.md`.

**Priority:** P1.

**Surface:** iOS Search → Reader.

**Owner emphasis (September 22 evening):** Fast search alone is insufficient: the selected detail card must show its actual information promptly. Treat tap → content visible as a separate acceptance measure, with cold and repeated opens, rich tables/references, correct edition, and preserved Search return state. The current single observed sample is 771.893 ms to content appearance (188.262 ms to destination preparation); this is a baseline to improve, not a completed fast-opening claim.

**Evidence:** Source-confirmed creation of an independent library model followed by `refreshBookmarks`. The current result route already reuses loaded corpus stores and passes `prepareChapter: false`; retain those improvements.

**Work to do:**

1. Profile model creation, account-service setup, Saved hydration, selected-section resolution, and presentation separately.
2. Use a lightweight independent reader session that shares read-only corpus and account services while retaining its own navigation and viewport state.
3. Obtain save/note state needed for the selected result without rebuilding the entire Saved evidence collection on every open.
4. Ensure the secondary reader cannot start duplicate account sync or overwrite the main Reader's selection and continuity.
5. Preserve edition-specific annotations, shared save updates, sign-out behavior, and account-switch invalidation.
6. Compare small-account and large-account fixtures so a constant-looking cost on the current account does not hide scaling problems.

**Dependencies:** PERF-01; UX-01 establishes the correct evidence identity rules.

**Done when:** Opening a result performs only necessary reader work; Saved size does not introduce proportional unrelated work; result edition and independent reading context remain correct.

**Source pointers:** `CodeLibraryViewModel.swift` — `makeSearchReaderLibrary`, `refreshBookmarks`; `SearchView.swift` — `PreparedSearchReaderDestination.prepare`.

### 7. PERF-07 — Coordinate warmups and bound recreatable caches

**September 23 implementation:** Authored rich caches now have per-section LRU/count/cost limits and generation-safe memory purge across current/all-edition stores. Native speculative warmups cannot evict existing documents; foreground requests promote shared work and evict speculative entries before demand LRU entries. Host parity, cache/cancellation/pressure contracts and generic unsigned iOS Release build pass without phone/simulator. Aggregate memory/latency measurements, physical pressure/reopen acceptance remain open. Identical synthesized-HTML requests now also share in-flight work; full-chapter consumers receive their own passages independently of cache admission. Prepared-section/block concurrent decodes now share in-flight results with deterministic purge/failure/oversize tests passing. See `docs/performance/PERF_07_CACHE_AND_WARMUP_BUDGETS.md`.

**Priority:** P1.

**Surface:** iOS memory, background preparation, and repeat-use speed.

**Evidence:** Startup can prioritize five chapter documents while the native cache has a four-document limit. Search stores retain parsed-section dictionaries outside the existing memory-warning purge. Actual memory-pressure impact needs profiling.

**Work to do:**

1. Inventory cache ownership, keys, count/cost limits, in-flight work, and references keeping entries alive.
2. Establish a single priority policy: active user request first, visible/selected content next, likely adjacent content afterward, speculative fallback work last.
3. Coalesce duplicate chapter/index/preview requests. Cancelling one consumer must not invalidate another active consumer's required work.
4. Make startup warmup selection fit the effective cache budget. Avoid warming a likely-return chapter only to evict it with lower-priority chapters.
5. Bound parsed-section and preview caches by estimated cost or an evidence-based limit; retain lightweight index metadata separately where useful.
6. Purge recreatable search-store caches on memory pressure and cancel obsolete background tasks. Preserve durable saved work, pending sync, current content needed for interaction, and reading position.
7. Key caches by edition and corpus revision, with theme/type-size identity where rendering depends on them.
8. Profile repeated broad searches, many chapter visits, background/foreground cycles, memory warnings, and post-purge reopening.

**Dependencies:** PERF-01; coordinate with PERF-03, PERF-04, and PERF-05.

**Done when:** Memory stabilizes during repeated use; cache work respects user priority; purging recovers safely; neither launch nor the next chapter/search becomes slower because warming was indiscriminately removed.

**Source pointers:** `CodeLibraryViewModel.swift` — startup warmups, `allEditionSearchStores`, `handleMemoryWarning`; `AuthoredCodeStore.swift` — prepared-section dictionaries; `NativeReaderDocumentStore.swift` — cache limits.

### 8. PERF-08 — Preserve valid sync checkpoints across ordinary native launches

**Implementation update (September 23):** SQLite-local checkpoints now bind progress to the actual account database and backup snapshot; ordinary launch/account activation resets removed. New/legacy/replaced stores still pull fully. Upload and individual conflict acknowledgements cannot advance the pull cursor. Eight initial and 12 follow-up physical tests passed, covering partial replay, conflict resolution, pending uploads and server rollback recovery. A 500-save fixture avoided 140,785 bytes of mutation JSON and all 500 record applications on unchanged reopen. Production contention and Release timing remain open. See [PERF-08 evidence](performance/PERF_08_DATABASE_CHECKPOINTS.md).

**Priority:** P1.

**Surface:** iOS signed-in startup and synchronization.

**Evidence:** Initialization resets the checkpoint whenever a resolved profile and signed-in account exist. The accompanying rationale concerns a new/migrated profile, but the condition is broader.

**Work to do:**

1. Track whether the isolated profile is newly created, migrated, restored, or already valid.
2. Force a full pull only when profile/checkpoint provenance requires it, or the server explicitly requests recovery.
3. Preserve validated checkpoints on ordinary relaunches and use incremental sync.
4. Keep checkpoints bound to the correct account, local store identity, and compatible sync schema.
5. Test new installation, legacy migration, ordinary relaunch, account switching, revoked sessions, interrupted pulls, expired cursors, pending writes, and server-requested full recovery.
6. Measure payload size, database work, and contention with Reader/Search, rather than treating all background activity as a launch blocker.

**Dependencies:** PERF-01; regression coverage must protect UX-01's Saved parity.

**Done when:** Ordinary launches reuse valid checkpoints; new/migrated profiles still receive complete data; no missing records, resurrected deletions, or account leakage occurs.

**Source pointer:** `CodeLibraryViewModel.swift` — initializer checkpoint reset around lines 514–520 in the audited revision.

### 9. PERF-09 — Stop repeating entire chapter metadata in body-window responses

**Implementation update (September 23):** Opt-in compact windows implemented with edition/revision/range validation, legacy compatibility and cached-full-body reuse. Chapter 33 first-five-body JSON fell from 359,819 to 4,696 bytes; all 1,029 section bodies retain exact parity. Local rendered opening/jump/append/prepend checks passed. Production/CDN and signed-in acceptance remain open. See [PERF-09 evidence](performance/PERF_09_COMPACT_CHAPTER_WINDOWS.md).

**Priority:** P1.

**Surface:** Web Reader and chapter API.

**Evidence:** Observed approximately 355 KB decoded summary plus 360 KB decoded five-body response for Chapter 33. Source shows metadata for all sections returned with each window.

**Work to do:**

1. Define a chapter manifest containing the required navigation/group metadata once.
2. Define body-window responses containing requested section bodies and the minimal identity/range metadata needed to merge them safely.
3. Include corpus revision and edition identity so the client cannot combine windows from different revisions.
4. Consider a selected-section opening response that provides its body and necessary context in one request, if it removes the initial sequential summary/window waterfall without duplicating large metadata.
5. Preserve canonical/alias target resolution, group headings, before/after loading, selection, annotations, and remembered scroll position.
6. Handle rapid chapter changes and partial network failures without appending stale windows into a newer chapter.
7. Maintain compatibility with older clients through an explicit response contract or versioned route; do not silently break existing consumers.
8. Measure compressed transfer, decoded bytes, parse time, request count, first-readable time, and scroll-triggered hydration on large chapters.

**Dependencies:** PERF-01; coordinate the identity contract with PERF-13.

**Done when:** Subsequent windows do not repeat the full manifest; initial passage loading is measurably lighter; all sections remain continuously reachable with stable position and correct content.

**Source pointers:** `permitext-sync-server/app.mjs` — `chapterSectionsWithRequestedBodies`; `public/app.js` — `renderSectionContent`, `fetchChapterBodyWindow`, progressive hydration.

### 10. PERF-10 — Replace full-chapter downloads for web in-reader search

**Priority:** P1.

**Surface:** Web Search in reader.

**Evidence:** Source-confirmed `fetchChapter(..., { includeBody: true })` before matching. One full Chapter 33 request exceeded a 20-second client timeout during the audit.

**Local implementation:** Indexed chapter search, complete offline fallback, abort-on-supersession, revision-bound result opening and Find position restoration are implemented on the performance branch. Chapter 33 `concrete` retains all 54 results while reducing the decoded search response from 2,212,129 to 24,984 bytes (98.87%). Generated coverage: 578 chapters / 32,551 sections. Local contract/HTTP/browser evidence and remaining production/offline acceptance are detailed in [PERF-10 record](performance/PERF_10_LIGHTWEIGHT_CHAPTER_SEARCH.md).

**Implementation checklist:**

1. Add or reuse chapter-scoped lightweight search with the current exact-first and typo-tolerant matching contract.
2. Return result identities, headings, counts/progress, and bounded snippets without fetching all rich bodies.
3. Open a match through the selected-section/window path from PERF-09.
4. Cancel superseded searches; preserve the Reader's original location for closing search or recovering from failure.
5. Preserve supported offline chapter-search behavior using local indexed text or an explicit available-content strategy. Do not silently search only currently rendered sections.
6. Test phrases spanning formatting boundaries, tables, nested lists, section headings, no results, network failure, and a large chapter.

**Dependencies:** PERF-01; PERF-09 for efficient opening. Coordinate with PERF-12 cancellation.

**Done when:** Searching a chapter does not require downloading all rich chapter bodies; complete intended coverage and existing matching behavior are retained; closing search restores Reader context.

**Source pointer:** `permitext-sync-server/public/app.js` — `renderReaderInternalSearchResults`.

### 11. PERF-11 — Mount and hydrate workspace panes independently

**Priority:** P1.

**Surface:** Web initial/restored workspace, Saved, Reader, Project Notebook, and Report.

**Evidence:** Source-confirmed full-render path awaiting synchronization and several pane preparations before appending the pane sequence. Existing utility rendering already reuses panes and should remain the foundation.

**Status:** Complete locally for released web surfaces. Public Reader/Search mount before sync; private panes verify access and hydrate independently. Browser evidence covers delayed/denied sync, Report Retry, installed-snapshot recovery, account/session changes, Notebook state, resizing and drag order. Initial Project reads are shared and Reader normalization no longer restarts loads. Source/regression/offline/smoke checks pass. This is not a deployment or production/device latency claim. See the [final acceptance record](performance/PERF_11_ACCEPTANCE_REMAINING.md).

**Work to do:**

1. Identify initial load, account restore, continuity updates, and pane operations that still enter the full-render path.
2. Mount stable pane shells in the correct order and dimensions promptly, then hydrate independent content without repeatedly reconstructing unaffected panes.
3. Use account-verified cached snapshots for immediate continuity when appropriate, with explicit pending/offline state and correct reconciliation.
4. Preserve access checks for shared/private Project content. Do not expose a cached pane while its account identity or authorization is uncertain.
5. Isolate loading and retry states per pane so one slow Notebook or sync request does not block an otherwise usable Reader.
6. Protect unsaved editors, selection, focus, scroll positions, resize geometry, and drag order during hydration and refresh.
7. Coalesce duplicated Project/Saved requests and reuse already-loaded transition payloads where valid.
8. Verify a fixture workspace containing multiple Readers, Search, Saved, Notebook, and Report, including one deliberately slow or failed pane.

**Dependencies:** PERF-01; UX-03 loading-state semantics; PERF-16 supplies populated fixtures.

**Done when:** Usable panes appear independently; existing panes do not blink or lose state; slow/private panes remain recoverable without exposing stale account data.

**Source pointers:** `public/app.js` — `renderWorkspace`, `renderUtilityWorkspace`, `ensureSyncedContentForRender`, `loadSyncedContent`, Notebook snapshot loading.

### 12. PERF-12 — Reduce synchronous work while typing and cancel obsolete requests

**Priority:** P2, elevated if traces show typing stalls.

**Surface:** Web Search and rapid navigation.

**Status:** Locally complete for web. Query persistence coalesces, final query flushes across lifecycle boundaries, obsolete Search/Reader requests cancel with shared-consumer protection, and generation/account guards remain. Native keyboard entry saved the populated workspace once instead of per key; browser reload, delayed cancellation, composition-event and delete/retype checks pass. Focused regression suites and all smoke components pass (segmented run). See `performance/PERF_12_SEARCH_TYPING_AND_CANCELLATION.md` and its browser evidence. Not merged, pushed or deployed; no physical iOS timing claim.

**Evidence:** Search input invokes broad workspace persistence on each keystroke before its debounce; stale results are ignored without necessarily aborting their network work.

**Work to do:**

1. Separate transient query/filter state from durable notes, drafts, saves, and pending sync mutations.
2. Debounce or coalesce transient query persistence so each keystroke does not serialize and write the complete workspace state.
3. Preserve the expected final query across blur, navigation, and reload using an explicit flush policy.
4. Add request cancellation for superseded search and chapter requests where supported.
5. Retain generation/identity checks even after adding cancellation; cancellation alone does not guarantee stale responses cannot arrive.
6. Bound shared-request cancellation so a request still required by another pane remains usable.
7. Verify fast typing, delete/retype, IME composition, pasted queries, rapid scope changes, network latency, and immediate navigation away.

**Dependencies:** PERF-01; coordinate with PERF-10 and PERF-11.

**Done when:** Typing does not trigger broad synchronous persistence per key; obsolete work is reduced; the final query persists correctly; durable editing guarantees remain intact.

**Source pointers:** `public/app.js` — search input handler, `saveWorkspaceState`, shared `api` request helper and search generation handling.

### 13. PERF-13 — Cache public code content safely by revision

**Status:** Locally complete for web. Bounded public response caching/ETags, revision-pinned text and figures, background browser invalidation, bounded Reader recovery and legacy offline compatibility are implemented. HTTP, browser recovery/figure decoding, revision/rollback/privacy contracts, full smoke and deployment-content verification pass; all 578 regenerated Reader indexes retain identical search content. See `performance/PERF_13_REVISION_SAFE_PUBLIC_CACHE.md`. No deployment/CDN or physical-iPhone timing acceptance claimed.

**Priority:** P2.

**Surface:** Web public code APIs, browser cache, CDN, and offline storage.

**Evidence:** Tested code endpoints returned `no-store` without ETags. This observation does not establish that static shell assets lack CDN caching.

**Work to do:**

1. Classify endpoints into immutable public corpus content, mutable public manifests/search, and private/account responses.
2. Include corpus revision/hash in immutable content identities and use appropriate cache headers there.
3. Use validators and revalidation for mutable manifests or unversioned routes; do not label changing enacted-code URLs permanently immutable.
4. Key search caching by all behavior-affecting inputs, including corpus revision, query, edition/scope, pagination, and search mode.
5. Keep private Saved, Project, Notebook, and account data outside public shared caching.
6. Align browser, service-worker, in-memory, and CDN cache invalidation. Preserve offline access to a coherent revision instead of mixing cached old metadata with new bodies.
7. Test content revision changes, stale responses, cache misses, offline launch, and rollback compatibility.

**Dependencies:** PERF-09 response/identity contract; PERF-01 measurements.

**Done when:** Repeat public reads benefit measurably from caching; revision changes appear correctly; no private data is publicly cached; offline tests pass.

**Source pointers:** `app.mjs` — public code handlers and JSON response headers; `public/app.js` — chapter/search caches; offline contracts and service-worker shell generation.

### 14. PERF-14 — Investigate slow first-use search and chapter request tails

**Status:** Complete locally; focused checks and full smoke pass. Bounded request-correlated traces identified repeated heading parsing during Chapter 33 body assembly. Pending reads and parsed headings now share work; 18 fresh-process samples pass, with full Chapter 33 at 635–637 ms instead of the reproduced 30-second timeout. Content hashes, selection/figure parity, revision/cache and cancellation checks pass. See `performance/PERF_14_FIRST_USE_INVESTIGATION.md`. No production or physical-iPhone timing claim.

**Priority:** P2 investigation; promote demonstrated server bottlenecks to P1.

**Surface:** Public search and chapter backend.

**Evidence:** Large differences between first/repeat request samples and one full-chapter timeout. The audit did not establish a specific infrastructure cause.

**Work to do:**

1. Record bounded server timing for initialization, index loading, candidate matching, snippet generation, content reads, serialization, and total response time.
2. Correlate client request IDs with server traces without logging private account content or full sensitive queries unnecessarily.
3. Repeat representative queries across controlled sessions and distinguish cold process initialization from content cache misses and network variation.
4. Reproduce the Chapter 33 timeout under an explicit test budget and inspect the slow phase before changing limits or retries.
5. Optimize only the demonstrated cause: reusable index initialization, coalesced reads, lightweight snippets, compact serialization, or another measured issue.
6. Preserve pagination, cancellation behavior, complete matching semantics, and recoverable errors.

**Dependencies:** PERF-01. Use results from PERF-09 and PERF-13 to avoid optimizing obsolete payload paths.

**Done when:** Slow requests have an evidenced cause and a repeatable improvement; request distributions improve without hiding failures through longer timeouts or unbounded retries.

**Source pointers:** `app.mjs` — code search and chapter handlers; `permitext-sync-server/tests/backend-performance-contract.mjs`.

### 15. PERF-15 — Reduce eager web script/style work where traces justify it

**Status:** Desktop investigation complete; measured no-change decision. Cold/warm welcome, Reader and populated six-pane traces show no renderer task above 50 ms (maximum 45.60 ms). Notebook is already on-demand; a broad module split is not justified. Search scroll restoration was reviewed, but skipping its zero reset globally would break reused panes. See `performance/PERF_15_WEB_STARTUP_INVESTIGATION.md`. No startup-speedup, lower-powered browser or physical-device claim; revisit if PERF-16 or device traces show a bottleneck.

**Priority:** P2, profiling-dependent.

**Surface:** Web shell startup and optional tools.

**Evidence:** Main script measured approximately 1.77 MB raw / 365 KB gzip. File size alone does not establish a startup bottleneck.

**Work to do:**

1. Measure actual parse/evaluation, style recalculation, and imported-module cost during first usable workspace presentation.
2. Identify optional feature code on that path; avoid splitting small code solely to reduce file size.
3. Load substantial optional modules on intent, with a bounded prefetch policy for likely next actions.
4. Preserve existing lazy module handling and prevent duplicate downloads or initialization after splitting.
5. Verify module failures and offline loading with clear retry behavior.
6. Compare launch improvement against first-open latency for the affected tool; do not merely move all waiting from startup to the first click.

**Dependencies:** PERF-01 and PERF-11. Schedule after larger data-path issues unless traces show otherwise.

**Done when:** Measured startup work decreases, optional-tool first use remains within budget, and cache/offline behavior is verified.

**Source pointers:** `public/app.js` — static imports and optional-module loaders; `public/styles.css`; shell/offline contracts.

### 16. PERF-16 — Close populated-workspace and large-account coverage gaps

**Status:** Locally complete for the bounded desktop acceptance matrix. Small/large fixtures, edit/save/reload, failure/offline recovery, same-item account-size comparison and pane/project return checks pass. Measured Saved/sync improvements and Notebook selected-card/scroll return fixes are committed locally. Physical-device, production and extended stress boundaries remain explicit; see `performance/PERF_16_POPULATED_WORKSPACE_ACCEPTANCE.md`.

**Priority:** P1 verification requirement, performed across the implementation batches.

**Surfaces:** Saved, Projects, Notebook, Reports, sync, and workspace restoration.

**Evidence:** Coverage gap; the audited account had no populated Projects for an end-to-end walkthrough.

**Work to do:**

1. Prepare isolated non-production fixtures for a small account, a large multi-edition Saved collection, multiple Projects, long Notebooks, and populated Reports.
2. Record fixture sizes explicitly: evidence rows, notes, Projects, notebook cards, images, and report content.
3. Test initial loading, tab/pane return, edits, autosave, restore after relaunch, offline recovery, and one slow/failed request.
4. Exercise multi-column layout operations while editors have unsaved changes; preserve every draft and focus/selection where expected.
5. Compare the cost of one visible item/pane with total account size to identify unnecessary whole-account work.
6. Convert any newly observed bottleneck into a bounded task with source evidence, a measurement, and an acceptance criterion; do not label untested areas as passing.

**Dependencies:** PERF-01. Supplies acceptance coverage for PERF-06, PERF-08, and PERF-11.

**Done when:** Populated workflows have rendered and measured evidence. Any unavailable device, account scenario, or release environment is explicitly recorded as remaining coverage.

### 17. PERF-17 — Evaluate downloadable editions with 2022/2014 bundled by default

**Status:** In progress: six-pack resource/category inventory and migration proposal committed; isolated host installer exercised all24,201corpus files with independent hash verification. Schema2 now binds canonical source identities to bundle metadata; host rejection tests and a276file install/reopen pass. Application catalog/search integration, download transport and physical measurements remain open; no bundled content removed. See `performance/PERF_17_DOWNLOADABLE_EDITIONS_EVALUATION.md`.

**Priority:** P2 proposal raised by the owner; evaluate after PERF-04. This is not authorization to remove currently bundled content or narrow existing users' search silently.

**Surface:** iOS distribution, edition availability, Search, Reader and saved references.

**Evidence:** The owner identifies 2022 and 2014 as the editions most used at present. Downloading other editions on demand could reduce distribution/storage costs and the scope of local all-edition searches. However, the `concrete` baseline spent 28.5 of 29.3 seconds in the first edition; reducing edition count alone does not address that dominant search cost. Startup benefit remains to be measured.

**Work to do:**

1. Inventory compressed install/download size and expanded storage by edition, including duplicated HTML, native documents, media, prepared sections and indexes. Measure actual startup loading; distinguish bundled-but-unopened bytes from work on the launch path.
2. Prototype 2022/2014 as bundled defaults and other editions as optional coherent code packs. Define which code families are included in each default edition; do not infer that every 2022/2014 family can be removed independently without product review.
3. Define a revisioned pack manifest with canonical identities, integrity validation and compatible text/index/media versions. Install atomically, support interrupted-download retry, and retain the prior usable revision until replacement validation succeeds.
4. Search downloaded editions with clear scope and a discoverable route to other available editions. Do not label partial installed coverage as a search of the full available corpus. Invalidate PERF-04 result caches when installed scope or corpus revisions change.
5. Existing saved passages, notes and shared links must resolve to their edition and offer an appropriate download when required; retain user content. Explain offline unavailability and provide storage/download management with explicit removal controls.
6. Migrate existing installations deliberately: do not silently delete downloaded or previously available content, break offline workflows, or replace historic sources with current editions. Review cross-platform expectations before rollout.
7. Validate interrupted downloads, insufficient storage, corrupt packs, updates/rollback, offline reopening, deep links and saved historical references. Compare first search, repeat search, installation size and startup independently.

**Dependencies:** PERF-04 versioned search/index/result-cache contracts; PERF-07 memory/storage budgets; separate UX review of edition/download status.

**Done when:** A measured prototype and migration proposal establish the benefit and preserved coverage. Obtain the owner's decision on default content and rollout before removing bundled editions. This proposal does not displace the current chapter task or first-search repair.

### 18. PERF-18 — Let users choose active code editions without uninstalling them

**Status:** Account-scoped preferences, pre-decode Search filtering, scope-aware result caching, enabled Browse projections and speculative warmup exclusion are implemented locally. Actual-helper contracts and generic iOS compilation pass. Exact-source metadata navigation, guarded enable/open prompts, Settings category switches and Browse/Search recovery are implemented locally; defaults still enable all sources until explicitly changed. Focused guest web acceptance now passes source toggles, exact2014/2022scope,1968Browse exclusion, disabled-reference Cancel/Enable, all-off recovery and preservation of open Readers. Web Search/navigation/offline contracts and local smoke pass. Signed-in Saved Cancel/Enable, existing-detail preservation, preference reload and sign-out-to-guest isolation now pass rendered checks. A real Chrome/IndexedDB seeded snapshot verifies offline scope and exact metadata without changing stored records. Rendered primary/secondary/primary transitions preserve distinct2022/2014preferences with authenticated synthetic accounts. The full production offline installer stored all22sources/578chapters/32,551sections in isolated Chrome. Browser restart and fully disconnected service-worker workspace reload retained exact source metadata and scoped/all-off Search. Physical iOS source controls, timing, and release acceptance remain open. Exact category identities and full-catalog versus enabled-projection boundaries are documented in `performance/PERF_18_ACTIVE_SOURCE_IMPLEMENTATION.md`. Production download work under PERF-17 remains open; no content removal approved.

**Priority:** P2 proposal raised by the owner on September 22 evening. Record the direction; do not silently change existing scope or displace the current detail-loading correction.

**Surface:** iOS edition settings, Browse, Search, background warming, saved references; evaluate web parity separately.

**Purpose:** An owner can keep 2022/2014 active and turn off unused sources such as 1968. Disabled content may remain installed for fast reactivation, while ordinary search/browsing and speculative loading exclude it. This can reduce work and resident memory; it does not fix slow extraction inside an active chapter or reduce bundled download size.

**Work to do:**

1. Map user-facing code family + edition identities to actual corpus bundles/categories. A displayed edition is not necessarily one resource bundle; disabling 1968 Building Code must not disable unrelated sources sharing a pack.
2. Persist a versioned active-source selection. Keep installed, active and downloadable states distinct. Preserve existing installations' current active scope during migration unless the user deliberately changes it.
3. Apply the active-source set consistently to Browse, all-edition search, preview tasks, startup readiness work and speculative warming. Cancel pending work for newly disabled sources and evict recreatable content when safe; never remove user data.
4. Include the ordered active-source set in completed-search cache keys. Changing scope must never reuse a complete result set from a different scope. Label results as active/enabled editions rather than all installed editions when these differ.
5. Keep existing saves, notes, annotations and shared links visible with their original edition identity. A disabled-source opening should offer to enable that source, preserving the user's explicit off setting until chosen. Never substitute an active edition's text. Define behavior when disabling the currently open source and when no source remains active.
6. Reactivate installed sources without a download; unavailable packs follow PERF-17 download/integrity/offline handling. Account switching and updates must preserve or migrate selection deliberately.
7. Measure startup, first/repeat search, memory and activation time with all sources enabled versus 2022/2014 only. Verify re-enable, cache invalidation, interrupted in-flight searches, saved references, offline use and cross-device expectations.

**Dependencies:** PERF-04 scope-aware result caching, PERF-07 work scheduling/cache budgets, PERF-17 installed/downloadable pack model, separate settings UX review.

**Done when:** Explicit active-source controls consistently bound ordinary loading and search, reactivation works, preserved historical work stays accessible, and measured benefits are documented. Do not call it a fix for the current detail-card extraction delay.

## 3. UX/UI — numbered implementation priorities


Current disposition: **owner resumed phone-independent UX/UI work on September28**. The original requirements below remain intact, not marked completed by performance work.

| Items | Current evidence | Remaining |
| --- | --- | --- |
| UX01–03 | Main commit891759c5e repairs historical Saved identity, Unassigned terminology and truthful Search counts/progress; focused regression coverage exists | Complete same-account cross-platform and accessibility acceptance |
| UX04–05 | Partial title/parent-context, navigation and Reader continuity corrections during performance work | Full Search/Saved title hierarchy and destination/return acceptance; next bounded web review should target varied saved passages and exact destinations, not repeat Search timing pilots |
| UX06 | Visible focus, project-dialog focus return, adjacent keyboard resizing, column collapse/movement and supplementary Research position preservation verified locally; host suites pass | Full light-app/assistive-technology and broader Project/Report visual coverage; native VoiceOver/Dynamic Type. [Focus evidence](ux/UX_06_KEYBOARD_FOCUS_2026-09-28.md) |
| UX07 | Web initial expansion, exact/broad queries and remembered explicit choices pass locally | Native parity and hosted acceptance remain. [Evidence](ux/UX_07_EXPANSION_POLICY_REVIEW_2026-09-28.md) |
| UX08 | Empty web workspace offers Reader/Search; bounded rendered keyboard acceptance passes | Signed-in/full light-mode and native empty Saved acceptance. [Evidence](ux/UX_08_EMPTY_WORKSPACE_2026-09-28.md) |
| UX09 | Visible Drafts section implemented on web/native; web per-conversation draft-loss bug fixed and rendered move/refresh/reload retention passes; native41.30 compiles | Physical native Drafts rendering/accessibility. Conservative facts do not authorize hiding/deleting uncertain drafts. [Evidence](ux/UX_09_VISIBLE_DRAFTS_2026-09-28.md) |
| UX10 | Web full source/chapter hover labels and historical/future-effective disclosure reviewed; bounded dark-mode checks pass | Native two-Reader/Dynamic Type, actual light mode and broader truncation/touch matrix. [Evidence](ux/UX_10_WEB_SOURCE_CONTEXT_2026-09-28.md) |
| UX11 | Bounded populated desktop PERF16 matrix passes; subsequent Research draft and keyboard pane continuity evidence added | Native/Production and extended stress boundaries; firm collaboration is excluded from the current release. Do not repeat unchanged desktop scenarios. [Acceptance matrix](performance/PERF_16_POPULATED_WORKSPACE_ACCEPTANCE.md) |

### 1. UX-01 — Repair missing historical notes and unify Saved evidence identity

**Priority:** P0 correctness.

**Surfaces:** Web Saved, native Saved parity, and shared evidence semantics.

**Evidence:** Observed four entries on iPhone versus two on web; isolated reproduction of historical annotations being dropped by the web consolidation function.

**Work to do:**

1. Preserve the real records while diagnosing. Compare canonical identities and record types, not only visible counts; distinguish a bookmark, section note, passage note, and project-only link.
2. Pass the actual annotation target, including edition, into `annotationForTarget` from `consolidatedSavedAnnotations`.
3. Replace section-only merge/suppression keys in `mergeSavedColumnItems` with the appropriate edition-aware section or passage identity. Do not collapse notes from different editions because their IDs look alike.
4. Make unassigned classification include note-only evidence according to the same product policy as iOS; currently the web's unassigned key set is derived from saved-item records.
5. Preserve note merging, deleted records, bulk-clear semantics, project membership, record timestamps, and pending local changes.
6. Check historical metadata hydration and opening so a row can neither display nor navigate into the default edition accidentally.
7. Add focused regression cases for a 1968 note, a 2014 note, a current-edition bookmark, a passage note, overlapping section IDs across editions, and deleted/cleared annotations.
8. Verify the same account on iPhone and web after refresh and relaunch. Investigate any remaining mismatch as identity/sync evidence, not just a count difference.

**Dependencies:** None. Coordinate with PERF-06 and PERF-08.

**Done when:** Every supported saved/note-only item appears under the same inclusion rules on both platforms, opens the correct edition and passage, and survives refresh/relaunch. No deletion or destructive migration is required to make the list look consistent.

**Source pointers:** `public/app.js` — `annotationRecordsForTarget`, `consolidatedSavedAnnotations`, `mergeSavedColumnItems`, `unassignedSavedEvidenceKeys`; `BookmarksView.swift` — `unassignedBookmarks`; `AuthoredCodeStore.swift` — `savedSections`.

### 2. UX-02 — Make Unassigned saves equally discoverable on web and iPhone

**Priority:** P1.

**Surfaces:** Saved entry, group labels, filters, and counts.

**Evidence:** Observed web items labeled individually as Unassigned, while iPhone exposes a separate Unassigned saves destination. The user could not readily tell whether web had the equivalent.

**Work to do:**

1. Define one user-facing term, preferably **Unassigned saves**, for the equivalent collection.
2. Give the web collection a clear entry or heading in the existing Saved structure, including the no-Project case.
3. Keep platform-appropriate layouts; consistent meaning does not require copying the phone layout into desktop columns.
4. Define whether a displayed count represents evidence rows or unique sections and apply that rule consistently, including passage notes.
5. Ensure active filters, empty results, and project assignment cannot make an item disappear without an understandable state change.
6. Explain organization briefly where useful: these items are saved but not assigned to a Project. Keep organization optional.

**Dependencies:** UX-01 must establish correct contents first.

**Done when:** A user can locate the same unassigned collection immediately on both platforms; labels, counts, and filters agree with the documented inclusion rule.

### 3. UX-03 — Make search counts, progress, and empty states truthful

**Priority:** P1.

**Surfaces:** Web Search and iOS Search.

**Evidence:** Web displayed “25 Matches” while more matches remained; iOS displayed zero results while searching was still in progress.

**Work to do:**

1. Model searching, partial results, completed results, cancelled queries, and failures distinctly.
2. On web, distinguish loaded count from known total. Use wording such as “25 loaded · more available” when the total is unknown.
3. Apply the same distinction to edition/group counts. Do not present the loaded subset as a complete edition total.
4. On iOS, show “Searching…” before results and “N found · searching more editions” while work continues, or equivalent concise wording.
5. Reserve a definitive no-results state for a completed search over the requested available scope.
6. Keep partial results usable after a recoverable failure and identify incomplete coverage where appropriate.
7. Announce meaningful search-state changes accessibly without flooding VoiceOver or screen-reader output on every incremental update.

**Dependencies:** Coordinate with PERF-04, PERF-05, PERF-10, and PERF-12.

**Done when:** Every displayed count and empty message accurately describes loaded data and completion state; pagination and incremental search never imply false completeness.

**Source pointers:** `public/app.js` — `updateSearchDock` and pagination callers; `SearchView.swift` — `resultCountLabel`.

### 4. UX-04 — Make result and saved-passage titles recognizable

**Priority:** P1.

**Surfaces:** Search rows, Saved rows, and selected-result headers.

**Evidence:** Observed numeric-only nested titles such as “2.1” and repeated paragraph text; native result 107.5 omitted its descriptive title in the opened sheet.

**Work to do:**

1. Define a concise display hierarchy: edition/source, parent section where needed, selected subsection or paragraph, and descriptive title.
2. Include parent context when a nested paragraph number cannot uniquely identify the passage to a reader.
3. Avoid repeating the complete same paragraph as both title and preview. Preserve the exact official passage in Reader.
4. Retain descriptive titles when opening a search result, including “107.5 Means of egress plans.”
5. Use canonical metadata rather than guessing parent numbers from a snippet or an ambiguous short title.
6. Check narrow web columns, large Dynamic Type, long titles, historical numbering, tables, and saved block-level passages.

**Dependencies:** UX-01 identity rules; coordinate row construction with PERF-05 and PERF-06.

**Done when:** Users can identify the passage and edition before opening it; headings remain accurate and accessible without modifying enacted text.

### 5. UX-05 — Clarify opening a result and moving into chapter context

**Priority:** P1.

**Surfaces:** Search → Reader and Saved → Reader on both platforms.

**Evidence:** Observed platform-specific destinations and insufficiently explicit native chapter-context navigation; product governance requires preservation of occupied Reader context.

**Work to do:**

1. Document the intended behavior of a normal result tap, Open in reader, New reader, and Open full chapter where those actions exist.
2. Keep the native passage sheet fast while making the route to surrounding chapter content clear.
3. Preserve the selected section/anchor when opening chapter context; avoid sending the user to the chapter top unexpectedly.
4. On web, make destination actions understandable and distinguishable at the normal utility-column width.
5. Preserve the existing Reader unless the user explicitly chooses to reuse/replace that context.
6. Preserve search query, filters, expansion, and scroll position on return.
7. Respect entitlement limits and provide an understandable outcome if another Reader cannot be added.

**Dependencies:** PERF-03, PERF-06, and PERF-09; UX-04 title/context display.

**Done when:** The destination of each action is predictable; the correct passage opens; existing reading and search context survives.

### 6. UX-06 — Restore visible keyboard focus and verify accessible interaction

**Priority:** P1.

**Surface:** Desktop web, with native accessibility verification for changed controls.

**Evidence:** A global `:focus-visible` rule removes outlines and shadows; the focused web control was observed without those indicators. This conflicts with the repository's visible-focus governance.

**Work to do:**

1. Replace the blanket focus suppression with a consistent, visible keyboard treatment using semantic styling tokens.
2. Keep pointer interaction visually quiet where intended without suppressing keyboard location.
3. Review legacy tests that assert outline removal; replace implementation-shape assertions with the intended accessible behavior where appropriate.
4. Exercise toolbar controls, search fields, result rows, disclosures, Reader references, Saved actions, dialogs, and pane operations with keyboard alone.
5. Verify logical focus order, Escape behavior, focus return after dialogs, and focus retention during asynchronous updates.
6. Measure changed text/control contrast in both themes and check accessible names/selected state.
7. Verify changed native controls with VoiceOver, increased Dynamic Type, and the existing 44-point critical-touch-target requirement.

**Dependencies:** None for the focus correction; recheck surfaces changed by later tasks.

**Done when:** Keyboard location is plainly visible throughout supported flows; no focus trap or lost-focus regression remains; changed controls meet the repository's accessibility requirements.

**Source pointers:** `public/styles.css` — blanket `:focus-visible` rule around line 16645; `tests/ux-ui-accessibility-phase2-contract.mjs`; `docs/PERMITEXT_UX_UI_GOVERNANCE.md`.

### 7. UX-07 — Reduce unnecessary search-group expansion steps

**2026-09-28 web implementation:** one useful group opens once per query/source scope when no remembered represented choice exists. Local exact and broad searches verify explicit collapse through pagination/reload and historical-edition preference across queries. Native implementation/device acceptance and hosted rollout remain open. See [policy and rendered evidence](ux/UX_07_EXPANSION_POLICY_REVIEW_2026-09-28.md).

**Priority:** P2 design proposal.

**Surfaces:** Search grouping on web and iOS.

**Evidence:** Results were initially hidden behind collapsed edition groups in both inspected interfaces.

**Work to do:**

1. Compare remembering the user's expansion choices with opening the most relevant/currently filtered group for a new query.
2. Make the initial rule deterministic and understandable; do not secretly narrow the search scope.
3. Preserve explicit collapse/expand choices for the active query and prevent incremental result updates from reopening groups the user closed.
4. Keep historical and other-edition matches discoverable, with truthful counts from UX-03.
5. Verify the behavior using a narrow exact query and a broad multi-edition query.

**Dependencies:** PERF-05 so default expansion does not create a rendering penalty; UX-03 and UX-04.

**Done when:** The chosen design reduces steps to a useful match, respects explicit user choices, and does not overwhelm the list or reduce coverage. Record rendered acceptance of the changed default.

### 8. UX-08 — Add restrained guidance to genuinely empty entry screens

**2026-09-28 status: web implementation verified locally; native Saved remains open.** Closing all web columns now offers Open Reader/Open Search. Keyboard activation uses existing toolbar actions and retains stable focus; Reader loading and loaded Search replace the guidance. Existing first-use onboarding, loading/error panes, and detached Project windows retain their behavior. UX alignment, offline, and readiness/recovery suites pass. Evidence: [bounded verification](ux/UX_08_EMPTY_WORKSPACE_2026-09-28.md). Signed-in, actual light-mode, native, and hosted acceptance remain separate.

**Priority:** P2 design proposal.

**Surfaces:** Empty web workspace and native Saved home.

**Evidence:** Empty/spare screens were observed with limited guidance about the next action.

**Work to do:**

1. Distinguish an intentionally empty workspace from loading, sync failure, no saved content, and a filter with no matches.
2. For a workspace with no panes, consider a compact Reader/Search prompt within the current visual language.
3. For Saved, explain where existing unassigned content lives or how saving a passage populates the collection.
4. Remove guidance when content is present; avoid persistent onboarding panels in an established workspace.
5. Keep the user's current column layout, mobile-web policy, native bottom controls, and Reader destinations.
6. Leave the separately deferred Notebook/Project Hub empty/error redesign out of this task.

**Dependencies:** UX-02 and UX-03 state semantics; PERF-11 mounting behavior.

**Done when:** A truly empty entry screen offers an understandable next action without making loading/failure look empty or changing the established workspace design.

### 9. UX-09 — Prevent empty Research drafts from crowding history

**2026-09-28 status: visible Drafts grouping implemented; local web acceptance passed, native rendering pending.** Chats with submitted messages precede a permanently visible Drafts section. Every record, custom/evidence title and unsent draft remains accessible; “Empty draft” now reads “Research draft.” Isolated authenticated browser checks verified all four synthetic records, unsent text after reload, and selected-evidence reopening. The extended walkthrough exposed and fixed a P1 refresh bug that broadcast one global draft into all composers; a failing-before/passing-after regression and a fresh rendered multi-pane/reload sequence verify per-conversation retention. Web/native host contracts, UX alignment and offline checks pass. No hiding, deletion or automatic reuse occurs. Full cross-device absence cannot be inferred safely; the earlier completeness metadata remains a conservative prerequisite rather than a hiding rule. See [rendered evidence](ux/UX_09_VISIBLE_DRAFTS_2026-09-28.md) and [classification boundaries](ux/UX_09_HISTORY_CONTENT_PREREQUISITE_2026-09-28.md).

**Priority:** P2 design proposal.

**Surfaces:** Research history on web and iPhone.

**Evidence:** Five Empty draft entries were observed before substantive conversations on both platforms.

**Work to do:**

1. Define a truly empty draft: no authored text, submitted messages, retained source selection, attachment, or recoverable pending request.
2. Choose a reversible presentation rule: reuse one empty draft or omit truly empty entries from the main history until meaningful content exists.
3. Preserve drafts with selected evidence even when no question has been sent.
4. Keep existing records intact during the presentation change; do not bulk-delete historical drafts as an automatic cleanup.
5. Ensure the same definition is used by both platforms and during sync/relaunch recovery.
6. Verify using fixtures and existing history without making paid Research requests.

**Dependencies:** Draft/sync regression coverage; maintain the explicit Research scope boundary in section 1.4.

**Done when:** Empty placeholders no longer crowd meaningful history, and no text, source selection, attachment, or pending request is lost.

**Source pointers:** `ResearchView.swift` — empty-draft summary labeling; `public/app.js` — Research conversation summary/title handling.

### 10. UX-10 — Improve source labels, truncation, and edition applicability cues

**2026-09-28 status: bounded web review/fix complete; native and broader accessibility acceptance remain.** At the existing600px Reader minimum, long chapter context is readable; long source labels can truncate. Full code/chapter hover titles now follow selection changes, alongside existing complete accessible names/menus. Existing source disclosure already exposes full future-effective and historical context; no new applicability claim or hard-coded Upcoming badge was added. Local dark-mode rendering, selection/reload labels and UX/offline suites pass. See [evidence](ux/UX_10_WEB_SOURCE_CONTEXT_2026-09-28.md). Native two-Reader/Dynamic Type, actual light mode and touch matrix remain open.

**Priority:** P2 targeted visual review.

**Surfaces:** Native Reader controls, search groups, source headers, and narrow web columns.

**Evidence:** Some native chapter labels were truncated; future-effective content appeared alongside other editions. These observations justify review, not an assumed redesign or legal applicability conclusion.

**Work to do:**

1. Ensure the active code, edition, and chapter can be identified even where a compact title is truncated.
2. Preserve the two native Reader destinations; distinguish their current contexts clearly when short labels are similar.
3. Consider a concise Upcoming cue for future-effective editions, alongside the existing effective-date text. Derive this from authoritative metadata and the relevant date, not a hard-coded label.
4. Avoid implying that the app has determined which edition governs a user's Project solely because that edition appears in results.
5. Inspect narrow columns, long historical titles, large Dynamic Type, light/dark themes, and touch targets before choosing revised sizing or labels.
6. Keep enacted text and source details accessible without adding repetitive chrome to every paragraph.

**Dependencies:** UX-04 source/title hierarchy; visual acceptance on actual affected screens.

**Done when:** Context is identifiable and applicability cues are factual; controls remain compact, reachable, and readable without obscuring content.

### 11. UX-11 — Complete a populated-workspace UX and recovery walkthrough

**September 28 recovery evidence:** repeated Notebook save failures, later edits, reload and server recovery pass in the isolated populated fixture. Latest text survives; card count stays unchanged; pending clears only after acceptance. [Bounded verification](ux/UX_11_NOTEBOOK_REPEATED_SAVE_RECOVERY_2026-09-28.md). Full-network outage/large-image/native/hosted boundaries remain open.

**September 28 scope correction:** rendered firm/shared-viewer acceptance is excluded from the current release surface, not an unfinished feature to enable. `PERMITEXT_DEFERRED_FEATURES.md` records the owner decision not to offer collaboration; `releaseSurfaceVisibility.firmCollaboration` is false, organization loading returns empty, and shared projects are not merged into the visible list. Preserve dormant data/permission compatibility and existing HTTP tests. Remaining current-surface recovery/large-image checks still apply.

**Priority:** P1 verification requirement, performed alongside the relevant changes.

**Surfaces:** Projects, Notebook, Reports, Saved organization, and workspace recovery.

**Evidence:** Coverage gap in the original account walkthrough.

**Work to do:**

1. Use the isolated populated fixtures from PERF-16.
2. Walk through finding a saved passage, assigning it to a Project, opening the correct source, editing a Notebook, and opening the corresponding Report workflow.
3. Verify navigation back to Reader/Search and return to unsaved editing work.
4. Inspect empty, loading, failed, offline, read-only/shared-access, and retry states separately.
5. Test opening, closing, resizing, reordering, and restoring columns while content loads and drafts are pending.
6. Record concrete screen-level friction separately from speculative redesign proposals.
7. Keep deferred product decisions deferred unless the user later explicitly includes them; this task verifies existing behavior and reports findings.

**Dependencies:** PERF-16 fixtures; UX-01 identity; PERF-11 pane behavior.

**Done when:** Current supported populated workflows have rendered evidence, correct source destinations, recoverable failures, and preserved drafts. Newly discovered defects are explicitly added to the backlog with priority and evidence.

## 4. Combined delivery order

1. **Batch 1 — Establish correctness and a credible baseline.** Complete UX-01 and PERF-01. Prepare the isolated fixture data for PERF-16/UX-11. These can progress independently within one implementation effort.
2. **Batch 2 — Improve native opening.** Implement PERF-02 and PERF-03, coordinating the minimum necessary parts of PERF-07. Add UX-04/UX-05 changes only where the affected opening path needs them.
3. **Batch 3 — Improve native search.** Implement PERF-04, PERF-05, and PERF-06, with UX-03. Finish the relevant cache budgeting in PERF-07. Verify first results, all results, result opening, and return navigation as one journey.
4. **Batch 4 — Correct repeat-use and sync costs.** Complete PERF-08 and remaining PERF-07 work. Exercise Saved parity and large-account cases after relaunch, offline recovery, and memory pressure.
5. **Batch 5 — Improve web content delivery.** Implement PERF-09 and PERF-10. Use PERF-14 traces to determine whether server matching/initialization requires additional changes. Coordinate cache identity with PERF-13 before finalizing the endpoint contract.
6. **Batch 6 — Improve workspace restoration and typing.** Implement PERF-11 and PERF-12, using the populated scenarios from PERF-16. Complete UX-02 and UX-06 where they have not already been delivered.
7. **Batch 7 — Apply measured secondary improvements.** Complete justified PERF-13/PERF-14/PERF-15 work and reviewed UX-07 through UX-10 proposals. Avoid introducing unmeasured architectural changes merely to exhaust the list.
8. **Batch 8 — Close cross-platform acceptance.** Finish PERF-16 and UX-11, compare final metrics against the original baseline, and run the integration gates below. Record any unresolved coverage honestly.

A later batch number does not require delaying an isolated correctness or accessibility fix. Keep changes reviewable and traceable to their acceptance criteria; avoid one combined rewrite of startup, Reader, search, sync, and workspace state.

## 5. Verification and release gates

### 5.1 Functional and content gates

1. **Saved parity:** same supported records and editions on iPhone/web, including historical notes and passage-level evidence; correct targets after refresh and relaunch.
2. **Search completeness:** reference queries retain expected result identities, phrase semantics, ranking rules, and all-edition coverage; partial results are labeled honestly.
3. **Reader fidelity:** text, lists, tables, figures, references, source validation, selection, and saved annotations remain correct.
4. **Continuity:** selected result, chapter viewport, search position, independent Reader contexts, and workspace geometry survive the relevant transitions.
5. **Sync safety:** migration, incremental pulls, account switch, expired cursor, pending writes, deletions, and offline recovery remain correct.
6. **Editor safety:** Notebook and other durable drafts survive navigation, pane refresh, failures, and relaunch according to the product's existing contract.

### 5.2 Performance gates

1. Record the same metrics and scenarios before and after each relevant batch.
2. Improve the intended interaction beyond normal test variability; report p50 and p95 with sample count and environment.
3. Do not accept faster launch if immediate chapter opening or immediate search regresses materially.
4. Do not accept faster first results if final completeness, result opening, or scrolling becomes materially worse.
5. Do not accept lower memory if ordinary repeat-use speed or offline readiness becomes materially worse.
6. Verify request count, decoded bytes, and main-thread work alongside elapsed time to explain the improvement.
7. Run physical-device Release/Profile verification; keep development, TestFlight, and App Store observations separate.
8. Keep oldest-supported-device testing open until that hardware or equivalent agreed coverage is actually available.

### 5.3 Existing repository checks to apply when their surfaces change

Run from `permitext-sync-server` unless otherwise stated. These are an implementation checklist, not claims that they passed during plan creation.

```sh
npm run audit:ux-ui
npm run test:ux-alignment
npm run test:offline
node tests/startup-critical-path-contract.mjs
node tests/search-reader-reuse-contract.mjs
node tests/reader-scroll-continuity-contract.mjs
node tests/reader-search-recovery-contract.mjs
node tests/backend-performance-contract.mjs
```

1. Repair the known startup test fixture failure before relying on its result.
2. Select the relevant existing native unit/contract tests, then add focused tests for changed correctness behavior and meaningful performance measurements.
3. Add explicit regression coverage for historical Saved identity, note-only inclusion, checkpoint migration, compact body-window contracts, and search completeness where existing tests do not cover them.
4. Follow [UX/UI governance](PERMITEXT_UX_UI_GOVERNANCE.md) for rendered light/dark verification, keyboard focus, native Dynamic Type, and evidence separation.
5. Run broader server/persistence/cache checks when the changed shared surface requires them. Do not run paid Research evaluations under this plan without a separate authorized scope and budget.
6. Treat screenshots, actual navigation, and device interaction as required evidence for changed visual behavior. Source assertions alone do not establish a successful interface.

### 5.4 Completion record for each task

1. Task ID and exact scope implemented.
2. Before/after behavior and the user-visible benefit.
3. Changed source areas and relevant commit.
4. Automated checks run, results, and meaningful failures still open.
5. Browser/device scenarios exercised, build provenance, and rendered evidence.
6. Performance baseline/comparison with sample sizes, where applicable.
7. Content, sync, offline, accessibility, and continuity checks relevant to the change.
8. Remaining risks or coverage gaps.
9. Deployment/TestFlight/App Store status recorded separately; a local pass or commit does not mean users have the change.

## 6. Source map and planning boundaries

Paths below are repository-relative; line numbers mentioned above refer to the audited revision and will move during implementation.

1. Native launch: `NYC CC APP/permitext/PermitextApp.swift`.
2. Native startup, chapter preparation, search sessions, sync, and memory handling: `NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift`.
3. Native corpus search and saved evidence construction: `NYC CC APP/permitext/Data/AuthoredCodeStore.swift`.
4. Native prepared-document cache: `NYC CC APP/permitext/Data/NativeReaderDocumentStore.swift`.
5. Native Reader presentation: `NYC CC APP/permitext/Views/NativeChapterTextReaderView.swift`.
6. Native Search and Saved UI: `NYC CC APP/permitext/Views/SearchView.swift` and `NYC CC APP/permitext/Views/BookmarksView.swift`.
7. Native Research history: `NYC CC APP/permitext/Views/ResearchView.swift`.
8. Native contract coverage: `NYC CC APP/permitextTests/EntitlementAndSyncContractTests.swift`.
9. Web workspace, Saved, Reader, and Search: `permitext-sync-server/public/app.js`.
10. Web presentation: `permitext-sync-server/public/styles.css`.
11. Backend chapter/search response construction: `permitext-sync-server/app.mjs`.
12. Product interaction/accessibility requirements: [Permitext UX/UI Governance](PERMITEXT_UX_UI_GOVERNANCE.md) and [Web UI/UX Rules](../permitext-sync-server/WEB_UI_UX_RULES.md). Where older descriptive rules conflict with newer explicit product decisions, preserve the current approved direction and document the resolution.

This plan prioritizes removal of unnecessary work while preserving the app's capabilities. It does not propose rewriting the app, narrowing search to hide costs, deleting saved content, changing Research economics, restoring retired surfaces, or redesigning the workspace wholesale. Progress is complete only when the relevant behavior and measurements are verified at the claimed delivery layer.

Notebook display decoding is optimized and physically rendering-verified on41.24; see [the focused record](performance/PERF_NOTEBOOK_DISPLAY_IMAGE_2026-09-25.md). This does not close the remaining broad acceptance gates.

41.25 removes the all-section priority scan and suspends unrelated warmups after selected demand acquisition. Four executable suites and physical Chapter6 rendering pass; see [warmup handoff evidence](performance/PERF_CHAPTER_WARMUP_HANDOFF_2026-09-25.md). No device speedup or full startup acceptance is claimed.

41.26 corrects interrupted reference completion on retained Reader reappearance without reloading its body. Actual-method host regression and physical ordinary body rendering pass; see [reference resume record](performance/PERF_READER_REFERENCE_RESUME_2026-09-25.md). Direct figure/reference-list visual confirmation remains open.

### September28 current priority: chapter frame delays

Build41.27 chapter opening/scroll capture successfully saved. It reports81 Permitext animation hitches (maximum200ms) and73 potential interaction delays at >33ms (maximum264ms). Chapter callback samples234/281ms do not establish frame smoothness. Investigate overlapping CPU stacks in the existing trace next; no repeated phone actions or UX/UI work required. Evidence and limits: [physical checklist](performance/PERF_18_PHYSICAL_ACCEPTANCE_CHECKLIST.md), `PERF_18_RELEASE_41_27_CHAPTER_FRAMES.json`. Overall performance acceptance remains open.

### September28 owner scope update and candidate status

Owner is away with the phone and explicitly authorized continuing phone-independent work, including UX/UI. This supersedes the earlier UX/UI hold. Continue one task at a time; no simulator. Build41.28 is installed and its chapter frame comparison saved. The targeted regex compilation hotspot is removed from dominant stacks, but remaining hitches and one severe interval prevent a broad smoothness claim. Continue offline trace diagnosis before selecting the next plan item. Full downloadable editions remain deferred.

### September 28 keyboard follow-up

UX-06: populated synthetic Saved keyboard selection/cancel verified. Fixed workspace-menu dialog focus return; New Project and Manage Projects now return focus to the durable toolbar trigger after Escape. New Project reverse-Tab trapping verified. Evidence: [keyboard report](ux/UX_06_KEYBOARD_FOCUS_2026-09-28.md). UX audit, alignment and offline suites pass. Remaining accessibility/device gates are unchanged; no owner records were changed.

UX-06 additional follow-up: fixed adjacent expanded-column keyboard resizing; verified arrow/Shift steps, visible focus, announced widths and reload persistence with an unsent draft. [Evidence](ux/UX_06_ADJACENT_RESIZE_2026-09-28.md). This does not close keyboard reordering/collapse or full accessibility acceptance.

UX-06 column actions follow-up: existing Column options now exposes keyboard collapse and Move left/right across workspace panels. Supplementary Research identity/order bug fixed; mounted draft survives move/collapse/expand/reload. Linked groups and pinned boundaries have host regression coverage. [Evidence and remaining scope](ux/UX_06_COLUMN_ACTIONS_2026-09-28.md). Native build remains local41.30 / installed41.28.

UX04/05 historical Saved follow-up:2014 subsection28-101.3.1 retains its descriptive title/source through Detail→Reader. Fixed missing horizontal Reader reveal; occupied2022 Reader and unsent Research draft remain intact. Actual-handler readiness/navigation regression and UX/offline suites pass. [Evidence](ux/UX_04_05_SAVED_DESTINATION_2026-09-28.md). Broader title/destination acceptance remains open. Owner has returned with the phone; next native task remains41.30 chapter metadata acceptance.


### September28 bounded UX04/10 history integrity follow-up

Recently Viewed now preserves exact editions in web-created records and client/server merge identity. Explicit 2014 and legacy canonical-ID entries reopen the correct historical section after reload while the independent 2022 Reader remains intact. Unknown editions are labeled honestly. [Evidence and tests](ux/UX_04_10_RECENT_HISTORY_EDITION_2026-09-28.md). This does not close native/device or hosted cross-device acceptance.

## Selected Note reload follow-up — September 28

The selected Note reload issue is now fixed and locally rendered-verified. Account/workspace/project-scoped IDs remain device-local; invalid selections safely fall back. [Verification and boundaries](ux/UX_11_NOTEBOOK_RELOAD_SELECTION_2026-09-28.md). This supersedes the earlier open reload-selection finding. Native and hosted acceptance remain separate.

## Saved assignment follow-up — September 28

Rendered Unassigned → Project assignment, reload, canonical 2014 detail opening and retained Notebook/Report content pass locally. [Evidence](ux/UX_11_SAVED_ASSIGNMENT_2026-09-28.md). Authenticated sync readback proves the membership; no product code change was needed.

## Current workspace performance investigation — September 28

Matched visible workload testing found large-account cost; scoped Report queries reduce unnecessary reads but the browser comparison does not establish an overall speedup. [Current evidence](performance/PERF_16_MATCHED_WORKLOAD_COMPARISON.md). Fixture-only attribution now measures 14 summary rebuilds totaling71.1ms in the warm large-account sample, versus0.8ms small; local request waiting remains larger. Synchronous Saved/reconciliation reuse now reduces observed startup summary calls from14 to11; webv604/shell1247 passes rendered content checks and focused freshness/callback regressions. Request latency and production attribution remain open. Do not close PERF16 from the older bounded-workflow pass.

## Project foundation owner-scoped reads — September 28

Following measured browser summary reuse (14→11 startup calls), backend review found three global normalized-store reads in the scoped Project foundation path. Owner-specific mutation queries and permission-filtered minimal member-profile queries now replace them, preserving migration and account isolation. Adapter/query contracts and real local HTTP migration/Project handoff checks pass. [Scope and validation](performance/PERF_16_FOUNDATION_READ_SCOPE_2026-09-28.md). The full isolated PostgreSQL18.6 readiness suite now passes (1,830SQL requests, zero external/provider requests), including actual scoped SQL execution and account/export/deletion isolation. Hosted latency/acceptance remains open; neither local SQL execution nor file-store timing proves production speed.

## September29 bounded recovery acceptance

Web UX11 now has rendered evidence for complete application transport loss with both unprepared and prepared offline origins. Latest Note drafts survive interruption and reconcile to canonical server content after recovery. Prepared offline reload restores the previously opened private Note and opens a correct-edition Saved detail. See `ux/UX_11_TRANSPORT_RECOVERY_2026-09-29.md` and `ux/UX_11_PREPARED_OFFLINE_NOTEBOOK_2026-09-29.md`. Native/hosted, image-upload interruption and broader accessibility/release requirements remain open; speed tuning remains owner-paused.

# PERF-18 physical iPhone acceptance checklist

Status: **All device evidence below is pending.** This is a test procedure, not a completed acceptance record. Local signed Release build **1.0 (41.12)** from `f32b7a209` passed compilation and strict code-signature verification. Its executable/resource hashes and path are recorded in [build provenance](PERF_18_RELEASE_41_12_BUILD.json). Verify the artifact still matches that record and confirm installed version before testing. It is not a TestFlight or App Store release. Installed in place on the physical iPhone 17 Pro (iOS 27.0) on September 24; `devicectl device info apps` confirmed version 1.0 (41.12). No simulator was used. Installation alone does not establish functional acceptance.

Scope: native active-source preferences, Search/Browse scope, exact-source opening and performance continuity. Reference: [implementation](PERF_18_ACTIVE_SOURCE_IMPLEMENTATION.md) and [priority plan](../PERMITEXT_PERFORMANCE_AND_UX_PRIORITY_PLAN_2026-09-22.md). Web evidence does not satisfy these rows.

## Session record

September 24 connection checkpoint: artifact hashes were rechecked before the in-place development install. The device apps query confirmed 41.12. Two attempted 12-second launch recordings (`/tmp/permitext-perf18-41.12-launch-01.trace` and `-02.trace`) terminated with exit 13, “Timed out waiting for device to boot.” The second attempt followed the owner's unlock. Subsequent device details showed a booted, paired phone connected through `localNetwork`, while `xctrace list devices` listed it offline. These attempts provide **no launch timing evidence**. USB connection was requested; functional rows and timing rows remain pending. Account/data preservation has not yet been visually verified.

Fill in device model, iOS version, build/version/SHA, install provenance, date, battery/thermal state, connection type, network condition, account aliases, and trace/screenshot paths. Record whether this is an existing-install upgrade or clean synthetic installation. Do not clear the owner's app data or replace existing account preferences for a cleaner measurement. Use authorized synthetic accounts A and B for account tests; record starting preferences and restore them afterward.

For every row write `PASS`, `FAIL`, or `BLOCKED`, with evidence and a concrete reason. An observed failure is not a pass because a host test covers the same logic.

## Functional matrix

| ID | Procedure | Expected outcome | Result / evidence |
|---|---|---|---|
| 1 | Guest with no prior preference: open source management, Browse and Search. | Installed configurable sources start enabled. Management is usable without signing in. No source is silently removed based on popularity. | PENDING |
| 2 | Disable 1968 Building Code; search `concrete`; inspect available chapter choices. | 1968 disappears from ordinary results/choices. 2022 Fuel Gas remains enabled despite both source categories using numeric ID 4. Other administrative categories remain available. | PENDING |
| 3 | Disable 2022 Building; retain 2014 Building; search `concrete`. | 2014 results remain. No 2022 Building results or previews publish, including a query already running when toggled. Edition labels remain correct. | PENDING |
| 4 | Reverse row 3, then restore both. | Only the explicitly enabled edition returns; restored scope regains its results without losing the query/history. | PENDING |
| 5 | Disable every configurable source. Check Search and both Browse surfaces. | Accurate all-off explanation and Manage action. No automatic enable or replacement selection. If any legacy SQLite source remains outside these controls, record it: do not expect a claim that absolutely every installed source is off. | PENDING |
| 6 | Keep a 2022 chapter open, note section/scroll, then disable its source. Return to that Reader. | Existing enacted text and position stay visible. Ordinary new chapter choices for that source are unavailable; management can re-enable it. | PENDING |
| 7 | Keep different chapters/editions open in primary and second Reader; change scope. | Both existing Readers retain their own edition and location. Neither silently adopts the other's category. Opening a new enabled chapter remains correct. | PENDING |
| 8 | Before disabling, retain a Saved passage from that exact source. Open it while disabled, then Cancel. Repeat and choose Enable and open. | Saved row remains visible. Cancel changes no Reader/source choice. Enable persists only that exact source and opens the exact edition/passage, not a similarly numbered section elsewhere. | PENDING |
| 9 | Repeat row 8 using an existing Research citation, without generating paid Research. | Same explicit choice and exact source. Cancel preserves existing workspace. Record unavailable/missing citation separately; do not substitute an edition. | PENDING |
| 10 | Open an exact section deep link while app is running; repeat from terminated state with version discovery still pending. Test disabled source Cancel/Enable. | Link survives normal startup, resolves exact metadata and prompts before body load/Reader replacement. Ambiguous or unavailable identity reports failure without guessing. | PENDING |
| 11 | Start opening a disabled source; change account or source choice before confirming. | Stale confirmation cannot enable a source for a different account or publish an obsolete destination. Retry uses current context. | PENDING |
| 12 | Account A disables 1968; account B retains defaults. Switch A→B→guest→A, including a Search in flight. | Preferences and cached/in-flight results follow each exact account. Guest choices are separate. A's disabled choice returns on A. Existing saved content is not deleted. | PENDING |
| 13 | Run `concrete` to completion, repeat, change scope, repeat; terminate/relaunch and repeat again. | Completed-query reuse is scope-specific. Prior broader results never appear as the narrower complete set. Final query/history and source choices survive relaunch. | PENDING |
| 14 | In each enabled edition open a Search result twice; use 2022 `403.2.3.3 Concrete and masonry walls` where present. Open `722.2.4 Concrete columns` and swipe its table. | Correct full passage renders both times; right-hand table columns remain reachable; no missing body/reference/figure regression from faster loading. | PENDING |
| 15 | Open management again after all-off, enable only 2022/2014 desired categories, then relaunch. | Recovery works with no sign-in detour for guests. Only explicit choices persist; content installation is unchanged. | PENDING |

## Timing and resource matrix

Do not invent a pass threshold from desktop measurements. Compare with the prior physical evidence on the same device/build configuration where available, and record raw samples, median and range. Use a five-sample pilot for expensive manual startup scenarios; record its median/range without treating it as a robust percentile baseline. Target at least30 samples for short repeatable interactions before reporting p50/p95; retain and explain outliers. A cached result count alone is not evidence that authoritative matching completed. Use existing signposts plus visible-content observation; do not equate process launch with readable content.

| ID | Capture | Comparison / required record | Result / evidence |
|---|---|---|---|
| T1 | Five terminated-process launches per scope: all enabled, then the owner's explicit 2022/2014 selection. | Time to interactive shell and current chapter readable separately; include account sync readiness. Distinguish cold process from fresh install and warmed OS caches. | PENDING |
| T2 | Current chapter, recently opened chapter, then a not-recent enabled chapter. Repeat each. | Tap→first readable authored text and fully usable navigation; check initial location/chapter top. Capture concurrent background warmup interference. | PENDING |
| T3 | `concrete`: first query, immediate repeat, scope change, repeat after relaunch. | Input→first useful results and completed results, result/edition counts and expanded-card responsiveness. Keep corpus/search revision fixed. | PENDING |
| T4 | Search result tap→readable detail, first and repeated opening. | Time independently from Search matching; include correct body/table/reference checks from row 14. Compare a small versus populated Saved account only if fixtures and identical visible result are available. | PENDING |
| T5 | Alternate chapters/Search and expand result groups for a bounded 5-minute session; background/foreground once. | Peak/resident memory, main-thread stalls, cache/warmup activity and recovery. Record thermal state. Do not manufacture memory pressure by deleting owner data. | PENDING |
| T6 | Ordinary signed-in relaunch with existing sync checkpoint; then legitimate sync update. | Network/checkpoint activity and first-interaction latency. Verify private data freshness and no forced full replay. Recovery/reset paths require an isolated fixture, not corrupting the owner's database. | PENDING |

## Earlier performance tasks covered by this session

1. **PERF-01:** T1–T5 provide reproducible physical timings and artifact provenance. Keep startup, Search and detail intervals distinct.
2. **PERF-02:** T1 verifies readiness-driven startup without a fixed launch hold; adding source metadata must not reintroduce unnecessary waiting.
3. **PERF-03:** T2 and rows 6–7 verify current/recent chapter preparation, chapter-top correctness and independent Reader state.
4. **PERF-04:** T3 plus row 13 verify first/repeated matching, persisted query reuse and source-scope invalidation on device.
5. **PERF-05:** T3/T5 measure expanded group scrolling and lazy preview work, checking no late disabled-source preview appears.
6. **PERF-06:** T4 verifies result-to-detail latency separately; row 14 verifies content completeness and table interaction. Prior partial trace coverage is not replaced by an untimed tap.
7. **PERF-07:** T2/T5 check speculative work exclusion, bounded cache behavior and foreground responsiveness. Host budget tests remain distinct from measured device memory.
8. **PERF-08:** T6 checks ordinary-launch checkpoint reuse. Existing host/physical recovery evidence remains separately identified; do not claim a new recovery test unless actually performed.

Acceptance requires functional outcomes and usable trace evidence, not only build/install success. Record failures and remaining phone-only gaps before deciding whether PERF-18 is complete. Restore the owner's explicitly chosen source scope after the session; do not deploy, submit or release as part of this checklist.

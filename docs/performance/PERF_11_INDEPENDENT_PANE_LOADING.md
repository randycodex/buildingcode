# PERF-11 — Independent workspace pane loading

Status: in progress. Independent pane publication after sync is implemented locally; public-first loading before sync and full mixed-editor browser acceptance remain pending. The owner preview on port8796 serves this worktree. Nothing has been pushed or deployed.

## Verified baseline

Run from the repository root:

```sh
node permitext-sync-server/scripts/profile-workspace-pane-loading.mjs --baseline
```

The script extracts the actual `renderWorkspace` and `renderUtilityWorkspace` functions. A controlled fixture contains two Readers, Search, Saved, Notebook and Report. Sync, Notebook and Report dependencies are released independently. Renderer and DOM adapters make this a dependency-order profile, not a browser paint or device benchmark.

- Full rendering starts no pane while sync is unresolved. After sync, Notebook starts alone. Report starts only after Notebook resolves. Search, Saved and Readers start only after both private tools resolve. All six panes are appended together at the end.
- Utility rendering preserves the two existing Reader nodes, but a newly requested Search/Saved pane still waits for the slow Notebook/Report pair. Parallelizing the two project tools alone has not removed the workspace-wide wait.

Recorded output: `PERF_11_PANE_LOADING_BASELINE_2026-09-23.json`. Source baseline: local performance commit `6432dd5e6`.

## Implementation sequence

1. Define desired pane descriptors with stable pane ID, content identity, public/private scope, renderer, reusable node, ownership metadata and close behavior. Capture account request identity, active workspace ID and render generation for the mount operation. Closing and reopening the same pane ID needs a new attempt identity.
2. Mount the complete ordered pane sequence once. Reuse healthy existing nodes. Insert correctly sized neutral loading shells for missing panes; preserve divider identity, collapse groups, drag order and horizontal scroll. Shells need working close and retry controls.
3. Start independent hydration after mounting. A completion replaces only its owned shell; it must not rerun the whole append/reconcile function. Protect against account/session replacement, workspace switch, superseded render, close/reopen, and changed content identity. Stale completion cleanup may dispose only its own editor/controller.
4. Separate the shared sync prerequisite from public Reader/Search preparation. Preserve authentication restoration before account-scoped work. Do not show Saved, Project titles, cached private annotations, Notebook or Report solely because persisted entitlement says Pro. Audit Reader/Search private adornments before classifying their complete rendered content as safe before sync.
5. Reconcile remote continuity and deleted Projects only after appropriate sync verification. Remote continuity can change the desired pane set. Reconcile that set while retaining unrelated live nodes, rather than performing a second destructive full render.
6. Expose Notebook/Report loading shells before their initial data/editor awaits, while preserving server access checks, read-only mode, durable drafts, conflict recovery and permitted offline behavior. Existing mounted editors must not be invoked through constructors that dispose them; use their targeted refresh methods when content changes.
7. Apply Reader select enhancement, scroll indicators and stored-anchor restoration after each Reader mounts. Define separate shell-mounted and hydration-settled completion signals; startup currently awaits the whole render before horizontal-scroll restoration/deep links and pending intents.
8. Preserve coalesced account sync and Project transition-hub requests. Add shared request reuse only with account/Project identity and access freshness included. Do not introduce unverified private caches to improve timing.
9. Verify the full mixed workspace in a rendered browser with a deliberately slow/failed pane. Keep local, production and device timing claims separate.

## Lifecycle constraints found in source

- `ensureSyncedContentForRender` accepts only same-account connected data, or same-account offline data while offline/unreachable; otherwise it starts a coalesced sync load.
- `loadSyncedContent` checks account identity after asynchronous stages, applies continuity/reconciliation, and stores entitlement after resolving the account data. Persisted `state.account.entitlement` alone is not fresh authorization.
- Search already returns a shell and schedules connected hydration. Saved also returns a shell but fills it with private local/cached state immediately; Saved is not public.
- Reader awaits `refreshReaderContent` before returning. Its private annotation/Saved adornments need explicit handling if displayed ahead of sync.
- Notebook and Report create shells and register mounts before awaiting data, but return only after initial hydration. Both constructors dispose the previous same-project mount at entry.
- `appendPaneSequence` already performs keyed DOM reconciliation, but closes custom selects, prepares controls and disposes inactive editor mounts. Calling it on every completion can disrupt healthy panes.
- Notebook cleanup recognizes `.notebook-panel[data-project-id]`; Report has equivalent ownership matching. Workboard cleanup expects `.workboard-root[data-project-id]`. Generic shells can accidentally dispose still-loading controllers unless cleanup uses desired ownership or shells carry appropriate identities.
- Notebook permits cached fallback only for transport/5xx failure, not authorization denial or account-change/deletion. Keep this distinction.
- Report refresh preserves dirty draft content while updating sources/history. Initial Report failure currently writes into a hidden status and lacks a disposed/account guard; address that while changing hydration.
- Account activation increments account and workspace generations, disposes private controllers and clears the track. Deferred work must respect both generations and exact node ownership.

## Required tests and acceptance

1. Real orchestration with held sync plus held Notebook: public usable panes are not delayed by either, while private content remains gated.
2. Two Readers, Search, Saved, Notebook and Report preserve requested order and sizes. One slow pane cannot prevent another from mounting; one rejection presents an isolated retry.
3. Account A→B, sign-out, same-user replacement session, workspace switch, and close/reopen of the same ID reject old completions without disposing the new controller.
4. Cached shared Notebook plus access denial never reveals cached private content; viewer remains read-only. Offline fallback follows current policy.
5. Typing, selected text, unsaved Notebook/Report documents, scroll anchors, column resize, drag order and open controls survive unrelated hydration and sync reconciliation. Compare actual DOM/editor identities and browser selection, not just serialized state.
6. Retain startup authentication/deep-link/pending-intent ordering and `persist:false` semantics. Existing tests that assert one final append must be adapted to the per-pane contract, not deleted.
7. Baseline/profile output must be followed by real rendered evidence. VM adapters alone cannot establish paint time, focus or editor selection preservation.

Relevant existing suites: `workspace-startup-restore-contract.mjs`, `startup-critical-path-contract.mjs`, `web-account-isolation-contract.mjs`, `web-account-mutation-isolation-contract.mjs`, `web-client-reliability-contract.mjs`, `reader-scroll-continuity-contract.mjs`, `web-notebook-durability-contract.mjs`, `notebook-editing-position.mjs`, `notebook-report-promotion-contract.mjs`, `pane-collapse-contract.mjs`, `evidence-folders-contract.mjs`, and full `smoke.mjs`.

## Current limits

No PERF-11 product speedup is claimed. The current local server is kept running for the owner at `http://localhost:8796/workspace`; do not stop it as routine test cleanup. Use a separate named browser session and isolated server/port for implementation verification. Phone access and a simulator are not required for this web task.

## Coordinator prerequisite and public-content boundary audit

The pure coordinator (`public/workspace-pane-hydration.js`) now has executable tests:

```sh
cd permitext-sync-server
npm run test:workspace-pane-hydration
```

It starts independent loads, retains a pending attempt across same-context reconciliation, rejects obsolete account/workspace generations, cancels removed attempts, retries with a fresh controller, and discards only the exact obsolete returned pane. An externally supplied healthy pane supersedes a pending attempt. `identity` must include construction-affecting inputs; `existing` must never point at a loading placeholder. `settled()` snapshots current attempts rather than future reconciliations. These module tests do not prove application integration or rendered performance.

Source inspection identifies these concrete boundaries before removing the full-render sync barrier:

1. `renderReaderChapterSection` reads `savedSectionRecord` for both whole sections and individual blocks. That function consults local saved records and synced summary directly. Public text may load early, but Saved markers need a verified-private-state gate and subsequent in-place refresh.
2. `renderInlineCommentBox` captures `currentResearchConversationLabel` into accessible labels and click closures. The label can contain a private conversation title or starter question. A generic initial label alone is insufficient if its click closure still captures the old conversation; upgrade the control after verification or resolve its current action at click time.
3. `renderReaderSectionProjectContext` reads Project names, assignments and note presence. Keep that context absent until verified; refresh only the context host after verification, preserving the code DOM and reading position.
4. `renderSearchRecentPopover` reads account-local recent query strings, and `renderSearchHistory` renders account-local recently viewed entries. Search's public request/result path must be separated from these personal history surfaces when sync is pending.
5. Search result creation calls `isSectionSaved`, which can read Project assignment state through `workspaceProject` and `currentContentSummary`. Its bookmark state and mutation controls need the same verification boundary as Reader.
6. `hydrateSearchPanelWhenConnected` already starts sync and result rendering together. Reuse the shared sync promise, but do not assume its existence proves that private adornments are safe.
7. `refreshVisibleSyncedDerivedState` provides targeted bookmark/note refresh machinery. Use targeted refresh after verification rather than reconstructing Readers or stealing input focus. Confirm Search controls and captured Research labels are refreshed too; the existing function alone does not establish that coverage.

This audit supports a staged integration: first remove inter-pane serialization after the existing sync gate; then remove the public-content dependency on that gate with explicit tests for all seven boundaries. PERF-11 remains incomplete until both stages and rendered acceptance pass.

## Local integration checkpoint

Both rendering paths now reconcile one ordered sequence of existing panes and loading shells, then publish each completed pane into its own slot. Existing awaited callers still wait for the hydration batch, but usable pane DOM no longer waits for unrelated slow panes. Forced refresh cancels exactly one job; stale jobs retire their own map entry, allowing a subsequent current render to restart. Content signatures follow Reader navigation, Code Question view state and capability changes. Quota counters are not part of the access signature.

Report initial failures are visible and stale/disposed failures are suppressed. Sync-conflict resolution refreshes existing data surfaces in place. Workspace rename refreshes mounted Project/Saved names without reconstructing editors. The offline shell includes the new module (asset generation `20260923-independent-panes-v559`, shell1202).

Verified locally:
- Coordinator plus actual extracted mounting/publication helpers: independent completion, retained editor object/draft/selection, forced refresh, Settings scroll, close/reopen, retry, transition placeholders, capability change and account invalidation. These use DOM adapters, not real editors.
- Actual Report failure, sync-conflict and workspace-rename callers: current success/failure handling and stale account suppression.
- Startup restoration, account isolation, Reader navigation/scroll, Notebook durability, column collapse, offline import-graph/recovery and full smoke checks.
- Rendered guest browser on isolated localhost8797: Reader text and Search render; opening another Search retains the original Reader and first Search DOM nodes, with no loading slots left and no browser errors. Screenshot inspected at `/tmp/permitext-perf11-workspace.png`. An initial Reader identity regression was reproduced and corrected before this check.

Still required before PERF-11 completion:
1. Public Reader/Search content before slow sync, with every private adornment/history boundary above enforced.
2. Real mixed signed-in workspace with two Readers, Search, Saved, Notebook and Report, controlled slow/failed requests, real editor typing/selection, and account/access transitions.
3. Separate shell-ready/target-pane completion for callers where awaiting unrelated hydration delays navigation or focus. Current promise compatibility is retained and is not proof of immediate interaction completion.
4. Updated current-path dependency profile and final browser timing. The original baseline is reproducible with `--baseline` against its recorded Git source; its VM is intentionally not used to claim current paint performance.

## Fresh-browser mixed workspace acceptance

Against committed `1ac52b64d`, an isolated synthetic Pro account on localhost8797 opened Saved, Notebook, Report, Search and two Readers. Four Report requests were deliberately suspended via a test-browser fetch wrapper. While they remained held, both Readers rendered ten initial sections in total, Search rendered 25 initial result rows for `concrete`, and Notebook opened a real editable Note. This is an initial-result count, not the total available matches.

The Notebook was filled with a synthetic sentence and the phrase `Concrete note` selected with keyboard focus in its real contenteditable editor. Releasing the four Report requests completed Report with zero remaining loading slots. The exact Notebook editor, all other existing pane nodes, input text, focus and selected phrase were retained. Browser errors were empty. Machine-readable observations: `PERF_11_MIXED_BROWSER_EVIDENCE_2026-09-23.json`.

Reproduction: start an isolated test server with mock Research and synthetic grant credential; sign in a synthetic Pro account; create a Project and open its Saved pane; wrap test-window fetch to hold `/reports/` requests; open Report, Search, Notebook and two Readers; search `concrete`; create/type/select within a Note; record node references; restore fetch and release held requests; compare node identity, selection, focus and text. Never intercept the owner's browser or real account. The earlier verification session cached an intermediate module and was discarded; this evidence comes from a fresh session.

Still not proven: failed-request recovery in the real mixed browser, account/access transitions in that browser, and public content before initial sync. The current awaiting API also continues waiting for the complete hydration batch.

### Next implementation boundary

Use a verification object scoped to account/session/workspace, with panel-scoped presentation permission installed before rendering descendants. Reader public blocks/references and nonempty public Search results can render while pending, but private marker/history/Research controls must not read private state or bind private mutation actions. Insert/upgrade private controls in place after the complete existing sync chain and appropriate offline/access checks. Opening search results must carry that permission boundary into the new Reader. Utility render paths must share the same gate so navigation cannot bypass it. Reconcile current workspace/project state before releasing private renderer closures; never release a removed Project's old closure. Do not temporarily erase global summaries or render sensitive values and hide them with CSS.

## Scoped private-presentation prerequisite

Reader and Search now accept `options.accessGate` (default absent preserves existing behavior). The pure `workspace-access-gate.js` accepts only caller-classified verified/permitted-offline states, suppresses obsolete account contexts and isolates presentation observer failures. Reader defers Saved/Research/Project reads and upgrades stable control nodes. Search defers personal history and saved markers; public rows are retained while their controls upgrade. Actions recheck permission. These paths are exercised by `npm run test:workspace-access` using actual extracted production functions.

Sync now records `workspacePresentationAccess` only after the full successful chain, or an allowed transport/server fallback with a real original same-account snapshot. An unverified offline baseline cannot become trusted through a second failure. The rendering prerequisite waits for an active same-account sync promise rather than treating early `connected` assignment as completed verification. This marker does not authorize shared-project membership; those renderers retain their separate checks. Existing offline data retention is unchanged.

The startup orchestrators DO NOT supply the gate yet. Therefore this prerequisite does not claim public-before-sync speedup. Next wire one account/workspace gate through both render paths and result opening, defer private renderers, reconcile current desired state before releasing their closures, and upgrade public controls without capability-signature remounts. Audit workspace/group chrome as well as pane contents for private names before opening the sync boundary.

Verification: new access/provenance/Reader/Search tests, full smoke, offline import graph/recovery, existing account isolation/client reliability, Reader search, and all 578 chapter index projection checks pass. Rendered local synthetic signed-in workspace on asset `20260923-private-presentation-v560` has two Readers, 25 initial concrete Search rows, zero loading slots and no browser errors after reload. Shell1203. The separate `research-trust-boundary-contract.mjs` fails on its unchanged iOS `research-composer-privacy-disclosure` assertion; that broader assertion is not claimed passing and was not changed as part of this web task.

## Public-first integration in progress

The current working tree wires the account/workspace access gate through both startup render paths. Reader and public Search can mount before sync; private constructors and workspace/group names wait for verified access. The stable gate upgrades existing public nodes after reconciliation. Render calls now resolve at shell readiness, with target-specific readiness for result navigation and other callers that need a completed pane. Superseded sync pulls follow the newest in-flight pull before authorizing presentation.

Current source verification: the expanded `npm run test:workspace-access` includes actual startup, private chrome and target navigation contracts and passes. Full `tests/smoke.mjs` passes. These do not establish final rendered acceptance. An intermediate controlled browser run proved public text, concrete results and result opening while sync was held, but exposed an authorization issue when one pull superseded another. Source regression tests now cover that correction; the final browser release-and-upgrade check must be repeated against the finished assets.

Before committing this integration: finish persistent gate subscription cleanup for discarded Reader/Search controls; reconcile the orchestration retry fixture with the actual Retry handler; synchronize the offline asset generation; repeat held-sync browser acceptance, denial/recovery and retained DOM/focus checks. PERF-11 remains in progress.

Follow-up browser evidence (isolated synthetic account, localhost8798): after clearing only the test session's service-worker caches and reloading current source, the held `/sync/pull` left four public panes with pending/denied presentation gates and three private loading shells; the synthetic Project name was absent. Releasing the held request changed all four gates to verified/allowed, rendered private content and removed all loading shells. All four captured public pane nodes remained connected; the same Search input retained focus and selection `[0,8]`. Browser errors were empty. This corrects the previously observed superseded-pull failure. Final asset-generation and subscription-lifecycle checks remain pending. The full pane-hydration suite and repaired Notebook/Report contract also pass.

### Final integration checks

Asset generation is now `20260923-public-startup-v561`, shell1204; offline import-graph and installer recovery tests pass. Node-owned gate subscriptions use one observer and weak owner references, with deterministic cleanup for detached live controls and explicitly discarded unpublished panes. The lifecycle contract removes 4,000 controls and verifies zero remaining records/listeners without relying on finalization. The expanded access suite, pane-hydration suite, Notebook/Report promotion, syntax and diff checks pass.

The isolated 8799 browser received a synthetic 403 for sync: its three public panels retained text, the private Project name stayed absent, and all three private shells offered Retry. Restoring successful responses and clicking the actual Retry button verified access, rendered private content and removed loading shells while retaining all three public panels. Browser errors were empty. See `PERF_11_PUBLIC_STARTUP_BROWSER_EVIDENCE_2026-09-23.json`. The final smoke rerun passes; rendered account transitions and the remaining plan requirements still need their final audit before marking PERF-11 complete.

### Follow-up corrections

Saved Project transitions now await the requested pane before querying or hydrating it. Stateful Notebook/Report/Workboard descriptors use their own capability dependencies, preventing unrelated capability changes from disposing dirty editors. Relevant revocation still replaces the private pane with its access-checked renderer. Concurrent initial Notebook/Saved foundation reads share one identity-scoped in-flight promise; success and failure both evict it, and later refreshes remain fresh. Actual-function regressions and workspace access/hydration suites pass. Asset generation workspace-followup-v562 / shell1205 passes offline checks. See PERF_11_ACCEPTANCE_REMAINING.md for the remaining rendered acceptance scope.

### Startup normalization and retry verification

A reproduced Reader race selected a default chapter while its fetch was pending, then treated the resolved chapter as a new pane identity when sync completed. The coordinator started twice and discarded one result. The correction preserves identity only for the internally resolved fields; explicit chapter/section changes still invalidate pending and completed loads. Actual selector/coordinator regression, navigation-race and scroll-continuity checks pass.

Report initial failures now provide Retry Report. On fresh asset v563 in the synthetic mixed browser, a forced reports HTTP503 displayed Retry; restoring responses and clicking it recovered the Report, retained all five neighboring panes and the same Notebook editor, and left zero loading shells. Failure/retry contracts cover account/workspace/disposal guards and double-click prevention. The scoped sequential foundation-sharing integration and account-transition browser acceptance remain underway.

Scoped initial foundation sharing now retains completed data until initial consumers finish, releasing canceled/unused leases and invalidating at mutation boundaries. v564 browser observation shows one early foundation request (75ms start, 135ms duration), replacing the earlier two; a later request around five seconds remains unattributed. Six panes finish with no loading shells. Offline/access/hydration checks pass. A separate native cross-tab A-to-B account switch, without reloading, removes A private content throughout 130 sampled mutations while B sync is held, then renders B empty Saved. See PERF_11_ACCOUNT_TRANSITION_BROWSER_EVIDENCE_2026-09-23.json for limits.

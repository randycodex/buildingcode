# PERF-11 — Independent workspace pane loading

Status: in progress. Dependency baseline and access/lifecycle audit completed; production rendering is not changed yet. Local preview on port8796 remains the PERF-10 implementation.

## Verified baseline

Run from the repository root:

```sh
node permitext-sync-server/scripts/profile-workspace-pane-loading.mjs
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

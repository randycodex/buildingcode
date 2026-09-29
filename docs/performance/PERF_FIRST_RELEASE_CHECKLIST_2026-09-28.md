# Proposed first-release performance and UX checklist

Date: September 28, 2026. Status: recommendation awaiting owner adoption; not a release authorization or a replacement for the full plan.

The owner asked which work matters most before first release. This checklist separates minimum release acceptance from the larger optimization backlog. The full [performance and UX plan](../PERMITEXT_PERFORMANCE_AND_UX_PRIORITY_PLAN_2026-09-22.md) remains incomplete. No remaining requirement is silently marked done or deferred by this proposal.

## Recommended execution order

### 1. Saved work, source identity and account safety — release blocker

- Verify Saved, including Unassigned, project assignment, Notes and available Report workflows survive relaunch and agree between iOS and web.
- Use a separately authorized synthetic account for writes, account switching, populated scenarios and failed-save recovery. Do not stress or delete owner data.
- Preserve exact edition, section identity, citation and permissions when reopening a saved result, following a reference or enabling a disabled source.
- Acceptance: persisted readback and rendered results after relaunch; no silent lost edits, wrong-edition passage, account leakage or false successful-save state.
- Existing evidence: local synthetic workspace save/recovery/assignment/Notebook reload checks and isolated PostgreSQL integration pass. This does not establish populated native or authenticated hosted acceptance. Those remain open.

### 2. Core iPhone performance — release blocker for substantial delays

- Finish the current41.32 Chapter16/33 trace analysis before asking for more unchanged chapter gestures.
- Verify launch to usable Reader, current/recent/unopened chapter, varied Search and result-detail opening. Distinguish tap-to-visible behavior from callbacks and profiled samples.
- Acceptance: correct content and position, responsive input, no reproducible severe freeze or stuck loading. Record actual timings and sample limits. A short gesture trace cannot prove entire-chapter or sustained-use smoothness.
- Existing evidence: startup Saved hydration stall fixed; prior varied Search/detail and named table/figure/definition checks exist.41.32 installed and launch-verified; owner confirmed chapter gestures; trace save failed with exit17 under severe host disk pressure; no usable timing trace was retained. Do not repeat before resolving recorder/storage constraints.
- Do not block release solely to improve a modest host microbenchmark or obtain unsupported p95 claims. Any proposed numeric release budget must be stated explicitly and tested before claiming it passed.

### 3. Sustained use and interruption — release blocker for crashes, lost state or stuck recovery

- One defined mixed-use physical session: chapters, varied Search, details, Saved and navigation, followed by background/foreground and a brief connectivity interruption.
- Capture memory/stall evidence with a bounded recorder and verify recovery/rendered state. Investigate reproducible growth, crashes, long stalls or lost position; normal cache growth alone is not proof of a leak.
- Acceptance: no crash, persistent loading, data loss or inaccessible prepared content; failures give accurate recovery guidance. Bound offline claims to supported surfaces; do not add offline Report as acceptance work.
- Remaining: representative physical sustained-use and recovery coverage. Do not substitute repeated concrete searches.

### 4. Web update and hosted integration — release blocker for broken existing sessions

- Correct the identified forced-worker-activation/cache-deletion risk for existing tabs. Test two controlled tabs, delayed lazy assets, interrupted update, recovery and natural cleanup without forced reload or loss of unsaved work.
- Inspect uncontrolled-document and first-install behavior explicitly; do not claim all multi-tab cases from a one-tab test or arbitrary retained-cache count.
- Verify the exact hosted release assets and one authorized signed-in workspace journey, including private response behavior.
- Existing evidence: local interrupted shell update/recovery and exact-byte hosted v605/shell1248 asset verification pass. Multi-tab issue is source-confirmed but not fixed. Authenticated hosted populated latency and Production acceptance remain open.

### 5. Essential UX and accessibility — release blocker when the task cannot be completed or the UI misleads

- Resolve incorrect saving/loading states, hidden or missing saved work, wrong context/edition, inaccessible primary controls and broken navigation.
- Perform a bounded check of readable controls, keyboard/focus behavior on web and native accessibility/text-size behavior for the core Reader/Search/detail path.
- Reuse existing successful checks unless related code changed. Cosmetic preferences, secondary panel polish and exhaustive variants are separate backlog items.
- Existing evidence: substantial local UX01–11 work and selected physical functional checks. Broader native accessibility and final distribution acceptance remain open.

### 6. Actual release candidate — final gate

- Identify reviewed source SHA, deployment, native version/build and intended release surface.
- Verify the intended TestFlight build and hosted web candidate; development installation and local tests are distinct evidence.
- Recheck the release-critical journey on those actual artifacts, retain rollback/recovery information and record known limitations.
- Merge, Production promotion and App Store submission require their own authorization. This checklist does not authorize them.
- This is scoped to the performance/UX plan; billing, legal, privacy, support and other release-readiness work require their own applicable checklist and are not certified here.

## Suggested post-release backlog — not yet an owner-approved blanket deferral

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

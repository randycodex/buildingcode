# Permitext bug audit (iOS + web)

**Branch reviewed:** `codex/New-Changes` (`322a12e4`)
**Remediation branch:** `main` (work began at `24c91d08`)
**Workspace:** `/Users/randy/Documents/X_CODING/Building Code`
**Date:** 2026-07-25
**Scope:** iOS app (`NYC CC APP/permitext/`) and web/backend (`permitext-sync-server/`)
**Current validation:** the calibrated P0/P1 fixes and the selected P2/P3 remediation described below are implemented locally. `npm run check` and `npm run smoke` pass. An iOS `EntitlementAndSyncContractTests` run passed 17 tests, including the account-wide counts and core StoreKit/backend cases; the current app and final added tests build, but a later focused rerun was canceled when the simulator shut down before XCTest launched. PostgreSQL integration was requested but skipped because no database URL is configured. Nothing in this audit proves GitHub, production execution of the new SQL, deployment state, or App Store configuration.

Severity:

- **Critical:** demonstrated ship, data-integrity, or billing blocker.
- **High:** demonstrated correctness or cost-control defect that should be fixed before broad release.
- **Medium:** real reliability, compatibility, or incomplete-product behavior with narrower reach.
- **Hardening / policy:** worthwhile defense or explicit design decision, but not a demonstrated current exploit or independent production failure.

Passing contract and smoke tests do not disprove an untested ordering, concurrency, or client-runtime defect.

---

## Critical

### 1. iOS: a queued delete can be consumed before it uploads

**Platforms:** iOS → server truth
**Status:** fixed locally; regression-tested for a queued bookmark delete, older live server state, newer competing server state, and server tombstone handling

Local bookmark, note, Project, and Project-membership deletions hard-remove their SQLite rows and enqueue delete mutations. Automatic sync then pulls before pushing.

If that pull contains the still-live server record—for example after a checkpoint reset, a full pull, or a newer server event—the merge path behaves as follows:

1. The deleted row no longer exists.
2. `localMergeCandidate` does not consult ordinary pending delete queue entries.
3. The resolver treats the record as “missing locally” and selects `applyServer`.
4. The live server record is inserted locally.
5. `discardQueuedMutation` marks the matching queued delete as synced without uploading it.

An ordinary incremental pull with no matching server event will not reproduce this every time; the defect is an ordering-dependent resurrection, not a guarantee that every deletion fails.

**Impact:** A deletion can reappear on the same device and never reach the server.

**Implemented**

- Pending per-record queue mutations now participate in merge-candidate construction even after a local row was hard-deleted.
- An older live server record leaves the queued delete in place for upload; a newer live server record becomes an explicit conflict.
- Server tombstones use the normal `applyServer` path instead of sharing an overloaded delete action.
- Deterministic SQLite-backed coverage proves the bookmark resurrection path. Note, Project, and Project-membership matrix expansion remains worthwhile.

**Primary evidence**

- `UserDataStore.toggleBookmark`, note deletion, and Project deletion hard-remove rows and queue deletes.
- `CodeLibraryViewModel.performAutomaticUserContentSync` pulls before pushing.
- `UserDataStore.localMergeCandidates` derives ordinary candidates from rows, not queued per-record deletes.
- `UserContentMergeResolver.decision` applies a server record when the local row is missing.
- `UserContentSyncEngine.applySafeRemoteChanges` discards queued mutations after `applyServer`.

---

### 2. Web: Stripe checkout can create or restore Pro without an expiry

**Platforms:** Web / billing
**Status:** fixed locally; contract and smoke coverage pass

`checkout.session.completed` persists a Pro entitlement without `expiresAt`. `hasActiveProEntitlement` treats an absent or invalid expiry as indefinitely active.

This has two failure modes:

- A completed subscription checkout can grant Pro before a dated subscription lifecycle event is processed.
- A delayed or retried checkout event can arrive after `customer.subscription.updated` and replace a dated entitlement with an undated one.

The checkout condition also accepts every `mode === "subscription"` completion regardless of `payment_status`.

**Impact:** Billing bypass or stale Pro access; legacy Research inclusion rules can amplify the entitlement.

**Implemented**

- Checkout grants only a completed subscription with `paid` or `no_payment_required` status.
- Checkout creates a 15-minute provisional entitlement rather than an undated grant.
- Same-subscription updates preserve the later known expiry, and Stripe event timestamps prevent an older event from replacing newer provider state.
- Unpaid checkout and delayed/out-of-order entitlement cases are covered. Full duplicate/cancel/delete order permutations remain useful integration coverage.

**Primary evidence**

- `permitext-sync-server/app.mjs`: `checkout.session.completed`
- `permitext-sync-server/entitlement-contract.mjs`: `hasActiveProEntitlement`
- `entitlementWithPackage` omits `expiresAt` when the caller supplies none.

---

## High

### 3. iOS: backend lifetime Pro can be cleared by the local grant lookup

**Status:** fixed locally

`applyBackendEntitlement` does not preserve `.lifetimeGrant` when a later backend response is nil or non-Pro. More directly, the normal sign-in flow applies the backend entitlement and later calls `refreshLifetimeGrant`. Its default `LocalLifetimeGrantLookupClient` returns no grant in release builds, so a currently applied lifetime grant can be cleared immediately.

Cached web Pro should not automatically override authoritative backend revocation, so “web Pro must always be preserved” is not the correct fix.

**Impact:** A valid backend lifetime user can appear Free on iOS.

**Implemented**

- Release-mode local lookup results are explicitly non-authoritative and cannot clear a backend lifetime grant.
- Debug lookup remains authoritative for local grant testing.
- The denial-authority contract is covered; the full sign-in/account-switch matrix remains future integration coverage.

---

### 4. Web: Research monthly quota is check-then-spend

**Status:** fixed locally; production PostgreSQL execution still needs deployment verification

The Research message path reads monthly usage, checks the limit, performs the paid OpenAI call, and only then inserts usage. Concurrent requests can all pass the same check.

The per-process IP rate limiter reduces some abuse but does not make the monthly account quota atomic across tabs, instances, or regions.

**Impact:** Paid model spend can exceed the configured monthly account limit.

**Implemented**

- PostgreSQL reserves a usage row with a serializable conditional insert and serialization retries before the model call.
- File storage serializes reservation operations per account within the local process.
- Successful calls convert the reservation into usage; failures release it; stale crash reservations stop consuming allowance after 15 minutes.
- A live PostgreSQL parallel-boundary test remains necessary before calling the production behavior verified.

---

### 5. PostgreSQL sync rejections omit reason codes

**Status:** fixed locally; pure reason classification is covered and the server suite passes

The PostgreSQL repository returns accepted and rejected IDs but no `rejectionReasons`. The file-store path returns proper plan-limit codes. Web and iOS clients fall back to generic “server has newer data” conflict messaging.

This affects all PostgreSQL rejection causes, not only Free-plan quota failures.

**Impact:** Users cannot distinguish a plan limit from a last-write-wins conflict, and recovery/upgrade guidance is wrong.

**Implemented**

- The PostgreSQL transaction captures rejection context and returns a reason for every rejected mutation.
- Quota, Pro-required capability, ownership, stale-server, equal-timestamp, and generic rejection codes are distinguished.
- Contract coverage proves quota, stale-write, and ownership classification. Live PostgreSQL and rendered-client coverage remain follow-ups.

---

## Medium

### 6. PostgreSQL compatibility-store reads omit Workboards

**Status:** fixed locally; source-contract and server smoke coverage pass, while a live PostgreSQL deployment check remains necessary

`readNormalizedStore` reconstructs saved items, annotations, Projects, Project items, continuity, and clear mutations, but omits Workboards. Normal PostgreSQL sync pull uses the dedicated sync repository and can still return Workboards; the defect is narrower than general Workboard sync failure.

Compatibility helpers such as `userContentMutations`, Workboard-target existence checks, legacy migration, and some asset-scope checks can therefore see an incomplete view.

The PostgreSQL comments table is also absent from this compatibility read, but comment mutations are not currently accepted by `allowedMutationKinds`; that is a separate unfinished surface rather than a completed sync contract.

**Implemented**

- PostgreSQL normalized compatibility reads now include `workboard` records.
- Smoke coverage protects the compatibility query from dropping Workboards again.

### 7. File-store mutations use unlocked read-modify-write

The JSON file adapter performs `readStore` → merge → `writeStore` without inter-process or cross-request locking. Concurrent requests can overwrite one another.

This is a real defect for any deployment using file storage. Its production severity is conditional because the shared production architecture is expected to use PostgreSQL; local JSON storage should not be treated as phone↔web production proof.

### 8. iOS Free counters are scoped per code version

**Status:** fixed locally; SQLite-backed two-code-version regression coverage passes

iOS checks saved-section and note limits with `WHERE code_version = ?`, allowing 25 saves and 10 notes in each code package. Server enforcement counts across the account.

**Impact:** iOS can allow an action that PostgreSQL later rejects. Align the client preview count with the server account-wide contract.

**Implemented**

- The iOS user-content repository now exposes account-wide saved-section and non-empty-note totals.
- Free-plan decisions use those totals while code-specific reader counts remain available for their original UI purposes.
- Regression coverage proves 24 + 1 saved sections and 9 + 1 notes across two code versions reach the account-wide limit.

### 9. Legacy SQLite FTS passes raw user syntax to `MATCH`

The legacy SQLite search path binds the raw query directly to FTS `MATCH`. Operators, quotes, punctuation, or malformed FTS syntax can throw; the view model converts that failure into empty results.

The authored-content search path is primary, so this is a legacy compatibility defect.

### 10. Deep-link code selection depends on a numeric ID threshold

iOS selects Zoning when `sectionID >= 20_000_000` and Construction Codes otherwise. That matches the current ID namespace but is an undocumented coupling.

Prefer canonical metadata in the link or resolve the section ID through the server/content map.

### 11. `setVerifiedPlan(.pro)` can replace package metadata

**Status:** fixed locally; focused entitlement metadata and StoreKit-fallback tests pass

StoreKit verification writes `.appleSubscriptionPro` as the complete local entitlement. That can temporarily remove package, add-on, legacy-Research, and provider fields from a previously stored backend entitlement.

Preserve verified StoreKit state separately from the backend package record, then resolve capabilities without overwriting either source.

**Implemented**

- StoreKit verification persists only the verified Apple plan.
- Backend entitlement records remain separately encoded with their package, provider, granted-user, and add-on metadata intact.
- Capability resolution prefers an active authoritative backend record and falls back to verified Apple Pro when no active backend Pro grant exists.

### 12. Rate limits are advisory rather than distributed controls

Rate-limit buckets are in-memory per process and key by the first `X-Forwarded-For` value. They reset across instances and deployments and depend on the hosting proxy sanitizing the header.

Use account-aware, distributed controls for billing, authentication, and administrative endpoints. Keep the in-process limiter as a secondary defense.

### 13. Report APIs do not consistently use Project storage ownership

**Status:** fixed locally; shared Editor/Reviewer smoke coverage passes

Several Report draft/generate paths resolve `ownedProjectRecord(context.userID, projectID)` and persist under the personal caller rather than using `requireProjectPermission` plus `access.storageOwnerUserID`.

**Impact:** Organization members can be denied valid shared-project behavior or create fragmented personal artifacts.

**Implemented**

- Report sources, Drafts, history, manifests, generated files, and activity resolve the caller's Project permission.
- Reads and writes use the Project's stable `storageOwnerUserID` and organization owner scope.
- Reviewers can read and download; Editors can create organization-owned Drafts; unauthorized mutation returns the Project-permission error.

### 14. Workboard upload/delete authorization is not aligned with Organization ACLs

**Status:** fixed locally; shared Project read/write/deny smoke coverage passes

Workboard read uses Project permission and storage-owner resolution, while upload/delete still rely on personal `ownsProjectAssetScope` checks.

Align all three operations with the same Project access object, permission, and `storageOwnerUserID`.

**Implemented**

- Preview and image mutations require Project edit permission and use the Project's storage owner.
- Organization Editors can publish a preview that the Owner sees; Reviewer mutation is denied.
- The legacy personal Workboard asset scope remains supported for a drawing created before its Project record exists.

### 15. Organization seat and duplicate-invite checks can race

**Status:** fixed locally for invitation reservation, acceptance, revocation, and reactivation; live PostgreSQL concurrency still needs deployment verification

Seat usage and duplicate invitation checks occur before invitation persistence without one serializable operation or uniqueness constraint. Concurrent invitations can reserve more seats than allowed or create duplicate active invitations.

Acceptance and member-reactivation paths should use the same transactional seat ledger.

**Implemented**

- PostgreSQL uses serializable transactions plus an organization-scoped advisory lock for invitation reservation, invitation state changes, acceptance, and seat-bound reactivation.
- The local file adapter mirrors the organization lock within one process.
- Smoke coverage races duplicate invitations, final-seat reservations, and repeated acceptance of one token.

### 16. File-store sessions are reused on re-login

The file path uses `existingSession || randomUUID()`, so a new sign-in does not rotate the token. PostgreSQL creates a new hashed, expiring session.

Rotate file-store tokens on every successful sign-in or explicitly label file auth as development-only.

### 17. Upgrade copy contradicts the Free entitlement contract

**Status:** fixed locally; a copy regression test is added and builds, but its focused simulator execution was canceled before XCTest launched

Free enables continuity and cross-device sync, and Settings explains that correctly. `professionalWorkspaceRequirement` still says:

> Upgrade to Pro to unlock unlimited saved work, PDF export, tags, continuity, and cross-device sync.

Remove continuity and cross-device sync from that Pro-only message.

The corrected message names unlimited saved work and notes, Projects, professional exports, tags, and offline access without presenting Free continuity or cross-device sync as paid features.

### 18. Prepared section-body coverage is incomplete

Current content-integrity result:

| Measure | Count |
|---|---:|
| Chapters | 118 |
| Published/indexed sections | 12,891 |
| Prepared section bodies | 10,371 |
| Missing prepared bodies | 2,520 (19.55%) |
| Referenced images | 248 |
| Known duplicate display keys | 8 |

This is specifically **prepared canonical section-body coverage**. It does not mean 19.55% of reader entries necessarily render blank: chapter HTML provides broader rendered coverage, and some catalog entries are title-only or nested structural entries.

The gap matters for structured section detail, Research eligibility, rich snippets, and any feature that promises an independently addressable canonical body. Product copy should not imply complete structured-body coverage until the gap is closed.

---

## Hardening, policy decisions, and intentional asymmetries

These are useful follow-ups, but the current evidence does not support presenting them as independent High-severity production failures.

### A. The `deleteLocal` merge action is overloaded

The resolver uses `deleteLocal` for both:

- “the local deletion should remain and upload,” and
- “the server tombstone should delete the local record.”

Applying the incoming server mutation is correct for the second case and wrong for the first. Current local delete paths hard-remove rows, so the first branch is not demonstrated as a separate normal production path.

Split the action into `applyServerDelete` and `keepLocalDeleteAndUpload`, cover both in tests, and treat this as part of Critical finding #1 rather than a second P0.

### B. WKWebView cleanup and navigation policy

`ChapterHTMLWebView` enables JavaScript for reader behavior, loads local bundled HTML, has no explicit navigation allowlist, and does not remove script message handlers in `dismantleUIView`. `TableWebView` dismantles but also has no navigation policy.

Add cleanup, cancel the HTML load task, nil delegates, remove handlers, and restrict top-level navigation to expected local URLs. These are sound defenses, but local trusted content plus missing teardown does not by itself prove an exploitable navigation issue or retained-memory leak.

### C. Continuity uses whole-snapshot last-write-wins

The merge resolver performs last-write-wins for the continuity record. Applying that winning record then replaces recent searches and recently viewed arrays wholesale rather than merging individual entries.

This can lose activity from another device, but it is more accurately described as a snapshot-merge policy than “no LWW.” Decide explicitly whether continuity is a device snapshot or a convergent per-entry history.

### D. SQLite durability/concurrency pragmas are minimal

`SQLiteConnection` enables foreign keys but not WAL or `busy_timeout`, and `UserDataStore` is not itself an actor. Most use is practically serialized through the `@MainActor` view model, so concurrent corruption is not demonstrated.

WAL, a busy timeout, and an explicit repository executor/actor would still make the concurrency contract safer and clearer.

### E. Private local asset helpers lack central containment enforcement

`join(root, pathname)` would escape the configured local root if handed `..` segments. Current Report and Workboard-preview write paths generate hashed server paths, and stored artifacts are the normal read source, so a reachable client-controlled traversal was not demonstrated.

Centralize pathname validation and verify `resolve(root, pathname)` remains under `resolve(root)` before every local read/write/delete. Do not rely only on caller-specific prefix checks.

### F. Equal timestamps with different PostgreSQL bodies are rejected

PostgreSQL accepts an equal timestamp only when the mutation body is identical. Treating equal timestamps with different bodies as a conflict is conservative and defensible; it is not automatically a bug.

Return an explicit `EQUAL_TIMESTAMP_CONFLICT` reason and provide a deterministic retry/resolution path.

### G. Administrative bearer comparisons are not timing-safe

Admin bearer tokens are compared with ordinary JavaScript string equality or `includes`. A length-checked `timingSafeEqual` helper is better hygiene, although remote timing exploitation is not demonstrated.

### H. Other acknowledged asymmetries

- Workboards and Research are web-only; iOS intentionally ignores Workboard application.
- iOS keeps local navigation when applying continuity and only accepts shared activity fields.
- Service-worker `/web/*` caching is cache-first; application assets use query-string versioning.
- Browser sessions live in `localStorage`, so XSS would expose them.
- Code HTML uses `innerHTML`; CSP and local content provenance are important controls.
- Root `README.md` and parts of `IOS_APP_CONTEXT.md` remain stale.
- Git contains the malformed remote-tracking ref `refs/remotes/origin/codex/New-Changes 2`.

---

## What looks solid

- Server-side Free-plan enforcement exists in both contract logic and PostgreSQL quota predicates.
- Free limits are consistently presented as 25 saved sections and 10 notes, apart from the iOS per-code counting defect.
- Pro CTA price formatting is covered by tests.
- Stripe return URLs are same-origin constrained.
- Apple OAuth fails closed when required secrets are absent and verifies nonce state.
- Stripe restore ownership uses authenticated Permitext identity rather than billing email.
- Static/code asset path segments are restricted.
- Content integrity verifies every published ID is indexed and protects the currently promised prepared-body floor.
- Research evaluation tooling keeps paid runs behind explicit key, pricing, and spend-cap interlocks.

---

## Recommended fix order

| Priority | Work |
|---|---|
| **P0** | iOS pending-delete resurrection; Stripe checkout expiry/order handling |
| **P1** | Backend lifetime-grant authority on iOS; atomic Research quota reservation; PostgreSQL rejection reasons |
| **P2** | Completed locally: PostgreSQL Workboard compatibility, account-wide iOS Free counts, Organization Report/Workboard storage ownership, and transactional seat enforcement |
| **P3** | Completed locally: StoreKit entitlement separation and copy correction. Remaining: file-store locking/session rotation, distributed rate limits, and deep-link metadata |
| **Hardening/content** | WKWebView teardown/navigation; SQLite pragmas; local path containment; continuity merge policy; timing-safe admin compare; prepared-body expansion; stale docs |

---

## Remaining regression expansion after the local P0/P1 fixes

### iOS

- Delete a previously synced bookmark, note, Project, and Project membership.
- Exercise incremental pull, full pull, reset checkpoint, and a newer competing server upsert.
- Prove the delete either uploads or becomes an explicit user-visible conflict; it must never be silently discarded.
- Apply backend lifetime Pro through sign-in, StoreKit refresh, pull, foreground sync, sign-out, and account switch.

### Web/backend

- Deliver Stripe subscription events in every relevant order, including duplicate checkout, delayed checkout, unpaid/incomplete checkout, updated, canceled, and deleted.
- Prove an undated event cannot replace a dated subscription entitlement.
- Send parallel Research requests at the monthly boundary and prove only the reserved allowance reaches the model call.
- Exercise PostgreSQL quota, stale-write, equal-timestamp, ownership, and validation rejections and assert their reason codes.

---

## Validation posture

- `npm run check` — passed after the fixes; no paid model calls were made.
- `npm run smoke` — passed after rebuilding both web clients; no paid model calls were made.
- iOS `EntitlementAndSyncContractTests` — 17 tests passed on an iPhone 17 simulator, including the SQLite-backed pending-delete and account-wide Free-count regressions plus the two core StoreKit/backend separation cases. The current target and later copy/debug-precedence tests build, but a focused rerun was interrupted after the simulator shut down before XCTest launched; this is not counted as a test pass.
- PostgreSQL integration — requested but skipped because no database URL is configured; the new organization transaction SQL remains unverified against a live database.
- Content integrity — passed: 118 chapters, 12,891 indexed sections, 10,371 prepared bodies, 248 referenced images, 8 duplicate display keys.
- Live PostgreSQL concurrency and production webhook delivery were not exercised locally.

---

## Key file anchors

| Concern | Path |
|---|---|
| iOS entry / sync lifecycle | `NYC CC APP/permitext/PermitextApp.swift` |
| Pull-before-push + entitlement application | `NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift` |
| Entitlements + merge resolver | `NYC CC APP/permitext/Models/CodeModels.swift` |
| Hard deletes + merge candidates | `NYC CC APP/permitext/Data/UserDataStore.swift` |
| Sync application + continuity | `NYC CC APP/permitext/Diagnostics/Signposts.swift` |
| HTML reader / WKWebView | `NYC CC APP/permitext/Views/ChapterHTMLWebView.swift` |
| SQLite wrapper | `NYC CC APP/permitext/Data/SQLiteSupport.swift` |
| iOS entitlement tests | `NYC CC APP/permitextTests/EntitlementAndSyncContractTests.swift` |
| API monolith | `permitext-sync-server/app.mjs` |
| Entitlement contract | `permitext-sync-server/entitlement-contract.mjs` |
| PostgreSQL sync | `permitext-sync-server/postgres-sync-repository.mjs` |
| PostgreSQL accounts | `permitext-sync-server/postgres-account-repository.mjs` |
| PostgreSQL organizations | `permitext-sync-server/postgres-organization-repository.mjs` |
| Web SPA | `permitext-sync-server/public/app.js` |
| Service worker | `permitext-sync-server/public/service-worker.js` |

---

## Related handoffs

- `PERMITEXT_CROSS_PLATFORM_REVIEW_HANDOFF.md` — broader review, partially outdated relative to this branch.
- `PERMITEXT_AI_EVALUATION_REVIEW_HANDOFF.md` — Research evaluation and content-integrity context.

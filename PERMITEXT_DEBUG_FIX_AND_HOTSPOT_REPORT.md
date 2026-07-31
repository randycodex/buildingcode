# Permitext Debug, Reliability, Security, and Performance Hotspot Report

Audit date: 2026-07-31

Repository: `Building Code`

Starting commit: `ea2baf79f`
Audit result: 36 supported findings; 24 fixed; 12 documented for architectural, product-policy, or external-infrastructure follow-up. All three Critical findings and 13 High findings were fixed. Five High findings remain blocked on schema/architecture work that cannot be safely validated in this checkout.

## 1. Architecture summary

Permitext has two active clients and one shared HTTP/data service:

- The native iOS/iPadOS app is the SwiftUI target under `NYC CC APP/permitext`. Published code content is bundled under `Resources/CodeContent`; user content, the durable sync queue, conflict state, and local search state use SQLite. Authentication state uses Keychain, StoreKit supplies native subscription state, and the client exchanges incremental mutations with the backend.
- The web app is the PWA shell under `permitext-sync-server/public`. It uses the service worker and Cache Storage for the shell/code assets, IndexedDB for installed code libraries and other offline state, and HTTP APIs for identity, sync, Research, Projects, Notebook, Workboards, attachments, and Reports. The React/Excalidraw Workboard is built from `permitext-sync-server/src`; Notebook is a separately built client asset.
- `permitext-sync-server/app.mjs` is the Node HTTP application used locally and by Vercel. It owns authentication/authorization, sync validation, billing reconciliation, Research/AI calls, project/foundation artifacts, report generation, and private-asset access. Local development can use the JSON-backed adapter; production health reports the normalized Neon PostgreSQL adapter. Private project/report binaries use configured Vercel Blob storage.
- The synchronization boundary is record-oriented. Web and iOS persist local edits first, queue mutations, push authenticated batches, pull by a server event checkpoint, and reconcile tombstones/conflicts. Foundation artifacts (Notebook, project notes, reviews, drafts, Workboards, Reports, and Research records) use separate project-scoped APIs and version metadata.
- Deployment targets are Vercel for the web/API service and App Store/TestFlight builds for the native app. The production endpoint checked during this audit was `https://permitext-sync.vercel.app`.

The review traced representative flows across UI, client persistence, API validation, repository writes, offline caches, billing state, Research state, file storage, and tests. No confirmed cross-user IDOR was found in the private Workboard/report paths reviewed; those paths perform authentication, project permission, and stored project/path checks.

## 2. Baseline status

The initial worktree already contained unrelated, untracked work. It was not staged or committed by this audit: `PERMITEXT_DESIGN_IMPROVEMENTS.md`, `PERMITEXT_WEB_PERFORMANCE_AUDIT.md`, and notebook output copies.

| Check | Baseline result |
| --- | --- |
| Server source/contracts | `npm run check` passed in 13.78 s. |
| Server smoke/build | `npm run smoke` passed in 19.64 s, including production Workboard and Notebook builds. |
| iOS tests | Full configured iOS test run passed 25/25. Test execution was 1.333 s; end-to-end command wall time was about 212 s because of simulator/build startup. |
| iOS launch diagnostic | Bundle parse 71 ms; first usable state 469 ms in the test diagnostic. |
| iOS warnings | One unnecessary `await` warning in `CodeLibraryViewModel.swift`. |
| Dependencies | `npm audit --omit=dev --audit-level=high` reported zero vulnerabilities. |
| Secrets | Targeted tracked-file scan found no committed credentials. Local `.env` data remained ignored and was not printed or committed. |
| Database integration | No database URL was configured, so real PostgreSQL integration/query-plan validation was unavailable. |

Baseline bundle evidence:

- Workboard entry: 1,000.39 kB raw / 267.31 kB gzip.
- Largest Workboard dependency chunk: 1,834.86 kB raw / 746.01 kB gzip.
- Workboard CSS: about 252.8 kB raw / 106.25 kB gzip.
- Notebook entry: 368.92 kB raw / 98.83 kB gzip.
- Static Workboard JavaScript graph measured by the web audit: 1,697,388 bytes raw / 470,040 bytes gzip.

The baseline Vite Notebook build exposed a destructive build defect: its `emptyOutDir: true` removed an unrelated untracked `notebook 3.js`. The file was restored immediately from the current tracked `notebook.js`, but its exact pre-build bytes could not be proven after deletion. The build configuration was then fixed and byte-preservation contracts were added before further builds.

## 3. Completed fixes

### F-001 — Notebook build deleted unrelated output files

- **Severity / area:** Critical, build/data preservation.
- **Root cause and impact:** the Notebook Vite build emptied its shared output directory. A normal smoke build could delete untracked or parallel notebook artifacts.
- **Correction / files:** disabled output-directory clearing in `permitext-sync-server/vite.notebook.config.js`; added `permitext-sync-server/tests/build-output-contract.mjs` and wired it into `package.json`.
- **Tests and validation:** the contract seeds sibling files, runs the build, and verifies their bytes remain unchanged. The real `notebook 2.js`, `notebook 3.js`, and `notebook 4.js` hashes remained identical through later `check` and `smoke` runs.
- **Commit / residual risk:** `b32a66e47`. Shared output naming can still be confusing, but builds no longer erase siblings.

### F-002 — Failed Workboard save could overwrite a newer pending edit

- **Severity / area:** Critical, web Workboard data loss.
- **Root cause and impact:** failure recovery unconditionally restored the in-flight board into `pendingBoard`, replacing a newer edit queued while the request was running.
- **Correction / files:** extracted newest-pending preservation in `src/workboard-reliability.js` and used it in `src/workboard.jsx`.
- **Tests and validation:** `tests/workboard-reliability-contract.mjs` exercises the failed-old-save/newer-pending race; full smoke and production Workboard build passed.
- **Commit / residual risk:** `795415abb`. Server-side Workboard revisions remain an unresolved item (U-006).

### F-003 — Notebook conflict handling discarded the local draft

- **Severity / area:** Critical, web Notebook data loss.
- **Root cause and impact:** `NOTEBOOK_VERSION_CONFLICT` replaced the editor document with the remote card and cleared `dirty`, silently losing the user's unsaved draft.
- **Correction / files:** `public/client-reliability.js` now preserves local title/document content while adopting current remote version metadata; `public/app.js` keeps the draft dirty for review/retry.
- **Tests and validation:** `tests/web-client-reliability-contract.mjs` verifies draft preservation and version adoption; `npm run check` and `smoke` passed.
- **Commit / residual risk:** `795415abb`. True repository-level CAS is still required for all foundation artifacts (U-002).

### F-004 — Stale cached entitlement could delete valid offline content at startup

- **Severity / area:** High, web offline reliability.
- **Root cause and impact:** startup performed destructive feature reconciliation before the authoritative sync response. An expired or missing cached entitlement could erase the offline database/caches even after a server-side renewal.
- **Correction / files:** `public/app.js` defers destructive revocation until authoritative entitlement reconciliation succeeds.
- **Tests and validation:** offline/source contracts assert the startup ordering; full web check/smoke passed.
- **Commit / residual risk:** `795415abb`. A real browser interruption test should remain part of release QA.

### F-005 — Neon transaction isolation options were silently ignored

- **Severity / area:** High, backend concurrency/data integrity.
- **Root cause and impact:** production code used `isolationMode`, while the installed Neon API accepts `isolationLevel`. Research quota, sync checkpoint, account merge/claim, and organization transactions therefore ran without the intended isolation guarantees.
- **Correction / files:** replaced every occurrence in `app.mjs`, `postgres-account-repository.mjs`, `postgres-organization-repository.mjs`, and `postgres-sync-repository.mjs` while retaining serialization retries.
- **Tests and validation:** `tests/backend-performance-contract.mjs` asserts the actual option values and rejects any remaining `isolationMode`. Server check/smoke passed.
- **Commit / residual risk:** `8d4410317`. A live PostgreSQL concurrency suite could not run without a database URL.

### F-006 — iOS production sync conflicts became invisible after retries

- **Severity / area:** High, iOS sync/data integrity.
- **Root cause and impact:** the UI recognized one obsolete English phrase, while production returns `SERVER_NEWER` and `EQUAL_TIMESTAMP_CONFLICT`. After retry exhaustion, records could appear synchronized while stranded.
- **Correction / files:** `Diagnostics/Signposts.swift` persists rejection codes in the existing `last_error` column and recognizes current codes/messages plus legacy messages.
- **Tests and validation:** `EntitlementAndSyncContractTests.testSyncConflictErrorsRecognizeProductionCodesAndLegacyMessages` covers both production codes and compatibility text; 29/29 targeted iOS tests passed.
- **Commit / residual risk:** `f293a194f`. Conflict resolution still needs user action; the fix makes that state durable and visible.

### F-007 — StoreKit ignored expiration/revocation updates for known products

- **Severity / area:** High, iOS billing/authorization.
- **Root cause and impact:** “tracked” meant currently active, so verified updates for known but revoked/expired transactions were neither finished nor used to recompute entitlement. Pro state could remain stale during the session.
- **Correction / files:** `Models/CodeModels.swift` separates known-product ownership from active entitlement, finishes verified known transactions, and always recomputes the snapshot.
- **Tests and validation:** `testStoreKitTransactionPolicyTracksInactiveOwnedProducts`; targeted iOS tests and Release build passed.
- **Commit / residual risk:** `f293a194f`. StoreKit sandbox/device verification remains a release responsibility.

### F-008 — Invalid Release backend configuration failed open to ephemeral storage

- **Severity / area:** High, iOS configuration/data loss.
- **Root cause and impact:** a missing/malformed production endpoint could select an in-memory backend that simulated successful account/sync operations and lost them on relaunch.
- **Correction / files:** `Models/CodeModels.swift` now requires HTTPS in Release and selects a deliberately invalid HTTP transport on invalid configuration. Debug retains localhost HTTP support.
- **Tests and validation:** `testReleaseBackendURLPolicyFailsClosed`; targeted tests plus a code-signing-disabled Release simulator build passed.
- **Commit / residual risk:** `f293a194f`. Distribution archive and App Store configuration still require external release validation.

### F-009 — Clock skew could replace newer unsynced Workboard state

- **Severity / area:** High, web Workboard/offline sync.
- **Root cause and impact:** startup chose local versus remote solely by device timestamps. A clock-skewed device could lose newer unsynced local work.
- **Correction / files:** `src/workboard-reliability.js` and `src/workboard.jsx` prefer local boards lacking `syncedAt`; timestamp comparison remains only for already-synced state.
- **Tests and validation:** Workboard reliability contract covers skewed unsynced and synced cases; smoke/build passed.
- **Commit / residual risk:** `795415abb`. Server CAS is still needed (U-006).

### F-010 — Shell cache rotation erased installed offline figures

- **Severity / area:** High, web offline data availability.
- **Root cause and impact:** downloaded code figures shared the versioned shell cache, which activation deletes on every shell generation. IndexedDB could still claim the library was installed while assets were gone.
- **Correction / files:** `public/offline-storage.js` and `public/service-worker.js` now use a stable, asset-versioned code-asset cache independent of the shell generation.
- **Tests and validation:** `tests/offline-contract.mjs` verifies cache separation/preservation and full smoke passed.
- **Commit / residual risk:** `795415abb`. Browser quota eviction remains possible and should be surfaced as an availability error.

### F-011 — Section lookup rebuilt a large map on every request

- **Severity / area:** Medium, backend code-library performance.
- **Root cause and impact:** the section endpoint rebuilt a combined map of more than 18,000 published sections for each lookup.
- **Correction / files:** `app.mjs` memoizes the immutable combined catalog; `tests/backend-performance-contract.mjs` asserts referential reuse and canonical lookup.
- **Tests and validation:** 250 sequential `/code/sections/11909` requests improved from 3.873 ms/request to 1.612 ms/request; check/smoke passed.
- **Commit / residual risk:** `d0a4fc568`. Cold catalog construction still occurs once per process.

### F-012 — PostgreSQL sync push repeated final-state reads

- **Severity / area:** Medium, backend sync/database performance.
- **Root cause and impact:** the write transaction queried event cursor and entitlement, then the repository queried both again after mutation completion.
- **Correction / files:** `postgres-sync-repository.mjs` removes the duplicate in-transaction reads while keeping the authoritative final read; contract updated.
- **Tests and validation:** fake-SQL contract proves four write statements plus two final-state statements instead of six plus two, and verifies returned cursor/entitlement.
- **Commit / residual risk:** `d0a4fc568`. Real query latency and plans require a configured PostgreSQL database.

### F-013 — Malformed sync identifiers were coerced into valid record keys

- **Severity / area:** High, backend input validation/data integrity.
- **Root cause and impact:** canonicalization converted arrays, objects, numbers, and extremely long IDs to strings. Authenticated malformed mutations were accepted and could create ambiguous/polluting keys.
- **Correction / files:** `app.mjs` validates pre-canonicalized IDs as nonempty strings no longer than 512 characters; smoke coverage was added.
- **Tests and validation:** before the fix, object/array/number/10,000-character IDs returned HTTP 200; afterward the smoke suite asserts rejection.
- **Commit / residual risk:** `c52d2dca4`. Existing malformed historical records, if any, need a production data audit.

### F-014 — Future-dated sync records could permanently pin a record

- **Severity / area:** High, backend sync/data integrity.
- **Root cause and impact:** any parseable client timestamp was accepted. A year-9999 mutation became permanently “newer” than normal edits.
- **Correction / files:** `app.mjs` rejects mutation timestamps more than 24 hours ahead.
- **Tests and validation:** `tests/smoke.mjs` posts a year-9999 record and requires HTTP 400; full smoke passed.
- **Commit / residual risk:** `8d4410317` (implementation) and `795415abb` (integrated smoke assertion). Server-assigned revisions would be stronger than bounded wall clocks.

### F-015 — Expiring the Apple Research add-on falsely reported that Pro vanished

- **Severity / area:** Medium, backend billing response consistency.
- **Root cause and impact:** persistence correctly removed only Research, but the inactive-transaction response returned `entitlement: null` whenever any package removal succeeded.
- **Correction / files:** `app.mjs` computes and returns the remaining package state.
- **Tests and validation:** `tests/billing-contract.mjs` verifies Pro remains while Research is removed; check/smoke passed.
- **Commit / residual risk:** `8d4410317`. End-to-end StoreKit server notification testing needs Apple sandbox credentials.

### F-016 — Legacy iOS session tokens could remain in UserDefaults

- **Severity / area:** High, iOS credential privacy.
- **Root cause and impact:** fallback account decoding could continue using a plaintext legacy token without migrating it to Keychain.
- **Correction / files:** `CodeLibraryViewModel.swift` migrates to Keychain during load and rewrites the sanitized account only after Keychain save succeeds; token save now reports success.
- **Tests and validation:** `testSignedInAccountPersistenceRemovesLegacySessionToken`; targeted tests passed.
- **Commit / residual risk:** `f293a194f`. Devices that never launch the updated build retain legacy storage until migration runs.

### F-017 — iOS reader navigation was both overpermissive and functionally broken

- **Severity / area:** Medium, iOS WebView security/navigation.
- **Root cause and impact:** subframe/new-window behavior was not explicitly bounded, while official user-activated HTTP(S) links were canceled instead of opening safely.
- **Correction / files:** `ChapterHTMLWebView.swift` denies subframe/new-window navigation generally, preserves local main-frame reader navigation, and sends only user-activated HTTP(S) links to the system browser.
- **Tests and validation:** `testBundledWebViewNavigationPolicyAllowsOnlyLocalReaderPaths`; targeted iOS tests and Release build passed.
- **Commit / residual risk:** `f293a194f`. New URL schemes remain denied until deliberately supported.

### F-018 — One transient chapter failure permanently poisoned the tab cache

- **Severity / area:** Medium, web error recovery.
- **Root cause and impact:** list/chapter/body-window caches retained rejected Promises, causing every later retry to fail until reload.
- **Correction / files:** retryable cache helpers in `public/client-reliability.js`; `public/app.js` evicts only the currently rejected Promise.
- **Tests and validation:** failure-then-success contract in `tests/web-client-reliability-contract.mjs`; check/smoke passed.
- **Commit / residual risk:** `795415abb`. Successful entries remain intentionally cached for the session.

### F-019 — Resolved HTTP 5xx responses bypassed available offline content

- **Severity / area:** Medium, web/service-worker recovery.
- **Root cause and impact:** offline fallback ran only when `fetch` threw. A resolved 500/503 returned failure even when installed content or the cached shell was available.
- **Correction / files:** `public/app.js` and `public/service-worker.js` use offline fallback for 5xx while preserving 4xx and 429 semantics.
- **Tests and validation:** client contract checks 503/429/404 behavior; offline VM contract exercises a resolved 503; smoke passed.
- **Commit / residual risk:** `795415abb`. Fallback deliberately does not mask authorization or throttling responses.

### F-020 — Service-worker activation could delete the old shell before the new shell existed

- **Severity / area:** High, web offline outage risk.
- **Root cause and impact:** install called only `skipWaiting`; activation removed older shell caches before a replacement had been populated.
- **Correction / files:** `public/service-worker.js` precaches the new shell during install, then activates; offline contracts validate the sequence and retained asset cache.
- **Tests and validation:** offline contract and full smoke passed.
- **Commit / residual risk:** `795415abb`. A real browser kill-during-upgrade scenario remains valuable release QA.

### F-021 — First offline search loaded every full section into browser heap

- **Severity / area:** High, web low-memory performance/reliability.
- **Root cause and impact:** `getAll` loaded and retained all complete section records. The measured corpus was 22,789 sections and 119,424,632 bytes of raw chapter JSON before object/index overhead.
- **Correction / files:** `public/offline-storage.js` searches through an IndexedDB cursor and retains only compact matching summaries.
- **Tests and validation:** source/VM contract requires cursor use and checks offline behavior; check/smoke passed.
- **Commit / residual risk:** `795415abb`. Search remains linear in installed records; a compact indexed projection is the next scaling step.

### F-022 — Workboard JavaScript loaded for every web session

- **Severity / area:** Medium, web startup performance.
- **Root cause and impact:** global idle preload fetched the Workboard JavaScript graph even when the user never opened Workboard.
- **Correction / files:** `public/app.js` loads the JavaScript module on first Workboard intent. The initial attempt also deferred CSS, but that was reverted by F-024 because immutable `app.js` caching made mixed-version clients unsafe.
- **Tests and validation:** smoke asserts the module remains deferred and the cache-safe stylesheet is present in the shell; production Vite build passed.
- **Commit / residual risk:** `795415abb`, corrected by `54004c898`. First Workboard open pays the deferred JavaScript download; CSS remains an initial-shell cost.

### F-023 — Public search used an unbounded plaintext cache and oversized defaults

- **Severity / area:** Medium, backend memory/API performance.
- **Root cause and impact:** varied public searches could retain successful section bodies for process lifetime; the endpoint defaulted to 250 results and accepted unbounded query text.
- **Correction / files:** `app.mjs` adds a 2,000-entry LRU, lowers the default page to 25, and caps queries at 200 characters.
- **Tests and validation:** backend performance contract verifies LRU recency/eviction; check/smoke passed.
- **Commit / residual risk:** `8d4410317`. Offset remains available and unwindowed chapter-body calls still deserve production traffic/rate-limit telemetry.

### F-024 — Mixed cached assets rendered Workboard without Excalidraw styles

- **Severity / area:** High, web deployment/cache reliability.
- **Root cause and impact:** F-022 removed the static stylesheet and added an on-demand loader inside `app.js`, but `index.html` retained the same one-year immutable `app.js?v=20260731-topbar-pills-v259` URL. An existing browser could combine new HTML without CSS and old cached JavaScript without the loader, producing an unstyled 33,554,432-pixel-tall canvas with oversized toolbar icons.
- **Correction / files:** `public/index.html` restores the Workboard stylesheet to the initial shell; `public/service-worker.js` precaches it under shell generation v224; `public/offline-storage.js` uses the same generation.
- **Tests and validation:** smoke now requires the stylesheet in served HTML, the offline contract requires matching shell generations, the local server returned the CSS with HTTP 200, and full `npm run check`/`smoke` passed.
- **Commit / residual risk:** `54004c898`. Workboard CSS is again an eager transfer, deliberately trading approximately 106 kB gzip for deterministic rendering across cached client generations.

The audit also removed the baseline iOS unnecessary-`await` warning while touching the relevant transaction-observer path.

## 4. Performance improvements

| Hotspot | Before evidence | Change | After evidence / scaling effect | Remaining limitation |
| --- | --- | --- | --- | --- |
| Section lookup | Rebuilt a >18k-entry map; 250 sequential lookups averaged 3.873 ms/request. | Cache immutable combined catalog. | 1.612 ms/request, approximately 58.4% lower request time in the same benchmark. Work becomes O(1) lookup after one process-level build. | Cold build remains. |
| PostgreSQL sync push | Six statements in the write transaction plus two final reads. | Remove duplicated cursor/entitlement reads. | Four write statements plus two authoritative final reads, a 25% reduction in statements for the measured standard push shape. | No live DB latency/query plan without credentials. |
| Web initial Workboard cost | Every session could fetch a 470,040-byte gzip JS graph at idle and fetched 106,251-byte gzip CSS. | Lazy-load the JavaScript graph; retain CSS in the shell for cache-version safety. | Sessions that never open Workboard avoid the JavaScript graph. The approximately 106 kB gzip stylesheet remains eager after F-024. | First-open JS cost and initial CSS cost remain; deeper Excalidraw splitting is upstream-constrained. |
| Offline search heap | `getAll` materialized 22,789 full records; source corpus measured 119,424,632 raw bytes before JS object overhead. | Cursor scan and compact result summaries. | No longer retains the full record set; memory grows mainly with result count rather than corpus size. | Runtime remains linear; browser heap was not directly profiled. |
| Public search memory/response | Unlimited successful body cache, default 250 results, unbounded query string. | 2,000-entry LRU, default 25, 200-character query maximum. | Cache is O(2,000) instead of O(all touched sections); default response work is one tenth of baseline. | Public traffic telemetry and route-level rate limits remain advisable. |
| Offline asset churn | Shell version changes deleted code figures regardless of content version. | Stable asset-version cache. | Shell deployments no longer force figure re-download or leave a false installed state. | Browser quota eviction remains outside application control. |

The post-fix Workboard entry changed only from 1,000.39/267.31 kB raw/gzip to 1,000.61/267.35 kB; the gain is request deferral, not pretending the dependency became smaller.

## 5. Unresolved findings

These items were not changed because a safe fix requires a durable schema/API migration, coordinated multi-client behavior, production infrastructure, or a product ownership decision. They are not counted as fixed.

### U-001 — Concurrent Research messages can lose a paid answer from conversation history

- **Severity / confidence:** High, Confirmed from repository behavior.
- **Evidence:** `permitext-sync-server/app.mjs:2419-2440` unconditionally upserts the conversation. `app.mjs:10250-10408` loads one snapshot, performs a potentially long model call, stores an immutable answer, then overwrites the conversation. Two requests can consume quota/provider cost and leave only one exchange visible.
- **Why not fixed / required dependency:** correct handling needs persistent conversation revisions and idempotent turn reservation across a long-running provider call, plus PostgreSQL concurrency tests.
- **Recommended implementation:** reserve a unique turn before the model call, persist a revision, CAS/merge messages by stable IDs afterward, and return 409/reconcile on revision change.

### U-002 — Foundation artifact optimistic locking is check-then-write

- **Severity / confidence:** High, Confirmed.
- **Evidence:** handlers compare `expectedVersion` before repository access (for example `app.mjs:6998-7001`), but `app.mjs:2464-2489` upserts only when the stored timestamp is older and returns success even when no row changes. Concurrent Notebook, report-draft, project-note, review, or thread edits can both claim success.
- **Why not fixed / required dependency:** repository CAS changes affect every foundation artifact and need a migration/integration suite plus coordinated conflict payloads.
- **Recommended implementation:** perform `UPDATE ... WHERE owner AND envelope.version = expectedVersion RETURNING`; treat no row as conflict, and transactionally group artifact/link/activity writes.

### U-003 — Out-of-order Stripe events can restore canceled access

- **Severity / confidence:** High, Confirmed.
- **Evidence:** active subscription/invoice handlers grant at `app.mjs:14368-14388` and `14417-14437`; deletion at `14403-14415` removes the entitlement and its event watermark. A delayed older active event can then grant again.
- **Why not fixed / required dependency:** durable ordering needs a subscription-state table retained after entitlement deletion and production webhook reconciliation.
- **Recommended implementation:** persist last Stripe event timestamp/ID and terminal state per subscription, update transactionally, ignore older/equal events, and optionally fetch authoritative Stripe subscription state.

### U-004 — iOS local mutations and outbox insertion are not atomic

- **Severity / confidence:** High, Confirmed.
- **Evidence:** local writes such as notes occur separately from `enqueueSyncOperationIfPossible`; queue insertion failures are swallowed at `UserDataStore.swift:1270-1281`. A local mutation can therefore exist without a durable sync operation.
- **Why not fixed / required dependency:** every mutator must move to one SQLite transaction and failure semantics must be coordinated across the repository interface.
- **Recommended implementation:** introduce a transactional-outbox helper, migrate all mutation paths, roll back the local change if enqueue fails, and add fault-injection/relaunch tests.

### U-005 — PostgreSQL user operations can scan all tenants/content

- **Severity / confidence:** Medium, Confirmed.
- **Evidence:** `app.mjs:2149` reconstructs the whole normalized store from all users, entitlements, sessions, credentials, and user-content tables; `app.mjs:5360-5362` uses that whole-store read to retrieve one user's mutations. Sync and billing paths call the same abstraction.
- **Why not fixed / required dependency:** replacing it safely requires scoped repository methods across authentication, billing, deletion, and sync plus real query-plan/integration validation.
- **Recommended implementation:** add `listUserContent(userID)`, `getAccountContext(userID)`, and `getEntitlement(userID)` queries; reserve full-store reads for migration/admin work and assert tenant filters in tests.

### U-006 — Workboard server save ignores the client's base revision

- **Severity / confidence:** High, Highly likely.
- **Evidence:** the client sends `baseUpdatedAt` at `src/workboard.jsx:234` and `public/app.js:3884`, but no server/backend source consumes that field. Client-side race/clock fixes reduce loss but cannot prevent two valid devices from overwriting each other.
- **Why not fixed / required dependency:** a true fix changes the server API/conflict response and both clients' merge UX.
- **Recommended implementation:** store a server revision, require an expected revision on save, return the current board with HTTP 409 on mismatch, and preserve both local and remote copies for user resolution.

### U-007 — iOS note editing amplifies SQLite and sync-queue writes

- **Severity / confidence:** Medium, Confirmed.
- **Evidence:** reader changes call note save during editing (`ChapterReaderView.swift:859`, `ReaderView.swift:560-561`); `UserDataStore.swift:394-450` synchronously writes the note and appends a queue row for each save.
- **Why not fixed / required decision:** coalescing changes crash-durability timing and sync semantics; it belongs with the transactional outbox.
- **Recommended implementation:** keep immediate local durability but coalesce superseded pending note mutations by stable record ID, with typing/relaunch/reconnect tests.

### U-008 — iOS network responses are buffered without explicit byte ceilings

- **Severity / confidence:** Medium, Confirmed.
- **Evidence:** report PDFs, Workboard previews, and JSON use `URLSession.data(for:)` in `CodeModels.swift:2179-2267`. Valid response status/type is checked, but response size is not bounded before allocation.
- **Why not fixed / required dependency:** safe caps need product-specific size budgets and streaming/download-to-file changes for binary APIs.
- **Recommended implementation:** use download tasks for binaries, validate `Content-Length` plus actual file size, and set explicit JSON/image/PDF caps shared with server limits.

### U-009 — Account deletion is not atomic and owner deletion policy is ambiguous

- **Severity / confidence:** Medium, Possible.
- **Evidence:** `app.mjs:13417-13452` cancels Stripe, deletes private blobs, then deletes database state. Later failure can leave billing/assets changed while the account survives. Firm-owner data may also be shared with collaborators.
- **Why not fixed / required decision:** external billing/blob operations cannot be one DB transaction, and owner-transfer versus firm-deletion behavior is a product/legal policy decision.
- **Recommended implementation:** durable deletion workflow with resumable steps/compensation, an organization ownership policy, and failure-injection tests.

### U-010 — Uploaded image/PDF validation is structural but not adversarial

- **Severity / confidence:** Medium, Possible.
- **Evidence:** Report PDF checks at `app.mjs:8943-8956` use MIME, size, header, and EOF. Workboard image paths at `app.mjs:13566-13576` and `13741-13750` use MIME/magic/size checks but do not decode dimensions, detect polyglots, or scan malformed/decompression-bomb content.
- **Why not fixed / required dependency:** choosing and operating a safe decoder/scanner affects runtime, deployment size, and privacy policy.
- **Recommended implementation:** decode/re-encode supported images with dimension/pixel limits, parse PDFs with a hardened library or scanning service, quarantine failures, and add adversarial fixtures.

### U-011 — Concurrent report generation can duplicate versions and orphan blobs

- **Severity / confidence:** Medium, Highly likely.
- **Evidence:** `app.mjs:8647-8653` allocates `max(existing)+1`, then generates/stores a blob at `8700-8716` before saving related database artifacts at `8736+`. Concurrent requests can choose the same version; later DB failure can orphan the blob.
- **Why not fixed / required dependency:** needs a transactional version allocator and a durable blob-compensation workflow with real storage/database fault tests.
- **Recommended implementation:** allocate project report versions under a unique constraint/transaction, record a pending generation job, finalize atomically, and garbage-collect abandoned blobs.

### U-012 — Some web pane observers/timer registries lack explicit lifecycle disposal

- **Severity / confidence:** Low, Possible.
- **Evidence:** code-filter menu construction creates `ResizeObserver` instances and reader/search registries retain timers; current pane lifetimes make impact difficult to reproduce.
- **Why not fixed / required evidence:** a broad cleanup change without a reproducible lifecycle test risks breaking persistent panes.
- **Recommended implementation:** add pane mount/unmount instrumentation, then centralize observer/timer disposal and assert zero live registrations after teardown.

## 6. Test and validation results

Final validation after implementation:

| Command | Result |
| --- | --- |
| `npm run check` | Passed, 14.83 s. Includes backend performance/options, billing, web reliability, Workboard reliability, offline, auth, authorization, sync, Research, content, and source contracts configured by the project. |
| `npm run smoke` | Passed, 19.39 s. Includes real HTTP smoke coverage and production Workboard/Notebook builds. |
| Targeted `xcodebuild test ... -only-testing:permitextTests/EntitlementAndSyncContractTests` | Passed 29/29; XCTest time 1.290 s, command wall time 126.669 s. Bundle parse 46 ms; first usable state 545 ms in this run. |
| `xcodebuild build ... -configuration Release -destination 'generic/platform=iOS Simulator' ... CODE_SIGNING_ALLOWED=NO` | `BUILD SUCCEEDED`; validates the Release-only fail-closed backend path compiles. |
| `npm run verify:deploy-content` | Passed: 1,656 canonical, 19,794 legacy, and 21,450 published body files plus zoning/administrative/specialty collections reported by the verifier. |
| `npm run verify:postgres` | Skipped by the project because no database URL was configured. No query-plan or live concurrent-transaction claim is made. |
| `npm run verify:production` | Passed against `https://permitext-sync.vercel.app`; live service reported PostgreSQL `normalized-v4`. This verifies current production health, not deployment of the unpushed audit commits. |
| `npm run verify:production:aasa` | Passed; published app association includes `57BY95X97H.com.randycodex.permitext`. |
| `npm audit --omit=dev --audit-level=high` | Passed with zero vulnerabilities. |
| Notebook sibling hash check | Passed before/after final check and smoke runs for the present `notebook 2.js`, `notebook 3.js`, and `notebook 4.js` copies. |

One intermediate iOS compile failed after the StoreKit helper was renamed but a debug-summary reference still used the old name. That audit-introduced error was corrected before committing; the subsequent 29-test run and Release build passed. No final validation command failed.

Validation not completed:

- Real PostgreSQL concurrency, constraint, migration, and query-plan tests: no database URL.
- Signed distribution archive, StoreKit sandbox/device flow, App Store Connect, and physical-device offline/relaunch checks: external credentials/hardware/configuration required.
- Direct browser heap profiling: the offline hotspot was measured from corpus bytes and implementation behavior, then guarded by cursor-based contracts.
- Production verification of these commits: they were not pushed or deployed by this task.

## 7. Changed files and commits

### Commits created

1. `d0a4fc568` — Optimize section lookup and sync persistence
2. `b32a66e47` — Preserve unrelated notebook build outputs
3. `c52d2dca4` — Reject malformed sync record identifiers
4. `f293a194f` — Harden iOS entitlement and sync recovery
5. `8d4410317` — Harden server transaction and entitlement handling
6. `795415abb` — Protect web drafts and offline recovery
7. `cda3a986e` — Document Permitext reliability audit
8. `54004c898` — Restore cache-safe Workboard styling

This report update is committed separately after the Workboard regression repair.

### Grouped file summary

- **iOS reliability/security:** `Diagnostics/Signposts.swift`, `Models/CodeModels.swift`, `ViewModels/CodeLibraryViewModel.swift`, `Views/ChapterHTMLWebView.swift`, `permitextTests/EntitlementAndSyncContractTests.swift`.
- **Backend validation/performance/billing:** `app.mjs`, `postgres-account-repository.mjs`, `postgres-organization-repository.mjs`, `postgres-sync-repository.mjs`, `tests/backend-performance-contract.mjs`, `tests/billing-contract.mjs`, `tests/smoke.mjs`.
- **Web/offline/Workboard:** `public/app.js`, `public/client-reliability.js`, `public/index.html`, `public/offline-storage.js`, `public/service-worker.js`, `src/workboard.jsx`, `src/workboard-reliability.js`, `tests/offline-contract.mjs`, `tests/web-client-reliability-contract.mjs`, `tests/workboard-reliability-contract.mjs`.
- **Build/test configuration:** `vite.notebook.config.js`, `tests/build-output-contract.mjs`, `package.json`.

## Completion summary

- **Total supported issues found:** 36
- **Total fixed:** 24
- **Critical fixed:** 3 of 3
- **High fixed:** 13
- **Critical and High fixed:** 16
- **Unresolved:** 12, including five High items requiring durable schema/API/concurrency work

The original audit commits through `cda3a986e` were pushed to `origin/main`. The Workboard repair `54004c898` and this report update are local until explicitly pushed; no production deployment of the repair is claimed. Unrelated untracked user files were preserved.

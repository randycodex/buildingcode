# Permitext Debug, Fix, and Hotspot Report

**Review date:** 2026-07-31  
**Reviewed base:** `ea2baf79f5f31cfb348b4d8bcc1e9b7c7602e00c` (`work`)  
**Execution environment:** Linux x86_64, Node 24.15.0, npm 11.4.2  
**Scope note:** This report records repository evidence and local validation. It does not claim production, App Store, Apple identity, Stripe, OpenAI, Vercel Blob, or live PostgreSQL behavior without those systems and credentials.

## Executive summary

Seven actionable findings were confirmed during this pass. Four were safely fixed: one Critical private-object namespace defect, one High unsafe-upload validation defect, one Medium malformed-URL reliability defect, and one Medium local-adapter concurrency hotspot. Three environment- or migration-dependent findings remain explicitly blocked. Four logical implementation commits were created before this report.

The most consequential correction adds the authenticated storage owner to every new Workboard image, Workboard preview, and Report PDF key. Previously, two accounts using the same client-provided Project identifier generated the same object namespace. Workboard reads authorized the caller's Project but did not bind the object key to that account, permitting collision, overwrite, and potentially cross-account image access. Uploads now also verify file signatures instead of trusting `Content-Type`.

## 1. Architecture summary

### Active applications and deployment targets

- **iOS application:** SwiftUI app in `NYC CC APP/permitext`, Xcode project `NYC CC APP/NYC CC APP.xcodeproj`, scheme `permitext`. It bundles enacted code content, stores user data locally, performs literal legacy SQLite search where needed, and synchronizes supported records after account sign-in.
- **Web workspace:** Static HTML/CSS/JavaScript under `permitext-sync-server/public`, plus React/Vite Workboard and Tiptap Notebook clients built into generated public assets.
- **Backend/API:** Node ESM application in `permitext-sync-server/app.mjs`, exposed locally by `server.mjs` and on Vercel by `api/index.mjs`.
- **Persistence:** JSON-file development adapter with inter-process locking and atomic replacement; Neon/PostgreSQL production repositories for accounts, organizations, rate limiting, normalized records, sync events, and compatibility mirrors.
- **Private files:** Vercel Blob in hosted environments or a configured local private-file root. Private files include Workboard images/previews and generated/uploaded Report PDFs.
- **Canonical content/search:** Authored Construction Code and Zoning content is bundled below `NYC CC APP/permitext/Resources/CodeContent`; server and web use validated prepared catalogs, section bodies, and the shipped search index.
- **Deployment:** Vercel function/static deployment for web/backend; Xcode/App Store pipeline for iOS. The repository also contains the separate Swift authoring package under `NYC CC AUTHOR`, historical/archive trees, and generated code-content assets; those are not runtime services.

### Principal data flows

1. iOS and web read bundled/public canonical code catalogs and prepared search indexes.
2. Account sign-in establishes a server session; server-side handlers authenticate it and enforce entitlement and Project/organization permission contracts.
3. Local mutations enter iOS/web durable state and sync through `/sync/push`; pulls use a full baseline or incremental event cursor and merge conflicts client-side.
4. Projects connect saved material, Notebook artifacts, Workboards, Research conversations/evidence, report drafts, immutable manifests, and generated outputs through owner-scoped records and links.
5. Research re-resolves selected canonical evidence server-side, constructs evidence-bounded model context, validates structured citations, and stores versioned conversations/answers without sending private notes as enacted authority.
6. Private file operations authenticate the account, verify Project permissions, and use opaque hashed object keys. This review corrected missing account scoping in those keys.

## 2. Baseline status

### Baseline validation before modifications

| Check | Result | Measurement/notes |
|---|---|---|
| `npm run check` | Passed | 88.595 seconds; syntax/contracts/evaluation preflight passed; PostgreSQL rate-limit integration skipped without database URL. |
| `npm run smoke` | Passed | 120.408 seconds including production client builds and JSON-adapter smoke suite. |
| Workboard production build | Passed | 2,317 modules; 3.57 seconds. Main `workboard.js` 1,000.39 kB / 267.31 kB gzip; largest lazy chunk 1,834.86 kB / 746.01 kB gzip. |
| Notebook production build | Passed | 368.92 kB / 98.83 kB gzip; 234 ms. |
| Content integrity | Passed | 12,891 indexed sections; 11,610 available bodies; 90.06% body coverage. |
| Research evaluation preflight | Passed | 5/5 evidence-ready; no paid model calls. |
| Retrieval diagnostics | Passed | 20/20 evidence-ready; 100% mean section recall@12 and passage recall; scenarios remain draft. |
| iOS build/tests | Not available | `xcodebuild` is absent because the review environment is Linux. |
| Live PostgreSQL integration/query plans | Not available | No database URL or production data was provided. |
| Dependency advisory audit | Blocked | npm registry advisory endpoint returned HTTP 403. |

### Baseline findings

The baseline suite was green, but it did not execute `tests/file-storage-hardening.mjs` as part of the general `check` or `smoke` gates. Existing tests also did not assert that private object keys differ between accounts that submit the same Project ID or that uploaded image bytes match their declared media type.

## 3. Completed fixes

### PT-SEC-001 — private object keys were not account-scoped

- **Severity:** Critical
- **Confidence:** Confirmed
- **Area:** Authorization, privacy, data integrity, private files
- **Root cause:** `workboardAssetPrefix` accepted `userID` but omitted it from the generated key. Preview and Report prefixes omitted the storage owner entirely. Client-created Project IDs are not globally unique or server-bound, so two accounts choosing the same Project ID shared a blob namespace.
- **User impact:** A malicious or colliding account could overwrite another account's private object. The direct Workboard read contract accepted any key matching the caller's same-named Project prefix, creating a cross-account image disclosure path. Preview/PDF content hashes reduced disclosure risk but did not prevent cross-account overwrite/denial of service.
- **Files changed:** `permitext-sync-server/app.mjs`, `permitext-sync-server/tests/file-storage-hardening.mjs`
- **Correction:** Added a common `project-assets/<owner-hash>/<project-hash>/` namespace and required the authenticated storage owner in Workboard, preview, and Report creation/containment checks. Tightened account-deletion path recognition to the new two-hash namespace while retaining the older already-owner-scoped `workboards/<owner>/<project>/` format.
- **Tests:** Added deterministic cross-account collision and containment assertions for Workboard objects, previews, and Report PDFs.
- **Validation:** `node --check app.mjs`; `node tests/file-storage-hardening.mjs`; final `npm run check`; final `npm run smoke`.
- **Commit:** `6bd19397` — *Scope private project files to account owners*
- **Remaining risk:** Objects created under the immediately preceding unscoped `project-assets/<project-hash>/...` layout need an authenticated migration before they can be safely re-enabled. They are deliberately not accepted by the new authorization predicate.

### PT-SEC-002 — Workboard uploads trusted declared MIME type

- **Severity:** High
- **Confidence:** Confirmed
- **Area:** File upload security and data integrity
- **Root cause:** Workboard uploads allowed PNG, JPEG, GIF, or WebP based only on `Content-Type`; arbitrary non-image bytes could be stored and later served as an image.
- **User impact:** Invalid or hostile bytes could occupy private storage, break synchronized boards, and propagate corrupt attachment state. Browser `nosniff` reduced script-execution risk but did not make the upload valid.
- **Files changed:** `permitext-sync-server/app.mjs`, `permitext-sync-server/tests/file-storage-hardening.mjs`
- **Correction:** Added bounded signature checks for PNG, JPEG start/end markers, GIF87a/GIF89a, and RIFF/WEBP before storage.
- **Tests:** Added valid-signature fixtures and arbitrary-byte rejection for all four permitted types.
- **Validation:** `node tests/file-storage-hardening.mjs`; `npm run test:file-storage`; final general gates.
- **Commit:** `e7609fed` — *Validate Workboard image signatures*
- **Remaining risk:** Signature checks establish type consistency, not full image decoding. Browser-side optimization and private serving remain defense layers; a production malware/scanning policy would be a separate product/operations decision.

### PT-REL-001 — malformed percent-encoded paths produced HTTP 500

- **Severity:** Medium
- **Confidence:** Confirmed
- **Area:** HTTP reliability and error handling
- **Root cause:** Static web, internal-console, and code-asset handlers called `decodeURIComponent` directly. Malformed encodings throw `URIError`, which fell through the global handler as an internal server error.
- **User impact:** Invalid public requests generated misleading 500 responses and noisy error logging instead of a stable not-found response.
- **Files changed:** `permitext-sync-server/app.mjs`, `permitext-sync-server/tests/http-path-hardening.mjs`, `permitext-sync-server/package.json`
- **Correction:** Centralized safe path decoding. Invalid encodings now return the existing 404 response without attempting filesystem access.
- **Tests:** Added normal, encoded-slash, truncated UTF-8, and lone-percent cases; enrolled the path and storage hardening suites in both general gates.
- **Validation:** focused path test, syntax check, `npm run check`, and `npm run smoke`.
- **Commit:** `35d27669` — *Handle malformed public URL paths safely*
- **Remaining risk:** None identified for the corrected handlers.

### PT-PERF-001 — read-only JSON-adapter requests acquired the global write lock

- **Severity:** Medium
- **Confidence:** Confirmed
- **Area:** Backend performance, concurrency, local reliability
- **Root cause:** Because most APIs use POST, the JSON adapter classified every POST as mutating. Lists, gets, reads, usage queries, and sync pulls unnecessarily waited on the single inter-process write lock.
- **User impact:** Concurrent local reads serialized behind unrelated writes, adding avoidable latency and making a 10-second lock timeout possible for operations that do not modify the JSON store.
- **Files changed:** `permitext-sync-server/app.mjs`, `permitext-sync-server/tests/http-path-hardening.mjs`
- **Correction:** Added an explicit allowlist of 22 read-only POST routes. Mutations, unknown POST routes, account deletion, and Apple callback mutation retain the lock. PostgreSQL behavior is unchanged.
- **Tests:** Classification tests cover sync pull/push, Report read/save, Research list, and account deletion boundaries.
- **Validation:** focused contract test and final full gates.
- **Commit:** `9369788b` — *Avoid locking local storage for read-only APIs*
- **Remaining risk:** This removes lock contention rather than database/query latency. Any new POST read route must be explicitly classified to receive the optimization; defaulting unknown routes to mutating is intentional fail-safe behavior.

## 4. Performance improvements

### PERF-001 — JSON adapter read concurrency

- **Previous behavior:** All POST routes entered the global file-store critical section, including 22 routes that only read.
- **Evidence:** Direct inspection of `requestMutatesFileStore` showed unconditional POST locking; route-handler inspection confirmed the selected routes do not write the JSON store.
- **Change:** Read-only POST routes now bypass `withFileStoreLock`; write and ambiguous routes remain serialized.
- **Before measurement:** Every read-only POST required lock acquisition and could wait up to the configured 10,000 ms timeout behind a writer.
- **After measurement:** The classification contract confirms those routes do not enter the write-lock path; their lock wait is 0 ms by construction. The full JSON-adapter smoke test passes.
- **Expected scaling effect:** Independent reads can proceed concurrently and are no longer head-of-line blocked by local writes. This primarily benefits development, smoke tests, and self-hosted JSON-adapter use; production PostgreSQL was already outside this lock.
- **Remaining limitations:** The JSON adapter still reads whole in-memory/file structures for many operations and is not a production-scale database.

### PERF-002 — observed web bundle hotspot (not changed)

- **Previous/current behavior:** The Workboard entry is about 1.00 MB (267 kB gzip) and its largest lazy chunk is about 1.83 MB (746 kB gzip). Notebook is about 369 kB (99 kB gzip).
- **Evidence:** Vite production-build size report from both baseline and final `npm run smoke`.
- **Reason not changed:** The large modules are Excalidraw/editor graph and diagram dependencies already emitted as lazy chunks. Safely removing capabilities or restructuring the editor requires a rendered feature/performance decision and device profiling, not a blind bundler rewrite.
- **Recommended next step:** Capture low-memory/mobile load traces for first Workboard open, then conditionally exclude unused diagram/localization features or split editor initialization based on measured parse/evaluation cost.

## 5. Unresolved findings

### PT-BLOCK-001 — migration for previously unscoped private objects

- **Severity:** High
- **Confidence:** Confirmed
- **Relevant files:** `permitext-sync-server/app.mjs` private path helpers and Workboard/Report handlers.
- **Evidence:** The former layout used only the Project hash for `project-assets` keys. The new secure layout includes owner and Project hashes.
- **Reason not fixed:** Secure migration requires enumerating real private objects and owner-scoped database artifacts in production. No Vercel Blob credentials or production PostgreSQL data were available, and guessing ownership would recreate the vulnerability.
- **Required dependency:** Authenticated production migration access and a verified mapping from every old pathname to exactly one storage owner/Project.
- **Recommended implementation:** Write an idempotent administrative migration that joins owner-scoped artifacts to old paths, verifies stored hashes, copies to the new namespace, updates records transactionally, audits collisions, and deletes old objects only after verification and rollback retention.

### PT-BLOCK-002 — production PostgreSQL/query-plan validation

- **Severity:** Medium
- **Confidence:** Confirmed limitation
- **Relevant files:** `permitext-sync-server/postgres-*.mjs`, schema initialization within those repositories, and `tests/postgres-integration.mjs`.
- **Evidence:** The PostgreSQL integration test explicitly skipped with no database URL; no production-sized data was available for `EXPLAIN (ANALYZE, BUFFERS)`.
- **Reason not fixed:** Index changes without actual plans/cardinality would violate the requirement to justify indexes by query patterns.
- **Required dependency:** Disposable schema-compatible PostgreSQL/Neon database with representative cardinality.
- **Recommended implementation:** Run integration tests and capture plans for incremental sync, owner-scoped project/artifact lists, activity ordering, session lookup, and rate-limit updates before adding or changing indexes.

### PT-BLOCK-003 — native build/runtime profiling

- **Severity:** Medium
- **Confidence:** Confirmed limitation
- **Relevant files:** `NYC CC APP/permitext`, especially `CodeLibraryViewModel.swift`, `UserDataStore.swift`, and HTML reader views.
- **Evidence:** Repository/static inspection completed, but `xcodebuild`, Simulator, Instruments, StoreKit, and iOS lifecycle facilities are unavailable on Linux.
- **Reason not fixed:** Main-thread, suspension, memory, and SwiftUI invalidation claims require an Apple build/runtime. Source-only speculative changes would not meet the validation standard.
- **Required dependency:** macOS with the named iOS simulator/device, code content available, and test account configuration.
- **Recommended implementation:** Run contract/UI tests plus Instruments Time Profiler, Allocations, Leaks, SwiftUI updates, launch metrics, offline relaunch, background/suspension, and reconnect/outbox scenarios.

## 6. Test results

### Final successful checks

- `npm run check` — passed in 90.649 seconds. Includes syntax checks, contract suites, new file/path hardening tests, offline contract, deterministic Research/evaluation preflight, and content contracts. PostgreSQL rate-limit integration skipped because no database URL was configured.
- `npm run smoke` — passed in 127.634 seconds, including both production client builds and JSON-adapter end-to-end smoke coverage.
- `npm run test:file-storage` — passed.
- `node tests/file-storage-hardening.mjs` — passed.
- `node tests/http-path-hardening.mjs` — passed.
- `node --check app.mjs` — passed.
- `git diff --check` — passed before each implementation commit.

### Validation not completed

- iOS build, XCTest, UI tests, Simulator, and Instruments: unavailable on Linux (`xcodebuild` absent).
- Live PostgreSQL migration/constraint/integration tests and query plans: database URL unavailable.
- Production Apple, Stripe, OpenAI, Vercel Blob, App Store, and deployed-host verification: credentials/external state unavailable.
- npm dependency advisory audit: registry audit endpoint returned HTTP 403.
- Paid Research model evaluation: deliberately not run without explicit spending approval.

## 7. Changed files and commits

### Security and private storage

- `permitext-sync-server/app.mjs`
- `permitext-sync-server/tests/file-storage-hardening.mjs`
- `6bd19397` — Scope private project files to account owners
- `e7609fed` — Validate Workboard image signatures

### Reliability and test gates

- `permitext-sync-server/app.mjs`
- `permitext-sync-server/tests/http-path-hardening.mjs`
- `permitext-sync-server/package.json`
- `35d27669` — Handle malformed public URL paths safely

### Backend performance

- `permitext-sync-server/app.mjs`
- `permitext-sync-server/tests/http-path-hardening.mjs`
- `9369788b` — Avoid locking local storage for read-only APIs

## Completion counts and next task

1. **Total issues found:** 7 (4 fixed, 3 blocked).
2. **Total issues fixed:** 4.
3. **Critical and High issues fixed:** 2 (one Critical namespace/authorization defect; one High upload-integrity defect).
4. **Performance hotspots improved:** 1; one additional measured bundle hotspot documented pending runtime evidence.
5. **Security issues corrected:** 2.
6. **Tests added:** 2 focused hardening areas; one new test module plus expanded file-storage coverage, both enrolled in general gates.
7. **Validation completed:** full Node check, production client builds, JSON-adapter smoke, content/search contracts, offline contract, Research/evaluation preflight, and focused storage/path tests.
8. **Remaining blocked issues:** 3.
9. **Implementation commits created:** 4, plus the report commit.
10. **Most valuable next engineering task:** run an authenticated, idempotent production migration of old unscoped private objects, then verify owner isolation and hashes against live PostgreSQL and Blob storage before deleting legacy keys.

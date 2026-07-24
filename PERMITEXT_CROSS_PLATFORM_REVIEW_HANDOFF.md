# Permitext Cross-Platform Review and Remediation Handoff

**Mode:** The original review was read-only. This handoff now records remediation that landed afterward.
**Date context:** 2026-07-24
**Original review baseline:** `ca657abf` and earlier
**Current reviewed commit:** `f8d8ffdc`
**Workspace root:** `/Users/randy/Documents/X_CODING/Building Code`
**Purpose of this document:** Self-contained handoff for another AI agent (or human). Prefer verifying claims against source before changing code. Items marked resolved are historical findings, not an active change list.

## Remediation status after the original review

The original review preceded commit `7e843693` (`Harden Permitext cross-platform contracts`) and the later billing/grant clarification in `f8d8ffdc`. Those commits changed the status of several findings below.

| Original finding | Current status at `f8d8ffdc` |
|------------------|-------------------------------|
| C1 hardcoded `$0.00/month` CTA | **Open** |
| H1/H2 Free continuity and sync contract | **Partially resolved:** iOS and web now deliberately include continuity and cross-device sync in Free; web still lacks matching server-enforced save/note limits |
| H5 3-second foreground polling | **Mitigated:** both clients now use 30 seconds; event-driven or dirty-queue-based pulling remains future work |
| H6 Postgres account linking disabled | **Resolved:** transactional Postgres account merging and tests were added |
| H7 deploy content uncertainty | **Partially resolved:** deployment now runs `verify:deploy-content`; production served-content verification remains important |
| H8 legacy Research quota bypass | **Resolved:** `/research/interpret` now enforces and records monthly usage |
| H9 unchecked Stripe return URLs | **Resolved:** checkout requires same-origin return URLs |
| H10 hosted OAuth secret fallback | **Resolved:** hosted Apple web sign-in fails closed without a configured secret |
| H12 no iOS test target | **Partially resolved:** an XCTest target and initial entitlement/sync contract tests were added; broader unit/UI coverage is still needed |
| M7 Apple OAuth nonce not verified | **Resolved** |
| M11 unbounded default search results | **Resolved:** server defaults and caps results at 250 |

---

## 1. Project map

### Primary products

| Surface | Path | Role |
|---------|------|------|
| iOS app | `NYC CC APP/permitext/` | SwiftUI app (`PermitextApp`), scheme under `NYC CC APP/NYC CC APP.xcodeproj` |
| Web + sync backend | `permitext-sync-server/` | Node/Vercel API (`app.mjs`), SPA (`public/app.js`), Excalidraw workboards |
| Authored code content (SoT for published content) | `NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes/` | `prepared/`, `code-sections/`, `assets/`, `bundle.json` |
| Authoring tool | `NYC CC AUTHOR/` | macOS authoring pipeline (secondary for this review) |
| Source HTML/PDFs | `New York City/` | Raw jurisdiction content |

### Active iOS code (not outdated doc paths)

- Entry: `NYC CC APP/permitext/PermitextApp.swift`
- ViewModel: `NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift` (~3600 lines)
- Models + backend/billing types: `NYC CC APP/permitext/Models/CodeModels.swift` (~2950 lines)
- User data/sync queue: `NYC CC APP/permitext/Data/UserDataStore.swift` (~2912 lines)
- Authored content: `NYC CC APP/permitext/Data/AuthoredCodeStore.swift`
- HTML reader: `NYC CC APP/permitext/Views/ChapterHTMLWebView.swift`, `ChapterHTMLReaderView.swift`
- Sync engine / HTTP client currently under: `NYC CC APP/permitext/Diagnostics/Signposts.swift` (misplaced package location)
- Entitlements: `NYC CC APP/permitext/permitext.entitlements`
- Backend base URL: `Info.plist` key `PermitextBackendAPIBaseURL` = `https://permitext-sync.vercel.app`
- DEBUG forces HTTP base to production Vercel in `PermitextApp.init`

### Active web/backend code

- API monolith: `permitext-sync-server/app.mjs` (~6692 lines)
- SPA monolith: `permitext-sync-server/public/app.js` (~10835 lines)
- Local server: `permitext-sync-server/server.mjs`
- Vercel entry: `permitext-sync-server/api/index.mjs`
- Postgres: `postgres-account-repository.mjs`, `postgres-sync-repository.mjs`
- Offline/PWA helpers: `public/offline-storage.js`, `service-worker.js`, `sync-state.js`, `sync-identity.js`
- Workboard: `src/workboard.jsx` → built into `public/workboard-assets/`
- Canonical content path resolved from server as sibling of server root:
  `../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes`

### Docs (useful but partially stale)

- iOS context (stale paths): `NYC CC APP/IOS_APP_CONTEXT.md`
- Backend contract: `NYC CC APP/docs/phase-5-backend-contract.md`
- Roadmap: `NYC CC APP/docs/permitext-feature-roadmap.md`
- Web rules: `permitext-sync-server/WEB_UI_UX_RULES.md`
- Web next steps (stale): `permitext-sync-server/WEB_NEXT_STEPS.md`
- Server README (current ops detail): `permitext-sync-server/README.md`
- Root README (stale): `README.md`

### Workspace clutter (do not edit as SoT)

- `PermiText 1.0 (1)/` (~545MB) — old snapshot
- `NYC CC APP/NYCCCApp/` (~301MB) — legacy content tree
- `TRASH/`
- Duplicate code-section dirs under app resources: `building-code 3`, `mechanical-code 3`, `fuel-gas-code 2`, etc.

---

## 2. Architecture snapshot

### Shared product intent

Permitext is an unofficial NYC Construction Codes professional workspace:

- Trusted official code reading (versioned, jurisdiction-specific)
- Private workflow: bookmarks/saved, notes, tags, projects, export
- Cross-device continuity via Apple account + backend sync
- Web-only power tools: Research (AI), Workboards (Excalidraw)
- Monetization: Free + Pro (App Store + Stripe + lifetime grants)

### Data authority rules

1. **Official code text is immutable** on device/server. iOS opens code SQLite read-only when used; authored HTML/JSON is the current primary content path.
2. **User content** lives in app SQLite (`UserDataStore`) on iOS and IndexedDB/localStorage + server on web.
3. **Published iPhone content tree is authority** for chapter structure, section IDs, search IDs, assets (server README).
4. **Search** on both platforms uses shipped `prepared/searchIndex.json` (not ad-hoc full-body reindex on each request as primary path).
5. **Deep link contract:**
   `https://permitext-sync.vercel.app/open/section/<canonical-section-id>`

### Allowed sync mutation kinds (server)

From `app.mjs` `allowedMutationKinds`:

- `savedItem`
- `annotation`
- `project`
- `projectSection`
- `workboard`
- `continuity`
- `codeVersionClear`

Note: Postgres has comment-related tables/queries, but `comment` is **not** in `allowedMutationKinds`. Comments appear local/web-only or unfinished.

### Sync model

- LWW by `updatedAt`
- Client outbox + conflict list with explicit **Use server / Keep mine**
- Postgres: hashed multi-device sessions, event cursor incremental pull when content-map version matches
- Content-map version change forces full replacement
- Server ignores client entitlement writes on Postgres path (server-owned entitlements)

---

## 3. Cross-platform contract (what must work between iOS and web)

### Working / designed correctly

| Area | Evidence / notes |
|------|------------------|
| Canonical section IDs | Shared prepared content; server canonicalization at ingestion |
| Search ranking parity | Smoke compares web ordered IDs to iOS golden fixtures |
| Deep links + AASA | iOS entitlements: `applinks:` and `webcredentials:` for `permitext-sync.vercel.app` |
| Mutation kinds overlap | iOS understands all allowed kinds |
| Auth | Sign in with Apple; bearer session; iOS Keychain for token |
| Billing bridge | iOS verifies StoreKit JWS via backend; web uses Stripe; production rejects Xcode StoreKit as web Pro |
| Conflict UI | Both platforms have conflict resolution UX |
| Official vs user text separation | Product rule on both |

### Intentional or partial asymmetries (will feel like bugs if not labeled)

| Feature | iOS | Web |
|---------|-----|-----|
| Workboards | Apply path **no-ops** with comment “web-only”; still can surface in conflict UI | Full Excalidraw product + Blob assets |
| Research AI | Not present | Conversations + legacy `/research/interpret` |
| Multi-reader | Dual Browse tabs | Multi-pane desk |
| Free limits | 25 saves, 10 notes, 0 projects; tags/export Pro | Offline library download Pro-gated; matching free save/note caps not found as iOS-equivalent |
| Continuity apply | Merges **recents + recent searches only**; does **not** restore remote navigation (jurisdiction/version/project/chapter) | README describes richer restore of chapter/section navigation |
| Comments | No iOS model | Local web; not full sync kind |

### iOS continuity apply behavior (important)

File: `NYC CC APP/permitext/Diagnostics/Signposts.swift` → `applyServerContinuity`

- Decodes `recentlyViewedSectionsJSON`, `recentSearchesJSON`
- Explicitly keeps **local** navigation fields (`selectedJurisdictionKey`, `selectedVersionFileName`, `selectedCodeSectionID`, `lastOpenedChapterID`, `activeProjectID`)
- Comment in code: applying remote navigation previously ejected user from active reading

iOS **does push** fuller continuity values via `queueContinuityContextForSync` in `CodeLibraryViewModel` (including selected IDs, project, recents, recent searches).

### iOS workboard apply behavior

File: `NYC CC APP/permitext/Data/UserDataStore.swift` (~2367–2370)

- `.workboard` case: `break` with comment that workboards remain web-only so they do not block applying other user data

---

## 4. Original findings with current status

Severity legend: **critical** ship/trust risk · **high** correctness/security/cost/product · **medium** reliability/maintainability · **low** polish/docs

### Critical

#### C1. iOS Pro upgrade CTA hardcodes `$0.00/month`

- **File:** `NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift` (~1701–1704)
- **Bug:** `proProductDisplayPrice != nil` only checks non-nil; string is always `"Upgrade to Pro - $0.00/month"`
- **Impact:** False pricing in Settings/global alert; App Review risk
- **Fix direction:** Interpolate actual `proProductDisplayPrice` (prefer StoreKit localized price string as-is)

### High — product / cross-platform

#### H1. Free/Pro limits not fully aligned between iOS and web — partially resolved

- **iOS free limits** (`CodeModels.swift` `EntitlementLimits.free`):
  `savedSectionLimit: 25`, `noteLimit: 10`, `projectLimit: 0`, premiumExports false, advancedOrganization false, continuity true, crossDeviceSync true
- **iOS enforcement:** `denyIfNeeded` used for projects, saves, notes, tags, PDF export
- **Intentional Free behavior:** sync and continuity run for signed-in free users on both clients
- **Web:** Pro strongly gates offline library install; matching server-enforced online save/note caps were not found
- **Impact:** User builds large library on web free, hits different rules on iOS free; marketing says sync/continuity are Pro

#### H2. Pro copy contradicted actual Free sync behavior — resolved

- Free now deliberately includes continuity and cross-device sync in both the entitlement contract and web copy.
- Pro is described as unlocking unlimited saved work, projects, tags, PDF export, and web offline downloads.

#### H3. Workboards/Research web-only without clear iOS empty states

- Workboard conflicts can show on iOS (`SettingsView` has “Workboard conflict” label) with no workboard UI
- Research is a primary web tool; iOS has no Research surface
- **Fix direction:** Explicit “Web only — open on permitext-sync…” empty states; or add read-only iOS viewers later

#### H4. Continuity behavior asymmetric and under-documented in UI

- Direction iOS→web may restore more navigation than web→iOS
- Users expect “continue reading” parity
- **Fix direction:** Align product language with actual merge rules; optional explicit “restore last position” toggle

#### H5. Foreground sync polling was every 3 seconds — mitigated

- iOS and web now use a 30-second foreground interval.
- **Remaining direction:** Event-driven push plus dirty-queue or longer incremental pull behavior.

#### H6. Postgres account linking / web→Apple merge disabled — resolved

- Transactional account merging is now implemented in `postgres-account-repository.mjs`, wired through sign-in and Apple callback paths, and covered by integration tests.

#### H7. Canonical code content outside Vercel project root

- Server reads `../NYC CC APP/.../CodeContent/...`
- Vercel root is `permitext-sync-server`
- **Impact:** Deploy can miss or stale-serve chapters/search assets unless monorepo tracing/copy is configured
- **Fix direction:** Explicit package step into deploy unit + production smoke for `/code/chapters` + search

### High — security / cost (web)

#### H8. `/research/interpret` bypassed monthly usage accounting — resolved

- The legacy endpoint now enforces the monthly request limit and records model/token/cost usage.
- It still uses full selected sections rather than the stronger passage-level conversation model; migrating the UI to conversations remains desirable.

#### H9. Stripe Checkout success/cancel URLs not same-origin validated — resolved

- Checkout now rejects return URLs outside the configured Permitext origin.

#### H10. Apple web OAuth state secret had a hosted fallback — resolved

- Hosted deployments now fail closed when no suitable secret is configured. The development-only fallback remains local.

#### H11. Rate limits are in-process only

- Documented correctly in README
- Multi-instance Vercel does not share buckets
- **Fix direction:** Vercel Firewall / edge rate limits on sign-in, checkout, research, sync/push

### High — iOS quality

#### H12. Automated iOS coverage was absent — partially resolved

- The Xcode project now contains `permitextTests` with initial entitlement and sync contract tests.
- There is still no broad unit/UI suite; merge, deep-link, persistence, and reader behavior need more coverage.

#### H13. Legacy SQLite FTS fragile (if path used)

- `CodeDatabase.search`: raw FTS MATCH; join on `section_number` without stable section id
- Primary path is authored inverted index; SQLite still bundled (`nyc_code_2022.sqlite` ~18MB + sample)

#### H14. Bundle content bloat / duplicates

- Numbered duplicate dirs under `code-sections/`
- Hidden legacy SQLite still in Resources
- Parallel `NYCCCApp` prepared tree (~20k JSON) not the active target but pollutes workspace
- **Impact:** IPA size, install time, packaging mistakes

### Medium

#### M1. WKWebView security posture incomplete

- File: `ChapterHTMLWebView.swift`
- JS enabled (needed); **no** `decidePolicyFor` navigation allowlist found
- Message handlers not clearly removed on dismantle (retain cycle risk)
- **Fix direction:** Allow only file/about/fragment; cancel http(s); remove script handlers on teardown

#### M2. Session token residual UserDefaults fallback on iOS

- Load can use Keychain token `?? account.backendSessionToken`
- Older installs may have stored token in account metadata
- Docs say Keychain-only
- **Fix direction:** Migrate to Keychain, strip UserDefaults token, never re-persist token there

#### M3. Keychain write errors ignored

- `AccountSessionTokenStore` does not surface SecItemAdd/Update failures
- User appears signed in while sync fails

#### M4. God-object architecture

- iOS: `CodeLibraryViewModel` + mega `CodeModels` + sync in `Diagnostics/`
- Web: `app.js` + `app.mjs` monoliths
- **Impact:** High regression cost for any cross-platform contract change

#### M5. Dual browser + global selected code section coupling (iOS)

- Tab switches call `syncSelectedCodeSection`
- Search/Settings can inherit surprising global section filter

#### M6. Client-only entitlement cache

- Acceptable for UX if server enforces paid APIs
- Dangerous if paid features remain client-only forever

#### M7. Apple identity token `nonce` not verified (web OAuth) — resolved

- The callback now passes the expected OAuth nonce into Apple identity-token verification.

#### M8. Admin bearer compare not constant-time

- Minor vs high-entropy tokens; inconsistent with Stripe/OAuth timing-safe compares

#### M9. File-store adapter is local-dev only quality

- Read-modify-write races; single plaintext session model
- Fine for smoke; not multi-device production

#### M10. File-path `sync/push` merges arbitrary `batch.user` into account

- Postgres path does not
- Local/dev identity pollution risk

#### M11. Unbounded search snippet materialization if `limit` omitted — resolved

- The server now defaults to and caps results at 250.

#### M12. Sessions in web `localStorage`

- XSS steals multi-day session
- Long-term: httpOnly cookies or short-lived tokens

#### M13. All static traffic rewrites through serverless function

- `vercel.json` rewrites everything to function
- Cold starts; research may need `maxDuration`

#### M14. Comment mutation unfinished

- Schema/query presence vs not in `allowedMutationKinds`

#### M15. Prepared section body coverage partial relative to full catalog

- ~417 prepared section JSON files under active path; full published ID set is much larger per server docs (~12,890 IDs with search index)
- Incomplete bodies affect research and rich snippets

### Low

#### L1. Stale documentation

- `IOS_APP_CONTEXT.md` points at `NYCCCApp` / SQLite-primary narrative
- Root `README.md` outdated
- `WEB_NEXT_STEPS.md` still says “until real sign-in exists”
- `Resources/README.md` describes SQLite-only

#### L2. Deep links host-hardcoded to production domain

- Fine for prod; awkward for staging

#### L3. CSP allows `style-src 'unsafe-inline'`

- Common SPA tradeoff

#### L4. Research feedback stores full Q&A server-side for operators

- Needs retention/export policy if regulated professional data grows

#### L5. Inline tappable cross-references not implemented on iOS

- Panel-style `CodeReferenceResolver` only
- Backlinks not implemented

---

## 5. Feature parity matrix (agent quick lookup)

| User journey | Expected multi-device behavior | Actual |
|--------------|-------------------------------|--------|
| Shared section URL | Same section opens | Designed yes |
| Bookmark web → iOS | Appears if same account + code version | Supported via `savedItem` |
| Note/tags iOS → web | Appear | Supported via `annotation` |
| Project with workboard web → iOS | See project + drawing | Project yes; workboard ignored |
| Research web → iOS | Continue | No iOS Research UI |
| Continue reading | Land on last section | iOS: recents only for remote apply; local nav preserved |
| Pro purchase iOS | Pro on web after Apple sign-in | Production JWS only; Xcode/Sandbox called out as non-production web |
| Pro purchase Stripe | Pro on iOS after Apple sign-in | Server entitlement |
| Free save limits | Same caps | **Partially aligned:** Free sync/continuity agree; web save/note enforcement still differs |
| Search result order | Same | Strong (golden tests) |

---

## 6. Key file evidence anchors

| Concern | Path |
|---------|------|
| iOS entry / sync lifecycle | `NYC CC APP/permitext/PermitextApp.swift` |
| $0.00 CTA + 3s sync + StoreKit messaging | `NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift` |
| Free/Pro limits | `NYC CC APP/permitext/Models/CodeModels.swift` (`EntitlementLimits`) |
| Workboard ignore on apply | `NYC CC APP/permitext/Data/UserDataStore.swift` |
| Continuity remote apply policy | `NYC CC APP/permitext/Diagnostics/Signposts.swift` (`applyServerContinuity`) |
| HTML reader | `NYC CC APP/permitext/Views/ChapterHTMLWebView.swift` |
| Associated domains | `NYC CC APP/permitext/permitext.entitlements` |
| Backend API base | `NYC CC APP/permitext/Info.plist` |
| Mutation allowlist | `permitext-sync-server/app.mjs` (`allowedMutationKinds`) |
| Research interpret (no quota) | `permitext-sync-server/app.mjs` (`handleResearchInterpretation`) |
| Research UI legacy call | `permitext-sync-server/public/app.js` (~6831 `postJSON("/research/interpret"...`) |
| Stripe checkout URLs | `permitext-sync-server/app.mjs` (~5795) |
| Web 3s sync | `permitext-sync-server/public/app.js` (`foregroundSyncIntervalMilliseconds`) |
| Content integrity / search parity tests | `permitext-sync-server/tests/content-integrity.mjs`, `tests/smoke.mjs` |
| iOS search regression | `NYC CC APP/Tools/search-regression/` |
| UI rules for web desk | `permitext-sync-server/WEB_UI_UX_RULES.md` |
| Backend contract for iOS | `NYC CC APP/docs/phase-5-backend-contract.md` |

---

## 7. Testing posture

### Web (`permitext-sync-server`)

- `npm run check` — syntax + several contract self-tests
- `npm run smoke` — local integration (auth, search golden, billing behaviors, etc.)
- `npm run verify:content` — content integrity gate
- `npm run verify:postgres` — opt-in multi-device session/push-pull
- `npm run verify:production*` — live health/AASA/identity (gated)
- Research evals: free preflight + paid live interlock (`eval:research`, `eval:research:live`)
- Gaps: no Playwright E2E; Postgres not in default smoke; research interpret quota / Stripe URL validation not obviously asserted

### iOS

- Initial XCTest target: `NYC CC APP/permitextTests/EntitlementAndSyncContractTests.swift`
- Python search regression tools
- Manual phase checklists under `NYC CC APP/docs/`
- DEBUG startup diagnostics for continuity/deep links/etc.
- Gaps: no broad UI tests; sync merge, deep-link, persistence, and reader coverage remain limited

---

## 8. Size / scale facts (approx.)

| Item | Size / count |
|------|----------------|
| iOS Swift LOC total | ~26.8k across 31 Swift files |
| Largest iOS files | ViewModel 3600, CodeModels 2950, UserDataStore 2912 |
| Web SPA | `public/app.js` ~10835 lines |
| Server API | `app.mjs` ~6692 lines |
| Authored CodeContent bundle | ~121MB |
| Active prepared chapters | 118 JSON |
| Active prepared sections | 417 JSON files (partial body set relative to full catalog) |
| Search index | `prepared/searchIndex.json` ~3.2MB |
| Bundled SQLite | `nyc_code_2022.sqlite` ~18MB (legacy/hidden UI path) |
| Server node_modules | ~280MB |

---

## 9. Prioritized action list (for implementers)

### P0 — before wider TestFlight / paid marketing

1. Fix iOS `upgradeCallToActionTitle` to show the real StoreKit price instead of `$0.00`.
2. Add matching server-enforced Free save/note/project limits on web, or explicitly document the remaining platform difference.
3. Decide whether to retire `/research/interpret` in favor of the passage-level conversation path.
4. Confirm production Firewall rules for sensitive endpoints.
5. Add explicit iOS messaging for web-only Research and Workboards.

### P1 — multi-device reliability

6. Run production proof for Postgres web→Apple account linking and entitlement transfer.
7. Verify served CodeContent after deployment in addition to the build-time gate.
8. Continue from 30-second polling toward event/dirty-queue-driven sync.
9. Add read-only or explicit web-only handling for Workboards and Research on iOS.
10. Add a WKWebView navigation allowlist and message-handler teardown; finish Keychain-only session migration.

### P2 — maintainability & quality

11. Split iOS ViewModel / move sync out of `Diagnostics/`; modularize `app.js` and `app.mjs`.
12. Expand iOS tests beyond the initial contract target: merge resolver, deep links, code-version normalization, persistence, and search ranking parity.
13. Refresh stale docs (`IOS_APP_CONTEXT.md`, root README, `WEB_NEXT_STEPS.md`, Resources README).
14. Remove/quarantine duplicate app trees and numbered content dirs from packaging.
15. Server default search `limit`; Vercel Firewall + function `maxDuration` for research.

### P3 — product roadmap parity

16. Research on iOS or clearly permanent web-only.
17. Read-only workboard/export path on iOS.
18. Inline cross-references on both platforms.
19. Comments as real sync entities if retained.
20. iPad / true multi-column layout.

---

## 10. Constraints for the next agent

1. **Do not modify files** unless the user explicitly asks for implementation.
2. Treat **authored `CodeContent` prepared tree** as published authority; do not invent alternate section ID schemes.
3. Preserve **official text immutability** vs user annotations.
4. Prefer **server-owned entitlements** for any paid feature enforcement.
5. When changing sync payloads, update **both** iOS encode/decode and web outbox/server validation + tests.
6. Search ranking changes require **both** platforms and golden fixtures (`Tools/search-regression` + `npm run smoke` / `verify:content`).
7. Avoid editing clutter trees (`PermiText 1.0 (1)/`, `TRASH/`, old `NYCCCApp` copies) unless cleaning is the task.
8. Passkeys are intentionally disabled (HTTP 410) until full WebAuthn ceremony exists.
9. Xcode StoreKit purchases must remain device-only messaging; do not claim they activate production web Pro.
10. Research must never treat private notes as evidence; keep AI output labeled non-official.

---

## 11. Suggested verification commands (read-only / local)

```sh
# Web syntax + contracts
cd "/Users/randy/Documents/X_CODING/Building Code/permitext-sync-server"
npm run check
npm run smoke
npm run verify:content

# Optional if DB URL configured
npm run verify:postgres

# iOS search regression tooling (if Python env ready)
# see NYC CC APP/Tools/search-regression/README.md
```

iOS app: open `NYC CC APP/NYC CC APP.xcodeproj`, scheme `permitext` (confirm in Xcode; scheme file exists as `permitext.xcscheme`).

---

## 12. One-paragraph bottom line

Permitext has solid multi-device infrastructure: canonical section IDs, a shared search index, mutation sync, Apple identity, server-owned entitlements, deep links, transactional account linking, guarded checkout returns, Research usage accounting, and an initial iOS contract-test target. The clearest remaining ship-blocking UI bug is the iOS Pro CTA hardcoding **$0.00/month**. Important product gaps remain: web save/note limits differ from iOS, Workboards and Research are web-only without strong iOS handling, continuity restore is asymmetric, polling remains periodic even after moving from 3 to 30 seconds, and production Firewall/content/account-linking proof still matters. Monoliths and limited iOS automated coverage continue to make cross-platform iteration expensive.

---

**End of handoff.**

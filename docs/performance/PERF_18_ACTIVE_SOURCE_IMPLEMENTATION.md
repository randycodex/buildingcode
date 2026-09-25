# PERF-18 — Explicit active sources

Status: native and web source controls are implemented. Selected physical flows passed on development Release 41.15: scope changes, all-off recovery, independent Reader preservation, two-source relaunch persistence, exact existing Research citation handling, corrected historical chapter headings, and completed Search retention. Full device acceptance is incomplete; see the [current physical matrix](PERF_18_PHYSICAL_ACCEPTANCE_CHECKLIST.md) for exact gaps. A subsequent queued-citation context correction is host-tested and compiled/signature-verified as Release 41.16, now installed and version-verified. On 41.16, all-enabled concrete returned 1,286 results and the 2022 wall detail rendered correctly twice; stale-citation/account transitions and timing remain unverified. No production deployment or release is claimed. PERF-17 production downloads remain open; no content removal is approved.

The checkpoint sections below are chronological evidence. Their statements about what was pending describe that checkpoint; this current status takes precedence.

## Behavior contract

1. Keep installed, enabled and downloadable states separate. Default every existing installed source to enabled; do not infer2022/2014preferences. Store explicit disabled identities so a temporarily unavailable source remains disabled when it returns.
2. Identify sources by canonical edition plus jurisdiction/code/category IDs. Never persist presentation filter IDs or display names.2022Building is category1;2014Building is category2;1968Building is category4 inside the enacted-administrative pack.
3. Keep full catalogs for edition labels, saved evidence, annotations, references and deep links. Expose a distinct enabled Browse/Search projection. Filtering the shared codeSections array would break identity lookup in Reader surfaces.
4. Persist a versioned preference scoped deliberately to account/device. No account-wide sync until cross-device semantics are chosen. Account changes reload their selection and invalidate in-flight queries/previews; do not reuse another account's choice.
5. Changing selection cancels obsolete search/preview/speculative work and recomputes an ordered scope fingerprint for completed-search caching. Preserve actual corpus revision and search-engine revision in cache keys. A query completed for another enabled scope cannot become the current complete result set.
6. Saved links remain visible regardless of enabled scope. Opening disabled-source content offers explicit enable/open handling without replacing the source text or silently changing the stored off preference. Define this UI before wiring filtering into shipped navigation.
7. Allow all-disabled state at the model layer. UI must explain why Browse/Search has no enabled sources and offer management; it must not silently restore all sources. Already-open reading content remains visible when disabling its source, while future speculative work stops.
8. Corrupt or unsupported preference versions must be detected without overwriting the stored data. A recovery choice is separate from a missing preference, which means current full scope.

## Implementation order

1. Foundation-only Codable source identity/selection model and deterministic scope-key tests; no application behavior change.
2. Account/device persistence with lifecycle and corruption tests; retain full catalog and derive enabled projections.
3. Apply explicit scope to search iteration and cache keys; keep stable result identities, guard late tasks, test re-enable and empty scope.
4. Apply to Browse and speculative warmup without breaking direct/Saved references. Add deliberate disabled-source resolution flow.
5. Add settings controls coordinated with current UI ownership; verify real rendered behavior on the phone, no simulator.
6. Measure all-enabled versus2022/2014scope on device: first search, saved-query reuse, detail opening, startup, memory and re-enable. Host benchmark is supporting evidence only.

## Exact category coverage

-2022:1Building,3Administrative,4FuelGas,5Plumbing,6Mechanical.
-2014:1Administrative,2Building,3Plumbing,4Mechanical,5FuelGas.
-Enacted administrative:1Title24,2Title25,3Title26,4Building1968,5Housing,6Title28,7Fire,8LocalLaws.
-2025specialty:1Energy,2Electrical.
-Existing Building and Zoning:category1 in their distinct canonical editions.

Use the canonical constants in CodeModels.swift and actual bundle metadata; bare numeric IDs are not globally unique.

## Current source insertion points

In CodeLibraryViewModel.swift, inspected before integration: filteredVersions649; selected category1075/secondary1110; all-edition Search1905–2097; current-edition Search2104; searchPreview1888 and makeSearchReaderLibrary1850; browsing warmup994/1019 and startup priority selection6523. Preserve evidence paths752/2232/2273 and Saved presentation6975/7074. Whole disabled packs should be excluded before constructing search stores; partially enabled packs require category-level matching as well as display filtering. Result filtering after scanning everything would not achieve the intended work reduction.

## Foundation model checkpoint

ActiveCodeSources.swift now provides a version1 disabled-source preference, canonical edition/jurisdiction/code/category identity, explicit enable/disable, deterministic ordered scope fingerprint, and an enabled installed projection. Missing preferences enable all sources. Disabled identities survive catalog absence and reappearance; an empty enabled set is valid. Unknown schema/malformed data throw rather than becoming an accidental reset. The host test compiles this actual Swift model and passes default behavior, identity collisions, ordering/deduplication, round-trip, all-disabled, absent-source retention and malformed/unknown-version cases.

This file is not yet wired into the Xcode target or model lifecycle. Therefore no user setting, Search filtering, Browse behavior, cache behavior or device performance is claimed. Account-scoped persistence is the next independently testable boundary.

## Account preference storage checkpoint

ActiveCodeSourcePreferences stores versioned data in injected UserDefaults with distinct guest and exact-account namespaces. Account identifiers are encoded without trimming/aliasing; a literal account namedguest is separate from anonymous guest preferences. Each operation loads that account's state rather than caching a prior account. Updates decode before mutation/write; malformed data, unsupported versions, non-Data values and thrown mutations leave stored values untouched. No reset/migration override is silently applied.

The host contract passes reconstruction using the same suite, account switching, guest distinction, edge-case identifiers, disabled-source absence/reappearance, explicit re-enable, malformed/version/type preservation and failed-mutation preservation. This establishes synchronous local preference behavior, not crash/fsync durability or multiwriter coordination. Native MainActor lifecycle wiring and scope enforcement are still pending.

Lifecycle insertion points confirmed: signedInAccount.didSet currently resets privateSessionID and workspace state when appUserID changes; init separately restores workspace state because property observers do not provide initial restoration. Both need source preference loading. Search-reader shadow libraries must inherit the owner's selection, not create/persist an unrelated scope.

## Native lifecycle foundation verified

The active-source model is now included in the iOS target. CodeLibraryViewModel loads account preferences on initial construction and account identity changes; malformed preferences remain nil with an error, preserving storage. Owner-only updates cancel search/preview/startup/speculative tasks and clear stale result state. Account changes force generation invalidation even when both accounts have identical selections. Independent Reader libraries inherit owner state and cannot persist separate choices.

Publication guards now compare captured Search generation for all-edition final/error results and current-edition initial/snippet/SQLite results; preview lookup checks after its detached read. Tests extract the actual lifecycle methods and compile with the real preference model, covering owner/shadow behavior, canonical identity, account changes, forced same-selection invalidation, corruption and task cancellation. These are method-level host tests, not complete UI interaction tests.

Generic physical-iOS-target Debug builds with signing disabled passed, including a final incremental build after the generation guards (logs `/tmp/permitext-perf18-build.log` and `/tmp/permitext-perf18-build-final.log`). No simulator, installation, physical-device interaction or release occurred. Settings and actual Search/Browse filtering are still not enabled; next step is coherent source enforcement/cache-key integration.

## Search enforcement verified locally

AuthoredCodeStore.search accepts an optional enabled-category set and excludes disabled candidate IDs before authoritative text verification/snippet generation. Default nil retains the existing path. All-edition/current Search captures preferences, includes partial scope in completed-cache keys, rejects disabled cached results and applies scope to matching/snippets/filters. Whole disabled authored packs are skipped before search-store construction using category metadata; all-enabled editions avoid this extra metadata read. Legacy SQLite remains outside category controls. Full category catalogs and Saved/direct Reader paths remain unchanged.

SearchView preview task identity now includes a published source revision; invalidation rotates it, and post-await generation checks suppress old previews/results. Empty scope produces no matching results; unavailable preference data fails closed with an error. Settings and Browse/warmup source enforcement remain unfinished, so this is not user-facing feature acceptance.

Validation: generic iOS Debug build passed (`/tmp/permitext-perf18-search-build.log`). Full six-edition corpus check passed32,551canonical text comparisons,756ordered result/snippet cases and six cancellation cases (`/tmp/perf18-corpus-parity.log`). Added scope cases compare empty/all/first-category results against the frozen baseline filtered by exact category identity, including limit-after-exclusion. Focused actual-function tests count text reads and prove disabled/unknown/empty scopes avoid disabled decoding; phrase/numeric/default ranking/snippets and category intersection pass. Account/model/lifecycle tests pass with actual JSON/plist metadata helpers. The initial old-signature harness failure was corrected before the final successful run. No device timing or installation claimed.

## Real category-identity regression

The actual metadata helper was exercised against the shipped enacted-administrative and2022bundle files. Disabling canonical1968Building(category4 in the administrative pack) leaves its seven sibling categories enabled.2022FuelGas also uses category4 but remains enabled because its canonical edition differs. The executable lifecycle test now guards this cross-pack collision using actual catalog metadata, not only synthetic identities. Browse/warmup integration is still in progress.

## Disabled-source navigation integration boundary

A single edition-level guard is insufficient:1968shares its pack, and prepareCodeVersionForEvidence also services pending-save maintenance. New explicit navigation must resolve exact canonical edition+section/category before selecting an edition or loading a passage. Search routes already carry category; Saved and Project bookmark records carry it but currently discard it when constructing ReaderView. Pass that identity through.

Proposed resolver outcome: allowed / requiresEnable(exact identity,label) / unavailable. Main account owner presents Enable and open or Cancel; enabling retries the same destination only after account/source revision checks. Cancellation preserves the previous Reader and the off preference. Already-open content and internal save maintenance remain readable/operable. Bare URL and Research citation resolution currently searches sectionDetail; a metadata readerTarget check is sufficient for locating category before the explicit decision, avoiding premature passage decoding. This navigation/prompt path remains unimplemented and is required before exposing controls.

## Browse and speculative warmup checkpoint

Enabled category/chapter projections now drive ordinary Browse tiles and picker choices. The full catalogs remain available to Reader/Saved consumers. Disabled selected sources are not silently replaced; existing Readers remain untouched. Startup/recent/category/tile speculative preparation excludes disabled chapters, and wholly disabled authored packs skip search-index warmup. Explicit chapter preparation remains available for the forthcoming guarded navigation path. Source changes cancel pending Browse preparation.

Actual-helper host contracts pass enabled projections, retained catalog/current Reader state, speculative read exclusion, all-enabled restoration and explicit preparation. The aggregate active-source suite includes this regression. Generic physical-iOS-target Debug compilation with signing disabled passed (`/tmp/permitext-perf18-browse-build.log`); no simulator or phone installation occurred. Rendered behavior and physical timing remain unverified. Settings remain unexposed pending exact-source navigation handling.

## Exact-source decision model

A pure metadata-target resolver now distinguishes allowed, requires explicit enable, and unavailable. An explicit canonical edition or full identity restricts matches and never falls back to another edition. Duplicate identical targets collapse; distinct matching identities are ambiguous, including when only one is enabled. Missing metadata and unavailable preferences fail closed. Resolution never mutates preferences or the current Reader.

The executable Swift contract covers edition/category collisions, reversed candidate ordering, absent/mismatched identities, disabled then explicitly enabled sources, unavailable preferences and nonmutation. Model, lifecycle, Search and Browse host contracts also pass. Application metadata adapters and UI prompts remain pending; this is not a user-facing navigation acceptance claim.

## Guarded explicit navigation integration

New Search/recent and Saved/Project destinations now preflight the canonical edition and metadata category before preparing a Reader or decoding the passage. Disabled sources offer explicit Enable and open or Cancel. Saved destinations preserve their category hint. Owner-delegated enabling validates captured account, reader/owner session, source revision and owner object identity; stale or failed acceptance cannot write another account's preference. Already-visible public passage text remains available, including pending reference completion. Legacy explicit SQLite navigation retains its existing loading path; the authored resolver does not invent SQLite source identities.

URL/Research routing no longer selects the main Reader's edition first. Explicit editions stay authoritative; bare authored references must resolve uniquely, otherwise an error is shown. Bare references in a mixed authored/SQLite catalog conservatively remain unavailable because this resolver cannot establish legacy identity uniqueness. Cold-launch links await version discovery and then the resulting content task. Navigation is cancelled on account/source context changes.

Actual-method host tests cover metadata-only reads/store reuse, ambiguity/missing editions, asynchronous account/revision changes, owner/shadow writes and rejection, failed writes, exact citation queuing, delayed initial catalog/content loading, cancellation and one-shot route consumption. Source model/Search/Browse regressions remain part of the aggregate suite. These tests do not establish rendered prompt behavior or phone latency; Settings remains unexposed until remaining acceptance/integration is ready.

Validation for this integration: `npm run test:active-code-sources` passed all seven suites. Generic physical-iOS-target Debug build with signing disabled passed (`/tmp/permitext-perf18-navigation-final-build.log`). No simulator, installation, deployment or on-device prompt acceptance occurred.

## Native settings and recovery implementation

Settings now presents exact category toggles with edition labels, account/device-local scope, loading/retry and unavailable-preference handling without resets. Category metadata is read off-main and cached; repeated toggles preserve rows and avoid re-reading unchanged catalogs. Guest choices remain device-local. Browse distinguishes disabled sources from missing chapters and unavailable preferences. Search describes enabled scope honestly and confirms all-disabled status from installed metadata rather than counting preference entries. Both surfaces offer source management; second-Reader entry uses the account owner model.

Independent review also found a shared-Reader edition race: a delayed body load could enter the newly selected edition's section-ID cache. Authored and SQLite async publication now checks the requested version and loader/store identity. Reader checks its expected edition before/after body loading and offers a recoverable retry on a competing version change. Held-body host tests cover edition change, same-edition store replacement, cancellation and successful caching.

The aggregate nine-suite active-source run passes, including actual metadata-options and section-detail ownership methods. Native rendered controls, guest/account switching, second-Reader management, all-disabled/re-enable journeys and physical timing remain acceptance gaps. Web source controls are still pending. No simulator or phone installation was used.

The source-management entry is also available while all sources are enabled, so guests can make their first selection without a sign-in requirement. The second Reader observes owner source-revision changes and refreshes its enabled projections without replacing the open passage.

Final generic physical-iOS-target Debug compilation passed after guest entry and second-Reader propagation (`/tmp/permitext-perf18-settings-acceptance-build.log`, signing disabled). This verifies compilation, not rendered acceptance.

## Web parity in progress

Web preferences, scoped Search/pagination, Browse projections, explicit navigation guards and source controls are implemented. Focused guest and signed-in Saved/sign-out checks pass, along with real IndexedDB offline acceptance. Full installer, disconnected service-worker reload and two-account browser checks also pass; see the [web implementation record](PERF_18_WEB_SOURCE_SCOPE_IMPLEMENTATION.md). Native physical acceptance and release remain separate gates.


## Prepared physical acceptance build

Signed local development Release **1.0 (41.12)** compiled from source commit `f32b7a209` using generic physical-iOS destination. `codesign --verify --deep --strict` passed; the development debugging entitlement is present for profiling. [Artifact provenance](PERF_18_RELEASE_41_12_BUILD.json) records the executable and signed-resource hashes, UUID and local path. No simulator, installation, upload or release occurred. The [physical checklist](PERF_18_PHYSICAL_ACCEPTANCE_CHECKLIST.md) keeps every device result pending until observed.

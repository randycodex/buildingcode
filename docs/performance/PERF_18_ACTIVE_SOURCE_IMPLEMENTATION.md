# PERF-18 — Explicit active sources

Status: model and integration preparation. No shipped source disabled; no settings UI or native filtering enabled. PERF-17 production downloads remain open pending rollout choice. Proceeding with the recommended reversible preparation after the optional direction question; this does not record owner approval to remove content.

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

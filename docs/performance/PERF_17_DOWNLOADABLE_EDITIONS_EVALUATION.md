# PERF-17 — Downloadable editions evaluation

Status: resource inventory and startup-path inspection in progress. No shipped content removed, no installed scope changed, no download feature released. Owner decision on default content and rollout remains required after measured prototype/migration proposal.

## Reproducible resource inventory

Run `python3 Tools/performance/edition_pack_inventory.py` from the repository root. Committed output: `PERF_17_EDITION_RESOURCE_INVENTORY.json`. It inventories logical file bytes, per-file zlib level6 estimates and a content digest for each authored pack. Compression is comparative only: it is not an IPA or App Store download estimate. Shared resources, executable, signing, runtime caches and filesystem allocation are excluded.

| Pack | Logical MiB | zlib estimate MiB |
| --- | ---: | ---: |
| 2014 construction | 93.80 | 35.39 |
| 2022 construction | 151.15 | 63.54 |
| 2025 specialty | 13.19 | 3.86 |
| 2026 enacted administrative | 103.97 | 31.80 |
| 2026 existing building | 4.13 | 1.07 |
| 2026 zoning | 212.01 | 145.24 |

All authored packs total606,342,108logical bytes. Proposed2022/2014 defaults total256,848,531bytes; other packs349,493,577bytes. This establishes a substantial resource-storage opportunity, not a launch-speed result. Assets already compressed as images/PDF can dominate estimates; per-directory details remain in JSON.

## Source architecture constraints

The Xcode resources phase copies CodeContent as a folder. Legacy SQLite/Figures references in the project navigator are not themselves proof those directories ship; resource-phase membership must decide the distribution accounting.

1968 Building Code is a category in the enacted-administrative pack, not a standalone edition folder. That pack also contains other administrative/source families. A setting to disable1968 cannot simply disable/remove this entire pack. Likewise2025specialty contains Energy and Electrical content. Downloadable pack boundaries and user-selectable source identities must stay distinct.

The current native launch selects one version and loads that store, with priority chapter/search warming. Unopened bundled assets are not all decoded at launch. All-edition Search constructs stores for available versions before its cache/revision processing; source-scoped search may reduce work, but removing bundled bytes alone does not establish faster chapter or startup timing.

## Remaining PERF-17 work

1. Complete exact source-identity and launch/read-path evidence, including shared definition resources and per-pack derived/prepared duplication.
2. Build an isolated revisioned pack prototype with integrity manifest and atomic installation; retain existing application bundle unchanged.
3. Test interruption, insufficient storage, corruption, update/rollback and installed revision coexistence using temporary host storage; then retain explicit phone acceptance.
4. Specify catalog discovery, scope-aware search-cache invalidation, saved/deep-link source resolution, offline states and existing-install migration.
5. Measure equivalent full/default prototype storage and startup/search work separately. Host measurements cannot replace final physical-iPhone performance.
6. Present default code-family/rollout decision to owner before removing shipped editions. PERF-18 active-source controls remain separate.

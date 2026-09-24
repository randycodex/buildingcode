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

## Integration and migration proposal (not enabled)

1. **Catalog identity.** Introduce an installed-pack registry alongside bundled discovery. Preserve current canonical server edition identifiers and authored code/category identifiers. A source key must include canonical edition, jurisdiction, code and category; numeric chapter/category IDs alone collide between editions. `sourceCategories` in the inventory records the existing bundle-local IDs, not a new global identity scheme.
2. **Manifest trust.** A release-controlled catalog supplies the expected manifest digest and minimum compatible reader schema. The manifest binds pack ID, revision, source identities, every file path/size/hash, and text/index/media together. A self-declared checksum fetched with arbitrary content is not a trust boundary. Production catalog signing/key rotation/transport policy must be decided before live downloading; the host prototype accepts a trusted expected digest from its caller.
3. **Installation.** Copy/download into a staging directory on the same volume as the installed registry. Verify available capacity, manifest/schema compatibility, safe paths, file sizes/hashes, and exact file membership. Reject symlinks and traversal. Publish the immutable revision only after verification; atomically replace the active-revision pointer. Cancellation, partial transfers and validation failure leave the previous active revision usable.
4. **Updates and rollback.** Keep the previous validated revision until the new one is active and no Reader still references the old path. Readers hold revision-specific URLs; an update must not mutate their files in place. Do not clear old revisions merely to satisfy a download's space estimate. A failed update has a retryable status, never an empty active pack. Rollback validates the retained revision before making it active.
5. **Existing installations.** Treat every current bundled pack as installed and available. Do not migrate users to only2022/2014 automatically. Existing downloaded libraries, bookmarks and historical references remain intact. Removing bundled resources from a future binary requires an explicit migration design that preserves already-promised offline access before the old binary resources disappear; a background download cannot guarantee that migration when the app updates offline.
6. **Saved/linked content.** Keep saves, projects, annotations and links visible regardless of enabled Search scope. Resolve the exact canonical source/revision through bundled or installed catalogs; never substitute2022text for a historic reference. If required content is unavailable, offer its exact pack download and state offline unavailability. Failure must preserve the user's original reference and any draft.
7. **Search and caches.** Build cache keys from the ordered enabled source identities plus validated corpus revisions and engine revision. Installation alone does not silently enable a source the user disabled. Disable/scope change cancels obsolete query/preview/warming work; an old partial or differently-scoped result set must not be presented as complete current-scope results. Show available-but-not-installed editions through deliberate discovery, with clear coverage.
8. **Startup.** Replace app-version-only scan invalidation with registry/catalog revision invalidation. Resolve current/recent sources first; background pack checking must not gate reading already-validated installed content. Preserve the existing priority-chapter warming policy and measure any new registry cost.
9. **Web parity.** Web server corpus availability differs from iOS installation. Do not interpret an iOS pack download setting as an account-wide source deletion. Whether enabled Search selections sync across devices is a product decision; until chosen, retain device-local scope and full saved-reference identity.
10. **Owner decision.** Proposed default packs mean all five categories in each2022/2014construction pack. They exclude zoning, specialty, enacted administrative and existing-building packs from a hypothetical new-install default only. Present measured benefit, offline migration tradeoff and source coverage before approving such a change. No binary resource removal is authorized by this prototype.

### Source evidence

- `BundleDatabaseLocator.swift:39,100`: discovery/cache anchored in Bundle.main and app version; downloaded files require a registry abstraction.
- `CodeLibraryViewModel.swift:665,6060,6126,6466`: selected-store startup and priority warmup.
- `CodeLibraryViewModel.swift:1922–1965`: all-edition store preparation precedes completed-result cache lookup.
- `CodeLibraryViewModel.swift:752,2273,6975,7074`: canonical saved source selection, actual section membership for links and complete-catalog Saved handling.
- `AuthoredCodeStore.swift:532`: bundle metadata load, separate from prepared chapter bodies.

Line numbers describe the inspected performance branch before prototype integration. The prototype will not itself modify these application paths.

## Prototype export checkpoint

`Tools/performance/prepare_edition_pack.py` exports complete authored directories unchanged to a new destination and creates an exact-file SHA256 manifest. Revision IDs derive deterministically from sorted paths/sizes/hashes. Export refuses existing destinations, source-contained destinations and symlinks. Temporary synthetic checks passed deterministic identity/digest, no-overwrite and symlink rejection.

A complete Existing Building Code export contains276files and4,330,582logical content bytes, with a38,645byte manifest. This is preparation evidence only; installation timing/rollback tests are recorded separately once executed. Prototype source identities are explicitly namespaced as `prototype:<pack>:code:<id>:category:<id>`; they must be mapped to existing canonical server edition identities before any application integration. No production reference identity was changed.

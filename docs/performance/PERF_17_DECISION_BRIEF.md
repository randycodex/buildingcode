# Optional editions: decision brief

Recommendation: retain all currently bundled content for now. Prioritize explicit active-source controls (PERF-18) for search and background work; pursue smaller new-install downloads after real-device validation and an offline-safe migration design. This is a recommendation, not a recorded owner decision.

## Evidence supporting the recommendation

1. Complete content-pack archives measure285.20MiB for all six packs versus101.21MiB for2022/2014. These are host ZIP sizes, not App Store sizes. Expanded authored files total578.25MiB versus244.95MiB. Smaller default downloads have a substantial storage benefit.
2. Extracted native matching for `concrete` measured median200.71ms across six packs versus56.53ms for2022/2014. Retained-edition ordered IDs match. This excludes UI, full app initialization and completed-result cache hits; it is not a phone latency promise.
3. The reduced scope omits286matches from other packs in this sample. Explicit enabled-source controls make that tradeoff visible while retaining installed material for reactivation and saved references.
4. Startup already loads the selected store rather than decoding all bundled chapter bodies. A smaller binary does not automatically accelerate chapter opening. Physical startup benefit remains unmeasured.
5. The isolated installer validates complete files, preserves old revisions on injected failures and supports validated rollback. It has no network downloader, real catalog integration, persistent transfer resume, production trust/signature distribution or power-loss durability guarantee.

## Proposed default coverage, if approved later

2022 and2014each retain all five construction-code families: Building, Administrative Provisions, Fuel Gas, Mechanical and Plumbing. Zoning,2025Energy/Electrical,2026Existing Building and the enacted-administrative pack would be optional for a hypothetical new install. The1968Building Code is a category inside the enacted-administrative pack; removing that whole pack also affects other sources. Do not equate pack availability with enabled category selection.

## Acceptance accounting

| Plan requirement | Evidence | Unfinished |
| --- | --- | --- |
| Inventory/distribution/storage | Per-pack bytes, ZIP sizes, category IDs, prepared/media breakdown | Actual signed/thinned App Store size and runtime storage |
| Default-pack prototype | Complete exports and host installs; unchanged corpus hashes | App-installed catalog discovery and on-device prototype |
| Revision/integrity/compatibility | Host manifest, hashes, atomic pointer, rollback, compatibility rejection | Canonical app identity integration, real Reader compatibility contract, network resume |
| Search scope/cache | Extracted native scope benchmark; implementation points identified | Downloaded catalog wiring, completed-cache invalidation and scope UI |
| Saved references/deep links | Canonical resolution path documented | End-to-end unavailable-pack/download/reopen checks |
| Existing-install migration | Explicit preserve-offline/access proposal | Proven migration across app update while offline |
| Failure and performance matrix | Host injected interruption/corruption/budget rejection/rollback; full corpus verification | Real disk-full, network interruption, phone startup/search/memory, production transport |

PERF-17 is not fully accepted. No resources have been removed and no enabled scope changed. A decision to defer production downloads should be recorded explicitly, not disguised as completed implementation.

## Choices

1. **Recommended:** keep all bundled editions, finish acceptance of the implemented active-source controls, and retain the download prototype for a later release. This targets measured search work without risking current offline availability.
2. Build production downloads in this release in addition to the implemented active-source controls. This requires the remaining integration and migration work above; it still does not authorize content removal before rollout approval.

The owner must choose default content and rollout before any bundled editions are removed. The existing performance work can continue without removing them.

September25 update: the isolated canonical source catalog now maps six packs to all22 native source identities and passes production-type roundtrip/coverage checks. Installer-manifest binding, application discovery, trust/transport and migration remain unfinished; this does not change the rollout recommendation.

Schema2 follow-up binds canonical sources to verified bundle metadata in the installer. Six host Swift tests and a real276file install/reopen pass. Network, application integration, migration and phone acceptance remain open.

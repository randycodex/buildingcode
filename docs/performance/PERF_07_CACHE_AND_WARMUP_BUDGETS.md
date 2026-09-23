# PERF-07 — Cache and warmup budgets

Status: bounded-cache and speculative-admission implementation complete with targeted host checks and generic unsigned iOS Release build passing. Broader PERF-07 scope and device acceptance remain open; no phone or simulator used. Device memory stability and post-purge responsiveness remain unmeasured.

## Current inventory

| Owner | Retained data | Existing budget / policy | Work |
| --- | --- | --- | --- |
| NativeReaderDocumentStore | Prepared chapter documents and display/navigation derivations | Four documents, estimated 48 MiB, LRU; coalesced in-flight consumers, generation-safe memory purge | Speculative admission cannot evict existing entries; foreground admission evicts speculative entries first; shared demand promotes preparation |
| CodeLibraryViewModel | Section details, attributed passage text and chapter text | NSCache: 24/16/16 MiB cost limits | Existing memory purge retained |
| CodeLibraryViewModel | Current authored store and all-edition search stores | Store references retained for repeated use | Route memory warnings to every distinct retained store |
| AuthoredCodeStore | Prepared section data/blocks/previews, missing IDs, synthesized rich blocks and completion markers | Previously unbounded dictionaries | Each prepared/synthesized cache capped at 256 entries / estimated 8 MiB, coherent per-section LRU and generation-safe purge |
| AuthoredCodeStore | Catalog, section identities, search indexes/text access | Edition-specific immutable store and corpus-backed search data | Retain lightweight lookup data so a purge need not restart corpus discovery |
| SearchView | Visible-row preview workers | PERF-05 caps active extraction at two; obsolete consumers discarded | Queue cancellation covered by host test |
| Startup/category warmup | Last-opened, current-edition recent, then initial chapters | Shortlist already capped by preparedDocumentCountLimit; pauses on explicit interaction/search/memory warning | Original five-vs-four issue was fixed under PERF-03; speculative cache hits no longer alter foreground recency; warm preparation starts at utility priority |

Cache cost estimates are accounting bounds, not measured process RSS. Current displayed value snapshots can retain content independently of evictable caches. Durable Saved content, continuity and sync queues are outside these caches.

## Validation

The model memory-warning host contract executes the actual handler with fixture stores, proving deduplicated purge routing across current/historical stores, retained references and no mutation of current/durable state. The authored test passes 40 exact rich-block parity cases plus count/cost eviction, hot-entry retention, oversized sequential reuse, deterministic in-flight purge, concurrent reads/purges and post-purge reload. The native admission host test passes speculative cost/count limits, foreground LRU, shared demand promotion, independent consumer cancellation and memory-warning generation. Existing chapter fast-path, recent-priority and warmup-resume contracts pass. All six generated search-pack checks pass. Generic unsigned iOS Release compilation passed (`/tmp/permitext-perf07-build.log`); this is compilation only, with no installation or device/simulator run.

## Remaining acceptance

Repeated broad searches and chapter visits, background/foreground cycles, memory pressure and post-purge reopen require physical resource/latency measurements before claiming stable device memory or unchanged responsiveness. Retaining search indexes deliberately favors repeated search speed; their aggregate memory still needs measurement.

## Implemented safeguards

- Each authored store keeps prepared and synthesized rich payloads in independent bounded LRU caches. Oversized individual values are returned without retention and do not flush other entries. Replacement subtracts prior accounting cost. These are initial explicit safety budgets, not device-tuned RSS limits.
- A synthesized chapter-complete marker is invalidated when any rich entry evicts. Oversized chapters retain a bounded forward window beginning at the requested passage, avoiding a full reparse for every sequential section.
- Memory purge increments generations. Decodes already running may return valid content to their callers but cannot repopulate the purged generation.
- Native chapter warmups use speculative requests. Shared foreground consumers promote admission, and cancellation of a warmup leaves another consumer's required task alive. Warm hits do not change demand recency. Demand misses evict the least useful speculative entries before ordinary demand LRU entries.

## Remaining scope beyond this change

Native chapter loads already coalesce; prepared-section and prepared-block decodes now coalesce concurrent callers through shared in-flight results. Oversized values and decode failures reach every waiter even when nothing is cached; purge detaches old work and identity-checked retirement preserves newer requests. Synthesized HTML extraction now also shares identical targeted requests and full-chapter requests. Full-chapter waiters receive the complete decoded batch long enough to select their own passage, independently of bounded cache retention. Targeted and full requests remain separate; different targeted sections remain independent. Search indexes and per-view completed preview strings are retained and need aggregate resource measurements before selecting further budgets. Physical memory stability and latency acceptance remain open.

Prepared decode follow-up: `native-prepared-coalescing-contract.py` passes deterministic simultaneous data/block reads, oversized result delivery, invalid-JSON nil delivery and overlapping purge generations using production methods with controlled disk barriers. The rich parity contract still passes40cases. Generic unsigned iOS Release compilation passed (`/tmp/permitext-perf07-coalescing-build.log`). This follow-up is not installed on the phone; installed41.10 predates it.

Synthesized coalescing follow-up: the40-case rich contract now additionally exercises simultaneous same-target requests, full-chapter callers requesting different sections (including outside the retained256-entry window), targeted/full independence, empty results and overlapping purge generations. Prepared coalescing and all six search-pack fingerprint checks pass. Generic unsigned Release compilation passed (`/tmp/permitext-perf07-synthesis-build.log`). No additional changes installed yet.

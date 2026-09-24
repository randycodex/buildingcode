# PERF-13 — Revision-safe public content caching

Status: locally complete for web on `codex/permitext-performance`. Not merged, pushed or deployed. No phone/simulator used. Production/CDN verification remains a separate release check.

## Implementation and evidence

1. Explicit public code GET routes use a bounded process cache (32 MiB, 256 entries, maximum 2 MiB per retained response). Keys include the aggregate corpus revision and every query parameter except the optional representation pin. Private/account routes retain `no-store` and do not enter this cache.
2. Exact serialized bytes produce the ETag. Ordinary URLs revalidate; matching conditional requests return empty 304 responses. `contentRevision` pins the exact representation hash and enables immutable caching only when it matches. Mismatches return uncached 409. Error responses remain uncached.
3. `/code/revision` identifies all six source families, the public response contract and the byte-derived figure asset revision. Requests may pin `expectedPublicCorpusRevision`; chapter windows may additionally pin `expectedCorpusRevision`. Conflicts return 409 before publishing content.
4. Offline text installs pin one public revision across catalogs, metadata, manifests and bounded body windows. Each window validates chapter revision, edition, range and ordered IDs. A final revision check precedes atomic activation. Old installed text remains available if replacement fails. New clients safely refuse new installs against legacy servers lacking revision contracts; they do not combine unversioned pages.
5. Background single-flight revision probes run at startup, visible intervals and reconnect. Warm reads do not wait for them. Revision changes (including rollback) and reconnect clear dependent chapter/list/section caches. Generation guards suppress late responses. Whole requests retry once; mismatched windows reload the manifest and recompute the target instead of reusing old ordinals. Indexed Search openings retain their expected revision and require a new search if it changed.
6. Same-digest initial responses can be accepted after the first revision probe without redundant refetching. Real revision transitions, reconnects and unverified offline completions cannot use this exception. Failed background probes preserve usable cached reading. Progressive recovery errors cannot replace newer navigation.
7. A checked-in manifest hashes all 1,111 assets in actual serving precedence. Build verification hashes their bytes; runtime reads the small manifest. Image-only updates change the aggregate revision. Pinned asset responses validate bytes, and mismatches fail without caching. Offline figures use revision-specific caches. Figure-bearing blocks retain their source pin; plain paragraphs remain unchanged to avoid repeated hash overhead. Legacy installed URLs still work. Old revision caches remain available for open/older readers and are removed by explicit offline-library removal.
8. The figure URL helper changed the Reader projection fingerprint, requiring all 578 compressed indexes to be rebuilt. Every decoded field except `projectionRevision` matches both the previous artifacts and Git HEAD across 32,551 sections. See `PERF_13_READER_PROJECTION_EVIDENCE_2026-09-23.json`.

## Verification

- `npm run test:public-code-cache` covers exact hashes, empty 304s, pinned URLs, query/scope/edition/mode/pagination isolation, real asset bytes, private/error exclusions, update/rollback, warm reads, stale completions and bounded recovery. `PERF_13_HTTP_EVIDENCE_2026-09-23.json` records local timings and bytes, not production/device measurements.
- The browser fixture passed a complete 3-chapter/67-section install, failed replacement preserving old content and private draft/image, and successful retry preserving historical edition identity. Actual figure decoding succeeded from the pinned cache while the figure endpoint failed. `PERF_13_OFFLINE_BROWSER_EVIDENCE_2026-09-23.json` contains the clean final run. An earlier fixture-shell failure was corrected by adding missing generated analytics/static routes to that isolated fixture.
- Final browser reload showed seven public requests without the previous startup duplicates, visible Search results, no loading shells and conditional-transfer sizes. See `PERF_13_STARTUP_BROWSER_EVIDENCE_2026-09-23.json`.
- Offline, Search interaction, workspace access/hydration, Reader navigation/search/scroll, chapter v2 HTTP/revision/client and backend checks pass. Full `npm run smoke` passed; targeted checks were repeated after final startup/figure refinements.
- `npm run verify:deploy-content` passed after index regeneration: asset manifest verification, 21,472 published body files and all 578 search indexes.
- Shell generation `20260923-public-cache-v569` / cache 1212 includes revision and asset identity modules. Public code APIs remain outside the service worker's catch-all cache; explicit figure URLs use revision caches.

## Limits and maintenance

Browser evidence uses a local synthetic workspace and dedicated offline fixture. It does not prove physical iPhone timing, production cold starts or deployed CDN hits. New installs against pre-contract servers fail safely while existing installed content remains readable.

Bundled corpus files and existing content indexes are immutable during a server process lifetime. Deployments create fresh process caches. Increment the public response contract when its projection semantics change; per-response hashes independently protect immutable representation URLs. Build verification must regenerate/recheck the asset manifest whenever image bytes or serving precedence changes.

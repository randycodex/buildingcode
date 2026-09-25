# PERF-09 — Compact web Reader chapter windows

## Change

The web Reader opts into `bodyContract=2`. It fetches the navigation manifest once; subsequent body windows contain only requested `{id, blocks}` entries, range/total, chapter and edition identity, and a corpus revision. Old clients retain their existing complete response shape. Full-chapter `include=body` calls also retain titles/groups/metadata, including when opting into v2.

The revision combines the generator's full source fingerprint with ordered chapter metadata, so body edits, canonical IDs, aliases, navigation projection and index order invalidate incompatible windows. Literal manifest loaders make all six revision files visible to deployment tracing. Client window cache keys include edition and revision. Before merging, the Reader checks chapter, edition, prefix, revision, exact range, complete ordered IDs and body arrays. An incompatible response clears that chapter's cached manifest/windows and asks the user to reopen; network failures remain retryable. Existing render tokens prevent late navigation results from being appended.

The Reader preserves raw manifest indices until bodies load, then collapses repeated catalog aliases in the DOM. This avoids index drift when a full chapter is already cached. Complete cached chapter bodies can now supply windows without another request. Shell/import cache versions advance together to v557/shell1200.

## Measured evidence

Chapter 33, 1,029 sections, first five bodies:

| Measure | Existing response | Compact response |
|---|---:|---:|
| Decoded JSON | 359,819 bytes | 4,696 bytes |
| Estimated gzip, default settings | 54,338 bytes | 1,140 bytes |
| Local JSON.parse median, 200 iterations | 0.6433 ms | 0.0050 ms |

This reduces the window payload by 98.7%. Gzip is a computed estimate, not observed CDN transfer. Parse times are local-host microbenchmarks, not app opening latency. The manifest remains approximately 355 KB and the cold opening still uses a manifest request followed by a body request. A combined selected-section opening response was considered but deferred: it needs a separate target/remembered-position contract to preserve navigation and scroll behavior; this change removes repeated manifest transfers without changing that sequence.

An isolated Chrome guest workspace rendered Chapter 1 and Chapter 33, loaded a subsequent 12-section window, then jumped to 3310.1 and prepended earlier sections while retaining the selected passage at the top. No browser errors were reported. Screenshots were inspected. A fresh browser runtime restoring that workspace inserted its first rich section into the DOM at 201.9 ms on localhost with a warm server. This is one functional timing sample, not a before/after speed claim or first-paint measurement.

## Tests

- `tests/chapter-body-v2-http-contract.mjs`: 23 representative cases across all six source editions, legacy/full-body compatibility, bounded/empty windows, and every Chapter 33 window with exact ID/body parity.
- `tests/chapter-body-v2-revision-contract.mjs`: source, order and navigation identity changes; hydration stability; retry after unavailable/malformed revision; legacy independence.
- `tests/chapter-body-client-contract.mjs`: edition/revision/range/order rejection, cache separation/invalidation, network retry, legacy fallback, and reuse of complete cached bodies.
- Existing Reader navigation race, scroll continuity and search recovery contracts passed. The complete local server smoke suite also passed; its source check was updated to allow the new revision-mismatch status alongside the existing network-retry status.
- Offline shell/install contracts and deploy-content verification passed. Full API file tracing from the repository root includes all six revision manifests.

Sanitized metrics and browser evidence: `PERF_09_CHAPTER_WINDOW_EVIDENCE_2026-09-23.json`.

## Remaining acceptance

Production/CDN transfer, cold-server first paint and constrained-network timings are not measured. Browser verification used a guest test workspace; signed-in annotation persistence was not mutated/tested here, though section/block identities are exactly preserved by server parity checks. No main merge, production deployment or phone build is part of this web change.

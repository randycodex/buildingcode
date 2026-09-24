# PERF-18 web source scope

Status: foundation and server Search scope implemented locally; focused HTTP cursor verification passed. The web UI does not yet read these preferences or submit a source scope. No deployment or rendered acceptance is claimed.

## Contract

1. Use canonical edition, jurisdiction ID, code ID and category ID as source identity. Prefixes alone cannot distinguish 2014/2022 Building Code. BC68 remains separate from the seven sibling categories in its administrative pack.
2. Missing local preferences mean all enabled. Corrupt/unsupported preferences must not be replaced or treated as all enabled. Keep disabled identities even if absent from a later installed catalog. Keep guest and exact account namespaces separate; do not sync this preference through workspace continuity.
3. Requests may carry `sourceScope` JSON `{version:1,enabledSources:[identity,...]}`. Absent retains the legacy full-scope behavior. Present empty means zero sources. Reject duplicate parameters, malformed versions/identities and unknown installed sources with HTTP 400. Never broaden a bad request. Sort/deduplicate identities before generating the URL; include no account identifiers in this public request.
4. Skip wholly disabled Search families before index loading. For mixed families, restrict section candidates before intersections, numeric prefix unions, body verification and pagination. Keep counts/order/cursors consistent with the restricted candidate collection. Existing exact matching/ranking remain unchanged.
5. Search pagination captures the same source scope, account/session, workspace and local preference revision as its first page. A selection change cancels pending requests, invalidates completion tokens and restarts the current query without deleting history. Public corpus revision and preference revision remain separate.
6. Keep full catalogs and installed Reader assets. Filter only ordinary browsing projections and new Search work. Already-open chapter reading and its in-chapter Find remain available.
7. New Saved, Research and URL navigation resolves metadata first. Disabled-source navigation offers Enable and open/Cancel before a body fetch or Reader replacement. Capture account/session/workspace/preference generation in the pending action. Enable only the exact resolved identity, then retry that destination. Cancel preserves existing Reader state.
8. Offline Search applies the same identity scope before text matching. Old installed records without sufficient source metadata must not silently bypass restrictions. Preserve the atomic installed-library pointer and saved work.
9. Settings lists category switches with edition labels and account/device scope. Support guests, all-disabled explanation, metadata loading/error retry, and disabled-source recovery links. Do not use counts of disabled preferences to infer all installed sources are disabled.

## Delivery sequence

1. Pure browser preferences, exact metadata catalog, validated scope parser and candidate matcher contracts.
2. HTTP Search scope integration, family skip and mixed-category restrictions, cache/pagination parity tests.
3. Publish exact source identity on libraries, chapter/section metadata and Search results; add metadata-only navigation resolution.
4. Wire account-scoped browser lifecycle, Search/pagination cancellation and enabled Browse projections.
5. Implement offline source metadata/scope matching and old-record behavior.
6. Add Settings controls and guarded explicit navigation across all entry points.
7. Run local rendered guest/account, disable1968, 2014/2022 distinction, all-off/re-enable, saved-link cancellation, offline and stale-response cases. Run relevant regressions/offline/smoke gates. Record production and physical-device gaps separately.

## Current files

- `permitext-sync-server/public/active-code-sources.js`: browser-compatible immutable preferences and storage adapter.
- `permitext-sync-server/active-code-source-catalog.mjs`: exact authored metadata catalog; bounded header reads avoid decoding tables/passages.
- `permitext-sync-server/active-code-search-scope.mjs`: strict optional Search scope parser.
- `permitext-sync-server/app.mjs`: candidate matching and HTTP Search integration.
- `permitext-sync-server/public/app.js`: future account lifecycle, Search/pagination, navigation and Settings wiring.
- `permitext-sync-server/public/offline-storage.js`: future offline parity.

The complete installed catalog currently has 22 source identities. Its all-enabled scope token is 3,203 UTF-8 bytes (4,323 URL-encoded characters), below the parser's 8,192-character JSON bound. This is request-size evidence, not latency evidence.

## Foundation and server checkpoint

The browser preference module, validated22-source catalog and strict request parser pass focused tests. `/code/libraries` now publishes additive `codeSources` metadata. Search accepts the explicit scope while retaining the unscoped request path. Disabled families skip catalog/index reads; mixed-family candidate IDs intersect exact canonical/category identity and requested prefixes before matching and body verification. Empty scope exits without accessing a Search index.

Candidate tests compare the production matcher against its frozen previous behavior, preserving insertion order for word/phrase/numeric queries, array/Set/typed postings and default scope. HTTP tests verify additive catalog metadata, all-enabled parity across22 source requests, distinct2014/2022 Building results,1968 inclusion/exclusion, pagination and400/no-store invalid-scope handling. This is local functional evidence, not production timing. Browser account lifecycle, visible switches, guarded web navigation and offline filtering remain unimplemented.

Exact-match cursor HTTP coverage also passes for BC68,2022Building and2014Building: first page plus cursor continuation retain ordered parity with the same-scope larger page, exact edition identity, truthful incomplete totals and all-enabled baseline parity. The five-suite `test:web-active-code-sources` aggregate, existing backend performance contract and public-response-cache contract pass. No web UI has been changed or released.

## Metadata, lifecycle and offline checkpoint

`/code/sections/:id?include=metadata&version=<canonical>` resolves an exact source from catalog summaries and returns a whitelist with `codeSource`, without invoking rich passage providers. A mismatched explicit edition is rejected rather than substituted. Actual HTTP tests cover22 source representatives, aliases, invalid versions and body-provider exclusion. Cold catalog creation can still parse prepared chapter summaries; this is not a claim of zero text parsing.

The browser lifecycle controller owns exact account/session/revision tokens, rejects foreign or stale captures, suppresses late catalog publication and notifies observers only after consistent state transitions. Failed preference writes block scoped requests until recovery. Explicit catalog invalidation preserves choices while rejecting old corpus responses. Application/DOM wiring remains pending.

New offline downloads persist validated source metadata. Scoped Search checks exact identity before text matching/snippets; missing or ambiguous identity fails recoverably rather than yielding an incomplete apparently complete list. Metadata-only offline responses expose the same identity field and enforce exact requested editions. Legacy unscoped downloads remain usable; an old snapshot without source metadata cannot execute nonempty scoped Search until its offline metadata/download is updated. Installed content and active-install pointers are not deleted. IndexedDB cursor values still deserialize rows; this change reduces matching work, not row decoding.

The new browser modules are in both offline shell precache lists. Shell assets advance to `20260924-active-sources-v576` / shellv1219. Existing offline import-graph, activation, install recovery, revision coherence and aggregate pin contracts pass. No visible source switches or navigation behavior have been wired into the web workspace yet.

# PERF-18 web source scope

Status: web Search, pagination, Browse projections, offline filtering and explicit navigation guards are implemented locally. Guest source controls pass focused rendered acceptance, including all-off recovery and explicit reactivation. Production, rendered two-account transition coverage and physical acceptance remain open.

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
- `permitext-sync-server/public/app.js`: account lifecycle, Search/pagination, navigation and Settings wiring.
- `permitext-sync-server/public/offline-storage.js`: offline filtering and exact metadata resolution.

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

## Browser Search lifecycle integration

Browser startup and account replacement now bind the source controller to exact account identity and the existing account runtime generation. Storage events reload source choices; public corpus changes invalidate catalog metadata. Preference changes rerun only existing Search results and refresh mounted source Settings rows. Search captures source context before first-page requests and carries the same scope through cursor pagination; stale scope/account/workspace completions cannot publish. Query/history and open Readers are preserved.

Local rendered check on isolated localhost8818 (agent-browser session `perf18-web`): guest welcome/Explore opened Reader; Search for `concrete` showed2022/2014 results. A test-injected guest preference plus storage event disabled2022Building;2022results disappeared while2014results, query and open2022Reader remained. Browser error output was empty. This was a seeded preference test, not a Settings-switch acceptance test. Screenshot `/tmp/permitext-perf18-web.png` captures the welcome surface only.

Settings category controls are implemented but intentionally gated off until Browse and explicit-navigation entry points are integrated. The standalone navigation guard passes exact identity, explicit enable/cancel and stale account/workspace tests; it is not yet called by application navigation.

Actual Search helper/controller tests cover default no-metadata-fetch, disabled scope loading, first/page scope binding, stale results/cursors, account change during catalog loading and corruption preservation. Existing cancellation, account isolation, offline/recovery suites pass. The startup test fixture was updated for already-existing public revision polling and pagehide query persistence dependencies; its assertions remain intact (controlled usable shell45.4ms vs blocking fixture247.1ms; not device paint timing). Shell generation is now `20260924-active-sources-v577` /v1220.


## Navigation integration checkpoint — September 24

Explicit Search, Saved/detail, shared URL, inline/structured reference and stale chapter-menu actions now preflight exact source metadata before replacing a Reader or creating a detail pane. Cancel preserves the existing workspace; context checks after metadata lookup, prompts, transitions and pane readiness suppress stale completion. Existing open content remains readable.

`/code/sections/resolve?include=metadata&code=BC&sectionNumber=...&version=<canonical>` resolves number-only references through catalog metadata without invoking Search or rich-body providers. Exact prefix/edition and normalized visible number are required; canonical ID aliases deduplicate, missing matches return404 and ambiguity returns409. Offline resolution uses the same whitelist and rejects ambiguity; IndexedDB rows still deserialize.

The source aggregate now includes actual application-method tests for Browse projections, source opening, detail pane creation, inline/chapter navigation, Settings toggles and startup links. Settings tests cover stable focused rows, all-off, failed storage writes, retry, corrupt-data preservation and stale account/workspace contexts. The full source aggregate and offline recovery suite pass locally. Existing Reader menu, Search cancellation, startup and account-isolation contracts pass.

Rendered local check exposed a guest recovery defect: Manage code sources reached the Settings sign-in gate. Public source management needs its own accessible dialog; account-private Settings must retain its access gate. Do not count guest switch acceptance complete until this is fixed and exercised.


### Rendered guest acceptance

Local browser `perf18-web` at127.0.0.1:8818 verified the source dialog without sign-in, readable labels/scrollable layout,2022Building disable/re-enable while2014remains separate,1968exclusion from the Browse menu, and unchanged already-open Readers. Disabled inline101.4.1 prompts before navigation; Cancel retains the workspace and Enable opens exact sectionID5 in a second Reader. Turning all22sources off shows an explicit Search recovery state; using its Manage action and enabling only2014Building restores only that edition's results for the retained `concrete` query. Both existing Readers remain. Browser errors were empty. Screenshot `/tmp/permitext-perf18-source-dialog-fixed.png` was visually inspected.

The full `npm run smoke` run passed after updating the Research contract's expected guarded call signature. This is local evidence, not a production/device performance measurement. Remaining: signed-in rendered Saved/account-switch scenarios, fully installed offline browser navigation, and physical iOS source-controls/latency acceptance. Very old offline snapshots without exact source metadata preserve ordinary unscoped body access but cannot resolve guarded references until metadata is refreshed; no identity is guessed.


### Real IndexedDB offline acceptance

`npm run test:offline-active-sources:browser` uses an isolated installed Chrome profile and the production offline API with real IndexedDB schema. Three synthetic records carry actual canonical2022Building,2014Building and1968source identities. It verifies all-three/scoped-two/all-off search, exact edition-aware ID/number metadata, body-field exclusion, missing-catalog rejection and byte-for-byte serialized snapshot preservation after failed reads. It does not run the full corpus installer or simulate service-worker/network recovery. The test supports `CHROME_BINARY`; its default is the installed macOS Chrome path.


### Signed-in Saved and sign-out acceptance

An isolated small populated fixture on loopback8819 used synthetic account data only. In fresh browser session `perf18-account2`, account Settings disabled2014Administrative Provisions; opening saved28-101.1 showed Enable/Cancel with no new detail before approval. Cancel left only Saved; Enable opened the exact2014detail. After disabling again and selecting28-101.2, Cancel preserved the existing28-101.1detail and pane count. Reload retained the account preference. Actual Sign Out returned to guest Explore; guest source management showed all22sources enabled with the guest/device explanation. No real owner account, phone, simulator or provider calls were used. A-to-B account-switch races remain covered by actual-method contracts, not a rendered second-account run.

An earlier synthetic browser session became CPU-busy after automated Escape and exited before trace instrumentation connected. Cause is unclassified; neither an app loop nor input contamination is proven. The clean repeat used the native dialog close method instead of a keyboard chord and completed the described checks with no browser errors. Do not include the interrupted run in latency measurements.

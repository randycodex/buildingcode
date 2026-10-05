# Plan 2: isolated Search ranking pilot

This experiment calls the existing local `GET /code/search` handler and sends its first 25 result titles/snippets to Jev for independent navigation-relevance probabilities in a single batch. It never calls a Research endpoint, changes application source, filters results, or modifies live Search order. Exact section-number matches stay first; remaining results sort by probability with stable ties. Returned objects and source metadata remain intact.

The fixed fixture has two section-number queries, six topic queries, and four plain-language queries. Draft target section labels measure known-section findability, not exhaustive relevance, applicability or user satisfaction. Initial labels were reviewed against offline results before provider calls: drinking-fountain target changed from general approval to required fountains, and ceiling targets include both general egress and interior-space height. Labels are never sent to Jev. Missing targets and empty result sets remain visible in results rather than being dropped from quality reporting.

The live pilot makes two attempts for each nonempty result set, with a pinned model, validated scores/usage, 15-second timeout, no automatic retry, and stop-on-error. Empty searches make no provider calls. Only a TypeSafe key is used; OpenAI and production database configuration are cleared in the child process. Local server storage points to a new temporary directory. Reports are private and gitignored under `.typesafe-local/`.

```sh
node --test tests/typesafe-search.test.mjs
node scripts/eval-typesafe-search.mjs
# Explicit owner-authorized live evaluation:
PERMITEXT_TYPESAFE_SEARCH_LIVE=1 node scripts/eval-typesafe-search.mjs --live
node scripts/summarize-typesafe-search.mjs .typesafe-local/REPORT-search-live.json
```

The summarizer adds a post-hoc exploratory comparator: title token overlap, exact section protection and stable ties. This is not a production algorithm or held-out validation. Compare it before attributing an improvement uniquely to semantic AI. Provider latency is added time after existing retrieval, not a Search speedup. Source snippets can omit needed context, and first-page reranking cannot retrieve an absent section or alter later pages. BC/PC filtered queries do not establish cross-code, zoning, historical edition, web rendering or native app behavior.

Provider contract and pricing were checked against https://docs.typesafe.ai/api and https://docs.typesafe.ai/models on 2026-09-18. Keep measured performance private. Promote nothing on the strength of this small draft-labeled pilot alone.

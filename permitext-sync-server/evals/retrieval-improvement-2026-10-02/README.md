# Retrieval evaluation, October 2, 2026

This is a local evaluation. Production settings, user history and answer models were not changed. The answer configuration remains GPT-6 Luna with low effort for writing and medium effort for verification.

The completed report is in `REPORT.md`. The reserved test found 56 correct turns, 11 withheld, one minor issue, one material scope error and one ambiguous key. The candidate remains an experiment and is rejected for production enablement.

The baseline is commit `0efaf6d52`. Fresh source-linked questions and keys were frozen before paid answers: 30 development turns and 70 held-out turns. Questions contain no governing section numbers. Expected references never enter normal retrieval or the writer. Source grading is assistant-reviewed and is separate from the application's verification result; it is not professional adjudication or a product-wide accuracy estimate.

## What changed

- Search exact numbered passages as well as titles and chapter text. Preserve canonical source identity, edition, offsets and hashes.
- Add optional meaning search within the authorized corpus. Exact user references retain priority; missing, changed or unavailable vectors fall back to lexical search.
- Search a follow-up's current detail using brief subject context. Preserve the complete user question, project facts and scenario exclusions for answering and verification.
- Preserve parent conditions, exceptions, complete tables and internal numbered dependencies. Try a complete relevant alternative when an oversized parent cannot fit.
- Let more short provisions share the existing character budget. Selected-evidence boundaries and character caps remain in force.
- Preserve verified code-book identity and definite subject references through follow-ups. Earlier model answers never become enacted authority.
- Remove stale exclusive source bindings when a bounded revision explicitly removes a citation. Preserve shared and mandatory support; require full verification afterward.

## Controls and refresh

The new retrieval remains opt-in with `PERMITEXT_RESEARCH_PASSAGE_SEARCH=1`, `PERMITEXT_RESEARCH_SEMANTIC_SEARCH=1` and `PERMITEXT_RESEARCH_SEMANTIC_VECTOR_PATH` pointing to a prepared artifact. Current-library recall is separately gated. Historical and future-effective sources retain their existing authorization rules.

`scripts/build-research-semantic-index.mjs` defaults to an unpaid inventory. Live indexing requires explicit paid mode and a shared budget ledger. It reuses vectors by embedding-input hash and saves resumable batches. An unknown provider outcome stops further spending. Changed source text invalidates alignment; retrieval resolves the canonical source again before answering. Importing an amendment requires refreshed source metadata and indexing, not model training.

JSON artifacts can be converted offline to a smaller binary artifact with identical normalized Float32 values. Keep prepared artifacts and provider logs outside Git. Test loading and cold-start resource use before a hosted rollout.

## Acceptance and next work

Development results are recorded in the source-review JSON files. Reject a candidate that shifts failures or increases wrong conclusions. Freeze candidate hashes and configuration before opening held-out answers; do not tune against those results. Report decisive-text recall, correct answers, withheld answers, wrong answers, complete conversation families, elapsed time and usage-priced cost separately.

Broader confidence requires representative project-linked questions, independent professional review of source keys, and continued evaluation after corpus amendments. A small curated test cannot establish 95% accuracy across NYC code research.

## Production rollout gates

The normal application semantic client does not yet reserve or settle query-embedding usage through its provider accounting. The isolated runner does account for every query embedding in the shared campaign ledger. Keep semantic search disabled outside that runner until the normal accounting integration is complete.

One local macOS/Node 24 measurement built the full 52,946-passage current index in 9.47 seconds and retained about 1.13 GB RSS after loading the binary vectors and collecting garbage. This excludes semantic alignment, queries and model calls. The 53.1 MB binary artifact alone loaded in 150 ms with about 147 MB process RSS; the 235 MB JSON artifact alone loaded in 1.34 seconds with about 852 MB process RSS. These are single local measurements, not a hosted benchmark. Prepare/share the passage index, control corpus cache duplication, and verify hosted cold starts and concurrent memory before enabling the feature.

Before rollout, also run realistic project-linked conversations with structured facts, deploy the prepared artifact to controlled storage, and verify version changes, missing-artifact fallback and refresh behavior. Canonical text remains answer authority. New code editions and amendments require source ingestion and index refresh, not model retraining.

## Evidence and status

`candidate-freeze.json` records the candidate source hashes, vector artifact and fixed model settings before the 70 reserved turns are opened. `campaign-summary.json` records each complete development run separately; the nine-turn V4 check is not a new 30-turn score. `validation.json` records focused checks. `semantic-loading.json` and `candidate-code-review.json` record operational limitations. Raw provider requests, responses and prepared vectors are preserved outside Git at `/Users/randy/.codex/artifacts/permitext-retrieval-improvement-2026-10-02/`.

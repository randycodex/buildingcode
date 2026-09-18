# TypeSafe intent experiment

Local, observation-only evaluation of Jev as an aid to Permitext Research. Terra continues substantive reasoning and answer generation. Nothing here is imported by the server or changes live routing, source authority, citations, or customer answers.

## Scope and evidence

The 23 fixtures contain 20 synthetic questions and three questions copied from approved cases in `research-cases.json`. All new intent labels are **draft**: original answer-case approval does not approve classification labels. Expected labels and provenance never enter the provider payload. Review labels before treating results as accuracy evidence. No customer records, account data, source documents, or project storage are loaded.

Five categories: code lookup, project application, calculation, DOB procedure, mixed/unclear. Fixtures cover paraphrases, negation, misleading numeric content, mixed requests, and an injected classification instruction.

The existing router is not a five-category classifier. The report preserves its bounded-lookup and DOB-workflow signals and its question-only hybrid tier. This is an explicit local hybrid configuration without assembled evidence, not a claim about production routing. No invented baseline classification accuracy is reported. A matched Terra classification comparison remains a separate follow-up requiring its own cost bounds.

## Offline use

From `permitext-sync-server`:

```sh
npm run test:typesafe-intent
npm run eval:typesafe-intent
```

The default runner never loads `.env.local` or contacts a provider. It writes an ignored report to `.typesafe-local/`, with fixture/prompt hashes, existing routing signals, request count and cost reservation. Offline reports contain no Jev results; mocked tests demonstrate adapter behavior, not model quality.

## Live run after owner approval

Proposed first run: 23 sequential requests, pinned to `jev-1.13.0`, no retries, stop on first failure, $0.10 authorized ceiling. Only the fixture question and classification rubric are sent. No free-form project input is supported by the runner.

```sh
PERMITEXT_TYPESAFE_LIVE=1 PERMITEXT_TYPESAFE_BUDGET_USD=0.10 \
  node --env-file=.env.local scripts/eval-typesafe-intent.mjs --live
```

Do not run this command until the owner approves the spending cap. The flag is an execution interlock, not evidence of conversational approval. Each invocation is a new run; the cap is per invocation, not a persistent account-wide budget. Do not rerun failed or completed runs without new authorization.

The reservation uses the full published 65,536-token request ceiling at $0.042 per million input tokens, or $0.002752512 per attempt ($0.063307776 for 23). This is a conservative model-usage reservation under the documented tariff, not a provider-enforced billing limit or allowance for taxes/account fees. Recheck pricing before live execution. Failed requests may be billed without returned usage. The runner saves attempted counts before calls, never logs credentials or raw provider errors, rejects redirects, uses a 15-second timeout, and records validated usage from successful calls. It stops on invalid distributions, model drift, missing usage, HTTP errors, or transport failure.

## How to interpret results

Record draft-label agreement and the confusion matrix, especially project/calculation questions mistaken for simple lookups. Inspect every high-confidence disagreement. The 0.8 confidence diagnostic is provisional and must not become a production threshold without held-out calibration. Record classification-only p50/p90 latency and successful-request estimated cost separately from full Research cost and latency. Incomplete runs are not a successful benchmark. Review the difficult cases before expanding the dataset and comparing against the existing model under the same rubric.

Adoption requires fewer consequential routing mistakes on human-reviewed held-out cases, acceptable fallback/abstention behavior, and measured total Research benefit including added requests and retries. Until then, this adapter has no production authority.

## Provider documentation checked 2026-09-18

- [Models and pricing](https://docs.typesafe.ai/models): Jev 1.13.0; $0.042 per million input tokens; free outputs; model pinning and request limits.
- [API](https://docs.typesafe.ai/api): typed Choice distribution, confidence and usage.
- [Known weaknesses](https://docs.typesafe.ai/model-jaggedness/jev-1.13): numeric precision, literal interpretation, irrelevant context and adversarial input. Keep arithmetic and authority checks in code.
- [Legal overview](https://docs.typesafe.ai/legal): enterprise zero-data-retention is offered; ordinary-account ZDR is not established here.
- [Customer agreement](https://typesafe.ai/legal/mca), sections 2.3 and 4: no model training on customer data without prior consent; telemetry provisions; restriction on publishing benchmarks/performance information. Keep live reports local and private. Do not commit or publish them. This is a documentation summary, not a determination of negotiated account terms.

The initial offline preparation did not verify account access. A subsequent owner-authorized live run completed using the configured key; account billing balance, custom terms, and replacement of the previously shared key remain unverified. Actual live metrics remain in the ignored local reports.

## Expanded matched comparison

`typesafe-intent-challenge.json` adds 50 new synthetic questions, ten per category, with labels authored and checked against the frozen original rubric before provider calls. Labels remain draft and are not independently human-approved. The questions interleave categories and include quoted instructions, irrelevant numerical context, mixed intents, and attempts to dictate the classification.

`typesafe-terra-comparison.mjs` uses the same category descriptions and question-only state for Terra, with strict structured output, `store: false`, low reasoning effort, and 1,024 maximum output tokens. Terra returns only a label; we do not compare an invented self-rated confidence with Jev's distribution-derived confidence. Terra model aliases and the resolved response model are recorded; Jev remains version-pinned. Pricing was checked against [the official Terra model page](https://developers.openai.com/api/docs/models/gpt-5.6-terra) on 2026-09-18 ($2 input, $0.20 cached input, $12 output per million tokens). Cache-write accounting follows the [official pricing page](https://developers.openai.com/api/docs/pricing).

```sh
# Offline preflight; no provider calls:
node scripts/compare-typesafe-terra.mjs

# Live: only after explicit conversational authorization:
PERMITEXT_TYPESAFE_COMPARISON_LIVE=1 node --env-file=.env.local scripts/compare-typesafe-terra.mjs --live
```

The owner authorized this expanded experiment and explicitly waived a monetary cap. Execution remains bounded to 50 paired cases / 100 attempts with no retries, and stops on the first provider error after finishing the current pair. Each pair calls the two independent providers concurrently; pairs are sequential. Model latency includes its request/response time, not report writes. Actual usage and estimated cost are recorded separately by provider. The local report distinguishes per-provider completion, label disagreement, confusion matrices, and risky lookup classifications. Missing results are never counted as correct.

These are classification-only observations. They do not establish that adding Jev improves end-to-end Research answers or reduces full-service costs. A separate integration experiment and human-reviewed labels are required before promoting a routing decision into production.

## Full local Research flow pilot

`scripts/eval-typesafe-research-flow.mjs` runs CC-01, CC-03 and CC-04 from the reconciled evaluation packet, twice per arm (12 turns). It alternates baseline/Jev order, uses fresh isolated conversations and temporary local account/storage, and runs the real HTTP Research handler through drafting, required-claim checks, semantic verification, and existing automatic repairs. Expected answers and rubric concepts are recorded only in the report and never sent as research input.

Both arms explicitly use Terra with medium answer reasoning and the same single-model configuration; this is a controlled local configuration, not a claim about current deployed settings. Existing deterministic evidence mapping remains enabled in both arms. Live official-source retrieval, if triggered by existing policy, is recorded in ordinary Research metrics. Network/document cache warmth and provider sampling can still affect timing; two repetitions do not establish significance.

The runner checks and replaces exactly one evidence-preparation boundary in a temporary sibling copy of `app.mjs`, importing the evaluation-only focus module. Original application source is neither edited nor imported with a global production feature flag. Source and variant hashes are saved, and the temporary copy is removed on normal exit. `.typesafe-flow-*.mjs` is ignored for crash recovery.

Jev receives the question and full retrieved passage texts in one request with independent relevance choices per passage. All governing, pinned, required-claim, exception, definition, table, cross-reference, incomplete, visual, and structured sources are protected. Unknown/unclassified sources are also protected by default. Only an explicitly contextual/irrelevant/collateral unprotected source can be omitted when Jev returns unrelated with at least 0.95 confidence. All retained source objects are unchanged. Remaining passages are ordered by relevance. This is a conservative experimental policy, not validated legal completeness or a calibrated threshold. Failure falls back to the original evidence and stops further experiment turns after that turn finishes.

```sh
node --test tests/typesafe-intent.test.mjs tests/typesafe-evidence-focus.test.mjs
node scripts/eval-typesafe-research-flow.mjs
# Owner-authorized live evaluation only:
PERMITEXT_TYPESAFE_FLOW_LIVE=1 node scripts/eval-typesafe-research-flow.mjs --live
```

The owner authorized full-flow testing and waived a requested monetary cap. This fixed pilot is bounded to 12 turns; the existing server requires finite operational guardrails, configured at $2 per turn/$50 per run for this isolated process. These are internal circuit breakers, not an asserted user-selected budget. Existing automatic verification repairs are included in total turn time and cost; there are no manual retries of paid turns. The initial setup attempt stopped on a 201-vs-200 conversation-creation assertion before any provider request; correcting that assertion did not repeat paid work.

Report total HTTP turn latency, all successful and failed Research request usage, Jev cost/time, input/output/reasoning tokens, repair counts, and evidence removals. Review each answer against the source packet's concepts and forbidden conclusions before claiming quality preservation. Keep reports local and distinguish this narrow pilot from broad workload economics or release acceptance.

The conservative pilot stopped on its defined Jev-fallback condition before all planned repetitions completed. Preserve that incomplete run, including failed turns and the unmatched fallback turn. Its original generic fallback diagnostic cannot distinguish an invalid response from a transport error, and its missing usage must not be treated as a free request. Subsequent instrumentation records sanitized failure categories, returned relevance distributions, and usage before selection validation.

### Focused candidate-pruning follow-up

`--candidate-pruning` selects a separate four-turn CC-01 experiment (two repetitions per arm). In this variant only, an automatically discovered supporting source explicitly classified by existing metadata as an ordinary `candidate` is also eligible for omission. Required-claim membership and all other protections still override eligibility. No data from the conservative run is retroactively relabeled as this intervention. This new intervention was motivated by the conservative run retaining every candidate, rather than manually replaying failed turns.

```sh
PERMITEXT_TYPESAFE_FLOW_LIVE=1 node scripts/eval-typesafe-research-flow.mjs --live --candidate-pruning
node scripts/summarize-typesafe-research-flow.mjs .typesafe-local/REPORT-research-flow.json
```

Summaries compare completed baseline/Jev *pairs*, including verification failures, and report unmatched attempts separately. A failed operation can have a null completed-answer estimate but a nonzero `actualProviderCostUSD`; use the operation's settled provider cost first rather than dropping failed work. These fields are usage-derived estimates, not a reconciled provider invoice. Early raw reports' `researchCostUSD` convenience field omitted failed-work cost; their immutable operation records preserve it, and the corrected summarizer uses those records. Results should also discuss cache-hit differences; reordered/shortened prompts may have different cached-token savings.

The first follow-up's final report, all answers, evidence selection decisions, and manual rubric review are kept under `.typesafe-local/`. No production adoption is implied by running either experiment.

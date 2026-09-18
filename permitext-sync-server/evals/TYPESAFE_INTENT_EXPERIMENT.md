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

The TypeSafe account's actual billing balance, custom terms, API access, credential validity, and replacement of the previously shared key have not been verified by this offline experiment.

# Streamed Research prototype

Local experiment based on `16b5c231a`. No production route or Research policy is changed.

The user selects one to three complete passages from the 2022 NYC Building Code, enters a question and optional stated project facts, and receives one streamed Luna-low explanation. Existing official-domain routing can add web support; retrieved HTML/PDF passages are bound before generation. There is no model reviewer, repair loop, or independent substantive verification on the prototype path.

## Run

From `permitext-sync-server`:

```sh
node experiments/research-stream/test.mjs
node experiments/research-stream/server.mjs --port=8792
```

The default is an explicitly labeled offline UI demonstration with external requests blocked. Open the local URL in `experiments/research-stream/.local/launch.json`. The launch link sets an HttpOnly, SameSite cookie and redirects to a clean URL. The server binds only to `127.0.0.1`, validates Host/Origin, and uses isolated local data. Credentials are never returned to the browser.

Live mode requires the user's approved $5 batch and an existing local API-key file:

```sh
node experiments/research-stream/server.mjs --port=8792 --live --env-file=/absolute/path/to/existing/.env.local
node experiments/research-stream/run-case.mjs office
node experiments/research-stream/run-case.mjs office --baseline
```

Only OPENAI_API_KEY is copied from that file. Storage and Research configuration are isolated. The baseline invokes the existing Research HTTP flow with a synthetic local account, one selected passage, and the same question. Its full internal evidence may expand according to existing Research behavior; inspect recorded answers before claiming identical internal evidence.

## Budget

The persistent ledger reserves $0.40 before every Responses API dispatch, including baseline reviews, retries, and official-web calls. A process lock prevents concurrent servers sharing the ledger. At most twelve calls fit below $5 ($4.80 reserved). Reservations are never released, including unknown-usage or interrupted calls. Restarting the server does not reset the batch.

The bound only permits `gpt-6-luna`, standard service, at most 24,000 output tokens, and at most three web searches per request. Its allowance covers the model's maximum input context at the long-context/cache-write rate, the allowed output, and the searches using official pricing checked on 2026-10-25. Numeric token-cost estimates are separately recorded and are not a provider invoice. Do not delete/reset the ledger to extend the approved budget.

## What this proves, and what it does not

- Streams actual text, with no extra model call to review or repair it.
- Preserves table row separators and footnote text, exact source IDs, edition labels, and source links. Visual-only evidence is rejected as unsupported by this text-only experiment.
- Mechanically checks that bracketed citations resolve to supplied sources. This does not establish that the cited source supports the claim.
- Requires a completed provider event and matching final text. Aborted/disconnected/failed output remains partial and visibly incomplete.
- Stores complete and failed runs separately from production conversations. Reopening retains result status and evidence.
- The existing baseline remains available for comparison from the same local screen.
- Not integrated into production Research, Notebook, Report, native clients, or account synchronization. Unreviewed text cannot become a verified production Report through this standalone lab.
- Source discovery is currently user-selected 2022 BC passages. Broad automatic library discovery and additional code editions are outside this first prototype.
- Web retrieval must complete before a source-grounded answer can stream. This does not promise instant completion for web-backed questions.

## Verification

`test.mjs` covers split UTF-8/SSE chunks, terminal completion, inconsistent final text, refusal/incomplete/disconnected responses, cancellation, citation IDs, concurrent budget reservations, process locking, and persisted budget caps. Runtime/browser results are documented in `RESULTS.md` after the live comparison.

All launch information, synthetic accounts, paid-request ledger, and saved runs stay in the ignored `.local/` directory. If a process crashes and leaves `budget.json.lock`, verify the old process has stopped before removing only that lock; preserve `budget.json`.

# Research cost accounting and retained campaign audit

Research now retains cache-write tokens and the billing dimensions of each provider request through retries, verification, repairs and failed answers. The previous generic estimator treated cache writes as ordinary input and excluded actual web-search tool fees. This corrects measurement; it does not itself reduce API spending or improve answer quality.

## Retained usage

The [offline campaign audit](../permitext-sync-server/evals/results/research-owner-cost-audit-2026-09-08.json) reconciles all 162 recorded provider calls from 22 hash-bound, settled packages. It applies the standard short-context rates checked against [OpenAI pricing](https://developers.openai.com/api/docs/pricing) on September 8, 2026: Terra input/cache read/cache write/output at $2/$0.20/$2.50/$12 per million tokens; Luna at $0.20/$0.02/$0.25/$1.20; web search at $0.01 per recorded tool call. These are dated usage estimates, not a provider invoice or a current account-balance read.

| Recorded measure | USD |
| --- | ---: |
| Usage-derived estimate, all 162 calls | 3.88947242 |
| Existing conservative campaign ledger | 7.887898 |
| Cache-write premium omitted from the previous generic estimator | 0.60303080 |
| Eight recorded web-search tool calls | 0.08000000 |
| Full Research HTTP attempts, including failures | 3.84501346 |
| Separate verifier-only evaluation checks | 0.04445896 |

Answer generation accounts for $3.57243820, approximately 92% of the total; Research verification accounts for $0.20810743, approximately 5%. Web support and official-guidance summary/verification account for the remainder. This suggests that focused retrieval and avoiding unnecessary answer rewrites deserve priority as savings hypotheses. The cost distribution does not justify dropping verification or switching all answers to a cheaper model.

There were 72 full HTTP attempts: 61 delivered an answer and 11 did not. The failed attempts cost an estimated $0.46622551. Dividing all full-HTTP costs by the 61 delivered answers gives about $0.063 per delivered answer, or an illustrative $6.30 per 100. Delivered-attempt cost p50/p90 is approximately $0.0493/$0.0985. These are mixed development versions and repeated evaluation cases, and delivered answers include known quality defects. They are neither a representative customer-month forecast nor cost per quality-accepted answer. Additional answer-generation calls cost $0.625417 and overlap with failures; the two amounts cannot be added as independent savings.

Hosting, payment fees, support and refunds are outside these API-only figures. The historical V6 subscriber model and its results remain historical. The $20/month and 100-turn baseline, model routing, answer policy and spending ceilings have not changed.

## Accounting behavior

- Each actual request retains input, cached-read, cache-write and output counts plus actual web-search calls. A request above 272,000 input tokens receives the supported GPT-5.6 long-context multipliers: 2x input/cache/write and 1.5x output. Cache writes use 1.25x the standard input price. Two short requests are priced separately even when their aggregate exceeds the threshold.
- Contradictory or missing provider usage cannot be reported as a reconciled zero-cost result. Unreconciled reservations remain pending and retain their protective allowance.
- Settled operation metrics now preserve cache-write counts even when an answer fails verification. The legacy `actualProviderCostUSD` field remains a usage-derived estimate; it is not invoice reconciliation. The public accounting event labels this `estimatedProviderCostUSD`.
- Actual web-search fees enter the usage estimate; the conservative settlement retains the existing token ceiling plus the full allowed tool cost without adding the actual fee twice. All existing pre-dispatch caps remain in force.
- The pending single-case driver and full-scope request inspector include the new accounting module in their source hashes. Older reports retain their original hashes and are not fresh dispatch authorization.

## Offline verification and limits

Provider checks cover cache writes, context boundaries, two-attempt success/failure, actual tool calls, invalid usage and unchanged conservative bounds. Recorded PC-04 and PC-10 HTTP replays verify private costs and cache-write counts for both accepted and rejected answers. The audit independently reconstructs each recorded call's cost and compares it with the runtime estimator within its one-microdollar rounding precision.

The provider, cost-guardrail and offline Research chat suites passed on the final runtime. The chat suite includes isolated Research HTTP replays and source, attribution, answer-policy and retrieval checks. A cost-suite assertion still expected an earlier prompt phrase; it also failed against the pre-change commit. Its wording check now recognizes the current instruction to retain separately named material unknowns, including approved records, quantities, dimensions and technical/approval conditions. Runtime answer instructions were not changed for that assertion.

No new paid calls were made. Project, Notebook, Report, export, phone and workflow acceptance testing remain deferred at the owner's request. Nothing has been pushed or deployed. Live quality and speed confirmation remain outstanding across the full 110-case goal: 45 cases have been provider-attempted and 65 have not. The conservative authorization ledger remains $7.887898 of $8, leaving $0.112102; this estimate correction does not expand that allowance.

Reproduce the retained-cost analysis without credentials or network access using `npm run audit:research-owner-costs` in `permitext-sync-server`. The audit's optional `--output FILE` writes a new file exclusively and refuses to overwrite a retained result.

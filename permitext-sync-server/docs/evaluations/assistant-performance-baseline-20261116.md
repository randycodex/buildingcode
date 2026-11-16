# Assistant performance baseline — November 16, 2026

The current Experimental Luna path is frozen for this measurement. No application prompts, retrieval, indexing, model settings, conversation handling, or Formal Research behavior changed. This report replaces the previous failure-by-failure expansion strategy with the [evaluation policy](assistant-evaluation-policy.md) and an [open evaluation log](assistant-evaluation-log.md).

Baseline application commit: `b69513f97`. Model: `gpt-6-luna`, low reasoning, default service tier. Tests used synthetic projects in an isolated local HTTP server and the existing cumulative $7 ledger. Calls ran serially, with per-request correlation rather than overlapping time windows. Provider timings include waiting for the complete response; they are not time to the first answer token. The application supplies progress events before the final answer.

## Fresh primary measurements

| Question | Full response | Model calls | Model input / output tokens | Estimated USD | Retrieval and evidence operations |
| --- | ---: | ---: | ---: | ---: | --- |
| How many apartments are in this project? | 7.14 s | 2 | 13,457 / 183 | $0.00431 | Intent planning only |
| And how many stories? | 2.94 s | 2 | 13,494 / 82 | $0.00427 | Intent planning only |
| How much slope does that drain need? | 10.02 s | 4 | 25,187 / 332 | $0.00725 | Chapter selection, 1 read, 1 search |
| Does that duct need a fire damper? | 21.44 s | 5 | 60,362 / 1,279 | $0.01876 | Chapter selection, 2 reads, 1 search |
| What if we're sprinklered throughout? | 18.58 s | 4 | 68,199 / 1,325 | $0.02404 | Recall, chapter selection, 2 reads, 1 archive read |
| Does my elevator need to go to the roof? | 22.71 s | 5 | 88,227 / 1,280 | $0.02672 | Chapter selection, 2 reads, 1 search |

These six turns used 22 model calls, 3 query-embedding calls, 268,926 model input tokens and 4,481 output tokens. Their estimated cost was $0.08535. The four code questions had a 20.01-second median and used 4–5 model calls each. No web tool ran in these fresh primary samples.

## Where the time and tokens went

| Phase | Total time across six turns | Share of full time | Input tokens | Estimated USD |
| --- | ---: | ---: | ---: | ---: |
| Intent and governing-issue planning | 32.40 s | 39.1% | 74,398 | $0.02424 |
| Selecting sections from chapter outlines | 5.13 s | 6.2% | 69,705 | $0.02447 |
| Model calls choosing research tools | 11.13 s | 13.4% | 65,011 | $0.01615 |
| Writing the final answer | 24.50 s | 29.6% | 59,812 | $0.02050 |
| Query embeddings | 0.85 s | 1.0% | 104 embedding tokens | $0.000002 |
| Remaining local work | 8.81 s | 10.6% | — | — |

Upstream calls account for 89.4% of measured full response time. Planning, section selection and tool routing together account for 58.8%; writing the answer accounts for 29.6%. This points first to orchestration and payload size, rather than the query embedding endpoint or a need for a stronger model.

The intent request for a simple apartment-count question contained the complete 259-chapter guide: 37,812 bytes of the approximately 50,800-byte request. It sent 11,855 input tokens to interpret a question answerable from one project fact. The same planning stage runs on simple follow-ups. For code questions, section-selection input varied from 4,018 to 28,596 tokens before the main agent started its own research.

Reading eight selected headings can expand to substantially more neighboring provisions. In the primary roof answer, two read operations returned 43 source entries representing 34 unique sections. The damper follow-up returned 32 entries representing 23 unique sections. These reads may include useful exceptions, but repeated transport and selection of broad evidence is a measurable efficiency target. Relevance, not merely fewer source cards, must decide what is retained.

The residual 8.81 seconds includes corpus preparation, retrieval, persistence, serialization and benchmark overhead; it is not a measurement of retrieval CPU alone. The first fact question includes warmup. The Experimental path does not currently expose the detailed local retrieval timing callbacks available elsewhere, so this pass cannot isolate lexical ranking from artifact loading. No application instrumentation was added to create that distinction.

Historical traces show a separate web-helper call taking 28.54 seconds with three web actions. That illustrates a possible tail-latency cause, but is from a different sample and is not a controlled comparison with these fresh results. The older concurrent runner's per-turn timing attribution was unreliable; historical phase totals do not prove an old/new speed improvement.

## Repeat, quality checks and recording limitations

A separate roof repeat took 25.75 seconds and an estimated $0.01612. Its residents-only follow-up completed the server operation in 16.90 seconds, used six model calls plus one embedding call, and cost an estimated $0.02253. The follow-up preserved the common-terrace subject, found the resident common-use accessibility provisions, and answered directly.

The follow-up also attempted to read source IDs as message IDs, receiving eight unavailable results before continuing. That is logged as a tool-identity/redundant-work issue; no new prompt or retrieval pass was added for it.

Two follow-up result rows exposed a recorder bug: archive metadata has a numeric `sources` count, while library reads have a source list. The recorder incorrectly called `.map` on both. This was a benchmark failure after the Assistant response, not an Assistant request failure. Six primary turns and the repeated initial roof answer have complete saved client profiles. The repeated follow-up retains all provider usage/timings, final answer and tool requests, but lacks the saved final answer-record identity check and client timing row. Its 16.90-second duration comes from server operation accounting. The first affected follow-up is charged in the ledger but excluded from performance and quality aggregates because its full trace was not flushed. The recorder now handles both shapes, saves partial traces on error, and has an offline regression test. No further paid rerun was used to disguise this gap.

All six fully recorded primary answers passed the lightweight topic and citation-to-record identity checks. The fact answers correctly gave 56 apartments and eight stories; their first regex checks were too narrow for the resolved question and were regraded after correcting the test patterns without rerunning the model. Identity checks do not establish legal entailment, source currency, complete governing coverage or professional approval. This small sample does not establish production readiness or p95 latency. Zoning, unfamiliar-topic breadth and long-chat behavior were not retested in this measurement pass.

All attempts in this pass increased the cumulative accounted test estimate by **$0.144535**, including the recording failures and repeat. The ledger ended at **$5.592121 of $7**, leaving **$1.407879** under this test cap. Two older uncertain/reserved calls remain included. These are configured local estimates, including cache-write premiums and conservative web-action charges, not an invoice or the provider account balance. No cap was reset or raised.

## Next changes to evaluate, not implemented here

1. Reduce the fixed input burden: use a compact, ranked index/metadata result instead of sending the entire chapter guide and broad outlines on every question. Preserve jurisdiction, edition, effective-date, provision hierarchy, exception and cross-reference identities.
2. Make separate planning/navigation conditional. A project-fact answer or an unambiguous continuation with sufficient verified evidence should not automatically require the same discovery work as a new cross-disciplinary code question. Preserve latest-subject interpretation and searchable conversation history.
3. Reuse already read evidence and distinguish source IDs from message IDs in the tool contract. Investigate one systemic identity/ranking/transport fix rather than adding example-specific instructions.
4. Allow another research step only for a material unresolved issue: missing controlling text, contradictory evidence, an exception that could change the conclusion, uncertain authority currency, or an inaccessible source. Do not repeat equivalent searches for marginal coverage.

Any implementation should compare the same representative questions and evidence/context against this baseline, recording correctness, elapsed time, input/output tokens and estimated cost. Keep source verification and the stricter Formal Research workflow. No model change is justified by these timing measurements alone.

Detailed records: [machine-readable baseline](assistant-performance-baseline-20261116.json). Raw synthetic traces remain in `/tmp/assistant-performance-baseline-20261116` and `/tmp/assistant-performance-roof-20261116`; no API credentials are included in the committed report.

# Assistant duplicate-evidence transport — November 16, 2026

Evaluation ran locally on branch `codex/assistant-evidence-dedup`, based on `32a7e1420`. No push or deployment occurred during the measurements below. The user subsequently authorized merging and releasing the duplicate-text removal.

The outgoing request contained identical source text/tables under both `attachedPassages` and `readEvidence`. The change retains the full verified content in `readEvidence` and removes only the exact duplicate fields from the matching attachment record. Both source identities and all other metadata remain. Different source IDs, editions, authority metadata, distinct text and distinct table content are preserved. Saved sources, source selection, retrieval, prompts, model/settings, project context and conversation history are unchanged. No AI stage or retrieval operation was added.

## Preservation and request size

Fourteen recorded requests across Mechanical Code, Zoning, table follow-ups and Building Code stair follow-ups were replayed without provider calls. All original source bodies, table structures/footnotes, metadata and context could be reconstructed exactly from the deduplicated request. Conversation/tool messages and all other request settings were identical. Combined request size fell from **888,503 to 620,867 bytes (30.1%)**. This saving applies to affected requests; requests without this duplication are unchanged.

Unit coverage checks exceptions, table grids with blank/spanning headers, footnotes, different source identities/editions, distinct text/tables, shared-array HTTP recall, no new model/retrieval calls, immutable source records and rejection of unknown citation IDs. The complete `test:assistant` suite passed, including 2,000-message/source memory cases, 1,000-plus-message HTTP history, project-snapshot integrity and saved-source recall. `test:assistant:production` passed with a disposable loopback PostgreSQL cluster (407 SQL requests, zero external database requests and zero paid provider calls).

## Controlled live-model comparison

Four frozen synthetic follow-ups, two repetitions, before/after order reversed on the second repetition. Same Luna model, low reasoning, default tier, identical prompts and evidence. Tools were disabled identically for both variants to isolate answer generation. No new source search was performed. This measures model-turn latency, not full application latency.

| Metric | Before | After | Difference |
| --- | ---: | ---: | ---: |
| Model calls | 8 | 8 | Unchanged |
| Input tokens | 101,102 | 69,478 | 31.3% lower |
| Output tokens | 1,072 | 1,147 | 7.0% higher |
| Median completion time | 2.416 s | 2.670 s | 10.5% higher |
| Total completion time | 19.155 s | 21.404 s | 11.7% higher |
| Estimated API cost | $0.018736 | $0.013082 | 30.2% lower |
| Completed answers | 8/8 | 8/8 | Unchanged |
| Nonempty, bound citation markers | 7/8 | 7/8 | Table-marker omission in each variant |

**No speed improvement is established.** This small sample demonstrates lower token transport and estimated cost. Network/provider variability, cache state and changing output length affect latency. Cached input was 50,539 tokens before and 34,727 after; cache-write tokens had the same respective counts. The configured estimate includes cache-write premiums; it is not an invoice charge.

An earlier 16-call development comparison left tools enabled. Both variants sometimes selected another archive lookup, so first-response timings were not comparable final-answer timings. It is retained in the report, including all costs. The final representation keeps full content in the verified-evidence field. Source/subject conditions remained available in the controlled answers, but the table case omitted app S markers in one output per variant. No new citation or authority fix was added. Previously logged wrong-code-family, Zoning interpretation and overlapping-authority gaps remain open.

All **32 paid calls cost an accounted estimate of $0.064449**, including the development attempt. The existing cumulative $7 ledger increased from $5.809667 to **$5.874116**, including two older uncertain/reserved entries. No budget was reset or enlarged.

Machine-readable results, source/history hashes and all modeled answers: [report](assistant-evidence-dedup-20261116.json). Raw local artifacts: `/tmp/assistant-evidence-dedup-real-20261116` and `/tmp/assistant-evidence-dedup-controlled-20261116`. Reproduce with `scripts/evaluate-assistant-evidence-dedup.mjs`; real calls require `--real`, the existing ledger and the local test API key. Use `--answer-only` for the controlled comparison. Never create a new ledger to repeat the test.

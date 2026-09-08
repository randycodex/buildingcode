# Official document summaries — September 8, 2026

Official PDF retrieval already preserved fetched source text and page attribution, but the guidance-only answer renderer repeated whole pages. The BPP pilot response had 523 words, including material outside the question. This change generates a responsive summary and verifies it against the complete retrieved passages before delivery. It applies to validated official HTML and PDF guidance.

The answering model receives the question, user/context facts and fetched passages. It receives no expected answer or evaluator rubric. Each paragraph selects exact source/claim pairs. The server constructs the citation links and retains the full passages, page numbers, document hashes and extraction limitations. An independent provider check must pass before the summary can be delivered. It checks substantive support and material omissions, rather than treating a valid citation ID as sufficient evidence.

Official guidance retains its noncontrolling authority label and does not become an enacted-code citation. Saved summaries carry an integrity record binding their prose, source passages, question and gaps to the successful verification. This is an integrity check, not a cryptographic signature or a substitute for semantic review. Legacy canonical guidance answers remain readable. Unsupported summaries fail without consuming the user's Research turn; incurred provider usage remains accounted for.

Known BPP and wetlands workflows fetch the official documents directly without an intermediate search request. Summary generation and verification add two provider requests compared with the former whole-page renderer; their latency and cost must be measured. Existing model routing, account allowances and deployed configuration are unchanged.

## Source refresh and local verification

The [BPP service notice](https://www.nyc.gov/assets/buildings/pdf/bpp_build-sn.pdf) and [August 2026 DOB NOW release notes](https://www.nyc.gov/assets/buildings/pdf/dob_now_build_release_notes.pdf) were refreshed September 8. The BPP notice's first page supports DOB NOW: Build, the Builders Pavement Plan work type, Standard Plan Review and the BPP5 authorization to DOT. The wetlands release-note pages 12–13 distinguish the required jurisdictional determination from the conditional permit or waiver request.

Focused no-network contracts passed for paragraph/source pairing, original-passage preservation, verifier context, malformed output, saved-summary integrity and changed-prose/source rejection. Local HTTP tests passed for PDF summary delivery and saved-answer reload, two-page wetlands attribution, unsupported-summary rejection with settled/unconsumed-turn accounting, and invalid-PDF rejection. A replay using the real saved BPP notice also passed; its answering and verifying provider responses were mocked and do not establish generated-answer quality.

## Bounded live package

`run-research-owner-document-summary-confirmation-20260908.mjs` runs DOBNOW-019 and DOBNOW-018, once each. It uses isolated local accounts/storage and actual provider responses. Reference answers are not supplied to the answering model. A pre-dispatch source check found that CC-04 still loses the qualification after its long fixture table at the 4,800-character passage boundary. The assembly conversation was removed from this package until that retrieval defect is repaired.

The five earlier packages have zero pending provider requests and a cumulative conservative bound of $3.026380. Two turn caps of $0.85 add at most $1.70, for a combined ceiling of $4.726380 within the owner's $8 authorization. An aggregate $1.80 package guard also applies. The runner defaults to a no-network preflight and exclusively creates a permanent result file before any paid dispatch, preventing accidental replay. No separate paid judge or manual retry is included.

The full `npm run check` (including the Research chat suite) and `npm run smoke` passed before dispatch. Live results will be recorded after execution. No deployment is authorized by this package.

## Live results at `0b3ec0ea0`

Both questions delivered on the first attempt with one Terra summary and one Luna verification each. There were no search-model calls, repairs or pending provider requests. Manual comparison with the refreshed PDFs supports both main answers and their material conditions.

| Case | End-to-end time | Words | Review |
| --- | ---: | ---: | --- |
| DOBNOW-019, new BPP filing | 7.767 s | 83 | Correct filing system, work type, review type, effective date and BPP5/DOT authorization distinction; cites notice page 1. |
| DOBNOW-018, wetlands documents | 11.305 s | 166 | Correct determination plus conditional permit/waiver workflow; cites release-note pages 12–13. Repeats some scenario and authority context. |

The BPP response decreased from the earlier 523-word whole-page rendering to 83 words. The two new timings are individual observations, not a controlled general speed claim. The wetlands answer can be shorter without losing its conditions; this remains a presentation note.

This batch's token telemetry is $0.012018. Adding the estimated cache-write premium of $0.00157095 gives **$0.01358895**. Across six paid packages, the cumulative usage estimate is **$1.52363636**, the conservative bound is **$3.050704**, and pending provider requests are **zero** (27 turns, 54 provider requests). These are estimates derived from usage records, not an invoice or account balance.

The immutable live result is `permitext-sync-server/evals/results/research-owner-live-document-summary-confirmation-2026-09-08.json`; the separate manual review is `research-owner-document-summary-review-2026-09-08.json` in the same folder. The review records answer hashes and fetched PDF hashes. No deployment occurred. Broader answer coverage, missing-zoning-fact responses and the CC-04 source-tail defect remain open.

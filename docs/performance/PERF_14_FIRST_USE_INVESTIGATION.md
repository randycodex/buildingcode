# PERF-14 — First-use public reading investigation

Status: complete locally. Local source and host measurements only; no deployment or iPhone performance claim.

## Instrumentation

Opt-in `PERMITEXT_PUBLIC_PERFORMANCE=1` adds public GET timing and a generated `x-permitext-code-request-id`. Private routes and query/account content are excluded. Index loading, catalogs, candidate matching, ranking, exact matching, content reads, snippets, chapter body hydration, body contracts, serialization and response-cache lookup are measured. `content_read` is accumulated across concurrent reads and overlaps exact matching/snippets; phase values must not be added as exclusive wall time. `chapter_assembly` currently measures body hydration, not all chapter metadata preparation.

## Initial exploratory evidence

Recorded 2026-09-24 UTC on this Mac with local instrumentation over base commit `fa51a3133`. Raw exploratory output: `/tmp/permitext-perf14-cold-baseline.json`. Three fresh processes per case; OS/filesystem caches were not flushed. A chapter contract test overlapped part of this run, so these are diagnosis measurements, not the final controlled comparison.

- Exact all-edition `concrete`, first 25 results: first responses 1060.13, 902.27 and 945.85 ms; identical repeats 11.18, 2.57 and 3.49 ms.
- First Search index loading approximately 241–257 ms, catalog loading 238–242 ms, exact matching 377–514 ms. Ranking approximately 14–16 ms. Content reads overlap exact matching.
- Full legacy Chapter 33: all three processes exceeded the 30-second budget. Two recorded request aborts only after 23.1 and 29.3 seconds despite a 20-second timer; one emitted no completed request. This suggests event-loop delay but does not yet establish the responsible function.
- Do not extend timeout or retries to hide these failures.

## Verification completed

- Timing isolation/redaction/error/header contracts passed.
- Public-cache HTTP contract passed (independent review).
- Backend performance contract passed.
- Chapter-body v2 HTTP contract passed, including exact IDs/blocks parity across every Chapter 33 window.

## Investigation sequence (results below)

1. Capture bounded phase-start/completion traces so timed-out chapter requests retain useful evidence.
2. Finish fresh-process harness with header vs body duration, exact response-cache repeat vs warm-content cache miss, dirty-source provenance and retained sanitized trace events.
3. Run controlled baseline with no concurrent test suite. Include concrete, egress, section number, Chapter 33 summary/window/full legacy.
4. Optimize the evidenced slow phase and compare identical response hashes, matching/pagination and bounded failure behavior.
5. Record repeatable distribution improvements before declaring PERF-14 complete.

## Follow-up diagnosis

The bounded phase trace confirms Chapter 33 remains in `chapter_assembly` at the 30-second process deadline; revision/cache lookup finish in under 10 ms. See `PERF_14_CHAPTER_TIMEOUT_BASELINE.json`.

A focused 32-caller filesystem experiment found 32 identical reads (50,859,872 bytes) versus one serial read (1,589,371 bytes). Sharing the pending chapter read is implemented and tested for exact source bytes, distinct chapter keys, missing-file probes and transient-error retry. This alone did **not** resolve the timeout (`PERF_14_SINGLEFLIGHT_ONLY_TRACE.json`).

A V8 sampling profile after that fix attributes the dominant call stacks to repeated `allChapterHeadings` / `parsedHeading` work. The server eventually finished its body-hydration phase in 26,117.91 ms, after the client timeout. See `PERF_14_CHAPTER_CPU_PROFILE.txt`; native symbol names in Node's sampled profile are imperfect, so attribution relies on the JavaScript caller chains, not the generic native symbol label. Caching this deterministic all-heading parse is the next focused change. No latency improvement from that change is claimed yet.

## Final controlled measurements

`PERF_14_FINAL_MEASUREMENTS.json` records 18 successful fresh-process samples (three per case), each followed by an identical request and an ignored-query-parameter response-cache bypass. No long test suite ran concurrently. OS caches were not flushed; these are local HTTP completion times, not deployment, CDN or device timings. The corpus and all three response hashes match within each sample. Three samples establish repeatability, not a production tail-latency percentile.

| Case | First response range (ms) | Identical repeat range (ms) | Warm content, response cache bypass (ms) |
| --- | ---: | ---: | ---: |
| Exact concrete | 746.92–859.68 | 2.29–2.92 | 18.09–19.33 |
| Exact egress | 570.84–583.91 | 2.72–6.93 | 15.65–16.63 |
| Exact section 1005.3.1 | 482.69–494.48 | 2.34–2.81 | 22.43–23.22 |
| Chapter 33 summary | 74.67–78.55 | 3.54–4.02 | 6.95–8.22 |
| Chapter 33 five-section window | 243.90–248.72 | 2.13–2.20 | 6.27–7.69 |
| Chapter 33 full legacy body | 634.84–636.65 | 245.95–255.78 | 247.79–252.08 |

The full legacy response is 2,212,461 bytes, exceeding the existing 2 MiB retained-response cache limit. Its repeated requests therefore still assemble content; its improvement is not merely a response-cache hit. All 1,029 sections remain present. Timeouts and retry budgets were not increased.

The demonstrated fixes are pending-read coalescing and reuse of parsed all-heading metadata. The latter eliminates the dominant repeated full-chapter parse. Exact heading selection and body extraction algorithms remain unchanged. Search first-use measurements remain largely index/catalog initialization; this task does not claim every first search is instantaneous or that the initial exploratory search numbers form a controlled improvement comparison.

## Acceptance checks

- Public timing privacy, route isolation, concurrent context, errors, headers and bounded event tests pass.
- Singleflight tests prove one actual read for 32 simultaneous calls, chapter isolation, missing-file behavior and transient retry.
- Frozen pre-change source/heading/status hashes prove identical 934 Chapter 33 headings plus duplicate-number, ambiguous-title, appendix and missing-heading behavior, independent of Git history.
- Figure bindings pass: 18 sections and 32 figures.
- Public-cache/revision/privacy HTTP suite, backend performance and Search/Reader cancellation suites pass.
- Chapter-body v2 HTTP suite passes, including all Chapter 33 windows with exact ID/block parity.
- Full `npm run smoke` passes; final independent review found no actionable correctness issues.
- Remaining plan work: PERF-15 web startup traces, PERF-16 populated-account coverage, PERF-17/18 edition architecture, and outstanding physical-iPhone acceptance. This task does not close those gates.

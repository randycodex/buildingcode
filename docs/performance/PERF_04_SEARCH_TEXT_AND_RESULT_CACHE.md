# PERF-04 — Exact search text and persistent completed results

Status: implementation, host verification and targeted rendered checks completed in local development Release 41.7. Resumed; persistent storage verified, final cache-hit latency evidence remains pending.

## Baseline and cause

Development Release 41.3 measured concrete all-edition completion at 29,314.261 ms, with 28,495.3 ms spent in its first edition (2022). Existing source verifies candidates with `officialText`, which can decode prepared rich blocks or synthesize text from chapter HTML. The 2022 prepared section files contain no nonempty officialText. This is source evidence of expensive fallback work, not a CPU-sampled attribution of all 28.5 seconds.

## Implementation

1. Generate immutable UTF-8 search text and per-section byte offsets using the existing Swift text resolver and HTML extraction helpers. Keep exact matching and ranking unchanged. Map payloads instead of retaining full String corpora for every edition. Missing/invalid packs fall back to existing text resolution.
2. Validate pack hashes at load. An Xcode build phase checks source fingerprints and complete canonical coverage, so stale generated resources fail packaging. Revision inputs include metadata, prepared sections, search index, authored HTML and resolver/generator semantics.
3. Use lightweight text for candidate verification and lazy search previews. Rich display content remains loaded by Reader when opened.
4. Cache only completed, failure-free searches, with ordered public result identities/card metadata and filters, excluding snippet bodies and account-specific saved state. Keys include exact trimmed query, edition/category scope, corpus fingerprint and engine revision. The cache survives process restarts; cache-directory eviction remains possible.
5. Bound persistent cache to 32 entries and 12 MiB using LRU eviction and atomic writes. Corruption, cancellation, missing revisions or unavailable storage fall back to ordinary search. Reconstruct/validate canonical target/filter metadata on a hit and restore edition stores for previews and result opening.
6. Preserve all installed editions and progressive publication on misses. Optional downloadable editions remain PERF-17, not implemented here. Background query refreshing is optional/deferred; first use after a revision performs a fresh search.

## Validation to finish

- Full-corpus exact text and result/ranking comparison, including phrases, punctuation, section numbers, scoped queries, no matches, limits and cancellation.
- Signed Release build and in-place device installation.
- First concrete search, repeat search, repeat after process restart, and opening a result on the physical iPhone.
- Record actual first-result/completion/cache-hit timings. No speedup claim from host tests alone.

## Host verification completed

- All 32,551 generated section texts across six editions match independently regenerated existing-resolver text byte for byte. The frozen pre-change search algorithm and current algorithm agree in 684 ordered result/metadata/snippet checks (phrases, case, whitespace, punctuation, numeric references, Unicode, scopes and limits); six cancellation cases pass.
- Seventeen actual mapped-store validation/fallback cases pass. Missing/invalid text packs use authoritative fallback, including valid empty text handling.
- Persistent-cache tests pass for process-independent reuse, exact key isolation, empty completed results, count/byte LRU limits, corruption, cancellation and storage failure.
- The actual all-edition coordinator passes cold-hit metadata/store restoration, invalid-ID/filter rejection, incomplete/failure/cancellation no-write and revision-missing fallback tests. Existing search-to-Reader reuse and progressive-label contracts pass.
- Generated blobs total 35,789,052 bytes, plus compact offset indexes. This deliberately trades approximately 35 MiB of uncompressed bundled resources for avoiding runtime rich-text reconstruction; actual App Store download-size impact is not measured. All existing editions remain available.
- Xcode's recursive script input setting allows the declared content directory to be read while keeping user-script sandboxing enabled. The build's source-revision check now passes.

## Device checkpoint — 2026-09-22, build 41.7

Signed Release build and in-place installation passed (`/tmp/permitext-perf04-417-build.log`, `/tmp/permitext-perf04-417-install.log`). No main merge, push or TestFlight upload.

Mirroring verified exact lowercase `concrete` completes with 1,286 results. After terminating that app process and launching a fresh one, a new `Concrete` query completed with the same count, then repeating `Concrete` and the previous process's lowercase `concrete` also completed with 1,286. Cache event extraction is still required to certify which measured runs were hits; do not infer cache hits from appearance alone. Expanded 2022/2014 groups showed populated snippets; both editions' 403.2.3.3 detail opened with the corresponding edition and text.

An initial 90-second trace contains mistyped/reordered Mirroring input and is not an exact-concrete benchmark. A subsequent 180-second trace `/tmp/permitext-417-concrete-verified.trace` reached its configured time limit; recorder session 47666 was still finalizing at pause. No exact speedup is claimed until export and event pairing are complete.

Remaining: finish this trace, extract first-result/completion/cache-hit and result-open timings, save sanitized evidence, and update plan acceptance. Broader percentile, memory-pressure and airplane-mode device coverage remain separate release checks.

## Resumed evidence — September 22 evening

- The owner subsequently authorized main integration; implementation commit `55302eded` was fast-forwarded and pushed to main before this verification resumed. Fresh device inventory confirms development build 41.7 remains installed.
- The 180-second trace finalized normally and exported, but app events begin at 163 seconds. No search or cache-hit events are present. Its one complete result opening measured request → destination prepared **188.262 ms**, → passage data ready **758.758 ms**, → passage content appeared **771.893 ms**. This different-result sample is not a before/after search benchmark. Sanitized artifact: `PERF_04_BUILD_417_PARTIAL_DEVICE_TRACE_2026-09-22.json`.
- Read-only app-container inspection proves both concrete/Concrete persistent entries exist with 1,286 results,22 filters each,372,632bytes each, engine revision native-exact-phrase-v1 and no snippet bodies. Total cache20entries/1,986,667bytes, within32entries/12MiB. Only aggregate evidence is checked in (`PERF_04_BUILD_417_PERSISTENCE_2026-09-22.json`); raw cache remains local. This is storage proof, not a latency measurement.
- A shorter recording disconnected while Mirroring switched away from Permitext. Waiting for the owner to leave the phone available before another interaction recording. No new build is needed.

# MC-15 source refresh — September 8, 2026

The outstanding publisher-consolidation check for MC-15 is now complete. The American Legal page for [NYC Mechanical Code 508.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-194028), retrieved September 8, 2026, displayed the version label **September 2026 (current)** and the same automatic simultaneous-operation requirement previously verified in the 2022 publisher edition:

> Mechanical makeup air systems shall be automatically controlled to start and operate simultaneously with the exhaust system.

The retained answer remains correct for the stated scenario: manually starting the makeup-air fan separately does not satisfy that automatic-control requirement. The review totals remain **53 retained and 7 revised**. This is a source refresh, with no new model evaluation or independent professional approval.

The original [60-case source-review snapshot](../permitext-sync-server/evals/results/research-owner-code-source-review-2026-09-08.json) remains unchanged, including its historical pending-refresh flag. This addendum records the subsequent retrieval without rewriting earlier campaign evidence.

- Original review file SHA-256: `5008eac9f2adc2a4de7b98d08567e515055a3ad59ebf243451b010ec697c5f7f`
- Captured sentence SHA-256, UTF-8 without a trailing newline: `ad3def93c1820b00f070ce9731289ebd403cafa7ca771cccfd271501199d1561`
- Observed source: American Legal, Chapter 8: New York City Mechanical Code, section 508.1, September 2026 consolidation.
- Scope: the displayed publisher consolidation and this control requirement; the benchmark is not promoted to independent professional approval.

## Complete-body comparison

A subsequent check extends the sentence-level refresh above to the complete substantive section delivered by Research. The [captured source supplement](../permitext-sync-server/evals/results/research-owner-mc15-source-refresh-2026-09-08.json) records the full publisher body, displayed version, URL and hashes. This strengthens the existing refresh; it does not count the historical pending flag as a newly discovered or newly closed issue. The publisher cautions that its site may lag newly adopted legislation or contain temporary errors, so this comparison is not an independent latest-legislation audit.

Run `node scripts/check-research-owner-source-refreshes-20260908.mjs` from `permitext-sync-server` to compare that capture with actual Research assembly. It verifies the unchanged historical review, question and expected answer, then compares the entire MC 508.1 body. Only the duplicated corpus heading and insignificant spacing are normalized. The complete body matches, including its air-balance, intake-location and Energy Code clauses. No production source change is necessary.

The [source comparison](../permitext-sync-server/evals/results/research-owner-mc15-source-comparison-2026-09-08.json) passed with zero network/provider calls; reading the publisher page was a separate web lookup. It adds no generated answer or timing sample and does not resolve the separate presentation note in the earlier live answer. Campaign coverage remains 45/110 numbered cases provider-attempted, with 65 unattempted; conservative usage remains $7.887898 under the original $8 authorization. Project-workflow testing remains paused until the owner asks. No paid provider request or deployment is part of this extension.

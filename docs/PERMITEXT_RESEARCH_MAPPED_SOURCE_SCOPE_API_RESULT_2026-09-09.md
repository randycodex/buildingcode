# Storage-use API confirmation: incomplete

At local commit `8bc4730559231fd43dbbc95f79d6fcf62f6599c6`, the single ZR-06 attempt ended in HTTP 502 after **25.182 seconds**. Terra returned a draft in 24.282 seconds, but it failed the deterministic gates before the semantic verifier was called. There was one provider request, no retry, no external-document request and zero pending accounting entries. The test did not deliver an answer.

The generated draft now includes the explicitly missing special-district status and current zoning-lot area. That targeted improvement is confirmed. It still fails source attribution: the fifth point combines the historical rule with the performance-standard rule but binds only ZR 42-192, omitting ZR 42-193. The prior draft had the reciprocal error. A separate point and a top-level citation correctly naming 42-193 do not repair this point's binding.

Two wording problems also remain. The lead explicitly withholds an as-of-right determination, but its nominal word order triggers the conditional-boundary check. General rule descriptions trigger the mapped-location check despite the answer withholding the property finding. The raw result retains those diagnostics; the replay test does not assert that these false rejections are desirable behavior.

Manual review found a separate completeness defect: the draft discusses documented conforming status and enlargement/extension but omits the reconstruction and nonconforming-use branches present in the supplied excerpt and required by the reconciled key. Those branches remain in the current official [ZR 42-192](https://zr.planning.nyc.gov/article-iv/chapter-2/42-192). The distinct performance obligation is in [ZR 42-193](https://zr.planning.nyc.gov/article-iv/chapter-2/42-193). This is development review, not professional approval.

The answer is also longer. Its main text grew from 190 to 241 whitespace-delimited words, and total authored prose grew from 696 to 966, with six supporting points instead of five. These counts exclude derived conclusion/explanation duplicates, source quotations and metadata. The expected brevity and completeness have not been achieved.

The usage estimate is **$0.048738**, and the conservative recorded cost is **$0.085383**. The fresh $8 round now totals **$3.88680562 estimated usage** and **$7.375051 conservatively**, leaving **$0.624949** of conservative authorization. The failed provider call remains counted even though the app did not charge a Research turn. Historical spending stays separate, and no invoice or account balance was queried. A failed 25-second attempt is not evidence of faster delivered answers or acceptable subscription economics.

The full local Research suite and separate safety/planner checks passed for the runtime change before this live attempt. The new actual-draft replay confirms the missing-fact improvement and preserves the real source-binding rejection with canonical source identities. It does not certify the whole draft.

The consumed single-use driver must not be replayed. Next work is to repair the new boundary wording, make source binding dependable, complete the missing historical branches and reduce repetition before another paid test. The current mapped-language recognition is still too dependent on particular prose forms. All 110 numbered cases remain in scope; no Project workflow, UI, phone, push or deployment work occurred.

Evidence:

- `permitext-sync-server/evals/results/research-owner-api-round2-storage-scope-preflight-2026-09-09.json`
- `permitext-sync-server/evals/results/research-owner-api-round2-live-storage-scope-2026-09-09.json`
- `permitext-sync-server/evals/results/research-owner-api-round2-storage-scope-cost-audit-2026-09-09.json`
- `permitext-sync-server/evals/results/research-owner-storage-scope-answer-review-2026-09-09.json`

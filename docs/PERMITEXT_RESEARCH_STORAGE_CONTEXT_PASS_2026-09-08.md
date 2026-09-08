# Research: preserving self-storage applicability context

The three remaining missing-fact Zoning cases still return a prerequisite response rather than the useful conditional answers in the key. This pass fixes a source omission that would prevent the self-storage case from reaching that answer reliably. It does not enable a parcel determination or count those cases as completed answers.

## Source correction

For ZR-06, the former 8,000-character package included only the first 1,600 characters of ZR 42-192. That lost the section's closing existing-facility provisions. The new selector copies three exact spans from the canonical source: the use-allowance introduction, the designated-area branch introduction, and the full closing existing-facility paragraphs. Those closing paragraphs retain documentation, enlargement, reconstruction and nonconforming-use conditions. The source was rechecked against the [current official section](https://zr.planning.nyc.gov/article-iv/chapter-2/42-192).

The 2,953-character excerpt is reserved as a complete unit before other selected sources share the remaining space. Its metadata binds offsets to a hash of the normalized full section. It explicitly identifies the omitted detailed Subarea 1 space, signage and reporting provisions; it is not marked as the complete section. Changed anchoring text disables the selector for review.

This selector applies only to unresolved self-storage applicability questions. It excludes design, calculation, detailed requirements, dimensions, signage and reporting requests. It does not replace an explicit user-selected passage. If the excerpt and explicit selections cannot be reserved within the existing limits, the optional excerpt is disabled and existing assembly limits apply. No source, provider-spend or model-routing ceiling changes.

Conversation facts can resolve a prerequisite after initial source planning. The production handler now uses a tested helper to reassemble locally before attempting to use a missing-facts excerpt for that resolved question. A refresh that still returns the inapplicable excerpt fails before dispatch. The helper was tested with the actual corpus and assembly path; this is not a fresh live model or full HTTP continuation result.

The same pass corrects an inaccurate completeness flag: selecting whole blocks from part of a larger section does not make the entire section complete. In the 110-case comparison, this affects the ZR 27-111 source in ZR-09; its text and source hash are unchanged.

## Verification and limits

- `npm run test:research-chat` passed, including source assembly, the new excerpt contract, selected-passage HTTP, PDF, edition, citation, and answer-repair regressions. The final intent restriction additionally passed the focused excerpt contract.
- `npm run test:zoning-architecture-v21` passed. Its existing retained result remains unchanged; accepted and known-bad answer controls keep their prior outcomes.
- The focused planner and Zoning safety contracts passed.
- The source comparison preserves all 110 authored input hashes and all eight exact selected passages. ZR-06 changes its source packet; ZR-09 changes only partial-source flags. The other 108 cases' source packets are unchanged.
- No API requests or additional paid spend occurred. The conservative authorization ledger remains $7.853484 of $8, with no pending requests in the retained 19 packages.

Implementation commit: `ab78e6ed2`. The committed-source all-case diagnostic is [research-owner-storage-context-source-diagnostic-2026-09-08.json](../permitext-sync-server/evals/results/research-owner-storage-context-source-diagnostic-2026-09-08.json). It records source hashes, all 110 cases and the prior paid-ledger hashes. Earlier source and paid results remain preserved.

ZR-06, ZR-07 and ZR-13 still stop at their prerequisite gate with zero provider calls. The next required step is an actual cited conditional-answer path that explains supported rules while withholding the unresolved property conclusion. The [rear-yard-equivalent provision](https://zr.planning.nyc.gov/article-ii/chapter-3/23-343) and the [map-incorporation provision](https://zr.planning.nyc.gov/print/pdf/node/18425) were checked while reviewing the other two cases; no reference answer or source approval was changed here. Live campaign coverage remains 41/110 owner cases. No new full-service latency measurement, push, deployment or phone test is claimed.

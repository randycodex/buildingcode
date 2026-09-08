# Research storage source coverage — local implementation

This pass addresses the long Reader selection and automatic storage-retrieval gaps recorded in the [conditional explanation report](PERMITEXT_RESEARCH_CONDITIONAL_EXPLANATIONS_2026-09-08.md). It changes source delivery, not the answer key or the unresolved property determination.

## What changed

When the user selects the entire ZR 42-192 section, an unresolved storage-applicability question can use the existing three complete canonical excerpts instead of a prefix that drops the closing existing-facility conditions. The selector accepts the exact full body or the exact full section with its known heading, after whitespace normalization. Partial selections and changed text do not authorize paragraph substitution. The original selection remains in evidence provenance with its own hash; the supplied excerpt is expressly marked as partial and is not counted as an exact delivery of the whole selection.

Both drafting and verification receive the excerpt's omissions and scope. Saved evidence retains the canonical section hash, span offsets, purpose, omitted-provision warning, and selection status within the immutable snapshot hash. The selected paragraphs cannot establish complete design compliance or resolve missing property facts. Detailed design questions and questions whose prerequisites become resolved still require a different source packet.

For an unpinned storage-applicability question, automatic retrieval now includes the closing ZR 42-192 conditions and reserves the related ZR 42-191 use table and ZR 42-193 additional conditions before incidental definitions and references. These dependencies must resolve completely from the same identified corpus and edition. Missing, mismatched or over-budget dependencies remain explicit coverage gaps. The ordinary 8,000-character and 5,000-character-per-source ceilings remain unchanged.

Number-only reference resolution also now requires a nonempty ID before comparing catalog IDs. Previously, an empty requested ID could match the first catalog entry's empty `webSectionID`, returning ZR 11-00 in place of the requested provision. Reviewed governing dependencies now carry a governing evidence role as well as required citation coverage, so the required claim can actually be satisfied by the supplied source.

The dependency relationship was checked against the official [ZR 42-191 use table](https://zr.planning.nyc.gov/article-iv/chapter-2/42-191) and [ZR 42-193 additional conditions](https://zr.planning.nyc.gov/article-iv/chapter-2/42-193). Neither source supplies a property's missing mapped facts.

## Verification and limits

`npm run check` passed, including the Research chat contracts and broader local regression/governance suite. `npm run test:zoning-architecture-v21` also passed, preserving 16 accepted retained answers and rejection of five known failed answers. The ramp dependency/retrieval contract passed after the shared dependency and resolver changes. These are local source and behavior checks.

The focused source contract verifies full Reader selections, exact preservation of partial selections, canonical span binding, independent snapshot copies and hash changes, automatic discovery, and rejection of missing or mismatched dependency identities. A constrained-budget control preserves an explicit gap, and an explicitly selected discovery passage remains unchanged.

Twenty-one local HTTP flows exercise the real handler, corpus, gates, accounting and saved-answer retrieval. They cover full Reader sections for ZR-06, ZR-07 and ZR-13, unpinned ZR-06 chat, and a historical-law prerequisite control. For each of the four answer scenarios, accepted, verifier-rejected, unsafe, malformed and unavailable-provider doubles are checked. Storage closing conditions and scope limitations must reach both draft and verifier; the full Reader selection and excerpt metadata must survive reopening. All provider responses are simulated. These tests establish pipeline behavior, not live answer quality or model accuracy.

The 110-case source comparison preserves all authored input hashes, all eight exact selected passages and all pinned passage text. The corrected number-only lookup removes wrongly resolved ZR 11-00 supplemental sources in ZR-08, ZR-09, ZR-10, ZR-12, ZR-18, ZR-19, ZR-20 and ZR-21; available genuine references can then use the freed slots. Some supplemental references remain shortened, including a one-character ZR 27-10 source in ZR-09. That is not useful governing coverage and is not treated as proof of answer completeness. ZR-06's excerpt text stays the same, with updated selector metadata. Conditional response eligibility remains ZR-06, ZR-07 and ZR-13; their determinations remain unresolved.

Implementation commit: `ea77baa082a7a49f915c485596793b99cff5e8ff`. The [committed-source diagnostic](../permitext-sync-server/evals/results/research-owner-storage-coverage-source-diagnostic-2026-09-08.json) records that revision, 15 source/input file hashes and all 19 unchanged paid-ledger hashes. Every hash was checked after the run. The [MC-15 source-refresh addendum](PERMITEXT_MC15_SOURCE_REFRESH_2026-09-08.md) separately closes the earlier publisher-consolidation timeout without rewriting the historical review JSON.

Historical question routing and negated archive-availability wording remain open as described in the preceding report. The successful storage Reader HTTP scenario selects full ZR 42-192 and ZR 42-193; the unpinned chat scenario supplies no passages. This does not establish every possible selected-source combination, resolved parcel branch, or detailed storage-design answer.

No paid API call, push, deployment, phone test or full-service latency measurement occurred. The 19-package conservative campaign ledger remains $7.853484 of the authorized $8, with $0.146516 remaining. This is an authorization ledger, not a freshly retrieved provider balance. Live campaign coverage remains 41 of 110 owner cases, with 69 not yet attempted through a live provider. The broader quality goal remains open.

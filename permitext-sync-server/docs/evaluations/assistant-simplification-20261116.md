# Assistant simplification — November 16, 2026

**Follow-up accuracy review:** The gas-furnace case now has a confirmed governing-code selection failure, rather than merely an unverified scope limitation. MC 101.2 assigns fuel-gas-fired appliances to the Fuel Gas Code; the answer used Mechanical Code clearance methods and missed an FGC protection option. See AUTH-001 in the [evaluation log](assistant-evaluation-log.md). The 22 passing topic/citation-binding checks must not be read as 22 legally validated answers. The measured speed/cost results are unchanged.

The local Experimental Assistant now uses one answering agent instead of a mandatory intent planner, mandatory section selector, and then another research agent. The model and settings remain Luna, low reasoning, default service tier. Formal Research and the reviewed Current mode retain their existing workflows. No push or deployment occurred.

## What changed

- Removed the two mandatory model planning/navigation stages and their full chapter-guide/outline inputs. Removed the obsolete standalone planner evaluator as well; historical code and results remain in Git.
- The answering model receives the active project, selected conversation history and relevance-ranked earlier source cards. Up to eight relevant earlier sources are reloaded through the existing immutable content/edition checks without an AI selection call. This is a working window, not a stored-chat or source-count limit; the complete account-scoped archive remains searchable and readable.
- A focused library search returns actual canonically bound text and tables with a server-owned `verified_library_text` status. Those sources are usable immediately, eliminating the mandatory preview-to-read model round. Previews without that status remain noncitable. Additional direct reads, searches and web research are available only when the agent identifies a material gap.
- Full retrieved text is supplied once per model request, deduplicated by current source ID. Tool transcripts retain source identities instead of repeating their bodies. Existing retrieval ranking, full table/footnote binding and immutable snapshots remain in use.
- Old answer citation markers become plain historical-citation notices rather than tempting copied source labels. Explicit local section links are converted to the app's citation format only when the exact section ID has already been read. Unknown IDs remain unverified. Archive tool schemas distinguish H message IDs from R source IDs.
- Provider-capacity recovery now retains recent conversation exchanges as well as the current question and compact source context. Saved messages, source identities and previous answers are unchanged.

This is one runtime path, without a new reviewer, model router, always-on follow-up search or per-topic section list. The agent interprets intent before choosing its first tool within the same model call. Reused evidence is explicitly a starting point rather than an exhaustive search of a changed requirement.

## Paired comparison

Same six synthetic questions and project descriptions as the [baseline](assistant-performance-baseline-20261116.md), with the same model/settings and serial HTTP profiling. Retrieved evidence may differ because the retrieval decisions changed. Each row is one fresh sample, not a randomized trial or production percentile.

| Question | Before | After | Model calls before → after | Estimated USD before → after |
| --- | ---: | ---: | ---: | ---: |
| Apartment count | 7.14 s | 4.36 s | 2 → 1 | $0.00431 → $0.00048 |
| Story-count follow-up | 2.94 s | 2.03 s | 2 → 1 | $0.00427 → $0.00050 |
| Drain slope | 10.02 s | 8.70 s | 4 → 2 | $0.00725 → $0.00479 |
| Duct fire damper | 21.44 s | 7.21 s | 5 → 2 | $0.01876 → $0.00316 |
| Sprinkler follow-up | 18.58 s | 3.91 s | 4 → 1 | $0.02404 → $0.00357 |
| Residential roof elevator | 22.71 s | 13.07 s | 5 → 3 | $0.02672 → $0.00989 |

Across those six questions:

| Metric | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Total response time | 82.82 s | 39.27 s | 52.6% |
| Median of four code questions | 20.01 s | 7.95 s | 60.3% |
| Model calls | 22 | 10 | 54.5% |
| Model input tokens | 268,926 | 62,277 | 76.8% |
| Output tokens, including reasoning | 4,481 | 1,189 | 73.5% |
| Estimated API cost | $0.08535 | $0.02239 | 73.8% |

Query embeddings changed from three to four calls. The final roof question used two searches to resolve its accessible-route obligation; it was not forced into a faster incomplete answer. The residents-only follow-up then took 4.58 seconds and one model call with reloaded evidence and no new search. Earlier development samples were faster on that roof question, but the final implementation's measured result above is the comparison used here.

Costs use the existing configured local ledger rates, including cache-write premiums. They are estimates, not invoice charges or provider account balance. Provider variability, cold preparation and different retrieved text affect the results; these measurements support a substantial improvement in this sample, not a guaranteed latency target.

## Accuracy and context

All seven final comparison turns and fifteen further natural follow-up turns completed and passed topic and citation-binding checks. Code cases now require nonempty citations; the old “every citation is valid” test could pass an empty list. No unknown source marker remained in the final answers. These checks verify identities and conversational subject, not complete legal accuracy.

Manual review of the final paired answers found the project facts and drainage size/slope values preserved. Damper answers retained sprinkler/duct-construction conditions and the separate smoke-damper qualification. Roof answers found the common resident-space accessible-route duty and distinguished it from a private-unit terrace exception. They cite actual retrieved text. The fifteen further turns exercised a correction from corridor to smoke barrier, the same-exception follow-up, a cellar/gym discussion corrected to a mostly-above-curb basement, furnace protection/table/air-gap references, and a return from roof exits to adjacent residential stairs. The regression median was 3.85 seconds, maximum 10.16 seconds, with an estimated cost of $0.06658.

Coverage parity is **not established**. In an intermediate run, the adjacent-stair question reused roof-egress evidence and stopped without retrieving the separation rule; this was recorded, not counted as a success. The general reusable-versus-exhaustive evidence semantics were clarified. The final run used BC 1007.1.1 and stayed on adjacent stairs when residential occupancy was raised, but did not retrieve BC 403.5.1. Overlapping special-building authority coverage remains an open evaluation item. A final roof-exit answer also has a cautious opening that is less direct than its subsequent numerical rule. Appliance-specific governing code-family applicability and broader Zoning exceptions were not independently validated in this pass. These limitations are in the [evaluation log](assistant-evaluation-log.md); no case-specific section routing or additional automatic research pass was added.

Development also exposed omitted citation markers, copied historical citation labels and an unsupported internal-link format. These were corrected at the output/identity contract and tested without a new AI stage. Intermediate failures and costs are retained in the machine-readable report rather than omitted in favor of final passes.

## Verification and budget

Offline checks passed for the answering loop, conditional retrieval, verified text versus previews, source-link conversion, unknown citation rejection, relevant earlier overlapping provisions, immutable evidence recall, table grids/spanning headers/footnotes, cancellation, project-foundation contracts and budget controls. HTTP checks passed for the local experiment gate, unreviewed provenance, replay without extra spend, switching back to reviewed Current mode, updated project context, and 1,000-plus-message history/source persistence. Memory tests also covered 2,000 messages and 2,000 sources, distant corrections, paginated archive access and context recovery preserving the latest exchange. These long-chat tests used mocked provider responses; the new real-model conversations were short.

All development attempts plus the final comparisons increased the existing cumulative accounted estimate by **$0.217546**. The ledger ended at **$5.809667 of $7**, leaving **$1.190333**. The two older uncertain/reserved entries remain counted. No budget reset, model upgrade, production data mutation or deployment was performed.

Detailed results, source identities, prompt/source hashes, intermediate failures and cost accounting: [comparison JSON](assistant-simplification-20261116.json). Raw synthetic traces are under `/tmp/assistant-simplified-*-20261116`. Reproduce with the existing budget ledger using `scripts/evaluate-assistant-natural-followups.mjs`, `PERMITEXT_EVAL_PROFILE=1`, and the performance or simplified-regression case module. Never use a fresh ledger to repeat these tests.

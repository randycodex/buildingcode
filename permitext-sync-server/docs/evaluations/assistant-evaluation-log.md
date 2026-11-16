# Assistant evaluation log

Log observations before proposing behavior changes. Do not automatically add prompt rules or research passes for each entry. Baseline: application `b69513f97`, local Experimental Luna, November 16, 2026. See [profile records](assistant-performance-baseline-20261116.json) for questions, answers, source identities, timings and usage.

## PERF-001 — Fixed planning input for project facts

- **Status:** Open; confirmed systemic efficiency issue.
- **Reproduction:** Synthetic eight-story R-2 project with 56 apartments. Ask “How many apartments are in this project?” then “And how many stories?”
- **Observed:** Correct, concise answers; both use two model calls. Intent planning alone takes 2.92 / 1.85 seconds and receives 11,855 / 11,883 input tokens, including the full 259-chapter guide. Full responses take 7.14 / 2.94 seconds, with the first including warmup.
- **Expected:** Relevant project facts and the latest referent should be usable without a full code-discovery plan where no authority lookup is needed.
- **Triage:** Evaluate compact metadata/ranking and a conditional planning path across many question types. No behavior change implemented.

## PERF-002 — Repeated and broad evidence selection on follow-ups

- **Status:** Open; confirmed redundant work, relevance impact requires review.
- **Reproduction:** One-hour office corridor duct question, followed by “What if we're sprinklered throughout?”; separately, common residential roof accessibility.
- **Observed:** Damper follow-up takes 18.58 seconds, 68,199 input tokens and an estimated $0.02404. Two reads return 32 source entries / 23 unique sections. Initial roof answer uses 88,227 input tokens and returns 43 entries / 34 unique sections across two reads. Answers preserve their subject and cite actually read source identities.
- **Expected:** Reuse sufficient relevant evidence; avoid rereading or transporting equivalent material without a material gap. Do not drop controlling exceptions merely to reduce counts.
- **Triage:** Inspect source selection, neighboring-provision expansion, deduplication and transport before adding instructions or calls. No behavior change implemented.

## TOOL-001 — Source IDs passed as message IDs

- **Status:** Open; confirmed tool-selection failure, medium severity. No confirmed incorrect final legal conclusion from this observation.
- **Reproduction:** Repeat roof conversation, then “But only residents can use it. Does that change anything?”
- **Observed:** The agent calls `read_conversation` with `R14,R15,R21,R20,R23,R35,R8,R7` as message IDs and an empty source-ID list. All eight are unavailable. It then searches and reads the library, answering the resident/common-use distinction correctly. The server operation takes 16.90 seconds, six model calls, 97,148 input tokens and an estimated $0.02253.
- **Evidence:** Repeated follow-up provider trace and recovered answer in the baseline JSON. Final-record citation checks were lost to EVAL-001; do not count them as passed.
- **Expected:** Source and message identities must be distinguished in discovery metadata and tool arguments. Additional source retrieval should address a real evidence need.
- **Triage:** Inspect the identity contract and representation generally, not a roof-specific prompt patch. No behavior change implemented.

## UX-001 — Verbose answer to a narrow damper question

- **Status:** Open; usefulness/length review, not an established authority error.
- **Observed:** Both damper answers retain relevant qualifications but use several dense paragraphs and repeat verification points. The initial answer spends 6.64 seconds in generation and produces 525 output tokens including reasoning.
- **Expected:** Lead with the practical conditional answer and only the material distinctions. Preserve the separate fire/smoke protection requirements when relevant.
- **Triage:** Compare representative answer usefulness before adding another prompt layer. No behavior change implemented.

## EVAL-001 — Recorder mistakes archive source count for a list

- **Status:** Fixed in benchmark only; offline regression passed. A fresh paid rerun after the fix was intentionally not performed.
- **Observed:** `conversation_context.result.sources` is a number, while `read_library.result.sources` is an array. The compact recorder called `.map` on both after successful Assistant responses. One initial follow-up trace was not flushed; the repeat retained API traces through the final answer but lost its client result row.
- **Fix:** Check array shape, preserve partial traces and budget on recorder errors, and test the distinction. This does not change the Assistant or its retrieval.
- **Accounting:** Both affected attempts remain charged in the cumulative ledger. Missing metrics/checks are explicitly marked, not silently treated as passing.

## Unverified areas

No new fabricated-citation or wrong-authority failure was established in this small profiling sample. Citation identity smoke checks do not prove complete governing coverage or legal entailment. Zoning, library effective-date coverage, broad unfamiliar cases and long-chat behavior were not newly evaluated here. Keep those limitations visible; do not label this baseline production-ready.

## November 16 simplification update

Application candidate: `assistant-open-luna-20261116-v2`, based on `ebad072ee`. [Measured comparison and limitations](assistant-simplification-20261116.md), [records](assistant-simplification-20261116.json).

- **PERF-001:** Addressed in the candidate. No chapter guide or planner is sent for fact questions; they now use one model call. The normal runtime no longer calls an intent planner or section selector.
- **PERF-002:** Reduced, still open for ranking/relevance review. Earlier sources are reloaded without an AI selection stage; actual search text is directly citable and source bodies are sent once. Paired input tokens fell 76.8%. Extra searches remain possible when material evidence is missing.
- **TOOL-001:** Addressed at the tool identity contract: H message-ID and R source-ID patterns, explicit candidate types, and no automatic model recall-selection call. No repeated source-as-message misuse appeared in the final run. Broader reliability is not established by this sample.

## CITE-001 — Missing or stale citation markers during simplification

- **Status:** Corrected in candidate; final 22 turns passed strengthened identity/nonempty-citation checks.
- **Observed:** The first simplified prompt allowed correct-looking section references without app-recognized markers. A later regression copied a previous-turn citation notice, and a table answer emitted a `#sectionID` link that the client did not bind as a citation.
- **Fix:** Restored the existing explicit S/W marker protocol, removed reusable old numeric markers from model history, and normalized exact already-read section-ID links/marker punctuation deterministically. Unknown IDs cannot acquire a verified citation. No extra AI pass.
- **Accounting:** Intermediate replies remain failed development cases. Their spending is included. “Every citation is valid” is no longer sufficient to pass these code cases with zero citations.

## COV-001 — Reused related evidence can omit governing overlap

- **Status:** Open for systemic completeness evaluation; high priority when it could change a conclusion.
- **Observed:** An intermediate adjacent-stair question reused roof-egress sources and said the supplied text did not establish a separation distance, rather than looking it up. Subsequent residential qualification triggered the relevant search. The candidate now treats supplied sources as reusable rather than an exhaustive library search, within the existing single-agent instruction.
- **Final result:** Correct subject and the retrieved R-2 separation exception in BC 1007.1.1 were retained, including on the follow-up. BC 403.5.1 was not retrieved in the final regression, so complete overlapping authority coverage is not claimed. A separate offline check verifies that relevant earlier overlapping sources, including previously uncited ones, are reloaded together when they are in the catalog.
- **Triage:** Review indexing, governing-source metadata/ranking and coverage across unfamiliar topics before adding any research stage. No section-number routing rule or automatic follow-up pass was introduced.

## UX-002 — Cautious headline obscures the practical roof-exit answer

- **Status:** Open; usefulness/clarity review.
- **Observed:** Final stair-context roof answer begins “Not necessarily two roof exits,” then explains the two-exit rule for 1–500 occupants and why the small R-2 single-exit exceptions do not appear to fit the stated eight-story project.
- **Expected:** The first sentence should reflect what the actual project facts and retrieved exceptions support. Topic/citation checks passing does not establish that the answer is sufficiently direct.
- **Triage:** Logged rather than patched with another prompt paragraph or model pass. No production-readiness claim.

## AUTH-001 — Gas-furnace answer selected the wrong governing code family

- **Status:** Confirmed material source-selection/coverage failure on follow-up review, November 16, 2026. This strengthens the earlier report's description of an unverified appliance-scope limitation. Application behavior has not been changed for this finding.
- **Observed:** The gas-furnace regression used MC 304.9 and Table 308.4.2 without retrieving governing Fuel Gas provisions. It said the cited sheet-metal methods require insulation or multiple layers. Topic and citation-binding checks passed because the Mechanical Code sources were real; that did not establish applicability.
- **Primary-source check:** [MC 101.2](https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022MC_Chapter1_AdministrationWB.pdf) assigns fuel-gas-fired appliances to the Fuel Gas Code. [FGC 308.4.1–308.4.2 and Table 308.2](https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022FGC_Chapter3_GenRegsWB.pdf) govern furnace clearances/reduction subject to manufacturer instructions and table conditions. Table 308.2 includes a nominal 24-gage sheet-metal method with ventilated airspace; it is not limited to the insulated or multiple-layer methods the answer described.
- **Material effect:** Could incorrectly rule out a compliant protective assembly or apply the wrong clearance/table conditions. It does not establish a permitted distance for the synthetic furnace without its listing and installation facts. No blanket approval of bare/flush sheet metal follows.
- **Triage:** Evaluate code-scope metadata, source-family ranking and whether cited authority actually governs the appliance. No topic-specific routing patch or extra AI pass added.

## Clarification of COV-001 and the test results

[BC 403.5.1](https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022BC_Chapter04_SpecialUseWBwm.pdf) expressly excepts Group R-2. Its omission is a completeness gap; it does not, by itself, overturn the tested R-2 stair conclusion. Missing overlapping authority can materially change results for other applicable occupancies/scenarios.

The final 22 passes remain passes of topic/citation identity checks, not 22 legally validated answers. AUTH-001 demonstrates that distinction. The cellar/gym use interpretation remains unvalidated: [ZR 12-10](https://zr.planning.nyc.gov/article-i/chapter-2/12-10) makes actual classification/use and applicable exclusions material, so a room label alone does not settle the floor-area result. No additional paid model tests or runtime changes were made during this review.

## Single-version release — November 16, 2026

At the user's request, the simplified Assistant is the sole conversational engine (`assistant-luna-20261116-v1`, in `assistant-engine.mjs`). The former Current/Experimental selector and retired Assistant discovery path are removed. Obsolete client mode labels route to the same current engine. Historical answers and their old version identities remain readable. Formal Research retains its separate evidence/review workflow.

Hosted Assistant requests use the existing durable application usage/spend accounting; local tests retain the separate cumulative ledger. The shared Luna/tool allowlist applies to both. Project-context snapshots are captured and checked against the exact answer input. The web shell/cache generation is bumped to replace stale selector assets. Local production builds, the Assistant regression suite, hosted PostgreSQL transport/accounting tests, and cache/Reader attachment checks passed with no paid provider calls during release verification.

This is a version-selection/deployment change, not a claim that AUTH-001, COV-001 or UX-002 have been resolved. Those findings remain open for systemic evaluation.

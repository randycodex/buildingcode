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

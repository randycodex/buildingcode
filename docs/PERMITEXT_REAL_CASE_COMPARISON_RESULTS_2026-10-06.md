# Permitext: real-case instruction experiment, October 6, 2026

The primary comparison completed **80 questions × 3 instruction sets (240 answers)** and **80 blind comparative reviews**. A separate eight-case interface diagnostic generated 24 more answers. All calls were isolated from application storage/history and used Luna. Conservative total cost was **$1.01016** under the user's **$10** cap, including discarded setup calls. Actual account billing was not checked.

The results support investigating simpler writing instructions: minimal instructions scored higher on completeness and directness, while the current policy set had better citation support and fewer flagged unsupported claims. Correctness averages were close. These are provisional machine scores against draft references over frozen local evidence; they do not establish the best production configuration.

| Instruction set | Correctness /4 | Completeness /4 | Directness /4 | Citation support /4 | Answers with flagged unsupported claims |
| --- | ---: | ---: | ---: | ---: | ---: |
| minimal | 3.36 | 2.49 | 3.61 | 3.04 | 38/80 |
| simplified | 3.40 | 2.34 | 3.56 | 3.25 | 21/80 |
| current | 3.34 | 2.01 | 3.33 | 3.38 | 11/80 |

## Findings to review before the policy decision

**Retrieval is a separate limitation.** All 20 energy/electrical packets lacked those code families, and 27 total packets lacked their listed family. Even family presence did not guarantee the governing provision: ZR-01 supplied FAR but missed the floor-area definition relevant to the roof-deck question. All three instruction sets then stopped short of the expected answer. The reviewer classified 54 packets as partial, 23 as historical basis unresolved and three as absent, relative to the draft reference requirements. Its classification should not be taken to mean that every narrower question was unanswerable.

**Interface semantics must remain clear in every arm.** The initial production binding audit passed 3/80 minimal, 0/80 simplified and 77/80 current answers. Nearly all minimal/simplified failures put enacted references into the field reserved for provided web claims. A separate diagnostic selected the first-listed case from every family and disabled that unused field in all three arms, while preserving all behavioral instructions and evidence. Binding validation then passed **8/8 for every arm**. This demonstrates an interface issue rather than a need for the entire current behavioral policy. The diagnostic received no paid grading, is not an independent acceptance baseline, and is not combined into the primary scores.

**Prose and structured details differ.** In FGC-01, minimal explained the limited gas-restoration exception in the main prose; current and simplified retained it in their source-bound details. Review both before treating a shorter body as an omitted legal condition. In PC-01, all three directly answered the sillcock question and current was shortest. [NYC Plumbing Code §606](https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022PC_Chapter6_WaterSupplyWBwm.pdf), [FGC §406.6.2.1.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198131).

**Semantic review still matters.** MC-06's current-policy answer treated an air-change value as an occupant increment and narrowed a trigger applying to all exhaust to kitchen/bath exhaust. The published table/footnote support that distinction; the HTML table itself omits the additional-bedroom occupant number, so that missing value still needs complete-table verification. [MC §403.3.1.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193237).

**The machine reviewer is provisional.** It sometimes used preference arrays as rankings and sometimes as ties, so no win counts are reported. It sometimes labeled lack of corroborating text as a reference disagreement and omissions as forbidden claims. One case (ZR-09) failed exact rubric partition accounting. The key remains draft, and numeric averages do not establish professional accuracy or a release pass.

## Experiment boundary

The current policy set consolidated instructions originally mixed into the data input, which changes their message placement. This is a writer-only policy comparison over identical evidence, not an unchanged application pipeline. Web support and semantic retrieval were disabled in the frozen local profile; there was no production reviewer, repair loop or account persistence. The minimal arm retained the common JSON schema and source metadata. No production instruction settings, source guards or code-answer approval rules were changed.

The initial v2 setup incorrectly forced practical-next-step guidance. It was stopped before any grading and excluded from the comparison. Its 42 calls cost $0.11732 conservatively and remain included in the same cumulative cap. Corrected v3 generated all first answers before grading; no primary answer was rewritten after a grade was read.

The controls and spending audit passed: **386 calls**, all returned **gpt-6-luna/default**, all provider usage settled, source and answer hashes preserved, and the diagnostic changed only the unused web-support field. This proves the recorded local experiment, not deployed behavior.

## Review materials

- [All 80 cases, main prose, source-bound details and draft references](</Users/randy/.codex/experiments/permitext-real-cases/20261006-v3/paid-run/answers-for-review.md>)
- [Primary scores and separate interface diagnostic](</Users/randy/.codex/experiments/permitext-real-cases/20261006-v3/paid-run/summary.json>)
- [Execution and cumulative spending audit](</Users/randy/.codex/experiments/permitext-real-cases/20261006-v3/execution-audit.json>)
- [Agent source spot checks](</Users/randy/.codex/experiments/permitext-real-cases/20261006-v3/manual-observations.json>)
- [Detailed methods/report](</Users/randy/.codex/experiments/permitext-real-cases/20261006-v3/paid-run/comparison-report.md>)

The next decision can distinguish writing-policy simplification, the interface contract, missing Research corpora/definitions, and full-pipeline verification. A full-pipeline replay with adequate authoritative evidence is still needed before changing the production restriction strategy.

# Technical-source retrieval review — September 8, 2026

The owner's 60 cases exposed missing controlling provisions even when Research retrieved a related subsection. The new technical-topic routes select reviewed source locations for gas installation, ventilation, permit and inspection procedure, and drainage questions. They contain no reference answers, numeric thresholds or invented project facts. Edition and selected-source boundaries remain in the existing corpus router.

## Question-only results

| Measure | Before | After |
| --- | ---: | ---: |
| Cases with every exact reviewed reference | 44/60 | 59/60 |
| Previously complete cases lost | — | 0 |
| Cases with no evidence | 0 | 0 |
| Mean assembled evidence characters | 16,159 | 15,448 |
| Existing ten paraphrase/value controls | 9/10 | 10/10 |
| External/provider calls | 0 | 0 |

Fifteen cases gained complete exact-reference coverage: FGC-02, FGC-05, FGC-09, MC-04, MC-07, GAP-01, GAP-02, GAP-08, GAP-09, GAP-10, GAP-11, GAP-14, GAP-15, PC-04 and PC-12.

MC-01 remains an exact-reference miss for **MC 403**. That is a section grouping without a standalone canonical body in the app; the assembled sources include the complete **MC 401.2** air-conditioning trigger and **MC 403.1** ventilation-system rule. The immutable source-review key still lists MC 403. Its reference was not changed to manufacture a perfect score. These passages support the requested ventilation conclusion, but retrieval does not prove that a generated answer uses them correctly.

The retained JSON diagnostic records each question, expected and retrieved references, source text hashes, assembly usage and timing. Local timings exclude generation and network. The character reduction is not a measured end-to-end speed improvement.

An earlier broad ranking experiment recovered four references while creating other misses and increasing context size; it was reverted. The final change retains the previous ranking algorithm and adds source routes only.

## Validation and limits

The existing 27-case retrieval benchmark retained all 55 required references; the distinct 36-case benchmark retained all 92. The new boundary test covers alternate wording, nearby unrelated questions, same-number historical sources and a restricted catalog. The Research chat suite passed, including PDF attribution, selected passages and edition boundaries. The main check (`npm --ignore-scripts run check`) and smoke suite also passed.

This is local retrieval evidence. Generated-answer completeness, concise PDF presentation, useful missing-fact responses and consistent calculation wording still need work. No deployment or professional approval is implied. This pass incurred no API charges.

Evidence: `permitext-sync-server/evals/results/research-owner-technical-route-retrieval-2026-09-08.json`.

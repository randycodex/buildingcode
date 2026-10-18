# Substantive Research latency follow-up

Follows `623be14f9` on `codex/research-context-speed`. No production deployment.

## Diagnosis

The prior replay's actual answers took 48.26 and 41.35 seconds. Its context-only correction is excluded from this performance comparison.

| Component | First answer | Follow-up answer |
| --- | ---: | ---: |
| Discovery model calls (included in retrieval) | 11.55 s | 17.36 s |
| Total retrieval, including discovery | 28.83 s | 21.23 s |
| Draft model | 7.44 s | 8.60 s |
| Citation/substantive review model | 10.29 s | 10.64 s |

Provider responses confirm that discovery and review used Standard, while the writer used Fast/Priority. `openAIResearchInvestigationDecision` hardcoded Standard regardless of the interactive Research tier. A CPU profile with recorded provider responses independently identified repeated linear section-catalog lookups during the initial index build. This profile makes no new legal judgments and uses no paid model calls; the original recorded replies drive the same conversation.

Large source packets also contain duplicated metadata. This change deliberately preserves those packets and all evidence text instead of compacting them without a separate accuracy evaluation.

## Changes

- Discovery and open-engine citation review inherit `PERMITEXT_RESEARCH_SERVICE_TIER`. The checked-in interactive configuration already selects `priority`. `PERMITEXT_RESEARCH_OPEN_SERVICE_TIER=default` explicitly restores Standard for those stages. Only priced values `default`, `priority`, and `fast` are accepted. This applies to the open engine; the older verifier's separate configuration is unchanged.
- Exact section lookup builds a map once per immutable catalog identity instead of scanning the complete catalog on every lookup. First-record alias precedence is retained; replacement catalog arrays receive a fresh map. No sections, passages, definitions, table data, or source editions are removed.
- Operation logs now separate discovery-model, initial-generation, open-review, and open-repair timings. `retrievalMilliseconds` still includes discovery; do not add those two fields together. Failed/interrupted stages may have no completed timing.

The model remains Luna, investigator/reviewer reasoning remains medium, writer reasoning remains low, and repair reasoning/tier remain unchanged. Citation validation, bounded repair, fresh full-answer review, source version checks, and pre-dispatch cost reservation/settlement are retained. Fast processing has a per-token premium and may be downgraded by the provider; use the returned tier and measured latency, not a guaranteed speed multiplier.

Official reference: https://developers.openai.com/api/docs/guides/priority-processing

## Results and validation

| Actual research turn | Prior version | New run 1 | New run 2 | New mean | Mean reduction |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial use-group question | 48.26 s | 42.96 s | 36.68 s | 39.82 s | 17.5% |
| Project-specific follow-up | 41.35 s | 27.38 s | 23.58 s | 25.48 s | 38.4% |

These are isolated local replays of the same actual questions and 43 site facts, covering the same 54,298 indexed passages. The prior version has one live run; the updated version has two. They are observations, not statistically established production percentiles. All four new substantive answers passed the first full review, retained citations, and reopened in their isolated conversations. None required repair. The context-only third turn is excluded from the performance claims.

All three live adversarial review controls were rejected: invented proposed occupancy facts, forged citations, and a claim that chat detached/deleted the selected Project. Recorded-response replay also asserted exact ordered source-packet equality (excluding retrieval timestamps) and exact embedding-input equality against the prior version. The old linear lookup no longer appears among the CPU profile's leading self-time frames.

Cost tradeoff: the prior two-answer replay cost an estimated $0.0598; the new replays cost $0.1027 and $0.0954. Total cumulative estimated testing spend including the preceding task and new negative controls is $0.6954 of the approved $12. All provider outcomes settled. These are usage-based estimates, not invoice totals.

Focused checks passed: `test:research-context-speed`, `test:research-latency`, Research cost guardrails, and provider cost accounting (including 2x Fast rates, returned Standard downgrades, and conservative missing-tier handling). Syntax and staged whitespace checks passed. The aggregate repository suite retains the unrelated baseline failures documented in RESEARCH_CONTEXT_SPEED_2026-10-15.md; it is not represented as green here.

Detailed local artifact: `research-latency-results.json` in this task's visualization directory. Raw replay data remain outside Git at `/tmp/permitext-context-replay-20261015/`. No production records were modified. No push or deployment was performed.

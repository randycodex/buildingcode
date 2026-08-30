# Permitext Zoning Research — Supplemental Evidence Budget Prototype

Date: August 30, 2026

Working branch: `codex/zoning-research-beta1`

Status: **NO-COST PROTOTYPE PASSED; 24,000-CHARACTER CANDIDATE NOT ENABLED**

## Purpose and boundary

The expanded diagnostic showed that large assembled evidence packages are a material Zoning cost driver. This prototype tests a separate cap on evidence added after user-selected exact passages and reviewed structured sources. It does not lower the existing 48,000-character aggregate ceiling, change Production behavior, authorize another paid run, enable public Zoning Research, or change price or allowance.

The prototype is available through:

```text
node tests/research-evals.mjs --zoning-expanded-batch-1 --zoning-evidence-budget-prototype --max-supplemental-characters N
```

It runs the complete frozen 30-case cohort through the actual Research conversation and evidence-assembly path in local evidence-package-only mock mode. It makes no provider call and fails if an exact selected passage or reviewed structured source is truncated or omitted.

## Results

| Evidence state | Cases | Supplemental candidate | Average assembled characters | Maximum | Exact selected sources | Structured selected sources | Discovered sources | Cross-references |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Retained paid result | 28 completed | Existing aggregate limit | 42,033 | 48,000 | Not separately metered in the retained version | Not separately metered | 106 | 37 |
| Prototype A | 30 | 18,000 | 30,448 | 48,000 | 87/87 preserved | 8/8 preserved | 114 | 20 |
| Prototype B | 30 | 24,000 | 34,821 | 48,000 | 87/87 preserved | 8/8 preserved | 114 | 31 |
| Prototype C | 30 | 30,000 | 37,997 | 48,000 | 87/87 preserved | 8/8 preserved | 114 | 34 |

The retained paid sample has only 28 completed cases while each no-cost prototype includes all 30, so the rows are directional rather than a controlled cost comparison. The prototype proves evidence retention and package-size behavior, not semantic answer quality or actual model savings.

## Candidate disposition

The 24,000-character supplemental candidate is the retained next-test configuration. Relative to the 18,000 candidate, it retained 11 additional cross-references for 4,373 more average characters. Relative to the 30,000 candidate, it retained 31 of 34 cross-references while avoiding 3,176 average characters.

This is a test candidate only. The default remains unchanged. Before any Production decision, the candidate must:

1. retain every exact passage and reviewed structured source;
2. retain every required citation and controlling provision in the frozen cohort;
3. continue to pass the full no-cost Research, recall, Zoning-safety, and UX contract suite;
4. receive a clean semantic result under a new explicit paid authorization and cumulative cap; and
5. show measured cost improvement without quality regression.

Source answer-key corrections remain a separate owner-review gate. No paid semantic run is authorized.

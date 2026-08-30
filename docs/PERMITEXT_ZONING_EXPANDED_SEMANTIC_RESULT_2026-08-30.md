# Permitext Zoning Research — Expanded Batch 1 Semantic Result

Date: August 30, 2026

Working branch: `codex/zoning-research-beta1`

Status: **PARTIAL DIAGNOSTIC RETAINED; AUTHORIZATION CONSUMED; PUBLIC ACCESS DISABLED**

## Frozen run

- Run ID: `5e394dd0-fce2-4fd7-8c5a-cb05dcb29e53`
- Source commit: `a649039c535eb12ab307414ec54ea60292bbd07a`
- Dataset SHA-256: `b540dfd3df2b7f0a23a52306ffe6d5d2ae1df78719d189b1638885ab82c09864`
- Scope: the separately frozen 30-case expanded cohort, one repetition.
- Written cumulative cap: $5.00.
- Settled paid evaluation spend: $3.247980 across 104 paid provider and grader requests; zero requests remain pending.
- Estimated model cost represented in the result: $2.324002 for answers plus $0.765441 for judging, or $3.089443 total.
- Completion: 28 completed and charged operations; two operations failed closed and were not charged to a user.
- Charging integrity: passed. Failed, replayed, rejected, and uncompleted operations consumed no user turn.

The one-time paid authorization is recorded as consumed in the generated cohort. A future paid run requires a new explicit owner authorization and a new cumulative cap.

## Quality and operating result

- 12 of 28 graded answers passed all required gates.
- 16 graded answers failed at least one required gate.
- Two operations failed before grading: the amendment-history structured evidence was rejected, and the R7A height answer failed the deterministic verifier.
- Production operating cost: $2.482539, including $0.158535 of failed operating work.
- Completed-turn operating cost: $0.083000 mean, $0.080161 p50, $0.128580 p90, and $0.157462 maximum.
- Failed-work-amortized operating cost: $0.088662 per completed turn, or $8.87 per 100 all-Zoning turns.
- Latency: 23.449 seconds p50 and 45.581 seconds p90.
- Verification revision rate: 60.71% (17 of 28 completed turns).

This is a diagnostic result, not a release or pricing result. It failed the quality gate and exceeds the existing $4–$6 later cost target for 100 turns.

## Subscriber-economics sensitivity

The no-cost sensitivity preserves the V6 distribution and every previously accepted tax, refund, support, infrastructure, and contribution assumption. It substitutes the expanded Zoning distribution only for the indicated share of a fully used 100-turn month.

| Zoning share | Provider p50 | Provider p90 | Web p90 contribution | iOS 15% p90 contribution |
| ---: | ---: | ---: | ---: | ---: |
| 0% | $5.74 | $6.06 | $4.16 | $2.14 |
| 25% | $6.52 | $6.88 | $3.34 | $1.32 |
| 50% | $7.30 | $7.70 | $2.52 | $0.50 |
| 100% | $8.86 | $9.33 | $0.89 | -$1.13 |

The all-Zoning iOS p90 scenario is negative under the current planning reserves. This does not authorize a price or allowance change. It establishes that public Zoning Research needs lower evidence/model cost and a clean quality result before the existing commercial decision can be revisited.

## Evidence-cost pressure

The permanent no-cost command `npm run audit:zoning-evidence-cost` measures the retained expanded result without a provider call. Across 28 completed cases, owner-reviewed exact passages averaged 6,262 characters while the final assembled evidence packages averaged 42,033 characters. Eleven cases reached at least 47,000 of the 48,000-character ceiling, and 17 of 28 answers required a verifier-driven revision.

This identifies supplemental discovery, canonical context, cross-references, and structured sources as a measured cost-reduction target. The subsequent no-cost prototype preserved all 87 exact selected sources and eight reviewed structured sources across all 30 cases. Its retained 24,000-character supplemental candidate averaged 34,821 assembled characters and kept 31 cross-references. It is not enabled and does not authorize lowering the evidence ceiling. Evidence: [PERMITEXT_ZONING_EVIDENCE_BUDGET_PROTOTYPE_2026-08-30.md](./PERMITEXT_ZONING_EVIDENCE_BUDGET_PROTOTYPE_2026-08-30.md).

## Failure classification

### No-cost pipeline and evaluator defects repaired

- The evaluator incorrectly required a nonempty `explanation` even though the product contract permits a valid concise answer with an empty explanation. The evaluator now requires a nonempty conclusion and a string explanation, matching the product contract.
- Amendment-history grids were not using the immutable row/cell evidence schema and were hashed with a different payload shape. The adapter now emits valid immutable structured evidence, and a round-trip contract covers it.
- Ordinary structured Zoning table cases did not explicitly select their rich table source. The evaluation adapter now selects structured tables for all table-category cases, not only Appendix visual cases.
- The answer prompt now requires specialized, unusual, or awkward enacted legal wording to be reproduced exactly before paraphrase, preventing silent normalization of source language.

These repairs do not retroactively change the retained result.

### Answer keys requiring owner re-review

- `zr-candidate-b1-r6a-uap-insufficient-affordable-area`: the model correctly refused to invent a one-for-one UAP FAR increment rule that is absent from the selected enacted evidence. The existing required concepts penalize that safe refusal and therefore cannot remain as written.
- `zr-candidate-b1-deep-through-lot-vertical-yard`: the model correctly applied the R7A-specific rule in ZR 24-382 for a through lot at least 180 feet deep. The existing key instead applies a general 190-foot/40-foot/60-foot height-tier analysis and conflicts with the selected controlling provision.

The proposed revisions are isolated for owner disposition in [PERMITEXT_ZONING_BATCH1_RUBRIC_REVIEW_2026-08-30.md](./PERMITEXT_ZONING_BATCH1_RUBRIC_REVIEW_2026-08-30.md). The frozen cohort has not been silently changed.

### Real or mixed answer omissions

The remaining failed answers identify useful engineering targets. They include omitted project-location and mapped-applicability facts, incomplete pre/post-December 5, 2024 parking analysis, incomplete zoning-lot and cellar definition consequences, omitted calculation steps and margins, and incomplete effective-date or historical-map distinctions. Some rubrics also contain collateral concepts beyond the question and need scope review before another paid run.

## Boundary and next gate

- Public Zoning Research remains disabled.
- The $20 price and 100-turn allowance remain unchanged.
- No second paid run is authorized.
- No merge, push, deployment, Production configuration, or provider-plan change is authorized by this result.
- Next: complete owner review of the two invalid answer keys, pass the 24,000-character supplemental candidate through the full no-cost gate, then decide whether a newly capped clean semantic run is justified.

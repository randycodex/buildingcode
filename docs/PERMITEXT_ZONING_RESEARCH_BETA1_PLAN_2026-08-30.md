# Permitext Zoning Research — Beta 1 Enablement Plan

Date: August 30, 2026

Working branch: `codex/zoning-research-beta1`

Status: **CURRENT CORPUS; IN SCOPE FOR BETA 1; PUBLIC ACCESS DISABLED**

## Decision

Zoning Resolution Research is now a planned Beta 1 capability. This changes the work plan, not the public product: Zoning remains available only in Reader and Search until every gate below passes. No Production flag, deployment, pricing, subscription allowance, or provider configuration changed.

## Current evidence

- Permitext's imported corpus now represents official text changes through August 13, 2026.
- The official New York City Department of City Planning Zoning Resolution homepage reported text changes through August 13, 2026 when checked read-only on August 30.
- The official recently-adopted list identifies two August 13 text amendments, both affecting Appendix F:
  - `N 260156 ZRQ`, 63-02 Fresh Pond Road, Queens CD 5, Map 1, MIH area 1 (Option 1).
  - `N 250254 ZRQ`, 50-20 108 Street, Queens CD 4, Map 3, MIH area 4 (Option 1).
- A full staged import retained 4,068 stable sections and 313 structured tables, increased map references from 209 to 211, amendment events from 13,141 to 13,152, and local assets from 433 to 435.
- The exact substantive text change is in Appendix F/Queens; no selected operative provision for the six revised cases changed. All six were nevertheless re-reviewed and revised from the current live official sections and amendment-history endpoint.
- The original local evaluation set contains 21 evidence-ready cases, all owner-approved for Terra answer-key testing only. The six externally revised cases received explicit owner approval on August 30 after current-source review.
- A separate immutable expanded cohort contains those unchanged 21 cases plus nine owner-approved Batch 1 cases. After its retained paid diagnostic exposed two invalid keys and six rubric-scope decisions, the owner approved all eight dispositions. A second separately frozen 30-case remediation successor contains only those approved changes; all 30 pass no-cost canonical-evidence preflight and conversation creation. Source Cases 1, 3, and 11 remain held outside both cohorts.
- The current contract intentionally has `researchEligibility: false`; no public Research path is enabled.

Official source: [NYC Zoning Resolution](https://zr.planning.nyc.gov/)

## Fail-closed sequence

1. **Freshness — complete** — the complete official corpus was refreshed through August 13, 2026 in a separate staging directory before the verified package replacement.
2. **Diff review — complete** — the two official August 13 Appendix F adoption records, two new assets, stable identifiers, table grids, amendment-history additions, source hashes, and search-index effects were reviewed.
3. **Corpus contracts — complete** — section completeness, stable identity, citation, table, map/asset, amendment-history, Reader, Search, prepared-content, and compressed native Reader checks pass against the refreshed corpus.
4. **Evaluation refresh — complete** — selected evidence and the review packet were regenerated from the refreshed corpus after current official-source review. No draft case was promoted by automation.
5. **Owner review — complete** — the owner approved all six revised cases for Terra answer-key testing only on August 30. This is not professional zoning sign-off, paid-test authorization, or public enablement.
6. **No-cost Research contracts — complete** — the Research request, verifier, and deterministic answer gate now enforce exact Zoning passage/hash binding, separate property identifiers and official-map evidence for unresolved mapped applicability, map limits, exact special-district scope, structured-table/symbol fidelity, material definition clauses, decision-relevant arithmetic without duplicate proof, amendment-history limits, current-transition versus historical-substantive-text boundaries, date-specific paths, and stated-scenario application. Public Zoning Research remains off.
7. **Paid validation — two diagnostics retained; quality gate not passed** — the first frozen 21-case run spent $1.857548 and passed 11/20 graded answers. After no-cost remediation and a separate owner-approved Batch 1 freeze, the one authorized 30-case run spent $3.247980 under its $5 cap, completed 28 operations, failed two without a user charge, and passed 12/28 graded answers. Its authorization is consumed. Four no-cost pipeline/evaluator defects are repaired, and the owner approved both corrected answer keys plus six scope dispositions. A separate exact-SHA authorization record and dedicated runner are prepared but locked; a clean rerun remains unapproved and requires a new owner decision and cumulative cap.
8. **Batch 1 expansion — owner-approved remediation successor frozen; no-cost gate passed** — the original 21-case and expanded 30-case cohorts remain unchanged. A second separately frozen 30-case successor binds the parent and both review documents, applies only the eight owner-approved dispositions, and preserves every question, selected evidence section, and forbidden claim. It passes 30/30 no-cost canonical-evidence and conversation-creation checks. Source Cases 1, 3, and 11 remain held.
9. **Economics — updated sensitivity and evidence-cost prototype complete; decision gate not passed** — the expanded Zoning production sample projects $8.87 per 100 all-Zoning turns after failed-work amortization. Mixed 100-turn provider p90 is $6.06 at 0% Zoning, $6.88 at 25%, $7.70 at 50%, and $9.33 at 100%. At 100% Zoning, modeled p90 contribution is $0.89 on web and negative $1.13 on iOS at 15%. The no-cost audit found 42,033 average assembled evidence characters versus 6,262 average reviewed exact-passage characters. A three-budget real-reassembly prototype preserved all 87 exact selected sources and eight structured sources; the retained 24,000-character supplemental candidate averaged 34,821 assembled characters and kept 31 cross-references. It remains disabled pending full no-cost and semantic confirmation. The $20 price and 100-turn allowance remain unchanged assumptions.
10. **Enablement** — enable public Zoning Research only after the exact refreshed corpus, evaluation evidence, cost result, web/iOS presentation, release commit, and manual acceptance are bound together and approved.

## Six revised cases approved for evaluation testing

The current official-source revisions materially improve all six cases, and the refreshed corpus retrieves every selected section. Their recorded disposition is **approved for Terra answer-key testing only**.

| Case | What the owner will confirm after refresh |
| --- | --- |
| `zr-special-district-demolition` | Sections 101-04 and 101-75 establish the Atlantic Avenue Subdistrict scope, prerequisites, and unsafe-building exception without making the rule citywide. |
| `zr-amendment-history` | Section 42-00 metadata is clearly separated from a complete historical reconstruction, with effective dates and official reports requiring verification. |
| `zr-missing-location-facts` | The answer refuses a parcel conclusion without location, district, special-district, and mapped-subarea facts and keeps Appendix J authoritative. |
| `zr-r7a-standard-far` | The 4.00 FAR arithmetic and 2,000-square-foot exceedance use zoning floor area, not unsupported gross-building-area language. |
| `zr-r7a-affordable-far-qualification` | The 5.01 table ceiling is separated from actual qualification and entitlement under Article II, Chapter 7. |
| `zr-inner-transit-zone-new-unit-parking` | The zero-space conclusion preserves the December 5, 2024 transition, Section 11-333 vesting path, existing-parking distinction, and certificate-of-occupancy definition. |

## Current gate result

The permanent no-cost command `npm run audit:zoning-freshness` compares the official homepage date with the imported contract. After the controlled refresh, its expected August 30 result is:

- imported: `2026-08-13`
- official: `2026-08-13`
- status: `current`
- public Research: disabled

The no-cost Zoning safety gate passed the complete repository check on August 30 without an API key or paid model call. It also corrected the routed Zoning edition label from July 16 to August 13 and added a permanent contract binding that label to the imported corpus metadata.

The first frozen paid diagnostic is retained at `permitext-sync-server/evals/results/2026-08-30T16-28-27-054Z-5b54b6cf-2a04-4a4a-a920-edb2d65bf4f6.{json,md}`. Its charging controls and $5 cap passed, but the quality result did not: 11 graded answers passed, nine failed at least one critical condition, and one production turn failed closed before grading. Its initial no-cost engineering targets are documented in [PERMITEXT_ZONING_RESEARCH_REMEDIATION_2026-08-30.md](./PERMITEXT_ZONING_RESEARCH_REMEDIATION_2026-08-30.md).

The owner also supplied `Permitext_NYC_Zoning_Research_Evaluation_Cases_Batch_1.md` after the first frozen run began. Its no-cost source-integrity intake maps all 42 unique cited ZR section URLs to current canonical sections and verifies all 12 stated calculations. The source document's seven READY and five BLOCKED labels were not treated as approvals. After independent review, the owner approved Cases 2, 4, 5, 6, 7, 8, 9, 10, and 12 for evaluation testing only; Cases 5, 10, and 12 deliberately require an insufficient-evidence result. Case 1 still needs narrowing, Case 3 remains a near-duplicate, and Case 11 remains held for visual-map evidence. The approved nine were appended only to `zoning-cases-expanded-batch-1.json`, a separately frozen 30-case successor. The original 21-case file and first retained paid result were not altered.

The one authorized expanded run is retained as run `5e394dd0-fce2-4fd7-8c5a-cb05dcb29e53`, bound to source commit `a649039c535eb12ab307414ec54ea60292bbd07a`. It spent $3.247980 across 104 settled paid requests, completed 28 charged operations, failed two operations without a user charge, and passed 12/28 graded answers. The expanded all-Zoning projection is $8.87 per 100 turns, and mixed-month p90 reaches $9.33 at 100% Zoning. The retained result also proves that source Cases 2 and 4 have answer-key defects rather than product-answer defects. The owner approved both source-bound replacements and the six separately audited scope dispositions. Their separately frozen successor now passes 30/30 no-cost evidence and conversation checks; full lineage and gate evidence are in [PERMITEXT_ZONING_OWNER_APPROVED_SUCCESSOR_2026-08-30.md](./PERMITEXT_ZONING_OWNER_APPROVED_SUCCESSOR_2026-08-30.md). A clean semantic run is not authorized. Public Zoning Research remains disabled; no price or allowance changed.

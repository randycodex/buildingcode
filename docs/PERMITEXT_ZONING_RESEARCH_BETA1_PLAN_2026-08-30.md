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
- A separate immutable successor contains those unchanged 21 cases plus nine owner-approved Batch 1 cases. All 30 pass no-cost canonical-evidence preflight and conversation creation. Source Cases 1, 3, and 11 remain held outside the cohort.
- The current contract intentionally has `researchEligibility: false`; no public Research path is enabled.

Official source: [NYC Zoning Resolution](https://zr.planning.nyc.gov/)

## Fail-closed sequence

1. **Freshness — complete** — the complete official corpus was refreshed through August 13, 2026 in a separate staging directory before the verified package replacement.
2. **Diff review — complete** — the two official August 13 Appendix F adoption records, two new assets, stable identifiers, table grids, amendment-history additions, source hashes, and search-index effects were reviewed.
3. **Corpus contracts — complete** — section completeness, stable identity, citation, table, map/asset, amendment-history, Reader, Search, prepared-content, and compressed native Reader checks pass against the refreshed corpus.
4. **Evaluation refresh — complete** — selected evidence and the review packet were regenerated from the refreshed corpus after current official-source review. No draft case was promoted by automation.
5. **Owner review — complete** — the owner approved all six revised cases for Terra answer-key testing only on August 30. This is not professional zoning sign-off, paid-test authorization, or public enablement.
6. **No-cost Research contracts — complete** — the Research request, verifier, and deterministic answer gate now enforce exact Zoning passage/hash binding, missing-location and mapped-applicability boundaries, map limits, exact special-district scope, structured-table/symbol fidelity, explicit arithmetic inputs and units, amendment-history limits, and effective-date/transition facts. Public Zoning Research remains off.
7. **Paid validation — first diagnostic complete; quality gate not passed** — the owner authorized one frozen 21-case run with one repetition and a $5 cumulative ceiling. It spent $1.857548, completed 20/21 production turns, passed 11/20 graded answers, and preserved zero user charge for the failed operation. The authorization is recorded as consumed and the paid runner is locked again. The subsequent no-cost remediation now supplies bounded named definitions, structured Appendix J text tables with maps excluded, and official amendment-history metadata; 21/21 cases pass conversation creation. Retain the first result as partial diagnostic evidence and require a clean rerun under new authorization before enablement.
8. **Batch 1 expansion — no-cost gate complete** — the owner approved source Cases 2, 4, 5, 6, 7, 8, 9, 10, and 12 for evaluation testing only. Cases 1, 3, and 11 remain held. The original 21-case cohort is unchanged; a separately frozen 30-case successor binds its parent/source/intake hashes and passes 30/30 conversation creation. Paid evaluation remains locked with no authorized cap.
9. **Economics — preliminary sensitivity complete; decision gate not passed** — the Zoning production sample projects $7.17 per 100 all-Zoning turns after failed-work amortization. Mixed 100-turn provider p90 is $6.06 at 0% Zoning, $6.43 at 25%, $6.80 at 50%, and $7.54 at 100%. The quality gate failed and only 20 turns completed, so the $20 price and 100-turn allowance remain unchanged assumptions.
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

The first frozen paid diagnostic is retained at `permitext-sync-server/evals/results/2026-08-30T16-28-27-054Z-5b54b6cf-2a04-4a4a-a920-edb2d65bf4f6.{json,md}`. Its charging controls and $5 cap passed, but the quality result did not: 11 graded answers passed, nine failed at least one critical condition, and one production turn failed closed before grading. The no-cost engineering targets identified by that run are now implemented and documented in [PERMITEXT_ZONING_RESEARCH_REMEDIATION_2026-08-30.md](./PERMITEXT_ZONING_RESEARCH_REMEDIATION_2026-08-30.md); 21/21 cases pass current-source preflight and conversation creation without a model call. Semantic resolution remains unproven until a newly authorized clean frozen run. No price, allowance, Production configuration, or public eligibility changed.

The owner also supplied `Permitext_NYC_Zoning_Research_Evaluation_Cases_Batch_1.md` after the first frozen run began. Its no-cost source-integrity intake maps all 42 unique cited ZR section URLs to current canonical sections and verifies all 12 stated calculations. The source document's seven READY and five BLOCKED labels were not treated as approvals. After independent review, the owner approved Cases 2, 4, 5, 6, 7, 8, 9, 10, and 12 for evaluation testing only; Cases 5, 10, and 12 deliberately require an insufficient-evidence result. Case 1 still needs narrowing, Case 3 remains a near-duplicate, and Case 11 remains held for visual-map evidence. The approved nine were appended only to `zoning-cases-expanded-batch-1.json`, a separately frozen 30-case successor. The original 21-case file and retained paid result were not altered. `npm run eval:zoning:expanded-batch-1` passes 30/30 with no paid model calls, while public Zoning Research and paid evaluation remain disabled. Evidence: [PERMITEXT_ZONING_EXPANDED_COHORT_2026-08-30.md](./PERMITEXT_ZONING_EXPANDED_COHORT_2026-08-30.md).

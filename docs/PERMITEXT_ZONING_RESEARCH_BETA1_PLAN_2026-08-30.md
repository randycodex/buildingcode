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
- The local evaluation set contains 21 evidence-ready cases, all owner-approved for Terra answer-key testing only. The six externally revised cases received explicit owner approval on August 30 after current-source review.
- The current contract intentionally has `researchEligibility: false`; no public Research path is enabled.

Official source: [NYC Zoning Resolution](https://zr.planning.nyc.gov/)

## Fail-closed sequence

1. **Freshness — complete** — the complete official corpus was refreshed through August 13, 2026 in a separate staging directory before the verified package replacement.
2. **Diff review — complete** — the two official August 13 Appendix F adoption records, two new assets, stable identifiers, table grids, amendment-history additions, source hashes, and search-index effects were reviewed.
3. **Corpus contracts — complete** — section completeness, stable identity, citation, table, map/asset, amendment-history, Reader, Search, prepared-content, and compressed native Reader checks pass against the refreshed corpus.
4. **Evaluation refresh — complete** — selected evidence and the review packet were regenerated from the refreshed corpus after current official-source review. No draft case was promoted by automation.
5. **Owner review — complete** — the owner approved all six revised cases for Terra answer-key testing only on August 30. This is not professional zoning sign-off, paid-test authorization, or public enablement.
6. **No-cost Research contracts** — add and pass Zoning-specific evidence-boundary, missing-location, mapped-applicability, special-district, table, arithmetic, amendment, and effective-date tests while public Zoning Research remains off.
7. **Paid validation** — only after separate owner authorization and a written spend cap, run a frozen Zoning hybrid benchmark and review its answers manually.
8. **Economics** — incorporate the measured Zoning routing/cost distribution into the existing 100-turn subscriber model. Do not change the $20 price or 100-turn allowance from assumptions alone.
9. **Enablement** — enable public Zoning Research only after the exact refreshed corpus, evaluation evidence, cost result, web/iOS presentation, release commit, and manual acceptance are bound together and approved.

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

The next implementation task is to finish the Zoning-specific no-cost Research contracts. Paid validation remains separate and will use a written cap before any API call.

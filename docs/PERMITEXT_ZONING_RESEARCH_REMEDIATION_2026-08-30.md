# Permitext Zoning Research — No-Cost Evidence Remediation

Date: August 30, 2026

Working branch: `codex/zoning-research-beta1`

Status: **SECOND NO-COST REMEDIATION COMPLETE; NEW PAID SEMANTIC CONFIRMATION NOT AUTHORIZED**

## Boundary

The first part of this work responds to frozen diagnostic run `5b54b6cf-2a04-4a4a-a920-edb2d65bf4f6`. The follow-up responds to expanded run `5e394dd0-fce2-4fd7-8c5a-cb05dcb29e53`. It does not rewrite either retained result, approve public Zoning Research, silently change an owner-reviewed answer key, authorize another paid run, change the $20 price or 100-turn allowance, merge, deploy, or change Production configuration.

## What changed

- Reviewed evidence terms now take precedence section by section, every reviewed term must resolve, overlapping windows are merged, and each section is capped at 11,800 selected characters.
- The shared definition extractor now understands NYC Planning's Zoning defined-term markup and returns bounded canonical passages rather than burying the relevant definitions inside all 268,071 characters of ZR 12-10.
- ZR 12-10 cases can select exact named definitions while excluding unrelated images and definitions. This diagnostic-only disposition remains behind the existing unapproved-Zoning gate; ordinary Research still fails closed when a visual-bearing section lacks required visual review.
- Appendix J retains its enacted overview text and both structured Subarea index tables for the bounded diagnostic. Unselected map images remain excluded, so the evidence can support the general Subarea framework but cannot support a parcel-specific map conclusion.
- Official NYC Planning amendment-history events are now exposed as a hashed structured source attached to the current section, including effective date, CPC report number/link, action, project, and notes. The source explicitly distinguishes event metadata from historical text reconstruction.
- The evaluation runner carries structured-source IDs and the diagnostic text-only visual disposition through the same conversation-creation path used by Research.

## Measured evidence changes

The failed frozen cases now assemble as follows before any new model call:

| Case | Frozen selected text | Remediated selected text | Added structured source |
| --- | ---: | ---: | --- |
| `zr-appendix-map-boundaries` | 1,555 | 1,555 | two Appendix J Subarea index tables |
| `zr-special-district-demolition` | 1,542 | 1,542 | none |
| `zr-amendment-history` | 2,642 | 2,642 | official amendment history |
| `zr-missing-location-facts` | 16,326 | 13,036 | two Appendix J Subarea index tables |
| `zr-mapped-district-missing` | 338 | 338 | none |
| `zr-r7a-affordable-far-qualification` | 22,102 | 13,351 | none |
| `zr-r7a-standard-height` | 5,481 | 5,481 | none |
| `zr-r7a-lot-coverage` | 4,647 | 4,647 | none |
| `zr-zoning-lot-contiguity-definition` | 9,048 | 8,114 | none |
| `zr-cellar-floor-area-definition` | 13,674 | 9,866 | none |

The unchanged sizes are intentional. Their frozen failures were answer omissions or overstatements against already-bounded enacted text, not missing source assembly. They remain semantic confirmation targets for the next authorized frozen run.

## No-cost verification

- `npm run eval:zoning`: 21/21 evidence-ready; conversation creation passed; no paid model calls.
- `npm run test:research-chat`: passed.
- `npm run test:research-safety`: passed with public Zoning Research disabled.
- `node tests/evidence-discovery-contract.mjs`: passed.
- `node tests/research-evals.mjs --self-test`: passed; no paid model calls.
- `npm run check`: passed, including the 21-case Zoning review contract and the full Research/server/UX contract suite; no paid model calls.

These results prove source assembly, canonical matching, structured-source continuity, and fail-closed workflow behavior. They do **not** prove that the nine prior scored failures or the one prior failed operation will pass semantic model grading.

## Expanded-run follow-up

The one authorized expanded run completed under its $5 cap and is retained separately. It exposed four additional no-cost defects or precision gaps that are now repaired:

- the evaluation structure contract now accepts the product's valid concise-answer form with an empty string explanation while still requiring a nonempty conclusion;
- amendment-history grids now use the immutable row/cell schema and survive an immutable-evidence snapshot round trip;
- table-category Zoning cases now explicitly select their structured table evidence; and
- the answer prompt now preserves unusual enacted legal wording before paraphrase instead of silently normalizing it.

The result initially suggested that source Cases 2 and 4 had invalid answer keys. Case 2 requires a UAP increment rule absent from the selected evidence. The initial Case 4 follow-up treated ZR 24-382 as unconditionally controlling, but the later official-source re-audit confirms selected ZR 23-343 as the residential branch and identifies community-facility status as an unresolved applicability fact. The frozen records remain unchanged; the superseding source audit is [PERMITEXT_ZONING_CASE23_APPLICABILITY_AUDIT_2026-08-30.md](./PERMITEXT_ZONING_CASE23_APPLICABILITY_AUDIT_2026-08-30.md).

The expanded result, including its $8.87-per-100 all-Zoning operating projection and updated subscriber sensitivity, is retained in [PERMITEXT_ZONING_EXPANDED_SEMANTIC_RESULT_2026-08-30.md](./PERMITEXT_ZONING_EXPANDED_SEMANTIC_RESULT_2026-08-30.md).

## Remaining gate

1. **Complete:** the owner approved nine source-checked candidate cases for evaluation testing only; Cases 1, 3, and 11 remain outside the cohort pending narrowing, duplication review, and incorporated-map evidence respectively.
2. **Complete historical freeze:** the unchanged original 21 cases and the nine approvals were frozen as a separate 30-case expanded parent; 30/30 no-cost conversation creation passed at that checkpoint. Stronger later bare-section parsing now makes the unchanged expanded parent fail closed at 28/30 on unselected ZR 101-70 and 23-34. See [PERMITEXT_ZONING_EXPANDED_COHORT_2026-08-30.md](./PERMITEXT_ZONING_EXPANDED_COHORT_2026-08-30.md).
3. **Complete:** the exact expanded cohort and its one-run $5 authorization were committed before execution; the run is retained and the authorization is consumed.
4. **Superseded current gate:** the historical two-key disposition was completed, but stronger preflight now exposes three answer-key/evidence blockers requiring new owner case dispositions. See [PERMITEXT_ZONING_SUCCESSOR_FAILURE_TRIAGE_2026-08-30.md](./PERMITEXT_ZONING_SUCCESSOR_FAILURE_TRIAGE_2026-08-30.md).
5. Only with a new explicit owner authorization and cumulative spend cap, run one clean paid semantic confirmation.
6. Keep public Zoning Research disabled until that run passes, the updated cost distribution is accepted, and web/iOS release acceptance is complete.

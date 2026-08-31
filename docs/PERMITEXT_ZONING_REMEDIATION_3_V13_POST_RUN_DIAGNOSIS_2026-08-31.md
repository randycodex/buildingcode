# Permitext Zoning Research — v13 post-run no-cost diagnosis

Date: August 31, 2026

Branch: `codex/zoning-research-beta1`

Historical result: [remediation-successor-3 v13 confirmation](./PERMITEXT_ZONING_REMEDIATION_3_V13_CONFIRMATION_RESULT_2026-08-31.md)

## Boundary

This is a prospective prompt repair, not a reconstruction or rescore of the intentionally unretained v13 failed answer. It made no provider call, spent `$0`, did not change the frozen 30-case cohort, did not weaken the deterministic parcel or map safeguards, and did not authorize a paid run, public Zoning Research, the 24,000-character evidence candidate, pricing, allowance changes, merge, push, or deployment.

The retained v13 evidence proves that the complete third-case answer cited Appendix J, contained a recognized overall map/location boundary, and still triggered `zoning_missing_mapped_location`. It does not reveal the triggering words or establish that the answer enumerated named table rows.

## Independently reproduced prompt conflict

The approved Appendix J case selects structured Subarea tables but asks only for the generic Subarea 1 and Subarea 2 treatment plus the boundary against a parcel-specific conclusion. Before this repair, the same server-generated prompt simultaneously instructed the model to:

- describe only the generic Subarea 1 and Subarea 2 source rules; and
- read the selected structured-table cells together with their headings, symbols, notes, and footnotes.

Matched no-cost controls establish the safety distinction without using the unavailable answer. A generic two-Subarea rule followed by the address-or-BBL plus official-map boundary passes. Adding a named table inventory such as `Bathgate` and `Port Morris` fails closed with `zoning_missing_mapped_location`, as does an affirmative named-site conclusion. The retained clause lengths and flags are compatible with more than one wording family, so this diagnosis does not attribute the historical v13 stop to the table inventory control.

## Prospective v14 repair

Prospective safety version `20260831-zoning-appendix-j-source-boundary-prompt-v14` changes instructions only for the exact Appendix J source-boundary question:

- it keeps the requirement to state only the generic Subarea 1 and Subarea 2 treatment;
- it explicitly forbids enumerating or summarizing named designated areas, boroughs, community districts, map numbers, or table rows;
- it suppresses the otherwise applicable structured-table-fidelity instruction for this question only; and
- if a bounded revision is needed, its verifier feedback directs the model to remove named inventory and every site/property/parcel result, then restate only the two generic treatments and the separate address-or-BBL plus official-map boundary.

No classifier acceptance path was broadened. Named inventory, named sites, direct parcel placement, specific actors, missing boundaries, boundary masks, and affirmative map-placement variants remain rejected. The consumed v13 package continues to verify against its immutable historical bytes and cannot be reused.

## Verification

All checks ran with `OPENAI_API_KEY`, `PERMITEXT_RUN_PAID_RESEARCH_EVALS`, and `PERMITEXT_RESEARCH_EVAL_MAX_USD` unset.

- Focused Zoning Research safety contract: pass.
- Complete Research safety suite: pass.
- Consumed v13 authorization, immutable package/result lineage, hostile-runtime, paid-dispatch, and 30/30 no-cost preflight contract: pass.
- Complete 30-case remediation-successor-3 conversation preflight: 30/30 ready with zero provider calls.
- Public Zoning Research: disabled.

## Decision and next gate

The privacy-bounded v13 diagnosis is complete. The prompt conflict is independently reproducible and the v14 repair is materially justified because it removes contradictory output instructions without relaxing the safety evaluator.

Retain the v13 result unchanged. Before any later semantic run, commit this exact repair, complete the full repository check, and prepare and review a distinct locked v14 package bound to the repair commit and immutable consumed-v13 lineage. Any paid confirmation still requires a fresh exact owner authorization naming that package commit, all 30 ordered cases, one repetition, and a cumulative cap no higher than `$5`.

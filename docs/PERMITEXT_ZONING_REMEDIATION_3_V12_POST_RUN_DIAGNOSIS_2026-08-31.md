# Permitext Zoning Research — v12 post-run no-cost diagnosis

Date: August 31, 2026

Branch: `codex/zoning-research-beta1`

Historical result: [remediation-successor-3 v12 confirmation](./PERMITEXT_ZONING_REMEDIATION_3_V12_CONFIRMATION_RESULT_2026-08-31.md)

## Boundary

This is a prospective deterministic-safety repair, not a rescore or reconstruction of the intentionally unretained v12 failed answer. It made no provider call, spent `$0`, did not change the frozen 30-case cohort, and did not authorize a paid run, public Zoning Research, the 24,000-character evidence candidate, pricing, allowance changes, merge, push, or deployment.

The retained v12 evidence proves that the third case failed closed with an overall mapped-location boundary and Appendix J citation; the bounded revision also recorded `zoning_map_inference`. Because raw failed-answer text was not retained, this diagnosis does not claim the exact words that produced either issue.

## Reproduced defect

The deterministic `zoning_map_inference` check searched the complete answer for a parcel subject followed by `is within`, `is outside`, `falls within`, `lies within`, or `is shown in`. It did not reuse the clause-level location-boundary analysis already applied to `zoning_missing_mapped_location`.

That mismatch independently reproduced a false positive on unequivocal uncertainty statements such as:

- `The selected evidence does not establish whether this property is within Subarea 1 or Subarea 2.`
- `It is unknown whether this site falls within either Appendix J designated area.`
- `No property-specific conclusion can be made about whether the lot lies within either designated area without the address or BBL and applicable official map.`
- `The selected evidence cannot determine whether the lot is outside either Appendix J designated area.`
- `It is unresolved whether the facility is shown in either Appendix J subarea.`

Before the repair, the first matched control failed solely with `zoning_map_inference`; the second also exposed the narrower `this site` uncertainty-vocabulary gap.

## Prospective v13 repair

Prospective safety version `20260831-zoning-mapped-boundary-context-v13` now evaluates mapped parcel placement clause by clause and suppresses `zoning_map_inference` only when that same clause is an explicit recognized location-boundary statement. The existing clause splitter separates adversative continuations, so uncertainty cannot mask a later affirmative placement. The explicit `it is unknown/unverified/unresolved whether ...` boundary recognizes `the`, `this`, or `that` site/property/parcel/lot/facility forms.

The five safe controls above pass. The original affirmative claim plus these direct variants remain rejected with `zoning_map_inference`:

- `This property is within the Appendix J designated area.`
- `This site falls within Subarea 2.`
- `The lot lies within the designated area.`
- `The facility is shown in Subarea 1.`
- `The property is outside the Appendix J designated area.`

The following boundary-mask variants also remain rejected:

- `It is unknown whether the mapped status can be determined, but this property is within Subarea 1.`
- `The evidence does not establish the mapped location; however, this site falls within Subarea 2.`

The repair does not weaken the missing-boundary, named-site, concrete-identifier, specific-actor, source-rule, mapped-placement, or project-outcome safeguards accumulated through v12.

## Verification

All checks ran with `OPENAI_API_KEY`, `PERMITEXT_RUN_PAID_RESEARCH_EVALS`, and `PERMITEXT_RESEARCH_EVAL_MAX_USD` unset.

- Focused Zoning Research safety contract: pass.
- Complete Research safety suite: pass.
- Consumed v12 authorization, immutable package/result lineage, hostile-runtime, paid-dispatch, and 30/30 no-cost mock-preflight contract: pass.
- Full `npm run check`, including Zoning governance, Research, billing, content, web/client, and UX contracts: pass.
- Paid provider requests: zero.
- Public Zoning Research: disabled.

## Decision and next gate

The no-cost diagnosis is complete and the repair is materially justified as a narrow consistency fix between two existing deterministic safety paths. Retain the v12 result unchanged and treat v13 only as a prospective candidate.

Before any new semantic run, commit this exact repair, prepare and review a distinct locked v13 package bound to that repair commit and immutable v12 lineage, and prove the package remains non-runnable without a fresh exact owner authorization. A later paid run would still require a new explicit decision naming the exact package commit, all 30 ordered cases, one repetition, and a cumulative cap no higher than `$5`.

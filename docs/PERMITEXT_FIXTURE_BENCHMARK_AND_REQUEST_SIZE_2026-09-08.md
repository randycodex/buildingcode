# Fixture benchmark correction and Research request-size diagnostic

## CC-04 development correction

The original fixture question asks whether a multipurpose room properly classified as Group B may use Group B fixture requirements. The former “Not automatically” opening and associated runtime feedback conflated an optional Assembly calculation with a restriction on the Group B baseline.

The [publisher's PC 403.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161441), refreshed September 8, supplies the general occupancy-based fixture framework and assigns classification to the Building Code. [BC 303.1.3](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-165886) separately permits a qualifying accessory room below 75 occupants to use Assembly fixture requirements. The corrected development interpretation is a conditional Yes: proper Group B classification supplies the baseline under PC 403.1, and the Assembly calculation is an additional option. Missing numerical table rates prevent an unsupported fixture count; they do not erase the selected general framework. The accessory-room permission remains distinct from PC 403.1 note j's building/nonaccessory-tenant scope.

The corrected answer, required concepts, forbidden claims and conditional calculation inputs are recorded in `permitext-sync-server/evals/research-answer-key-amendments.json` and the [reconciled 50-case key](PERMITEXT_RECONCILED_RESEARCH_ANSWER_KEY_2026-09-07.md). This is a development correction pending independent professional review. The original approved `research-cases.json` is unchanged. Its case hash and the original evaluation-input hash bind the amendment to that record. All 50 answering-model inputs were compared with the previous committed key and remain byte-identical; the correction changes evaluator material, not the question, project facts, selected passages or code edition supplied to Research.

Validation rejects an unknown amendment, altered corrected answer or rubric, changed input/edition, modified historical review date, approval promotion, and silent removal of the recorded correction. Reference answers, amendment IDs and rationale remain outside the answering-model input allowlist. The legacy paid evaluator now stops before provider configuration if selected cases include this obsolete reference. It neither silently drops the case nor pays a judge to compare a new answer against the superseded wording. Current diagnostics must use the amended development rubric; no original run is rescored.

Research's generation and verification instructions now distinguish general permission from numerical rates. The existing deterministic check for assertions about normal Group B calculations now recognizes a supplied PC 403.1 occupancy framework that is cited and bound to a supported point. Tests retain rejection of the targeted assertion when that framework is missing, contextual, from the wrong code or unbound. This gate does not approve legal correctness: the ordinary semantic verifier still checks the answer and any revision. The existing actual-answer HTTP replay continues to prove final rejection blocks save/charge and acceptance persists the reviewed revision.

## Request cost and speed evidence

`scripts/inspect-research-owner-request-envelopes-20260908.mjs` builds all 60 owner-question draft requests with actual local source assembly, routing, request builders, required claims, deterministic analysis and code basis. It cannot dispatch provider requests. Its [retained result](../permitext-sync-server/evals/results/research-owner-request-envelopes-2026-09-08.json) records source hashes and zero network/provider calls.

This is a question-only initial-request diagnostic with a versioned local pricing fixture. It does not measure current Production configuration, full-service p50/p90, latency, live quality, a returned web payload, a revision, or the complete cost of a turn. The previously settled live ledger is checked by hash before computing the available authorization.

Current local routing selects **Terra for 59 cases and Luna for 1**. Average draft request size is **68,656 bytes**, including approximately **24,740 bytes of instructions**, **38,966 bytes of input**, and **3,078 bytes of schema**. Average enacted source text is **15,379 bytes**; the remaining input also contains source metadata, code basis and the internal evidence map. These figures identify work to inspect; they do not establish that every non-code byte is redundant.

| Case | Draft request bytes | Initial conservative reservation | Fits $0.402564 remaining authorization? |
| --- | ---: | ---: | --- |
| PC-04, laundry floor drain | 75,928 | $0.438760 | No |
| PC-09, shower temperature setting | 44,587 | $0.282055 | Initial request only |
| PC-10, water-heater pan | 49,818 | $0.308210 | Initial request only |

The spending guard uses a deliberately conservative input bound and versioned price ceilings. It must not be confused with a provider invoice or actual balance. A first request fitting the allowance does not authorize an unaffordable verifier, rewrite or second case.

Adding the longer fixture correction as an unconditional instruction initially pushed the existing ramp request-envelope test over its unchanged $0.50 guard. Both new instructions are now included only when BC 303.1.3 evidence is present. The ramp preflight passes again, including its larger synthetic settled-web/answer bound of **$0.497430**. No spending ceiling or quality gate was relaxed. This is a measured request-size repair, not a measured latency improvement.

## Validation and next work

The key-integrity and quality contracts pass. The actual legacy runner was exercised in a scrubbed child process with network forbidden: it rejected the superseded reference before provider configuration. The existing revision-verification HTTP replay passed with all provider responses mocked. The all-60 request diagnostic completed at no API cost. The full `npm run check` passed after the final runtime, evaluator and request-builder changes (`/tmp/permitext-fixture-permission-check.log`). This includes the Research, routing, benchmark, source, safety and ordinary application checks.

The next speed work should target duplicated instructions and repeated prompt material while retaining source passages, citations, material qualifiers and the final semantic check. The routing audit also calls for a no-cost review of why simple questions with ancillary complex evidence are sent directly to Terra. A smaller request or cheaper route must not be mistaken for proven answer quality; a separately bounded live confirmation must still fit the remaining authorization.

The full objective remains the original 50 cases plus the additional 60. CC-04 needs live evaluation against its corrected development rubric, and 26 of the extra cases still have no live provider attempt. The laundry binding repair remains locally verified but lacks a successful new live confirmation. Nothing here establishes commercial readiness or new professional approval.

No additional paid calls were made in this work. The ledger remains **15 packages, 64 case-turn attempts, 135 provider calls, approximately $3.747285 estimated usage, $7.597436 conservative cost, and zero pending calls**. Conservative authorization remaining is **$0.402564**. Changes and diagnostic evidence are local; no push, deployment or phone test is included.

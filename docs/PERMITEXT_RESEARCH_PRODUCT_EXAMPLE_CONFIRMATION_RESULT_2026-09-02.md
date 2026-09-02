# Permitext Research product-example live-confirmation result

Date: September 2, 2026

Status: **PARTIAL; AUTHORIZATION CONSUMED; NO RETRY AUTHORIZED**

Run ID: `2063e712-5a7a-4799-9d4e-fa25c3782dcf`

Locked package: `41b4f2612b1c982fca60de6400fe802aded5a193`

Execution commit: `6433bc130ff245215e5d30ab492f32f8b443b4d4`

## Scope and settlement

The runner attempted all nine ordered turns in all seven conversations once. Eight turns completed and one Appendix P turn failed closed before provider access. The run made no separate paid judge requests and kept web support disabled as locked.

The eight delivered answers used 19 provider requests, including structured-response and verification attempts. Every request is terminal: actual spend is `$1.023256`, conservative reserved spend is `$1.023256`, the cumulative cap is `$2.00`, and the pending-request count is zero. The permanent one-attempt lock records `partial`. The machine-readable authorization is consumed and cannot authorize a retry.

Immutable evidence:

- `permitext-sync-server/evals/results/2026-09-02T15-01-27-878Z-2063e712-5a7a-4799-9d4e-fa25c3782dcf-product-example-confirmation.json`
- `permitext-sync-server/evals/results/2026-09-02T15-01-27-878Z-2063e712-5a7a-4799-9d4e-fa25c3782dcf-product-example-confirmation.md`
- Local permanent run lock: `permitext-sync-server/.research-product-example-confirmation-paid-run.lock`

## Evidence review

This is an assistant review against the frozen answer contract and returned enacted passages, not the owner's final approval and not an official code determination.

| Conversation / turn | Result | Initial evidence review |
| --- | --- | --- |
| 2022 ramp | Delivered; deterministic PASS | Strong. It gives a readable requirements table, correct scope distinctions, slope, cross-slope, rise, width, landing, surface, handrail, and edge-protection rules with enacted citations. It properly refuses to invent missing ICC A117.1 and handrail details. The code passage itself labels 1:12 as 8 percent; mathematically it is approximately 8.33 percent, so future presentation should prefer the ratio or show the conversion carefully. |
| 2022 corridor/accessibility | Delivered; deterministic PASS | Strong. It directly rejects a nonexistent fire-escape-based accessibility exemption, presents the corridor-width table, and preserves the Chapter 11/ICC A117.1 boundary. It is more useful than a bare 36-inch answer because it distinguishes 30-, 36-, 44-, and limited 24-inch conditions. |
| Appendix P | Rejected before provider; deterministic REVIEW | Product failure. The corpus contains the required current status, `Appendix P: Reserved`, but retrieval did not resolve the user's abbreviated question. Permitext should answer the 2022 reserved status and distinguish it from the 2014 accessibility appendix. |
| OMH bathroom boundary | Delivered; deterministic PASS | Safe but not the requested end-state answer. It correctly refuses to invent OMH or 14 NYCRR ratios and gives bounded NYC plumbing/mechanical/accessibility context. Because the locked run had web support disabled and no OMH corpus, it cannot reproduce the user's external-authority research example. |
| 2022 habitable space | Delivered; deterministic PASS | Strong. It directly gives the 80-square-foot and 8-foot baselines, identifies bedrooms as habitable space, preserves the R-1 and three-bedroom exceptions, and adds useful geometric examples. |
| C4-4D versus R8A | Delivered; deterministic REVIEW | The core comparison is supported: C4-4D maps to R8A residential bulk; the returned 6.02/7.20 residential FAR values and 3.40 commercial-only FAR are grounded. It does not satisfy the frozen coverage requirement for ZR 23-432 or the requested broader height/setback comparison, so it is materially less complete than the target example. |
| C4-4D short follow-up | Delivered; deterministic REVIEW | Clear failure. The follow-up retained the requested short-paragraph format but lost the prior grounded evidence, retrieved irrelevant Midtown sections, and refused to summarize facts it had just established. Conversation continuity must reuse the prior turn's validated sources and conclusions for a pure rewrite request. |
| 2014 vision lite | Delivered; deterministic PASS | Legally careful and supported. It correctly limits the 100-square-inch rule to the stated fire-protection-rated glazing conditions and avoids the wrong 2022 section. It should also answer the user's requested unit directly: 100 square inches is approximately 0.694 square feet. |
| 2014 edition check | Delivered; deterministic PASS | Strong. It confirms the 2014 edition, preserves project-specific applicability, and repeats the correct Section 715.4.7.1 limitation. |

## Acceptance conclusion

Six of nine ordered turns pass the frozen deterministic contract; six of eight delivered answers pass. The run is useful confirmation that the 2014 citation routing, detailed construction-code tables, authority boundaries, and answer formatting can work. It is not product-example acceptance because Appendix P failed to retrieve, the C4-4D comparison missed a required provision, and its follow-up lost conversation grounding. The OMH answer is safe but also demonstrates that external-authority research cannot meet the target while that source path is unavailable.

The next work is no-cost remediation, not another automatic paid cohort:

1. Add Appendix-letter/title aliases and a deterministic reserved-appendix resolution test.
2. Treat a rewrite/shorten follow-up as a transformation of the prior validated answer and evidence unless the user changes the underlying question.
3. Preserve required-reference coverage across the C4-4D comparison and its follow-up, including the applicable height/setback provision.
4. Add a requested-unit obligation so the vision-lite answer supplies approximately `0.694 sq ft` while preserving the rule's narrow scope.
5. Keep the OMH boundary fail-closed until an approved official external-authority retrieval path is separately available and tested.

No public Research or Zoning enablement, professional determination, pricing/allowance change, merge, push, deployment, Production action, TestFlight upload, release, or retry is authorized by this result.

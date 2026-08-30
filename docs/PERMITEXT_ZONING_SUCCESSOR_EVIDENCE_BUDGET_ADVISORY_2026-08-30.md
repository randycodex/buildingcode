# Permitext Zoning Successor Evidence-Budget Advisory

Date: August 30, 2026

Status: **NO-COST 27/30 READY-CASE ADVISORY COMPLETE; CANDIDATE DISABLED; FULL SUCCESSOR AND SEMANTIC GATES OPEN**

This record compares the current 48,000-character supplemental-evidence baseline with the retained disabled 24,000-character supplemental candidate. It is an engineering advisory only. It does not repair or bypass the three blocked answer keys, rescore a paid result, accept the candidate semantically, change Production configuration, enable public Zoning Research, change price or allowance, or authorize a paid run.

## Scope and fail-closed boundary

The command was:

```sh
npm run audit:zoning-successor-evidence-budget-advisory
```

The runner required all of the following before comparing budgets:

- the exact frozen 30-case successor;
- exactly 27 evidence-ready cases in their original order;
- exactly three blocked cases and mismatches: `zr-special-district-demolition` / unselected ZR 101-70, `zr-narrow-attached-rear-yard` / unselected ZR 23-34, and `zr-candidate-b1-deep-through-lot-vertical-yard` / unselected ZR 24-382;
- ready selected evidence for every blocked case, so the exclusions cannot hide missing-source failures;
- mock mode, zero provider tokens, no estimated provider cost, one repetition, no filters, and no live or paid option;
- the retained candidate value of 24,000 supplemental characters with `enabledByDefault: false` and `productionConfigurationChanged: false`.

The ordered ready-case identity is bound by SHA-256:

`6c4684328663480d26ed4318df428b04f5f8cb8a45701b7440d67fac2cbfe4a6`

The evidence comparison is also bound to the exact successor dataset, assembly version, and ordered stored packages:

- successor dataset SHA-256: `d07063fa12ec993fde8802e6b58971d5cc1873a52fbefbe9e538b81acb94d30f`;
- implementation-sources SHA-256: `91dd4828def0ec87b7ac22b3f5d40c395cd6de52817e145d201cdd2486658c90`;
- Git base commit for lineage: `9112b49b0c1fe1922f99c3480d2ea4f3a61fd61d`;
- evidence assembly: `20260830-pinned-passage-budget-v21`;
- 48,000 baseline ordered-package SHA-256: `fd4867f67fd46cf0bcb5522b2c74e76603d348310d23970f94edd7f322b0a9ee`;
- 24,000 candidate ordered-package SHA-256: `42abaae6de9e2407d9df7ac1c1e1ca41711e208fa6e472a64782e4d5140ced90`; and
- combined advisory-evidence SHA-256: `157f6f941804ec2799452b285c4b2a44ee0f22d24896e477e606fef9316ba2c5`.

Each package digest includes case order, provenance origin, canonical section identity, passage character count and content hash, source-library version, selected-text hash, structured-source identity/hash, and sorted visual-source identities/hashes. It deliberately excludes per-conversation random source identifiers. The implementation-sources hash binds the exact working copies of the runner, adapter, evidence assembly, application path, content/discovery contracts, and package command that produced the result, rather than relying on the dirty base commit alone. The combined advisory hash binds the dataset, implementation sources, assembly version, and both ordered packages; the Git base commit is descriptive lineage. The command removes paid-run authorization variables and the OpenAI API key before governance and mock evaluation start; the runner separately rejects live mode and asserts zero usage and cost on every answer.

Normal successor preflight remains intentionally red at 27/30. The advisory cannot run on a different partial cohort or combine with the older single-budget prototype flag.

## Measured result

| Measure | 48,000 baseline | Disabled 24,000 candidate |
| --- | ---: | ---: |
| Cases | 27 | 27 |
| Average stored, hash-bound passage characters | 41,384 | 29,460 |
| Maximum stored, hash-bound passage characters | 48,000 | 38,896 |
| Average exact-pinned passage characters | 6,791 | 6,791 |
| Average supplemental passage characters | 34,594 | 22,670 |
| Average canonical-context characters excluded from budget | 8,022 | 8,022 |
| Exact pinned sources | 82 | 82 |
| Reviewed structured pinned sources | 8 | 8 |
| Discovered sources | 105 | 105 |
| Cross-reference snapshots | 39 | 24 |

The candidate reduced average stored evidence by **11,924 characters, or 28.8%**. Assembly v21 corrects an earlier accounting defect: canonical context attached to an exact selection was neither sent to the model nor persisted in the immutable evidence package, so it no longer consumes the evidence budget. It is reported separately above. Every character counted in the baseline and candidate totals now corresponds to stored passage text whose content hash was verified before comparison.

Every package retained:

- every exact selected passage and reviewed structured source;
- every required citation section;
- every explicit Zoning provision named in the question, expected conclusion, required concepts, missing facts, forbidden claims, and forbidden phrases;
- zero pinned-selection truncation;
- zero provider usage and zero provider cost.

## Cross-reference identity review

Stable section identities show 16 baseline cross-reference sections absent from the candidate package and one candidate-only section, a net reduction of 15. This is not the same as 15 exact omissions. Of the 23 cross-reference section identities present under both budgets, 20 retained the same stored passage hash and three retained the section but changed passage text under the smaller budget: ZR 23-434 in `zr-r7a-lot-coverage`, ZR 11-332 in `zr-inner-transit-zone-new-unit-parking`, and ZR 27-10 in `zr-candidate-b1-r6a-uap-insufficient-affordable-area`.

| Case | Baseline-only ZR sections |
| --- | --- |
| `zr-amendment-history` | 42-11, 42-30, 42-311 |
| `zr-r7a-affordable-far-qualification` | 27-10, 27-00, 27-113 |
| `zr-r7a-lot-coverage` | 11-00, 23-361 |
| `zr-c4-4-residential-use` | 32-10, 11-00, 74-121 |
| `zr-inner-transit-zone-new-unit-parking` | 11-31 |
| `zr-zoning-lot-contiguity-definition` | 26-50, 117-51, 123-20 |
| `zr-candidate-b1-nonconforming-warehouse-enlargement` | 52-31 |

The candidate-only section is a one-character ZR 26-50 cross-reference snapshot for `zr-candidate-b1-r6-parking-unverified-transit-zone`. The deterministic review proves that none of the 16 baseline-only sections or the candidate-only section is selected, pinned, required by citation, or named by the answer key; it does not claim they are semantically immaterial. Across automatic discovered and cross-reference origins, 128 origin-section-source identities occurred under both budgets; 50 retained the same stored passage hash and 78 changed passage text as the smaller package shortened supplemental evidence. Pinned sources use per-conversation identifiers and are excluded from that retained-automatic count; their exact selected and reviewed structured passages are separately asserted unchanged. These classifications are not professional Zoning sign-off and cannot replace a clean semantic run.

## Decision

The 24,000-character supplemental candidate remains a useful next semantic-comparison candidate because it materially reduces stored evidence volume without losing the deterministic required-section set. It remains **disabled** because:

1. The special-district and narrow-rear-yard cases now fail closed on bare answer-key provisions absent from selected evidence and need source-bound owner dispositions.
2. Case 23 still requires the owner's explicit scope decision between the recommended residential-only case and a broader two-branch applicability redesign.
3. The 16 omitted cross-reference identities, one candidate-only identity, and passage-level changes within retained supplemental identities still require confirmation through a clean, newly authorized semantic evaluation.
4. The current paid successor failed semantic, reliability, and cost gates.
5. No Production, public-access, price, or allowance decision follows from a mock advisory.

Related records:

- [Case 23 applicability audit](./PERMITEXT_ZONING_CASE23_APPLICABILITY_AUDIT_2026-08-30.md)
- [Successor failure triage](./PERMITEXT_ZONING_SUCCESSOR_FAILURE_TRIAGE_2026-08-30.md)
- [Successor semantic result](./PERMITEXT_ZONING_SUCCESSOR_SEMANTIC_RESULT_2026-08-30.md)
- [Earlier three-budget prototype](./PERMITEXT_ZONING_EVIDENCE_BUDGET_PROTOTYPE_2026-08-30.md)

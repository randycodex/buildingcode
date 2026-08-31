# Permitext Zoning Research — remediation successor 3 owner disposition

Date: August 30, 2026

Branch: `codex/zoning-research-beta1`

Immutable parent: `permitext-sync-server/evals/zoning-cases-expanded-batch-1-successor-remediation-2.json`

Parent SHA-256: `459b2273b7ebd209d4519bf9206b6135dc2fc7706052fa9b333c4bf5e63e8a8b`

## Decision boundary

The retained remediation-successor-2 semantic result identified two frozen case/evidence defects. The owner approved creating a new frozen successor with the exact phrase `Ok, go ahead` after those two corrections and the no-cost-only next step were explained.

This disposition authorizes only the two answer-key/evidence-alignment changes below. It does not mutate or rescore the parent cohort, authorize a paid model run, enable public Zoning Research, change pricing or the 100-turn allowance, deploy, push, merge, or claim professional Zoning sign-off.

## Approved correction 1 — missing-location dated lot-area fact

Decision ID: `narrow-missing-location-to-selected-lot-area-fact`

Case: `zr-missing-location-facts`

The selected exact passage from ZR 42-192 supplies the zoning-lot area condition dated December 19, 2017. It does not supply the frozen rubric's separate existing-facility conforming-use documentation, enlargement, reconstruction, or nonconforming-use branch.

Approved changes:

- change only the question and required concepts;
- replace the missing `existing-facility` fact with the zoning-lot area on December 19, 2017;
- require the answer to explain that selected ZR 42-192 uses that date to determine whether the zoning lot was less than 50,000 square feet in area;
- keep every selected evidence section, evidence-review term, forbidden claim, and other substantive field unchanged.

## Approved correction 2 — parking special-area evidence boundary

Decision ID: `narrow-parking-special-area-to-selected-evidence`

Case: `zr-candidate-b1-r6-parking-unverified-transit-zone`

Selected ZR 12-10 establishes that the Greater Transit Zone includes special parking areas. The selected passages do not establish a separate parking rule for a special parking area or any special-district provision. The supported Inner Transit Zone, Outer Transit Zone, and beyond-Greater-Transit-Zone calculations remain unchanged.

Approved changes:

- change only the required concepts;
- remove the unsupported requirement that a special parking area or special district may produce a different result;
- retain the supported definition that the Greater Transit Zone includes special parking areas while expressly limiting the answer to the rules supplied by the selected passages;
- keep the question, selected evidence, evidence-review terms, forbidden claims, mapped-facts-missing mode, and all supported calculations unchanged.

## Required successor controls

The new successor must:

1. inherit all 30 ordered cases from the exact immutable parent;
2. change only the two approved cases and fields above, plus successor-lineage metadata;
3. retain `researchEligibility: false` and the disabled 24,000-character evidence-budget candidate;
4. show zero answer-key/evidence mismatches under the no-cost adapter;
5. fail closed before any paid request unless the owner later provides a new exact-cohort authorization and cumulative spending cap; and
6. remain non-public and non-Production until separate release acceptance.

## Owner decision

Recorded by: Permitext owner

Recorded at: `2026-08-30T23:58:38.000Z`

Exact approval phrase: `Ok, go ahead`

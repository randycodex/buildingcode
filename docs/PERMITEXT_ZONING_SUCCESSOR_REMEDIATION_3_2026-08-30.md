# Permitext Zoning Research — remediation successor 3

Date: August 30, 2026

Branch: `codex/zoning-research-beta1`

Immutable parent SHA-256: `459b2273b7ebd209d4519bf9206b6135dc2fc7706052fa9b333c4bf5e63e8a8b`

Frozen successor SHA-256: `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`

## Decision boundary

The owner approved the two narrow case/evidence corrections identified by the retained remediation-successor-2 result and independent no-cost review. This record freezes those corrections in a new 30-case successor without mutating or rescoring the parent or any paid result.

No paid evaluation is authorized at this preparation checkpoint. A dedicated exact-SHA authorization record and live package command now exist, but the authorization is locked and the direct evaluator cannot bypass the consuming runner. Before dispatch, that runner must bind a unique run ID to a durable non-reusable `running` state and both global and cohort locks. The bounded run disables provider web search because its tool-call and retrieved-content fees are not represented by the token-only evaluation ledger, and it stops after the first execution error without treating a semantic quality failure as an infrastructure stop. Public Zoning Research, the disabled 24,000-character candidate, Production configuration, pricing, and the 100-turn allowance remain unchanged.

## Exact corrections

### `zr-missing-location-facts`

- Replaced the unsupported missing `existing-facility` fact with the zoning-lot area on December 19, 2017.
- Replaced the unsupported conforming-use, enlargement, reconstruction, and nonconforming-use rubric branch with the selected ZR 42-192 less-than-50,000-square-foot dated lot-area condition.
- Preserved all five selected evidence sections, all evidence-review terms, both forbidden claims, and the other two required concepts.

### `zr-candidate-b1-r6-parking-unverified-transit-zone`

- Replaced the unsupported claim that a special parking area or special district may produce a different result.
- The new concept states only what selected ZR 12-10 establishes—that the Greater Transit Zone includes special parking areas—and requires the controlling enacted special-parking provision as additional evidence before assigning that geography a result.
- Preserved the question, all four selected evidence sections, evidence-review terms, forbidden claims, mapped-facts-missing mode, and every supported Inner, Outer, and beyond-Greater-Transit-Zone calculation.

## Governance and no-cost verification

- Exact immutable parent: 30 ordered cases at SHA `459b2273b7ebd209d4519bf9206b6135dc2fc7706052fa9b333c4bf5e63e8a8b`.
- Exactly two cases changed, and only their approved question/required-concept fields plus new lineage metadata changed.
- Selected evidence, evidence-review terms, and forbidden claims remain unchanged across all 30 cases.
- No-cost adapter: 30 cases and zero answer-key/evidence mismatches.
- Canonical conversation preflight: 30/30 evidence-ready, zero provider tokens, zero provider cost.
- Disabled 24,000-character prototype: 30/30 ready; 28,555 average and 38,896 maximum assembled characters; 6,352 average pinned and 22,203 average supplemental characters; 87 exact pinned sources, eight structured pinned sources, 117 discovered sources, and 29 cross-references; all exact pinned sources preserved.
- Zoning safety v7 and the complete Zoning adapter contract pass.
- Complete repository `npm run check`: pass with paid-evaluation variables removed; PostgreSQL integration was skipped because no database URL was configured.
- The consumed remediation-successor-2 authorization remains byte-identical at SHA `671a88a1445f2c8c818fdf8746795cab95121fed425d916953cc8f4fa93511e0`, bound to retained run `f35eed33-cb4e-4b7b-a719-86b072271660`.
- A direct remediation-successor-3 live attempt fails before provider dispatch unless its parent, unique run ID, and random runner nonce match the dedicated consuming runner's cohort lock. The runner requires all paid inputs to be committed, takes a global paid-evaluation lock, atomically moves the authorization to a fail-closed `running` state before dispatch, binds the result filename and configuration to that run ID, and consumes the authorization after verifying the exact cohort/order/repetition and disabled web-search policy. Paid requests made at this checkpoint: zero.

## Remaining gate

The two frozen rubric defects are corrected only in this new successor. The five previously unconfirmed execution paths and two previously unconfirmed graded outcomes are not retroactively proven or rescored. Any semantic confirmation requires this exact successor, a new explicit owner authorization for all 30 ordered cases and one repetition, and a new cumulative spending cap. Even a clean later result would still leave cost acceptance, exact-release web and TestFlight physical-iPhone acceptance, and final public-release approval open.

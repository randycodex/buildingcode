# Permitext Research commercialization branch-integrity refresh

Status: **Passed for the current no-cost interim checkpoint; final release review remains open**

Date: August 31, 2026

This record refreshes the earlier [branch-integrity checkpoint](./PERMITEXT_RESEARCH_COMMERCIALIZATION_BRANCH_INTEGRITY_AUDIT_2026-08-30.md) and [risk-prioritized semantic review](./PERMITEXT_RESEARCH_COMMERCIALIZATION_SEMANTIC_REVIEW_2026-08-30.md) after the Research commercialization and Zoning work was continued on the dedicated Beta branch. It is an exact-range, no-cost source review. It does not select or authorize a release commit.

## Exact reviewed boundary

- Branch: `codex/zoning-research-beta1`
- Baseline and merge base: `dbbb6ab40d40d1d3d947303aa45b01fbd9cebce3` (`origin/main` at review time)
- Reviewed tip before this evidence-only record: `1bec5339647c247b6714c0f3b2c9d91ac6ccf40c`
- Relationship to baseline: 162 commits ahead and zero behind
- Changed paths: 4,849 total; 4,601 modified, 248 added, zero deleted, and zero renamed
- CodeContent paths: 4,517
- Binary paths: 325, comprising 323 generated `.json.lzfse` Reader artifacts and two Zoning Appendix F `.jpg` assets; every binary path is inside `NYC CC APP/permitext/Resources/CodeContent/`

The exact reviewed tip leaves the locked V11 server package unchanged: `git diff --quiet 8d075b442083db3536de0ff9e90372802ddeadaa..1bec5339647c247b6714c0f3b2c9d91ac6ccf40c -- permitext-sync-server` passed.

## Independent and automated review result

The repeatable redacted branch audit passed all 11 checks. It confirmed the expected branch and ancestry, a clean `git diff --check`, the explicit dirty-path boundary, no credential-like changed filename, no flagged credential addition, and no flagged credential pattern in the complete changed text files at `HEAD`. The scan is designed not to print matched values.

An independent read-only semantic review found no material source defect or unauthorized release-enablement change in the exact range. Its risk review covered paid-run authorization state, release records, billing and entitlement controls, policy and Production routing, public-Beta readiness, changed binaries, Zoning content integrity, and plan consistency.

The only history-wide secret-pattern match was the existing synthetic, no-charge Stripe test key explicitly allowlisted in `tests/stripe-subscription-lifecycle-e2e.mjs`; it is not a credential. No private-key file or header, credential-like filename, or customer email-like value in evaluation-result JSON was found.

## No-cost verification

The following checks passed with provider credentials unset and with every reported paid-call count equal to zero:

- `git diff --check dbbb6ab40d40d1d3d947303aa45b01fbd9cebce3..1bec5339647c247b6714c0f3b2c9d91ac6ccf40c`
- the fail-closed `audit:release-branch` run for the exact branch/base and four explicitly allowed local paths
- public-Beta readiness
- Research and Zoning safety
- V11 locked-authorization and handoff guards
- Zoning Resolution contract checks
- content-integrity checks
- complete `npm run check`

The Zoning snapshot checks reported 4,068 provisions, 313 tables, 211 map references, and 13,152 amendment events. The global content-integrity check reported 12,891 indexed sections and 90.07% declared body coverage. These checks prove repository snapshot structure and consistency; they do not prove live byte-for-byte equivalence with the current official NYC source.

## Authorization and release state

- Historical paid Zoning authorization records remain consumed.
- V11 authorization ID `ee72ca2f-5410-4ce9-a6d6-30deb8ff5169` remains `locked`.
- Its owner decision and execution scope are unset, consumption remains `not_started`, and no paid V11 call has run.
- Web support, the 24,000-character evidence-budget candidate, public Research release, deployment, pricing/allowance changes, and evidence-budget activation remain unauthorized or disabled.
- The public-Beta release record still has no selected exact release commit and remains fail-closed.

## Preserved local work

The following user-owned paths remain outside the reviewed commit, untouched and unstaged:

- `NYC CC APP/NYC CC APP.xcodeproj/project.pbxproj`
- `NYC CC APP/permitext/Info.plist`
- `DO NOT DELETE.png`
- `NYC CC APP/NYC CC APP.xcodeproj/xcshareddata/xcodecloud/`

They must be resolved or explicitly excluded before certifying a future final release commit.

## Retained boundary

This checkpoint cannot prove hidden Production values, live provider settings or mutation history, database integrations skipped without a database URL, official-source freshness, external alert delivery, real customer billing, deployment, TestFlight processing, or physical-iPhone behavior. It does not authorize a paid run, push, merge, deployment, provider mutation, price or allowance change, or public enablement.

Any later implementation commit requires a fresh exact-range credential, semantic, content, and full-suite review. Master-plan final release-sequence step 1 therefore remains open.

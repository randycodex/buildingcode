# Permitext Research commercialization interim branch-integrity audit

Status: **Passed for the no-input checkpoint; final release review remains open**

Date: August 30, 2026

This record captures the strongest safe branch verification that could be completed without an owner decision, provider mutation, paid model call, push, merge, deployment, charge, or physical-device exercise. It is deliberately an **interim integrity checkpoint**, not the final full-diff review or public-release approval.

## Audited branch boundary

- Branch: `codex/research-commercialization`
- Requested and fetched remote baseline: `c1393d4a0d3806dd75263eb8adad23f19dfc106a`
- Audited implementation tip before this evidence-only record: `85c02555e7686131b5d12c20669fb147c5560d12`
- Merge base: `c1393d4a0d3806dd75263eb8adad23f19dfc106a`
- Commits in the audited range: 70
- Remote relationship: the local branch was 70 commits ahead of `origin/codex/research-commercialization`; it had not diverged from the requested baseline.

The commit that adds this evidence record is necessarily outside the recorded implementation-tip hash. The final release review must therefore select and audit the eventual exact release commit after all remaining work is complete.

## Preserved unrelated local work

The following pre-existing paths were observed and intentionally left untouched, unstaged, and uncommitted:

- `NYC CC APP/NYC CC APP.xcodeproj/project.pbxproj`
- `NYC CC APP/permitext/Info.plist`
- `DO NOT DELETE.png`
- `NYC CC APP/NYC CC APP.xcodeproj/xcshareddata/xcodecloud/`

Their presence keeps the final release-sequence requirement to preserve unrelated iOS/Xcode work open.

## Checks completed

1. `git fetch origin codex/research-commercialization` completed as a read-only remote refresh.
2. `git diff --check origin/codex/research-commercialization...HEAD` passed with no whitespace errors.
3. A redacted added-line scan covered the changed source and documentation text while excluding the generated construction-code corpus. It reported zero private-key markers, Stripe secret/restricted keys, GitHub tokens, AWS access keys, Google API keys, or JWT literals. Only file names, line numbers, and rule names could have been printed; matched values were never configured for output.
4. A changed-filename scan reported no `.env`, credential, secret, `.p8`, `.p12`, `.pem`, `.key`, or provisioning-profile file in the audited range.
5. `npm run check` passed in `permitext-sync-server`. The suite covered Research conversation behavior, routing, safety, turn accounting, rate limiting, stored V6 benchmarks, Research economics, billing entitlement, authentication contracts, content and figure integrity, evidence retrieval and governance, sync, zoning, HTTP integration, and UX alignment.
6. The offline retrieval benchmark retained 100% candidate and assembled-evidence recall for both the 27-case / 55-citation required cohort and the 36-case / 92-citation distinct cohort.
7. Paid Research remained locked. The exercised Research paths used mock or offline modes and explicitly reported that no paid model calls were made.

## What this does not prove

- It is not a semantic, line-by-line human review of every change in the eventual release diff.
- It does not select an exact release commit.
- It does not verify hidden Production environment-variable values.
- It does not verify fresh or existing Production sign-ins, account export/deletion, controlled Production billing, a real refund, tax collection, monitoring delivery, a Production deployment, TestFlight processing, or physical-iPhone acceptance.
- It does not authorize a push, merge, deployment, charge, provider change, pricing change, public paid Beta, or additional-turn sale.

## Required final recheck

When the owner later authorizes release work, repeat the full branch review against the exact selected commit, reconcile every dirty path, rerun the complete local checks, perform the protected Production/manual gates, and retain commit-bound evidence before any go decision. Master-plan release-sequence step 1 remains open until that happens.

The repeatable source-integrity portion is now available as:

```sh
npm run --silent audit:release-branch -- \
  --base <commit-or-ref> \
  --expected-branch <branch> \
  --allow-dirty <explicitly-reviewed-path>
```

The command reports only aggregate checks, paths, line numbers, and rule names. It never emits matched credential values or diff content. Every allowed dirty path must be supplied explicitly; directory allowances cover only descendants of that exact directory. A passing `sourceIntegrityReady` result still leaves `manualSemanticReviewRequired: true` and `releaseAuthorized: false`.

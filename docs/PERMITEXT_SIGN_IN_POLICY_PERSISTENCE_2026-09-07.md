# Sign-in loses stored policy acceptance — September 7, 2026

Status: **REPAIRED AND PUBLISHED; REAL WEB SIGN-IN DURABILITY PASSED**

This finding belongs to the existing B2/B5 account and consent closeout. It
qualifies the earlier bounded web-consent pass; it is not a new feature request.

## Live evidence

The designated Gmail test account is verified by full account-ID SHA-256
`d5f4fa47dccfdb4a6f5b2cd2b63b9f2a1bed0a9aba59dc1a365bde108373b645`.
Its export at `2026-09-07T18:36:37.431Z` retained the one acceptance documented
in the [web-consent receipt](./PERMITEXT_WEB_POLICY_CONSENT_2026-09-07.md).

The owner completed a real Google sign-in at `18:42:20Z`, confirmed by Clerk's
sign-in-completed and session-created events. Permitext returned to Free/Synced
with the same three Projects. The subsequent independent export at
`2026-09-07T18:56:33.639Z` had **no `account.policyAcceptances` field**.
The two changed account fields were `signedInAt` and `policyAcceptances`.
All 24 content/usage record groups were deeply unchanged and entitlement
remained null. The separate session-metadata group changed.

Private evidence under `/private/tmp/permitext-b1-live-20260906/`:
`provider-before-microsoft-20260907-private.json`,
`provider-after-google-restored-20260907-private.json`, and
`provider-google-restored-comparison-20260907.json`.
The original acceptance remains in the retained before export. No replacement
acceptance or historical timestamp has been fabricated or restored.

## Source cause

In `postgres-account-repository.mjs`, `signIn()` obtains the existing account
only through `matchingAppleAccounts()`. That function returns an empty candidate
array for every non-Apple provider, including Clerk. Consequently the existing
Clerk account is not merged into the incoming credential account, and the
`INSERT ... ON CONFLICT` replaces the persisted account JSON with the incoming
fields. Server-owned metadata such as policy acceptances can disappear.

The successful Microsoft fresh/returning checks used a new account without a
policy acceptance, so those passes do not disprove this defect.

## Repair and local acceptance

The sign-in upsert now merges with the existing row inside PostgreSQL's
`ON CONFLICT` update. This preserves the current consent history, profile,
migration state and billing metadata, including a metadata write that commits
after the optional Apple candidate lookup. The sign-in response uses the
`RETURNING` account from that same write. Existing Apple subject aliases are
retained and new verified aliases are added; distinct Clerk identities are
never merged on email alone. Clerk verified addresses refresh from the current
provider lookup, including removal of stale addresses; consent and billing
metadata remain intact. Session tokens remain hashed separately.

The new `postgres-account-sign-in-metadata-cases.mjs` regression failed against
the old source, reproducing the lost Clerk consent/profile/billing metadata.
After the repair it passed for Clerk, web and Apple identities, including
interleaved metadata updates, matching returned/persisted/authenticated records,
same-email account isolation, and Apple subject continuity.

The complete disposable PostgreSQL 18.6 acceptance run passed: 2,034 local
database requests, 61 Serializable batches, 46 repeatable-read export batches,
up to 14 concurrent connections, and zero external database/provider requests.
Existing account-link, lifecycle, deletion, image isolation and Research races
also passed. Auth hot-path, policy contract and local policy HTTP lifecycle
checks, `npm run check`, the final auth suite and `npm run smoke` passed.
The hosted preview build passed for exact source
`d5f721ebd369da4dda248e03557e327efbd32aaf`.

Private logs: `/private/tmp/permitext-pg-acceptance.leAngS/before-repair.log` and
`final-repair.log`. The task's clusters were stopped and its verified official
Postgres.app image detached after testing.

## Publication and live returning sign-in

Published through [PR #64](https://github.com/randycodex/buildingcode/pull/64),
merged at `2026-09-07T19:48:31Z`, under the owner's standing closeout authorization.
Production deployment `dpl_8ezS6HFV55ifNeXDkj5MKiyMuhs5` is READY; its public
health response and the real browser both identify source
`02d320725c5df2f0c7df83026e0af445d62c1e5e`, release `02d320725c5d`, hosted at
`permitext-sync-hxo8krgwe-randycodexs-projects-b72fc111.vercel.app`.

The live retest used the authorized personal-Microsoft test identity, account-ID
SHA-256 `4e3a0f17c91b9534a446bd276ed46c96e9958baf6b34ba6ce1314aa106f480af`.
Its baseline had one synthetic saved collection and no acceptance or entitlement.
The unchecked agreement gate disabled Upgrade. Checking it enabled Upgrade;
the action recorded one acceptance and opened Stripe Checkout, which was left
unpaid using its Back to PERMITEXT control.

The independent export recorded acceptance at `2026-09-07T19:53:10.079Z`,
platform `web`, client release `02d320725c5d`, for `terms-2026-08-28`,
`privacy-2026-08-28` and `subscriptions-2026-08-28`.

The first returning Microsoft attempt exposed another rejected provider
credential. The [provider receipt](./PERMITEXT_MICROSOFT_SIGN_IN_2026-09-07.md#final-credential-and-durability-retest)
records its correction and the final fresh login after the superseded credential
was removed. Clerk independently records the final `sign_in.completed` and
`session.created` at `2026-09-07T20:01:44Z` for the same test identity.

At `2026-09-07T20:02:47.259480Z`, the after export confirmed:

- Exactly one acceptance, deeply unchanged, including its ID, versions and timestamp.
- Only `signedInAt` changed in the account object, to `2026-09-07T20:01:45.410Z`.
- The same one saved-collection mutation and all 24 content/usage groups were unchanged.
- Entitlement remained null; the browser was Free/Synced with the collection restored.

Private evidence under `/private/tmp/permitext-b1-live-20260906/`:
`microsoft-consent-before-retest-20260907-private.json`,
`microsoft-consent-recorded-20260907-private.json`,
`microsoft-consent-after-return-20260907-private.json`, and
`microsoft-consent-durability-receipt-20260907.json`.

This closes the confirmed backend overwrite and the real web returning-sign-in
durability check. The lost historical Gmail acceptance remains in its original
private before export; it was not fabricated or backfilled. iOS consent and
the final shared-release gates remain open. Main's existing Xcode Cloud workflow
started automatically (`660939ff-c613-4ce6-a4c1-55186d5587f6`); no new phone build,
purchase, paid Research or public Beta activation is claimed.

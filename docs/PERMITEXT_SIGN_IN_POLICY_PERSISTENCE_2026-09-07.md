# Sign-in loses stored policy acceptance — September 7, 2026

Status: **REPRODUCED ON PRODUCTION; LOCAL REPAIR AND REAL POSTGRESQL ACCEPTANCE PASSED; PUBLICATION/LIVE RETEST PENDING**

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
checks, `npm run check` and the final auth suite passed. This is local evidence;
it does not close Production durability.

Private logs: `/private/tmp/permitext-pg-acceptance.leAngS/before-repair.log` and
`final-repair.log`. The task's clusters were stopped and its verified official
Postgres.app image detached after testing.

## Remaining publication and acceptance

1. Finish smoke verification and publish the reviewed candidate under the
   existing closeout authorization.
2. Repeat the no-purchase consent → sign-out → real sign-in → independent export
   check against that Production candidate. Do not treat the earlier immediate
   recording/duplicate-Checkout result as proof of sign-in durability.

The repair changes backend sign-in only. Publication is pending; no iOS build,
purchase, historical-consent restoration or activation-gate change is claimed.

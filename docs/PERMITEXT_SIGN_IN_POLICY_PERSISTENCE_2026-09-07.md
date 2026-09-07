# Sign-in loses stored policy acceptance — September 7, 2026

Status: **REPRODUCED ON PRODUCTION; SOURCE CAUSE IDENTIFIED; REPAIR PENDING**

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

## Remaining repair and acceptance

1. Preserve the exact existing non-Apple account and its server-owned metadata
   during sign-in; retain account-isolation and Apple merge safeguards.
2. Add a real PostgreSQL regression covering consent plus unrelated account
   metadata across returning Clerk sign-in, including a concurrent metadata
   update where applicable. A file-store-only test is insufficient.
3. Run the relevant auth, consent, PostgreSQL and required repository checks;
   publish the reviewed candidate under the existing closeout authorization.
4. Repeat the no-purchase consent → sign-out → real sign-in → independent export
   check against that Production candidate. Do not treat the earlier immediate
   recording/duplicate-Checkout result as proof of sign-in durability.

No runtime code, deployment or activation gate was changed in this checkpoint.

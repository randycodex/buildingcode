# Microsoft sign-in repair and acceptance — September 7, 2026

Status: **LIVE WEB FIRST-TIME AND RETURNING SIGN-IN PASSED; PUBLISHER VERIFICATION OPEN**

## Authorized identity and scope

The owner designated a personal Outlook identity and signed it into the Permitext
Microsoft tenant. The previously selected workplace identity and its directories
are excluded from all Permitext work. Its earlier consent request was canceled;
no consent grant or tenant configuration change was made there.

The authorized Entra session showed the Permitext tenant, with application
`224c0519-a19d-4048-94c2-bc25508d54a7` named `Permitext Clerk Production`. That
client ID exactly matched the enabled Microsoft connection in Clerk Production.
The Clerk administrator was separately checked and was not the excluded
workplace identity. No directory-wide setting was changed.

The new Permitext account's full account-ID SHA-256 is
`4e3a0f17c91b9534a446bd276ed46c96e9958baf6b34ba6ce1314aa106f480af`.
The private target and export helper are retained outside the repository at
`/private/tmp/permitext-b1-live-20260906/microsoft-snapshot.mjs`.

## Repairs and provider evidence

1. Added `https://permitext.com/terms` and `https://permitext.com/privacy` to
   this application's Branding & properties. Both canonical pages returned
   HTTP 200 with their expected titles. A complete Entra reload retained both
   URLs, and the real personal-Microsoft consent screen displayed both links.
2. The first authorized sign-in reached consent but failed during token exchange.
   Clerk event `01a07d3d-5b05-7124-a4ff-3a2a9921d220`, timestamp
   `2026-09-07T18:59:28Z`, recorded `oauth_callback.failed`, provider
   `oauth_microsoft`, reason `oauth_token_exchange_error`, and Microsoft error
   `AADSTS7000215` / `invalid_client`: the configured client secret was invalid.
   The failure was not a publisher-verification rejection.
3. Replaced the invalid credential in the exact Clerk Production connection.
   Client ID, redirect URI, supported account types and existing scopes remained
   unchanged. Scopes are `openid`, `email`, `profile`, `offline_access` and
   `User.Read`; no mail, files or organization-wide permission was added.
4. Initial replacement credential: `Permitext Clerk Production - 2026-09-07 active`, with
   Microsoft-displayed expiry **March 6, 2027**. Its value was transferred directly
   through the browser clipboard into Clerk, then the temporary value and
   clipboard were cleared. A later fresh login rejected this credential; it
   has now been replaced and removed as recorded below.
5. An intermediate generated credential appeared in diagnostic output. It was
   replaced again and explicitly deleted after the final credential passed an
   actual returning sign-in. The original invalid credential was also deleted.
   A complete Entra reload at that checkpoint confirmed **one** secret, with the
   label and expiry above; both earlier credentials were absent. No secret
   value is retained in this repository.

Microsoft allows only two credentials for this application. A third-credential
attempt failed without creating a secret; discarding that failed form produced
the owner's observed “Your unsaved edits will be discarded” confirmation.
The confirmation stalled browser commands until dismissed. The supported
JavaScript-dialog API then handled the remaining draft confirmation. The failed
draft did not change the saved Terms/Privacy links.

## Live acceptance

- Before first successful sign-in, an exact-email search in Clerk Production
  returned no users. After the credential repair, Microsoft returned to Permitext
  successfully. Clerk showed a new September 7 user, its verified primary email,
  and the matching Microsoft social account.
- Permitext displayed release `4048aa28e65b`, the expected display name, Free,
  Synced, zero saved sections and notes, and an empty workspace. No artifacts
  from the designated Gmail account appeared.
- Created one synthetic Free saved collection named
  `AUDIT TEST - Microsoft continuity - 2026-09-07`, with a clearly synthetic
  description. Waited for Synced and independently exported the exact account.
- Explicit sign-out removed that collection from the browser and returned the
  account column to Sign in. The other test account's Projects also remained absent.
- Returning through Microsoft restored the same account, Free/Synced state and
  collection. Export comparison confirmed the exact account identity, unchanged
  entitlement, and byte-equivalent saved-collection mutation. All 24 separate
  content/usage record groups were unchanged. Only `signedInAt` changed in the
  account object; session metadata is a separate group.
- After the final credential rotation, another real Microsoft sign-in again
  restored the same account and collection. Final independent export was
  captured at `2026-09-07T19:22:03.247Z`. The account has one collection mutation,
  zero Research usage/operations and no entitlement. The test session is retained.

Private evidence is under `/private/tmp/permitext-b1-live-20260906/`:
`microsoft-before-return-20260907-private.json` (`19:07:19.675Z`),
`microsoft-after-return-20260907-private.json` (`19:08:40.928Z`),
`microsoft-return-comparison-20260907.json`, and
`microsoft-final-20260907-private.json` with its summary, and the final deep
comparison and credential-cleanup receipt `microsoft-final-receipt-20260907.json`.
The saved mutation's
SHA-256 after returning sign-in is
`3a31f942400bae19ac8a0fd3a2ffd956a203d9b7f64ddb3662234331510d0e12`.

## Final credential and durability retest

A later fresh Microsoft exchange failed at `2026-09-07T19:54:51Z` with
`AADSTS7000215` / `invalid_client`, Clerk event
`01a07d70-11f4-7c29-bb20-433ad6ce8455`. This contradicts treating the earlier
rotation checkpoint as final credential acceptance; the existing data-continuity
observations remain historical evidence.

In the same verified Permitext tenant/application, created the replacement
`Permitext Clerk Production - 2026-09-07 verified`, credential ID
`14138590-f25a-4301-9bbc-6014a0a672ca`, expiring **March 6, 2027**. Transferred
the revealed **Value** column directly into Clerk without displaying it in tool
output, verified the destination input matched, and saved the connection.
Client ID, redirect and scopes were unchanged. The temporary value and clipboard
were cleared. No value is written to this repository or the private receipts.

After a fresh Microsoft login passed, removed the exact superseded `active`
credential (`7e97edff-618e-466e-a9db-2b92b5b3ce2a`). A full Entra reload confirmed
one credential, the new `verified` entry. Then explicitly signed out of Permitext
and completed **another** real Microsoft login after that removal. Clerk records
both `sign_in.completed` and `session.created` at `2026-09-07T20:01:44Z` for the
same test identity. Permitext returned Free/Synced with the same collection.

The independent `20:02:47.259480Z` export also proves the new web acceptance
survived unchanged, including its ID, versions and original timestamp. Only
`signedInAt` changed; the collection mutation and all 24 content/usage groups
were unchanged, and entitlement remained null. See the
[published consent repair and live receipt](./PERMITEXT_SIGN_IN_POLICY_PERSISTENCE_2026-09-07.md#publication-and-live-returning-sign-in).
The test session remains signed in; the sole retained credential must rotate
before March 6, 2027.

## Publisher warning and remaining scope

The correct tenant still uses its default `onmicrosoft.com` publisher domain.
This application's publisher is unverified. Adding policy links or fixing a
client secret does not grant Microsoft's verified-publisher badge. For recently
registered multitenant apps, even a custom publisher domain alone does not remove
the unverified label. Microsoft requires a verified Partner Program identity
associated with the app for publisher verification.

Next: verify `permitext.com` as this app's publisher domain, then inspect the
available Partner Center verification prerequisites without inventing business
facts. The app-specific domain proof uses
`/.well-known/microsoft-identity-association.json`; no proof file or publisher
domain change was published in this checkpoint.

Sources: [publisher domain](https://learn.microsoft.com/en-us/entra/identity-platform/howto-configure-publisher-domain),
[publisher verification](https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview),
[Clerk Microsoft setup](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/microsoft).

These are personal-Microsoft **web** passes on current Production. They do not
establish physical-iOS Microsoft acceptance, every enterprise tenant's consent
policy, new-provider linking into an existing different Permitext identity,
account merge, publisher verification, or final shared-release acceptance.
No purchase, paid Research, Pro grant, account deletion, native build or public
Beta activation occurred.

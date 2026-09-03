# Permitext Beta 1 Production account-deletion evidence — September 2, 2026

Status: **PARTIAL PASS — server deletion and empty-account recreation passed; the complete Production account-deletion gate remains open**

This record covers the owner-authorized destructive exercise against a dedicated disposable Production account. It retains only release identifiers, aggregate counts, one-way fingerprints, and observed outcomes. It excludes the account email, display name, raw account identifier, session tokens, payment identifiers, billing address, customer content, and provider payloads.

## Bound release

- Git commit: `cb7918b453988a07d57a7834f5982d523d0e3901`
- Vercel Production deployment: `dpl_2i2iRQjwqkuQaQChbzR5MGh6j8EW`
- Canonical origin: `https://permitext.com`
- Exercise completed: `2026-09-03T00:26:40Z`
- Disposable account SHA-256: `40d69e0c70327dd27e27eb71d2089a380c56be725d6648160a7732a9c13249e0`
- Pre-deletion database-state fingerprint: `6f6059294e3f910722ab36ff5fb720e7` (PostgreSQL MD5 integrity label only; not an authentication secret)

## Pre-deletion baseline

The authenticated Vercel/Neon query console was verified with read-only mode enabled. No Production credential or raw personal record was copied from the console.

- Account: `1`
- Entitlement: `0` (Free)
- Active account sessions: `2`
- Active saved passages: `1`
- Active annotations/notes: `0`
- Active Projects or saved collections: `1` (saved collection)
- Active Project items/comments: `0`
- Research conversations/answers/usage/credits: `0`
- Active foundation artifacts/Project links/Project activity: `0`
- Sync events: `6`
- Stripe event tombstones: `1`
- Owned organizations and organization/Project memberships: `0`

The representative dataset was necessarily narrower than the runbook requires. The account had returned to Free after the separately authorized refund, so a true Project, private image, and new Research conversation were unavailable. The web Reader and Saved surfaces also exposed no reachable note editor even though Free advertised ten notes. Those absent record types are not claimed as tested.

## First deletion and independent verification

The customer-facing Account screen displayed the complete deletion disclosure, including the distinction between Permitext data and retained external-provider/legal records. The owner separately authorized typing `DELETE` and submitting the destructive action.

- Stripe billing: `notApplicable`; the prior controlled subscription was already canceled and refunded.
- Permitext server data: `Complete`; the UI reported zero private images.
- Browser/device cleanup: `Needs attention`. The client attempted to load and remove four stale local Workboards that were not part of the disposable account's synchronized dataset; their Workboard modules failed to load.
- Clerk identity cleanup: `notApplicable`. The same Clerk identity remained available and later recreated the same Permitext account identifier, so this was not a legitimate identity-removal pass.

The read-only Production database check immediately after server deletion showed zero account, entitlement, active session, saved-item, annotation, Project/collection, Project-item, comment, Research, artifact, Project-link, Project-activity, sync-event, organization, and membership rows for the test identifier. The single Stripe event tombstone remained, as disclosed and intended to prevent purchase replay.

The client **Retry cleanup** action was deliberately not used: its target list included stale browser Workboards outside the verified disposable-account dataset, so retrying could have deleted unrelated local data.

## Same-identity recreation and final cleanup

Signing in again with the same external identity created an empty Free Permitext account. The Account screen showed zero saved passages, zero notes, and no Projects or saved collections. The read-only database check independently showed:

- Account: `1`
- Active account sessions: `1`
- Entitlement and every tested content/sync category: `0`
- Stripe event tombstones: `1`

The owner then separately authorized deletion of this recreated empty account. The second customer-facing deletion reported Permitext data `Complete`, browser data `Complete`, Stripe `notApplicable`, and Clerk identity `notApplicable`. Final read-only Production verification showed:

- Account, entitlement, account sessions, saved items, annotations, Projects/collections, Research conversations, foundation artifacts, and sync events: `0`
- Stripe event tombstones: `1`

No Permitext test account, test content, live subscription, or raw export remains. The external Clerk identity was not proven removed.

## Acceptance decision and required corrections

The server-side account and data deletion, session removal, disclosed Stripe tombstone retention, empty-account recreation, and final Permitext-account cleanup passed for the bound Production release. The complete gate does **not** pass yet because:

1. Browser cleanup was not scoped safely to the disposable account on the first deletion.
2. Clerk identity removal was reported as not applicable even though the account was Clerk-backed and the same Clerk identifier remained reusable.
3. The required note, true Project, Research history, private image, and second-client sync coverage was not exercised.
4. The documented admin export/checklist endpoints have no usable non-secret operator workflow; this exercise used a read-only database aggregate and state fingerprint instead of a temporary raw export.

Before rerunning this Production gate, scope local cleanup to account-owned records, make Clerk identity handling truthful and verifiable, expose the note workflow, and provide a secure operator acceptance path. A rerun must use representative Pro content without initiating another real charge unless the owner separately authorizes that charge.

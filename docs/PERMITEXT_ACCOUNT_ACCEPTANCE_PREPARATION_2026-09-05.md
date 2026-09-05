# Disposable-account acceptance preparation — September 5, 2026

## Production and operator access

The owner replaced the write-only `PERMITEXT_SYNC_ADMIN_TOKEN` in Vercel,
preserving its Secret type and Production/Preview scopes. The agent then
redeployed the existing verified Production source without changing runtime
code:

- Source: `0985728b26e5b247d758fce26c4e0739efef986f`.
- Deployment: `dpl_6ZEsNtGcM5e5QsUFDXVWDGPFYPB3`, READY.
- Host: `permitext-sync-an0tgm64s-randycodexs-projects-b72fc111.vercel.app`.
- Both canonical origins returned this source and deployment host at
  approximately `2026-09-05T14:32:12Z`. The served `app.js`, `offline-storage.js`,
  `service-worker.js`, and `index.html` matched the checked source bytes.
- Production health passed with PostgreSQL `normalized-v4` and configured live
  Clerk authentication. AASA matched `57BY95X97H.com.randycodex.permitext`.
  Strict publication checks matched the approved policy artifacts.
- The bounded error/fatal runtime aggregate for this deployment, beginning at
  `2026-09-05T14:28:43Z`, contained no entries when checked after verification.

The new credential reached authenticated request validation, and subsequent
operator export/checklist requests returned successfully. Only that variable
was updated in the two existing ignored local Production environment files;
owner-only file permissions were verified. The temporary copy file was removed.
No credential value or raw account export is included in this record. Existing
Preview deployments were not redeployed or claimed to use the new value.

## Read-only account export

The exact owner-designated disposable identity was verified against its account
record. The account identifier SHA-256 is
`2a057d825caaa68a5ecd217074546588bc00ce966677f128cf0fd31aa2f13953`.
At `2026-09-05T14:32:12Z`:

- Export schema: `permitext-account-record-export-v2`.
- Checklist schema: `permitext-account-restore-checklist-v2`.
- Four saved items, one annotation containing the synthetic acceptance note,
  one saved collection, and one continuity record were present.
- The collection is represented by a legacy `project` mutation; it is a Free
  saved collection, not a Pro Project or populated Notebook.
- One session-metadata record was present. All other `recordCounts` families
  were zero, including lifecycle guards, Research, artifacts, organizations,
  memberships, ownership records, and Code Question issuance records.
- No entitlement record was present. Shared-ownership review was not required.
- The export explicitly excluded authentication secrets and private file bytes.

The refreshed Production browser remained signed in and displayed release
`0985728b26e5`, Free, four saves, one note, and the empty acceptance collection.
The Saved list showed Title, Scope, the 2014 Slope paragraph, and the 2022 Gates
section. The synthetic note was visible under Title. The legacy workspace
ownership warning remained visible; unattributed browser data was preserved.

The raw export SHA-256 was
`2bd8dfe2fc59d2824fc86d6bb6743ae865226d51870da7e80867ec064f626c60`.
Private temporary export/checklist files were used for the comparison and then
removed; only aggregate evidence and a minimal private target record are retained
for a later explicitly approved deletion exercise.

## Remaining boundary

This is successful operator-access and Free-account export verification, not
completed account-deletion acceptance. No account, Clerk identity, customer
record, or provider subscription was deleted. No Pro grant, purchase, paid
Research call, or new TestFlight upload occurred.

The next bounded destructive proposal is deletion through the customer interface
of only this disposable Permitext account, its four saves, one synthetic note,
empty collection, account-owned continuity/session data, attributable local data,
and associated Permitext Clerk sign-in identity. The external Gmail/Google
account is outside that scope. The owner must approve the exact proposal before
execution; the form remains unsubmitted. Fresh export/checklist evidence must
be captured immediately before any approved deletion and compared with this
scope to stop on unexpected changes.

Second-client verification, populated Pro Project/Research/private-image
coverage, post-deletion checks, recreation, and separately authorized cleanup
remain open under the [account acceptance runbook](./BETA1_BILLING_IDENTITY_RUNBOOK.md#production-account-exportdeletion-acceptance).
The machine release gates remain unchanged.

Local non-secret deployment evidence:
`/private/tmp/permitext-admin-rotation-production-20260905.json`,
`/private/tmp/permitext-admin-rotation-policy-20260905.json`, and
`/private/tmp/permitext-admin-key-check-20260905.json`.

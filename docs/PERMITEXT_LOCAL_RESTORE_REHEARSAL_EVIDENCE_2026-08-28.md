# Permitext Local Restore Rehearsal Evidence — August 28, 2026

## Result

The permanent local restore rehearsal passes with zero provider calls and zero production writes.

Command:

```sh
cd permitext-sync-server
npm run test:operations
```

The exercise creates a synthetic file-backed Permitext store with a representative account, Pro entitlement, saved item, note, Project, Project membership, Workboard, Research conversation and answer, Notebook card and image record, Report draft and manifest, Project link, and activity record. It copies that store into an isolated target, starts separate source and target servers, and runs the same read-only restore verifier intended for the provider drill.

The verified copy matches durable aggregate counts, sync state, entitlement/profile state, mutation counts, Research records, Notebook/Report artifact counts, Project links, activity, release commit, and the supplied private-asset inventory count. The test then removes the restored Research answer and confirms that the verifier fails on both the aggregate and representative-account checks. It also confirms that the verifier rejects the same source and target origin.

## Permanent safeguards

`npm run verify:restore-drill` now requires:

- different source and target origins;
- HTTPS except for a loopback rehearsal;
- an explicit isolated-target attestation;
- explicit confirmation that billing, email, Apple notification, Stripe webhook, and Research-provider writes are disabled;
- source and target administrator credentials without printing them;
- a representative test account;
- a source private-asset inventory timestamp and both asset counts;
- target storage matching the expected provider;
- non-production target release identity;
- matching application Git commits when both deployments report one; and
- exact durable summary and representative-account parity.

Active sessions are intentionally excluded from parity because restore acceptance must use a fresh sign-in rather than trust a restored session.

## Evidence boundary

This is a local file-backup rehearsal and tool validation. It is not the first required Neon/Blob restore drill, does not prove Neon history retention, does not create or clean up a Neon restore branch or Vercel deployment, and does not retrieve a real private Blob asset. It therefore does **not** satisfy the public Beta restore gate.

The provider-backed drill still requires the operator to select the exact Neon recovery point, create an isolated restore branch/compute, deploy the compatible application with provider writes disabled, inventory and retrieve representative private assets, retain the output and timing evidence, and approve cleanup of the exact isolated resources.

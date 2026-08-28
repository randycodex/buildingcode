# Permitext Beta 1 restore drill record

Completed for the August 28, 2026 prelaunch provider recovery exercise. A dashboard claim that backups exist is not a successful drill.

A local file-copy rehearsal or a passing verifier contract is preparation only. Mark this record **Pass** only for an isolated provider restore with the actual Neon recovery point, private-asset inventory and retrieval, non-production deployment, and retained cleanup evidence.

## Authorization and isolation

- Operator: Codex-assisted Permitext owner session
- Approver: Permitext owner
- Drill start/end (UTC): `2026-08-28T15:52:03.312Z` / `2026-08-28T16:13:55Z`
- Production writes affected: **No**
- Billing, email, Apple notifications, Stripe webhooks, and Research generation disabled in the drill environment: **Yes**
- Isolated Vercel deployment: Not created; retained no-deploy constraint
- Isolated Neon branch/compute: `permitext-restore-drill-20260828` / `br-cool-dawn-aq1esvjo`, local exact-commit client
- Isolated private Blob namespace: Not created; source private inventory and authenticated class retrieval were read-only

## Recovery point

- Production Neon source branch: `main` / `br-fancy-grass-aq73byy8`
- Snapshot or point-in-time used: `2026-08-28T12:01:31.301-04:00`
- Recovery-point age at branch creation: Current retained-history point selected by Neon, under one minute old
- History-retention window confirmed in Neon: 6 hours
- Private Blob inventory timestamp and object count: `2026-08-28T15:52:03.312Z`; 124 objects / 5,248,939 bytes
- Serving production release ID and Git commit at capture: `dbbb6ab40d40` / `dbbb6ab40d40d1d3d947303aa45b01fbd9cebce3`

## Verification

Record source and restored counts. Use aggregate counts only; do not paste customer content or credentials.

| Record class | Source count | Restored count | Result |
| --- | ---: | ---: | --- |
| Accounts | 16 | 16 | Pass |
| Entitlements | 5 | 5 | Pass |
| Saved sections and notes | 48 / 27 | 48 / 27 | Pass |
| Projects and Project evidence | 29 / 465 | 29 / 465 | Pass |
| Research conversations and answers | 39 / 43 | 39 / 43 | Pass |
| Notebook cards | 19 | 19 | Pass |
| Report drafts and files | 2 / 4 | 2 / 4 | Pass |
| Private assets | 124 | 124 | Inventory/retrieval pass; no isolated Blob copy |

- Representative test account sign-in and sync read: Read-only restored-account checklist and exact content digest passed; interactive sign-in was not exercised without a deployment
- Stripe entitlement read without provider mutation: One web-subscription entitlement restored with aggregate and content-digest parity
- Apple entitlement read without provider mutation: No active Apple-sourced entitlement; the single Apple transaction-ownership record restored with content-digest parity
- Private asset retrieval by authenticated endpoint: Private provider retrieval passed for PNG, JPG, and PDF representatives
- `/health` and `/release` result: HTTP 200 from the exact Production commit against the isolated branch; target environment `preview`
- `npm run verify:restore-drill` result and evidence path: Pass, zero mismatches; [PERMITEXT_NEON_BLOB_RESTORE_DRILL_EVIDENCE_2026-08-28.md](./PERMITEXT_NEON_BLOB_RESTORE_DRILL_EVIDENCE_2026-08-28.md)
- Missing or corrupt records: None detected across 38 tables / 3,611 rows
- Recovery time objective observed: Neon branch fork 0.39 seconds; end-to-end operator verification completed in under 10 minutes after branch creation
- Recovery point objective observed: Point-in-time recovery within the confirmed six-hour history window

## Cleanup and conclusion

- Exact isolated targets approved for deletion: Neon branch `br-cool-dawn-aq1esvjo`; local worktree and mode-`0600` temporary directory after provider deletion confirmation
- Cleanup completed at: `2026-08-28T16:13:55Z`; branch list returned to `main` only, local servers stopped, worktree unregistered, and temporary credentials removed
- Evidence location: [PERMITEXT_NEON_BLOB_RESTORE_DRILL_EVIDENCE_2026-08-28.md](./PERMITEXT_NEON_BLOB_RESTORE_DRILL_EVIDENCE_2026-08-28.md)
- Drill result: **Fail — full acceptance incomplete; provider recovery checks passed**
- Corrective actions, owner, and due date: Permitext owner to authorize an isolated Vercel deployment and isolated private Blob namespace or explicitly accept the residual risk before public Beta
- Public Beta restore gate: **Still blocked**

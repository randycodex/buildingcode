# Permitext Beta 1 restore drill record

Completed for the August 28–29, 2026 prelaunch provider recovery exercise and isolated acceptance follow-up. A dashboard claim that backups exist is not a successful drill.

A local file-copy rehearsal or a passing verifier contract is preparation only. Mark this record **Pass** only for an isolated provider restore with the actual Neon recovery point, private-asset inventory and retrieval, non-production deployment, and retained cleanup evidence.

## Authorization and isolation

- Operator: Codex-assisted Permitext owner session
- Approver: Permitext owner
- Drill start/end (UTC): `2026-08-28T15:52:03.312Z` / `2026-08-30T03:08:48Z`
- Production writes affected: **No**
- Billing, email, Apple notifications, Stripe webhooks, and Research generation disabled in the drill environment: **Yes**
- Isolated Vercel deployment: SSO-protected Preview `dpl_D8NYCyGxfLVjVpBDi666HZ79udXg` in project `permitext-restore-acceptance`
- Isolated Neon branch/compute: initial `permitext-restore-drill-20260828` / `br-cool-dawn-aq1esvjo`; follow-up `permitext-restore-acceptance-20260829` / `br-spring-dawn-aqpcccb1`
- Isolated private Blob namespace: `permitext-restore-acceptance` / `store_JqmlrUeYX0abaH3m`, private `iad1`

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
| Private assets | 124 | 124 | Pass; separate private restore matched all 124 objects / 5,248,939 bytes byte-for-byte |

- Representative test account sign-in and sync read: Protected deployed restore checklist passed for an account with an active session, public profile, saved items, annotations, Projects, Project memberships, Workboards, and continuity data; no new provider sign-in was performed
- Stripe entitlement read without provider mutation: One web-subscription entitlement restored with aggregate and content-digest parity
- Apple entitlement read without provider mutation: No active Apple-sourced entitlement; the single Apple transaction-ownership record restored with content-digest parity
- Private asset retrieval by authenticated endpoint: Private provider retrieval passed for PNG, JPG, and PDF representatives
- `/health` and `/release` result: HTTP 200 from the exact Production commit against the isolated branch; target environment `preview`, SSO protected
- `npm run verify:restore-drill` result and evidence path: Pass, zero mismatches; [PERMITEXT_NEON_BLOB_RESTORE_DRILL_EVIDENCE_2026-08-28.md](./PERMITEXT_NEON_BLOB_RESTORE_DRILL_EVIDENCE_2026-08-28.md)
- Missing or corrupt records: None detected across 38 tables / 3,611 rows
- Recovery time objective observed: Neon branch fork 0.39 seconds; end-to-end operator verification completed in under 10 minutes after branch creation
- Recovery point objective observed: Point-in-time recovery within the confirmed six-hour history window

## Cleanup and conclusion

- Exact isolated targets approved for deletion: Neon branch `br-cool-dawn-aq1esvjo`; local worktree and mode-`0600` temporary directory after provider deletion confirmation
- Cleanup completed at: `2026-08-28T16:13:55Z`; branch list returned to `main` only, local servers stopped, worktree unregistered, and temporary credentials removed
- Evidence location: [PERMITEXT_NEON_BLOB_RESTORE_DRILL_EVIDENCE_2026-08-28.md](./PERMITEXT_NEON_BLOB_RESTORE_DRILL_EVIDENCE_2026-08-28.md)
- Follow-up retained resources: the new Neon branch auto-expires after one day; the isolated Vercel project, protected Preview, and private Blob copy remain temporarily available as provider-verifiable evidence and are not connected to Production
- Drill result: **Pass**
- Corrective actions: None for the restore gate; Production authentication, billing, monitoring, tax, and release checks remain separate
- Public Beta restore gate: **Pass**

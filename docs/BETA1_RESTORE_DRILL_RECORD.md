# Permitext Beta 1 restore drill record

Complete this record for the first prelaunch restore exercise and each quarterly exercise. A dashboard claim that backups exist is not a successful drill.

A local file-copy rehearsal or a passing verifier contract is preparation only. Mark this record **Pass** only for an isolated provider restore with the actual Neon recovery point, private-asset inventory and retrieval, non-production deployment, and retained cleanup evidence.

## Authorization and isolation

- Operator:
- Approver:
- Drill start/end (UTC):
- Production writes affected: **No**
- Billing, email, Apple notifications, Stripe webhooks, and Research generation disabled in the drill environment: **Yes / No**
- Isolated Vercel deployment:
- Isolated Neon branch/compute:
- Isolated private Blob namespace:

## Recovery point

- Production Neon source branch:
- Snapshot or point-in-time used:
- Recovery-point age at drill start:
- History-retention window confirmed in Neon:
- Private Blob inventory timestamp and object count:
- Serving production release ID and Git commit at capture:

## Verification

Record source and restored counts. Use aggregate counts only; do not paste customer content or credentials.

| Record class | Source count | Restored count | Result |
| --- | ---: | ---: | --- |
| Accounts |  |  |  |
| Entitlements |  |  |  |
| Saved sections and notes |  |  |  |
| Projects and Project evidence |  |  |  |
| Research conversations and answers |  |  |  |
| Notebook cards |  |  |  |
| Report drafts and files |  |  |  |
| Private assets |  |  |  |

- Representative test account sign-in and sync read:
- Stripe entitlement read without provider mutation:
- Apple entitlement read without provider mutation:
- Private asset retrieval by authenticated endpoint:
- `/health` and `/release` result:
- `npm run verify:restore-drill` result and evidence path:
- Missing or corrupt records:
- Recovery time objective observed:
- Recovery point objective observed:

## Cleanup and conclusion

- Exact isolated targets approved for deletion:
- Cleanup completed at:
- Evidence location:
- Drill result: **Pass / Fail**
- Corrective actions, owner, and due date:
- Public Beta restore gate: **Satisfied / Still blocked**

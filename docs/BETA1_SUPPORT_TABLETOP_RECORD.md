# Permitext Beta 1 support tabletop record

Use synthetic reports only. Do not paste customer content, credentials, provider receipts, or production database records into this document. The first operator-run tabletop is required before marking the support-process gate complete.

## Exercise identity

- Exercise date/time and time zone:
- Operator: Higinio Jimenez Manzano (`permitext@gmail.com`)
- Observer, if any:
- Release ID and Git commit used for the exercise:
- Start time:
- End time:
- Overall result: **Pass / Fail**

## Common operating loop

For each scenario:

1. Acknowledge the report and state the next update time. Urgent account, billing, data-loss, access, security, and service-wide reports target one business day; ordinary reports target two business days.
2. Record platform, release ID or iOS build, approximate event time and time zone, expected behavior, and a minimal account identifier. Do not request passwords, sign-in codes, bearer/session tokens, provider keys, full card data, or unredacted customer content.
3. Classify the scope and severity. Use the incident record for a service-wide issue, suspected privacy/security issue, incorrect billing across accounts, or any risk to account, entitlement, saved-work, or authoritative-source integrity.
4. Use read-only diagnostics first: `/health`, `/release`, structured log fingerprints, the administrator storage summary, and the representative account restore checklist. Provider dashboards are authoritative for payment/refund state; an email assertion alone never grants entitlement or triggers a refund.
5. Contain before repairing. Use the Research kill switch for a systemic Research-boundary failure and the verified rollback path for a release regression. Do not delete evidence or production data during triage.
6. Verify recovery on the affected platform, record the result and next owner, and send a concise customer update without unsupported legal, code-interpretation, or refund promises.

## Scenario A — active purchase but Pro is missing

Synthetic report: “I paid for Pro on the web, but Permitext still shows Free.”

- Acknowledgment text and target:
- Severity and rationale:
- Minimum information requested:
- Permitext account/entitlement check:
- Stripe event and ownership check, using synthetic identifiers:
- Duplicate-account or delayed-webhook decision:
- Correct recovery path:
- Final customer update:
- Elapsed operator time:
- Result: **Pass / Fail**

Pass criteria: the operator distinguishes web from Apple billing, does not request a full receipt or secret, does not grant Pro from email alone, verifies provider ownership, and records whether the issue is isolated or systemic.

## Scenario B — saved Project appears missing after sign-in

Synthetic report: “I signed in on a second device and my Project is empty.”

- Acknowledgment text and target:
- Severity and rationale:
- Release/build and sync-state evidence:
- Read-only restore-checklist result:
- Whether the user is told to avoid destructive local cleanup:
- Backup/restore or engineering escalation:
- Final customer update:
- Elapsed operator time:
- Result: **Pass / Fail**

Pass criteria: the operator preserves local evidence, avoids telling the user to reinstall or delete data before recovery evidence exists, distinguishes sync delay from durable loss, and escalates a credible loss to the incident and restore process.

## Scenario C — Research answer overstates authority

Synthetic report: “Permitext said my design complies, but the cited section does not establish that.”

- Acknowledgment text and target:
- Severity and rationale:
- Answer/release evidence retained without customer-sensitive facts:
- Enacted-source and citation check:
- Research kill-switch decision:
- Engineering/evaluation escalation:
- Final customer update preserving the unofficial-research boundary:
- Elapsed operator time:
- Result: **Pass / Fail**

Pass criteria: support does not provide a replacement official interpretation, preserves the exact release and answer evidence, directs the user to enacted sources and the appropriate professional/authority, and uses the kill switch if the failure is systemic.

## Operator conclusion

- All urgent scenarios acknowledged within the simulated one-business-day target: **Yes / No**
- No prohibited secret or unnecessary customer content requested: **Yes / No**
- Escalation and containment decisions matched the runbook: **Yes / No**
- Recovery verification and customer updates completed: **Yes / No**
- Corrective actions, owner, and due date:
- Operator signature/name:
- Support-process master-plan gate: **Satisfied / Still blocked**

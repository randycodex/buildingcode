# Permitext Beta 1 support tabletop record

Use synthetic reports only. Do not paste customer content, credentials, provider receipts, or production database records into this document. This first exercise was run as a Codex-assisted support rehearsal: Codex supplied the recommended diagnostic and response path, and the operator remains responsible for reviewing and sending real customer communications.

## Exercise identity

- Exercise date/time and time zone: August 28, 2026, 9:43 AM EDT
- Operator: Higinio Jimenez Manzano (`permitext@gmail.com`)
- Observer, if any: Codex facilitator and response author (synthetic exercise only)
- Release ID and Git commit used for the exercise: local source at `5c7d8a824234268aeec12077874edb0ad6d09124`, plus the uncommitted working-tree policy and tabletop record; no Production or provider changes
- Start time: 9:43 AM EDT
- End time: 9:45 AM EDT
- Overall result: **Pass**

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

- Acknowledgment text and target: “Thank you for letting me know, and I’m sorry your Pro access is not appearing. Please do not purchase it again while I investigate. I will update you within one business day.”
- Severity and rationale: **SEV-2 pending scope confirmation** because a paid entitlement is missing for one reported account. Open a SEV-1 incident if read-only evidence shows multiple accounts, incorrect billing across accounts, or a service-wide webhook failure.
- Minimum information requested: Confirm web purchase, web release ID, approximate purchase time and time zone, expected result, and the minimal Permitext account identifier used for the purchase. Do not request a password, sign-in code, session token, card number, provider secret, or full receipt.
- Permitext account/entitlement check: Read the provider-neutral entitlement for synthetic user `usr_tabletop_a`; the exercise state shows no active Pro grant. Do not edit the database or grant Pro from the email report.
- Stripe event and ownership check, using synthetic identifiers: In the simulated Stripe read, signed event `evt_tabletop_checkout_a` belongs to subscription `sub_tabletop_a`, is paid and active, and its Permitext ownership metadata matches `usr_tabletop_a`. No real Stripe record was accessed.
- Duplicate-account or delayed-webhook decision: The synthetic Checkout owner and signed-in Permitext owner match, and the account search shows no second synthetic identity. The absence of the matching lifecycle cursor/log fingerprint makes an isolated delayed or failed webhook the working diagnosis; check for matching failures across accounts before classifying it as isolated.
- Correct recovery path: Correct the webhook delivery problem if present, then request a provider-signed replay of the existing synthetic event. Do not manufacture an entitlement or create another subscription. Verify the entitlement read, web plan display, allowance, and lifecycle cursor after replay.
- Final customer update: “Your payment was verified against the Permitext account, and Pro now appears correctly. You were not charged a second time. Please refresh Permitext and reply if the plan still shows Free. I will continue monitoring the billing event.”
- Elapsed operator time: Under 1 minute in the timed synthetic walkthrough.
- Result: **Pass**

Pass criteria: the operator distinguishes web from Apple billing, does not request a full receipt or secret, does not grant Pro from email alone, verifies provider ownership, and records whether the issue is isolated or systemic.

## Scenario B — saved Project appears missing after sign-in

Synthetic report: “I signed in on a second device and my Project is empty.”

- Acknowledgment text and target: “I’m sorry your Project is not appearing on the second device. Please keep both devices as they are and do not delete the Project, clear local data, or reinstall Permitext while I check the synchronized copy. I will update you within one business day.”
- Severity and rationale: **SEV-2 pending scope confirmation** because saved work may be unavailable. Escalate to SEV-1 if durable records are missing, multiple accounts are affected, or restore evidence suggests broader loss.
- Release/build and sync-state evidence: Collect both platforms, release IDs or iOS builds, approximate last successful edit and time zone, the minimal account identifier, and whether the same Project remains visible on the first device. The synthetic case uses one account; the second device’s sync cursor is behind the durable Project mutation.
- Read-only restore-checklist result: The simulated administrator storage summary and representative-account read contain the Project, membership, Project links, and expected mutation. The first device remains unchanged. This supports a sync-delay diagnosis rather than confirmed durable loss.
- Whether the user is told to avoid destructive local cleanup: **Yes.** Preserve the first device and do not sign out, reinstall, clear browser/app storage, delete records, or overwrite the Project before recovery evidence is retained.
- Backup/restore or engineering escalation: First retry a non-destructive authenticated sync and confirm the correct Permitext identity. If the durable record or membership is absent, open an incident, preserve both devices and logs, and use the isolated restore process; do not restore directly over Production during triage.
- Final customer update: “The synchronized Project is still present in Permitext storage, and the second device was behind the current sync state. No Project was deleted. Please reopen Permitext on the second device while connected; if it remains empty, stop there and reply so I can continue without risking the copy on your first device.”
- Elapsed operator time: Under 1 minute in the timed synthetic walkthrough.
- Result: **Pass**

Pass criteria: the operator preserves local evidence, avoids telling the user to reinstall or delete data before recovery evidence exists, distinguishes sync delay from durable loss, and escalates a credible loss to the incident and restore process.

## Scenario C — Research answer overstates authority

Synthetic report: “Permitext said my design complies, but the cited section does not establish that.”

- Acknowledgment text and target: “Thank you for reporting this. Do not rely on the compliance conclusion while I review the cited enacted text and the exact Permitext release. I will update you within one business day.”
- Severity and rationale: **SEV-2** because the answer may overstate an authority-sensitive conclusion. Escalate to SEV-1 and contain Research if the same boundary failure is systemic or could affect multiple users.
- Answer/release evidence retained without customer-sensitive facts: Preserve the synthetic answer ID `ans_tabletop_c`, release ID, model route, citation identifiers, evaluation fingerprint, and generated conclusion. Exclude the user’s identity, address, Project facts, and unredacted question from the incident record.
- Enacted-source and citation check: The simulated citation is enacted text, but it does not establish the answer’s categorical compliance conclusion. The citation exists; the defect is an unsupported inference beyond its authority.
- Research kill-switch decision: **No for this isolated synthetic case** after checking that no matching fingerprint appears across other evaluations. Use `PERMITEXT_RESEARCH_KILL_SWITCH=1` immediately if the fingerprint recurs, the router/evidence boundary is systemic, or scope cannot be bounded safely.
- Engineering/evaluation escalation: Add the redacted case shape as a governed regression, block the failing answer pattern, inspect the evidence-boundary/router decision, and require evaluation approval before treating the corrective change as release-ready.
- Final customer update preserving the unofficial-research boundary: “You are correct that the cited section does not establish the compliance conclusion Permitext gave. Permitext is an unofficial research tool and cannot issue an approval or official interpretation. Please use the enacted source and obtain review from the applicable authority or qualified professional. I have escalated the unsupported conclusion for correction.”
- Elapsed operator time: Under 1 minute in the timed synthetic walkthrough.
- Result: **Pass**

Pass criteria: support does not provide a replacement official interpretation, preserves the exact release and answer evidence, directs the user to enacted sources and the appropriate professional/authority, and uses the kill switch if the failure is systemic.

## Operator conclusion

- All urgent scenarios acknowledged within the simulated one-business-day target: **Yes**
- No prohibited secret or unnecessary customer content requested: **Yes**
- Escalation and containment decisions matched the runbook: **Yes**
- Recovery verification and customer updates completed: **Yes, within the synthetic evidence boundary**
- Corrective actions, owner, and due date: Keep these three response paths with the operations runbook; Higinio Jimenez Manzano owns customer review/sending and Codex supplies the redacted diagnostic and draft response. Re-run after a material billing, sync, Research-boundary, or support-process change and before public paid access if the operating model changes.
- Operator signature/name: Higinio Jimenez Manzano, recorded through owner direction to use the Codex-assisted support model
- Support-process master-plan gate: **Satisfied**

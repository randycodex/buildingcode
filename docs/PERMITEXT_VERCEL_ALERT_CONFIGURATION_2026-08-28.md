# Permitext Vercel alert configuration — August 28, 2026

## Result

The owner authorized no-cost operational alert configuration while retaining the existing Vercel Pro plan, $20 on-demand spend amount, automatic team Production pause, and no paid add-ons.

Two included Vercel alert rules are now active and scoped only to the `permitext-sync` project:

- `Permitext production 5xx anomalies` (`ar_01a048be-1b07-726d-bade-51add19672cc`) — built-in `error_anomaly`, filtered to 5xx responses;
- `Permitext production usage anomalies` (`ar_01a048be-20d4-774d-8361-8f6e1dbe3f07`) — built-in `usage_anomaly` across Permitext infrastructure metrics.

Both rules retain `autosubscribeOwnersInKnock: true`. The live **My Notifications** page shows email and web delivery checked for each rule. Push is unavailable because no device is subscribed. SMS remains unconfigured and has no phone number.

The source definitions are retained under `permitext-sync-server/ops/vercel-alert-rules/`. They contain no credentials or customer information and are not automatically applied by a deployment.

## Custom-alert boundary

Vercel rejected each attempted custom-threshold rule with:

> Your team has reached the limit of 0 custom alerts. Delete a custom alert to create another.

No custom alert existed to delete. No upgrade, add-on, Marketplace integration, webhook destination, Log Drain, or SMS subscription was created. The unapplied definitions retain the intended thresholds for:

- a production 5xx rate above 5% with at least 20 requests in five minutes;
- two `/health` 5xx responses in five minutes;
- any `/billing/` 4xx/5xx response in five minutes; and
- `/research/conversations/message` function-duration p95 above 45 seconds in one hour.

The included rules improve coverage but do not complete the full Beta monitoring gate. Vercel's built-in anomaly engine—not Permitext's exact desired counts—decides when these two live rules trigger. Warning-level structured events such as `stripe_invoice_payment_failed` and `research_spend_guardrail_rejection` still require a warning-aware Drain or monitoring endpoint for immediate delivery.

## Verification and boundaries

Provider verification used the authenticated Vercel CLI and the live dashboard:

```sh
npx --yes vercel@latest alerts rules ls --format json
npx --yes vercel@latest alerts rules inspect ar_01a048be-1b07-726d-bade-51add19672cc --format json
npx --yes vercel@latest alerts rules inspect ar_01a048be-20d4-774d-8361-8f6e1dbe3f07 --format json
```

The CLI list and both independent inspections returned the intended project scope, type/filter, and owner auto-subscription. The dashboard independently displayed both rules, and **My Notifications** displayed checked email and web subscriptions for each.

No alert was deliberately triggered, no notification delivery was exercised, no application was deployed, no environment variable was changed, no production application data was written, and no paid model or billing-provider call was made. `PERMITEXT_MONITORING_PROVIDER` remains unset until a real notification is safely delivered and observed.

## August 29 no-cost follow-up

A fresh authenticated dashboard and CLI review confirmed that both Permitext anomaly rules remain active, scoped to `permitext-sync`, and subscribed to the owner. The owner's personal web and email channels remain checked for each rule. The team-level 75% included-credit, Spend Management, and deployment-failure web/email notifications are also checked. Push remains unavailable because no device is subscribed.

The Vercel notification inbox contains the failed isolated recovery deployment, which verifies that the generic Vercel web-notification path can reach the owner. This is not evidence that either anomaly rule has triggered, and it does not independently prove email delivery. Vercel exposes no no-cost test-send control for these anomaly rules, so no synthetic alert was created.

The team has no Log Drain. Vercel currently documents Drains as metered at $0.50/GB with no included allowance, so no Drain or third-party endpoint was configured under the retained no-paid-monitoring boundary.

A permanent privacy-bounded log auditor now covers the remaining observable Production categories without printing raw messages or customer/provider identifiers. Its first live read-only 24-hour run parsed 10 Production log entries, observed a successful `/health` request, found no 5xx, billing endpoint failure, client/request/database error, failed invoice, Research spend rejection, Research conversation failure, or actionable p95 sample, and exited successfully. This small quiet-period sample verifies the audit path, not future event delivery or full traffic coverage. The live environment still does not contain `PERMITEXT_MONITORING_PROVIDER`.

Evidence and the exact operator command are retained in [PERMITEXT_PRODUCTION_MONITORING_AUDIT_EVIDENCE_2026-08-29.md](./PERMITEXT_PRODUCTION_MONITORING_AUDIT_EVIDENCE_2026-08-29.md) and the operations runbook.

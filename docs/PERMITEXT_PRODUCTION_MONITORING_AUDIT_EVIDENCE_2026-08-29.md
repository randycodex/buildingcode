# Permitext Production monitoring audit evidence — August 29, 2026

## Outcome

Permitext now has a permanent no-cost operator audit for the Production Vercel log stream. It converts Vercel JSON-lines logs into aggregate operational counts and refuses to emit raw messages, request identifiers, fingerprints, or customer/provider identifiers.

The audit covers observed:

- `/health` requests and failures;
- all Production 5xx responses;
- `/billing/` endpoint 4xx/5xx responses;
- structured `client_error` and `request_error` events, including best-effort database/storage classification;
- `stripe_invoice_payment_failed` warnings;
- `research_spend_guardrail_rejection` and `research_conversation_failure` events; and
- `dynamic_route_observation` duration p95 for Research conversations against the retained 45-second target.

This is periodic review coverage. It does not schedule a health request, deliver an immediate alert, or replace the two live Vercel anomaly rules.

## Live read-only result

The first live run used the authenticated Vercel CLI against `permitext-sync`, Production only, for the preceding 24 hours with a maximum of 1,000 entries. It parsed 10 valid Production entries and no invalid lines. One successful `/health` request was observed. There were no health failures, 5xx responses, billing endpoint failures, client/request/database errors, failed invoices, Research spend rejections, Research conversation failures, or Research duration samples. The audit reported zero actionable categories and exited `0`.

This was a small quiet-period sample. It proves that the log stream can be read and classified safely; it does not prove future anomaly delivery or absence of problems outside the sampled window.

An August 30 refresh parsed 12 valid Production entries with no invalid lines. It observed two successful `/health` requests, two structured dynamic-route observations, and zero health failures, server errors, billing endpoint failures, client/request/database errors, failed invoices, Research spend rejections, Research failures, or other actionable categories. No Research duration sample existed in that quiet window, so no live p95 latency claim is made. The strict command exited `0`.

An August 31 refresh returned no Production log entries in the preceding 24-hour window. The strict aggregate audit therefore exited `2`, correctly treating missing log-based health coverage as incomplete rather than declaring an outage or a clean monitored window. The required direct fallback request to `https://permitext.com/health` then returned HTTP 200 with `ok: true`, PostgreSQL storage, normalized-v4 schema, and serving commit `dbbb6ab40d40d1d3d947303aa45b01fbd9cebce3`. The serving release still reports external alerts unconfigured. This is healthy direct endpoint evidence for a quiet log window; it is not anomaly-specific delivery evidence and does not close the monitoring gate.

A September 2 refresh parsed 41 valid Production entries with no invalid lines. It observed two successful `/health` requests, no billing endpoint, client, structured request, Research, spend-guardrail, or recorded database-failure event, and no Research latency sample. It also found one actionable 503 at `2026-09-01T22:04:41.407Z`: a one-second `POST /sync/checkpoint` attempt failed closed while rate-limit enforcement reported PostgreSQL storage trouble. Privacy-safe narrowing emitted no request, account, deployment, trace, or provider identifier. A current direct `/health` request subsequently returned HTTP 200 with `ok: true`, PostgreSQL rate limiting and storage, normalized-v4 schema, and the same serving commit. No second matching 5xx appeared in the sampled window. This supports a bounded transient classification, not proof that the condition cannot recur; the actionable event remains recorded and the monitoring-delivery gate remains open.

A separate key-presence-only environment check confirmed that `PERMITEXT_MONITORING_PROVIDER` remains unset. No environment value was read or printed.

## Delivery and provider boundary

The live dashboard confirmed owner web/email subscriptions for both Permitext anomaly rules and for the relevant team usage/spend/deployment notifications. A failed isolated recovery deployment is present in Vercel's notification inbox, so generic Vercel web delivery is observed. Neither included anomaly rule has produced an event, and email receipt was not independently verified.

An August 30 rule-detail reinspection resolved a potentially confusing dashboard label. The list says `no destinations configured` because neither rule has an optional Slack/team destination. Inside both the `Permitext production 5xx anomalies` and `Permitext production usage anomalies` drawers, automatic Team Owner subscription is on and the owner's personal Web and Email checkboxes are checked. Both rules remain scoped to `permitext-sync`; the 5xx rule matches Error Anomaly `statusGroup eq '5xx'`, and the usage rule matches all Usage Anomaly events. Neither the live dashboard nor the current Vercel alert CLI documentation exposes a test-send command, so this reinspection does not fabricate anomaly-specific delivery evidence.

The official Vercel Alerts and Spend Management documentation was rechecked on August 31. Alerts still expose subscription destinations but no safe anomaly-rule test-send. Spend Management notifications and automatic pausing are tied to actual 50%, 75%, and 100% spend thresholds; lowering the amount below current spend can trigger configured actions, including pausing every Production project. Permitext therefore did not lower the `$20` amount, generate artificial metered usage, configure a webhook, or interrupt Production merely to manufacture acceptance evidence.

No Log Drain is configured. Vercel currently documents Log Drains as metered at $0.50/GB with no included allowance. No Drain, third-party monitoring endpoint, plan change, deployment, environment change, Production write, paid model call, or billing-provider call was made.

The Production build gate now treats this boundary as fail-closed. Its aggregate `deployment` result requires commercial configuration, live Stripe readiness, release identity, and `externalAlertsConfigured` to all pass. A missing `PERMITEXT_MONITORING_PROVIDER` is no longer a warning that still allows the build; it blocks Production readiness. The value must remain unset until the required delivery evidence or documented operating acceptance exists.

On August 30, the existing active Codex heartbeat `permitext-microsoft-rotation-30-days` was expanded into the **Permitext Annual Tax, Capacity, and Monitoring Guard**. At 9:00 AM America/New_York it runs this aggregate-only 24-hour audit when the local repository and authorized Vercel session are available. Clean runs remain quiet; actionable category counts trigger a notification without raw logs or identifiers. Missing log health coverage requires a direct public-health check before notification. The guard cannot deploy, pause Production, change provider configuration, upgrade a plan, buy credit, change a spending cap, or make a payment. This improves periodic detection but does not count as anomaly-specific external-delivery evidence.

Official provider references checked for this follow-up:

- [Vercel Notifications](https://vercel.com/docs/notifications)
- [Vercel Alerts](https://vercel.com/docs/alerts)
- [Vercel Drains](https://vercel.com/docs/drains)
- [Vercel Logs reference](https://vercel.com/docs/drains/reference/logs)

## Operator command

Run from the repository root at least daily and after every Production release or incident report:

```sh
npx --yes vercel@latest logs \
  --project permitext-sync \
  --environment production \
  --since 24h \
  --limit 1000 \
  --json \
  2>/dev/null \
  | node permitext-sync-server/scripts/audit-production-monitoring.mjs \
      --require-health \
      --fail-on-actionable
```

Exit codes:

- `0`: a health request was observed and no covered actionable category was present;
- `1`: covered actionable findings require review;
- `2`: no health request was observed, so verify `/health` directly and determine whether the sampling window was quiet;
- `3`: at least one input line was invalid JSON, so treat the audit as incomplete and repeat it.

Invalid input takes precedence over other exit states. The report remains aggregate-only even when the source contains sensitive strings; the permanent contract test inserts synthetic emails, credentials, fingerprints, subscription IDs, and user/operation identifiers and asserts that none appear in serialized output.

## Remaining gate

Before public paid Beta, retain an actual anomaly-specific delivered event or explicitly accept documented daily review for warning-level signals, and safely exercise the configured spend notification/automatic-pause behavior. Do not set `PERMITEXT_MONITORING_PROVIDER` merely because the audit or deploy guard exists; the guard intentionally remains red until that evidence is complete.

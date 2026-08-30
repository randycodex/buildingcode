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

A separate key-presence-only environment check confirmed that `PERMITEXT_MONITORING_PROVIDER` remains unset. No environment value was read or printed.

## Delivery and provider boundary

The live dashboard confirmed owner web/email subscriptions for both Permitext anomaly rules and for the relevant team usage/spend/deployment notifications. A failed isolated recovery deployment is present in Vercel's notification inbox, so generic Vercel web delivery is observed. Neither included anomaly rule has produced an event, and email receipt was not independently verified.

No Log Drain is configured. Vercel currently documents Log Drains as metered at $0.50/GB with no included allowance. No Drain, third-party monitoring endpoint, plan change, deployment, environment change, Production write, paid model call, or billing-provider call was made.

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

Before public paid Beta, retain an actual anomaly-specific delivered event or explicitly accept documented daily review for warning-level signals, and safely exercise the configured spend notification/automatic-pause behavior. Do not set `PERMITEXT_MONITORING_PROVIDER` merely because the audit exists.

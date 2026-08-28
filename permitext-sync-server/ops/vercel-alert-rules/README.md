# Permitext Vercel alert rules

These files are the source definitions for active and planned project-scoped Vercel alert rules for `permitext-sync` (`prj_6rWwwb50xxxKI7qu92HzzqB5nkYs`). They contain no credentials or customer information.

The following included rules were applied and live-verified on August 28, 2026:

- production 5xx error anomalies;
- production infrastructure-usage anomalies.

The following custom-threshold definitions were rejected by Vercel because the team currently has a limit of zero custom alerts. They remain unapplied planning records:

- a production 5xx rate above 5% with at least 20 requests in five minutes;
- two or more `/health` 5xx responses in five minutes;
- any 4xx/5xx response under `/billing/` in five minutes; and
- production `/research/conversations/message` function-duration p95 above 45 seconds in one hour.

The live included rules auto-subscribe Vercel owners. Personal web and email delivery were confirmed checked in **Team Settings → My Notifications**. SMS is deliberately not configured, and no paid add-on or plan change was made to obtain custom alerts.

These rules do not provide a synthetic health-check scheduler and cannot threshold structured warning text such as `stripe_invoice_payment_failed` or `research_spend_guardrail_rejection`. The default Vercel error rule covers error-level runtime logs, including redacted client reports and server/database failures. Warning-specific delivery still requires a Vercel Drain or another explicit monitoring endpoint.

List the live project-scoped rules without changing provider state:

```sh
npx --yes vercel@latest alerts rules ls --format json
```

The checked-in definitions are not applied automatically by a deployment. Provider changes must remain an explicit operator action and must be verified against the live rule list. A delivered notification has not yet been exercised, so `PERMITEXT_MONITORING_PROVIDER` must remain unset.

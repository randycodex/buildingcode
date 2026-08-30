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

Until a paid Drain or another external destination is separately approved, perform the no-cost bounded runtime-log audit from the repository root:

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

The audit consumes Vercel's JSON-lines output and emits aggregate counts only. It never prints raw log messages, request identifiers, customer identifiers, fingerprints, or provider identifiers. It covers observed health failures, all 5xx responses, billing endpoint 4xx/5xx responses, redacted client and server errors, database-failure signals, Stripe failed-invoice warnings, Research spend rejections, Research conversation failures, and the observed Research-duration p95. Exit status `1` means actionable findings, `2` means the window contained no health request, and `3` means an input line was not valid JSON. Invalid input takes precedence so a malformed or partial log stream cannot be mistaken for a complete review. This is a review fallback, not immediate external delivery.

List the live project-scoped rules without changing provider state:

```sh
npx --yes vercel@latest alerts rules ls --format json
```

The checked-in definitions are not applied automatically by a deployment. Provider changes must remain an explicit operator action and must be verified against the live rule list. Generic Vercel web delivery has been observed for an isolated deployment failure, but neither included anomaly rule has produced a delivered event and email delivery has not been independently observed. `PERMITEXT_MONITORING_PROVIDER` must therefore remain unset.

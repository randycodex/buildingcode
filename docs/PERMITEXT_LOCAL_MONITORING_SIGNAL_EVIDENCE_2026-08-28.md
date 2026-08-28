# Permitext local monitoring-signal evidence — August 28, 2026

## Result

Permitext's permanent operations suite now exercises the real local HTTP server and observes all of the following structured signals:

- a browser client error with email, bearer-token, provider-key, query-value, and URL-query redaction;
- a successful dynamic request classified as slow at the configured `PERMITEXT_SLOW_REQUEST_MS` threshold;
- a signed synthetic Stripe `invoice.payment_failed` lifecycle warning;
- a Research spend-guardrail rejection before any provider request;
- a sanitized unexpected server error; and
- the matching error-severity observation for a dynamic 5xx response.

The exercise reports:

```json
{"result":"permitext local monitoring signal rehearsal passed","signals":["redacted_client_error","custom_threshold_slow_request","billing_lifecycle_warning","research_spend_guardrail_rejection","sanitized_server_error","5xx_route_observation"],"paidProviderCalls":0,"productionWrites":0,"externalAlertsDelivered":0}
```

## Defect found and retained

The request wrapper already used `PERMITEXT_SLOW_REQUEST_MS` to decide whether to emit an observation, but the observation classified latency severity against a separate hard-coded 2,000 ms threshold. A request above a configured lower threshold could therefore be logged as `info` instead of `warning`.

The event classifier now uses the same configured threshold as the request wrapper. Unit coverage retains both the above-threshold warning and below-threshold informational cases.

Research spend-cap responses now emit a dedicated `research_spend_guardrail_rejection` event. User and operation identifiers are one-way hashed, the reason is redacted, and the event carries release, Git, and environment identity. Both Research conversation turns and Code Question analysis use the same event contract.

## Exercise isolation

The test uses temporary local JSON storage, loopback-only servers, synthetic account data, a synthetic signed Stripe event, and deliberately invalid temporary storage for the 5xx path. It explicitly clears database, Blob, OpenAI, and live Stripe configuration. The Research guardrail rejects the request before any model call.

The test does not:

- contact Stripe, Apple, OpenAI, Neon, Blob, Vercel, or any monitoring provider;
- create a charge or subscription;
- write production data;
- configure a Vercel Log Drain, alert rule, spend notification, or hard stop;
- set `PERMITEXT_MONITORING_PROVIDER`; or
- prove that an external notification reaches the named operator.

## Commands

From `permitext-sync-server`:

```sh
node --check tests/monitoring-signals-local-e2e.mjs
node tests/operational-readiness-contract.mjs
node tests/monitoring-signals-local-e2e.mjs
npm run test:operations
```

The local rehearsal closes the source-to-structured-log verification gap. Public Beta 1 still requires a commercially appropriate Vercel plan, configured external alerts, a delivered test notification, spend notifications/hard-stop testing, and recorded operator ownership before `PERMITEXT_MONITORING_PROVIDER` can truthfully be set.

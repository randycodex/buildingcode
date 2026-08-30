# Permitext Beta 1 operations runbook

This runbook defines the minimum operating loop for a public Beta 1. It separates code that is present from production monitoring that still has to be configured and exercised.

## User-visible diagnostics and support

- Named support and alert owner: Higinio Jimenez Manzano (`permitext@gmail.com`).
- Web Settings exposes **Send feedback / Report a problem** and inserts the serving release ID into the email.
- iOS Settings exposes the same path and inserts the app version and build.
- Web Settings displays the release ID. `GET /release` and `GET /health` expose the full serving Git commit. A Production build now fails unless Vercel supplies `VERCEL_GIT_COMMIT_SHA` or `PERMITEXT_GIT_COMMIT` contains the exact intended SHA.
- Beta 1 support target: acknowledge account, billing, data-loss, and access reports within one business day; acknowledge other reports within two business days. This is an operating target, not a contractual service-level agreement.
- Do not request passwords, session tokens, provider receipts, or full database records by email.

Use the same operating loop for every report: acknowledge and set the next update time; collect platform, release/build, approximate time, expected behavior, and the minimum account identifier; classify scope and severity; use read-only Permitext/provider evidence first; contain a systemic failure before attempting repair; verify recovery; and record the customer update and next owner. An email assertion alone never authorizes an entitlement grant, refund, destructive data action, or official code interpretation.

Before public Beta, complete the three synthetic scenarios in [BETA1_SUPPORT_TABLETOP_RECORD.md](./BETA1_SUPPORT_TABLETOP_RECORD.md). The document contract is automated, but only a timed operator-run record can confirm the process is operable.

## Monitoring baseline

Permitext emits structured Vercel runtime events for:

- dynamic routes taking at least 2,000 ms by default (configurable with `PERMITEXT_SLOW_REQUEST_MS`);
- every dynamic route returning a 5xx status;
- browser errors, unhandled promise rejections, and startup failures sent to `POST /client-errors/report`;
- billing lifecycle warnings and provider-event failures;
- Research spending guardrail rejections.

Client reports remove email addresses, bearer credentials, sensitive query values, and URL query strings before logging. They contain a stable fingerprint, release ID, route, source path, and line/column where available.

The no-provider end-to-end rehearsal in [PERMITEXT_LOCAL_MONITORING_SIGNAL_EVIDENCE_2026-08-28.md](./PERMITEXT_LOCAL_MONITORING_SIGNAL_EVIDENCE_2026-08-28.md) proves these structured events through the local HTTP server, including configured-threshold latency classification and a deliberate 5xx. The privacy-bounded live-log review in [PERMITEXT_PRODUCTION_MONITORING_AUDIT_EVIDENCE_2026-08-29.md](./PERMITEXT_PRODUCTION_MONITORING_AUDIT_EVIDENCE_2026-08-29.md) then checks observed Production health, errors, billing, database, Research spend, and p95 signals without emitting raw log or customer/provider identifiers. Neither is immediate external delivery, so anomaly-specific delivery remains an open production-alert gate.

`GET /health` reports whether release identity and an external monitoring provider are marked configured. Before public access, configure one of these production paths:

1. Vercel Observability alerts and daily runtime-log review; or
2. a Vercel Log Drain or error-monitoring integration with alert delivery.

After the alert path has actually delivered a test notification, set `PERMITEXT_MONITORING_PROVIDER` to the configured provider name. The environment value is evidence of the completed dashboard step, not a substitute for it.

Minimum alerts:

- any sustained 5xx response rate or three matching client-error fingerprints in 15 minutes;
- health check failure for two consecutive checks;
- Stripe or Apple webhook 4xx/5xx responses;
- Research daily spend at 80% of the cap and any guardrail rejection at 100%;
- database connection failures, rate-limit storage failures, or p95 Research latency above the accepted Beta target.

The alert destination and named on-call owner must be recorded before opening the beta. Live Vercel integration changes require explicit operator authorization.

On August 28, 2026, the owner authorized and live-verified two included, Permitext-scoped Vercel rules: production 5xx anomalies and infrastructure-usage anomalies. Owner email and web subscriptions are checked; SMS remains off. Custom thresholds for health, billing, 5xx rate, and Research p95 were not applied because Vercel reported a current limit of zero custom alerts. No paid add-on was enabled. Full evidence and retained threshold definitions are in [PERMITEXT_VERCEL_ALERT_CONFIGURATION_2026-08-28.md](./PERMITEXT_VERCEL_ALERT_CONFIGURATION_2026-08-28.md).

Until immediate warning-level delivery is separately approved, run this bounded review from the repository root at least daily and after every Production release or incident report:

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

Exit `0` means the parsed window contained a health request and no covered actionable category; `1` means covered findings require review; `2` means no health request was observed and the operator must verify `/health`; `3` means invalid/partial JSON input and the run must be repeated. A clean result is bounded to the sampled log window and is never proof that future delivery works.

## Hosting plan and spend control

- Public commercial Beta 1 must not run on Vercel Hobby. The owner upgraded the Permitext team to Vercel Pro on August 28, 2026 after personally approving and submitting the purchase.
- The live plan has a fixed $20 monthly platform fee with $20 of included infrastructure credit. The billing cycle is August 28–September 28, 2026.
- The owner selected **$20 of on-demand infrastructure spend beyond the included Pro credit per billing cycle**. Web/email spend notifications and automatic Production pause at 100% are on; SMS remains off. Vercel evaluates the threshold periodically, so treat approximately $40 plus tax and a possible small metering overrun—not an exact $40 ceiling—as the initial total monthly hosting exposure.
- The Vercel platform fee, seats, integrations, and add-ons are outside that on-demand spend amount. Record them separately in the monthly operating-cost review.
- A hard pause limits cost but produces a public 503. The incident checklist must include a deliberate resume decision and confirmation that the root cause is contained before unpausing.
- The August 29 [backend provider capacity audit](./PERMITEXT_BACKEND_PROVIDER_CAPACITY_AUDIT_2026-08-29.md) found no additional upgrade required today. Review Neon Free capacity/recovery and the OpenAI credit/spend controls before the first paid public customer; all plan, recharge, add-on, and limit increases still require explicit owner approval.

Use [BETA1_SPEND_CONTROL_ACCEPTANCE_RECORD.md](./BETA1_SPEND_CONTROL_ACCEPTANCE_RECORD.md) for the remaining notification and pause exercise. The record separates three claims that must not be conflated: a delivered threshold notification, a verified 503-and-resume drill, and proof that the configured Spend Management threshold automatically caused the pause. Do not manufacture on-demand usage or lower the team spend amount merely to make the gate pass. Vercel states that lowering the amount below current spend can immediately trigger configured actions, its spend check runs every few minutes, and every paused project must be resumed individually.

## Identity credential rotation

- Owner: Higinio Jimenez Manzano (`permitext@gmail.com`).
- The active Microsoft OAuth client secret for **Permitext Clerk Production** expires on **February 17, 2027**.
- Operator reminders are active in the Codex heartbeat **Permitext Microsoft OAuth rotation reminders** (`permitext-microsoft-rotation-30-days`) for January 18, February 3, and February 10, 2027 at 9:00 AM in the local automation time zone. Treat the 30-day reminder as the rotation deadline, not the expiration date.
- Rotate by creating a replacement secret in the Permitext Microsoft Entra directory, updating Clerk production, and verifying a complete Microsoft sign-in before deleting or allowing the prior secret to expire.
- The active Sign in with Apple key is **Permitext Clerk Production**, Key ID `X2UVYL4XC7`, under Team ID `57BY95X97H` and Services ID `com.randycodex.permitext.web`. Apple keys do not expire automatically; rotate immediately if exposure or unauthorized access is suspected.
- Apple Private Email Relay has the SPF-verified source `bounces+113080807@clkmail.permitext.com`. Reverify it in Apple after changing Clerk email delivery or the `clkmail.permitext.com` DNS configuration.
- Rotate Apple credentials by creating a replacement Sign in with Apple key, updating Clerk production, verifying web and physical-device Apple sign-in, and only then revoking the prior Apple key. The one-time `.p8` download must not remain on operator storage after Clerk accepts it.
- Never place an OAuth client secret or private key in source control, local documentation, support email, screenshots, or incident records. Record only the credential identifier, creation/expiration dates, operator, and verification result.
- Recheck Google, Microsoft, Apple, and passwordless email sign-in after any Clerk production identity change.

## Release and rollback checklist

For each production release, record the branch, Git commit, Vercel deployment URL, release ID from `/release`, iOS version/build when applicable, operator, and timestamp.

1. Run the local server checks and iOS Release build.
2. Run `npm run verify:beta1-readiness` with production configuration.
3. Do not use a Vercel Preview as an isolated account or billing test while Preview shares the Production database. Use a truly isolated database/provider configuration or a controlled Production exercise.
4. Verify `/health`, `/release`, sign-in, one read-only code path, and one authenticated sync read.
5. Confirm the deployment build log passed both commercial readiness and production release-identity readiness. A missing Git SHA must block promotion.
6. Promote only the verified deployment.
7. Confirm the production `/release` commit exactly matches the intended Git commit.
8. Scan runtime errors and the client-error stream after promotion.
9. If a regression affects account access, billing, data integrity, or Research boundaries, stop new Research with `PERMITEXT_RESEARCH_KILL_SWITCH=1` when relevant and use Vercel Instant Rollback to route traffic to the last verified immutable deployment.
10. Re-run `/health`, `/release`, sign-in, and entitlement reads after rollback; record the incident and affected window. Do not delete the bad deployment while incident evidence or rollback access may still be needed.

## Backup and restore drill

A provider saying that backups exist is not a successful restore drill. Before public Beta 1 and at least once per quarter:

1. Record the source Neon branch, point-in-time or snapshot identifier, history-retention window, and Blob storage inventory timestamp.
2. Use Neon restore preview/multi-step restore to create an isolated branch first. Do not finalize a restore onto the active production branch during a drill.
3. Point a non-production deployment at the isolated restore.
4. Use the admin restore checklist and storage summary to compare account, entitlement, Project, saved-item, Research, Notebook, and Report counts.
5. Verify one test account with representative synced records and one private asset from each used asset class.
6. Confirm the exercise cannot write to production providers, webhooks, email, or billing.
7. Record recovery-point age, elapsed recovery time, missing/corrupt records, operator, and cleanup.
8. Delete the isolated restore only after evidence is retained and the exact branch, compute, deployment, and private asset namespace are verified. Production restore or deletion requires separate explicit approval.

After the source inventory and isolated deployment are available, run the read-only comparison tool. It refuses the same source/target origin, a target reporting `production`, missing isolation/provider-write attestations, non-HTTPS remote origins, count drift, representative-account drift, and missing private-asset inventory counts. It does not create, finalize, or delete a Neon restore and never writes to billing or customer data.

```sh
PERMITEXT_RESTORE_SOURCE_URL="https://<source-host>" \
PERMITEXT_RESTORE_TARGET_URL="https://<isolated-restore-host>" \
PERMITEXT_RESTORE_SOURCE_ADMIN_TOKEN="<source-admin-token>" \
PERMITEXT_RESTORE_TARGET_ADMIN_TOKEN="<target-admin-token>" \
PERMITEXT_RESTORE_TEST_USER_ID="<representative-test-user-id>" \
PERMITEXT_RESTORE_TARGET_ISOLATED=1 \
PERMITEXT_RESTORE_PROVIDER_WRITES_DISABLED=1 \
PERMITEXT_RESTORE_SOURCE_ASSET_COUNT="<source-private-asset-count>" \
PERMITEXT_RESTORE_TARGET_ASSET_COUNT="<restored-private-asset-count>" \
PERMITEXT_RESTORE_SOURCE_ASSET_INVENTORY_TIMESTAMP="<UTC-timestamp>" \
npm run verify:restore-drill
```

The verifier compares durable storage-summary counts, the sync cursor, provider-neutral entitlement state, Project/saved-item mutation counts, Research conversations and answers, Notebook/Report artifact counts, project links, and activity for the representative account. It deliberately excludes active session counts because restore acceptance requires a fresh sign-in instead of trusting a restored session. Retrieve representative private assets separately through authenticated endpoints and record the result below.

The verifier's local end-to-end rehearsal and evidence boundary are recorded in [PERMITEXT_LOCAL_RESTORE_REHEARSAL_EVIDENCE_2026-08-28.md](./PERMITEXT_LOCAL_RESTORE_REHEARSAL_EVIDENCE_2026-08-28.md). The rehearsal does not satisfy the provider-backed restore gate.

The first provider-backed Neon/Blob restore acceptance passed on August 29, 2026. Repeat the exercise at least quarterly and after a material storage migration.

Use `docs/BETA1_RESTORE_DRILL_RECORD.md` to record the first exercise. Neon history retention and Vercel deployment retention must be checked in the live dashboards because plan limits can change.

On August 28–29, 2026, the owner-authorized provider exercise created and verified a point-in-time Neon child branch, matched 38 Permitext tables and 3,611 rows by content digest, and inventoried/retrieved all used private Blob asset classes. The follow-up acceptance deployed the exact serving Production commit only as an SSO-protected Preview against a fresh isolated Neon restore and separately copied all 124 private Blob objects / 5,248,939 bytes into an isolated namespace. Health, release, aggregate, representative-account, and byte-for-byte Blob checks passed; provider writes and Production resources remained untouched. Evidence: [PERMITEXT_NEON_BLOB_RESTORE_DRILL_EVIDENCE_2026-08-28.md](./PERMITEXT_NEON_BLOB_RESTORE_DRILL_EVIDENCE_2026-08-28.md).

## Incident record

Each incident record should include:

- detection time, release ID, Git commit, and deployment URL;
- affected functions and estimated users;
- whether account, entitlement, saved work, or authoritative source integrity was at risk;
- containment and rollback actions;
- provider event IDs with secrets and personal data redacted;
- recovery verification and user communication;
- root cause, corrective action, owner, and due date.

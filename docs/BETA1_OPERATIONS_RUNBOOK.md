# Permitext Beta 1 operations runbook

This runbook defines the minimum operating loop for a public Beta 1. It separates code that is present from production monitoring that still has to be configured and exercised.

## User-visible diagnostics and support

- Named support and alert owner: Higinio Jimenez Manzano (`permitext@gmail.com`).
- Web Settings exposes **Send feedback / Report a problem** and inserts the serving release ID into the email.
- iOS Settings exposes the same path and inserts the app version and build.
- Web Settings displays the release ID. `GET /release` and `GET /health` expose the full serving Git commit. A Production build now fails unless Vercel supplies `VERCEL_GIT_COMMIT_SHA` or `PERMITEXT_GIT_COMMIT` contains the exact intended SHA.
- Beta 1 support target: acknowledge account, billing, data-loss, and access reports within one business day; acknowledge other reports within two business days. This is an operating target, not a contractual service-level agreement.
- Do not request passwords, session tokens, provider receipts, or full database records by email.

## Monitoring baseline

Permitext emits structured Vercel runtime events for:

- dynamic routes taking at least 2,000 ms by default (configurable with `PERMITEXT_SLOW_REQUEST_MS`);
- every dynamic route returning a 5xx status;
- browser errors, unhandled promise rejections, and startup failures sent to `POST /client-errors/report`;
- billing lifecycle warnings and provider-event failures;
- Research spending guardrail rejections.

Client reports remove email addresses, bearer credentials, sensitive query values, and URL query strings before logging. They contain a stable fingerprint, release ID, route, source path, and line/column where available.

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

## Hosting plan and spend control

- Public commercial Beta 1 must not run on Vercel Hobby. Vercel reserves Hobby for personal, non-commercial use and may pause a Hobby team after it exceeds included usage.
- On 2026-08-21 the Permitext dashboard reported **7h 8m Fluid Active CPU used against the 4h Hobby allowance**. Treat the current Hobby plan and exceeded-usage state as a launch blocker.
- Upgrade the Permitext team to Vercel Pro before accepting public customers. The operator must approve the paid plan immediately before the upgrade.
- After upgrading, replace Vercel's default on-demand budget with a Beta-specific amount. Initial recommendation: **$25 of on-demand infrastructure spend per billing cycle**, with web/email alerts at 50%, 75%, and 100% and automatic Production pause at 100%.
- The Vercel platform fee, seats, integrations, and add-ons are outside that on-demand spend amount. Record them separately in the monthly operating-cost review.
- A hard pause limits cost but produces a public 503. The incident checklist must include a deliberate resume decision and confirmation that the root cause is contained before unpausing.

## Identity credential rotation

- Owner: Higinio Jimenez Manzano (`permitext@gmail.com`).
- The active Microsoft OAuth client secret for **Permitext Clerk Production** expires on **February 17, 2027**.
- Create operator reminders for 30, 14, and 7 days before expiration. Treat the 30-day reminder as the rotation deadline, not the expiration date.
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

The public beta remains blocked until the first restore drill succeeds or a documented product decision explicitly accepts the data-recovery risk.

Use `docs/BETA1_RESTORE_DRILL_RECORD.md` to record the first exercise. Neon history retention and Vercel deployment retention must be checked in the live dashboards because plan limits can change.

## Incident record

Each incident record should include:

- detection time, release ID, Git commit, and deployment URL;
- affected functions and estimated users;
- whether account, entitlement, saved work, or authoritative source integrity was at risk;
- containment and rollback actions;
- provider event IDs with secrets and personal data redacted;
- recovery verification and user communication;
- root cause, corrective action, owner, and due date.

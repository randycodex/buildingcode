# Permitext Beta 1 operations runbook

This runbook defines the minimum operating loop for a public Beta 1. It separates code that is present from production monitoring that still has to be configured and exercised.

## User-visible diagnostics and support

- Web Settings exposes **Send feedback / Report a problem** and inserts the serving release ID into the email.
- iOS Settings exposes the same path and inserts the app version and build.
- Web Settings displays the release ID. `GET /release` and `GET /health` expose the full serving Git commit when Vercel supplies `VERCEL_GIT_COMMIT_SHA`.
- Beta 1 support target: acknowledge account, billing, data-loss, and access reports within one business day; acknowledge other reports within two business days. This is an operating target, not a contractual service-level agreement.
- Do not request passwords, session tokens, provider receipts, or full database records by email.

## Monitoring baseline

Permitext emits structured Vercel runtime events for:

- dynamic routes taking at least 250 ms;
- every dynamic route returning a 5xx status;
- browser errors, unhandled promise rejections, and startup failures sent to `POST /client-errors/report`;
- billing lifecycle warnings and provider-event failures;
- Research spending guardrail rejections.

Client reports remove email addresses, bearer credentials, sensitive query values, and URL query strings before logging. They contain a stable fingerprint, release ID, route, source path, and line/column where available.

Before public access, configure one of these production paths:

1. Vercel runtime-log alerts and daily review; or
2. a Vercel Log Drain or error-monitoring integration with alert delivery.

Minimum alerts:

- any sustained 5xx response rate or three matching client-error fingerprints in 15 minutes;
- health check failure for two consecutive checks;
- Stripe or Apple webhook 4xx/5xx responses;
- Research daily spend at 80% of the cap and any guardrail rejection at 100%;
- database connection failures, rate-limit storage failures, or p95 Research latency above the accepted Beta target.

The alert destination and named on-call owner must be recorded before opening the beta. Live Vercel integration changes require explicit operator authorization.

## Release and rollback checklist

For each production release, record the branch, Git commit, Vercel deployment URL, release ID from `/release`, iOS version/build when applicable, operator, and timestamp.

1. Run the local server checks and iOS Release build.
2. Run `npm run verify:beta1-readiness` with production configuration.
3. Deploy without promoting when a preview exercise is sufficient.
4. Verify `/health`, `/release`, sign-in, one read-only code path, and one authenticated sync read.
5. Promote only the verified deployment.
6. Confirm the production `/release` commit exactly matches the intended Git commit.
7. Scan runtime errors and the client-error stream after promotion.
8. If a regression affects account access, billing, data integrity, or Research boundaries, stop new Research with `PERMITEXT_RESEARCH_KILL_SWITCH=1` when relevant and roll production back to the last verified deployment.
9. Re-run `/health`, `/release`, sign-in, and entitlement reads after rollback; record the incident and affected window.

## Backup and restore drill

A provider saying that backups exist is not a successful restore drill. Before public Beta 1 and at least once per quarter:

1. Record the source database snapshot/backup identifier and Blob storage inventory timestamp.
2. Restore into an isolated non-production database and private asset namespace.
3. Point a non-production deployment at the isolated restore.
4. Use the admin restore checklist and storage summary to compare account, entitlement, Project, saved-item, Research, Notebook, and Report counts.
5. Verify one test account with representative synced records and one private asset from each used asset class.
6. Confirm the exercise cannot write to production providers, webhooks, email, or billing.
7. Record recovery-point age, elapsed recovery time, missing/corrupt records, operator, and cleanup.
8. Delete the isolated restore only after evidence is retained and the exact targets are verified.

The public beta remains blocked until the first restore drill succeeds or a documented product decision explicitly accepts the data-recovery risk.

## Incident record

Each incident record should include:

- detection time, release ID, Git commit, and deployment URL;
- affected functions and estimated users;
- whether account, entitlement, saved work, or authoritative source integrity was at risk;
- containment and rollback actions;
- provider event IDs with secrets and personal data redacted;
- recovery verification and user communication;
- root cause, corrective action, owner, and due date.

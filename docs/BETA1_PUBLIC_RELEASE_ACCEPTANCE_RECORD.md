# Permitext Beta 1 public-release acceptance record

Overall status: **OPEN — not authorized for public paid Beta**

This is the human evidence record for `BETA1_PUBLIC_RELEASE_GATE_RECORD.json`. It does not authorize a merge, push, deployment, charge, refund, account deletion, provider configuration change, Production pause, purchase, or public release. Each destructive, paid, provider-side, or release action still requires the owner's explicit authorization immediately before execution.

## Recording rules

- Record the exact full 40-character Git commit, release ID, deployment URL, operator, and UTC timestamp for every release-bound section.
- Use ISO 8601 timestamps with `Z` or an explicit numeric offset.
- Retain only redacted screenshots, counts, hashes, provider event references, and outcomes. Never paste or commit passwords, verification codes, session/admin tokens, API/OAuth secrets, `.p8` contents, full payment-card data, raw account exports, personal addresses, customer content, or private provider payloads.
- A checked source test, configured dashboard, or written plan is not evidence that a manual Production exercise passed.
- Do not change a section to **COMPLETE** or set its JSON `complete` field to `true` while any required item is missing, failed, performed against a different commit, or supported only indirectly.
- If a partial or contradictory result appears, leave the gate open, preserve the redacted evidence, and follow the incident/support runbook before retrying.

## Selected release

- Expected Git commit:
- Branch:
- Production deployment URL:
- Release ID:
- iOS version/build:
- Operator:
- Selection timestamp:

Do not populate `expectedGitCommit` in the JSON gate record until this exact commit is selected for both Production web/backend and the final TestFlight build.

Interim no-input evidence: [PERMITEXT_RESEARCH_COMMERCIALIZATION_BRANCH_INTEGRITY_AUDIT_2026-08-30.md](./PERMITEXT_RESEARCH_COMMERCIALIZATION_BRANCH_INTEGRITY_AUDIT_2026-08-30.md). That checkpoint covers the requested 70-commit implementation range but does not select a release commit, close the final semantic full-diff review, or satisfy any manual/Production gate below.

## Production deployment

Gate ID: `production-deployment`
Status: **OPEN**
Release-bound: **yes**

- Production build log passed commercial configuration, live Stripe, release identity, and external-monitoring checks:
- Production `/health` passed:
- Production `/release` returned the selected full Git commit:
- Canonical Production domain serves that deployment:
- No unexpected migration, runtime, billing-webhook, or client error appeared after deployment:
- Redacted evidence and timestamp:

This is deployment evidence only. It does not prove the later manual activation gates.

## Controlled Production billing

Gate ID: `controlled-production-billing`
Status: **OPEN**
Release-bound: **yes**

Run only under separate immediate authorization. Use a dedicated disposable account and the exact serving release. Do not record card data, a raw receipt, an email address, or unredacted customer/provider identifiers.

- Explicit charge/refund authorization and timestamp:
- Dedicated test-account opaque hash:
- Signed provider event granted Pro exactly once:
- Duplicate/delayed event remained inert:
- Cancellation preserved only the intended prepaid period:
- Authorized refund completed and removed the intended entitlement:
- Stripe subscription/customer cleanup confirmed:
- Permitext entitlement and provider state reconciled:
- Redacted event references, amounts, timestamps, and cleanup evidence:

## Production authentication and account lifecycle

Gate ID: `production-auth-account-lifecycle`
Status: **OPEN**
Release-bound: **yes**

- Fresh-account email-code sign-in:
- Fresh-account Apple sign-in:
- Fresh-account Google sign-in:
- Fresh-account Microsoft sign-in:
- Existing-account email-code sign-in retained the correct Permitext account/data:
- Existing-account Apple sign-in retained the correct Permitext account/data:
- Existing-account Google sign-in retained the correct Permitext account/data:
- Existing-account Microsoft sign-in retained the correct Permitext account/data:
- Dedicated disposable-account pre-deletion export and aggregate baseline captured safely:
- Customer-interface deletion reported every applicable billing, data, private-asset, device, and Clerk stage accurately:
- Deleted session failed, private asset disappeared, and recreated identity returned an empty Free account:
- Disposable account and test content cleanup completed under separate authorization:
- Redacted evidence and timestamp:

Follow [the detailed account export/deletion checklist](./BETA1_BILLING_IDENTITY_RUNBOOK.md#production-account-exportdeletion-acceptance). Never use the owner's primary, administrator, Lifetime Pro, or real customer account.

## Exact policy publication

Gate ID: `exact-policy-publication`
Status: **OPEN**
Release-bound: **yes**

- Strict live publication audit returned `publicationReady: true` for Terms, Privacy, and Subscription/Refund policy:
- Live document SHA-256 hashes equal the approved manifest:
- Production version identifiers equal the approved current versions:
- Web purchase consent displays and records those exact versions:
- iOS purchase consent displays and records those exact versions:
- Retainable post-purchase acknowledgment matches the selected release:
- Canonical URLs are direct HTTPS 200 responses without redirect or fallback bytes:
- Redacted evidence and timestamp:

Read-only Production environment-key evidence: [PERMITEXT_BETA1_PRODUCTION_CONFIGURATION_PREFLIGHT_2026-08-30.md](./PERMITEXT_BETA1_PRODUCTION_CONFIGURATION_PREFLIGHT_2026-08-30.md). Key presence is not value verification; the three policy-version and two Stripe-tax activation keys remain absent.

Do not mark this complete from route availability alone; the exact published bytes must match.

## New York Certificate and Stripe tax

Gate ID: `new-york-certificate-stripe-tax`
Status: **OPEN**
Release-bound: **no**

- New York Certificate of Authority received:
- Certificate saved and printed/displayed as required:
- Registration effective date and assigned filing frequency recorded:
- No taxable New York sale accepted before authorization:
- Stripe customer-location and billing-address behavior reviewed:
- Stripe automatic/manual tax decision and inclusive/exclusive behavior recorded:
- Source guard confirmed: Production Checkout rejects an unconfigured tax mode, configured automatic mode requests Stripe automatic tax and a billing address, and live readiness verifies the resolved Price tax behavior:
- Stripe Product tax code and active provider registration reviewed after the Certificate arrives:
- Apple tax-handling boundary recorded separately: [BETA1_APPLE_TAX_HANDLING_RECORD.md](./BETA1_APPLE_TAX_HANDLING_RECORD.md). Stripe automatic tax is web-only; live Apple app/subscription category verification and first real financial-report evidence remain open.
- First sales-tax filing deadline and persistent reminder verified:
- Redacted evidence and timestamp:

Read-only Production environment-key evidence: [PERMITEXT_BETA1_PRODUCTION_CONFIGURATION_PREFLIGHT_2026-08-30.md](./PERMITEXT_BETA1_PRODUCTION_CONFIGURATION_PREFLIGHT_2026-08-30.md). The two Stripe-tax activation keys remain absent; no provider field was changed.

Do not include the taxpayer identification number, residential address, or certificate image in source control.

## Monitoring delivery

Gate ID: `monitoring-delivery`
Status: **OPEN**
Release-bound: **yes**

- Production health-failure detection:
- Production 5xx/client-error delivery:
- Stripe/Apple billing-webhook failure delivery:
- Database/storage failure delivery:
- Research spend rejection delivery:
- Research p95 latency delivery or accepted bounded daily alternative:
- Named owner received the actual configured notification:
- `PERMITEXT_MONITORING_PROVIDER` matches retained delivery evidence:
- Privacy-bounded Production log audit passed after the exercise:
- Redacted evidence and timestamp:

Dashboard configuration and generic notification delivery alone do not prove each missing category.

## Spend notification and hard stop

Gate ID: `spend-notification-hard-stop`
Status: **OPEN**
Release-bound: **no**

- Detailed record: [BETA1_SPEND_CONTROL_ACCEPTANCE_RECORD.md](./BETA1_SPEND_CONTROL_ACCEPTANCE_RECORD.md)
- Delivered Spend Management web/email notification accepted:
- Isolated `503 DEPLOYMENT_PAUSED` and individual resume accepted:
- Automatic-threshold linkage result accepted or explicitly left open by owner decision:
- No uncontrolled on-demand usage or unrelated project/customer impact:
- Redacted evidence and timestamp:

Do not spend or lower the team budget merely to force this gate.

## Production web, TestFlight, and physical iPhone

Gate ID: `production-web-testflight-iphone`
Status: **OPEN**
Release-bound: **yes**

- Production web release ID and Git commit match the selected release:
- Final iOS archive was built from the selected release commit:
- App Store Connect processed the intended build:
- Physical-iPhone authentication passed:
- Account/sync and representative saved Project continuity passed:
- Free and Pro entitlement presentation passed:
- Restore/cancellation/refund state presentation passed as applicable:
- One separately authorized complete Production Research turn preserved the shared web/iOS response contract:
- Account-deletion presentation and recovery boundaries passed:
- No TestFlight staging URL, Sandbox entitlement, or mismatched commit remained:
- Redacted evidence and timestamp:

Source, Simulator, archive-upload, and TestFlight-processing evidence do not substitute for the final physical-device workflow.

## Owner go/no-go

Gate ID: `owner-go-no-go`
Status: **OPEN**
Release-bound: **yes**

This section can become complete only after every preceding gate is complete for the same selected commit and the machine audit reports no other open gate.

- All preceding evidence reviewed:
- Additional paid Research turns confirmed disabled:
- Remaining Beta risks and operating limits reviewed:
- Tax filing, bookkeeping, provider-capacity, credential-rotation, and daily monitoring guards active:
- Owner decision: GO / NO-GO
- Owner name:
- Decision timestamp:
- Exact Git commit authorized:
- Evidence reference:

A **GO** decision authorizes only the specifically recorded release action. It does not authorize future pricing, spending, provider upgrades, additional-turn sales, or destructive operations.

## Current result

- Machine activation audit: **RED / not ready**
- Public paid Beta authorized: **no**
- Next permitted action without new authorization: read-only/local verification only

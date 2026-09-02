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

Interim no-input evidence: [PERMITEXT_RESEARCH_COMMERCIALIZATION_BRANCH_INTEGRITY_AUDIT_2026-08-30.md](./PERMITEXT_RESEARCH_COMMERCIALIZATION_BRANCH_INTEGRITY_AUDIT_2026-08-30.md) and [PERMITEXT_RESEARCH_COMMERCIALIZATION_SEMANTIC_REVIEW_2026-08-30.md](./PERMITEXT_RESEARCH_COMMERCIALIZATION_SEMANTIC_REVIEW_2026-08-30.md). These provide repeatable source-integrity checks and a risk-prioritized review, but they do not select a release commit, close the final full-diff review, or satisfy any manual/Production gate below.

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

The August 30 read-only baseline is [PERMITEXT_BETA1_PRODUCTION_CONFIGURATION_PREFLIGHT_2026-08-30.md](./PERMITEXT_BETA1_PRODUCTION_CONFIGURATION_PREFLIGHT_2026-08-30.md). On September 2, the three exact policy-version identifiers and both approved Stripe-tax activation keys were staged in Vercel Production without a deployment. Evidence: [policy staging](./PERMITEXT_BETA1_PRODUCTION_POLICY_CONFIGURATION_STAGING_2026-09-02.md) and [Stripe tax provider activation](./PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md).

Do not mark this complete from route availability alone; the exact published bytes must match.

## New York Certificate and Stripe tax

Gate ID: `new-york-certificate-stripe-tax`
Status: **OPEN**
Release-bound: **no**

- New York Certificate of Authority registration issued: yes — official notice and authenticated Business Express status dated August 28, 2026. The portal's `View Certificate` link returned the DTF-17 application rather than the certificate.
- Actual Certificate of Authority received: owner reported possession on September 2, 2026; the sensitive certificate was not copied into source control or independently inspected in this record.
- Certificate saved and printed/displayed as required: yes — owner-confirmed September 2, 2026; no certificate image or identifier was retained.
- Registration effective date and assigned filing frequency recorded: the owner-supplied DTF-17 application shows `09/18/2026` as the New York sales-tax business-start/effective date; confirmation from the actual Certificate remains open. The owner identified quarterly filing, and current official New York guidance confirms the initial quarterly classification for this taxable, non-manufacturer/wholesaler registration. The first quarter ends November 30, 2026, and the official calendar sets the first filing deadline at December 21, 2026. The application itself was not retained.
- No taxable New York sale accepted before authorization: Stripe reported no live transactions before the registration was activated.
- Stripe customer-location and billing-address behavior reviewed: local Checkout requires a billing address in automatic mode; real customer-location acceptance remains open.
- Stripe automatic/manual tax decision and inclusive/exclusive behavior recorded: `automatic` + `exclusive` approved August 30, 2026; exact local web disclosure is `$20/month plus applicable taxes shown by Stripe.` Both Production keys were added September 2 without a deployment.
- Source guard confirmed: yes locally. Production Checkout rejects an unconfigured tax mode, configured automatic mode requests Stripe automatic tax and a billing address, and live readiness verifies the resolved Price tax behavior. The newly staged Production values remain inactive until deployment, and no real taxed Checkout has been run.
- Stripe Product tax code reviewed: yes — the live Product was updated and independently reread as `Website Information Services - Business Use` (`txcd_10701400`) on September 2, 2026.
- Active New York provider registration reviewed after the actual Certificate arrives: yes — Stripe confirmed the registration was added successfully and Sales tax collection starts immediately. The Locations view shows one New York registration; separate filing setup remains `Needs attention`.
- Apple tax-handling boundary recorded separately: [BETA1_APPLE_TAX_HANDLING_RECORD.md](./BETA1_APPLE_TAX_HANDLING_RECORD.md). Stripe automatic tax is web-only. Read-only App Store Connect evidence shows parent category `App Store software` and subscription `Match to parent app`, and the owner approved leaving that classification unchanged for Beta 1. First real financial-report evidence remains open.
- First sales-tax filing deadline and persistent reminder verified: deadline verified as December 21, 2026; durable reminder and filing process remain open.
- Redacted evidence and timestamp: `2026-09-02T21:56:33Z` — [Stripe tax provider activation](./PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md).

Provider and Production-key evidence: [PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md](./PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md). It intentionally retains no taxpayer ID, certificate image, residential address, or unredacted provider payload.

The three approved policy-version identifiers were staged in Vercel Production on September 2 without deploying or changing the serving release. Exact live policy hashes still fail closed. Evidence: [PERMITEXT_BETA1_PRODUCTION_POLICY_CONFIGURATION_STAGING_2026-09-02.md](./PERMITEXT_BETA1_PRODUCTION_POLICY_CONFIGURATION_STAGING_2026-09-02.md).

Do not include the taxpayer identification number, residential address, or certificate image in source control.

## Monitoring delivery

Gate ID: `monitoring-delivery`
Status: **OWNER-ACCEPTED BOUNDED ALTERNATIVE; EXACT-RELEASE VERIFICATION OPEN**
Release-bound: **yes**

- Production health-failure detection: accepted daily privacy-bounded log audit with direct `/health` fallback when no health request appears in the sampled window.
- Production 5xx/client-error delivery: live Vercel 5xx anomaly rule plus accepted daily audit; anomaly-specific rule delivery has not been demonstrated.
- Stripe/Apple billing-webhook failure delivery: accepted daily audit; not represented as immediate warning delivery.
- Database/storage failure delivery: accepted daily audit; the September 2 audit retained one privacy-bounded transient 503 finding and subsequent healthy direct check.
- Research spend rejection delivery: accepted daily audit; not represented as immediate warning delivery.
- Research p95 latency delivery or accepted bounded daily alternative: accepted bounded daily alternative.
- Named owner received the actual configured notification: generic Vercel web delivery was observed and owner web/email subscriptions are checked; anomaly-specific and email delivery remain unproven.
- `PERMITEXT_MONITORING_PROVIDER` matches retained delivery evidence: `vercel-observability-daily-review` was staged in Vercel Production after explicit owner acceptance.
- Privacy-bounded Production log audit passed after the exercise: exact-release post-deployment audit remains open.
- Redacted evidence and timestamp: [Production monitoring audit evidence](./PERMITEXT_PRODUCTION_MONITORING_AUDIT_EVIDENCE_2026-08-29.md), owner acceptance September 2, 2026 at approximately 6:52 PM EDT.

This accepted Beta 1 alternative does not claim immediate delivery for every category. Keep this release-bound gate open in the machine record until the exact deployed release reports the marker and its post-deployment privacy-bounded audit or direct-health fallback is retained.

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

## Zoning Research Beta limitations and clients

Gate ID: `zoning-research-beta-limitations-and-clients`
Status: **OPEN**
Release-bound: **yes**

The controlling Architecture V2.1 run `06e55e77-4419-4732-b7ca-825afabc3bc2` attempted all 30 ordered cases once. Twelve delivered answers passed, one delivered answer missed a required qualification, five cases failed closed after provider work without a customer charge, and 12 correctly stopped before provider access. On September 2, the owner moved the six unresolved cases into the post-launch Beta feedback backlog rather than require another pre-Beta architecture cycle. This decision does not relabel any historical outcome as passed or weaken the remaining exact-release acceptance gate.

- Architecture V2.1 result, six known limitations, consumed authorization, source edition, and case order retained without rescoring:
- Owner's September 2 Beta sequencing decision recorded without claiming professional approval or a clean semantic pass:
- Five verifier-blocked cases remain uncharged and fail closed; the known delivered-answer qualification is disclosed for Beta observation:
- The disabled 24,000-character evidence candidate remains disabled and no additional paid cohort was used:
- Zoning `researchEligibility` and public Research routing changed only in the selected release commit after these boundaries were verified:
- Enabled Production web and final TestFlight build returned the same governed Zoning Research contract on a physical iPhone:
- Zoning citations reopened the exact enacted ZR source and edition; structured tables, maps/visual limits, amendment state, and applicability unknowns remained explicit:
- Project context, turn accounting, fail-closed recovery, unofficial-aid wording, privacy disclosure, and no-professional-signoff boundary passed:
- Redacted evidence and timestamp:

Controlling retained result: [PERMITEXT_ZONING_ARCHITECTURE_V21_CONFIRMATION_RESULT_2026-09-01.md](./PERMITEXT_ZONING_ARCHITECTURE_V21_CONFIRMATION_RESULT_2026-09-01.md). The [master plan](./PERMITEXT_BETA1_MASTER_PLAN.md) records the owner's subsequent sequencing decision.

Do not mark this gate complete until the selected release passes the enabled web/TestFlight physical-iPhone checks and the owner makes the final go/no-go decision. This Beta sequencing decision does not authorize deployment, pricing or allowance changes, or another paid run.

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

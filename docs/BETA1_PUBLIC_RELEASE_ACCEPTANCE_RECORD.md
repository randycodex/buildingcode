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
Status: **CURRENT BUILD 50 CANDIDATE PASSED — selected-release machine binding remains open**
Release-bound: **yes**

- Production build log passed commercial configuration, live Stripe, release identity, and external-monitoring checks: yes — exact deployment `dpl_GzjcRMmjuZD1pDxsmiYT4FjH2HvP` reported every protected check ready and completed successfully.
- Production `/health` passed: yes — PostgreSQL storage/rate limiting, schema `normalized-v4`, commercial readiness, and the accepted monitoring marker passed on September 3, 2026.
- Production `/release` returned the selected full Git commit: current candidate yes — `c78a4b6c26d8d47e096d3b1aba7baa8b161a4b2c`; the final machine-selected release field remains intentionally null pending owner go/no-go sequencing.
- Canonical Production domain serves that deployment: yes — `permitext-sync.vercel.app`, `permitext.com`, and `www.permitext.com` are aliases on the READY deployment.
- No unexpected migration, runtime, billing-webhook, or client error appeared after deployment: yes for the retained September 3 window — all 26 recent request results in the status-code audit were HTTP 200.
- Redacted evidence and timestamp: [build 50 physical-iPhone acceptance](./PERMITEXT_BETA1_BUILD50_PHYSICAL_IPHONE_ACCEPTANCE_2026-09-03.md), through `2026-09-03T10:33:44.038Z`.

This is deployment evidence only. It does not prove the later manual activation gates.

## Controlled Production billing

Gate ID: `controlled-production-billing`
Status: **CURRENT PRODUCTION LIFECYCLE PASSED — final-release binding and two non-charge cleanup/replay fields remain open**
Release-bound: **yes**

Run only under separate immediate authorization. Use a dedicated disposable account and the exact serving release. Do not record card data, a raw receipt, an email address, or unredacted customer/provider identifiers.

- Explicit charge/refund authorization and timestamp: yes — the owner separately authorized the live charge and later cancellation plus the full refund during the `2026-09-02T23:36:49Z`–`2026-09-02T23:44:06Z` exercise window.
- Dedicated test-account opaque hash: no account identifier is retained in source control; the authenticated account was verified as Free immediately before Checkout.
- Signed provider event granted Pro exactly once: yes — Permitext showed Pro with 100 included turns after three purchase-related webhook deliveries returned HTTP 200.
- Duplicate/delayed event remained inert: not deliberately replayed against live Production; the permanent provider-backed Stripe sandbox and billing contract cover duplicate and delayed delivery without another charge.
- Cancellation preserved only the intended prepaid period: yes before refund — the Customer Portal scheduled cancellation at the end of the paid month; the later full refund correctly superseded that schedule and ended access immediately.
- Authorized refund completed and removed the intended entitlement: yes — Stripe showed the full `$21.78` refund and Permitext returned to Free.
- Stripe subscription/customer cleanup confirmed: subscription canceled and ended; the disposable Stripe customer was not deleted during this exercise and remains part of the separate account-deletion cleanup boundary.
- Permitext entitlement and provider state reconciled: yes — Stripe showed canceled/ended plus the refunded invoice, while Permitext showed Free.
- Redacted event references, amounts, timestamps, and cleanup evidence: [Production Stripe lifecycle evidence](./PERMITEXT_BETA1_PRODUCTION_STRIPE_LIFECYCLE_2026-09-02.md), bound to Git commit `cb7918b453988a07d57a7834f5982d523d0e3901` and deployment `dpl_2i2iRQjwqkuQaQChbzR5MGh6j8EW`.

The controlled monetary and entitlement lifecycle does not need another paid Beta 1 repetition unless billing logic or Production configuration materially changes. This gate remains false in the activation JSON until the final shared web/TestFlight commit is selected and the remaining non-charge replay/customer-cleanup evidence is reconciled.

## Production authentication and account lifecycle

Gate ID: `production-auth-account-lifecycle`
Status: **OPEN — existing Apple-account build 50 continuity passed; fresh providers, remaining existing providers, and deletion remain open**
Release-bound: **yes**

- Fresh-account email-code sign-in:
- Fresh-account Apple sign-in:
- Fresh-account Google sign-in:
- Fresh-account Microsoft sign-in:
- Existing-account email-code sign-in retained the correct Permitext account/data:
- Existing-account Apple sign-in retained the correct Permitext account/data: yes for the persisted account session on exact build 50 — the Account screen was signed in after relaunch, Lifetime Pro remained active, sync reported `Synced`, and existing saved sections or notes remained present. No fresh `/account/sign-in` request occurred in this window because the completed account session persisted; this is not fresh-account Apple evidence.
- Existing-account Google sign-in retained the correct Permitext account/data:
- Existing-account Microsoft sign-in retained the correct Permitext account/data:
- Dedicated disposable-account pre-deletion export and aggregate baseline captured safely:
- Customer-interface deletion reported every applicable billing, data, private-asset, device, and Clerk stage accurately:
- Deleted session failed, private asset disappeared, and recreated identity returned an empty Free account:
- Disposable account and test content cleanup completed under separate authorization:
- Redacted evidence and timestamp: [build 50 physical-iPhone acceptance](./PERMITEXT_BETA1_BUILD50_PHYSICAL_IPHONE_ACCEPTANCE_2026-09-03.md), physical observation window approximately `2026-09-03T10:20:00Z`–`2026-09-03T10:28:18Z`.

Follow [the detailed account export/deletion checklist](./BETA1_BILLING_IDENTITY_RUNBOOK.md#production-account-exportdeletion-acceptance). Never use the owner's primary, administrator, Lifetime Pro, or real customer account.

## Exact policy publication

Gate ID: `exact-policy-publication`
Status: **OPEN — exact current-candidate publication passes; final-client consent confirmation remains open**
Release-bound: **yes**

- Strict live publication audit returned `publicationReady: true` for Terms, Privacy, and Subscription/Refund policy: yes at `2026-09-03T10:33:44.038Z`.
- Live document SHA-256 hashes equal the approved manifest: yes for all three canonical routes; the audit emitted hashes only, not policy bodies or customer data.
- Production version identifiers equal the approved current versions: yes — the protected exact-candidate build reported approved policy versions ready.
- Web purchase consent displays and records those exact versions:
- iOS purchase consent displays and records those exact versions:
- Retainable post-purchase acknowledgment matches the selected release:
- Canonical URLs are direct HTTPS 200 responses without redirect or fallback bytes: yes for `/terms`, `/privacy`, and `/refunds`.
- Redacted evidence and timestamp: strict live audit at `2026-09-03T10:33:44.038Z`; exact release identity is retained in [build 50 physical-iPhone acceptance](./PERMITEXT_BETA1_BUILD50_PHYSICAL_IPHONE_ACCEPTANCE_2026-09-03.md).

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
- Stripe customer-location and billing-address behavior reviewed: yes — Production Checkout required privately entered billing information and calculated `8.875%` New York tax (`$1.78`) on the `$20.00` base price.
- Stripe automatic/manual tax decision and inclusive/exclusive behavior recorded: `automatic` + `exclusive` approved August 30, 2026; exact web disclosure is `$20/month plus applicable taxes shown by Stripe.` Both Production keys are deployed on the verified release.
- Source guard confirmed: yes in Production. The protected build verified the resolved Price behavior, and the real controlled Checkout added tax above the `$20.00` base price as configured.
- Stripe Product tax code reviewed: yes — the live Product was updated and independently reread as `Website Information Services - Business Use` (`txcd_10701400`) on September 2, 2026.
- Active New York provider registration reviewed after the actual Certificate arrives: yes — Stripe confirmed the registration was added successfully and Sales tax collection starts immediately. The Locations view shows one New York registration; separate filing setup remains `Needs attention`.
- Apple tax-handling boundary recorded separately: [BETA1_APPLE_TAX_HANDLING_RECORD.md](./BETA1_APPLE_TAX_HANDLING_RECORD.md). Stripe automatic tax is web-only. Read-only App Store Connect evidence shows parent category `App Store software` and subscription `Match to parent app`, and the owner approved leaving that classification unchanged for Beta 1. First real financial-report evidence remains open.
- First sales-tax filing deadline and persistent reminder verified: deadline and reminder verified for December 21, 2026; the operational filing process remains separate.
- Redacted evidence and timestamp: provider activation at `2026-09-02T21:56:33Z`, followed by the controlled taxed lifecycle through `2026-09-02T23:44:06Z` — [Stripe tax provider activation](./PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md) and [Production Stripe lifecycle evidence](./PERMITEXT_BETA1_PRODUCTION_STRIPE_LIFECYCLE_2026-09-02.md).

Provider and Production-key evidence: [PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md](./PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md). It intentionally retains no taxpayer ID, certificate image, residential address, or unredacted provider payload.

The three approved policy-version identifiers and both tax values were deployed on September 2, and the exact live policy hashes passed. Evidence: [Production deployment record](./PERMITEXT_BETA1_PRODUCTION_DEPLOYMENT_2026-09-02.md).

Do not include the taxpayer identification number, residential address, or certificate image in source control.

## Monitoring delivery

Gate ID: `monitoring-delivery`
Status: **OWNER-ACCEPTED BOUNDED ALTERNATIVE VERIFIED ON CURRENT BUILD 50 CANDIDATE; selected-release machine binding remains open**
Release-bound: **yes**

- Production health-failure detection: accepted daily privacy-bounded log audit with direct `/health` fallback when no health request appears in the sampled window.
- Production 5xx/client-error delivery: live Vercel 5xx anomaly rule plus accepted daily audit; anomaly-specific rule delivery has not been demonstrated.
- Stripe/Apple billing-webhook failure delivery: accepted daily audit; not represented as immediate warning delivery.
- Database/storage failure delivery: accepted daily audit; the September 2 audit retained one privacy-bounded transient 503 finding and subsequent healthy direct check.
- Research spend rejection delivery: accepted daily audit; not represented as immediate warning delivery.
- Research p95 latency delivery or accepted bounded daily alternative: accepted bounded daily alternative.
- Named owner received the actual configured notification: generic Vercel web delivery was observed and owner web/email subscriptions are checked; anomaly-specific and email delivery remain unproven.
- `PERMITEXT_MONITORING_PROVIDER` matches retained delivery evidence: `vercel-observability-daily-review` was staged in Vercel Production after explicit owner acceptance.
- Privacy-bounded Production log audit passed after the exercise: yes for the accepted bounded path — the September 3 audit emitted no raw messages or customer identifiers, the required direct `/health` fallback passed when the supplied sample contained no health request, and the recent Production status audit contained 26 HTTP 200 results with no 4xx/5xx result.
- Redacted evidence and timestamp: [Production monitoring audit evidence](./PERMITEXT_PRODUCTION_MONITORING_AUDIT_EVIDENCE_2026-08-29.md), owner acceptance September 2, 2026 at approximately 6:52 PM EDT, and [build 50 exact-release evidence](./PERMITEXT_BETA1_BUILD50_PHYSICAL_IPHONE_ACCEPTANCE_2026-09-03.md) through `2026-09-03T10:33:44.038Z`.

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
Status: **OPEN — build 50 release identity, installation, existing Apple account, sync, Lifetime Pro, and saved continuity passed; remaining client workflows remain open**
Release-bound: **yes**

- Production web release ID and Git commit match the selected release: current candidate yes — release ID `c78a4b6c26d8`, Git commit `c78a4b6c26d8d47e096d3b1aba7baa8b161a4b2c`; final machine selection remains open.
- Final iOS archive was built from the selected release commit: current candidate yes — signed version `1.0`, build `50`, executable SHA-256 `7cb3dcc312ac1eb19e72acee57429852fafd3324c50452d598fd7074ce6005b0` from the same exact commit.
- App Store Connect processed the intended build: build 50 upload succeeded, the owner installed it, and paired-device readback confirmed version `1.0` / build `50`; final owner release selection remains open.
- Physical-iPhone authentication passed: existing Apple-authenticated account continuity passed after relaunch; fresh-account Apple and the remaining provider matrix remain open.
- Account/sync and representative saved Project continuity passed: Account reported `Synced`, existing saved sections or notes remained present, and existing project containers remained present. The projects had never contained saved items, so their empty state was expected; project-item continuity remains unexercised rather than failed.
- Free and Pro entitlement presentation passed: Lifetime Pro passed on build 50; final-build Free presentation remains open.
- Restore/cancellation/refund state presentation passed as applicable:
- One separately authorized complete Production Research turn preserved the shared web/iOS response contract:
- Account-deletion presentation and recovery boundaries passed:
- No TestFlight staging URL, Sandbox entitlement, or mismatched commit remained: yes for the tested build — its backend is Production, its entitlement was Lifetime Pro rather than Sandbox, and installed build/Production Git identity align to `c78a4b6c26d8d47e096d3b1aba7baa8b161a4b2c`.
- Redacted evidence and timestamp: [build 50 physical-iPhone acceptance](./PERMITEXT_BETA1_BUILD50_PHYSICAL_IPHONE_ACCEPTANCE_2026-09-03.md), through `2026-09-03T10:33:44.038Z`.

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

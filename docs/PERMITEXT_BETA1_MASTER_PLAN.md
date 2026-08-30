# Permitext Beta 1 — Master Plan and Current Status

Last updated: August 30, 2026

This is the top-level Beta 1 plan. Detailed workstreams remain in their linked documents, but this file is the single place to see what is done, what is happening now, and what still blocks release.

## Beta 1 product

- United States only.
- Free: code reading and search.
- Pro: $20 per month, no trial, no annual plan.
- Pro includes 100 Research turns per UTC calendar month.
- One submitted question consumes one turn only after Permitext completes and durably saves the answer. Internal model calls, retries, verification failures, cancellations, and provider failures do not consume extra turns.
- Additional turn packs remain disabled and unpublished until measured hybrid costs and the complete purchase/refund lifecycle are acceptable.
- Research is an unofficial professional research aid, not an agency ruling or professional determination.
- Zoning Research is not part of the Beta 1 public Research scope yet.

## Current position

The product foundation is substantially built, but Beta 1 is **not ready for public paid release**. The immutable V6 Research cohort passed 20/20 fatal gates, and the completed subscriber economics model places a fully used 100-turn month at $5.74 p50 and $6.06 p90 in model cost. At the confirmed 15% App Store commission and the accepted planning reserves, the modeled p90 contribution is $4.16 on web and $2.14 on iOS at 25 subscribers; the owner retained 100 turns for Beta with a later $4–$6 target. Local Stripe and Apple lifecycle simulations and the provider-backed Stripe sandbox lifecycle pass. Apple-created Sandbox/TestFlight evidence now also passes purchase, account ownership, Restore, cancellation retention and expiration, refund submission and revocation, renewal, billing failure/recovery, delayed notification recovery, and strict duplicate write-inertness. The final duplicate proof used exact commit `b83194446a6ed8178f597d8bb9a81475b0d52a0b` on only the isolated `apple-sandbox` custom-environment deployment: an exact Apple-signed `DID_RENEW` replay returned HTTP 200 with `changed: false`, and both hashed database timestamps remained identical to the microsecond. The public isolated-staging alias now serves that repaired deployment; Production remained unchanged. Isolated recovery acceptance also passes: the exact serving Production commit ran against a point-in-time Neon child branch from an SSO-protected Preview, and all 124 private Blob objects were restored byte-for-byte into a separate private namespace. The read-only Production Clerk provider/configuration audit passes and is now protected by a permanent fail-closed aggregate-only guard, while fresh/existing provider sign-ins and the account export/deletion lifecycle correctly remain open until the final deployment. Web and iOS purchase-consent controls are implemented but remain dormant until the approved policy versions are configured. The canonical Production policy URLs are reachable, but the August 30 exact-content audit proves that all three still serve older/different bytes; a permanent strict verifier now keeps publication open until the approved files are deployed exactly. Controlled Production billing, New York sales-tax completion/configuration, actual refund/infrastructure incidence, remaining monitoring, manual Production authentication acceptance, and the final Production/TestFlight release sequence remain open. Additional-turn sales stay disabled.

Current development branch: `codex/research-commercialization`

## Status dashboard

Checklist snapshot: **75 completed, 23 open**. Eleven of the open items are the final merge, deployment, TestFlight, and release sequence, which has not been authorized on this branch.

| Workstream | Status | What is done and what remains |
| --- | --- | --- |
| Core product and cross-platform foundation | Mostly complete | Shared web/iOS contracts and Research presentation are complete. Final production-web and physical-iPhone verification remains. |
| Research quality and subscriber economics | Current Beta gate passed | Immutable V6 passed 20/20, and the no-cost 100-turn/full-service economics model is complete. Actual tax, refund, and infrastructure results must be reviewed after the first 25–50 customers. |
| Billing and paid continuation | Partially complete | Server billing contracts, local Stripe/Apple exercises, the provider-backed Stripe sandbox lifecycle, isolated Apple staging, and Apple-created purchase/account-restore/cancellation/expiration/refund/renewal/billing-recovery/delayed-delivery evidence pass. The atomic duplicate repair is deployed only to the isolated custom environment, where an exact Apple-signed replay returned `changed: false` and left both database timestamps identical to the microsecond. The public isolated-staging alias now serves that repaired deployment. Controlled Production billing and final serving-release verification remain; Production was unchanged, and additional-turn sales stay disabled. |
| Authentication and account lifecycle | Configuration ready; acceptance open | Product contracts, exact Production Clerk provider/domain/portal/native configuration, public AASA, and a permanent aggregate-only audit pass. Final fresh/existing Production sign-in plus account export/deletion verification remain. |
| Legal, privacy, and customer promises | Owner approval complete; publication stale | Official-source owner review, final customer-document approval, stable local version identifiers, age/data rules, versioned acceptance, purchase consent, server enforcement, and a retainable web post-purchase acknowledgment are prepared. The canonical URLs respond, but the strict live audit proves they do not yet contain the exact approved files. The New York registration application was submitted and its confirmation saved; exact policy publication, the Certificate, Stripe tax configuration, and Production activation remain open. No attorney approval is claimed. |
| Hosting, monitoring, recovery, and support | Recovery complete; monitoring partially complete | Vercel Pro, spend controls, two included live alert rules, owner web/email subscriptions, verified generic web delivery, local operations rehearsals, a privacy-bounded Production-log auditor, support tabletop, Neon point-in-time recovery, durable-data comparison, protected exact-commit restore deployment, separate byte-for-byte private Blob restore, and the current provider-capacity/upgrade guard pass. No additional provider upgrade is required today; Neon Free capacity/recovery and OpenAI credit are the first prelaunch checks. Anomaly-specific and alert/hard-stop delivery exercises remain open. |
| Merge, deploy, TestFlight, and release | Not started; not authorized | All 11 final Production release-sequence steps remain open. The isolated staging deployment and staging-targeted build 42 do not authorize or satisfy the later Production release sequence. No merge, push, Production deployment, or public release occurred. |

### What still blocks a public paid Beta

1. Complete the separately approved controlled Production billing exercise.
2. Reverify Production authentication and the account export/deletion lifecycle.
3. Publish the approved policy versions at stable URLs, receive the requested New York Certificate of Authority, record Stripe tax configuration, and activate the implemented policy-version acceptance flow.
4. Finish monitoring coverage and delivered-alert/hard-stop exercises.
5. Complete the separately authorized merge, deployment, Production, TestFlight, and physical-iPhone release sequence.

## 1. Core product and cross-platform foundation

- [x] Web and iOS share the account, entitlement, Project, saved-content, and Research backend contracts.
- [x] Account deletion, sign-out, sync/account presentation, and Research Project context have cross-platform coverage.
- [x] Free/Pro wording and the $20 monthly / 100-turn allowance are aligned across platforms.
- [x] Research responses expose enacted citations, source/edition state, uncertainty, authority classification, and the unofficial-research disclaimer.
- [x] Zoning public Research remains disabled while the reader/search corpus can continue to exist separately.
- [ ] Recheck the final merged build on both production web and the physical iPhone before release.

## 2. Research quality and economics — current Beta gate passed

- [x] Implemented Luna-first routing with Terra escalation or repair.
- [x] Implemented model, cost, latency, verification, and escalation telemetry.
- [x] Completed the first frozen 20-case commercialization cohort with 20/20 operations and no provider failures.
- [x] Measured approximately $5.35 operating model cost per 100 turns, 20.388-second p50 latency, and 37.349-second p90 latency.
- [x] Identified 9 exact passes and 11 completed answers needing qualification, missing-fact, or evidence-boundary improvement.
- [x] Finish the generic safeguard for declared unknowns and unverified owner/applicant representations.
- [x] Complete the repository-wide no-cost test gate.
- [x] Rerun the 11 subthreshold cases and subsequent three-case diagnostics under explicit spend caps.
- [x] Confirm the final source-bound sidewalk-café repair with one capped paid case; it passed 4.00/4.
- [x] Attempt the frozen v2 cohort; retain it as partial evidence after 11 completed turns and a provider outage.
- [x] Resolve the three v2 quality failures and verify provider fail-fast behavior before a v3 cohort.
- [x] Attempt the frozen v3 cohort; retain its 15 completed turns and fail-fast stop at case 16 as partial evidence.
- [x] Verify section-bounded web-routing and English-answer sanitization before a v4 cohort.
- [x] Attempt the frozen v4 cohort; retain its 18 completed turns, 17 exact passes, and fail-fast stop on exhausted provider credit as partial evidence.
- [x] Add a deterministic BC 1101.3/1101.3.1 scope-consistency gate and no-cost regression coverage for the single v4 quality failure.
- [x] Restore OpenAI API credit, retain the failed first targeted confirmation, and repair its bounded-revision regression without another model call.
- [x] Rerun capped targeted confirmations for the repaired case and the provider-interrupted case; both passed 4.00/4.
- [x] Attempt the immutable v5 cohort; retain its 9 completed turns, 8 passes, quality failure, and operator stop as partial evidence.
- [x] Complete no-cost verification of the v23 filing-boundary repair and scored-quality fail-fast behavior.
- [x] Run the separately authorized immutable v6 cohort; all 20 cases passed with no provider or charging failure.
- [x] Build the no-cost V6 subscriber aggregation and full-service planning model.
- [x] Confirm the 15% App Store rate, ten-minute support assumption, $2 Beta contribution floor, and retention of 100 included turns.
- [x] Verify the shared Research response contract in the current web source and iOS Simulator, including corpus edition/applicability decoding, display, and copied output.
- [x] Complete the no-cost tax/refund/infrastructure source audit and quantify 10/25/50/100-subscriber plus 0/1/3/5/10%-refund sensitivities.
- [x] Prepare the tax-registration and optional professional-reference packet and make local Beta readiness require the exact $7 per-user monthly Research-cost ceiling.
- [x] Prepare a dormant Stripe automatic-tax Checkout path, a fail-closed Production guard that matches an explicit owner decision to the resolved live Price behavior, and a [Stripe tax decision record](./BETA1_STRIPE_TAX_DECISION_RECORD.md); leave the Certificate, Stripe registration/tax code, presentation choice, and real taxed Checkout open.
- [x] Record the separate [Apple tax-handling boundary](./BETA1_APPLE_TAX_HANDLING_RECORD.md): App Store customer price includes taxes Apple collects and remits, Apple proceeds are net of applicable taxes and commission, and Stripe automatic tax must remain web-only. Leave the live app/subscription category and first real financial report open.
- [ ] Verify tax, refund, and infrastructure-allocation inputs and review actual economics after the first 25–50 customers.

Detailed plan: [PERMITEXT_RESEARCH_COMMERCIALIZATION_CURRENT_PLAN.md](./PERMITEXT_RESEARCH_COMMERCIALIZATION_CURRENT_PLAN.md)

## 3. Billing and paid continuation

- [x] Stripe production Pro product is $20 per month and trials are disabled.
- [x] The server has monthly included turns, paid-credit reservations, completion, release, refund, idempotency, and reconciliation contracts.
- [x] Failed provider requests and internal retries do not charge additional user turns.
- [x] Turn-pack offers are gated so incomplete configuration is not shown to users.
- [x] Complete a local provider-simulated, no-charge Stripe Pro lifecycle exercise covering Checkout, renewal, cancellation timing, invoice failure, partial/full refunds, duplicate delivery, and delayed webhook recovery.
- [x] Complete a provider-backed Stripe sandbox lifecycle covering Checkout, entitlement, duplicate delivery, test-clock renewal, cancellation timing, failed invoice, partial/full refund behavior, ownership restore, and delayed-event recovery.
- [x] Complete a local signed-payload, no-charge Apple Pro lifecycle exercise covering ownership, renewal, grace, billing recovery, refunds, duplicate delivery, and delayed-notification recovery.
- [x] Prepare a build-time TestFlight backend override and fail-closed Apple Sandbox staging verifier that rejects Production or shared storage, live Stripe secrets, and enabled paid Research.
- [x] Complete a read-only App Store Connect inspection of the subscription, TestFlight builds, Sandbox accounts, notification URLs, and official Apple root-certificate fingerprints without changing provider state.
- [x] Create an isolated Apple Sandbox Vercel project with separate free Neon and private Blob resources, pass all staging-readiness checks, configure only the Sandbox notification URL, and upload staging-targeted builds through build 48.
- [x] Complete Apple-created Sandbox and TestFlight subscription lifecycle evidence against the compatible staging backend. Purchase, no-charge confirmation, local Pro/100-turn activation, account ownership, Restore, later notification delivery, post-cancellation notification delivery, cancellation-period access retention, canceled-period expiration, refund submission, refund revocation, renewal, billing failure/recovery, build 48 Sandbox identity continuity, Apple-created delayed recovery, and exact duplicate write-inertness pass.
- [ ] Redeploy production after final environment/configuration changes and verify the serving release uses the intended $20 price.
- [ ] Complete the separately approved controlled production signup, purchase, entitlement, cancellation, refund, and webhook-recovery exercise with a dedicated account and real charge.
- [ ] Create/approve and end-to-end test Stripe and App Store consumables before enabling additional-turn sales.
- [ ] Set pack prices only after p50/p90 hybrid cost, fees, tax, refund, infrastructure, support, and margin calculations are complete.

Detailed configuration: [BETA1_COMMERCIAL_CONFIGURATION.md](./BETA1_COMMERCIAL_CONFIGURATION.md)

## 4. Authentication and account lifecycle

- [x] Clerk account flows support passwordless email, Apple, Google, and Microsoft in the product contract.
- [x] The iOS Apple flow no longer requires the user to re-enter an email in the verified build path previously tested by the owner.
- [x] Account deletion explains the destructive scope and distinguishes Permitext deletion from Apple subscription cancellation and external identity providers.
- [x] Prepare a fail-closed Production account export/deletion acceptance checklist using only a dedicated disposable account, redacted evidence, explicit partial-failure stop conditions, and separate Apple-billing handling.
- [ ] Reverify fresh-account and existing-account sign-in for Apple, Google, Microsoft, and email in production after the final deployment.
- [ ] Complete one production-configured account export/deletion lifecycle and confirm provider/local cleanup results are reported accurately.
- [x] Record OAuth credential ownership and activate the Microsoft secret's 30-, 14-, and 7-day rotation reminders.

Read-only configuration evidence: [PERMITEXT_PRODUCTION_AUTH_CONFIGURATION_EVIDENCE_2026-08-29.md](./PERMITEXT_PRODUCTION_AUTH_CONFIGURATION_EVIDENCE_2026-08-29.md). The audit intentionally reports `configurationReady: true` and `releaseReady: false`; it does not convert an existing Clerk session or source test into fresh OAuth proof. Clerk Hobby currently uses all three free social/custom connections for the exact Apple, Google, and Microsoft set Permitext needs, so no upgrade is required unless the provider set expands or capacity approaches the recorded usage threshold.

## 5. Legal, privacy, and customer promises

- [x] Product-level professional-use, authority, privacy, retention, deletion, and Research-provider disclosures are implemented and covered by contracts.
- [x] Working commercial decisions and a working refund policy are documented.
- [x] Set the Beta 1 minimum user age to 18 and document the rule.
- [x] Prohibit confidential, regulated, or sensitive personal information during Beta 1 and require users to redact it before submission, while allowing ordinary property/project information needed for a requested feature.
- [x] Prepare authenticated, server-timestamped policy-version acceptance storage with stale-version rejection, idempotency, identity-merge preservation, and administrator export coverage.
- [x] Wire explicit web/iOS purchase consent to the exact displayed policy versions and require current acceptance at web checkout; fail closed while approved current versions are unconfigured.
- [x] Complete an official-source owner legal self-review after the owner elected not to retain counsel; record sole-proprietor exposure and the residual no-attorney risk without claiming legal approval.
- [x] Complete final owner approval of the exact customer documents and record dormant identifiers `terms-2026-08-28`, `privacy-2026-08-28`, and `subscriptions-2026-08-28` with their approved-file hashes.
- [x] Retain machine-readable approved-artifact and [live-publication guards](./PERMITEXT_POLICY_PUBLICATION_AUDIT_2026-08-30.md) so an edited file cannot silently reuse an approved identifier and stale Production pages cannot pass; all local hashes pass, while the August 30 live audit correctly remains red.
- [x] Record explicit owner acceptance of all documented residual Beta risks without treating that acceptance as legal approval or release authorization.
- [ ] Publish stable owner-approved URLs and ensure web/iOS purchase screens match them.
- [ ] Configure and activate the owner-approved current policy versions after the final documents and stable URLs are approved.

Release checklist: [BETA1_LEGAL_READINESS_CHECKLIST.md](./BETA1_LEGAL_READINESS_CHECKLIST.md)

Owner self-review: [PERMITEXT_BETA1_OWNER_LEGAL_SELF_REVIEW.md](./PERMITEXT_BETA1_OWNER_LEGAL_SELF_REVIEW.md)

Tax and optional professional reference: [PERMITEXT_BETA1_PROFESSIONAL_REVIEW_PACKET.md](./PERMITEXT_BETA1_PROFESSIONAL_REVIEW_PACKET.md)

## 6. Hosting, monitoring, backup, and support

- [x] Release identity, health endpoints, structured runtime errors, client-error redaction, billing warnings, and Research spend events exist.
- [x] Complete a no-provider local end-to-end rehearsal for redacted client errors, configured-threshold latency, billing warnings, Research spend rejection, sanitized runtime errors, and 5xx observations.
- [x] A named support and urgent-alert owner and support address are documented.
- [x] Upgrade the commercial production service from Vercel Hobby to Vercel Pro.
- [x] Configure and live-verify the included Permitext-scoped Vercel 5xx-anomaly and infrastructure-usage-anomaly rules with owner email/web subscriptions.
- [ ] Complete the remaining monitoring delivery gate for health, 5xx/client failures, billing webhooks, database failures, Research spend, and p95 latency. The permanent no-cost Production-log auditor and active daily privacy-bounded guard cover observed instances of every category; anomaly-specific or immediate external delivery remains open, and the Production build now fails closed while external monitoring is not truthfully marked configured.
- [x] Configure a $20 Vercel on-demand spend amount, standard spend notifications, and automatic Production pause for all projects on the team.
- [x] Complete a read-only [backend provider capacity and upgrade audit](./PERMITEXT_BACKEND_PROVIDER_CAPACITY_AUDIT_2026-08-29.md); no additional upgrade is currently required, and conservative Neon, Clerk, Vercel/Blob, OpenAI, Stripe, and Apple review thresholds are recorded.
- [x] Prepare a fail-closed [spend-control acceptance record](./BETA1_SPEND_CONTROL_ACCEPTANCE_RECORD.md) that separates delivered notification, isolated 503/recovery, and automatic-threshold evidence and forbids spending or lowering the budget merely to trigger the gate.
- [x] Add a fail-closed, secret-free [Production environment key-presence audit](./PERMITEXT_BETA1_PRODUCTION_CONFIGURATION_PREFLIGHT_2026-08-30.md) and run it against live Vercel metadata. Twenty-three of 28 groups are present; the two Stripe tax and three policy-version activation keys correctly remain missing, and hidden values still require protected verification.
- [ ] Exercise a delivered spend notification and actual hard-stop behavior without exposing customers or incurring an uncontrolled overage.
- [x] Add a fail-closed read-only restore comparator and complete its no-provider local end-to-end rehearsal, including deliberate missing-record detection.
- [x] Complete a real point-in-time Neon child-branch recovery, exact durable-content comparison, Production-commit local compatibility check, and authenticated private Blob inventory/retrieval under the retained no-deploy/no-paid constraints.
- [x] Complete the remaining isolated recovery acceptance: serve the exact Production commit against the recovered Neon state from an SSO-protected Preview and restore all 124 private objects / 5,248,939 bytes byte-for-byte into a separate private Blob namespace.
- [x] Add the timed synthetic support-tabletop record and cross-document support-process contract.
- [x] Complete the first timed Codex-assisted support tabletop and retain the operator record.

Operations runbook: [BETA1_OPERATIONS_RUNBOOK.md](./BETA1_OPERATIONS_RUNBOOK.md)

## 7. Merge, deploy, and release sequence

- [x] Add a fail-closed, secret-free post-deployment public-Beta activation audit that binds every manual evidence record to the exact selected Git commit and keeps additional-turn sales disabled.
- [x] Prepare the corresponding redacted [operator acceptance record](./BETA1_PUBLIC_RELEASE_ACCEPTANCE_RECORD.md) with every launch gate explicitly open and its destructive, paid, privacy, and evidence boundaries stated.
- [x] Complete a no-input [interim branch-integrity checkpoint](./PERMITEXT_RESEARCH_COMMERCIALIZATION_BRANCH_INTEGRITY_AUDIT_2026-08-30.md) and [risk-prioritized semantic review](./PERMITEXT_RESEARCH_COMMERCIALIZATION_SEMANTIC_REVIEW_2026-08-30.md), including clean diff and full changed-text credential checks, a full no-cost repository check, and a permanent fail-closed `audit:release-branch` preflight. This does not close the final full-diff review against the eventual selected release commit.

This sequence begins only after the remaining pre-release gates are acceptable and the owner separately authorizes release work.

1. [ ] Review the full branch diff and preserve unrelated local iOS/Xcode changes.
2. [ ] Commit and push the completed remediation and new evaluation evidence.
3. [ ] Merge the verified branch into `main` and confirm local/remote ancestry and SHA equality.
4. [ ] Run the final local server checks and iOS Release build.
5. [ ] Run the Beta 1 production-configuration readiness verifier.
6. [ ] Deploy the compatible backend/web release first.
7. [ ] Verify `/health`, `/release`, sign-in, sync, billing/entitlement reads, and one complete Research turn in production.
8. [ ] Confirm the serving production SHA exactly matches the intended GitHub commit.
9. [ ] Build/archive/upload the next iOS build and verify TestFlight processing.
10. [ ] Test the TestFlight build on a physical iPhone against the deployed backend, including authentication, Project context, Research, subscription state, restore, and account deletion.
11. [ ] Record go/no-go evidence; do not call source/test/build success a public release.

## Release blockers at a glance

The current Research quality and no-cost subscriber-economics gate has passed. Beta 1 remains blocked until:

- Apple Sandbox/TestFlight and the separately approved controlled Production payment, cancellation, refund, and reconciliation lifecycles pass;
- Production authentication plus account export/deletion are reverified;
- approved customer documents are published at stable URLs, the requested New York Certificate of Authority is received, Stripe tax configuration is recorded, and the implemented policy-acceptance flow is activated with the exact current versions;
- remaining Production alert coverage and delivery/hard-stop behavior are tested;
- Production web and the final TestFlight build are verified against the exact intended release SHA.

## Not part of this immediate Beta 1 gate

- Public Zoning Research.
- Team/firm collaboration expansion.
- Annual subscriptions.
- Publishing turn-pack prices before the current measurement and lifecycle gates pass.

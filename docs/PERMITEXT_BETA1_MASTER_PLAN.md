# Permitext Beta 1 — Master Plan and Current Status

Last updated: August 28, 2026

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

The product foundation is substantially built, but Beta 1 is **not ready for public paid release**. The post-v23 immutable v6 Research cohort completed all 20 production turns without a provider or charging failure, and all 20 answers passed every fatal evaluation gate. Subscriber-level aggregation places a fully used 100-turn month at $5.74 p50 and $6.06 p90 in model cost. With the confirmed 15% App Store commission, ten support minutes at $30/hour, and explicit tax, refund, and infrastructure planning reserves, the 25-subscriber p90 full-service cost is $15.84 on web and $17.86 on iOS. Allocating the full $45 infrastructure budget across only ten fully utilized subscribers lowers contribution to $1.46 on web and -$0.56 on iOS; the accepted $2 floor first passes at 12 web or 24 iOS subscribers. The owner retained 100 turns for Beta with a later $4–$6 target. Local signed-route Stripe and Apple lifecycle simulations now pass, and a provider-backed Stripe sandbox lifecycle also passes; those exercises found and retained regressions for Stripe's current refund shape plus Apple's failed-renewal and delayed-notification behavior. Controlled production billing and Apple-created Sandbox/TestFlight evidence remain open. Tax configuration, actual refund/infrastructure incidence, legal, provider, operations, production, and TestFlight gates remain open.

Current development branch: `codex/research-commercialization`

## Status dashboard

Checklist snapshot: **56 completed, 26 open**. Eleven of the open items are the final merge, deployment, TestFlight, and release sequence, which has not been authorized on this branch.

| Workstream | Status | What is done and what remains |
| --- | --- | --- |
| Core product and cross-platform foundation | Mostly complete | Shared web/iOS contracts and Research presentation are complete. Final production-web and physical-iPhone verification remains. |
| Research quality and subscriber economics | Current Beta gate passed | Immutable V6 passed 20/20, and the no-cost 100-turn/full-service economics model is complete. Actual tax, refund, and infrastructure results must be reviewed after the first 25–50 customers. |
| Billing and paid continuation | Partially complete | Server billing contracts, local Stripe/Apple exercises, and the provider-backed Stripe sandbox lifecycle pass. Apple Sandbox/TestFlight, controlled Production billing, and final serving-release verification remain. Additional-turn sales stay disabled. |
| Authentication and account lifecycle | Partially complete | Product contracts and prior Apple-flow verification are complete. Final Production sign-in plus account export/deletion verification remain. |
| Legal, privacy, and customer promises | Technical groundwork complete; external review and activation open | Product disclosures, working policies, age rule, Beta data restrictions, professional handoff, and dormant acceptance storage are prepared. Counsel review, stable approved versions/URLs, and final web/iOS consent activation remain. |
| Hosting, monitoring, recovery, and support | Partially complete | Vercel Pro, spend controls, two included live alert rules, local operations rehearsals, support tabletop, Neon point-in-time recovery, durable-data comparison, and private Blob retrieval pass. Remaining alert delivery and isolated recovery acceptance remain open. |
| Merge, deploy, TestFlight, and release | Not started; not authorized | All 11 release-sequence steps remain open. No merge, push, deployment, TestFlight upload, or public release is included in the current work. |

### What still blocks a public paid Beta

1. Complete Apple-created Sandbox and TestFlight subscription lifecycle evidence.
2. Complete the separately approved controlled Production billing exercise.
3. Reverify Production authentication and the account export/deletion lifecycle.
4. Obtain counsel approval, publish stable policy URLs, and add required policy-version acceptance.
5. Finish monitoring coverage and delivered-alert/hard-stop exercises.
6. Finish isolated recovery acceptance for the recovered Neon state and a separate private Blob namespace, or explicitly accept the remaining risk.
7. Complete the separately authorized merge, deployment, Production, TestFlight, and physical-iPhone release sequence.

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
- [x] Prepare the tax/legal professional-review packet and make local Beta readiness require the exact $7 per-user monthly Research-cost ceiling.
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
- [ ] Complete Apple-created Sandbox and TestFlight subscription lifecycle evidence against the compatible staging backend.
- [ ] Redeploy production after final environment/configuration changes and verify the serving release uses the intended $20 price.
- [ ] Complete the separately approved controlled production signup, purchase, entitlement, cancellation, refund, and webhook-recovery exercise with a dedicated account and real charge.
- [ ] Create/approve and end-to-end test Stripe and App Store consumables before enabling additional-turn sales.
- [ ] Set pack prices only after p50/p90 hybrid cost, fees, tax, refund, infrastructure, support, and margin calculations are complete.

Detailed configuration: [BETA1_COMMERCIAL_CONFIGURATION.md](./BETA1_COMMERCIAL_CONFIGURATION.md)

## 4. Authentication and account lifecycle

- [x] Clerk account flows support passwordless email, Apple, Google, and Microsoft in the product contract.
- [x] The iOS Apple flow no longer requires the user to re-enter an email in the verified build path previously tested by the owner.
- [x] Account deletion explains the destructive scope and distinguishes Permitext deletion from Apple subscription cancellation and external identity providers.
- [ ] Reverify fresh-account and existing-account sign-in for Apple, Google, Microsoft, and email in production after the final deployment.
- [ ] Complete one production-configured account export/deletion lifecycle and confirm provider/local cleanup results are reported accurately.
- [x] Record OAuth credential ownership and activate the Microsoft secret's 30-, 14-, and 7-day rotation reminders.

## 5. Legal, privacy, and customer promises

- [x] Product-level professional-use, authority, privacy, retention, deletion, and Research-provider disclosures are implemented and covered by contracts.
- [x] Working commercial decisions and a working refund policy are documented.
- [x] Set the Beta 1 minimum user age to 18 and document the rule.
- [x] Prohibit confidential, regulated, or personally identifying material during Beta 1 and require users to redact it before submission.
- [x] Prepare authenticated, server-timestamped policy-version acceptance storage with stale-version rejection, idempotency, identity-merge preservation, and administrator export coverage.
- [ ] Obtain counsel review of Terms, Privacy Policy, subscription/cancellation disclosure, refund policy, Acceptable Use Policy, and professional-use/AI notice.
- [ ] Publish stable counsel-approved URLs and ensure web/iOS purchase screens match them.
- [ ] Activate counsel-approved policy versions and wire final web/iOS consent presentation and acceptance recording where required.

Release checklist: [BETA1_LEGAL_READINESS_CHECKLIST.md](./BETA1_LEGAL_READINESS_CHECKLIST.md)

Professional handoff: [PERMITEXT_BETA1_PROFESSIONAL_REVIEW_PACKET.md](./PERMITEXT_BETA1_PROFESSIONAL_REVIEW_PACKET.md)

## 6. Hosting, monitoring, backup, and support

- [x] Release identity, health endpoints, structured runtime errors, client-error redaction, billing warnings, and Research spend events exist.
- [x] Complete a no-provider local end-to-end rehearsal for redacted client errors, configured-threshold latency, billing warnings, Research spend rejection, sanitized runtime errors, and 5xx observations.
- [x] A named support and urgent-alert owner and support address are documented.
- [x] Upgrade the commercial production service from Vercel Hobby to Vercel Pro.
- [x] Configure and live-verify the included Permitext-scoped Vercel 5xx-anomaly and infrastructure-usage-anomaly rules with owner email/web subscriptions.
- [ ] Complete the remaining monitoring coverage and delivery exercises for health, 5xx/client failures, billing webhooks, database failures, Research spend, and p95 latency.
- [x] Configure a $20 Vercel on-demand spend amount, standard spend notifications, and automatic Production pause for all projects on the team.
- [ ] Exercise a delivered spend notification and actual hard-stop behavior without exposing customers or incurring an uncontrolled overage.
- [x] Add a fail-closed read-only restore comparator and complete its no-provider local end-to-end rehearsal, including deliberate missing-record detection.
- [x] Complete a real point-in-time Neon child-branch recovery, exact durable-content comparison, Production-commit local compatibility check, and authenticated private Blob inventory/retrieval under the retained no-deploy/no-paid constraints.
- [ ] Complete the remaining isolated recovery acceptance: serve the exact Production commit against the recovered Neon state in an isolated deployment and validate restore into a separate private Blob namespace, or record explicit owner risk acceptance.
- [x] Add the timed synthetic support-tabletop record and cross-document support-process contract.
- [x] Complete the first timed Codex-assisted support tabletop and retain the operator record.

Operations runbook: [BETA1_OPERATIONS_RUNBOOK.md](./BETA1_OPERATIONS_RUNBOOK.md)

## 7. Merge, deploy, and release sequence

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
- counsel-approved customer documents, stable URLs, and required policy acceptance are complete;
- remaining Production alert coverage and delivery/hard-stop behavior are tested;
- remaining isolated recovery acceptance succeeds or its residual risk is explicitly accepted; and
- Production web and the final TestFlight build are verified against the exact intended release SHA.

## Not part of this immediate Beta 1 gate

- Public Zoning Research.
- Team/firm collaboration expansion.
- Annual subscriptions.
- Publishing turn-pack prices before the current measurement and lifecycle gates pass.

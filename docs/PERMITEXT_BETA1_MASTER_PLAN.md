# Permitext Beta 1 — Master Plan and Current Status

Last updated: August 27, 2026

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

The product foundation is substantially built, but Beta 1 is **not ready for public paid release**. The active work is the final targeted Research quality and economics validation: the first full cohort and remediation cohort completed without provider failures, the movable-seating and garage-ventilation blockers now pass, and one source-bound sidewalk-café confirmation remains before a new frozen cohort. After that, the remaining legal, provider, operations, production, and TestFlight gates must be closed.

Current development branch: `codex/research-commercialization`

## 1. Core product and cross-platform foundation

- [x] Web and iOS share the account, entitlement, Project, saved-content, and Research backend contracts.
- [x] Account deletion, sign-out, sync/account presentation, and Research Project context have cross-platform coverage.
- [x] Free/Pro wording and the $20 monthly / 100-turn allowance are aligned across platforms.
- [x] Research responses expose enacted citations, source/edition state, uncertainty, authority classification, and the unofficial-research disclaimer.
- [x] Zoning public Research remains disabled while the reader/search corpus can continue to exist separately.
- [ ] Recheck the final merged build on both production web and the physical iPhone before release.

## 2. Research quality and economics — active now

- [x] Implemented Luna-first routing with Terra escalation or repair.
- [x] Implemented model, cost, latency, verification, and escalation telemetry.
- [x] Completed the first frozen 20-case commercialization cohort with 20/20 operations and no provider failures.
- [x] Measured approximately $5.35 operating model cost per 100 turns, 20.388-second p50 latency, and 37.349-second p90 latency.
- [x] Identified 9 exact passes and 11 completed answers needing qualification, missing-fact, or evidence-boundary improvement.
- [x] Finish the generic safeguard for declared unknowns and unverified owner/applicant representations.
- [x] Complete the repository-wide no-cost test gate.
- [x] Rerun the 11 subthreshold cases and subsequent three-case diagnostics under explicit spend caps.
- [x] Confirm the final source-bound sidewalk-café repair with one capped paid case; it passed 4.00/4.
- [ ] Run a new frozen full cohort only if the targeted cases improve without material regressions.
- [ ] Confirm that p50/p90 full-service cost supports the $20 plan and 100 included turns.

Detailed plan: [PERMITEXT_RESEARCH_COMMERCIALIZATION_CURRENT_PLAN.md](./PERMITEXT_RESEARCH_COMMERCIALIZATION_CURRENT_PLAN.md)

## 3. Billing and paid continuation

- [x] Stripe production Pro product is $20 per month and trials are disabled.
- [x] The server has monthly included turns, paid-credit reservations, completion, release, refund, idempotency, and reconciliation contracts.
- [x] Failed provider requests and internal retries do not charge additional user turns.
- [x] Turn-pack offers are gated so incomplete configuration is not shown to users.
- [ ] Redeploy production after final environment/configuration changes and verify the serving release uses the intended $20 price.
- [ ] Complete controlled signup, purchase, entitlement, cancellation, full refund, partial-refund behavior, and webhook recovery exercises.
- [ ] Create/approve and end-to-end test Stripe and App Store consumables before enabling additional-turn sales.
- [ ] Set pack prices only after p50/p90 hybrid cost, fees, tax, refund, infrastructure, support, and margin calculations are complete.

Detailed configuration: [BETA1_COMMERCIAL_CONFIGURATION.md](./BETA1_COMMERCIAL_CONFIGURATION.md)

## 4. Authentication and account lifecycle

- [x] Clerk account flows support passwordless email, Apple, Google, and Microsoft in the product contract.
- [x] The iOS Apple flow no longer requires the user to re-enter an email in the verified build path previously tested by the owner.
- [x] Account deletion explains the destructive scope and distinguishes Permitext deletion from Apple subscription cancellation and external identity providers.
- [ ] Reverify fresh-account and existing-account sign-in for Apple, Google, Microsoft, and email in production after the final deployment.
- [ ] Complete one production-configured account export/deletion lifecycle and confirm provider/local cleanup results are reported accurately.
- [ ] Record OAuth credential rotation reminders and ownership.

## 5. Legal, privacy, and customer promises

- [x] Product-level professional-use, authority, privacy, retention, deletion, and Research-provider disclosures are implemented and covered by contracts.
- [x] Working commercial decisions and a working refund policy are documented.
- [ ] Decide the minimum user age.
- [ ] Decide whether customers may upload confidential, regulated, or personally identifying project material and document the rule.
- [ ] Obtain counsel review of Terms, Privacy Policy, subscription/cancellation disclosure, refund policy, Acceptable Use Policy, and professional-use/AI notice.
- [ ] Publish stable counsel-approved URLs and ensure web/iOS purchase screens match them.
- [ ] Record policy-version acceptance where required.

Release checklist: [BETA1_LEGAL_READINESS_CHECKLIST.md](./BETA1_LEGAL_READINESS_CHECKLIST.md)

## 6. Hosting, monitoring, backup, and support

- [x] Release identity, health endpoints, structured runtime errors, client-error redaction, billing warnings, and Research spend events exist.
- [x] A named support and urgent-alert owner and support address are documented.
- [ ] Upgrade the commercial production service from Vercel Hobby to an appropriate paid plan before accepting paying users.
- [ ] Configure and exercise monitoring alerts for health, 5xx/client failures, billing webhooks, database failures, Research spend, and p95 latency.
- [ ] Set and test the intended infrastructure spend notifications and hard-stop behavior.
- [ ] Complete the first isolated backup/restore drill and retain the evidence.
- [ ] Confirm the documented support response process can be operated.

Operations runbook: [BETA1_OPERATIONS_RUNBOOK.md](./BETA1_OPERATIONS_RUNBOOK.md)

## 7. Merge, deploy, and release sequence

This sequence begins only after the active Research gate is acceptable.

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

Beta 1 remains blocked until:

- Research quality and p50/p90 economics pass the current gate;
- the full payment, cancellation, refund, and reconciliation lifecycle passes;
- counsel-approved customer documents and remaining owner policy decisions are complete;
- production hosting and alerting are commercially appropriate and tested;
- the first backup/restore drill succeeds or the risk is explicitly accepted;
- production web and the final TestFlight build are verified against the exact intended release SHA.

## Not part of this immediate Beta 1 gate

- Public Zoning Research.
- Team/firm collaboration expansion.
- Annual subscriptions.
- Publishing turn-pack prices before the current measurement and lifecycle gates pass.

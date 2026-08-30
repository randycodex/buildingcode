# Permitext Research commercialization risk-prioritized semantic review

Status: **No blocking source defect found in reviewed paths; final release review remains open**

Date: August 30, 2026

This is a no-input, risk-prioritized review of the commercialization branch. It supplements the automated [branch-integrity audit](./PERMITEXT_RESEARCH_COMMERCIALIZATION_BRANCH_INTEGRITY_AUDIT_2026-08-30.md); it is not the final line-by-line review of the eventual release commit and does not authorize release work.

## Review boundary

- Baseline and merge base: `c1393d4a0d3806dd75263eb8adad23f19dfc106a`
- Reviewed branch tip before this evidence-only record: `775b4d2b82b3839cc59af805cdfc3433cceaebe3`
- Commit count in the reviewed range: 72
- Changed paths: 452
- Compressed generated code-content files: 321 `.lzfse`
- Executable, configuration, test, manifest, and documentation paths outside that compressed set: 131

The generated compressed corpus was not represented as human-readable line diff. Its source/manifests, loaders, inventory generators, and integrity/figure/navigation contracts were reviewed or exercised separately.

## Risk review matrix

| Area | Principal paths reviewed | Result and retained boundary |
| --- | --- | --- |
| V6 economics | `research-economics.mjs`, V6 report script, immutable benchmark snapshot, economics contracts | Subscriber aggregation, fees, reserves, volume sensitivity, and decision-status gating are explicit. The model remains planning-only while commercial inputs are unverified; actual incidence still requires 25–50 customers. |
| Stripe Checkout and lifecycle | `app.mjs`, `stripe-tax.mjs`, PostgreSQL subscription-event state, billing and provider-simulated lifecycle contracts | Checkout requires an authenticated owner, current policy acceptance, same-origin return URLs, configured live billing, and configured tax in Production. Provider events are signature-checked and persisted with ordering/idempotency state. The real Production lifecycle remains separately authorized and open. |
| Apple lifecycle | signed-transaction and notification handling in `app.mjs`, PostgreSQL ownership/notification state, StoreKit account binding and refund presentation in iOS, Apple lifecycle contracts | Production rejects Sandbox/Xcode transactions, signed ownership is account-bound, newer notification state prevents stale regrant, duplicates are write-inert, and refund UI uses a verified active StoreKit transaction. A subsequent authenticated read-only inspection verified parent category `App Store software` and subscription `Match to parent app`; owner classification confirmation, real financial evidence, and final Production/TestFlight device acceptance remain open. |
| Authentication and policy consent | `clerk-auth.mjs`, `policy-acceptance.mjs`, account persistence, web/iOS clients, auth and policy contracts | Policy acceptance is authenticated, server-timestamped, version-matched, bounded to web/iOS, and checked again before web Checkout. The clients reload current versions before purchase. Exact Production publication and fresh/existing sign-in acceptance remain open. |
| Account deletion and billing cleanup | deletion handler, Stripe cancellation plan, identity runbook and contract | Deletion stops when Stripe cancellation or private-asset cleanup fails, avoiding a falsely successful partial result. Apple cancellation remains a customer/App Store action and is disclosed. A dedicated Production export/deletion exercise remains open. |
| Monitoring, recovery, and release controls | monitoring audit, restore comparator, deploy verifier, public-Beta readiness record, branch preflight | Logs and evidence reports are aggregate/redacted; deployment and activation gates fail closed; evidence is exact-commit bound; additional-turn sales remain disabled. Delivered anomaly/hard-stop evidence and final release authorization remain open. |
| Web purchase surface | settings purchase flow, confirmation route, policy pages, service-worker/routing contracts | Consent is required before Checkout, policy changes clear the local checkbox, the success route accepts only a constrained Stripe session identifier, and the durable confirmation page avoids inserting query content as HTML. Approved live policy bytes are not yet deployed. |
| iOS presentation and shared Research response | StoreKit sheet, refund UI, Research models/view, shared V6 fixture and source contracts | The client decodes the shared response contract and distinguishes local/Sandbox Pro from Production entitlement. A fresh Release build and physical-iPhone verification were deliberately not run as part of this unauthorized release sequence. |
| Generated code content | native-reader index/manifests, inventory generator, prepared compressed chapters, content/figure/navigation tests | The complete repository check passed content, figure binding, asset serving, hierarchy, and reader navigation contracts. This proves structural integrity, not a new human legal/content review of every compressed provision. |

## Findings

1. No blocking source defect was found in the reviewed commercialization-sensitive paths.
2. The branch does not convert planning inputs into verified commercial facts: its V6 report keeps `commercialDecisionReady` false while inputs remain unverified.
3. Production purchase paths are fail-closed while tax and approved-policy version keys are absent. The dormant source does not itself activate Stripe tax, publish policies, or create a charge.
4. Additional-turn purchase code remains behind the disabled feature gate. Before any future activation it still needs its own visible products, policy/tax treatment, pricing, refund, fulfillment, and cross-platform acceptance.
5. The iOS project file and `Info.plist` also contain pre-existing unstaged user changes. They were not reconciled or included; the final semantic review and Release build must preserve or explicitly resolve them.
6. Automated checks cannot prove hidden Production values, provider-dashboard state, live notification delivery, a real billing lifecycle, or physical-device behavior. Those gates remain open in the master plan and public-release record.

## Verification used

- Complete 72-commit path and commit inventory
- Risk-focused source/diff inspection for billing, entitlement ordering, policy acceptance, authentication, deletion, Research economics, monitoring, recovery, web purchase, iOS StoreKit, and release guards
- `npm run check` — passed without paid model calls
- `npm run test:beta1` — passed without provider charges or Production writes
- `audit:release-branch` — exact branch/ancestry, whitespace, dirty-scope, credential-like filename, redacted added-line, and changed-file-at-HEAD checks

## Final boundary

Master-plan release step 1 remains open. Repeat the semantic review against the exact selected release commit after all remaining source/configuration work is complete, reconcile the overlapping local iOS/Xcode paths, then run the separately authorized Release/Production/TestFlight sequence.

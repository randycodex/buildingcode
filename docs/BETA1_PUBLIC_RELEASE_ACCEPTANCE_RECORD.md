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
Status: **CURRENT WEBSITE/BACKEND PUBLICATION VERIFIED — final selected-release machine binding remains open**
Release-bound: **yes**

Latest publication: the [September 6 handoff repairs](./PERMITEXT_RESEARCH_HANDOFF_REPAIRS_2026-09-06.md)
track owner-approved PR #58 at merge commit
`e60ca415fe8b7b60be65449b7ef49baccc82eec3`, Production
`https://permitext-sync-3wkca40x7-randycodexs-projects-b72fc111.vercel.app`
(`dpl_5rp8vnZ9yZ6XBRWbFHofaD7jQqo9`), release `e60ca415fe8b`. At
`2026-09-06T14:03:10.518Z`, Codex verified both origins returned the exact source,
healthy storage and six matching web assets. Health, universal-link and approved
policy checks passed. Build 62's signed archive from the same source passed
configuration, signature, dependency and packaged privacy checks. Upload
succeeded at `2026-09-06T14:10:03.283Z`; Apple processing is complete and build
`1fc6a88c-1f12-494f-b9a1-7fe197349184` is available to Internal Testers with one
tester. The owner subsequently installed build 62. Its Account footer, usual
Lifetime Pro/98-turn/Synced state and saved-data continuity were independently
verified. The [build-62 retained handoff check](./PERMITEXT_BUILD62_HANDOFF_ACCEPTANCE_2026-09-06.md)
passed current web Note navigation, lower native Note review and both actual
Report exports, with every PDF page inspected and existing Research/Note/history
integrity verified. The owner confirmed the Chrome Production PDF download;
the in-app browser's download action produced no result and remains unaccepted.
Temporary Pro is independently revoked and both browser test sessions are signed
out. At the owner's request, the phone retains the Free, Synced test session for
continued audit work; repeated main-account restoration is no longer required.
Final candidate binding stays open.
No additional Research turn or public App Store submission is included.

Preceding publication: the [September 6 confirmation](./PERMITEXT_RESEARCH_HANDOFF_CONFIRMATION_2026-09-06.md)
tracks owner-approved PR #57, merge commit
`4ed4b5b9f4eba77683af8aedb4f38fc3e0b4421e`, release `4ed4b5b9f4eb`,
Production `https://permitext-sync-orugmme7o-randycodexs-projects-b72fc111.vercel.app`
(`dpl_B8JvS8JLqUr7fSpuKTBZmGP2arNV`). Both origins' release and health were
verified at `2026-09-06T03:39:42.064Z`; Production health passed. The backend-only
repair preserves the previously installed build-61 native runtime. The one
approved confirmation completed with 2014-only sources, no web lookup and
conservative estimated cost $0.159382 within its $0.50 cap. One included test
turn was deducted. Full handoff acceptance remains open for unrelated authority
text after verification, a silent Note-reference failure, and Report
edition/citation/formatting defects. See the confirmation record for retained
artifacts, physical checks, cleanup and their limits. Final candidate binding
and owner release approval remain open.
The subsequent handoff repairs above address these captured defects and record
completed owner-session restoration. Their local checks and Production
publication do not establish physical acceptance of the new native candidate.
Build 61's bounded physical table-pan result is retained in the
[Reader acceptance record](./PERMITEXT_READER_ACCEPTANCE_REPAIRS_2026-09-05.md).

Preceding September 5 web recovery evidence: the [audit execution record](./PERMITEXT_AUDIT_ACCEPTANCE_EXECUTION_2026-09-05.md)
tracks PR #52 at `ae40953603cf9308a64d6da5657c27cf9175d99b`, Production
`dpl_8oTbEHtNFGLHTXftsvV7MPvM1zQx`, exact assets/health and the live Report
snapshot/export/concurrency checks. The native Project-facts PDF repair passed
its test and two-page visual inspection. Build 60 is uploaded, internally
available and physically installed; its actual PDF export preserves the qualified
facts. Temporary Pro test access is revoked and the native permission message
and Free plan were verified. Separately approved populated-account deletion
passed on build 60, with independent zero-record/private-file checks, Clerk
Production lookup and signed-out web reload. Broader release acceptance remains
separate; unknown-owner historical caches are not claimed erased.

Preceding September 5 web recovery evidence in that record
tracks PR #51 at `41ba0314dbfc9de17698b5dca37bbb7d74bd4490`, Production
`dpl_6EYL8gqmari9dcq9B3NJEnZchiew`, matching release/asset checks on both
origins, PostgreSQL health and the rendered secure sign-out regression.
The owner-approved email requirement and fresh email registration passed.
Native runtime at that preceding checkpoint remained build 59; broader
cross-device and final release gates remain open in that execution record.

Preceding September 5 recovery evidence: the [verification repair record](./PERMITEXT_ACCOUNT_DELETION_REVERIFICATION_REPAIR_2026-09-05.md)
tracks verified web source `38ba9536d36ae5099376482dbbe4cf44f0ea5142` through
PRs #46–49 (both origins, six byte-identical assets each) and native build 59, archived from
`68efc23956939bfd79d592173db8cce5628cc3a8`. The later web-only changes preserve
its native runtime/project inputs. Build 59 completed Apple processing and is
available internally. Physical TestFlight installation, the in-app build-59 footer,
existing account/plan/sync/Project-container/Saved continuity, and deletion
initial disclosure/cancellation passed. Live native verification/deletion and
the full device matrix remain open. Earlier checkpoints below retain their
original sources and do not select the final release.

- Historical application checkpoint: `9a89e54e7b70ccb7567b784443b232df005a10ac`, deployment `dpl_HWoChFH39P9eYKeCE3uNvBJUaDd3`, READY.
- Both canonical origins returned that exact application SHA, Production environment and deployment host at `2026-09-05T05:09:38Z`.
- Served app, offline-storage, service-worker and stylesheet bytes matched the tested source on both origins. The HTML and rendered browser loaded client `20260905-saved-section-visibility-v38`.
- PostgreSQL `normalized-v4` health, AASA and approved-policy publication checks passed. The bounded deployment error/fatal aggregate was empty; this is not sustained-load or latency evidence.
- The designated disposable account retained four saved entries, one synthetic note and one empty collection after reload. Gates and Slope remain visible, the 2014 Reader is retained, and the legacy workspace ownership warning remains. Correct edition reopening was verified in the preceding Saved visibility publication, whose client bytes are unchanged.
- Evidence: [native navigation repair publication](./PERMITEXT_READINESS_REPAIRS_PUBLICATION_2026-09-04.md#native-navigation-labels-and-build-58), following Saved visibility, account-export, private-file ownership, account-operation and shared-data repairs in that same record.
- The signed build-58 archive matches the current full Production source and passed verification. After the owner restored Apple sign-in, the same archive uploaded successfully and is processed and available to Internal Testers. Both canonical Production origins still returned that source at `2026-09-05T12:31:34Z`. Build 58 subsequently passed installation, displayed build identity and bounded existing account/plan/sync/Saved/Project-container continuity on the iPhone 17 Pro. Broader device/account acceptance remains open. See the [successful retry and device record](./PERMITEXT_READINESS_REPAIRS_PUBLICATION_2026-09-04.md#build-58-upload-after-apple-sign-in-recovery).
- Historical build-51 binding to `195de4f31229d785760eef570a658208f1f4e47d` remains in its [physical-iPhone record](./PERMITEXT_BETA1_BUILD51_PHYSICAL_IPHONE_ACCEPTANCE_2026-09-03.md).

The final shared web/TestFlight candidate remains unselected. Source publication, TestFlight availability, physical acceptance and owner go/no-go are separate evidence layers; all machine gates remain open.

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
Status: **OPEN — email registration/sign-in and bounded populated deletion passed; remaining providers, link/stale-client edges and final-release binding remain open**
Release-bound: **yes**

Current reconciliation: [the September 5 execution](./PERMITEXT_AUDIT_ACCEPTANCE_EXECUTION_2026-09-05.md)
records repaired fresh email registration, existing-account email sign-in on web
and phone, and build-60 populated deletion. Independent exports, all five exact
private-file checks, Clerk directory absence and second-client signed-out reload
passed. Build 62 retained ordinary account/data continuity, and its scoped test
grant is revoked. The phone intentionally remains signed into the Free test
account during continuing audit work. The [original-audit checklist](./PERMITEXT_ORIGINAL_AUDIT_CLOSEOUT_2026-09-06.md)
maps remaining link/stale-client coverage without reopening these passed cases.

Earlier September 5 correction: operator access and the designated Free-account
export passed after the owner replaced the administrator credential. The owner
then completed the deletion action; backend and attributable browser content
were absent, but Clerk identity removal required fresh verification and did not
complete. Sign in recreated the same identity with empty Free-account content.
The [reverification repair record](./PERMITEXT_ACCOUNT_DELETION_REVERIFICATION_REPAIR_2026-09-05.md)
supersedes the credential/export/deletion-pending statements in the earlier
snapshot below. The owner approved retrying deletion of the same freshly exported empty Free
account after the repair. Live verification and safe cancellation passed, then the approved deletion
completed. Independent exports proved account/session/entitlement/all records
absent; the Production Clerk directory returned no user for the exact approved
email. Signed-out reload passed. The phone's Lifetime Pro account is separate and was
not a deletion target. Provider cleanup is complete for this empty account. Fresh recreation,
populated private-file and second-client acceptance remain open.

Earlier September 5 snapshot (superseded by the correction above): build 58 is processed and internally available, with its installation, displayed build identity and existing native account/plan/sync/Saved/Project-container continuity physically verified. Current web continuity and account-operation repairs are recorded in the [repair publication record](./PERMITEXT_READINESS_REPAIRS_PUBLICATION_2026-09-04.md#build-58-upload-after-apple-sign-in-recovery). Fresh email registration is blocked by the unchanged hosted-provider configuration. The designated Free test account has four saved entries, one synthetic note and an empty collection, but its complete operator export, representative Project/Research/private-file coverage, reviewed deletion, provider cleanup and recreation remain open. The current Production operator credential is still required. These observations do not satisfy the fresh sign-in fields below.

- Fresh-account email-code sign-in: passed on Production after enabling required email; the same new account subsequently signed into the physical client. See the September 5 execution.
- Fresh-account Apple sign-in:
- Fresh-account Google sign-in:
- Fresh-account Microsoft sign-in:
- Existing-account email-code sign-in retained the correct Permitext account/data: passed on web and phone for the designated existing test account, with retained Projects/Notes/Research and Synced status in later build-62 checks.
- Existing-account Apple sign-in retained the correct Permitext account/data: historical build-51 owner observations and build-52 Mirroring observations retain the signed-in account, Lifetime Pro, Synced, saved content and Project containers. These are persisted-session checks, not fresh Apple sign-in. Build 51 additionally retained an explicitly selected Project in Research. Representative saved Project-item coverage was not established.
- Existing-account Google sign-in retained the correct Permitext account/data:
- Existing-account Microsoft sign-in retained the correct Permitext account/data:
- Dedicated disposable-account pre-deletion export and aggregate baseline captured safely: passed for the approved populated synthetic account: one Project, one Note, one image, two Report versions/four PDFs, zero Research usage or paid entitlements. Other ownership/Research categories retain their separate coverage boundary.
- Customer-interface deletion reported every applicable billing, data, private-asset, device, and Clerk stage accurately: passed for that build-60 no-recurring-billing account, including disclosed retention of unknown-owner historical cache files. Paid billing and shared ownership are separate cases.
- Deleted session failed, private asset disappeared, and recreated identity returned an empty Free account: account/session/records and all five exact private files were absent after populated deletion and browser reload; Clerk identity absence passed. Recreation was observed in the earlier partial cleanup exercise, not after this final populated deletion.
- Disposable account and test content cleanup completed under separate authorization: the distinct empty web and populated native targets were separately approved and removed, including independent Clerk-directory checks. The current designated test account is intentionally retained and is not a deletion target.
- Evidence: [build 51](./PERMITEXT_BETA1_BUILD51_PHYSICAL_IPHONE_ACCEPTANCE_2026-09-03.md), [build 52](./PERMITEXT_RESEARCH_RECOVERY_RELEASE_2026-09-03.md#september-3-physical-iphone-continuity-check), and [partial Production deletion](./PERMITEXT_BETA1_PRODUCTION_ACCOUNT_DELETION_2026-09-02.md).

Follow [the detailed account export/deletion checklist](./BETA1_BILLING_IDENTITY_RUNBOOK.md#production-account-exportdeletion-acceptance). Never use the owner's primary, administrator, Lifetime Pro, or real customer account. Consolidating historical evidence does not authorize another destructive exercise.

## Exact policy publication

Gate ID: `exact-policy-publication`
Status: **OPEN — exact current-candidate publication passes; final-client consent confirmation remains open**
Release-bound: **yes**

- Strict live publication audit returned `publicationReady: true` for Terms, Privacy, and Subscription/Refund policy: yes at `2026-09-03T10:33:44.038Z`. The September 5 exact-source repair publication also passed the strict live audit; see the [current publication evidence](./PERMITEXT_READINESS_REPAIRS_PUBLICATION_2026-09-04.md#whole-section-saved-visibility-publication).
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
Status: **OWNER-ACCEPTED BOUNDED ALTERNATIVE — historical delivery/configuration evidence retained; selected-release machine binding remains open**
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
Status: **OPEN — build-62 Note/Report acceptance and earlier bounded recovery/table checks passed; remaining device/context coverage and final candidate selection remain open**
Release-bound: **yes**

### Current candidate and latest verified clients

- Latest verified product source: `e60ca415fe8b7b60be65449b7ef49baccc82eec3`, Production deployment `dpl_5rp8vnZ9yZ6XBRWbFHofaD7jQqo9`, physical Permitext 1.0 (62). The source/archive/upload/Apple-processing binding is in the [September 6 repair publication](./PERMITEXT_RESEARCH_HANDOFF_REPAIRS_2026-09-06.md#approved-publication).
- [Build-62 acceptance](./PERMITEXT_BUILD62_HANDOFF_ACCEPTANCE_2026-09-06.md) passed current web Note navigation, lower native Note fields, both actual Report PDFs with all nine pages inspected, and immutable record integrity. Chrome Production PDF download is owner-confirmed. The in-app browser download remains unaccepted.
- Temporary Pro is revoked; the phone shows Free Active/Billing None/Synced and intentionally retains the test identity at the owner's request. Both browser test sessions were signed out before that preference change.
- The final public-release candidate remains unselected. The [original 17-finding checklist](./PERMITEXT_ORIGINAL_AUDIT_CLOSEOUT_2026-09-06.md) assigns the remaining client/context, recovery, accessibility/performance and release work. Existing passed checks below retain their original build scope.

### Earlier build-60 observations retained with their original limits

- Then-verified repair source: `ae40953603cf9308a64d6da5657c27cf9175d99b`, Production deployment `dpl_8oTbEHtNFGLHTXftsvV7MPvM1zQx`, with both origins, six assets each, and PostgreSQL health verified.
- Build 60 archived from that source; executable SHA-256 `b6af915ada081303619352c299cecaac78e91ff4e754c3a519e844869e2b928e`. Upload succeeded at `2026-09-05T20:38:47.421Z`; Apple processing and the existing Internal Testers group with one invite were verified at 20:48 UTC.
- The owner installed 1.0 (60); physical TestFlight displayed Open at approximately `2026-09-05T20:59Z`. The disposable account and synthetic Project recovered. The actual iOS PDF saved successfully and visibly preserved the qualified Project facts, reconciled Report edits and professional-use notice.
- Final temporary-grant revocation was independently confirmed at `2026-09-05T21:02:53.869Z`, with synthetic records retained and zero Research usage. The phone showed an explicit requires-Pro Notebook message and Free Active/Billing None/Synced. Broader physical offline, unsent-draft, account-lifecycle and professional Research acceptance remain open.
- The owner separately approved populated-account deletion. Build 60 completed native verification/deletion; exact-target checks at `2026-09-05T21:16:47.510Z` and after web reload at `2026-09-05T21:18:43.672Z` confirm all account/session/record counts zero and all five private Blob files absent. Clerk Production lookup returned no matching identity/email. Native cleanup disclosed retained unknown-owner historical caches; this bounded result does not close the full privacy/account-link/device matrix.
- Evidence: [September 5 audit execution](./PERMITEXT_AUDIT_ACCEPTANCE_EXECUTION_2026-09-05.md).

### Earlier build-58 observations retained with their original limits

- Production application source: `9a89e54e7b70ccb7567b784443b232df005a10ac`, verified on both canonical origins at `2026-09-05T05:09:38Z`.
- Uploaded native candidate: signed `1.0 (58)` archive from that same full source, executable SHA-256 `beb83a75f74b80eb96a44d121677a9e18155f050808de658e471672bb25d8316`. Archive signing, Production configuration, pinned dependencies and semantic privacy aggregation passed. The same archive was reused after Apple sign-in recovery; upload succeeded at `2026-09-05T12:32:56.741Z` with export exit 0.
- Latest confirmed internally available TestFlight build: `1.0 (58)`, App Store Connect record `c2408f97-fe34-4a83-9e3e-07e5ea779197`. Upload status is Complete and build status is Ready to Submit, with Internal Testers and one invitation. Bounded physical installation and continuity passed; broader acceptance remains open.
- Last physically verified installation: `1.0 (58)` on the iPhone 17 Pro, independently confirmed in the running app Account footer at approximately `2026-09-05T12:45Z` after the owner installed the TestFlight update. Existing signed-in account, Lifetime Pro, 98 remaining included turns, Synced status, saved Building Code passage, Project containers and Fuel Gas Code 2022 selection were retained. Saved, First reader and Account navigation passed. This does not establish all final-candidate workflows.
- Build 58's Release Simulator capture passed destination accessibility names, chapter/edition identity, Reader, Search and Saved navigation. Four inspected screenshot candidates are retained. These checks do not replace physical VoiceOver, offline/recovery, account-lifecycle or professional-handoff acceptance.
- Earlier physical wide-table and VoiceOver observations remain bounded build-54 evidence. They are not a build-58 device result.
- Build-58 physical VoiceOver spot-check: the owner reported chapter and bottom-menu announcements and affirmed the chapter-number clarification. This is bounded user confirmation, not full accessibility certification or independently recorded exact wording for every control.
- Build-58 saved/search reopening: the existing saved Electrical passage opened at Building Code 2022 `101.4.1`; the existing `concrete` search returned 200 results and its `28-406.1` result opened at General Administrative Provisions 2022, Chapter 4, `28-406.1`. Fuel Gas Chapter 5 restored the prior `504.2` table position. No fresh horizontal-gesture, offline, termination, conflict or professional-handoff result is claimed.
- Evidence: [build-58 publication and verification](./PERMITEXT_READINESS_REPAIRS_PUBLICATION_2026-09-04.md#native-navigation-labels-and-build-58), [successful upload and availability](./PERMITEXT_READINESS_REPAIRS_PUBLICATION_2026-09-04.md#build-58-upload-after-apple-sign-in-recovery), and [build-56 device continuity](./PERMITEXT_READINESS_REPAIRS_PUBLICATION_2026-09-04.md#native-archive-and-upload).

### Earlier build-51/52 observations retained with their original limits

- Then-verified website/backend application source: `0688e6b0564d44a92c803af3e1cfbbe6f87a2911`; superseded by the current publication above.
- Installed native archive: version `1.0 (52)`, source `1873ba6453bf6f3d1f076e34fa2ddfb96b9cf40c`, executable SHA-256 `abff19908971e29ef9c2cc99ea60ea8c474b08f300c69b75320ddde31fdc21c6`. No replacement binary was created by the later Notebook/privacy publication.
- App Store Connect processing, Internal Testers assignment, owner installation and exact build identity: retained for build 52. This is not public App Store approval.
- Physical-iPhone account/sync/representative continuity: existing signed-in account, Lifetime Pro, Synced, saved section and existing Projects observed on build 52. Fresh-provider and broader saved Project-item coverage remain open.
- Free/Pro and restore/cancellation/refund presentation: Lifetime Pro observed; retain separately bound earlier billing evidence without inventing final-client coverage.
- 2014 Reader: build 51 closed the specific Chapter 7 missing-HTML defect. Build 52 retained Chapter 7, chapter search and complete Figure 705.7. Table 705.8's horizontal gesture remains unresolved; the owner handles UI/UX and screenshots.
- Research: build-51 authorization was consumed by a 105-second HTTP 502 verification failure with no delivered answer; that attempt's actual spend and persisted ledger outcome remain unverified. A separately authorized Unassigned build-52 question completed/reopened with HTTP 200 in 34.9 seconds, estimated API cost `$0.057825`, conservative accounting `$0.114176`, and one visible allowance decrement. Answer completeness and the original Project-context scenario remain unaccepted. Neither authorization permits another attempt.
- Account-deletion presentation and complete cross-client recovery: open; retain the partial prior deletion record.
- Backend/entitlement environment: build 52 uses canonical Production and displayed Lifetime Pro, not Sandbox. The newer compatible backend and older installed binary have different source SHAs; final common-candidate binding is not claimed.
- Evidence: [historical build 51](./PERMITEXT_BETA1_BUILD51_PHYSICAL_IPHONE_ACCEPTANCE_2026-09-03.md), [failure outcome](./PERMITEXT_RESEARCH_FAILURE_RECOVERY_2026-09-03.md#observed-attempt), [build 52 release/device record](./PERMITEXT_RESEARCH_RECOVERY_RELEASE_2026-09-03.md), and [separate live answer](./PERMITEXT_BUILD52_RAMP_LIVE_TEST_2026-09-03.md).

Source, tests, upload/processing and this documentation merge do not replace final physical-device acceptance or authorize an Apple submission.

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
- Production and TestFlight repair publication was explicitly authorized in the active work session; this does not authorize public App Store submission or public paid Beta.
- Next technical step: after the owner returns with the phone, install internally available build 62 and bind the [September 6 handoff repairs](./PERMITEXT_RESEARCH_HANDOFF_REPAIRS_2026-09-06.md) to physical-candidate and hosted handoff acceptance. PR #58 is verified on Production; build 62 shares that source. Owner account restoration is complete. Web/native populated-account deletion and the bounded build-61 table repair retain their separate evidence. All three recorded ramp-turn approvals are consumed.

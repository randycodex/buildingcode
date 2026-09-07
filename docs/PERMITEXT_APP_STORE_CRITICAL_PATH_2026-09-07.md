# Permitext — App Store critical path

## Controlling scope

On September 7 the owner instructed: **“dont do anything that is not needed
for the app to make it to the apple store.”** This narrows the earlier six-part
production-audit closeout. Future work must identify a concrete App Store
submission requirement or a functional defect in the submitted iPhone app.
The owner then clarified: **“now, if its needed for the web, ok- but if not,
then forget it.”** Necessary web functionality and reproduced web defects are
also in scope. Optional branding, enterprise certification and infrastructure
expansion are not. Personal Microsoft web sign-in already passed without a
verified-publisher badge; no current web defect requires Partner enrollment.

The broader audit remains historical evidence; its remaining coverage is not
automatically a reason to delay submission or perform more work.

The owner leads UI changes. Screenshots wait until that UI is ready. VoiceOver
was separately deferred. Existing completed deletion, table, offline-reading,
Account-X and Note/Report checks retain their recorded scope and should not be
repeated without a relevant change or failure.

## Remaining submission work

1. **Resolve the native purchase preflight blocker.** Build 63 repeatedly stops
   at the expired Sandbox transaction queue before Apple's confirmation sheet.
   The exact tester's history reset, verified sign-in and clean app restart did
   not resolve it. Diagnose the StoreKit queue or isolate it with a fresh tester;
   do not repeat the same sequence or weaken transaction/ownership guards.
   Confirm native policy submission and purchase-sheet access using the existing
   no-purchase acceptance scope. See the [native consent evidence](./PERMITEXT_IOS_POLICY_CONSENT_2026-09-07.md).
2. **Verify the sign-in options actually offered by the submission build and
   provide reliable reviewer access.** Current web Microsoft passes do not
   establish native acceptance. Use the final offered login paths and a stable
   review account/demo route; supply App Review notes and credentials through
   App Store Connect. Reuse existing account-deletion evidence.
3. **Complete required App Store Connect material.** Reconcile privacy answers
   against actual data/SDK behavior, age/content-rights declarations, subscription
   material, reviewer notes/access, and any outstanding Apple agreements/tax/bank
   requirements actually needed by this app. Do not invent business/legal facts.
   Previously supplied reviewer contact details stay out of source control.
4. **Bind the final submission build and perform focused acceptance.** Check
   the exact build's launch, offered login, purchase flow and core Saved/Reader/
   Project/Note/Report functions. Keep the backend live for review. After the
   owner's UI work, capture required screenshots, select the build and complete
   submission metadata. Record remaining product limitations accurately.

Apple's [Before You Submit checklist and App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
require a functional app, complete metadata and reviewer access. Its
[login-services rule](https://developer.apple.com/app-store/review/guidelines/#login-services)
applies to offered login choices. Microsoft Partner enrollment and a Microsoft
verified-publisher badge are not Apple submission requirements.

## Deferred from this execution

- Microsoft Partner enrollment, verified-publisher badge and business-email setup.
  The owner confirmed no working `@permitext.com` mailbox. Partner Center's
  authorized personal Outlook session exposed no usable Partner ID and its
  enrollment requires a work account. No business registration, paid plan,
  work-account creation, mailbox setup or Partner agreement was submitted.
- Broader enterprise-provider certification, artificial hosted concurrency
  drills, OS/browser eviction certification, additional performance sampling
  and monitoring-budget drills, unless a concrete submitted-app defect makes a
  specific check necessary. Existing audit gaps remain untested, not passed.
- Web-only commercial expansion, additional paid Research/cohorts and unrelated
  infrastructure or branding improvements.

## Checkpoint at scope change

PR #65 had already merged and published the 112-byte Microsoft application-domain
proof before this instruction. Production source is
`96372e7ff0c217199c8342e0415b0b4e3fd1c436`, deployment
`dpl_EZmsbJ4gepWdveuaGRttbmEe5tfN` (READY), independently checked at
`2026-09-07T20:24:10.757468Z`. The previously submitted Entra save completed and
the app's publisher-domain UI shows `permitext.com`; its publisher badge remains
unverified. The optional enrollment tab was closed. No further publisher setup
will be pursued under this scope.

Installed phone build 63 remains the last physically verified build. Main's new
Xcode Cloud run is not a claimed installation or submission. The broad paid-Beta
machine gate remains RED/unselected; that gate is distinct from Apple's submission
requirements and must not be set to pass by relabeling deferred tests.

# iOS account flow pass — 2026-09-19

Checkpoint: `main` at `06760c99f`. Work branch: `codex/cohesive-app-flows`.

## Behavior

- The blocked Pro-action prompt offers existing account sign-in without beginning a purchase.
- Completed authentication exchanges the fresh Clerk session with Permitext, including reauthentication. Account entry returns after account reconciliation. A failed exchange cannot continue into purchase or restore.
- Canceling authentication or closing an uncompleted upgrade clears the pending save action and leaves exploration available.
- Successful restore resumes an eligible pending save and closes the upgrade sheet. No Apple subscription found explains the App Store account versus Permitext account distinction; existing web/Lifetime Pro remains governed by its backend entitlement.
- Account and Pro use the same header metrics, surfaces, text-only branding, restore terminology, feedback component, and existing `codeLiquidGlassCircle()` close treatment. Restore feedback is visible for both Free and Pro. Busy purchase operations prevent dismissing the upgrade sheet.

## Validation

- Debug iOS build succeeded.
- Three runtime cancellation tests passed on the physical iPhone, covering account cancellation, upgrade dismissal, and StoreKit cancellation versus failure.
- Account ownership and entitlement preservation runtime tests passed on the physical iPhone (two additional tests). The host-side Clerk auth and minimal Free client contracts passed. Two existing Swift source-inspection tests failed on the device because they attempted to open Mac workspace paths (`PermitextApp.swift` and `Info.plist`); these are not recorded as passing.
- Native presentation: Account with the existing Lifetime Pro account and the updated Pro screen were visually inspected on the physical iPhone, including matching Liquid Glass close controls. Restore cancellation was verified again on-device with the distinct cancellation message and Lifetime Pro unchanged. The DEBUG-only `--native-pro-presentation-fixture` presents the real Pro view for visual inspection without initiating a purchase.

## Limits

A live restore attempt reached Apple authentication and was canceled without entering credentials; Lifetime Pro remained active. Cancellation now has a separate message from restore failure. No live subscription purchase, external account creation, or destructive account action is part of this pass. Durable pending-save recovery is covered in the follow-up below. Web is unchanged in this native account-flow pass. No deployment or TestFlight release is performed.

## Remaining iOS flows — follow-up

- Removed the redundant first-project action from Saved; project creation remains in the header.
- A missing/deleted Research conversation (404/410) clears its stale selection and returns quietly to history. Other errors remain visible.
- Search restores its saved result position alongside the query. Existing independent Reader navigation and reference viewport handling remain in place.
- Pending saves now persist locally for two hours with section, edition, and account identity. Cancellation/sign-out removes them; recoverable session expiry retains the original owner. Already-saved sections are not toggled off. Cross-edition Search Readers forward their access prompts and save intent to the owning app session, without changing the main Reader's edition.
- New Project setup requires only a name; optional details are collapsed. Creating a destination from a saved section assigns it immediately, with the picker retained as a recovery path if assignment fails.
- Native, HTML, and standalone section readers offer Report a source problem through the existing section control/header long-press menu, without an extra toolbar button. The report includes the section, edition, app link, and app version. Email draft/copy actions require a user action and do not submit reports automatically.
- Account now explains sign-out retention and subscription effects, and web subscribers have a labeled path to manage billing on the website. Existing account-deletion verification and billing safeguards remain in use.

Follow-up verification: pending-save persistence/expiry/account isolation and Search snapshot tests passed on the physical iPhone (3 tests). Host Clerk and minimal Free contracts passed. Ten additional Research draft/account-deletion recovery tests and three save/Project membership tests passed on the physical iPhone (16 targeted tests in this follow-up). The Saved and Research cleanup and name-only new Project form were visually verified on the physical phone. The final Debug build succeeded and was installed on the physical phone. The standalone Reader has no dedicated report button; its section-header context menu opened the prefilled report sheet, and closing it returned to the same section. No report was sent. Other reader variants share the same modifier but were not separately exercised on-device.

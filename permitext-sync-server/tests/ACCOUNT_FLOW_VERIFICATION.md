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

## iPhone consistency pass — September 19, 2026

- First-use welcome now uses the same text-only serif `permitext` wordmark and capsule primary action as account onboarding. Its heading uses the account onboarding title scale. The loading wordmark uses the same typeface.
- Saved and Research Pro prompts now share title/body/button typography, icon layout size, and spacing. Research copy refers to personal Research instead of the retired Settings name.
- Added DEBUG-only guest/Free variants of the isolated local fixture, mounting the real root navigation. They use a temporary repository, separate defaults, a local backend, and no sync transport. The real signed-in account is not changed.
- Added device flows for guest exploration, Free access, matching Account destinations, Search query retention, gated saving, and first save → new Project → reopen section. Updated the existing optional-property lookup test to expand Details before entering an address.
- Verified so far: Saved/Project/References navigation, immediate unassigned save and reopening at normal and accessibility text sizes (2 device UI tests); all four main header positions agree within 1 point (1 device UI test). Exported device screenshots were visually inspected.
- The first new typing run exposed a test input problem: with iPhone Mirroring connected, typed Project text did not enter the field and Save remained disabled. Tests now assert input values before proceeding; the repeat runs with Mirroring disconnected. The Search test also now targets the explicit `Close passage` accessibility label. Those initial runs are failures, not recorded as completed journeys.
- Host minimal-Free and Clerk authentication contracts passed. Live account creation, subscription purchase, destructive account actions, and a new provider sign-in are outside this visual pass. No main merge, push, deployment, or TestFlight release.

- The native Title 26 reference test passed on-device: the complete definition and citation remained readable, Close stayed reachable, and the same source glyph was restored.
- Recorded failures revealed a real presentation conflict as well as test assumptions: the outer app could present its upgrade alert by dismissing Search, or leave it obscured behind the Search Reader. Account/upgrade/auth sheets now use a shared presentation modifier with an explicit visible Reader owner. The owning account model and pending save remain shared; the Reader and Search view stay mounted.
- The new-Project recording confirmed immediate assignment worked; its saved row used a different accessibility path than All saved. Added a stable project-row identifier and corrected the test to scroll to that row. Keyboard input assertions distinguish input delivery failures from save failures.
- Final device rerun passed all 3 affected journeys: first save → name-only new Project → reopen assigned section; Free Account routes → Search → read → Save gate → cancel → original query; guest welcome/explore → Account routes → Search → read → Save gate → cancel → original query. No paid operation was started.
- A normal-launch check then passed on the real signed-in account. Screenshots confirm Lifetime Pro remains present with the static Pro pill, matching Account heading, and Liquid Glass close control pinned through scrolling. The account was not signed out or replaced.
- This consistency pass has 8 passing device UI tests across the targeted runs (2 Saved layout/navigation, 1 main-title alignment, 1 reference return, 3 final affected journeys, 1 normal signed-in Account). The final Debug build is installed on the iPhone. Fresh provider sign-in and completed purchase/restore remain untested in this pass.

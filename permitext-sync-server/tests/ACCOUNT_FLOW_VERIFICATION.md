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

### Project required address correction — 2026-09-19

Owner clarification supersedes the earlier name-only Project form: name and address are required; description alone is optional. All fields and the default-selected color picker are visible directly, with no Details disclosure. Project creation opens at the large sheet detent.

Physical iPhone tests passed: `testFirstSaveCreatesProjectAndReopensSavedSection` verifies name-only and whitespace-address rejection, successful creation with an empty description, and reopening the saved section; `testNativeProjectPartialLookupWarningRemainsSaveable` verifies imported partial facts and lookup warnings do not prevent saving. Inspected the captured form screenshot for direct field visibility. Results: `/tmp/permitext-onboarding-build/Logs/Test/Test-permitextPhysicalStress-2026.09.19_16-36-16--0400.xcresult`. Normal app relaunched afterward. No deployment or purchase performed.

### Mobbin account-journey review — 2026-09-19

Scope is the referenced Oku onboarding/account journey, not a rebuild of Notebook or Reports. Reopened the supplied onboarding flow in authenticated Chrome and inspected its account entry, back navigation, form-error and submission states. Permitext keeps its own wordmark-only branding and guest exploration.

Changes: account entry scrolls when content exceeds the viewport; account reconciliation uses neutral progress feedback rather than red error text; sign-in preparation/retry has the Permitext wordmark, capsule retry action, and Liquid Glass close button; the session-change observer waits for Clerk's completed authentication state before dismissing. Canceled preparation does not publish late UI state. Existing SDK-owned verification/resend/recovery remains in use.

Host Clerk authentication contract passed. Simulator build was interrupted in favor of physical UI verification; this Mac currently has no available simulator devices. Live new-account verification, incorrect/expired provider codes, and a fresh existing-Pro sign-in require an owner-assisted account session and remain pending; no purchase or account deletion belongs to this pass.

The largest-accessibility-text account entry/exit and the real Lifetime Pro pinned Account screen passed on-device. The guest Search save test initially failed: the independent Reader's entitlement service could disagree with its mirrored account plan, allowing a save instead of presenting the gate. `toggleBookmark` now uses `requireSavedWorkAccess`, the same shared-capability gate as Saved, and retains the pending section. The initial failed run is recorded at `/tmp/permitext-onboarding-build/Logs/Test/Test-permitextPhysicalStress-2026.09.19_16-49-22--0400.xcresult`; it is not counted as a passing complete run. Host minimal-Free contract also passed.

Final rerun passed both complete guest and Free journeys through Account → Search → enacted text → Pro save gate → cancel → same Search query. Results: `/tmp/permitext-onboarding-build/Logs/Test/Test-permitextPhysicalStress-2026.09.19_16-53-05--0400.xcresult`. Together with the earlier largest-text entry/exit and normal signed-in Lifetime Pro checks, four targeted device journeys passed. Inspected normal and largest-text Account-entry screenshots. Final build is installed on the phone; normal launch restored after isolated tests. Live provider signup/sign-in verification remains pending the user's account choice.

### Live authentication handoff — 2026-09-19

Owner authorized existing-account sign-out/sign-in. Before sign-out, visually confirmed Lifetime Pro and Synced on the physical phone. Live Create account exposed a blank root authentication sheet: the `permitextClerk` environment value was applied inside the account-presentation modifier, so that modifier read its nil default. Moved the environment injection outside the modifier. Debug build and host Clerk contract passed; installed on the physical iPhone. Visually confirmed the real Clerk Create account form, cancellation back to Saved, and the real existing-account Sign in form. No new account was submitted. Handed the phone back to the owner for credentials/verification; fresh sign-in completion and restored Pro access are pending that step.

Owner completed the live existing-account sign-in. Physical-phone verification confirmed return to Saved without an upgrade prompt; Account showed Lifetime Pro, the static Pro pill, 94 remaining research turns, and Synced. All saved initially displayed 1 during reconciliation, then returned to the original 4; Research history loaded the existing three conversations without running a new question. Left the app signed in on Saved. This closes the existing-account round trip. New-account submission and deliberately incorrect/expired verification codes were not exercised.

### Live email signup and Free access — 2026-09-19

The owner supplied a separate controlled email. The live flow displayed Create your account, accepted Continue, and opened the Sign up email-code screen. One deliberately incorrect code produced an inline Incorrect code message without leaving the step. After the cooldown, Resend cleared the invalid code/error and restarted the cooldown. The owner entered the newest real code and confirmed verification.

On-device follow-up confirmed return to Saved as a signed-in Free account; Account displayed Free, and Saved and personal Research remained gated. Searching 1106.1 returned results; opening the 2022 Building Code passage showed enacted text without an upgrade. Save presented the contextual Pro alert. Not Now returned to the same passage, and Close returned to the original query/results. No purchase was initiated. The installed Debug build reports Debug Override as its billing source, so these observations establish this build's Free UI behavior, not independent production billing entitlement verification. Left the test account signed in with its Search results preserved. An actually expired verification code was not tested; invalid-code handling and resend were exercised live.

### Authentication visual consistency and mode recovery — 2026-09-19

Applied Clerk's supported theme to both normal authentication and callback continuation: system background/text/input colors and rounded controls now match the native account welcome. No vendor source or authentication protocol was changed. The live existing-email signup error exposed a missing direct sign-in route; the wrapper now offers Sign in/Create account switching while retaining the enclosing pending-action session. Only one keyed AuthView is mounted at a time.

Debug build and host Clerk contract passed. Installed and visually inspected the real signup/sign-in forms on the physical phone. Confirmed the existing-email inline error, direct switch to Sign in with email retained and error cleared, switch back to Create account, and Close returning to Saved. Test account was signed out for this inspection and the phone is left in guest Saved. Actual expired-code verification remains untested; earlier invalid-code/resend and successful verification results remain distinct. No purchase, merge, push, or deployment.

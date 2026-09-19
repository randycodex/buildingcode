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

A live restore attempt reached Apple authentication and was canceled without entering credentials; Lifetime Pro remained active. Cancellation now has a separate message from restore failure. No live subscription purchase, external account creation, or destructive account action is part of this pass. Durable pending-save recovery across process termination remains a later priority. Web is unchanged in this native account-flow pass. No deployment or TestFlight release is performed.

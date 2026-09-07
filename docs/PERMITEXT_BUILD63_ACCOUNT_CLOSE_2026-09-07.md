# Build 63 Account close control — September 7, 2026

## User-visible change and verification

The Account sheet has a circular native glass X in its upper-right toolbar.
It dismisses the sheet and stays accessible while the Account content scrolls.
The control has the accessible label `Close Account` and identifier
`account-close`. This implementation was already merged in `33f5cd41d`.
The owner's screenshot and an independent device inventory confirmed that
installed TestFlight build 62 predates it; delivery was still unfinished.

The new `testAccountCloseFromWelcomeAndSavedAfterScrolling` UI regression
passed on iPhone 17 Pro / iOS 26.5 Simulator: one test, zero failures,
50.089 seconds, completed September 7 at 11:07:15 EDT. It opens and dismisses
Account from welcome, then opens Account from Saved, scrolls twice and
dismisses again. Both saved screenshots were visually inspected. This is a
simulator behavior and appearance check, not physical-device acceptance.

Private evidence: `/private/tmp/permitext-account-close-20260907.xcresult`,
the adjacent `.log`, and `permitext-account-close-20260907-attachments/`.

## Release binding

- Selected source: `5f1afb414fdd51e74c59a28c7e279d3ef10b74d9` (PR #62).
- Native runtime tree: `d893877f88d278f46f56327c0b46e99cce29e142`.
- The working branch has documentation and a UI-test addition; the native
  runtime and Xcode project match the selected source exactly.
- Xcode Cloud archive 264 succeeded for that source but had not distributed a
  newer build to TestFlight. The local signed archive uses version `1.0 (63)`,
  with the build number supplied as an Xcode setting.
- Archive: `/private/tmp/permitext-1.0-63-5f1afb414.xcarchive`.
- Executable SHA-256:
  `81f66ef4cbfcaf9bf9961303b23287a58214322e95898cc7b66d8346b49e93a5`.
- Strict deep signature verification passed. The Production backend and live
  Clerk configuration, all three pinned dependency revisions, and packaged
  entitlements passed. The privacy semantic union matches build 62: 13
  collected-data categories, three required-reason API groups and no tracking.
  This is a package comparison, not an App Store privacy attestation.

Verification script and machine-readable package evidence are in
`/private/tmp/permitext-build63-publication-20260907/`. Xcode reported upload
success at `2026-09-07T15:26:29.161Z`, followed by `EXPORT SUCCEEDED` and exit 0.
App Store Connect independently lists `1.0 (63)` as Processing. Processing
completion and physical installation are separate next checkpoints.
No public App Store submission or Beta activation has been performed.

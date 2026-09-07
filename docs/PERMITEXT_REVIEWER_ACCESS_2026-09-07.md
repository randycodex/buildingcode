# App Review access preparation — September 7, 2026

Status: the owner-set replacement password passed a new web sign-in. No-charge
Pro is now active and the existing web Notebook/Research/Report are accessible.
App and subscription review notes are saved in Apple. Native acceptance remains
incomplete. See the [forms and grant receipt](./PERMITEXT_APP_STORE_FORMS_2026-09-07.md).

The owner subsequently reported seeing the username and password in Apple with
Save disabled. Treat the sensitive-field automation result as unavailable, not
proof of empty credentials; do not repeat the completed password change.
The earlier failed automation observations below remain historical.

## Completed owner password handoff

The owner completed the Clerk password change and replied Done. A new normal
web session then passed using the supplied replacement: Sign Out → Sign in →
email and password → the designated account's Synced workspace. The hosted
sign-in page offered email and password together in this attempt; no email code
was required. At that checkpoint the test account was Free and signed in. No password is
retained in this receipt or any repository file.

App Store Connect's reviewer fields still did not expose a reliable persisted
result after standard input, keyboard/accessibility input, Save and reload.
The owner was asked to enter the same username/password directly in Apple,
save, reload and confirm retention. This remaining Apple save is separate from
the now-completed Clerk password change. The earlier sequence below is retained
as history, not a request to repeat that change.

## Exact scope and observed result

The owner authorized necessary App Store preparation using the existing
`permitext@gmail.com` test account. No Gmail, Apple Account or workplace
credentials were changed. The phone was unavailable and was not accessed.

A generated password was set on that Permitext identity with password checks
enabled and without signing out its other sessions. Normal web sign-in passed:
email → Use another method → Sign in with your password → authenticated,
Synced workspace. No email code was required for that attempt. This existing
browser check is not a fresh-device or native acceptance claim.

The owner's later supplied replacement was rejected by Clerk's existing
15-character minimum; password checks were not bypassed and the minimum was
not reduced. The generated credential remained set. Apple credential fields
did not retain the automated edits after reload, and the browser-control
connection subsequently reset, losing the in-memory generated secret. No
password was written to the repository or a local credential file. The owner
was asked to set a replacement of at least 15 characters and save the same
credential directly in App Store Connect. The Clerk change-password dialog
was left ready; neither Sign out of all sessions nor Skip password checks was
selected. Email-code and Google sign-in remain available.

Do not claim Apple has a working saved credential until that handoff and
reload verification are complete. Do not print credentials during verification.

## Production authentication configuration checkpoint

- Sign-up with password remains OFF: password is not required at registration.
- Add password to account is ON, enabling the standard password sign-in option.
  Turning it OFF removed the password alternative from the observed hosted UI.
- Device Trust is Disabled, verified in Clerk Protect Rules after saving.
  This is a GLOBAL password-sign-in rule, not an exception restricted to the
  test account. It was disabled during pre-release reviewer preparation to avoid
  a second email challenge for reviewers. Reconsider the configuration before
  public launch; do not silently treat this as a permanent launch decision.
- Lockout, bot sign-up protection and user-enumeration protection remain enabled.
  Required/verified email, email codes, linked Google and Apple/Google/Microsoft
  options were retained. Compromised-password checks and the existing minimum
  were not bypassed.

## Data integrity and remaining access checks

Before/after administrative exports verified the same designated identity,
SHA-256 `d5f4fa47dccfdb4a6f5b2cd2b63b9f2a1bed0a9aba59dc1a365bde108373b645`.
All 24 content/usage record groups were unchanged; only session metadata changed.
Entitlement was null before and after. No Pro grant, paid Research, purchase,
deletion or merge was performed. Raw exports remain private outside the repo.

Subsequent preparation enabled the explicit reviewer Pro grant and verified web
access, with notes saved in Apple. The grant is retained through acceptance and
App Review; revoke it once no longer needed. Remaining: verify the submission
build's actual login and backend Pro route when the phone returns, and finalize
any device-specific review instructions from that result. Sandbox purchases on
the Production-targeted build do not grant Production backend Pro, so purchase-
sheet access alone cannot close the native item.

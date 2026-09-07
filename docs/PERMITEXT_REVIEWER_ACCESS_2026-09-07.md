# App Review access preparation — September 7, 2026

Status: password-based web sign-in passed; credential handoff, native acceptance
and full Pro reviewer access remain incomplete. Do not submit this as a finished
reviewer-access package.

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

Remaining: securely persist the owner-set reviewer credential; verify the
submission build's actual login route when the phone returns; provision and
verify the complete backend Pro reviewer path; then supply final truthful
review notes. Sandbox purchases on the Production-targeted build do not grant
Production backend Pro, so purchase-sheet access alone cannot close this item.

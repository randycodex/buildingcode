# Phase 5 Verification Checklist

Use this checklist after backend, account, StoreKit, or sync changes. Passkey registration and sign-in are disabled until complete WebAuthn verification is implemented.

## Local App Setup

1. Open `NYC CC APP/NYC CC APP.xcodeproj`.
2. Select the `permitext` scheme.
3. Run a Debug build from Xcode.
4. Confirm Settings shows the Debug diagnostics in the Plan card:
   - `Backend: http-backend`
   - `base URL: https://permitext-sync.vercel.app`
   - sync checkpoint values
5. If the diagnostics are missing, run `Product > Clean Build Folder`, then run again.

## Backend Health

1. Open `https://permitext-sync.vercel.app/health`.
2. Confirm the response includes:
   - `"ok": true`
   - `"storage": "postgres"`
3. In the app, tap `Run Restore Check` in Debug diagnostics.
4. Confirm the status message includes `backend ok, postgres`.

## Account Restore

1. Sign in with Apple.
2. Create or confirm a public username.
3. Sign out.
4. Sign back in with the same Apple account.
5. Confirm the same account is restored and the public username remains.

## Content Restore

1. Create at least one project.
2. Save at least one section into that project.
3. Add at least one tag.
4. Add at least one note.
5. Tap `Sync Now` and wait for `Synced`.
6. Delete the app.
7. Reinstall from Xcode.
8. Sign in with the same Apple account.
9. Confirm the project, saved section, tag, note, and username restore.
10. Confirm Settings still shows Pro if the StoreKit subscription is active.

## Server Verification

From `permitext-sync-server`, run:

```sh
npm run check
npm run smoke
npm run verify:production
npm run verify:production:aasa
```

Expected results:

- `permitext auth policy passed`
- `permitext-sync smoke passed`
- `permitext production health passed: https://permitext-sync.vercel.app uses postgres`
- `permitext production AASA apps: 57BY95X97H.com.randycodex.permitext`

## What This Does Not Prove

This checklist does not prove concurrent multi-device conflict behavior at production scale. That requires the normalized production storage migration described in `phase-5-production-storage.md`.

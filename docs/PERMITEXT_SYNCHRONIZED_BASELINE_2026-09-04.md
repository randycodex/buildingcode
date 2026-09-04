# Permitext synchronized baseline — September 4, 2026

The owner requested publishing the existing work so web and iOS share one source
baseline before repairs begin on a new branch. This record distinguishes source,
Production, upload, Apple availability, and installation. It is not public-release
acceptance and does not change the Research or Zoning release gates.

## Shared source and web

- Baseline/main SHA: `176cca6f2e2d01db6495f29192f805ef7daddfbe`.
- GitHub `origin/main` verified equal to the baseline after push.
- Vercel Production deployment: `dpl_DRsWbchJ384r1q7WeTWLJkLZotjh`, READY.
- Both `https://permitext.com/release` and
  `https://permitext-sync.vercel.app/release` returned the baseline SHA.
- Post-deployment health passed: PostgreSQL `normalized-v4`.
- Apple app-site association passed for `57BY95X97H.com.randycodex.permitext`.
- Deployment-scoped error/fatal runtime search returned no matching logs during
  the hour ending September 4 at 20:51:51 UTC. This is a bounded observation.

## Native archive and upload

- Version 1.0, build 53, bundle `com.randycodex.permitext`.
- Detached checkout `/private/tmp/permitext-build53-baseline` pinned to the exact
  baseline, clean after upload. Repairs in the main checkout cannot enter it.
- Native tests: 163 passed, zero failures.
- Archive: `/private/tmp/permitext-1.0-53-176cca6f2.xcarchive`.
- Xcode 27.0 / iPhoneOS 27.0 SDK; strict deep signature verification passed.
- Production backend `https://permitext-sync.vercel.app`, live Clerk configuration;
  native Reader rollout remains `isolated-table-fallback`.
- App privacy manifest: 13 collected-data categories, tracking false; semantically
  identical to baseline source. PhoneNumberKit's privacy manifest is retained.
- Executable SHA-256:
  `87800fdf4d4d52a302aa0ae68d175e36b3da6536f3f50c44a18369da0fc58f38`.
- `Upload succeeded` at September 4, 20:50:07 UTC, followed by
  `EXPORT SUCCEEDED` with exit 0.
- App Store Connect upload status: Complete. Build record
  `61edac68-e76e-4465-8a5c-910002f85159` is Ready to Submit and assigned to Internal
  Testers through the existing automatic Xcode-build distribution.
- Device installation: build 53 installed through TestFlight on the iPhone 17 Pro
  using Mirroring. TestFlight showed Open and version 1.0 (53); Permitext launched
  to the Building Code library, and Account displayed Permitext 1.0 (Build 53).
- App Store Connect availability and actual installed version were verified
  separately. No account, Project, or settings changes or Research calls were
  needed for this verification.
- No App Store review submission or public release was performed.

## Retained local evidence

- `/private/tmp/permitext-build53-baseline-evidence.json`
- `/private/tmp/permitext-build53-native-tests.log`
- `/private/tmp/permitext-build53-archive.log`
- `/private/tmp/permitext-build53-upload.log`
- Native test result under external DerivedData:
  `PermitextShared/Logs/Test/Test-permitext-2026.09.04_16-34-48--0400.xcresult`.
- Repair checks: `/private/tmp/permitext-readiness-check-20260904.log`,
  `/private/tmp/permitext-readiness-postcheck-20260904.log`, and
  `/private/tmp/permitext-readiness-smoke-20260904.log`, and
  `/private/tmp/permitext-readiness-final-checks-20260904.log`.

Archives and logs are retained locally, not committed build artifacts. The repair
branch `codex/production-readiness-fixes` starts at this baseline; its new fixes
remain separate from Production and build 53. See the dated production-readiness
backlog for repair scope, verification, and remaining release blockers.

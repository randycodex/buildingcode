# Research feedback release — September 9, 2026

## Release scope and source

The owner approved deployment of the completed tester feedback loop and preparation of the updated iOS build. The release was isolated from the larger unfinished Research answer-quality work: Production started at `563c10fe972dd4915c4ed254c6bc7c2eec53ec25`; only feedback changes and their delivery corrections were applied on `codex/research-feedback-release`.

- Feedback implementation on the working main branch: `7b5ded652`.
- Isolated implementation commit: `551f2fbe603c626ce7f51f2c4ccf9453b1875e69`.
- Final web release: `ed43b01f358bcb67dfdac6b30bed01aba36a6f23`.
- Delivery corrections include runtime evaluation modules in CLI uploads and change the web app/style versions and service-worker cache so returning users receive the controls.
- The other unpublished Research changes remain local. Main and GitHub were not synchronized by this release.
- No paid Research calls, price/allowance changes, or Project workflow tests were performed.

## Production — verified live

- Deployment: `dpl_CweEGr6YU4ZJ3ySaPCx3vqvdGNBp`, READY, production.
- Deployment URL: `https://permitext-sync-g8u2vbrki-randycodexs-projects-b72fc111.vercel.app`.
- The build passed content, commercial configuration, live Stripe readiness, release-identity and operational-monitoring gates.
- The deployment was staged with production settings and promoted only after its exact commit, PostgreSQL `normalized-v4`, commercial readiness and authentication configuration passed read-only checks.
- Both `https://permitext.com` and `https://permitext-sync.vercel.app` returned the final release SHA and healthy storage/configuration after promotion.
- Eight served assets across the two domains matched the source bytes: web app, stylesheet, service worker and owner-console JavaScript. HTML uses `20260909-research-feedback-v56` for the app and stylesheet.
- The deployment-scoped initial error-log scan returned zero error rows after the live checks. This is a short observation, not evidence of every future request.
- Both domains rejected an unauthenticated owner feedback export with HTTP 401. A malformed request without an auth envelope returned HTTP 400, as expected by the request parser.
- Hosted owner review is configured through the existing `PERMITEXT_INTERNAL_OWNER_USER_IDS`; its configured values were not changed. A signed-in owner write against production PostgreSQL was not exercised.

The initial CLI attempt used the wrong upload root and failed before release. A staged candidate passed but was superseded by the asset-cache correction; it was never promoted to the canonical domains. The live site remained on the prior release until the final promotion.

## Native build 64

- Version `1.0`, build `64`, bundle `com.randycodex.permitext`.
- Signed archive: `/private/tmp/permitext-feedback-1.0-64.xcarchive`.
- Native inputs were archived from the isolated implementation commit; the later packaging/cache commits contain no native changes.
- Strict deep signature verification passed. Packaged settings confirm the production backend `https://permitext-sync.vercel.app`, live Clerk configuration, `isolated-table-fallback` Reader and `ITSAppUsesNonExemptEncryption=false`.
- Executable SHA-256: `ebece54867f1f39a8630567c35f67e57782c8b899dd0a8aac341102c6315efef`.
- Xcode confirmed `Upload succeeded` at `2026-09-09 22:12:37 EDT`, then `EXPORT SUCCEEDED` with exit 0. Its final status states that the uploaded package is processing.
- Browser App Store Connect is at sign-in. Completion of Apple processing and Internal Testers availability remain unverified; upload success is not a claim that testers can already install build 64.
- No physical-device test, external beta activation, App Store build selection or public App Store submission was performed.

## Verification and operation

Focused feedback unit/HTTP checks passed on the isolated release, including owner authorization, preserved evidence, stale writes, explicit review, export integrity, human comparison records and coverage-aware metrics. Web shell cache/header checks passed. The actual local web Research and owner console flow was exercised with disposable synthetic data; the native simulator build and signed Release archive passed.

This delivers feedback collection, owner investigation and reviewed reference records. A recorded human comparison does not automatically run a model evaluation, repair Research or prove professional correctness. See [feedback review instructions](../permitext-sync-server/evals/FEEDBACK_REVIEW.md).

Local release evidence:

- `/tmp/permitext-feedback-production-verification.json`
- `/tmp/permitext-feedback-native-verification.json`
- `/tmp/permitext-feedback-final-deployment.log`
- `/tmp/permitext-feedback-release-archive.log`
- `/tmp/permitext-feedback-64-upload.log`

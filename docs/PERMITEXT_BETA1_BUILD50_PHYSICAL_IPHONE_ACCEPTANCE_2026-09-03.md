# Permitext Beta 1 build 50 physical-iPhone acceptance — September 3, 2026

Status: **SUPERSEDED — existing Apple-account continuity, Lifetime Pro, sync, and saved-content continuity passed, but the physical iPhone exposed a release-blocking 2014 Construction Codes chapter-resolution defect**

This record contains no email address, customer content, provider token, payment data, raw account export, or other personal identifier. The owner performed the physical-iPhone observations. Codex retained only release identity, aggregate request status, build metadata, hashes, and pass/open outcomes.

## Exact release identity

- Git commit: `c78a4b6c26d8d47e096d3b1aba7baa8b161a4b2c`
- Branch: `main`; local `HEAD` and `origin/main` matched before the exercise.
- Production deployment: `dpl_GzjcRMmjuZD1pDxsmiYT4FjH2HvP`, state `READY`.
- Canonical Production URL: `https://permitext-sync.vercel.app`.
- Production `/release`: release ID `c78a4b6c26d8`, exact full Git commit above, environment `production`, deployment host `permitext-sync-8tdf656e0-randycodexs-projects-b72fc111.vercel.app`.
- iOS app: version `1.0`, build `50`, bundle identifier `com.randycodex.permitext`.
- Archive backend: `https://permitext-sync.vercel.app`.
- Native Reader rollout stage: `isolated-table-fallback`.
- Archive executable SHA-256: `7cb3dcc312ac1eb19e72acee57429852fafd3324c50452d598fd7074ce6005b0`.
- Encryption declaration: `ITSAppUsesNonExemptEncryption=false`.

## Build, upload, and automated verification

- The signed build 50 archive was produced from an isolated checkout at the exact Git commit above. Strict deep code-signature verification passed.
- App Store upload completed with `Upload succeeded` and `EXPORT SUCCEEDED` on September 2, 2026.
- The owner installed build 50. A September 3 readback from the paired physical iPhone reported version `1.0`, bundle version `50`, and the production bundle identifier.
- The exact-commit iOS suite passed `158/158` tests with zero failures before upload.
- The September 3 complete server `npm run check` passed, including its final UX-alignment postcheck. Paid Research provider access remained disabled.
- Production health passed with PostgreSQL schema `normalized-v4` and PostgreSQL rate limiting.
- Production AASA returned `57BY95X97H.com.randycodex.permitext`.
- The exact deployment's protected build reported `ready: true` for commercial configuration, live Stripe, automatic/exclusive Stripe tax, approved policy versions, Apple production-only handling, Research guardrails, release identity, and external monitoring.
- The strict policy publication audit returned `publicationReady: true` at `2026-09-03T10:33:44.038Z`; all three canonical HTTPS routes returned direct HTTP 200 responses and exact approved hashes.
- The exact-release `/health` response reported `vercel-observability-daily-review`, structured runtime logs, client-error reporting, and configured external alerts. A direct health check passed after the privacy-bounded monitoring audit found no health entry in its empty input sample.

## Physical-iPhone observations

Exercise window: September 3, 2026, approximately `10:20Z`–`10:28Z`.

- Permitext launched successfully on the paired physical iPhone as build 50.
- After the clean relaunch, the existing Apple-authenticated Permitext account was already signed in. No new `/account/sign-in` request appeared in this exercise window because the completed account session persisted.
- The Account screen displayed `Lifetime Pro`.
- The Account sync status displayed `Synced`.
- The owner opened Saved and confirmed that existing saved sections or notes remained present.
- The owner opened Projects and confirmed that the existing project containers remained present. Those projects had never contained saved items, so their empty item lists were expected and no project data loss was observed; project-item continuity was not exercised.
- Production continued receiving app sync/checkpoint/usage traffic. All 26 recent requests represented in the status-code audit returned HTTP 200; no 4xx or 5xx result was present.
- No client crash or transport error appeared during the successful observation.

## Release-blocking Reader observation

At approximately 6:47 AM EDT on September 3, the owner opened 2014 Building Code Chapter 7 on the physical iPhone. Build 50 displayed `Chapter HTML Missing` instead of the chapter. The signed archive does contain the complete `bc-7.html` file. The defect was in client resolution: the 2014 corpus stores flat, code-family-prefixed chapter names such as `bc-7.html`, while the shared resolver searched only unprefixed names such as `7.html` when no nested `code-sections/building-code` directory existed.

The source-level correction now maps the five known 2014 code-section slugs to their exact flat filename prefixes (`ac`, `bc`, `pc`, `mc`, and `fgc`) and fails closed for unknown slugs. A dedicated Simulator fixture visibly opened 2014 Building Code Chapter 7 after the correction, and the complete iOS suite passed 161/161 tests, including the real bundled Chapter 7, every code-family mapping, the unchanged nested 2022 layout, all 111 native 2014 documents, 192 structured tables, and 285 local media items.

This correction is not present in build 50. Build 50 must not be selected for Beta 1; a replacement build and physical-iPhone confirmation are required.

This proves existing-session continuity on the exact Production-targeted build, but it does **not** make build 50 an acceptable release candidate. It does not count as fresh-account Apple sign-in evidence and does not substitute for the replacement-build Reader check, the remaining provider matrix, or the dedicated disposable-account deletion exercise.

## Gates that remain open

- Fresh-account Apple, Google, Microsoft, and email sign-in.
- Existing-account Google, Microsoft, and email sign-in.
- Production account export/deletion using only a dedicated disposable account, including cleanup and recreated-empty-account verification.
- Representative Project-item continuity on the exact release using a project that actually contains test content; project-list continuity already passes.
- A separately authorized complete Production Research turn and matching web/iOS response-contract review.
- Final-build Free-state and applicable restore/cancellation/refund presentation.
- Account-deletion presentation and recovery boundaries on the final client.
- Final Zoning Research web/iOS physical-device acceptance and owner go/no-go.

No purchase, refund, account deletion, provider configuration change, paid Research call, public Research enablement, or public-Beta authorization occurred in this exercise.

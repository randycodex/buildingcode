# Notebook dependency security correction — September 3, 2026

Status: **Merged, pushed, and verified in website/backend Production after separate owner approval.** App Store submission and release remain the owner's final steps and are not authorized. See the exact publication evidence below.

## Scope and cause

- Fresh GitHub inspection found one open Dependabot alert, [alert 25](https://github.com/randycodex/buildingcode/security/dependabot/25), for `@tiptap/core` in the server lockfile.
- The [upstream advisory](https://github.com/ueberdosis/tiptap/security/advisories/GHSA-cp6q-959q-f8rh) identifies unsafe handling of an own JSON `__proto__` attribute. This can place attacker-controlled inherited attributes onto the object supplied to ProseMirror's DOM serializer. GitHub's repository alert labels it medium; the upstream advisory labels it high. The first patched release is `3.30.4`.
- The baseline lock contained core `3.29.0` and two nested `3.29.2` copies. A local, non-executing canary against the installed baseline confirmed prototype replacement and an inherited `onerror` value. This is a dependency reproduction, not proof that a customer exploited Permitext or that every imported Notebook document was exploitable.
- Permitext's custom reference extension explicitly enumerates its properties, and the server validates its constrained Notebook schema. These reduce exposure but do not justify retaining the vulnerable dependency.

## Correction

- Pin all twelve used Tiptap packages to `3.30.4` through npm overrides, preserving their exact-version peer relationships. The regenerated lock changes only Tiptap paths and the relocated Tiptap React type dependency; no other dependency version changes.
- Both BlockNote consumers now resolve one patched core implementation. BlockNote, React, Vite, application schema, billing, Research models/caps, and native iOS files are unchanged.
- Rebuild the checked-in Notebook JavaScript. The generated output contains the upstream safe own-data-property definition. The sizeable generated diff is reproducible build output, not a manual rewrite.
- Bump the Notebook asset URL to `20260903-tiptap-security-v14` and synchronize shell URLs/cache identity (`20260903-notebook-security-v24`, `permitext-pro-shell-v763`) so existing web clients can fetch the patch after deployment.
- Add a regression check to the Notebook prebuild and full server postcheck. It tests installed/locked versions, both ESM and CommonJS implementations, each actual BlockNote resolution, dangerous attributes through the real ProseMirror serializer, and ordinary title/class/style merging.
- Add a local-only browser harness using the actual generated editor. It binds to loopback and has no account, database, Research, or upload operations.

## Verification

- `npm ci --ignore-scripts --no-audit --no-fund --fetch-timeout=30000 --fetch-retries=1`: passed in the isolated task worktree; the main checkout's dependencies were not changed.
- `npm ls @tiptap/core @tiptap/pm @tiptap/react`: passed; all resolved versions `3.30.4`, no invalid peers.
- `npm run test:notebook-security`: passed for one locked core package and two module implementations.
- `npm run build:notebook`: passed twice, including the new prebuild guard. Rebuilds have the same JavaScript SHA-256: `02d6e5c40ac6399c12958d8c83b30394674714ee80d96e13cbb68904f3d602af`.
- Notebook, build-output, and offline-cache contracts: passed after the asset-version updates.
- First full `npm run check`: precheck and main check passed, then the last UX governance assertion rejected the intentionally expanded postcheck command. Updated that assertion to require **both** the new security gate and the existing UX gate, plus the security prebuild hook. All seven UX phases then passed in the focused postcheck. **Final full rerun passed with exit 0**, including precheck, check and postcheck. PostgreSQL rate-limit integration was explicitly skipped because no database URL was configured; this is not live-database acceptance. No paid provider calls were made.
- Browser, `http://127.0.0.1:8917/`, approximately `2026-09-04T00:25:28Z`–`00:26:10Z`: actual generated editor visibly rendered heading, bold/italic, numbered/bulleted items, and reference chip. Typing updated serialized version-2 content; legacy version-1 note loaded; saved JSON round-tripped exactly; a new reference chip appeared. No application-origin console errors. Unrelated Chrome wallet-extension errors were observed and excluded explicitly.
- Browser harness verifies editor/document compatibility, not Production account persistence, private-image upload, or native iOS acceptance.
- npm's security bulk endpoint initially timed out. A later bounded read-only retry, `npm audit --json --fetch-timeout=15000 --fetch-retries=0`, completed with exit 0 by `2026-09-04T01:02:16Z` (September 3 EDT): audit report version 2, 181 total dependencies, zero info/low/moderate/high/critical findings. This supersedes the earlier inconclusive full-audit status, not the independent advisory/behavior/build evidence. It is a current registry audit, not a guarantee of no vulnerabilities. Dependabot closure still requires publication to the default branch and a refreshed GitHub result.
- `git diff --check`: passed.

## Remaining release boundaries

The owner separately approved merging, pushing, and deploying the prepared website/backend changes. This does not authorize App Store submission, TestFlight upload, new policy wording, paid Research calls, or UI/UX and screenshot work. No TestFlight build was created, and no Apple field, submission, or public-Beta activation was changed.

## Authorized Production publication

- Final deployed source: `0688e6b0564d44a92c803af3e1cfbbe6f87a2911`. Local `main`, `origin/main`, and fresh GitHub `ls-remote` checks match. Both integrations were fast-forwards; the owner's Xcode project/Info.plist diff checksum and unrelated untracked files were preserved.
- The first deployment of `0f9328200`, `dpl_JBuRCMV6yHNYhBxtf4pAudNfBtF1`, failed because `.vercelignore` excludes `tests/`, which originally contained the new prebuild security check. Both public origins continued serving healthy prior source `573d4bc1a`; the failed build was not promoted.
- Follow-up `0688e6b05` moves the same gate to `scripts/verify-notebook-dependencies.mjs` and adds a packaging contract. It retains test-fixture exclusion and all security checks. Local `npm run build:clients`, build-output/governance contracts, and clean-diff checks pass; the generated Notebook JavaScript hash is unchanged. Vercel's replacement build also executes and passes the security gate.
- Final deployment: `dpl_5ETSni7gSRwdDDVuzryEb8HJF7Js`, **READY**, [deployment URL](https://permitext-sync-8rzp9zq0h-randycodexs-projects-b72fc111.vercel.app). Created `2026-09-04T01:20:08.491Z`, building `01:20:09.828Z`, READY `01:22:56.056Z` (September 3 EDT). Build output reports 46 seconds; creation-to-READY was approximately 168 seconds. Node.js backend, Node 24, no framework preset.
- On both `https://permitext.com` and `https://permitext-sync.vercel.app`, `/release` returns HTTP 200, the exact final SHA, and `production`. Health passes PostgreSQL `normalized-v4`, commercial readiness and live Clerk configuration. AASA passes with `57BY95X97H.com.randycodex.permitext`; all three approved policies pass strict live byte/hash publication checks.
- Both origins' served `app.js`, `offline-storage.js`, service worker and Notebook JavaScript match the local files byte-for-byte by SHA-256. The HTML references `20260903-notebook-security-v24`; Notebook version is `20260903-tiptap-security-v14`. Notebook SHA-256 remains `02d6e5c40ac6399c12958d8c83b30394674714ee80d96e13cbb68904f3d602af`.
- Full no-cost `npm run check` and local `node tests/smoke.mjs` passed on `0f9328200` before publication. The unchanged security logic and packaging-only follow-up received focused build/contracts and the actual Vercel build; the full suite was not redundantly rerun on that follow-up. PostgreSQL rate-limit integration skipped without a database URL. Logs: `/private/tmp/permitext-publication-check-20260903.log` and `/private/tmp/permitext-publication-smoke-20260903.log`.
- GitHub Dependabot alert 25 now reports **fixed**, timestamp `2026-09-04T01:17:39Z`; refreshed after final deployment.
- Deployment-scoped error/fatal scan from READY through approximately `2026-09-04T01:24:12.419Z` returned zero entries and zero parse errors. It emits no raw messages/customer identifiers. No health request appears in this error-only sample; the independent direct-health checks above passed. This is a short early observation, not hour-long coverage or live Research acceptance.
- Vercel reports zero configured drains; the previously owner-accepted alerts/daily-review alternative remains in place, and the protected build passes external-monitoring configuration. No alert-delivery or spend-hard-stop drill was performed.
- No environment, spending cap, model, price, allowance, subscription, provider configuration, approved public-policy bytes, UI/UX, screenshot asset, or Apple setting was changed. Privacy declarations are in source, not a newly uploaded native binary. No paid Research request or customer-data mutation was made.

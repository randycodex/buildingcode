# per codes migration receipt — November 10, 2026

The migration continues handoff `507ef2785` from production `fe0ffe9cc`, in an isolated worktree on `codex/per-codes-rebrand`. The original checkout and its untracked duplicate files remain untouched.

## Live state

- `https://per.codes` serves the rebranded site and workspace over HTTPS. `www.per.codes` redirects 308 to the apex.
- The SAME Vercel project was renamed from `permitext-sync` to **per-codes**. Project ID remains `prj_6rWwwb50xxxKI7qu92HzzqB5nkYs`, team `team_9EJNb6mc4ZUQ5bhRcRhmoBRR`. Its database and storage were retained.
- Production deployment `dpl_DfNshoposQAfMzH9wA9tnZ55HFVz` (source `708e01253e49d1174507c270b887b4fb1746d2b4`, URL `https://per-codes-1az6dcczj-randycodexs-projects-b72fc111.vercel.app`) was promoted successfully after hosted build gates and staged HTTP checks. It includes the authenticated-return fix, web version `20261110-per-codes-v1651`, shell `permitext-pro-shell-v2229`, support recovery guidance and host-scoped redirects. The earlier 0183 deployment remains a rollback reference.
- `permitext-sync.vercel.app` remains an attached Production domain and returns HTTP 200 after the project rename. Existing installed-client backend configuration is retained.
- `permitext@gmail.com` remains the working support and account-contact address. No replacement mailbox was created.

## DNS

Squarespace DNS was configured using Vercel's exact current dashboard records. Only the conflicting Squarespace parking preset was removed. Nameservers, DNSSEC, Domain Connect and the existing Email Security TXT records were retained. There were no MX records to replace. Custom records:

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 216.150.1.1 |
| CNAME | www | da4ef9ed8e59bcef.vercel-dns-017.com |
| CNAME | clerk | frontend-api.clerk.services |
| CNAME | accounts | accounts.clerk.services |
| CNAME | clkmail | mail.s8ceyb8ad72e.clerk.services |
| CNAME | clk._domainkey | dkim1.s8ceyb8ad72e.clerk.services |
| CNAME | clk2._domainkey | dkim2.s8ceyb8ad72e.clerk.services |
| TXT | @ | Google Search Console ownership token, retained in the DNS dashboard |

The seven service records use 30-minute TTL; the ownership TXT uses four hours. Google Search Console confirmed **Ownership verified**. Google OAuth branding initially requested ownership and a propagation wait. After ownership was verified, one recheck succeeded. The verified branding was published; Google now confirms it is being shown to users. The Google Cloud project display name is also **per codes**, retaining project ID `permitext-production` and project number `791865061634`.

## Authentication

The SAME Clerk application `app_3IFWdYk17Oo25fbdqFbzLp8vB4i` and production instance `ins_3IFXaNGYIAq7yUABleZuCzKG2Ts` now have primary domain **per.codes**, still on the free plan. All five Clerk DNS records verified and certificates issued. The production public key is `pk_live_Y2xlcmsucGVyLmNvZGVzJA`; no server secret or signing key was rotated. The new JWKS was compared with the configured signing material and matched. Existing user IDs remain intact.

The owner explicitly authorized the primary-domain move on the free plan, accepting that older installed iPhone builds using the old Clerk public key need an app update. The earlier paid satellite option was declined; no plan upgrade was made.

Saved Clerk branding, support email, icon/favicon, legal links and Account Portal fallbacks use the new identity. Default templates render the app-name variable as per codes. Terms and privacy point to `/terms` and `/privacy` on per.codes. Production configuration audit reports configuration ready; its manual acceptance/release-ready flags are not asserted.

Provider configuration retained each existing client and its credentials:

- Google client `791865061634-o8ifuars7ikf73nq36j4o8uns54q4esm.apps.googleusercontent.com`: new Clerk callback added, name/home/legal links updated, old callback retained. Existing Google login returned to the same synced Lifetime Pro workspace with saved evidence and notes. Cloud project ID is retained.
- Microsoft client `224c0519-a19d-4048-94c2-bc25508d54a7`: name and home/legal URLs updated, new callback added, old callback retained; publisher domain per.codes verified through the existing association file. Its separate MPN publisher verification remains absent. Live OAuth returned successfully to Clerk and required an email verification code for the existing regular work-email app account. The owner asked why that address was used; the test was stopped. It was never assigned an administrative, support or billing role. End-to-end Microsoft app acceptance remains pending.
- Apple Services ID `com.randycodex.permitext.web`, team `57BY95X97H`: description per codes Web Sign In; per.codes and clerk.per.codes domains plus the new Clerk and native web callbacks saved. Existing six website entries retained, ten total. `bounces+113080807@clkmail.per.codes` added to Private Email Relay and SPF verified; old sender retained. Existing Apple login returned to the same synced Pro workspace and saved notes/evidence. The owner accepted Apple's updated Developer Program license directly.

A first-return browser race was reproduced on the new origin: sign-in could show the workspace selector before the first private pull settled. The deployed fix waits for that pull with an account-identity fence before rendering. Its contract covers both deferred sync and an account switch during that wait.

## Production settings and billing

Production environment values were changed through the authorized Mac Vercel CLI after the connector's env-list request returned 403. Configuration snapshots are private and outside Git. Vercel masks Secret values as `[SENSITIVE]` even in an env pull, so these snapshots are NOT credential backups. Rollback uses retained deployments and the provider-owned configuration; no credential was rotated or exposed.

| Variable | Current target |
| --- | --- |
| PERMITEXT_PUBLIC_BASE_URL | https://per.codes |
| PERMITEXT_TERMS_VERSION | terms-2026-11-10-rebrand |
| PERMITEXT_PRIVACY_VERSION | privacy-2026-11-10-rebrand |
| PERMITEXT_SUBSCRIPTION_POLICY_VERSION | subscriptions-2026-11-10-rebrand |
| PERMITEXT_STRIPE_WEBHOOK_URL | https://per.codes/billing/stripe/webhook |
| CLERK_AUTHORIZED_PARTIES | new apex/www plus retained old apex/www |
| CLERK_FRONTEND_API_URL | https://clerk.per.codes |
| CLERK_ACCOUNT_PORTAL_URL | https://accounts.per.codes/sign-in |
| CLERK_PUBLISHABLE_KEY | the same-instance new public key above |

Stripe account `acct_1Tn5SbEp1wz0lmSd`, product `prod_UxQtQBgG92aEwz`, Prices and subscription identities remain unchanged. Saved account/public/product names, description, support/legal URLs, icon and statement descriptors use per codes / PER.CODES. Current and archived old-named price descriptions were updated without changing amounts or lookup keys.

The existing webhook `we_1TxWAMEp1wz0lmSdzOZWhqLG` was edited in place to the new URL and name **per codes Production**, retaining its signing secret, API version and seven selected event types. No duplicate endpoint or purchase was created. An unsigned request to the new route returns 400 Invalid Stripe signature.

Existing customer portal `bpc_1UBNlJEp1wz0lmSdJrv6CSWB` now has a per codes header and return URL `https://per.codes/workspace`; reload verified the saved values, branding and current legal URLs. The app's canonical base governs Checkout success/cancel and portal return URLs. Real paid Checkout completion was not performed.

The Stripe action banner was inspected: the account-status page showed no active tasks, Payments/Payouts active and Cartes Bancaires paused. No payout, bank, financial transaction or new subscription was changed.

## Native app and App Store

Simulator-target and signed physical-device builds succeeded with the new Clerk key. The existing iPhone app container was backed up privately before installing an update under the SAME bundle ID. All 230 Application Support files remained present after installation; 228 were byte-identical when sampled after launch (runtime files may change). A full post-install copy hit a protected system SplashBoard snapshot; the Application Support copy succeeded separately.

The updated app installed and launched on the paired physical iPhone. Native Google sign-in recognized the existing Higinio account and Lifetime Pro access. After server promotion the Account screen reported **Synced**, a current successful push and no error; retained native Projects remained visible. No app uninstall/reset occurred.

Restore Purchases reached the existing Apple sandbox account password prompt. The owner did not recall that password, so the prompt was canceled. The app confirmed restore canceled and current access unchanged. Successful purchase/restore acceptance remains pending; no financial purchase occurred. Physical universal-link tap routing and final native policy-link taps remain unverified. The signed app entitlements contain the new applinks/webcredentials domains and the unchanged app identifier; Apple CDN AASA returns 200 with the matching app identifier and routes. The last signed CFBundleName build was installed in place successfully. Mirroring automation repeatedly became unavailable during scrolling, so further scroll attempts were stopped. After that update, the app pulled the production audit workspace, all six saved evidence items, and the current notebook notes.

App Store Connect draft name, description, support/marketing/privacy URLs, review-note branding, subscription-group and monthly-subscription display names were saved on the existing app/products. The Production Server Notifications URL now uses per.codes; isolated Sandbox notifications remain on their existing backend. The inspected iPhone screenshot slot has zero uploaded screenshots/previews. No binary was uploaded, no Add for Review action was taken, and manual release remains selected. See the local App Store metadata receipt for exact IDs and limitations.

## Storage and compatibility

No browser data, service worker storage, saved work, database, account, subscription or entitlement was deleted. Bundle IDs, purchase IDs, SKU, storage keys, data paths, protocol headers and backend hostname retain their compatibility identifiers. These remaining internal strings are intentional.

The live redirect rules affect only old-host marketing and legal pages after new-domain validation. `/workspace`, `/web`, API, sync, webhook and section-link routes are not redirected across origins. The support page explains waiting for pending sync and exporting a recovery backup before closing an old tab or clearing browser data. Old workspace access remains available for local recovery.

## Validation status

- The original site-investigation body.text and privacy-page analytics failures were resolved. Structured provider-double fixtures explicitly request verified mode; production fast-stream defaults and spending guards remain unchanged.
- The main `npm run check --ignore-scripts` chain passed after restoring meaningful scoped deletion coverage and updating stale branding/harness fixtures.
- Auth loader/return identity fence, startup restore, cache/offline coherence and approved-policy/marketing/billing focused checks passed.
- A fresh actual `npm run check` including precheck advanced through the research chains and stopped on a retained Zoning preflight snapshot containing the old brand. A NEW November 10 comparison snapshot was created and reviewed: only the artifact date, five clarification brand strings, and their derived plan/context hashes differ; all gates, cases, rubrics, sources, costs and outcomes are unchanged. The October snapshot remains immutable. The current check now targets the new snapshot, and the remaining precheck stages are being run. Do not claim the complete suite passed until its exit receipt exists. Additional old structured fixture failures were fixed without changing production research semantics. These tests use intercepted provider doubles and do not certify live AI/legal correctness.
- Live HTTPS, home/workspace/support/legal/OG responses, auth config, release, policy versions/hashes, health and AASA were checked on the current candidate/new domain. Hosted commercial readiness gates passed for the promoted intermediate deployment. The final candidate repeated those gates successfully with the new webhook URL. Public checks passed after promotion: new apex home/workspace/support/config/health/release/AASA/OG returned 200; www and old marketing/legal redirects returned 308 to the new host; old workspace and legacy backend returned 200. All three policy responses matched the approved local bytes and hashes. The old-origin workspace was opened in Chrome and showed Synced, the existing Pro workspace and Data & Recovery access.

Evidence screenshots and private phone/container backups are outside the repository under the owner's Codex migration-evidence folder. Env files, reviewer credentials and private backups must never be committed.

## Final receipt updates

The Clerk invitation template was inspected and previewed: subject, sender (`invitations@per.codes`), icon, body and footer render per codes. All active Authentication and Security templates use Clerk defaults; no custom old-branded template was found. Passkeys, Organizations, Waitlist and Clerk Billing templates are unavailable because those features are disabled. No template email was sent. Portal sign-in/sign-up fallbacks and explicit logo home `per.codes` were saved and verified after reload.

The complete main check passed again after the final source changes. The remaining precheck chains passed in segmented runs after correcting additional stale brand/origin expectations; legacy-origin return coverage remains explicit. A fresh single `npm run check` is now running to obtain a complete command exit receipt. Optional beta-public-surface probing also encountered pre-existing native UI source-pattern drift (for example, the old Current plan label); that optional script is not part of the main check and was not rewritten or claimed green.

Unverified acceptance is limited to the canceled Apple sandbox purchase/restore flow, the stopped Microsoft app email-verification step, physical universal-link tap routing, native policy-link taps and a real paid Checkout completion. No App Store release was submitted. Keep these distinctions when reporting production readiness.

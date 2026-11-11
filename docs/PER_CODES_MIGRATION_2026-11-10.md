# per codes migration receipt — November 10, 2026

The migration continues handoff `507ef2785` from production `fe0ffe9cc`, in an isolated worktree on `codex/per-codes-rebrand`. The original checkout and its untracked duplicate files remain untouched.

## Live state

- `https://per.codes` serves the rebranded site and workspace over HTTPS. `www.per.codes` redirects 308 to the apex.
- The SAME Vercel project was renamed from `permitext-sync` to **per-codes**. Project ID remains `prj_6rWwwb50xxxKI7qu92HzzqB5nkYs`, team `team_9EJNb6mc4ZUQ5bhRcRhmoBRR`. Its database and storage were retained.
- Cutover deployment `dpl_DfNshoposQAfMzH9wA9tnZ55HFVz` (source `708e01253e49d1174507c270b887b4fb1746d2b4`, URL `https://per-codes-1az6dcczj-randycodexs-projects-b72fc111.vercel.app`) was promoted successfully after hosted build gates and staged HTTP checks. It includes the authenticated-return fix, web version `20261110-per-codes-v1651`, shell `permitext-pro-shell-v2229`, support recovery guidance and host-scoped redirects. The earlier 0183 deployment remains a rollback reference.
- Production now tracks `main` through the existing Git integration. Automatic deployment `dpl_A6MtP6bQ5xvXCEopT53iKoBEwTUV` verified commit `47b9f0a4eed451a8adca3961ee4babde047f0758` serving through per.codes, with the legacy backend still available. Later documentation/test receipts do not change those runtime defaults. Read `/release` for the exact current serving SHA and deployment host.
- The former `permitext-sync.vercel.app` Production alias was initially retained, then replaced with `per-codes.vercel.app` after the owner clarified that their phone is the sole installation and that phone authenticated/synced through per.codes. The replacement alias returns HTTP 200; the retired alias returns 404. See the follow-up receipt below.
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

Fifteen focused native XCTest cases passed with zero failures: seven account-deletion verification cases and eight entitlement/sync cases covering canonical and legacy universal-link parsing, spoofed-host rejection, bundled-code deep links, backend URL validation, restore cancellation, account binding, Sandbox continuity, token persistence and Clerk callback exchange. These ran in a separate generated Simulator, which was removed after testing; the existing Simulator and phone data were retained. The XCResult and log are saved privately in `migration-evidence/2026-11-10-per-codes/native-contract-tests.xcresult` and `native-contract-tests.log`. The unsigned test harness logged a Clerk keychain entitlement warning after its passing result; the signed physical phone separately established actual authentication and sync. These tests do not establish a successful provider purchase or physical universal-link tap.

Restore Purchases reached the existing Apple sandbox account password prompt. The owner did not recall that password, so the prompt was canceled. The app confirmed restore canceled and current access unchanged. Successful purchase/restore acceptance remains pending; no financial purchase occurred. Physical universal-link tap routing and final native policy-link taps remain unverified. The signed app entitlements contain the new applinks/webcredentials domains and the unchanged app identifier; Apple CDN AASA returns 200 with the matching app identifier and routes. The last signed CFBundleName build was installed in place successfully. Mirroring automation repeatedly became unavailable during scrolling, so further scroll attempts were stopped. After that update, the app pulled the production audit workspace, all six saved evidence items, and the current notebook notes.

App Store Connect draft name, description, support/marketing/privacy URLs, review-note branding, subscription-group and monthly-subscription display names were saved on the existing app/products. The Production Server Notifications URL now uses per.codes; isolated Sandbox notifications remain on their existing backend. The inspected iPhone screenshot slot has zero uploaded screenshots/previews. No binary was uploaded, no Add for Review action was taken, and manual release remains selected. See the local App Store metadata receipt for exact IDs and limitations.

## Storage and compatibility

No browser data, service worker storage, saved work, database, account, subscription or entitlement was deleted. Bundle IDs, purchase IDs, SKU, storage keys, data paths and protocol headers retain their compatibility identifiers. These remaining internal strings are intentional. The native backend address moved to per.codes in the sole-phone follow-up below.

The live redirect rules affect only old-host marketing and legal pages after new-domain validation. `/workspace`, `/web`, API, sync, webhook and section-link routes are not redirected across origins. The support page explains waiting for pending sync and exporting a recovery backup before closing an old tab or clearing browser data. Old workspace access remains available for local recovery.

The source comparison against production `fe0ffe9cc` retained database schemas and SQL behavior, account isolation, storage keys/paths, purchase identifiers, amounts, Research allowances and spending limits. The PostgreSQL sync-repository changes are error-message branding only; the native user-data-store change is a comment. Runtime changes beyond visible copy and public links are the new Clerk/domain allowlists, CSP, host-scoped redirects, authenticated-return sync ordering and cache revisions. A final compatibility correction keeps the old generated account-name placeholder recognized by profile setup alongside the new placeholder, preserving existing-account onboarding without changing authored names. Its real client-function contract passed. The final web version is `20261110-per-codes-v1652`, shell `permitext-pro-shell-v2230`. Historical saved records, issued files and old policy-acceptance records were not rewritten to remove their original brand.

## Validation status

- The original site-investigation body.text and privacy-page analytics failures were resolved. Structured provider-double fixtures explicitly request verified mode; production fast-stream defaults and spending guards remain unchanged.
- The main `npm run check --ignore-scripts` chain passed after restoring meaningful scoped deletion coverage and updating stale branding/harness fixtures.
- Auth loader/return identity fence, startup restore, cache/offline coherence and approved-policy/marketing/billing focused checks passed.
- A NEW November 10 Zoning comparison snapshot was created and reviewed after the old-brand snapshot blocked precheck: only the artifact date, five clarification brand strings, and their derived plan/context hashes differ; all gates, cases, rubrics, sources, costs and outcomes are unchanged. The October snapshot remains immutable. Additional old structured fixture failures were fixed without changing production research semantics. These tests use intercepted provider doubles and do not certify live AI/legal correctness.
- Live HTTPS, home/workspace/support/legal/OG responses, auth config, release, policy versions/hashes, health and AASA were checked on the current candidate/new domain. Hosted commercial readiness gates passed for the promoted intermediate deployment. The final candidate repeated those gates successfully with the new webhook URL. Public checks passed after promotion: new apex home/workspace/support/config/health/release/AASA/OG returned 200; www and old marketing/legal redirects returned 308 to the new host; old workspace and legacy backend returned 200. All three policy responses matched the approved local bytes and hashes. The old-origin workspace was opened in Chrome and showed Synced, the existing Pro workspace and Data & Recovery access.

Evidence screenshots and private phone/container backups are outside the repository under the owner's Codex migration-evidence folder. Env files, reviewer credentials and private backups must never be committed.

## Final receipt updates

The Clerk invitation template was inspected and previewed: subject, sender (`invitations@per.codes`), icon, body and footer render per codes. All active Authentication and Security templates use Clerk defaults; no custom old-branded template was found. Passkeys, Organizations, Waitlist and Clerk Billing templates are unavailable because those features are disabled. No template email was sent. Portal sign-in/sign-up fallbacks and explicit logo home `per.codes` were saved and verified after reload.

The full precheck and main phases passed in the first fresh command, which then exposed stale postcheck UX/calculator harness assumptions. Those were corrected to verify current brand text, address preservation, workspace-scoped Trash and toolbar markup, bounded conflict-renderer extraction and the actual imported title helper. `npm run postcheck` then passed in full. The final fresh single `npm run check` completed with exit code **0**, including precheck, main and postcheck. Its complete log and JSON exit receipt are retained privately as `complete-check.log` and `complete-check-receipt.json` in the migration-evidence folder. The final profile-placeholder correction additionally passed the account-profile, Clerk, cache and offline contracts; the full run's main/postcheck phases also used the updated source and version. The additional `test:public-surface` chain passes after reconciling stale brand, native plan-label, canonical policy-link and reviewed-Project disclosure expectations. No removed UI helper copy was restored.

Unverified acceptance is limited to the canceled Apple sandbox purchase/restore flow, the stopped Microsoft app email-verification step, physical universal-link tap routing, native policy-link taps and a real paid Checkout completion. No App Store release was submitted. Keep these distinctions when reporting production readiness.

## Follow-up: sole installed iPhone

The owner clarified that their iPhone is the only installed copy. The native Debug and Release backend targets were therefore changed to `https://per.codes`. The production Debug build maps only the exact former stored production default to the new bundle target, preserving explicit localhost, custom and isolated Sandbox overrides. A fresh Application Support backup contains 232 files. The signed device build succeeded, installed in place, and its built Info.plist and physical Account screen report per.codes. The same account retained Lifetime Pro, 94 turns, Synced status and a current successful push. Six saved evidence items and the existing notebook list remained available. Sixteen focused native tests passed with zero failures. After these checks, the old Vercel alias was replaced through the dashboard; per-codes.vercel.app returns 200 and permitext-sync.vercel.app returns 404. Browser recovery remains a separate reason to retain the old custom domain.

Opening the rich table-formatting test Note then exposed a pre-existing native decoder limitation: `NotebookBlock.content` accepted only inline arrays, while BlockNote tables use an object. The same limitation exists in production baseline fe0ffe9cc. The native fix preserves the complete table-content JSON and rich inline marks so opening and re-encoding a web-authored document does not discard them. Three focused native checks passed, including semantic equality of a table/paragraph fixture with spans, cell formatting, links, widths and null values, rejection of an invalid table shape, and the existing reference/image round trip.

The first physical render then exposed an autosave echo: the server includes default table background/alignment properties that BlockNote's table schema omits. Each acknowledgement therefore looked like another edit. The Note was closed to stop the requests; the synthetic test Note's version counter advanced from 3 past 120, while its cached server plain text matched the original. No other Note was edited. The native bridge now restores only missing inert table defaults in its snapshot and equivalence check. Its regression compares the actual serialized server canonicalizer with the renderer shape and proves an acknowledgement does not replace the editor. Bridge lifecycle, autosave/revert, notebook dependency security and public-surface checks pass. The native editor bundle was rebuilt and installed.

The test exhausted the account and network notebook list/save counters. After owner-completed Vercel identity verification, their exact rows were inspected and backed up; a phone retry identified the network principal. Only those four exhausted rows were set to count 1, retaining their original reset times, normal limits and all user records. Read-only mode was restored and the temporary database tab closed. The recovery query and before/after results are saved privately. No billing, research, entitlement or content rows were changed by the recovery.

Physical acceptance then passed on the updated phone: the rich table rendered, remained Synced without idle saves, saved one controlled QA edit and its undo, and reopened Synced. Mirroring pasted the Mac clipboard rather than the requested test character; undo immediately restored the original. Private before/after Application Support copies prove the complete document, plain text and title are identical; the version advanced exactly from 123 to 125 for those two writes. Both account/network save counters advanced from 1 to 3 and stayed at 3 after reopening. The document SHA-256 is `0962a31a37ccfcb5d7f9e0725bdf72e2382f03b89101c85ba123bee6e9df71dd`. The extra test versions were retained rather than rewriting history. Final screenshots show the restored table and the same account's Lifetime Pro, 94 turns, per.codes backend and Synced state. The follow-up main check chain (`npm run check --ignore-scripts`) and a fresh `npm run postcheck` both completed with exit code 0; their logs are saved separately from the earlier complete pre/main/post run.

## Owner-directed retirement of the old custom domains

After the checks above, commit `4b949b7c1f52868e2485fe119807d2dea6e4d30f` deployed successfully and passed 27 live public checks. The owner then clarified that they are the sole user and do not require old-domain links or browser recovery. This supersedes the earlier retention decision: both `permitext.com` and `www.permitext.com` were removed from the existing Vercel project's domain mappings. Only `per.codes`, its `www` redirect and `per-codes.vercel.app` remain. The obsolete migration/recovery section was removed from the public support page. Domain registration, Gmail, the existing database, identities, saved work and purchase identifiers were retained; removing these host mappings does not delete their data. The earlier receipts describe the state before this intentional retirement.

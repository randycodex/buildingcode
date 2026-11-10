# per codes migration checkpoint — November 10, 2026

The source rebrand continues handoff `507ef2785`, based on production
`fe0ffe9cc`, in an isolated worktree. The owner's original checkout and its
untracked duplicate files remain untouched. The owner deferred login/MFA and
account-dependent cutover work until tonight. Do not treat this checkpoint as
new-domain production acceptance or App Store release authorization.

## Current boundaries

- Keep the existing Vercel project `permitext-sync` and its current database.
- Keep the same Clerk application and production instance. The application
  name is now **per codes**, and its support email is `permitext@gmail.com`.
  Both values were saved and verified after reload. Its old wordmark logo and
  favicon were also replaced with the existing app icon and verified after a
  fresh reload. The default verification
  email preview now renders per codes through `{{app.name}}`; its sending
  domain remains permitext.com until the coordinated domain change.
- `per.codes` and `www.per.codes` are attached to that Vercel project. The www
  domain has a 308 redirect to the new apex. Authoritative DNS still points to
  Squarespace parking. No DNS records or nameservers were changed in this run.
- No old-domain redirect was introduced. In particular, preserve the old
  workspace, service worker, APIs, OAuth callbacks, billing webhooks, and
  `permitext-sync.vercel.app` backend for existing installations.
- Bundle IDs, product IDs, subscription-group ID, Clerk user IDs, database
  identities, local paths, storage keys, and protocol/header names are retained.
- No App Store submission or release was performed. Updated listing text is a
  target in `NYC CC APP/docs/app-store/metadata-en-US.md`, not a remote receipt.

## Source and verification

Finished the remaining visible web/native branding, sign-in copy and preview
links, README guidance and App Store target text. Rebuilt frontend and native
Notebook bundles. Replaced the homepage’s old-branded hero screenshot with a
fresh Reader/Search capture from the current app in an isolated synthetic Pro
fixture; no owner/customer records or provider calls were used. Replaced `public/og-image.png` using the built-in image tool
with a text-only rebrand prompt: replace “permitext” with “per codes,” retaining
the existing icon, layout and copy. The final PNG is 1200 × 630, within the
150 KB budget. Updated approved policy hashes and retained the new version IDs.

The web client is `20261110-per-codes-v1650`; both shell manifests use
`permitext-pro-shell-v2228`. Changed update, Notebook and account-verification
assets have new URL versions so existing immutable caches do not hide the
rebrand. Public marketing and support pages load the existing privacy-safe
analytics bundle. Approved policy documents and purchase confirmation remain
excluded from analytics loading.

The original site-investigation and PDF HTTP provider fixtures now explicitly
request `answerMode: "verified"`. Their old structured response doubles do not
represent the default fast-stream wire format. The same explicit mode repairs
the scope-review HTTP fixture. No production response mode or spending guard
was changed. Updated stale expected branding in source-policy/update tests.

Verified locally:

- Clerk auth, loader, sign-out, and production-auth-audit contracts.
- Approved policy integrity, policy acceptance and publication-audit contracts.
- Marketing-entry, web-launch, build-output, shell-cache, offline-shell,
  update-safety, billing, Apple Sandbox readiness and sync-identity contracts.
- Site-investigation HTTP in ordinary and rich-project variants, PDF summary
  completion/rejection, and structured scope-review mechanics with intercepted
  providers. These are mechanics evidence, not live AI/legal acceptance.
- The local production build completed (hosted commercial checks are separate).
- Deploy-content validation, including 1,111 served assets and the search
  projection (578 chapters, 32,552 sections).
- Chrome on the Mac: the branded home page opens the branded workspace, and
  Reader loads real local code content. Authentication has no local production
  credentials. The local analytics script reports its expected missing Vercel
  insights endpoint; this is not production analytics evidence.
- Xcode simulator-target build succeeded with the existing bundle ID. Runtime
  testing is pending: CoreSimulator reported version 1171.7.0 versus required
  1174.21.0, and device inventory showed no connected physical iPhone.

**The complete suite is not green.** `npm run check --ignore-scripts` stops at
`tests/evidence-folders-contract.mjs:321`, whose source-pattern assertion for
Clear All Bookmarks also fails on untouched production commit `fe0ffe9cc` in
the original checkout. Do not weaken that deletion contract merely to clear a
rebrand gate. `npm run check` advanced past the original failures and exposed
an older structured scope-review fixture; its explicit-mode repair now passes
its focused contract. The final full-check attempt then stopped in
`tests/research-revision-verification-http-contract.mjs:92` at another legacy
structured response double receiving a fast request. The same failure was
reproduced on untouched `fe0ffe9cc`. Remaining stages must still be run and any
failures reconciled before claiming complete-suite acceptance.

## Vercel configuration access

The cloud connector still returns 403 when listing environment variables.
The Mac's own Vercel CLI 65.14.0 successfully lists them and inspects the
existing project with explicit scope. This removes the need for a dashboard
login for ordinary Vercel deployment/configuration work. No secret values are
stored in this document or committed to the repository.

Use the existing project and team explicitly:

```text
project: prj_6rWwwb50xxxKI7qu92HzzqB5nkYs
team: team_9EJNb6mc4ZUQ5bhRcRhmoBRR
```

At cutover, set these production values together with the verified Clerk
configuration, then build a new candidate:

| Variable | Target |
| --- | --- |
| PERMITEXT_PUBLIC_BASE_URL | https://per.codes |
| PERMITEXT_TERMS_VERSION | terms-2026-11-10-rebrand |
| PERMITEXT_PRIVACY_VERSION | privacy-2026-11-10-rebrand |
| PERMITEXT_SUBSCRIPTION_POLICY_VERSION | subscriptions-2026-11-10-rebrand |
| PERMITEXT_STRIPE_WEBHOOK_URL | Retain the exact verified existing legacy webhook URL |
| CLERK_AUTHORIZED_PARTIES | https://per.codes,https://www.per.codes,https://permitext.com,https://www.permitext.com |
| CLERK_FRONTEND_API_URL | https://clerk.per.codes, after Clerk verification |
| CLERK_ACCOUNT_PORTAL_URL | https://accounts.per.codes/sign-in, after Clerk verification |
| CLERK_PUBLISHABLE_KEY | The new public key from the SAME production instance |

Keep Clerk secret/signing material and all database, Stripe, Apple, Blob,
monitoring, product and purchase identifiers attached to their existing
resources. Do not rotate credentials as part of a name change. The native
Xcode publishable-key settings still target clerk.permitext.com and must be
coordinated with domain compatibility before shipping a new binary.

## Staged-deployment findings

The first staged Production build used deployment-only new public/policy/origin
values without assigning live domains. Its content checks passed, and the
commercial configuration, Price, tax and monitoring checks were valid. The
readiness gate rejected a missing release SHA and the missing new-domain Stripe
webhook; it did not promote an incomplete build.

The source now supports `PERMITEXT_STRIPE_WEBHOOK_URL` for an explicitly retained
compatible endpoint, with exact provider endpoint/status/event verification
preserved. Invalid hosts, credentials, queries, fragments, paths and ports fail
before provider requests. Focused Beta 1, billing and operational-readiness
contracts pass. Package and lockfile engines now pin Node 24.x, matching the
existing project and local validation, rather than selecting a new Node major.
CLI candidate retries supply their exact source SHA/release ID explicitly.

## Tonight's cutover sequence

1. Complete Squarespace login/MFA. Export or capture its existing DNS zone;
   preserve all mail, verification, DNSSEC and unrelated records. Do not change
   nameservers. The team-scoped Vercel API currently returns preferred IPv4
   values `216.150.1.1` and `216.150.16.1`, plus preferred CNAME
   `da4ef9ed8e59bcef.vercel-dns-017.com.`. Re-read the project's domain panel at
   action time and use its exact record set. Replace only conflicting parking
   A/AAAA/www records. Verify authoritative and recursive DNS and HTTPS.
2. In the SAME Clerk instance, settle old-installed-client compatibility
   before changing the primary domain. Installed binaries embed the old
   publishable key and clerk.permitext.com hostname. Clerk's documented primary
   domain change generates a new publishable key and requires DNS, certificates
   and social callback updates; source-level dual-origin acceptance alone does
   not retain the old Frontend API. The dashboard labels satellite domains as
   a Pro feature on the current Hobby organization. Establish a supported
   coexistence path and any plan implications before cutover.
3. Configure Clerk's exact per.codes Frontend API, Account Portal and email
   DNS records; retain legacy records while needed. Keep Apple Services ID,
   Google client ID, Microsoft application/tenant IDs and native callback
   scheme unchanged. Add new domain/callback URLs to those existing OAuth
   clients, and keep old callbacks. Update portal home/redirect allowlists,
   policy links and any hard-coded email content. Confirm actual email delivery
   separately from the sample preview. Keep the existing Gmail support mailbox.
4. Review Stripe in its existing account: public branding and website/support
   links, existing product display names, Checkout success/cancel returns,
   customer-portal return URL and webhook delivery. Keep subscriptions, Price
   IDs, product IDs and the existing functioning webhook endpoint/signing
   secret. Changing canonical return URLs does not require a new subscription
   or a charge.
5. Update Vercel production configuration as above only when coordinated with
   Clerk; stage a production candidate without assigning domains, verify it,
   and promote the intended build after new-domain acceptance. Preserve the
   existing rollback target and configuration receipt.
6. Complete new-domain browser authentication for existing identities and
   supported providers; verify the same account IDs, saved work and Pro access.
   Verify real Checkout/portal returns without making an unrequested purchase,
   sync, policy versions/hashes, code share links and HTTPS. Restore the same
   account on an actual iPhone; verify universal links, sign-in, sync and
   StoreKit purchase/restore in the already isolated Sandbox workflow. Do not
   grant Sandbox transactions Production entitlements.
7. Update App Store Connect's existing listing/localizations, policy/marketing
   URLs and screenshots after verifying the final device build. Keep manual
   release; do not Add for Review, Submit for Review or release.
8. Redirect old public marketing traffic only after the above works. Never use
   a domain-wide redirect that catches old workspace/API/webhook/client routes.
   Browser IndexedDB, local storage, cookies and offline caches cannot move
   automatically between these origins. Keep the old workspace available;
   have users sync and export device-only work before moving, and verify that
   the new origin restores it. Do not clear old storage or force navigation of
   a workspace with pending edits/uploads/outbox mutations.

References: [Clerk domain changes](https://clerk.com/docs/guides/development/deployment/changing-domains)
and [Clerk satellite domains](https://clerk.com/docs/guides/dashboard/dns-domains/satellite-domains).


## Verified candidate receipt

- Code commit: `50ab0abe0833d81d85d9c0178b84327c90e61b69` on
  `codex/per-codes-rebrand` (following branding commit `77e2c61ec`).
- Worktree: `/Users/randy/.codex/worktrees/per-codes-migration`.
- Existing Vercel project, Production-targeted build, **not promoted**:
  [deployment inspector](https://vercel.com/randycodexs-projects-b72fc111/permitext-sync/6KEWnuzRbbeYXAqVyB2Ue6ww5txk).
- Protected candidate:
  `https://permitext-sync-f9dlgen00-randycodexs-projects-b72fc111.vercel.app`.
  This is an inspection candidate, not final new-domain authentication acceptance.
- Vercel reports `READY` with no assigned aliases. The hosted production build
  passed the commercial, retained live Stripe webhook/Price/tax, release identity
  and monitoring gates on Node 24.x. No existing Stripe resources were modified.
- Twelve authenticated-to-Vercel, read-only HTTP requests returned 200: home,
  workspace, release, current policies, Clerk configuration, AASA, the three
  policy documents, both new images and health. This bypasses Vercel deployment
  protection for the owner and is not evidence that the candidate is public.
- `/release` reports exactly `50ab0abe0833d81d85d9c0178b84327c90e61b69`.
  All three served policy bodies match their approved SHA-256 hashes, versions
  and per.codes URLs. Both image bodies match the committed assets. The workspace
  uses web version `20261110-per-codes-v1650`.
- Health reports `ok: true` and `storage: postgres`. AASA retains the exact
  existing Apple app ID and `/open/section/*` association. No authenticated
  customer sync, purchase/restore or identity acceptance is claimed.
- Candidate Clerk configuration intentionally retains `clerk.permitext.com`
  and `accounts.permitext.com/sign-in` until the coordinated coexistence work.
  Rebuild after final Clerk settings; do not promote this candidate unchanged
  as proof that per.codes sign-in works.
- After the candidate became ready, both `https://permitext.com/release` and
  `https://permitext-sync.vercel.app/release` still returned 200 and production
  commit `fe0ffe9cc47aa9b5f1e7df399284d5947e500c99`. Public per.codes DNS still
  returned the four Squarespace parking A records. No traffic cutover occurred.
- Private screenshots, DNS snapshot and source-ID compatibility evidence are
  retained outside Git in
  `/Users/randy/Documents/Codex/migration-evidence/2026-11-10-per-codes/`.

The source compatibility audit compared the production baseline with this
branch: StoreKit product/subscription-group IDs, Xcode bundle/team/product
identifiers, native callback schemes, web storage key literals and all legacy
associated domains are unchanged; the new associated domain is added.

### Asset generation receipt

Final social asset: `permitext-sync-server/public/og-image.png`. Built-in image
editing was used, followed by PNG compression to the existing size budget.
Prompt:

> Use case: text-localization. Edit target: the referenced Permitext social-sharing image. Change only the large wordmark text 'permitext' to exactly 'per codes' (all lowercase, a space between per and codes), preserving the existing white bold sans-serif style, baseline, and left alignment. Keep the red app icon, three colored stacked diamonds, dark background, rounded panel, subtitle 'NYC building code research workspace', and line 'Read • Search • Research • Report' unchanged. Preserve the 1200 by 630 social-image aspect ratio and sharp professional appearance. Do not introduce any extra text or new branding elements.

Final homepage screenshot:
`permitext-sync-server/public/marketing/workspace-per-codes.png`. This is a
fresh screenshot of actual Reader/Search UI with synthetic local project data,
not an AI-edited product screenshot. Old unused marketing captures are retained.


Clerk asset closeout: uploaded the existing
`public/icons/permitext-192.png` logo and `public/favicon-32.png` favicon to the
same application. Native Chrome file dialogs completed both uploads; no browser
permission setting was changed. The direct extension file-upload path requires
“Allow access to file URLs,” so use the native picker if that option remains off.
Updated evidence is in `clerk-branding.jpg`; the earlier name-only view is kept
as `clerk-branding-before-logo.jpg` in the private evidence directory.

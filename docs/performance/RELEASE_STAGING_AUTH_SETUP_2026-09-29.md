# Authenticated candidate staging setup

Status: candidate web614 deployed to the existing isolated sandbox; authenticated acceptance remains blocked by the sign-in return path. Production has not been promoted.

## September29 live discovery — existing staging found

Read-only Vercel project/environment metadata confirms `permitext-sync` Clerk variables are Production-only; Preview has browser fallback and shares database/Blob variable scopes with Production. Do not simply extend its Production auth configuration to arbitrary previews.

Existing project `permitext-apple-sandbox` (`prj_81ZgJez2jeN9un5yZVJMQhJ3GvJj`) has custom environment `apple-sandbox` (`env_lWJa0VVvILVEuNxUMU6ayrg6OUpy`). Current public checks on https://permitext-apple-sandbox.vercel.app return Clerk available, frontend https://clerk.permitext.com, account portal https://accounts.permitext.com/sign-in, and browserFallbackAllowed false. It intentionally uses the existing live Clerk identity with isolated application storage, rather than requiring a new Clerk user. Thus the earlier proposed separate-Clerk requirement below is not necessary if reusing this already-authorized staging configuration; do not copy or broaden any auth credentials/origins.

Its /release identifies b83194446a6ed8178f597d8bb9a81475b0d52a0b, deployment dpl_Ap73hjFdfjGr4uyzauAmXUuihpXv, environment Preview. Existing Apple readiness evidence records dedicated Neon and private Blob resources for this custom environment. Environment metadata includes the corresponding custom-scope database, Blob and Clerk keys; secret values were not pulled. Resource isolation must be rechecked at deployment preparation, not inferred from generic inherited Preview variables.

Concrete next action: prepare candidate04e8f59b9 for this existing custom environment, verify protected deployment before changing the stable alias, preserve the prior deployment for rollback, then ask owner to sign in normally. Updating the stable test host also affects older Apple sandbox/TestFlight builds configured to use it. Production permitext.com and installed native41.35 must remain unchanged. No deployment, environment mutation, entitlement grant or data write was performed during discovery.

## Priority sequence

1. **Identify an existing staging environment first.** Record its deployment/project, stable HTTPS origin, database and asset-store ownership, and Clerk instance. Record names/identities only, never secret values. If none exists, agree on the proposed dedicated staging resources before creating paid services or expanding authentication access.
2. **Keep storage and identities isolated.** Configure a dedicated staging PostgreSQL connection via `PERMITEXT_SYNC_DATABASE_URL` (preferred explicit name). The server also accepts `DATABASE_URL`, `STORAGE_URL`, `POSTGRES_URL`, or `NEON_DATABASE_URL`; check that inherited alternatives cannot select Production. Use staging-only asset storage and admin credentials. Do not clone real account records. A matching email in a different Clerk instance is a different user identity; the Production lifetime grant and test Project do not automatically transfer.
3. **Configure real staging authentication.** From the selected Clerk staging instance, supply `CLERK_PUBLISHABLE_KEY`, `CLERK_FRONTEND_API_URL`, `CLERK_ACCOUNT_PORTAL_URL`, and backend verification using `CLERK_JWT_KEY` or `CLERK_SECRET_KEY`. Use `CLERK_AUTHORIZED_PARTIES` with the exact approved staging origin. Use a stable origin to avoid continually broadening the list for ephemeral deployment URLs. Scope configuration to staging/preview, not Production. Do not set `CLERK_REQUIRE_LIVE=1` on this staging instance: source interprets it as Production and enforces the two permitext.com origins and live keys.
4. **Disable browser-only fallback for acceptance.** Do not set `PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN=1` in staging. The observed preview609 Sign in path produced `Web browser`, `Email unavailable`, and Free; that does not prove Clerk or Pro acceptance. The normal hosted path should report configured Clerk availability and show the expected account after login. A configuration failure must remain a failed gate rather than being treated as a successful identity test.
5. **Verify configuration before owner sign-in.** Run existing auth contracts locally; check deployed `/account/clerk/config` reports available with the intended public endpoints. Check `/account/apple-web-config` reports browserFallbackAllowed false. Inspect only public configuration and redacted presence/identity metadata. Verify private APIs reject unauthenticated requests and responses are not publicly cached using the repository's existing auth/private-cache verification paths.
6. **Prepare one authorized staging Pro identity.** Owner signs in through the normal UI. Confirm the exact identity before an explicitly approved staging grant; no payment or subscription is required for this test. Never grant Pro to the browser-fallback identity as a workaround. Label all synthetic staging records clearly.
7. **Run the bounded candidate journey.** Pin the runtime source (currently d7f1191dd, web609/shell1252/Notebook18), verify deployed assets, create one synthetic Project/Note/Saved passage, reload, and confirm exact text, edition, assignment, and selected-state semantics. Exercise the Notebook accessible name and visible save status. Record canonical persistence and rendered results separately. Reuse local outage evidence; repeat hosted interruptions only where needed to establish the deployment boundary.
8. **Keep native cross-device acceptance separate.** Prepared native41.34 uses its existing service configuration. Do not repoint it silently to staging or infer iOS sync from a web-only test. Finish the authorized existing Production test-account protocol on the phone, or explicitly prepare a separately identified staging native build if the owner chooses a staging cross-device test. Preserve the existing Project/Note/102.3 record.
9. **Close the gate explicitly.** Record source, URL, identity scope, tested paths and remaining limitations. Staging success does not authorize main merge, Production promotion, TestFlight distribution or App Store submission. Retain the prior working deployment for the applicable rollout decision.

## Source basis

- `permitext-sync-server/clerk-auth.mjs`: `clerkConfigurationStatus`, `clerkAuthorizedParties`, `productionEnvironment`.
- `permitext-sync-server/app.mjs`: database URL precedence, `browserFallbackSignInAllowed`, `handleClerkConfig`, `handleAppleWebConfig`.
- `permitext-sync-server/public/app.js`: `signInCurrentBrowser`, `signInWithBrowserFallback`.
- [Observed preview limitation](PERF_PREVIEW_609_AUTH_2026-09-29.md).

No staging credentials, security configuration, data stores, entitlements or deployments were changed to prepare this document.

## Authorized candidate deployment — September29

Owner approved updating the existing sandbox host. Committed source04e8f59b934e29bc9b223c74a5c143fabb36900b was archived and deployed to the existing custom apple-sandbox environment with no auth/storage variable edits. Deployment dpl_4v25RQMsyR6ML8XEzTNQygGU3LiS reached READY; seven assets match local exactly (RELEASE_SANDBOX_614_IDENTITY_2026-09-29.json). Health confirms PostgreSQL normalized-v4 and configured networkless Clerk verification with one authorized party. Browser fallback is false. Stable permitext-apple-sandbox.vercel.app alias now points to the new deployment; /release confirms the intended commit. Production /release remains0c729b7d1727656d6b015682e2aff15466b2c8d3. Rollback target: permitext-apple-sandbox-dy1mgy2nu-randycodexs-projects-b72fc111.vercel.app (dpl_Ap73hjFdfjGr4uyzauAmXUuihpXv).

Rendered sign-in remains blocked: clicked first-use Sign in, then Account Sign in on the stable sandbox origin. Browser navigated to https://permitext.com/ instead of returning to sandbox. Source signInWithClerkWeb constructs the sandbox return URL with clerk_return=1 and supplies redirect_url to the configured account portal. Provider redirect behavior needs inspection; do not infer completed staging sign-in or broaden authentication origins without specific approval. No credentials entered, entitlement granted or test records created in staging.

## Redirect investigation checkpoint

Source review confirms the application supplies its current sandbox URL as `redirect_url`; ClerkJS loads with UI configuration only, without satellite-domain options. This narrows the investigation to the provider return-domain/session configuration but does not establish the exact dashboard cause. Browser warning/error logs were empty. The Clerk dashboard requires owner sign-in in this browser, so its domain and Account Portal redirect settings have not been inspected. Next: owner signs into dashboard.clerk.com, then inspect the current settings read-only before proposing any exact change. No authentication trust, credentials, Production settings or records were changed.

## Clerk dashboard inspection — September29

Owner made Clerk available in Chrome. Read-only inspection of application `app_3IFWdYk17Oo25fbdqFbzLp8vB4i`, instance `ins_3IFXaNGYIAq7yUABleZuCzKG2Ts` confirms:

- Verified primary domain is `permitext.com`.
- Account Portal sign-in/sign-up fallback fields are empty (default application domain); no custom forced fallback was found in those fields.
- Allowed-subdomain restriction is disabled.
- No satellite domains exist. Dashboard states multi-domain is unavailable on the current plan.
- The current sandbox host is outside the primary domain. This configuration is consistent with the observed redirect to Production. Clerk's [Account Portal documentation](https://clerk.com/docs/guides/account-portal/direct-links) requires an accepted return domain; this is not a malformed return URL in the Permitext client.

Proposed bounded correction, awaiting owner approval: assign `staging.permitext.com` to the existing isolated sandbox project/custom environment and route it to the verified candidate; add only that exact HTTPS origin to the sandbox backend's authorized-party list, retaining its existing entries. Keep Production's Clerk configuration, fallback URL, database and deployment unchanged. Verify TLS, exact candidate identity, no browser fallback, unauthenticated rejection, then owner sign-in and synthetic persistence acceptance. No paid Clerk upgrade is proposed. This adds a new authenticated test origin and therefore needs explicit approval before applying it.

Read-only Vercel domain inspection confirms `permitext.com` belongs to the existing team, with apex/www assigned to `permitext-sync`. Authoritative DNS is external (`ns-cloud-c*.googledomains.com`), not Vercel. `staging.permitext.com` currently has no DNS answer. DNS-provider access or an owner-created CNAME will be needed; obtain the exact target from Vercel after approved domain assignment. Do not change nameservers or apex/www records. No domain, DNS, authentication or environment settings were changed during this inspection.

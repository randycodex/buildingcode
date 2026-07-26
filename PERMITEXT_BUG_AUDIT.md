# Permitext bug + UX/UI audit

**Authoritative as re-checked:** 2026-07-26
**Implementation base:** local `main` began at `50f01851f` (*Complete Permitext hardening and continuity merge*); this audit and the UX reliability batch are the next local change.
**Published GitHub branch:** `origin/main` at `4bf190ac4` (*Harden Permitext storage, readers, and rate limits*)
**Production / live PostgreSQL:** Vercel deployment `dpl_DjixmFTPXTMLmUwFh46D1pyAj1jP` is `READY` on `4bf190ac4`; its health response reports PostgreSQL `normalized-v4`. This does not include the local-only commits.
**App Store / Apple associated-domain configuration:** not re-verified; local build/configuration is not App Store proof.

Local `main` is ahead of `origin/main`. The audit distinguishes repository evidence from a deployed Vercel function, live PostgreSQL, installed-app universal links, and App Store Connect because each can diverge.

## Executive summary

The prior critical/high engineering findings are resolved in the local hardening line. The remaining release work is primarily trust, truthfulness, recovery, and entitlement UX—not a reason to reopen already-fixed safeguards. The local UX reliability batch implements the iOS false-Saved note fix, truthful plan state, exceptional sync visibility, failed-reader recovery, empty states/accessibility, account copy, early Pro gates, Stripe restore UI, and conditional sign-out confirmation. Integrated local tests and rendered web/native checks pass; installed-app links, external identity/billing configuration, and real multi-device behavior remain separate release evidence.

## Re-verified resolved findings

| Finding | Status | Evidence boundary |
|---|---|---|
| Delete resurrection / server upsert on local delete | Resolved | Queued-delete merge and regression coverage in local source; multi-device production behavior still needs live QA. |
| Stripe checkout could grant forever-Pro | Resolved | Checkout only grants eligible subscriptions with a provisional expiry; lifecycle events preserve correct entitlement. |
| Lifetime/web Pro demotion | Resolved | Lifetime key and StoreKit fallback avoid non-authoritative demotion. |
| Research quota TOCTOU | Resolved | Reserve-before-model on PostgreSQL/file-store paths. |
| WKWebView navigation policy / teardown | Resolved | Policy and teardown implemented in native views. |
| PostgreSQL push rejection reasons | Resolved | Structured rejection reasons include free-plan codes. |
| Missing Workboards in normalized store | Resolved | `workboard` is included in the normalized-store union. |
| File-store R-M-W corruption | Resolved | Inter-process lock and atomic writes covered by tests. |
| Account-wide Free counts | Resolved | Do not reopen as a per-code-version limit issue. |
| Metadata deep-link resolution | Resolved | Do not reopen the former magic-section-ID threshold. |
| Admin bearer comparison | Resolved | Constant-time comparison is in place. |

## Necessary implementation work — implemented locally

| Priority | Finding | Required outcome |
|---|---|---|
| P0 | iOS note denial can still present **Saved** | A note save returns success/failure. Show Saved only after persistence; on denial restore the previous text and present the limit/upgrade explanation in context. This is the confirmed UX-1/UX-7 defect. |
| P0 | Web top bar always says Pro | Bind the badge to actual entitlement (`Free`/`Pro`), or hide it when signed out. |
| P0 | Mobile sync obscures exceptional states | Do not add a permanent Online label. Surface pending, offline, failed, and conflict states on mobile, with a prominent conflict action when user choice is required. |
| P1 | iOS reader remains on Loading Section after failure | Distinguish loading from missing/failed content and offer Retry, Browse Codes, or Back. |
| P1 | Saved/Search empty states and Search accessibility | Add concise explanation and next action; Search needs “Search codes” plus an accessibility label. Decorative art is optional. |
| P1 | Customer-facing account language | iOS and the signed-out web Account card now describe syncing saved sections, notes, and Projects across devices without test/backend jargon. |
| P1 | Pro gate timing | Gate Project creation at `+`, and make iOS tag availability explicit before a user fills an apparently usable control. |
| P1 | Stripe restore | Replace `window.prompt` with the existing web dialog pattern: instructions, validation, Cancel, Restore, and an actionable error. |
| P1 | Sign out | Confirm only for pending uploads or unresolved conflicts; clean sign-out remains immediate. |
| P1 | Projects navigation rule | The UI intentionally integrates Projects under Saved. Update the UX rule unless a rendered walkthrough shows the feature is not discoverable; do not add a redundant top-menu action by default. |

## Follow-up validation required after the implementation batch

Integrated local verification completed:

- The full free web `check` and production-style `smoke`/client build pass; no paid model calls were made.
- All 24 `EntitlementAndSyncContractTests` pass on an iPhone 17 Pro simulator, and the native target builds.
- Desktop/mobile web rendered with no console errors or error overlay. The Free badge, pre-form Project gate, Stripe restore validation, mobile clean/offline status behavior, immediate clean sign-out, hidden signed-out badge, and account copy were exercised.
- Native Saved and Search empty states, the Search accessibility label, and Settings account copy rendered in the simulator.

Release/manual evidence still required:

1. Exercise real Free denial for notes and tags and confirm rejected note text is restored with **Not Saved** feedback.
2. Exercise pending and conflict sync states end-to-end on mobile; the web Offline state and conflict-only action contract are locally covered.
3. Force a missing/failed native section load and exercise Retry/Browse recovery.
4. Verify conditional sign-out with actual queued uploads/conflicts, not only the clean path and source contracts.
5. Record separately: committed local SHA, pushed `origin/main` SHA, deployed Vercel SHA, live PostgreSQL health, installed-app deep links, and App Store Connect status.

## Deferred, accurately scoped

| Item | Status | When to revisit |
|---|---|---|
| Content-body coverage | Review individually | Structural/title-only entries must not be fabricated, but official headings without bodies can affect reader detail and Research eligibility. |
| File-store rejection detail | Deferred engineering | Production uses PostgreSQL; improve JSON-adapter parity only if it blocks local tests or development diagnosis. |
| Soft-delete tombstones | Deferred architecture | Current queued-delete merge protects the demonstrated resurrection failure. Reconsider only for a new deletion/resurrection class or broader retention needs. |
| Reader trust notice | Validate rendered experience | Settings/terms plus a restrained first-use or information notice may be sufficient; do not make a disclaimer dominant on every Reader. |
| Firm workspace on iOS | Product boundary | Full administration parity is not required. Consider better review-on-iPhone framing and an Open on Web action after walkthrough evidence. |
| Dual-reader labels / destructive-control style | Validate first | Prefer accessibility labels, a tip, and clear safe confirmations before permanent labels or wholesale `confirmationDialog` changes. |

## `permitext.com` migration: staged contract, not a casual string replacement

The apex domain is attached to the production Vercel deployment, `www` redirects to the apex, HTTPS is active, and the apex AASA response advertises the expected app identifier and section-link paths. The local UX batch accepts both hosts, adds the apex associated domains, and generates new public links on `permitext.com`. The iOS backend base remains on the legacy hostname until external identity and billing configuration is proven.

1. In Apple Developer, add and verify `permitext.com` for the web Service ID and `https://permitext.com/account/apple/callback`, while retaining the legacy hostname during transition.
2. Verify Apple web OAuth, account/session cookies, Stripe Checkout return/webhook behavior, and production PostgreSQL through the apex.
3. Verify universal links on an installed build; a passing AASA HTTP response and simulator build are necessary but not sufficient.
4. Keep `permitext-sync.vercel.app` accepted for old installed apps and already-shared links. Retain production tests that can target either host through environment variables.

## Current evidence anchors

| Concern | Path |
|---|---|
| Note save / reader recovery | `NYC CC APP/permitext/Views/ReaderView.swift` |
| Saved/Search UI | `NYC CC APP/permitext/Views/BookmarksView.swift`, `NYC CC APP/permitext/Views/SearchView.swift` |
| Settings, account copy, conflicts | `NYC CC APP/permitext/Views/SettingsView.swift` |
| Sync and entitlement contracts | `NYC CC APP/permitext/Data/UserDataStore.swift`, `NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift` |
| Web entitlement, gates, restore | `permitext-sync-server/public/app.js`, `permitext-sync-server/public/index.html` |
| Mobile sync chrome | `permitext-sync-server/public/styles.css` |
| Production checks | `permitext-sync-server/tests/production-health.mjs`, `production-aasa.mjs`, `production-identity-restore.mjs` |
| Domain / Apple configuration | `NYC CC APP/permitext/Info.plist`, `NYC CC APP/permitext/permitext.entitlements` |

## Related documents

- This is the living audit: `PERMITEXT_BUG_AUDIT.md`.
- Historical background only: `PERMITEXT_CROSS_PLATFORM_REVIEW_HANDOFF.md`.
- Release/compliance checklist: `Permitext_Recommended_Implementation_Roadmap.md`.

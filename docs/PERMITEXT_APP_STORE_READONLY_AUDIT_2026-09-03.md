# App Store preparation audit — September 3, 2026

Status: **Read-only live audit complete for the surfaces below; preparation remains open. Do not submit or release.**

Owner direction during this work: App Store submission/public release must be the last step. Keep preparing and testing; do not use **Add for Review**, **Submit for Review**, or public release controls without later explicit approval. No Apple settings were saved or changed during this audit.

## Fresh evidence

Observed through the owner's authenticated Chrome session on September 3 evening EDT (`2026-09-04T00:18Z`–`00:32Z`). App `6774385434`, bundle `com.randycodex.permitext`. Initial Apple content failed to render with extension errors; one reload recovered it. No extension settings were changed.

| Surface | Observed current state | Preparation needed |
| --- | --- | --- |
| iOS version 1.0 | Prepare for Submission; no selected build | Select the final accepted candidate only at the approved submission stage |
| TestFlight | Build 52 upload Complete; build row Ready to Submit | This is TestFlight status, not App Store approval or fresh physical-device acceptance |
| Screenshot Media Manager | Both 6.9-inch and 6.5-inch slots show 0/10 screenshots | Recapture final release-build images: the locally inspected build-33 Reader JPEG contains a debug control; upload only with approval |
| Version metadata | Description, keywords, support/marketing URLs, copyright and promotional text blank | Finalize local draft and obtain approval to enter it |
| App Information | Name `permitext`; subtitle blank; both categories unset | Proposed Reference / Productivity categories and subtitle remain drafts |
| Content Rights / Age Ratings | Both setup workflows not completed | Owner-confirmed rights and truthful current questionnaire responses required |
| App Privacy | Get Started; Privacy Policy URL unset; Publish disabled | Reconcile actual app/service data collection and obtain owner approval before publishing declarations |
| Review access/contact | Sign-in required checked; credentials, all contact fields and notes blank | Prepare safe reviewer access to account-based features, synthetic content and owner contact details |
| Release mode | Automatic release selected | Recommend manual release later; no change made during this read-only audit |
| App price | Add Pricing; starting price schedule not configured | Configure Free app price only with approval; distinct from the Pro subscription |
| App availability | 1 Available / 174 Not Available; tooltip explicitly identifies United States | US-only app distribution confirmed |
| Additional platforms | Apple Silicon Mac availability checked; Vision Pro availability checked but version marked incompatible | Owner choice: recommend disabling untested platform availability before final submission, or explicitly test those platforms |
| Subscription group | `permitext pro`, ID `22140923`; Prepare for Submission; localization Create control, no localization row | Add group localization with approval |
| Pro Monthly product | `com.randycodex.permitext.pro.monthly`, one-month duration, Prepare for Submission | Complete current product submission metadata |
| Subscription description | Describes saves/tags/exports/continuity/sync but omits included Research turns | Replace draft wording with accurate current benefits and allowance |
| Subscription review notes | Still says Settings, Upgrade to Pro, and future cross-device sync; no review screenshot visible | Update to the current account control and Plan section navigation and current functionality; add reviewed screenshot |
| Subscription territory / price | One territory selected; pricing exists; exact selected territory and US row were not independently verified in this audit | Preserve prior $20 intent, but recheck the exact US price/territory before any submission; do not infer from other USD territories |
| Production server notifications | Set Up URL; unset | Separately approve and verify the intended Production endpoint before configuring |
| Sandbox server notifications | `https://permitext-apple-sandbox.vercel.app/billing/apple/notifications` present | Preserve isolated sandbox routing |

Agreements, bank/tax account state, and the complete current privacy questionnaire were not re-audited. Older completed billing and physical-device records remain evidence for their exact recorded scopes, not fresh findings from this browser audit.

## Corrected review-access plan

The older local checklist's blanket advice to uncheck sign-in and ask reviewers to create their own account is not sufficient for the account-based feature review. Apple's [review guidelines, Before You Submit and 2.1](https://developer.apple.com/app-store/review/guidelines/) call for full feature access with a working demo account or suitable demo mode. Prepare a dedicated synthetic reviewer identity/access plan, verify it independently, and describe the passwordless/identity-provider workflow accurately. Do not disclose the owner's account credentials, introduce an authentication bypass, or enable public demo entitlements without separate review and approval.

## One consolidated physical-device session — not a repeat of passed checks

Retain build-52 Lifetime Pro/Synced, existing Project/saved-section continuity, 2014 Chapter 7 and complete Figure 705.7 evidence. Retain the earlier Stripe and Apple sandbox monetary/lifecycle results; no new purchase is requested here.

1. Finish the unverified wide-table horizontal interaction and remaining native navigation/state observations.
2. Exercise fresh and existing supported sign-in paths on suitable test identities; verify correct account/data reconciliation. Owner handles credentials and verification codes. Do not repurpose the owner's Lifetime Pro account for destructive tests.
3. On a separately authorized disposable identity only, export, delete, verify inaccessible session/assets and empty Free state on recreation; retain counts/outcomes rather than private export contents.
4. Confirm corrected ramp answer/Project-context behavior only after a new exact paid-test authorization, if still selected as a launch gate. Prior authorizations are consumed. Do not launch a batch or reopen the six deferred Zoning cases.
5. Inspect final policy/plan presentation and candidate identity; keep existing passed checks unless materially affected.

The spend-notification/pause evidence and owner legal/content decisions remain separate from the phone session. App Store submission and release stay last, after these gates and later explicit owner approval.

The local English metadata draft now corrects the allowance to 100 completed-and-saved turns per UTC calendar month and uses the source-verified Open Account control / Plan section. Its reviewer-access instructions are explicitly marked incomplete; no credentials or demo privileges were created. Final candidate screen wording and owner approval remain required before entering that draft in Apple.

## Local screenshot audit

All four JPEGs in `NYC CC APP/docs/app-store/screenshots/iphone-6.9/submission/` were visually inspected and checked with `sips`: 1320 × 2868, no alpha. They show library, Reader, search, and Saved without visible personal account information. `02-code-reader.jpg` visibly includes the ladybug control corresponding to `readerDiagnosticSelector` in `ChapterHTMLReaderView.swift`. This contradicts the old package's clean-diagnostics claim; its README and checklist now explicitly require recapture from the final release configuration. The original files are retained unchanged. No fresh screenshot package is claimed ready.

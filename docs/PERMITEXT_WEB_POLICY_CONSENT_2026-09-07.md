# Permitext web policy consent and subscription copy — September 7, 2026

Status: **BOUNDED RECORDING/RETRY, STRIPE COPY AND HOSTED ACKNOWLEDGMENT PASSED; SIGN-IN DURABILITY FAILED**

Later September 7 evidence found that a real Google sign-in removed the stored
acceptance from the designated account. The immediate recording and duplicate
Checkout observations below remain valid within their original scope, but
enduring consent retention is open. See the [Production reproduction and source
cause](./PERMITEXT_SIGN_IN_POLICY_PERSISTENCE_2026-09-07.md).

## Scope and identity

The owner completed the verification code for the designated test account and
authorized the remaining closeout work. The account was independently matched
by its full account-ID SHA-256:
`d5f4fa47dccfdb4a6f5b2cd2b63b9f2a1bed0a9aba59dc1a365bde108373b645`.

The web client displayed release `5f1afb414fdd`, Free and Synced. No payment
details were entered and neither hosted Checkout's Subscribe button nor any
express-payment button was submitted. Both unpaid Checkouts were left using
Back to PERMITEXT. The designated account remains signed in.

## Live consent result

- Before export: `2026-09-07T17:42:29.757Z`; no policy acceptance, no entitlement.
- Live `/policies/current`: HTTP 200 at `2026-09-07T17:43:03.494Z`, configured.
- Upgrade was disabled with the consent checkbox unchecked and enabled when
  checked. Terms, Privacy and Subscription/Refund links pointed to the exact
  canonical HTTPS documents.
- Clicking Upgrade recorded consent before opening actual hosted Stripe Checkout.
- The independent after export at `2026-09-07T17:43:22.505Z` contained one
  server-dated acceptance at `2026-09-07T17:43:17.423Z`, platform `web`,
  client release `5f1afb414fdd`, schema version 1.
- Policy set: `4505c10e8f52e18c49a354f9`.

| Document | Exact recorded version | Recorded URL |
| --- | --- | --- |
| Terms | `terms-2026-08-28` | `https://permitext.com/terms` |
| Privacy | `privacy-2026-08-28` | `https://permitext.com/privacy` |
| Subscription and Refund Policy | `subscriptions-2026-08-28` | `https://permitext.com/refunds` |

The versions and documents exactly matched the live configuration. All 24
content/usage record groups were deeply unchanged; the separate session-metadata
group changed only a `last_seen_at` timestamp. Other account fields were unchanged
and entitlement remained null. A second unpaid Checkout at the same policy set
preserved the exact acceptance record, confirmed by export at
`2026-09-07T17:47:45.350Z`; content/usage and Free status were again unchanged.

The strict live policy-publication audit also passed at
`2026-09-07T17:48:56.981Z`: all three direct HTTPS 200 HTML responses matched their
approved artifact hashes. The policy documents and approved versions were not edited.

## Stripe description repair

The first Checkout exposed stale Product wording: “up to 100 Research turns per
billing month.” The deployed allowance and approved documents use UTC calendar
months. The existing live Permitext Pro Product description was corrected to:

> Permitext Pro includes Projects, Notebook, Report Draft, exports, tags, web offline access, and up to 100 completed-and-saved Research turns per UTC calendar month.

The provider recorded the Product update at `2026-09-07T17:46:40Z`. A full
dashboard reload showed the corrected description; a fresh real hosted Checkout
then displayed that exact sentence. The default price remained $20 USD/month,
the two historical prices remained archived, the existing tax category was
unchanged and no trial was added. Checkout still disclosed tax calculation after
address entry and recurring billing until cancellation.

## Acknowledgment label

The live acknowledgment still directed readers to “Settings,” while the actual
web control is Account. The local HTML now says “open Account and choose Manage
Subscription.” This changes a navigation label only. Price, allowance, renewal,
tax, cancellation and refund rules are unchanged.

The corrected page rendered in the in-app browser, and its original print button
opened Chrome's one-page PDF preview with the complete corrected cancellation
instruction and commercial disclosures. This was a local static fixture using
the original HTML, CSS and print script; it is not a new paid-purchase receipt.

- Corrected HTML SHA-256: `1404f6a5d1dc256836d65ca6b9930c66642d8c417668a6eff6d08cb9344540f3`.
- Existing public-surface and policy-acceptance contracts passed.
- Existing HTTP smoke suite passed.
- Publication and the retained hosted PDF passed in the following checkpoint.

## Publication and retained hosted PDF

[PR #63](https://github.com/randycodex/buildingcode/pull/63) merged at
`2026-09-07T17:54:58Z` after the exact-head Vercel preview and hosted acknowledgment
check passed. The preview was `dpl_B5JREWCdd8Jz9tFNockv3gsq2XnS`, source
`fbd43e7998a17c2e23fa7478a96d883c8aecbbe2`.

Production deployment `dpl_BJBGHbmKsFYJ5a5DGkoP2QJJ5ZA3` completed at
`2026-09-07T17:57:10.647Z`, serving merge commit
`4048aa28e65b67ff8eecd9dc95ab76f861f7d680` from
`permitext-sync-mcrb4bw7d-randycodexs-projects-b72fc111.vercel.app`.

The independent live receipt at `2026-09-07T17:57:57.236Z` verified:

- canonical `/release` and `/health` returned 200, the expected Production
  commit and healthy PostgreSQL storage;
- the entire `/policies/current` configuration was unchanged;
- canonical acknowledgment HTML returned 200 and exactly matched the corrected
  local hash above;
- the original print script returned 200 and matched local SHA-256
  `c240997fff62ee92ccadcb6784433f54c2e8d2d6b1026ca6d0f7ae559bb88905`.

An exact-deployment Vercel 5xx query for `17:57:10Z` through `18:00:00Z` completed
successfully with zero returned records. This is a bounded post-publication scan,
not a replacement for the remaining operations/alert acceptance.

Chrome opened the canonical live acknowledgment, displayed Account in its
cancellation instruction and used the page's Print or save as PDF button.
The actual PDF was saved outside the repository and independently reopened.
At `2026-09-07T18:00:02.167656Z`, it was one page, 126,722 bytes, SHA-256
`d0a6153fe9e8d5b32fb69d3f0f0afa006aaf556a9bc8e2db85a72b45a0b40894`.
Text checks confirmed price, no trial, UTC calendar month, Account/Manage
Subscription, the 72-hour window and the canonical page URL; PDF annotations
retained the correct canonical Terms, Privacy and Refund links. The rendered
page was inspected and was complete and legible. Text extraction required
Unicode normalization for the `fi` ligature in the footer URL.

This is a real retained copy of the current hosted acknowledgment. It does not
claim a new successful purchase. The only product-source difference from the
prior runtime is the one HTML navigation label; remaining changes merged with
the branch are acceptance documentation and test tooling. Main's existing
Xcode Cloud workflow started automatically; no new TestFlight installation or
App Store submission is claimed. Build 63 retains its original source/acceptance.

## Boundaries and retained evidence

Private exact-account exports and the redacted comparison receipt are retained
outside the repository under the existing September 6 live-test folder. Raw
account, customer, session and acceptance IDs are not included here.

This confirms immediate exact-version recording and same-policy retry. The
later sign-in loss qualifies that result: enduring consent retention remains
open until the repair passes a live returning sign-in. iOS consent, final shared-release selection and
the other B1–B5 gates remain separate. The acknowledgment is a retainable statement
of subscription terms, not an authenticated transaction receipt; this pass did
not exercise a new payment or a new successful-purchase redirect.

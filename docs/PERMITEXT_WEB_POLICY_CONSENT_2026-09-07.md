# Permitext web policy consent and subscription copy — September 7, 2026

Status: **LIVE WEB CONSENT AND STRIPE COPY PASSED; ACKNOWLEDGMENT LABEL REPAIRED LOCALLY**

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
- Publication and a retained hosted PDF remain to be recorded below.

## Boundaries and retained evidence

Private exact-account exports and the redacted comparison receipt are retained
outside the repository under the existing September 6 live-test folder. Raw
account, customer, session and acceptance IDs are not included here.

This closes current Production web consent, including durable exact-version
recording and same-policy retry. iOS consent, final shared-release selection and
the other B1–B5 gates remain separate. The acknowledgment is a retainable statement
of subscription terms, not an authenticated transaction receipt; this pass did
not exercise a new payment or a new successful-purchase redirect.

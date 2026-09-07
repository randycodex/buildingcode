# Provider privacy disclosure publication — September 7, 2026

Status: published to Production; Apple App Privacy responses also published and
retained after reload. This is not an app submission or public app release.

## Why this is in the App Store and web scope

The released native privacy manifest already declares Clerk device identifiers,
IP-derived approximate location, and authentication analytics. The public
policy still omitted that detail, and the September 3 provider proposal left
the wording as a draft. This revision closes that disclosure gap before the
Apple privacy questionnaire is completed. It also names the existing email
sign-in route. It adds no collection, SDK, price, benefit or tracking behavior.

The owner authorized recommended necessary work without repeated approval,
then resumed App Store and necessary web work with the phone unavailable.
This revision uses that standing authorization; it is not a new claim that the
owner personally reviewed these exact bytes. The earlier August 28 artifact
and its historical consent records remain valid evidence for their own version.

## Exact revision and evidence

- New privacy identifier: `privacy-2026-09-07`.
- SHA-256: `7b7b68b785edd8e339556cdaf2102b2119d0ee2784d0281cb38146114c5c5677`.
- Terms and subscription/refund identifiers and bytes remain unchanged.
- The existing policy-version guard requires the current version for a new
  purchase acceptance. No historical acceptance is backfilled, rewritten or
  interpreted as consent to this revision.
- Clerk's current [session activity documentation](https://clerk.com/docs/reference/backend/types/backend-session-activity)
  describes city/country resolved from IP and session device metadata.
- Clerk's current [analytics documentation](https://clerk.com/docs/guides/dashboard/analytics)
  describes account-based sign-up, sign-in, active-use and retention reporting.
- Its [application logs documentation](https://clerk.com/changelog/2026-05-06-application-logs)
  supports the existing device-linked log disclosure. No retention duration
  is invented; provider-managed logs/backups retain the existing caveat.
- These sources were rechecked September 7. The pinned native SDK/source
  evidence remains in the [provider proposal](./PERMITEXT_PRIVACY_PROVIDER_DISCLOSURE_PROPOSAL_2026-09-03.md).
- Apple's [App Privacy guidance](https://developer.apple.com/app-store/app-privacy-details/)
  includes third-party partners in collection disclosures. The matching Apple
  questionnaire was subsequently completed as recorded below.

## Validation and rollout

- `npm run test:privacy`, `npm run test:auth` and `npm run check`: passed.
- Hosted preview `dpl_AKzWAZe1fBTgXhQDCbmKgcupN4Nm`: READY. Authenticated
  Vercel retrieval returned HTTP 200 HTML; privacy and CSS bytes matched the
  candidate, and the retrieved page passed rendered inspection.
- [PR #66](https://github.com/randycodex/buildingcode/pull/66) merged at
  `2026-09-07T21:24:33Z`. Production source:
  `7b36fa180fbf6f26e6e2a516c10d2c58144d8943`; deployment
  `dpl_GsrdeGDbVxqxrKSyx1K73Te6SL6k`: READY.
- Production `PERMITEXT_PRIVACY_VERSION` is `privacy-2026-09-07`.
  `/policies/current` returned policy set `ce4159c4e89f8007121f7025` with
  unchanged Terms and subscription/refund versions.
- `npm run verify:production`: passed. Strict live policy audit at
  `2026-09-07T21:28:22.467Z`: publication ready, all three exact public policy
  hashes matched, direct HTTP 200 HTML responses.
- No paid Research, purchase, native code change or new physical acceptance.
  Phone checkout and native policy submission remain pending.

## Apple App Privacy receipt

App `6774385434` → Distribution → App Privacy was completed and published
September 7. A reload displayed the publisher receipt and all completed answers:

- 13 collected types, each linked to identity and used for App Functionality:
  Name, Email Address, Physical Address, Coarse Location, Photos or Videos,
  Other User Content, Search History, User ID, Device ID, Purchase History,
  Product Interaction, Performance Data and Other Diagnostic Data.
- Analytics only for User ID and Product Interaction.
- No use for tracking; no tracking section in the product-page preview.
- Privacy URL remains `https://permitext.com/privacy`.

The app remains 1.0 Prepare for Submission. No Add for Review action, build
selection, screenshot upload or release was performed.

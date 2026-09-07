# Provider privacy disclosure publication — September 7, 2026

Status: local candidate; publication and live version checks pending.

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
  includes third-party partners in collection disclosures. The questionnaire
  itself remains unsubmitted; this policy publication does not complete it.

## Validation and rollout

Local privacy and authentication/consent tests, rendered preview, exact public
policy bytes and active server version will be recorded here when completed.
The phone checkout and native policy-submission observation remain pending.

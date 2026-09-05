# Permitext App Store Review and Privacy Checklist

This is the working checklist for App Store version 1.0. It separates preparation from public declarations and submission actions.

September 3 live audit: see [current observed Apple state](../../../docs/PERMITEXT_APP_STORE_READONLY_AUDIT_2026-09-03.md). App Store submission and release are the owner's final steps and are not authorized. Older configuration notes below are not proof that Apple fields have been saved.

September 4 repair publication update: [Production and build 56 evidence](../../../docs/PERMITEXT_READINESS_REPAIRS_PUBLICATION_2026-09-04.md) supersedes the earlier build-52 upload status. Build 56 is available to Internal Testers and passed installation, launch, displayed build identity, and existing account/plan/sync/saved-section/Project-container continuity on the iPhone 17 Pro. This is bounded physical acceptance, not completion of the submission matrix. No App Store build selection or submission was performed.

## Configuration and previously recorded setup

Build/upload and app availability were rechecked September 3. Agreement, bank, tax, and subscription-price entries below retain earlier evidence and need a final live confirmation; do not treat this entire list as a new audit.

- Bundle ID: `com.randycodex.permitext`
- Version: `1.0`
- Latest verified uploaded/internal TestFlight build: `56` (September 4); no App Store build was selected during the repair publication
- App Store Connect/TestFlight build: confirm the exact live build before selecting the submission candidate
- Minimum iOS: `17.0`
- Device family: iPhone only
- Uses non-exempt encryption: no
- App availability: United States only
- Paid Apps Agreement: active
- U.S. tax form: active
- Bank account: active
- Permitext Pro Monthly price: $20.00 in the United States
- Public legal pages:
  - `https://permitext.com/privacy`
  - `https://permitext.com/terms`
  - `https://permitext.com/refunds`
  - `https://permitext.com/support`

## App Privacy questionnaire working answers

These answers are derived from the app privacy manifest and the published privacy policy. They must be checked against App Store Connect's current wording before being submitted.

September 3 source audit corrected Search History, Performance Data, and Other Diagnostic Data. The owner subsequently approved applying the provider disclosure proposal to the local release package: Device ID, Coarse Location, and Analytics purposes for User ID and Product Interaction are now also reflected in the manifest included in uploaded build 56. See the [source-to-declaration evidence](../../../docs/PERMITEXT_PRIVACY_DATA_FLOW_AUDIT_2026-09-03.md) and [approved local scope](../../../docs/PERMITEXT_PRIVACY_PROVIDER_DISCLOSURE_PROPOSAL_2026-09-03.md). Semantic aggregation of all privacy manifests physically present in the signed build-56 archive verified 13 collected categories, three required-reason API groups, and no tracking. This is not an Apple Organizer PDF or a provider-policy attestation, and the App Store questionnaire has not been published. The strict live audit also verified the exact previously approved policy artifacts; remaining provider-disclosure wording review and final client consent acceptance remain separate.

### Tracking

Provider disclosure classifications below are approved for local preparation and synchronized with the app-owned manifest. Do not submit this checklist as a completed questionnaire until the remaining publication and final-candidate checks pass.

- Data used to track the user: `No`
- Tracking domains: none
- Data sold or shared for third-party advertising: `No`

### Contact information

- Name: collected, linked to identity, App Functionality
- Email Address: collected, linked to identity, App Functionality
- Physical Address: collected only when a user enters a Project address, linked to identity, App Functionality
- Phone Number: not collected
- Other User Contact Info: not collected

### Identifiers

- User ID: collected, linked to identity, App Functionality and Analytics
  - account continuity/authentication plus Clerk's distinct-user activity and retention reporting
- Device ID: collected, linked to identity, App Functionality
  - Clerk's native device identifier and device-linked security/session logs; not an advertising-tracking declaration

### Purchases

- Purchase History: collected, linked to identity, App Functionality
- Payment Information: not collected by Permitext; Apple processes iOS payment credentials

### User content

- Photos or Videos: collected when a user attaches project content, linked to identity, App Functionality
- Other User Content: collected, linked to identity, App Functionality
  - saved sections, notes, tags, Projects, comments, Notebook and Report content
  - Research questions, selected evidence, answers, citations, history, and feedback
  - user-requested Research may send the question, recent conversation, selected or retrieved evidence,
    assigned Project facts, and selected official images to OpenAI; private notes are excluded and API
    response storage is disabled with `store: false`

### Usage data

- Product Interaction: collected, linked to identity, App Functionality and Analytics
  - recently viewed sections, reading continuity and sync state; Clerk sign-in, sign-up and active-use reporting
- Advertising Data: not collected
- Other Usage Data: not declared as collected

### Search history

- Search History: collected, linked to identity, App Functionality
  - in-app search queries are included in account continuity sync (`recentSearchesJSON`)
  - Apple's category includes searches performed inside the app, not only external searches

### Diagnostics

- Crash Data: not currently declared as collected by the app
- Performance Data: collected, linked to identity, App Functionality
  - Research duration is retained with the account's operation record for reliability and performance assessment
- Other Diagnostic Data: collected, linked to identity, App Functionality
  - Research failure codes, verification attempts, and provider request/retry counts are retained with the account's operation record for troubleshooting and safe operation
  - the operation record excludes question/answer text but remains linked through its database `user_id`; content-free is not anonymous
  - provider-managed IP addresses, request logs, and SDK behavior still require review; the linked declarations above are already required by Permitext's own stored records

### Location

- Precise Location: no device-location collection established by this audit; this is not a complete provider assessment.
- Coarse Location: collected, linked to identity, App Functionality
  - Clerk's account/session-associated IP-derived city/country data, not GPS collection; a Project's entered street address is separately covered under Physical Address

### Remaining draft categories not collected — subject to provider review

- Health and Fitness
- Financial Information other than subscription status/history
- Contacts
- Browsing History outside Permitext
- Sensitive Info

## App information declarations requiring final owner confirmation

- Content Rights: confirm Permitext has the necessary rights to display every included code source and related content. The repository still identifies at least one source as requiring republication-rights review, so this must not be represented as cleared until that review is complete.
- Age Rating: not yet configured. Answer the current questionnaire based on actual features and content; do not preselect a rating from older assumptions. Keep the platform rating distinct from the product's terms-of-use minimum age.
- Primary category: Reference
- Secondary category: Productivity
- App price: Free
- Release method: Manual release

## App Review access

Review-access plan (requires approval and verification before submission):

- Explain that reading and search work without an account.
- Provide a dedicated synthetic reviewer-access plan for account-based features. Do not assume that asking Apple to create an account replaces verified reviewer access. See Apple's [review guidelines](https://developer.apple.com/app-store/review/guidelines/), Before You Submit and 2.1.
- Verify the actual passwordless or identity-provider route without sharing the owner's credentials or introducing an authentication bypass. A demo mode is a separate product/security decision, not an automatic addition.
- Resolve the subscription/backend-feature mismatch in the current Production-targeted candidate: Sandbox purchases bind locally and do not grant Production backend Pro. The draft metadata now states this boundary. Corrected instructions alone do not establish reviewer access; verify the complete route before submission.
- The live sign-in-required checkbox is currently checked; it was not changed during the audit. Review notes and credentials are currently blank.
- Review contact name: Higinio Jimenez Manzano
- Review contact email: `permitext@gmail.com`
- Review contact phone: required from the owner before submission

## Version 1.0 items still required in App Store Connect

- Select the exact final version 1.0 build only after its upload and required physical-device acceptance; build 56 is uploaded and has bounded continuity evidence but has not been selected for App Store review
- Recapture and inspect final release-build iPhone screenshots before upload; the old build-33 Reader image contains a debug control
- Enter description, keywords, URLs, and copyright
- Add the app's free price schedule
- Set primary and secondary categories
- Complete Content Rights
- Complete Age Rating
- Complete App Privacy
- Create the subscription group localization
- Upload the subscription review screenshot
- Update subscription review notes/localization to match the current product
- Add Permitext Pro Monthly to the version 1.0 submission
- Enter App Review contact information
- Choose manual release
- Resolve any App Store Connect validation messages

## Prepared screenshot package

- Four historical portrait screenshots have the accepted iPhone 6.9-inch size: `1320 × 2868`; they are not the final approved upload set.
- The upload copies are JPEGs without alpha channels.
- The screenshots show the code library, native reader, search results, and a saved section.
- They were recaptured from the locally built version 1.0, Build 33 app at commit `45ec8be57e9734f9bf66dad8ab46abadf7cf5b31`.
- September 3 inspection found the ladybug debug control in `02-code-reader.jpg`; recapture rather than retouching the image. No personal account information was visible in the four inspected JPEGs.
- See `screenshots/README.md` for ordering and provenance.

## Server notification boundary

The production endpoint is `https://permitext.com/billing/apple/notifications` and accepts App Store server notification POST requests. A sandbox notification URL must not point at the current production deployment because production intentionally rejects sandbox transactions. Configure production notifications only after verifying the live secret/environment values, and use a separate sandbox-capable endpoint if sandbox server notifications are required.

## Completed StoreKit evidence

The [isolated Apple Sandbox lifecycle record](../../../docs/PERMITEXT_APPLE_APP_STORE_CONNECT_READINESS_EVIDENCE_2026-08-28.md) records the completed August 28–29 exercise on staging-targeted builds 44–48. It must not be represented as a production purchase or a build-56 purchase test.

- Purchase, signed ownership binding, relaunch continuity, Restore, and mismatched-account isolation
- Cancellation-period access retention and expiration back to Free
- Renewal, billing failure/recovery, refund form submission and refund revocation
- Apple-created delayed notification recovery and strict duplicate delivery

Not yet completed:

- Complete the remaining physical-device acceptance matrix for the exact submission build; build 56 installation and the documented continuity observations already passed
- Verify the actual reviewer subscription and backend-feature path on the final candidate; local Sandbox Pro and staging-verified Pro are distinct from Production backend entitlement
- Production purchase lifecycle after Apple approves the subscription and app

## Final submission boundary

Do not click Add for Review or Submit for Review until:

1. the screenshot and metadata package has been visually checked;
2. Content Rights and privacy declarations have owner approval;
3. the final build is selected and has passed the device smoke test;
4. the production deployment reports the intended Git commit;
5. Permitext Pro Monthly is attached to the same first-version submission; and
6. the owner explicitly approves the public submission.

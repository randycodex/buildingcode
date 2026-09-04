# Permitext App Store Review and Privacy Checklist

This is the working checklist for App Store version 1.0. It separates preparation from public declarations and submission actions.

September 3 live audit: see [current observed Apple state](../../../docs/PERMITEXT_APP_STORE_READONLY_AUDIT_2026-09-03.md). App Store submission and release are the owner's final steps and are not authorized. Older configuration notes below are not proof that Apple fields have been saved.

## Configuration and previously recorded setup

Build/upload and app availability were rechecked September 3. Agreement, bank, tax, and subscription-price entries below retain earlier evidence and need a final live confirmation; do not treat this entire list as a new audit.

- Bundle ID: `com.randycodex.permitext`
- Version: `1.0`
- Latest uploaded TestFlight build verified September 3: `52`; no App Store build is selected
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

September 3 source audit corrected three omissions: Search History, Performance Data, and Other Diagnostic Data. See the [source-to-declaration evidence](../../../docs/PERMITEXT_PRIVACY_DATA_FLOW_AUDIT_2026-09-03.md). These local corrections are not published App Store answers or a replacement TestFlight binary. Third-party SDK/provider collection and the final candidate privacy report still require reconciliation before owner approval.

### Tracking

Provider follow-up: the [owner-review proposal](../../../docs/PERMITEXT_PRIVACY_PROVIDER_DISCLOSURE_PROPOSAL_2026-09-03.md) now recommends Device ID and Coarse Location disclosures plus Analytics purposes for User ID and Product Interaction. The provider rows below remain unresolved for publication pending that review and synchronized manifest/policy preparation. Do not submit the current checklist as a completed questionnaire.

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

- User ID: collected, linked to identity, App Functionality
- Device ID: unresolved provider declaration; do not submit a `No` answer yet. The pinned Clerk iOS SDK sends `identifierForVendor` as `x-native-device-id`; confirm retention, linkage, and purpose before completing the questionnaire.

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

- Product Interaction: collected, linked to identity, App Functionality
  - recently viewed sections, reading continuity, and sync state
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

### Location — provider review required

- Precise Location: no device-location collection established by this audit; this is not a complete provider assessment.
- Coarse Location: unresolved provider declaration; do not submit a blanket `No` for Location. Clerk's session activity model and current provider documentation include IP-derived city/country data. Confirm the production service's collection and purposes; a Project's entered street address is separately covered under Physical Address.

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
- The live sign-in-required checkbox is currently checked; it was not changed during the audit. Review notes and credentials are currently blank.
- Review contact name: Higinio Jimenez Manzano
- Review contact email: `permitext@gmail.com`
- Review contact phone: required from the owner before submission

## Version 1.0 items still required in App Store Connect

- Select the exact final version 1.0 build only after its upload and physical-device acceptance; build 52 is uploaded but not selected for App Store review
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

- TestFlight sandbox purchase granted Pro to the signed-in Permitext account
- Pro persisted after relaunch
- Restore Subscription restored the entitlement
- An Apple purchase did not leak to a different Permitext account
- An accelerated sandbox renewal was observed through continuing Pro access

Not yet completed:

- Observe accelerated sandbox expiration and verify the account returns to Free without deleting user work
- Final physical-device smoke test of the exact submission build
- Production purchase lifecycle after Apple approves the subscription and app

## Final submission boundary

Do not click Add for Review or Submit for Review until:

1. the screenshot and metadata package has been visually checked;
2. Content Rights and privacy declarations have owner approval;
3. the final build is selected and has passed the device smoke test;
4. the production deployment reports the intended Git commit;
5. Permitext Pro Monthly is attached to the same first-version submission; and
6. the owner explicitly approves the public submission.

# Permitext App Store Review and Privacy Checklist

This is the working checklist for App Store version 1.0. It separates preparation from public declarations and submission actions.

## Confirmed current configuration

- Bundle ID: `com.randycodex.permitext`
- Version: `1.0`
- Current local build: `40`
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

### Tracking

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
- Device ID: not declared as collected

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
  - searches, recents, reading continuity, and sync state
- Advertising Data: not collected
- Other Usage Data: not declared as collected

### Diagnostics

- Crash Data: not currently declared as collected by the app
- Performance Data: not currently declared as collected by the app
- Other Diagnostic Data: limited operational logs may be processed by the service; verify App Store Connect's definition before answering

### Sensitive categories not collected

- Health and Fitness
- Financial Information other than subscription status/history
- Location
- Contacts
- Browsing History outside Permitext
- Search History outside Permitext
- Sensitive Info

## App information declarations requiring final owner confirmation

- Content Rights: confirm Permitext has the necessary rights to display every included code source and related content. The repository still identifies at least one source as requiring republication-rights review, so this must not be represented as cleared until that review is complete.
- Age Rating: expected `4+` if all objectionable-content frequency questions are None and the app has no unrestricted web access, gambling, contests, advertising, or public user-generated content. Recheck each live questionnaire item before saving.
- Primary category: Reference
- Secondary category: Productivity
- App price: Free
- Release method: Manual release

## App Review access

Recommended configuration:

- Do not mark the app as requiring sign-in for review.
- Explain that reading and search work without an account.
- Explain that reviewers may create their own account using Apple, Google, Microsoft, or passwordless email to inspect sync and the subscription.
- Do not invent or publish a reusable password because Permitext's email login is passwordless.
- Review contact name: Higinio Jimenez Manzano
- Review contact email: `permitext@gmail.com`
- Review contact phone: required from the owner before submission

## Version 1.0 items still required in App Store Connect

- Select the exact final version 1.0 build only after its upload and physical-device smoke test; the current local build is 40
- Upload the prepared iPhone 6.9-inch screenshots from `screenshots/iphone-6.9/submission/`
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

- Four portrait screenshots are ready at Apple's accepted iPhone 6.9-inch size: `1320 × 2868`.
- The upload copies are JPEGs without alpha channels.
- The screenshots show the code library, native reader, search results, and a saved section.
- They were recaptured from the locally built version 1.0, Build 33 app at commit `45ec8be57e9734f9bf66dad8ab46abadf7cf5b31`.
- No screenshot contains an email address, account identifier, test diagnostic, or sandbox purchase state.
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

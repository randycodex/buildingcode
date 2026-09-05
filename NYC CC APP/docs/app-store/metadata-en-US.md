# Permitext App Store Metadata — English (U.S.)

Prepared for App Store version 1.0. The values in this file are drafts until they are entered and saved in App Store Connect.

September 3 preparation update: **do not submit or release**. The owner wants App Store submission and public release last. The reviewer-access section remains incomplete until a dedicated, independently verified access method is approved; do not paste an incomplete draft into Apple review fields.

## Listing

- Name: `permitext`
- Subtitle: `NYC Codes, Search & Projects`
- Primary category: `Reference`
- Secondary category: `Productivity`
- App price: `Free`
- Availability: `United States only`
- Copyright: `2026 Higinio Jimenez Manzano`
- Support URL: `https://permitext.com/support`
- Marketing URL: `https://permitext.com`
- Privacy Policy URL: `https://permitext.com/privacy`

## Promotional text

Read and search New York City codes free. Save sections, add notes, organize project references, and upgrade to Pro for an expanded professional workspace.

## Keywords

NYC,building code,construction code,zoning,code search,projects,notes,bookmarks,reference

## Description

Permitext is a professional workspace for reading, searching, and organizing New York City code references.

READ AND SEARCH FREE

Browse supported New York City code libraries, search across code text, return to recent sections, and keep your reading continuity. Code reading and search remain free.

SAVE THE SECTIONS THAT MATTER

Save sections, add notes, and organize references around your Projects. Sign in with Apple, Google, Microsoft, or passwordless email to keep account-owned work separate and sync supported data across devices.

UPGRADE TO PERMITEXT PRO

Permitext Pro includes unlimited saved sections and notes, Projects, Notebook, Report, professional exports, offline access, and 100 Research turns per UTC calendar month. Research answers use identified evidence and citations. A turn is counted only when an answer is completed and saved; failed or interrupted requests do not use an included turn.

Pro is $20.00 per month. There is no trial. Payment is charged to your Apple Account when the purchase is confirmed. The subscription renews monthly unless canceled at least 24 hours before the end of the current billing period. You can manage or cancel the subscription in your Apple Account settings. Code reading and search remain free after cancellation.

IMPORTANT SOURCE BOUNDARY

Permitext is an independent product and is not affiliated with or endorsed by the City of New York or any government agency. Permitext provides code-research tools, not an official agency interpretation or legal advice. Always verify consequential decisions against the identified official source and current requirements.

Terms of Service: https://permitext.com/terms

Privacy Policy: https://permitext.com/privacy

Subscription and Refund Policy: https://permitext.com/refunds

## App Review notes

Reading and search can be reviewed without an account:

1. Launch the app.
2. Use the library or search tabs to read and search code text.
3. Open the account control from Saved (accessibility label: Open Account) and inspect the Plan section.

Account-based workspace, sync, and Pro features also require review. A dedicated synthetic reviewer identity and independently tested access instructions must be supplied before submission. The app supports Apple, Google, Microsoft, and passwordless email through its sign-in UI. Do not substitute an instruction to create an account for the verified access plan, disclose the owner's credentials, or add a hidden authentication/entitlement bypass.

Internal preparation only: reviewer identity/access method and Pro access are **not yet provisioned or verified**. Resolve these with owner approval, then replace this preparation note with complete review instructions. Reviewers must be able to inspect the enabled features without needing a live response from the owner to obtain each verification code.

Subscription review flow to verify before submission:

1. Open the account control and the Plan section.
2. Sign in through the approved reviewer-access route.
3. Open the Pro upgrade flow.
4. Select Permitext Pro Monthly and confirm with the App Store test account supplied by Apple.

The iOS app uses StoreKit. Production transactions require Permitext backend verification and account binding. On the current Production-targeted build, Sandbox transactions bind to the signed-in account on the device; they do not create a Production backend Pro entitlement. A local Pro display therefore does not demonstrate access to backend Pro features. Sandbox backend verification is enabled only for the separately configured isolated staging host.

**Internal submission blocker:** verify the reviewer subscription and backend-feature path on the actual final candidate, and replace this preparation text with the observed, complete access instructions. Do not describe a Sandbox purchase as activating Production backend Pro, weaken the transaction-environment guard, or silently provision reviewer access. The completed staging Sandbox lifecycle does not establish this final-candidate path.

Restore Subscription is available on the upgrade screen. Delete Account is available in the Account section and requires confirmation. Confirm these instructions on the final candidate before copying them to App Store Connect.

Permitext Pro Monthly:

- Product ID: `com.randycodex.permitext.pro.monthly`
- Price: `$20.00/month` in the United States
- Trial: none
- Auto-renewal: monthly until canceled

Support: `permitext@gmail.com`

## Subscription group localization

- Subscription group display name: `Permitext Pro`
- App Name Display Options: `Use App Name`

## Subscription localization

- Display name: `Permitext Pro Monthly`
- Description: `Pro workspace and up to 100 Research turns`

## Release control

Use manual release for version 1.0 so approval does not publish the app before the final production and device checks are complete.

The September 3 read-only audit found automatic release currently selected. This recommendation has not been applied. Do not use Add for Review, Submit for Review, or release controls without later explicit owner approval.

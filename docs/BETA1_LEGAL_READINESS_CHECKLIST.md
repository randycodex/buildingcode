# Permitext Beta 1 legal readiness checklist

This is a product-specific working checklist, not legal approval or a substitute for advice from a licensed US attorney. Do not publish placeholder answers. The final customer-facing documents must match the production product, billing configuration, and actual business practices.

## Documents required before public paid access

- **Terms of Service / Terms of Use.** Identify the contracting business, eligibility, account rules, permitted and prohibited use, subscription terms, intellectual-property ownership, user-content license, termination, warranty disclaimers, limits of liability, indemnity, dispute terms, governing law, and how terms may change.
- **Subscription and cancellation disclosure.** State the price and billing interval, whether a trial exists, when recurring charges begin, automatic renewal, how to cancel on the web and through Apple, when access ends, and how price changes are communicated.
- **Refund policy.** Explain Permitext's web-purchase refund policy and distinguish it from App Store purchases, which Apple administers. The policy and support copy must match the implemented entitlement behavior for full and partial refunds.
- **Acceptable Use Policy.** Prohibit unlawful use, abusive automation, credential sharing, attacks on the service, attempts to bypass usage or cost limits, infringement, and use of generated material as an official agency determination.
- **Professional-use and AI notice.** Make clear that Permitext is an unofficial research aid; enacted text and official agency materials remain authoritative; generated output may be incomplete or wrong; and licensed professionals retain responsibility for project-specific conclusions, filings, and safety decisions.
- **Privacy Policy update.** Name Clerk, Stripe, Apple, the hosting/database providers, and AI/model providers actually used in production; describe the data each receives, retention/deletion behavior, account-linking behavior, security contact, and the US-only service boundary.

## Facts needed from the owner

- Legal business name and entity type.
- Business mailing address and a customer/legal-notice email address.
- State whose law should govern and preferred dispute process; counsel must confirm these provisions.
- Minimum user age and whether the product will prohibit use by minors.
- Final Free and Pro prices, billing intervals, trial decision, and web refund policy.
- Customer support response target and cancellation/refund escalation process.
- The production vendor list and any provider-specific retention settings.
- Whether customers may upload confidential, regulated, or personally identifying project material; if not, the product rules must say so.

## Confirmed Beta 1 commercial decisions

- Contracting owner supplied for the working draft: Higinio Jimenez. Confirm the exact legal name before publication because the current Privacy Policy uses a longer name.
- Support, legal-notice, and urgent-alert email: `permitext@gmail.com`.
- Higinio Jimenez owns urgent support responses.
- Distribution and marketing: United States only.
- Free access: code reading and code search remain available.
- Pro: $20 per month, no trial, no annual plan, and 100 Research turns per billing month.
- The business mailing address, entity type, governing-law choice, minimum age, and confidential-data policy remain open and must not be replaced with placeholders in public documents.

## Recommended working refund policy

- Customers may cancel at any time; cancellation stops renewal and Pro remains active through the already-paid period.
- Stripe web purchases receive a full refund when requested within seven calendar days of the initial charge.
- An accidental Stripe renewal receives a full refund when requested within 72 hours and no more than five Research turns have been used since renewal.
- Duplicate charges, verified unauthorized charges, and Permitext billing errors receive a full refund.
- Outside those cases, charges are non-refundable and are not prorated, except where law requires otherwise or Permitext grants a remedy for a material service failure.
- Refunds return to the original payment method. A full Stripe refund ends the related Pro entitlement when the verified provider event is processed; a partial refund does not automatically revoke it.
- Apple controls App Store purchase and refund decisions. Users request those refunds through Apple, and Permitext follows Apple's verified refund or revocation event.

This is a product-policy recommendation for attorney review, not a published promise yet. It gives customers a short, clear remedy while limiting the risk that a customer consumes substantial Research cost and then seeks a full refund.

## Attorney review scope

Ask counsel to review the documents together with the live signup, upgrade, checkout, cancellation, account-deletion, and Research-result screens. The review should confirm that the written promises match the software, the limitation and professional-use language fits a building-code research product, recurring-payment disclosures are presented before purchase, and US federal and applicable state requirements are addressed.

Counsel review matters because a generic SaaS template cannot decide Permitext's actual contracting party, state-law choices, professional-liability allocation, refund promises, or whether the UI presents recurring-payment terms conspicuously enough. A working draft is useful input; calling it legally approved without that review would be inaccurate.

## Release gate

Before opening paid Beta 1 to the public:

1. Counsel-approved Terms, Privacy Policy, refund/subscription disclosure, and Acceptable Use Policy have stable public URLs.
2. Web signup and checkout require or clearly record acceptance of the current Terms and Privacy Policy versions.
3. iOS App Store metadata and in-app subscription copy use the same price, duration, renewal, cancellation, and professional-use language.
4. Support can retrieve the accepted policy version and billing provider for an account without exposing sensitive credentials.
5. A test account has completed signup, purchase, cancellation, refund, data export where offered, and account deletion against the production configuration.

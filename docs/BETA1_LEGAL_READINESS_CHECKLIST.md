# Permitext Beta 1 legal readiness checklist

This is an owner self-review checklist, not legal advice, a legal opinion, or a guarantee that every federal, state, or local requirement has been identified. The owner has elected not to retain an attorney for Beta 1. Customer-facing documents must still match the production product, billing configuration, and actual operating practices.

Owner review record: [PERMITEXT_BETA1_OWNER_LEGAL_SELF_REVIEW.md](./PERMITEXT_BETA1_OWNER_LEGAL_SELF_REVIEW.md)

Tax and optional professional reference: [PERMITEXT_BETA1_PROFESSIONAL_REVIEW_PACKET.md](./PERMITEXT_BETA1_PROFESSIONAL_REVIEW_PACKET.md)

Separate Apple transaction boundary: [BETA1_APPLE_TAX_HANDLING_RECORD.md](./BETA1_APPLE_TAX_HANDLING_RECORD.md)

## Confirmed owner decisions

- Operator: Higinio Jimenez Manzano as a sole proprietor, not an LLC or corporation.
- Income treatment: report Permitext business income and expenses through the owner's personal tax filing using the applicable sole-proprietor forms. This does not replace sales-tax registration, collection, filing, or remittance duties.
- Support, dispute-notice, and legal-notice email: `permitext@gmail.com`.
- Distribution and marketing: United States only.
- Minimum age: 18.
- Free access: code reading and code search remain available.
- Pro: $20 per month, no trial, no annual plan, and 100 Research turns per UTC calendar month.
- Additional Research turn packs: disabled and unpublished.
- Cancellation: customers may cancel at any time; renewal stops and access normally continues through the paid period.
- Web refunds: a full refund of an initial or renewal Stripe charge requested within 72 hours, regardless of Search or Research usage, plus remedies required by law or for a verified duplicate, unauthorized, or Permitext-error charge.
- Apple refunds: controlled by Apple; Permitext follows verified refund or revocation events.
- Governing law: New York, subject to nonwaivable law.
- Disputes: 30-day good-faith informal notice, followed by a court with jurisdiction; eligible small-claims and urgent relief remain available. No mandatory arbitration or class-action waiver.
- Beta 1 is not approved for confidential, regulated, or sensitive personal information. Users must redact that material before submission; ordinary property/project information may be submitted when needed for a requested feature.
- The private residential address is retained only in provider, tax, and legal records where required and is not placed on customer pages.

## Owner-reviewed customer documents

- [x] On August 28, 2026, the owner gave final approval to `terms-2026-08-28`, `privacy-2026-08-28`, and `subscriptions-2026-08-28`; exact approved-file hashes are recorded in the owner review. These versions remain dormant until stable URLs and Production configuration are separately authorized.
- [x] On August 28, 2026, the owner explicitly accepted all residual Beta risks listed below, including self-review gaps, sole-proprietor personal exposure, possible nonenforcement of liability limits, and potential customer, platform, provider, or regulatory costs and required changes.

- [x] Terms identify the individual operator, age and territory limits, account duties, acceptable use, professional and AI boundaries, paid terms, cancellation, refund reference, content license, suspension, disclaimers, liability limitation, governing law, dispute path, and change notice.
- [x] Subscription/refund policy distinguishes Stripe and Apple, states price, monthly renewal, no trial, cancellation paths, end of access, the 72-hour web rule, and duplicate-billing handling.
- [x] Privacy Policy names current providers, describes Research data sent to OpenAI, records the `store: false` behavior and current provider retention boundary, explains deletion, and identifies the first-Research affirmative disclosure.
- [x] Purchase screens show the product, price, billing frequency, automatic renewal, no trial, included Research turns, cancellation deadline/mechanism, policy links, and a separate affirmative consent control. The web screen additionally says `$20/month plus applicable taxes shown by Stripe.` Apple tax handling remains separate.
- [x] Web Checkout requires current recorded policy acceptance, and the iOS purchase path records the exact versions before StoreKit purchase.
- [x] Web Checkout returns to a retainable Permitext subscription acknowledgment containing the recurring terms, cancellation route, refund rule, and policy links.
- [x] Additional-turn promises were removed from present-tense customer documents while those sales remain disabled.

## Tax boundary

Permitext's owner may report net business profit on a personal return as a sole proprietor. That is separate from transactional sales tax. New York's current guidance says remotely accessed prewritten software sold to a New York purchaser is subject to state and local sales tax, and its registration page directs sellers of taxable property or services to register before beginning business.

The conservative no-professional launch path is therefore:

1. Treat New York web subscriptions as taxable unless the New York Tax Department provides a different written answer for Permitext.
2. Obtain the New York Certificate of Authority before the first taxable New York web subscription. The registration is issued, but the actual certificate still must be received, saved, and printed/displayed.
3. Configure Stripe's product tax code, customer-location collection, registrations, and inclusive/exclusive presentation only after the registration facts are known.
4. Keep Apple tax reporting separate because Apple controls the App Store transaction and remittance behavior; Stripe automatic tax is web-only.
5. Monitor other states' nexus thresholds and digital-product rules as sales grow.
6. Maintain records of gross receipts, Stripe and Apple fees, refunds, collected tax, provider expenses, and model/infrastructure costs for income and sales-tax filings.

Tax configuration is not activated by this checklist. Paying personal income or self-employment tax later does not cure a missed sales-tax registration, collection, or filing duty.

## Remaining release gates

The final owner review and version record are complete. Before opening public paid Beta 1:

1. Stable public URLs serve the exact approved files, and web/iOS purchase screens match them.
2. The exact policy version variables are configured only after step 1.
3. The actual New York Certificate of Authority is received, saved, and printed/displayed and the Stripe tax configuration decision is recorded before the first taxable New York web sale. Business Express shows the registration as issued on August 28, 2026, but the portal currently returns the DTF-17 application instead of the certificate and the assigned filing frequency remains open.
4. Apple App Store metadata and the in-app subscription screen use the same price, duration, renewal, cancellation, and professional-use language.
5. A no-charge local verification and the separately authorized production lifecycle confirm signup, purchase acknowledgment, entitlement, cancellation, refund, account export, and account deletion.

## Residual risks requiring owner acceptance

- A self-review cannot confirm that every state-specific consumer rule is covered or that every waiver, disclaimer, liability limitation, or dispute term will be enforced.
- Operating as a sole proprietor does not create a separate liability shield between Permitext obligations and the owner's personal assets.
- Building-code research can cause professional, financial, or safety losses if customers ignore the product boundary or if a court rejects a limitation.
- A regulator, platform, payment provider, or customer may still require changes, refunds, penalties, or defense costs even when the owner acted in good faith.
- Material product, price, provider, territory, data-use, or billing changes require a new review and may require renewed customer consent.

The absence of an attorney is an owner-accepted business risk, not evidence that no law applies and not a reason to label these documents "legally approved."

Owner acceptance recorded: August 28, 2026. This acceptance does not remove any remaining release gate or authorize deployment, billing activation, paid testing, or public release.

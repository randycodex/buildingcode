# Permitext Beta 1 — Tax Registration and Optional Professional Review Packet

Prepared: August 28, 2026

This packet organizes facts, open decisions, and implementation evidence for the owner and for any tax or legal professional the owner may later choose to consult. It is not tax or legal advice and does not authorize a public paid launch. The owner has elected not to retain an attorney for Beta 1; attorney review is optional, not a release gate.

## Outcome needed before public billing

Permitext needs a written owner record answering two separate questions:

1. **Tax:** how the web and App Store offerings are classified, where registration and collection are required, what customer-location evidence must be collected, and how tax should be presented and reconciled. In the absence of professional advice, the conservative working assumption is that New York web access is taxable remotely accessed prewritten software and registration precedes the first taxable New York web sale.
2. **Owner legal self-review:** whether the Terms, Privacy Policy, subscription/refund disclosure, Acceptable Use rules, and professional-use/AI notice match the product, the operator, and the official-source requirements identified in [PERMITEXT_BETA1_OWNER_LEGAL_SELF_REVIEW.md](./PERMITEXT_BETA1_OWNER_LEGAL_SELF_REVIEW.md).

Do not enable Stripe automatic tax, change product tax categories, activate a policy version, or mark the policies legally approved merely because this packet exists.

## Product and operator snapshot

| Topic | Current Beta 1 fact |
| --- | --- |
| Operator | Higinio Jimenez Manzano, sole proprietor; not an LLC or corporation |
| Customer territory | United States only |
| Free offering | Code reading and search |
| Paid offering | Permitext Pro at $20 per month; no trial and no annual plan |
| Research allowance | 100 completed and durably saved Research turns per UTC calendar month |
| Web billing | Stripe recurring subscription |
| iOS billing | Apple auto-renewable subscription |
| Additional-turn sales | Disabled and unpublished |
| Working web refund rule | Full refund for a Stripe charge requested within 72 hours, subject to the exceptions and provider distinctions in the working policy |
| Minimum age | 18 |
| Beta data restriction | Users must not submit confidential, regulated, or personally identifying material and must redact it before submission |
| Governing law and disputes | New York subject to nonwaivable law; 30-day informal notice followed by a court with jurisdiction; no mandatory arbitration or class waiver |
| Support and legal-notice address | `permitext@gmail.com` |
| Private operator address | Retained only for provider, tax, and legal records where required; not intended for customer-facing publication |

## Tax questions for owner resolution or optional professional confirmation

### 1. New York product classification

New York's current [Computer Software tax bulletin](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/computer_software.htm) says that remotely accessed prewritten software can be taxable. Confirm in writing:

- whether Permitext Pro is taxable prewritten software, a taxable bundled product, an exempt service, or a mixed offering;
- whether the AI-assisted Research component changes the classification or requires a reasonable, separately stated allocation;
- which purchaser location controls the New York local rate for individual and multi-user accounts; and
- whether Free access, refunds, promotional access, lifetime grants, or future one-time Research turns change the treatment.

Do not treat the existing 5% economics reserve as a tax rate or tax determination.

### 2. New York registration and launch timing

The New York Department of Taxation and Finance directs sellers of taxable property or services to [register as a sales-tax vendor](https://www.tax.ny.gov/bus/st/register.htm) and says a Certificate of Authority may be required before taxable sales begin. Confirm:

- whether the operator must obtain a Certificate of Authority before the first New York web subscription;
- the correct legal name, business activity, address, filing frequency, and effective date;
- whether a DBA, entity formation, or separate business account should precede registration; and
- what records must be retained for taxable, exempt, refunded, and Apple-administered transactions.

### 3. Other US jurisdictions

Permitext is planned for US-wide availability, but no state-by-state economic-nexus or digital-product determination has been approved. Identify:

- the jurisdictions in which the operator already has physical or other non-sales nexus;
- the thresholds and measurement periods that must be monitored before registration elsewhere;
- whether a small closed Beta should be limited to specific states until that review is complete; and
- who will own registrations, returns, notices, exemption documentation, and periodic threshold review.

### 4. Stripe implementation

Stripe explains that automatic tax depends on the selected [product tax code and tax behavior](https://docs.stripe.com/tax/products-prices-tax-codes-tax-behavior), and that Checkout needs customer-location information to [calculate tax](https://docs.stripe.com/payments/checkout/taxes). Confirm:

- the correct Stripe product tax code for Pro and any future Research-turn product;
- whether the $20 web price should be tax-exclusive or tax-inclusive;
- which billing-address fields Checkout must collect and whether existing customer addresses may be reused or updated;
- which registrations must be active before `automatic_tax[enabled]=true` is set;
- how refunds, credits, canceled subscriptions, failed invoices, and bad debt affect returns; and
- whether Stripe Tax is appropriate or a different filing/collection process is required.

### 5. Apple implementation and reporting

Apple's current subscription material describes App Store Connect tax categories and states that default App Store pricing generally includes taxes Apple collects and remits in applicable territories. Review the [Apple subscription tax overview](https://developer.apple.com/app-store/subscriptions/) and [App Store Connect subscription setup](https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions/) and confirm:

- the correct app and in-app purchase tax categories;
- which US taxes Apple collects and remits as merchant or marketplace operator and which remain the developer's responsibility;
- the gross receipts, commissions, taxes, refunds, and proceeds the operator must record; and
- how Apple proceeds should be reconciled with Permitext entitlement and refund events.

### 6. Income, bookkeeping, and owner obligations

Confirm the recommended chart of accounts and treatment for Stripe gross receipts, Apple proceeds, commissions, refunds, Vercel costs, model costs, professional fees, and customer-support labor. Also identify estimated-tax, information-return, business-registration, and record-retention obligations applicable to the individual operator.

## Optional counsel questions — not a Beta 1 release gate

If counsel is retained later, counsel should review the policies together with the actual signup, upgrade, checkout, post-purchase acknowledgment, cancellation, restore, Research-result, support, export, and account-deletion flows.

1. Is the individual operator correctly identified, and what nonpublic address or registered contact must appear in notices or records?
2. Are United States-only access, age 18+, account security, suspension, and prohibited-data rules enforceable and presented at the right time?
3. Are price, renewal, trial, cancellation, refund, and end-of-access terms conspicuous enough on web and iOS?
4. Does the 72-hour web refund promise match the intended entitlement behavior and applicable nonwaivable rights?
5. Is the professional-use/AI boundary appropriate for a building-code research product, including the limitation of liability and responsibility for source and project-fact verification?
6. Are the content license, intellectual-property provisions, source-publication practices, and restrictions on confidential or regulated material adequate?
7. Are the named providers, Research data flow, retention periods, account linking, purchase-ownership retention, deletion boundary, and official-web search redaction described accurately?
8. Are the selected New York governing-law, informal-notice, court-jurisdiction, warranty, liability-cap, and change-notice provisions enforceable and appropriately scoped?
9. Which events require renewed affirmative acceptance rather than notice alone?
10. Are separate Acceptable Use and professional-use documents needed, or may the current provisions remain inside the Terms?

Apple's [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) should be checked alongside legal requirements because the iOS subscription must also satisfy Apple's current disclosure and ongoing-value rules.

## Files supplied for review

- Working Terms: [`permitext-sync-server/public/terms.html`](../permitext-sync-server/public/terms.html)
- Working Privacy Policy: [`permitext-sync-server/public/privacy.html`](../permitext-sync-server/public/privacy.html)
- Working subscription/refund policy: [`permitext-sync-server/public/refunds.html`](../permitext-sync-server/public/refunds.html)
- Legal readiness checklist: [`BETA1_LEGAL_READINESS_CHECKLIST.md`](./BETA1_LEGAL_READINESS_CHECKLIST.md)
- Owner legal self-review: [`PERMITEXT_BETA1_OWNER_LEGAL_SELF_REVIEW.md`](./PERMITEXT_BETA1_OWNER_LEGAL_SELF_REVIEW.md)
- Commercial configuration: [`BETA1_COMMERCIAL_CONFIGURATION.md`](./BETA1_COMMERCIAL_CONFIGURATION.md)
- Subscriber economics: [`PERMITEXT_RESEARCH_SUBSCRIBER_ECONOMICS_V6.md`](./PERMITEXT_RESEARCH_SUBSCRIBER_ECONOMICS_V6.md)
- Billing and identity runbook: [`BETA1_BILLING_IDENTITY_RUNBOOK.md`](./BETA1_BILLING_IDENTITY_RUNBOOK.md)

Any later professional should also receive screenshots or a supervised walkthrough of the current web and iOS flows. Source text alone cannot establish whether disclosures are conspicuous at the moment of signup or purchase.

## Optional professional decision record

For each answer, record:

- professional name, credential, jurisdiction, and contact information;
- engagement date and written response date;
- facts and product version reviewed;
- decision, assumptions, and jurisdictions covered;
- required product, policy, provider, registration, or accounting changes;
- owner responsible for each change and its due date; and
- whether the response is final, conditional, or requires another specialist.

## Prepared technical control: policy-version acceptance

The local server now has a dormant acceptance contract prepared for owner-approved current policies:

- `GET /policies/current` returns only the configured current Terms, Privacy, and subscription/refund versions and stable URLs.
- `POST /account/policy-acceptance` requires an authenticated account and exact current versions; stale versions fail closed.
- The server supplies the acceptance time, policy-set identifier, client platform, document URLs, and client release.
- Repeating the same acceptance is idempotent.
- Acceptance history remains attached to the account through identity merges, appears in the administrator account export, and is removed with the Permitext account.

The control remains inactive until all three approved version variables are deliberately configured:

- `PERMITEXT_TERMS_VERSION`
- `PERMITEXT_PRIVACY_VERSION`
- `PERMITEXT_SUBSCRIPTION_POLICY_VERSION`

Do not configure those variables merely to make readiness pass. The owner's final line-by-line approval, stable public URLs, matching client presentation, and exact version record remain release gates.

## Current hold points

- No tax behavior or product tax category has been changed.
- No customer document has been labeled attorney-reviewed or legally approved.
- No approved policy version has been activated.
- No Production deployment or paid billing exercise is authorized by this packet.
- Additional Research-turn sales remain disabled and unpublished.

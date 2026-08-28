# Permitext Beta 1 — Owner Legal Self-Review

Reviewed: August 28, 2026

Owner: Higinio Jimenez Manzano

## Status and boundary

The owner has decided not to retain an attorney for Beta 1 and directed Permitext to make the strongest practical self-review using current official sources and the actual product implementation. This record is not legal advice, attorney approval, or a guarantee of compliance. It documents what was checked, what was changed, what remains blocked, and what risk the owner would accept before launch.

Tax is treated separately. The owner may operate as a sole proprietor and report net business income on a personal return, but that does not replace sales-tax registration, collection, filing, or remittance.

## Product facts reviewed

| Topic | Reviewed Beta 1 fact |
| --- | --- |
| Operator | Higinio Jimenez Manzano, sole proprietor; no separate LLC or corporation |
| Territory and age | United States only; 18+ |
| Free offering | Code reading and search |
| Paid offering | Permitext Pro, $20 monthly, no trial, no annual plan |
| Research allowance | 100 completed and saved turns per UTC calendar month |
| Additional turns | Disabled and unpublished |
| Web billing | Stripe subscription |
| iOS billing | Apple auto-renewable subscription |
| Web refund promise | Full refund requested within 72 hours of the initial or renewal charge, regardless of usage, subject to the complete policy |
| Data restriction | No confidential, regulated, or sensitive personal information during Beta 1; ordinary property/project information is permitted when needed for a requested feature |
| Support and notices | `permitext@gmail.com` |

## Requirement-to-evidence review

| Area | Evidence and result | Status |
| --- | --- | --- |
| Online recurring-payment disclosure | Web and iOS show product, $20/month, monthly renewal, no trial, 100 Research turns, and the cancellation deadline/mechanism beside the purchase action. | Prepared locally |
| Affirmative consent | A separate checkbox/toggle links the exact Terms, Privacy, and subscription/refund versions; the backend records exact versions and web Checkout rejects missing or stale acceptance. | Prepared locally; activation open |
| Simple cancellation | Stripe subscribers open Manage Subscription from web Settings; Apple subscribers use Apple subscription settings. Account deletion does not falsely promise to cancel Apple. | Implemented; production exercise open |
| Retainable post-purchase notice | Web Checkout now returns to a printable Permitext confirmation page containing amount, frequency, automatic renewal, deadline, cancellation mechanism, refund rule, and policy links before returning to the app. | Prepared locally; production exercise open |
| Refund handling | The policy and lifecycle logic distinguish Apple from Stripe, initial/renewal charges, cancellation from refunds, partial from full refunds, and entitlement revocation. | Prepared; provider production evidence open |
| Professional/AI boundary | Terms and Research UI say Permitext is unofficial, citations do not guarantee correctness, official enacted text controls, and qualified review remains the user's responsibility. | Implemented |
| Third-party AI disclosure and permission | Privacy names OpenAI and data categories; the first Research submission requires an affirmative disclosure and can be declined. Private notes are excluded and users are told not to submit restricted data. | Implemented |
| OpenAI retention description | Requests set `store: false`; current official OpenAI documentation says API data is not used for training unless the API account opts in, default abuse monitoring may retain customer content up to 30 days, and encrypted prompt-cache state is not retained after 24 hours. | Matched to current official documentation |
| Privacy choices and deletion | Privacy identifies collected data, provider sharing, retention boundaries, deletion, support contact, and the minimal purchase-ownership exception. Web/iOS expose account deletion. | Implemented; production exercise open |
| Acceptable use | Terms prohibit unlawful use, abuse, security/limit bypass, infringement, and presenting output as official government determination. | Implemented |
| Changes and price increases | Terms now promise required advance notice, identify New York's 5-business-day to 30-day material-change window, and do not silently apply changes requiring renewed consent. | Prepared locally |
| Governing law and disputes | New York law subject to nonwaivable rights; 30-day informal notice; court with jurisdiction, small claims, and urgent relief remain available; no mandatory arbitration or class waiver. | Owner-selected; enforceability not attorney-reviewed |
| Liability and entity exposure | Terms retain disclaimers and a three-month paid-service liability cap subject to nonwaivable law. The sole proprietor has no separate entity shield. | Residual owner risk |
| Current/future product accuracy | Present-tense turn-pack promises were removed because additional turns remain disabled and unpublished. | Corrected |

## Current official sources checked

- [15 U.S.C. § 8403 (ROSCA)](https://uscode.house.gov/view.xhtml?edition=prelim&num=0&req=%28title%3A15+section%3A8403+edition%3Aprelim%29): online negative-option sellers must clearly disclose material terms before billing information, obtain express informed consent, and provide simple mechanisms to stop recurring charges.
- [New York General Business Law § 527-a](https://www.nysenate.gov/legislation/laws/GBS/527-A): clear and proximate recurring terms, affirmative consent, retainable post-consent notice, easy same-medium cancellation, price-increase protection, and material-change notice.
- [FTC 2026 Negative Option Rule ANPR](https://www.ftc.gov/system/files/ftc_gov/pdf/p064202negativeoptionruleanprm.pdf): the 2024 amended rule was vacated; this review therefore does not misstate the vacated rule as current law and instead relies on ROSCA, the FTC Act boundary, and applicable state law.
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): subscription value/disclosure, In-App Purchase, privacy, and explicit permission before personal data is shared with third-party AI.
- [Apple auto-renewable subscription guidance](https://developer.apple.com/app-store/subscriptions/): clear subscription name, duration, benefits, price, and policy links.
- [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data): training, abuse-monitoring, application-state, `store: false`, and prompt-cache retention boundaries.
- [FTC privacy and security enforcement](https://www.ftc.gov/news-events/topics/protecting-consumer-privacy-security/privacy-security-enforcement): privacy and security promises must not be unfair or deceptive.
- [FTC AI privacy commitments](https://www.ftc.gov/policy/advocacy-research/tech-at-ftc/2024/01/ai-companies-uphold-your-privacy-confidentiality-commitments): disclose AI data uses and obtain appropriate affirmative consent rather than making hidden retroactive changes.
- [IRS sole proprietorships](https://www.irs.gov/businesses/small-businesses-self-employed/sole-proprietorships): an unincorporated business owned by one person; Schedule C, Schedule SE, and estimated-tax forms may apply.
- [New York computer-software sales-tax bulletin](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/computer_software.htm): remote access to prewritten software by a New York purchaser is generally subject to state and local sales tax.
- [New York sales-tax vendor registration](https://www.tax.ny.gov/bus/st/register.htm): sellers of taxable property or services must register before beginning business.
- [Stripe Tax registration guidance](https://docs.stripe.com/tax/registering): the business identifies and completes registrations before using Stripe to collect in a jurisdiction.

## Owner decisions recorded by this review

1. Do not retain an attorney for Beta 1.
2. Operate as a sole proprietor unless the owner later forms an entity.
3. Use New York law without mandatory arbitration or a class-action waiver.
4. Keep the $20 monthly price, no trial, 100 turns, and 72-hour web refund promise unchanged.
5. Keep additional-turn sales disabled and unpublished.
6. Do not activate the policy versions, deploy, or run a paid production exercise as part of this review.
7. Treat New York sales-tax registration/configuration as a separate pre-sale gate even though Permitext profit will be reported on the owner's personal return.
8. On August 28, 2026, accept all residual Beta risks recorded in this review: possible gaps in a self-review, sole-proprietor personal exposure, possible nonenforcement of liability limits, potential customer/platform/provider/regulatory costs or required changes, and the need to review material product or billing changes again.

## Final owner approval and version record

On August 28, 2026, the owner approved the exact Terms, Privacy Policy, and Subscription and Refund Policy after a final plain-language review. The approved local versions are:

| Document | Version identifier | Approved-file SHA-256 |
| --- | --- | --- |
| `permitext-sync-server/public/terms.html` | `terms-2026-08-28` | `d15a253fd0886e9f091d0e76dfbba8ce0aa922ff57d7c84b66ab37c8d1fa8abc` |
| `permitext-sync-server/public/privacy.html` | `privacy-2026-08-28` | `ab2a135482fe22bd02136672c37da2821fb2df5add866e02928ae284d7fdddef` |
| `permitext-sync-server/public/refunds.html` | `subscriptions-2026-08-28` | `4e830128ba659d6074b975d8ea693ac5a4e687c80102531a8bbef422abd6ebc7` |

These identifiers are a local approval record only. They have not been configured in Production, published as a new release, or activated for purchase acceptance. If any approved file changes, it requires a new identifier, hash, and owner review.

## Open before public paid access

- Stable public URLs and exact web/iOS parity.
- Receive the newly requested New York sales-tax Certificate of Authority and document Stripe tax configuration before a taxable New York web sale, unless the Tax Department gives a different written classification. The registration application was submitted and its confirmation was saved on August 28, 2026.
- Production verification of the retainable web confirmation, Stripe portal cancellation, refund, renewal, and policy-version records.
- Apple-created Sandbox/TestFlight subscription and cancellation evidence.
- Production account export/deletion and provider cleanup evidence.

## Review conclusion

The prior mandatory-attorney gate is replaced with this documented owner self-review and explicit residual-risk acceptance. This is meaningful readiness evidence, but it is not a legal approval. Public billing remains blocked by tax registration/configuration, exact policy activation, stable URLs, production payment lifecycle evidence, and the other master-plan release gates.

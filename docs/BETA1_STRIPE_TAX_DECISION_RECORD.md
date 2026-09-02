# Permitext Beta 1 Stripe tax decision record

Status: **PRODUCTION VERIFIED — automatic/exclusive deployed; `txcd_10701400`, New York collection, quarterly filing schedule, and controlled taxed Checkout/refund verified; certificate-date corroboration and filing operations remain open**

This record documents the owner's August 30, 2026 approval of the Beta 1 Stripe tax presentation, the September 2 provider activation and Production deployment, and the separately authorized controlled taxed Checkout/refund. It does not determine Permitext's legal tax obligations, change the live `$20` Price, establish the filing process, or authorize uncontrolled customer sales.

## Verified current state

- An official New York Business Express notice and the authenticated Business License Information dashboard show that the Certificate of Authority registration was **Issued** on August 28, 2026. On September 2, 2026, the owner reported possessing the actual certificate and confirmed that it is privately saved and printed/displayed. This statement records owner confirmation only; the certificate image and taxpayer ID are intentionally not retained in source control. A read-only inspection of the owner's DTF-17 application found `09/18/2026` on both the New York sales-tax business-start field and the effective-date field. Because that PDF is the application rather than the issued certificate, certificate-level corroboration of the date remains open.
- The owner identified Permitext's filing frequency as quarterly. New York's official filing guidance independently confirms that a new sales-tax registrant is classified quarterly unless it qualifies for the narrow initial annual-filer rule; Permitext's taxable SaaS activity does not meet that manufacturer/wholesaler rule. The first applicable reporting quarter is September 1 through November 30, 2026, and the official 2026 calendar sets its filing deadline at December 21, 2026. A return is required even if the period has no taxable sales.
- The live recurring Price remains USD $20 per month and reports `Default (inferred by currency)` tax behavior.
- Stripe's current setup documentation says its automatic/default behavior excludes tax for USD, meaning applicable tax is added above the stated price.
- The live Product was updated and independently reread as `txcd_10701400`, `Website Information Services - Business Use`. This remains an owner-selected provider classification, not legal advice. New York's official software bulletin independently says licenses to remotely access prewritten software are taxable in New York.
- Stripe confirmed `Registration added successfully` for New York and stated that Sales tax collection starts immediately. The Locations view then showed New York with one registration. Its `Needs attention` state refers to the separate filing-setup step, which remains open.
- Stripe's registration review displayed the account-level generic preset and a zero-percent preview. The more specific live Product code overrides that preset for Permitext Pro under Stripe's Product tax-code rules. The controlled real Checkout subsequently verified the actual New York customer-location result: `$1.78` tax on a `$20.00` base price.
- The deployed Checkout requests automatic tax and requires billing information. The protected readiness audit resolved the documented USD default to `exclusive` before comparing it with the approved decision, and the real controlled transaction verified tax was added above the base price.
- The owner-authorized Production lifecycle charged `$21.78` total (`$20.00` base plus `$1.78`, or `8.875%`, New York sales tax), activated Pro with 100 turns, then completed cancellation and a full `$21.78` refund. Stripe ended the subscription, Permitext returned the account to Free, all inspected webhook deliveries returned HTTP 200, and no related runtime error was observed. Redacted evidence: [Production Stripe lifecycle](./PERMITEXT_BETA1_PRODUCTION_STRIPE_LIFECYCLE_2026-09-02.md).

## Approved Beta 1 decision

Use Stripe automatic tax with **exclusive** presentation for Beta 1:

```text
PERMITEXT_STRIPE_TAX_MODE=automatic
PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR=exclusive
```

This keeps Permitext Pro's base price at $20 and adds applicable sales tax at Checkout. It better preserves the already-thin Beta contribution than absorbing sales tax inside $20. The owner approved the exact web purchase disclosure **$20/month plus applicable taxes shown by Stripe.** Apple purchases remain separate and do not use this Stripe disclosure.

The alternative is `inclusive`: the customer total remains $20, but the tax portion comes out of that $20 and reduces Permitext's retained revenue. Do not select it without rerunning the contribution model for the applicable rates.

Stripe Tax Basic currently lists a 0.5% fee on Billing/Checkout transactions where tax is calculated and collected. At a $20 base price that is approximately $0.10 before any effect of tax on the charged total. The V6 subscriber model already includes that $0.10 web fee separately and also carries a distinct $1-per-subscription tax downside reserve. The verified fee therefore does not change the $15.84 p90 web cost or $4.16 contribution; the separate reserve remains provisional until real taxed transactions and provider invoices exist.

Official provider references:

- [Set up Stripe Tax](https://docs.stripe.com/tax/set-up)
- [Stripe Product tax codes](https://docs.stripe.com/tax/tax-codes)
- [Stripe Tax pricing](https://stripe.com/tax/pricing)
- [Stripe Checkout automatic-tax integration](https://docs.stripe.com/tax/checkout)
- [New York Tax Bulletin ST-128: Computer Software](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/computer_software.htm)
- [New York filing requirements for sales and use tax returns](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/filing_requirements_for_sales_and_use_tax_returns.htm)
- [New York 2026 tax filing dates](https://www.tax.ny.gov/help/calendar/2026.htm)

## Owner confirmation — August 30, 2026

The owner approved:

- `PERMITEXT_STRIPE_TAX_MODE=automatic`;
- `PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR=exclusive`;
- web purchase copy: `$20/month plus applicable taxes shown by Stripe.`

The matching disclosure is prepared in the local web purchase screen. This August 30 statement described the state at approval time; the September 2 activation below supersedes its no-change boundary.

## Owner confirmation — September 2, 2026

The owner reported possession of the actual Certificate of Authority, confirmed that it is privately saved and printed/displayed, and approved changing the live Permitext Pro Product classification to `txcd_10701400`, `Website Information Services - Business Use`, adding the existing New York registration, and starting collection immediately. A read-only inspection of the owner's DTF-17 application recorded the nonsensitive date `09/18/2026`; the PDF itself was not copied into the repository. The owner entered the New York Sales Tax ID privately in Stripe. The ID, certificate image, address, and DTF-17 contents were not copied into source control or retained in this evidence. Stripe accepted both provider submissions, and Vercel accepted the two approved Production keys without a deployment.

## What remains open

1. Confirm `09/18/2026` from the actual Certificate of Authority. The owner has confirmed private storage and printing/display, and the DTF-17 application states that date twice. Do not place the certificate image, taxpayer ID, home address, or DTF-17 contents in source control.
2. Retain the durable reminder and establish and rehearse the operational filing process for the first quarterly return due December 21, 2026; Stripe automatic filing is not configured.

## Provider activation sequence after approval

1. [x] Owner confirmed that the actual Certificate is privately saved and printed/displayed; no sensitive image or identifier was retained.
2. [x] Record quarterly filing and the first deadline of December 21, 2026 from current official New York guidance. The DTF-17 application records `09/18/2026`; confirmation of that date from the actual Certificate remains open.
3. [x] Submit and verify the approved specific Stripe Product tax code and add the applicable New York registration in Stripe Tax.
4. [x] Set the two Production environment values above without exposing credentials.
5. [x] Deploy the exact release and run the strict Production configuration/live-Stripe verifier. The existing USD Price passed with resolved exclusive behavior; no replacement Price was required solely because the Dashboard labels it `Default (inferred by currency)`.
6. [x] Publish matching customer copy and exact approved policies before Checkout activation.
7. [x] Under separate immediate authorization, run the controlled real-charge/refund acceptance and retain only redacted evidence.

The `new-york-certificate-stripe-tax` public-release gate remains open only for actual-certificate date corroboration and the operational filing process. The one explicitly authorized controlled sale is complete and fully refunded; it does not authorize general public sales.

Provider and environment activation evidence: [PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md](./PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md). Deployment evidence: [PERMITEXT_BETA1_PRODUCTION_DEPLOYMENT_2026-09-02.md](./PERMITEXT_BETA1_PRODUCTION_DEPLOYMENT_2026-09-02.md). Controlled transaction evidence: [PERMITEXT_BETA1_PRODUCTION_STRIPE_LIFECYCLE_2026-09-02.md](./PERMITEXT_BETA1_PRODUCTION_STRIPE_LIFECYCLE_2026-09-02.md).

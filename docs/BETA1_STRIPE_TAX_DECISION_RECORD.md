# Permitext Beta 1 Stripe tax decision record

Status: **PROVIDER CONFIGURED — automatic/exclusive staged; `txcd_10701400` and New York collection verified; deployment and filing evidence remain open**

This record documents the owner's August 30, 2026 approval of the Beta 1 Stripe tax presentation and the September 2 provider activation. It does not determine Permitext's legal tax obligations, change the live $20 Price, deploy the newly staged Production values, authorize a taxable sale, or prove the result of a real taxed Checkout. The matching web purchase disclosure remains prepared locally until deployment.

## Verified current state

- An official New York Business Express notice and the authenticated Business License Information dashboard show that the Certificate of Authority registration was **Issued** on August 28, 2026. On September 2, 2026, the owner reported possessing the actual certificate. This statement records owner confirmation only; the certificate image and taxpayer ID are intentionally not retained in source control. Saving, printing/display, the effective date shown on the certificate, and the assigned filing frequency remain unconfirmed.
- The live recurring Price remains USD $20 per month and reports `Default (inferred by currency)` tax behavior.
- Stripe's current setup documentation says its automatic/default behavior excludes tax for USD, meaning applicable tax is added above the stated price.
- The live Product was updated and independently reread as `txcd_10701400`, `Website Information Services - Business Use`. This remains an owner-selected provider classification, not legal advice. New York's official software bulletin independently says licenses to remotely access prewritten software are taxable in New York.
- Stripe confirmed `Registration added successfully` for New York and stated that Sales tax collection starts immediately. The Locations view then showed New York with one registration. Its `Needs attention` state refers to the separate filing-setup step, which remains open.
- Stripe's registration review displayed the account-level generic preset and a zero-percent preview. The more specific live Product code overrides that preset for Permitext Pro under Stripe's Product tax-code rules, but a controlled real Checkout still must verify the actual customer-location result and amount.
- The local Checkout implementation can request automatic tax and require a billing address. The approved Production keys are now staged in Vercel, and the live readiness audit resolves the documented USD default to `exclusive` before comparing it with that decision. No deployment occurred, so the serving release does not use the newly staged values yet.

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

## Owner confirmation — August 30, 2026

The owner approved:

- `PERMITEXT_STRIPE_TAX_MODE=automatic`;
- `PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR=exclusive`;
- web purchase copy: `$20/month plus applicable taxes shown by Stripe.`

The matching disclosure is prepared in the local web purchase screen. This August 30 statement described the state at approval time; the September 2 activation below supersedes its no-change boundary.

## Owner confirmation — September 2, 2026

The owner reported possession of the actual Certificate of Authority and approved changing the live Permitext Pro Product classification to `txcd_10701400`, `Website Information Services - Business Use`, adding the existing New York registration, and starting collection immediately. The owner entered the New York Sales Tax ID privately in Stripe. The ID, certificate image, and address were not copied into source control or retained in this evidence. Stripe accepted both provider submissions, and Vercel accepted the two approved Production keys without a deployment.

## What remains open

1. Save the actual Certificate of Authority privately, print/display it as required, and privately record its effective date and assigned filing frequency. Do not place the certificate image, taxpayer ID, or home address in source control.
2. Record the first filing deadline and durable reminder, and choose a separate filing process; Stripe automatic filing is not configured.
3. Deploy the exact approved release and policies so the serving Checkout can use the staged `automatic` + `exclusive` values.
4. Separately authorize and verify a controlled real taxed Checkout and refund using a disposable account.

## Provider activation sequence after approval

1. [ ] Record the actual Certificate, effective date, filing frequency, first filing deadline, and display evidence privately.
2. [x] Submit and verify the approved specific Stripe Product tax code and add the applicable New York registration in Stripe Tax.
3. [x] Set the two Production environment values above without exposing credentials.
4. [ ] Deploy the exact release and run the strict Production configuration/live-Stripe verifier. The existing USD Price may remain if its resolved exclusive behavior passes; no replacement Price is required solely because the Dashboard labels it `Default (inferred by currency)`.
5. [ ] Publish matching customer copy and exact approved policies before Checkout activation.
6. [ ] Under separate immediate authorization, run the controlled real-charge/refund acceptance and retain only redacted evidence.

Until all six steps pass, the `new-york-certificate-stripe-tax` public-release gate remains open and Permitext must not accept a taxable New York web sale.

The three exact approved policy-version identifiers and both Stripe-tax activation keys are staged in Vercel Production without a deployment. Provider and environment evidence: [PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md](./PERMITEXT_BETA1_STRIPE_TAX_PROVIDER_ACTIVATION_2026-09-02.md).

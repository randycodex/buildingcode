# Permitext Beta 1 Stripe tax decision record

Status: **OWNER APPROVED — automatic/exclusive selected; Certificate and provider activation remain open**

This record documents the owner's August 30, 2026 approval of the Beta 1 Stripe tax presentation. It does not determine Permitext's legal tax obligations, activate Stripe Tax, change the live $20 Price, set Production variables, deploy, or authorize a taxable sale. The matching web purchase disclosure is prepared locally only.

## Verified current state

- The New York Certificate of Authority application was submitted, but receipt and the assigned filing frequency remain unconfirmed.
- The live recurring Price remains USD $20 per month and reports `Default (inferred by currency)` tax behavior.
- Stripe's current setup documentation says its automatic/default behavior excludes tax for USD, meaning applicable tax is added above the stated price.
- The live Product currently uses preset tax code `txcd_10000000`, `General - Electronically Supplied Services`. Stripe displays a warning to review whether that preset code matches what Permitext sells.
- The Stripe Tax collecting-locations view showed no live transactions and no collecting-location row. Stripe states that this monitor excludes the home jurisdiction, so that view does not prove the New York registration state.
- The local Checkout implementation can request automatic tax and require a billing address. Production now fails closed until an explicit local tax decision exists, and the live readiness audit resolves the documented USD default to `exclusive` before comparing it with that decision.

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
- [Stripe Tax pricing](https://stripe.com/tax/pricing)
- [Stripe Checkout automatic-tax integration](https://docs.stripe.com/tax/checkout)

## Owner confirmation — August 30, 2026

The owner approved:

- `PERMITEXT_STRIPE_TAX_MODE=automatic`;
- `PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR=exclusive`;
- web purchase copy: `$20/month plus applicable taxes shown by Stripe.`

The matching disclosure is now prepared in the local web purchase screen. The approved policy files were not changed. No Production environment variable, Stripe registration, Product tax code, Price, provider setting, deployment, or charge changed.

## What remains open

1. Confirm whether the new New York Certificate of Authority has arrived and, if so, privately record its effective date and assigned filing frequency. Do not place the certificate image, taxpayer ID, or home address in source control.
2. Review whether to retain Stripe's current Product tax code against Permitext's actual service.
3. Confirm the applicable New York registration in Stripe Tax.
4. Separately authorize Production activation only after the Certificate and provider facts pass review.

## Provider activation sequence after approval

1. Record the Certificate and filing-frequency evidence privately.
2. Confirm the Stripe Product tax code and add the applicable New York registration in Stripe Tax.
3. Set the two Production environment values above without exposing credentials.
4. Run the strict Production configuration/live-Stripe verifier. The existing USD Price may remain if its resolved exclusive behavior passes; no replacement Price is required solely because the Dashboard labels it `Default (inferred by currency)`.
5. Publish matching customer copy and exact approved policies before Checkout activation.
6. Under separate immediate authorization, run the controlled real-charge/refund acceptance and retain only redacted evidence.

Until all six steps pass, the `new-york-certificate-stripe-tax` public-release gate remains open and Permitext must not accept a taxable New York web sale.

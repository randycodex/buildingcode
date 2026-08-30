# Permitext Beta 1 Stripe tax decision record

Status: **PREPARED — owner and provider activation remain open**

This record makes tomorrow's decision small and explicit. It does not determine Permitext's legal tax obligations, activate Stripe Tax, change the $20 Price, change customer copy, set Production variables, deploy, or authorize a taxable sale.

## Verified current state

- The New York Certificate of Authority application was submitted, but receipt and the assigned filing frequency remain unconfirmed.
- The live recurring Price remains USD $20 per month and reports `Default (inferred by currency)` tax behavior.
- Stripe's current setup documentation says its automatic/default behavior excludes tax for USD, meaning applicable tax is added above the stated price.
- The live Product currently uses preset tax code `txcd_10000000`, `General - Electronically Supplied Services`. Stripe displays a warning to review whether that preset code matches what Permitext sells.
- The Stripe Tax collecting-locations view showed no live transactions and no collecting-location row. Stripe states that this monitor excludes the home jurisdiction, so that view does not prove the New York registration state.
- The local Checkout implementation can request automatic tax and require a billing address. Production now fails closed until an explicit local tax decision exists, and the live readiness audit resolves the documented USD default to `exclusive` before comparing it with that decision.

## Recommendation for owner approval

Use Stripe automatic tax with **exclusive** presentation for Beta 1:

```text
PERMITEXT_STRIPE_TAX_MODE=automatic
PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR=exclusive
```

This keeps Permitext Pro's base price at $20 and adds applicable sales tax at Checkout. It better preserves the already-thin Beta contribution than absorbing sales tax inside $20. Customer-facing purchase copy must clearly say **$20/month plus applicable taxes** before activation.

The alternative is `inclusive`: the customer total remains $20, but the tax portion comes out of that $20 and reduces Permitext's retained revenue. Do not select it without rerunning the contribution model for the applicable rates.

Stripe Tax Basic currently lists a 0.5% fee on Billing/Checkout transactions where tax is calculated and collected. At a $20 base price that is approximately $0.10 before any effect of tax on the charged total. The existing $1-per-subscription tax planning reserve is still larger than that known provider fee, but the reserve remains provisional until real taxed transactions and provider invoices exist.

Official provider references:

- [Set up Stripe Tax](https://docs.stripe.com/tax/set-up)
- [Stripe Tax pricing](https://stripe.com/tax/pricing)
- [Stripe Checkout automatic-tax integration](https://docs.stripe.com/tax/checkout)

## What the owner needs to confirm tomorrow

1. Whether the new New York Certificate of Authority has arrived and, if so, its effective date and assigned filing frequency. Do not place the certificate image, taxpayer ID, or home address in source control.
2. Approval or rejection of the recommended `automatic` + `exclusive` presentation.
3. Approval or adjustment of the customer copy: `$20/month plus applicable taxes`.
4. Whether to retain Stripe's current Product tax code after reviewing its description against Permitext's actual service.

## Provider activation sequence after approval

1. Record the Certificate and filing-frequency evidence privately.
2. Confirm the Stripe Product tax code and add the applicable New York registration in Stripe Tax.
3. Set the two Production environment values above without exposing credentials.
4. Run the strict Production configuration/live-Stripe verifier. The existing USD Price may remain if its resolved exclusive behavior passes; no replacement Price is required solely because the Dashboard labels it `Default (inferred by currency)`.
5. Publish matching customer copy and exact approved policies before Checkout activation.
6. Under separate immediate authorization, run the controlled real-charge/refund acceptance and retain only redacted evidence.

Until all six steps pass, the `new-york-certificate-stripe-tax` public-release gate remains open and Permitext must not accept a taxable New York web sale.

# Permitext Beta 1 Stripe tax provider activation evidence

Status: **CONFIGURED IN STRIPE AND VERCEL; NOT DEPLOYED OR REAL-CHARGE VERIFIED**

Recorded at `2026-09-02T21:56:33Z` after the owner's immediate approval and private entry of the New York Sales Tax ID. This record intentionally excludes the taxpayer ID, certificate image, residential address, browser form contents, and full provider identifiers.

## Verified provider state

- Stripe confirmed `Product updated` for the live `Permitext Pro` Product.
- A fresh Product-page read showed `Website Information Services - Business Use` with tax code `txcd_10701400`.
- Stripe confirmed `Registration added successfully` for New York and stated: `Starting immediately, you’ll collect Sales tax in New York.`
- The Locations view showed New York with one registration. Its `Needs attention` status referred to the separate filing-setup step; the completion dialog confirmed that calculation and collection were active while automatic filing remained unconfigured.
- The registration review used Stripe's account-level preset category and displayed a zero-percent preview. The live Product has the more specific `txcd_10701400` override; Stripe's Product tax-code documentation says Product-level codes override the account preset for that Product. A controlled real Checkout is still required to verify the actual customer-location result and amount.

## Verified Vercel staging

The following approved values were added to the `permitext-sync` **Production** environment after provider activation:

```text
PERMITEXT_STRIPE_TAX_MODE=automatic
PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR=exclusive
```

The Vercel CLI reported both additions as successful, and a fresh Production environment listing showed both keys. Vercel stores the values as hidden Secrets, so the listing proves key presence rather than independently rereading the hidden bytes.

No deployment was triggered. The serving Production release therefore does not use these newly staged values yet, and no customer charge, refund, subscription, or tax transaction was created.

## Remaining acceptance boundaries

1. Privately save and print/display the Certificate of Authority, and record its effective date and assigned filing frequency without committing sensitive material.
2. Record the first New York filing deadline and a durable reminder; either configure filing separately or retain a manual filing process.
3. Deploy the exact approved release and exact policy artifacts, then require the strict Production configuration and policy-publication checks to pass.
4. Under separate immediate authorization, run the controlled real taxed-Checkout and refund exercise using a disposable account, retaining only redacted evidence.

This is provider-configuration evidence, not legal or tax advice and not authorization for public paid Beta.

# Permitext Beta 1 Stripe tax provider activation evidence

Status: **CONFIGURED IN STRIPE AND VERCEL; NOT DEPLOYED OR REAL-CHARGE VERIFIED**

Recorded at `2026-09-02T21:56:33Z` after the owner's immediate approval and private entry of the New York Sales Tax ID. This record intentionally excludes the taxpayer ID, certificate image, residential address, browser form contents, and full provider identifiers.

## Certificate and application evidence

- The owner confirmed that the actual Certificate of Authority is privately saved and printed/displayed. This is owner-confirmed evidence; the certificate image and identifiers were not copied or independently retained.
- Read-only inspection of the owner-supplied DTF-17 application found `09/18/2026` on page 1 as the date business will begin in New York for sales-tax purposes and on page 13 as the effective date of assuming responsibility.
- The DTF-17 PDF is the application, not the issued Certificate of Authority. It contains no assigned filing frequency. Certificate-level corroboration of the effective date and the assigned filing frequency therefore remain open.
- The PDF and its sensitive contents were not copied into source control.

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

1. Confirm the effective date from the actual Certificate of Authority and privately record its assigned filing frequency. Private storage and printing/display are owner-confirmed, and the DTF-17 application records `09/18/2026`, but the application does not assign a filing frequency.
2. Record the first New York filing deadline and a durable reminder; either configure filing separately or retain a manual filing process.
3. Deploy the exact approved release and exact policy artifacts, then require the strict Production configuration and policy-publication checks to pass.
4. Under separate immediate authorization, run the controlled real taxed-Checkout and refund exercise using a disposable account, retaining only redacted evidence.

This is provider-configuration evidence, not legal or tax advice and not authorization for public paid Beta.

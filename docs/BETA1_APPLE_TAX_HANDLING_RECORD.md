# Permitext Beta 1 Apple tax-handling record

Status: **Live tax-category state verified read-only; owner classification and real financial evidence remain open**

Last updated: August 30, 2026

## Scope and boundary

This record separates App Store subscription tax handling from Permitext's Stripe web Checkout. It does not select or change an Apple tax category, provide tax advice, submit the app, create a real charge, or claim that Apple has accepted Permitext's tax treatment.

Permitext's current App Store identifiers are:

- app: `permitext`, Apple ID `6774385434`, bundle ID `com.randycodex.permitext`;
- subscription: `Permitext Pro Monthly`, Apple ID `6777744460`, product ID `com.randycodex.permitext.pro.monthly`;
- customer price: $20 per month in the current United States configuration.

## Official Apple boundary

Apple's tax calculation service uses the App Store Connect tax category together with app metadata, legal-entity status, tax-registration status, customer attributes, and local requirements. The app's category applies to its In-App Purchases by default, but an individual In-App Purchase or subscription can have a separate category. If no category is selected, Apple assigns the App Store software category. A category change applies only to future transactions and can take time to propagate.

Apple's financial-report documentation says the customer price includes applicable taxes Apple collects and remits. Partner Share, or developer proceeds per unit, is the customer price minus applicable taxes and Apple's commission. Therefore the $20 App Store customer price is not modeled as a $20 base plus a separately added Stripe tax amount.

Apple's Payments and Financial Reports is the authoritative provider record for actual App Store proceeds, taxes, adjustments, commission effects, sales, and returns. Financial reports are generated only for fiscal periods containing purchases or refunds. The United States and Canada transaction-tax report becomes available after tax-category configuration and summarizes taxes Apple applies by jurisdiction.

Official sources:

- [Set a tax category](https://developer.apple.com/help/app-store-connect/manage-app-information/set-a-tax-category)
- [Set a tax category for In-App Purchases](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/set-a-tax-category-for-in-app-purchases)
- [View payments and proceeds](https://developer.apple.com/help/app-store-connect/getting-paid/view-payments-and-proceeds)
- [Download financial reports](https://developer.apple.com/help/app-store-connect/getting-paid/download-financial-reports/)
- [Financial report fields](https://developer.apple.com/help/app-store-connect/reference/reporting/financial-report-fields/)

## Permitext implementation rule

- Stripe automatic tax applies only to a Stripe web Checkout. It must not be applied to an App Store purchase, renewal, or refund.
- Permitext's Apple server path verifies entitlement and processes Apple-signed lifecycle events; it does not create a second Stripe transaction or separately collect customer tax.
- New York Certificate and Stripe Tax activation remain a web-sales gate. They do not by themselves prove the App Store category or Apple's transaction treatment.
- The V6 iOS economics model keeps its 5% tax downside reserve until the owner confirms the observed category and a real Apple financial report provides actual proceeds and tax evidence. The current $17.86 p90 iOS cost and $2.14 contribution remain planning figures, not a guaranteed payout.

## August 30 read-only provider observations

An initial authenticated App Store Connect attempt opened the correct Permitext app route, but the app-detail module did not render because an installed Chrome extension caused App Store Connect's JavaScript loader to report `Cannot redefine property: ethereum`. That attempt did not establish the category.

A later authenticated read-only inspection succeeded without changing the extension or any Apple setting. It observed both authoritative dashboard locations:

- Apps > permitext > Distribution > Pricing and Availability > Tax Category displayed `Category: App Store software` for parent app Apple ID `6774385434`.
- Apps > permitext > Monetization > Subscriptions > Permitext Pro Monthly > Tax Category displayed `Category` as `Match to parent app` for subscription Apple ID `6777744460`.

The subscription therefore inherits the currently displayed parent-app category. This records live configuration state only; it does not independently establish that the category is legally or tax-professionally correct, and it is not real transaction evidence. No extension, Apple field, price, territory, agreement, tax record, financial report, or app-submission state was changed.

The current official App Store Connect OpenAPI specification was also downloaded read-only from Apple's published specification archive and searched for a tax-category resource or field. It exposes app, subscription, In-App Purchase, and price/proceeds resources, but it does not expose the selected app or subscription tax category. Price points can reflect the economic effect of a category without identifying which category is selected. The supported public API therefore cannot replace the dashboard observation, and Permitext must not infer the category from price or proceeds alone.

The previous no-charge Sandbox/TestFlight purchase and refund lifecycle proves StoreKit entitlement behavior only. Sandbox displays and zero-charge test transactions are not evidence of real tax collection, remittance, proceeds, or a Production customer price.

## Owner classification confirmation still required

Permitext is principally a software research workspace, and the observed parent category is the prior working candidate, `App Store software`. This is still not a final tax classification. Before App Review or the first real App Store sale, the owner should confirm that this category accurately describes the actual subscription. Any proposed category change requires separate approval before it is saved.

The two locations and their current displayed states are preserved above so this classification decision does not depend on repeating the dashboard inspection.

## Acceptance still required

- [x] Observe and record the live parent-app tax category: `App Store software`.
- [x] Observe and record that `Permitext Pro Monthly` is `Match to parent app`.
- [ ] Confirm the selected category accurately describes Permitext before App Review or a real sale.
- [ ] After the first fiscal period with a real App Store purchase or refund, save the Payments and Financial Reports evidence and transaction-tax report when available.
- [ ] Replace the 5% iOS reserve with measured taxes, commission, refunds, and proceeds only after sufficient real evidence exists.

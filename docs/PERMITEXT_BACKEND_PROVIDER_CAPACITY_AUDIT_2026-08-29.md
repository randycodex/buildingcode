# Permitext backend provider capacity and upgrade guard — August 29, 2026

## Decision

No additional Permitext backend account requires an upgrade today. Do not upgrade a provider merely because the public Beta is approaching. Recheck the concrete thresholds below and require owner approval before any plan, automatic recharge, paid add-on, or spending-limit increase.

## Live and official evidence

| Provider | Current evidence | Decision now | Alert before changing spend |
| --- | --- | --- | --- |
| Vercel | Permitext is on Pro. The live billing view showed `$0.40 / $20` of included credit and `$0` on-demand charges; the separate $20 on-demand amount, web/email notifications, and automatic Production pause remain enabled. | No upgrade. Pro is already the required commercial hosting tier. | Alert at the existing 75% included-credit notification, any unexpected add-on/seat charge, or before changing the $20 on-demand amount or pause behavior. |
| Neon PostgreSQL | The live Vercel Marketplace installation reports `free_v3 / Free`; `permitext-sync-db` is `available`. The completed restore exercise remained inside the existing allowance. Neon currently documents 100 CU-hours and 0.5 GB per project plus a six-hour restore window on Free; Launch is usage-based and extends restore history to seven days. | No upgrade for testing today. Neon is the first provider that may justify an upgrade before or shortly after paid launch because its Free recovery and capacity windows are intentionally small. | Alert before the first paid public customer for a fresh dashboard review; immediately at 70 CU-hours in a month, 350 MB stored, a need for more than six hours of recovery history, or any Free-plan capacity interruption. These are conservative internal 70% warnings, not provider-enforced cutoffs. |
| Vercel Blob | The live Production store is `available` with 124 objects / 5,248,939 bytes. Across the team, the Production and isolated restore stores total 248 objects / 10,497,878 bytes; the Apple staging store is empty. Blob consumption is part of Vercel's usage-based infrastructure billing. | No separate plan upgrade. Current data volume is small; retain the restore store until its recovery evidence/resource-retention decision is explicit. | Alert with the Vercel 75% credit warning, if Blob exceeds 1 GB, or before enabling a new paid storage add-on. Do not delete retained recovery evidence merely to reduce this negligible usage. |
| Clerk | The authenticated dashboard reports the organization on `Hobby`. Permitext Production shows six total sign-ups. Clerk currently includes up to 50,000 Monthly Retained Users per app on Hobby. | No upgrade. The current Production population is far below the free threshold. | Alert at 40,000 MRU, before adding a fourth dashboard seat, or before enabling a feature the dashboard explicitly marks Pro/Business-only. Do not infer MRU from total sign-ups; use Clerk Billing/Analytics. |
| Stripe Payments and Billing | The integration uses Stripe's standard pay-as-you-go model. Stripe currently lists no setup or monthly platform fee for standard Payments, 2.9% + 30 cents for a successful domestic-card transaction, and 0.7% of Billing volume for pay-as-you-go Stripe Billing. | No account-plan upgrade. Fees grow with successful transactions. | Review actual fees/refunds after the first 25–50 customers and before accepting any annual contract or custom pricing. Stripe Tax configuration is a separate launch requirement and may add per-transaction cost; it is not a general Stripe account upgrade. |
| OpenAI API | Production has an API credential marker and the V6 benchmark completed after credit was restored. The billing dashboard was not signed in during this audit, so the exact balance, usage tier, automatic recharge state, and limits were not claimed. OpenAI documents prepaid credit, organization/project spend limits, and automatic usage-tier progression as separate controls. | No subscription-tier upgrade is indicated. API access is credit/usage-based. | Before public launch, verify the exact balance, turn off or cap automatic recharge unless the owner explicitly chooses it, and require at least one fully-used p90 month of model budget: `$6.06 × active Pro subscribers`, bounded by the planned `$7 × active Pro subscribers` application cap. Alert on any `credit_balance_exhausted`, usage-limit, spend-limit, or unexpected rate-limit error before buying or raising anything. |
| Apple Developer / App Store Connect | The active Developer Program membership accepted TestFlight build 48 on August 29. Apple's standard program remains $99 per membership year; no higher membership tier is needed for App Store distribution. | No upgrade. The 15% Small Business commission is a commercial fee, not a backend tier. | Read the exact membership expiration date before final release and alert 30 days before renewal. Do not move to the Enterprise Program; it is for a different private-distribution use case. |
| Google, Microsoft, and Apple sign-in credentials | Clerk Production connections are configured. The Microsoft secret-expiration guard is already documented, and the Apple sign-in key has no automatic expiration. | No paid provider upgrade is indicated. | Alert on credential expiration, provider quota/error messages, or a dashboard feature explicitly requiring a paid tier; treat credential rotation separately from an account upgrade. |

## Official sources checked

- [Vercel pricing and usage model](https://vercel.com/docs/pricing)
- [Vercel usage management](https://vercel.com/docs/pricing/manage-and-optimize-usage)
- [Vercel Blob pricing](https://vercel.com/blog/vercel-blob-now-generally-available)
- [Neon pricing and Free/Launch limits](https://neon.com/pricing)
- [Clerk pricing and MRU limits](https://clerk.com/pricing)
- [Stripe standard pricing](https://stripe.com/pricing)
- [Stripe Billing pricing](https://stripe.com/billing/pricing)
- [OpenAI API usage and spend limits](https://help.openai.com/en/articles/6614457)
- [OpenAI prepaid billing](https://help.openai.com/en/articles/8264644-how-can-i-set-up-prepaid-billing)
- [Apple Developer membership comparison](https://developer.apple.com/support/compare-memberships/)
- [Apple Developer membership renewal](https://developer.apple.com/help/account/membership/renewal)

## Boundaries

This audit read only plan/status/aggregate-capacity information. It did not retrieve provider secrets, enumerate customer records, purchase credit, enable automatic recharge, upgrade a plan, change a spending control, deploy, change Production configuration, or delete retained provider resources.

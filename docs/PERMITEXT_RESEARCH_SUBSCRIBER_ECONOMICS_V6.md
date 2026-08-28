# Permitext Research subscriber economics — V6

Last updated: August 28, 2026

This is a no-cost local planning model based on the immutable V6 production benchmark. It does not call a model or provider, configure a product, publish a price, or change the current Pro allowance.

## Decision

Do not lock the current 100-turn allowance for paid release yet. If an allowance had to be fixed from the current evidence and conservative planning reserves, use **75 included turns provisionally**. Keep the product configuration unchanged until the unverified inputs below are replaced with actual operating values and the web/current-iOS response contract is checked.

The reason is narrow:

- Empirical aggregation of the 20 V6 production costs produces a 100-turn subscriber model cost of **$5.74 p50** and **$6.06 p90**. The p90 is only $0.06 above the approximate $6 model-cost objective, but it leaves no room to treat the mean as the risk case.
- At the stated planning reserves, 100 turns cost **$18.34 p90 on web**, leaving $1.66 of monthly contribution, but **$20.36 p90 on iOS at a 15% commission**, a $0.36 loss. At the standard 30% commission the modeled p90 cost is $23.36.
- Seventy-five turns cost **$16.86 p90 on web** and **$18.88 p90 on iOS at 15%**, leaving positive contribution in both decision channels under the same assumptions.

This is not a final price, margin target, or release authorization. It is a provisional risk boundary while the non-model inputs are unmeasured.

## Fully utilized subscriber cost

| Included turns | Model p50 | Model p90 | Web full p50 | Web full p90 | iOS 15% full p50 | iOS 15% full p90 | iOS 30% full p90 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 50 | $2.87 | $3.09 | $9.65 | $15.37 | $11.67 | $17.39 | $20.39 |
| 75 | $4.30 | $4.58 | $11.08 | $16.86 | $13.10 | $18.88 | $21.88 |
| 100 | $5.74 | $6.06 | $12.52 | $18.34 | $14.54 | $20.36 | $23.36 |

At 100 turns, p90 contribution after all stated reserves is:

- web through Stripe: **$1.66**, or **8.3%** of the $20 price;
- iOS at the 15% Small Business Program rate: **-$0.36**, or **-1.8%**;
- iOS at the standard 30% rate: **-$3.36**, or **-16.8%**.

The 30% iOS case is sensitivity evidence, not a decision channel. The 15% case can be used for a release decision only after Permitext's App Store Small Business Program enrollment is confirmed.

## Method

The model uses all 20 `conservativeProviderCostUSD` values from:

- `permitext-sync-server/evals/results/2026-08-28T02-26-08-632Z-edc69c6b-bf30-4856-859e-99667d03bd2b.json`

It runs 100,000 deterministic empirical-bootstrap subscriber months. Each simulated month samples V6 production turn costs with replacement until the selected allowance is fully used. The report then takes the distribution of the complete monthly total. This is the required subscriber-level aggregation; it does not multiply a single-turn p90 by 100.

The V6 cohort was deliberately difficult and all 20 answers routed directly to Terra with Luna verification. That makes it a conservative stress sample for ordinary mixed usage, but 20 cases are still too few to characterize real customer behavior. The separate grader cost is excluded because grading is a one-time evaluation expense, not a production subscriber cost.

## Planning inputs

| Cost | p50 assumption | p90 assumption | Status |
| --- | ---: | ---: | --- |
| V6 model usage | empirical aggregate | empirical aggregate | Measured in V6 |
| Vercel infrastructure | $20/month | $45/month | $20 platform fee is current; $25 on-demand amount is a conservative full-budget case |
| Fully utilized paid subscribers | 25 | 25 | Planning denominator, not measured |
| Infrastructure per subscriber | $0.80 | $1.80 | Derived from the preceding two rows |
| Support time | 6 minutes | 15 minutes | Planning reserve, not measured |
| Owner-time rate | $30/hour | $30/hour | Planning opportunity cost, not payroll |
| Refund reserve | 5% of price | 5% of price | Planning reserve, not measured incidence |
| Tax reserve | 5% of price | 5% of price | Conservative reserve, not tax advice or a jurisdiction calculation |

Channel costs use these current public terms:

- Stripe domestic online card processing: 2.9% + $0.30 per successful transaction. Stripe Tax Basic adds 0.5% on transactions where the business is registered to collect tax. Stripe says original card-processing fees are not returned on ordinary card refunds. [Stripe pricing](https://stripe.com/pricing)
- Apple's standard digital-goods commission is 30%; approved App Store Small Business Program participants receive an 85% share, before applicable taxes. [Apple membership pricing](https://developer.apple.com/programs/whats-included/), [Apple subscriptions](https://developer.apple.com/app-store/subscriptions/), [Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- Vercel Pro has a $20 monthly platform fee with a $20 usage credit. The existing Permitext runbook adds a conservative $25 on-demand budget case. [Vercel Pro plan](https://vercel.com/docs/plans/pro-plan)

Sales tax collected from a customer is not automatically a Permitext expense. The 5% tax reserve intentionally covers unresolved tax-inclusive pricing, provider withholding, and compliance treatment until Stripe Tax and App Store tax configuration are reviewed. It must be replaced rather than silently retained as a factual tax rate.

## Inputs that still block a final allowance decision

- Confirm App Store Small Business Program enrollment and the actual Pro-subscription proceeds in App Store Connect.
- Confirm whether the advertised $20 is tax-exclusive on web and how Stripe Tax is configured for registered jurisdictions.
- Replace the 5% refund reserve with actual/refined expected refund incidence after the lifecycle exercise.
- Measure support minutes by category and choose an explicit owner-time cost.
- Replace the 25-subscriber infrastructure denominator with launch-volume scenarios and measured per-turn storage/compute usage.
- Choose a minimum acceptable contribution or gross-margin target. Positive contribution alone is not a sufficient long-term pricing standard.

Until those inputs are verified, 75 is a provisional risk-controlled allowance, 100 remains unchanged in the product, and additional-turn prices remain unpublished.

## Reproduce

From `permitext-sync-server`:

```sh
npm run eval:research:subscriber-economics-v6
npm --silent run eval:research:subscriber-economics-v6 -- --json
```

Both commands read the retained V6 result only. They do not use `OPENAI_API_KEY`, make a network request, spend provider credit, or mutate commercial configuration.

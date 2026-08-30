# Permitext Research subscriber economics — V6

Last updated: August 28, 2026

This is a no-cost local planning model based on the immutable V6 production benchmark. It does not call a model or provider, configure a product, publish a price, or change the current Pro allowance.

## Decision

Retain **100 included turns** for Beta 1. The owner confirmed Permitext's 15% App Store commission, approved ten support minutes per subscriber at $30/hour, and accepted a **$2 minimum Beta contribution** at full p90 usage. The longer-term target remains $4–$6 after actual customer data exists.

The reason is narrow:

- Empirical aggregation of the 20 V6 production costs produces a 100-turn subscriber model cost of **$5.74 p50** and **$6.06 p90**. The p90 is only $0.06 above the approximate $6 model-cost objective, but it leaves no room to treat the mean as the risk case.
- At the owner-approved support assumption and stated planning reserves, 100 turns cost **$15.84 p90 on web**, leaving $4.16 of monthly contribution, and **$17.86 p90 on iOS at the confirmed 15% commission**, leaving $2.14. At the standard 30% commission the sensitivity cost is $20.86.
- The V6 cohort deliberately sent every difficult question through Terra answering and Luna verification, and the model assumes every subscriber uses all 100 turns. Retaining 100 is a conservative Beta decision, not a claim that every subscriber will cost the p90 amount.

This retains the existing product allowance; it does not change the $20 price or authorize release. The no-cost tax/refund/infrastructure audit and sensitivities below are complete, but actual tax configuration, refund incidence, measured infrastructure allocation, and other release gates remain open.

## Fully utilized subscriber cost

| Included turns | Model p50 | Model p90 | Web full p50 | Web full p90 | iOS 15% full p50 | iOS 15% full p90 | iOS 30% full p90 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 50 | $2.87 | $3.09 | $11.65 | $12.87 | $13.67 | $14.89 | $17.89 |
| 75 | $4.30 | $4.58 | $13.08 | $14.36 | $15.10 | $16.38 | $19.38 |
| 100 | $5.74 | $6.06 | $14.52 | $15.84 | $16.54 | $17.86 | $20.86 |

At 100 turns, p90 contribution after all stated reserves is:

- web through Stripe: **$4.16**, or **20.8%** of the $20 price;
- iOS at the confirmed 15% Small Business Program rate: **$2.14**, or **10.7%**;
- iOS at the standard 30% rate: **-$0.86**, or **-4.3%**.

The 30% iOS case is sensitivity evidence, not a decision channel. The owner confirmed that Permitext has the 15% App Store rate.

## Launch-volume sensitivity

The prior headline allocated the full $45 p90 monthly infrastructure budget across 25 fully utilized subscribers. That assumption matters. Holding the 100-turn p90 model cost, support, tax, refund, and channel assumptions constant gives:

| Fully utilized subscribers | P90 infrastructure each | Web p90 contribution | $2 target | iOS 15% p90 contribution | $2 target |
| ---: | ---: | ---: | :---: | ---: | :---: |
| 10 | $4.50 | $1.46 | Fail | -$0.56 | Fail |
| 25 | $1.80 | $4.16 | Pass | $2.14 | Pass |
| 50 | $0.90 | $5.06 | Pass | $3.04 | Pass |
| 100 | $0.45 | $5.51 | Pass | $3.49 | Pass |

Under that deliberately conservative full-budget allocation, the $2 contribution floor first passes at **12 fully utilized web subscribers** and **24 fully utilized iOS subscribers**. This answers the low-volume concern: $20 is viable under the accepted Beta floor once roughly two dozen fully utilized subscribers share the p90 infrastructure budget, but the earliest iOS-heavy months can run below the floor. That is a fixed-cost launch effect, not evidence that each subscriber causes $4.50 of infrastructure use.

## Refund-reserve sensitivity

Holding the 25-subscriber infrastructure denominator and all other p90 assumptions constant:

| Assumed refunded gross revenue | Web p90 contribution | iOS 15% p90 contribution |
| ---: | ---: | ---: |
| 0% | $5.16 | $3.14 |
| 1% | $4.96 | $2.94 |
| 3% | $4.56 | $2.54 |
| 5% | $4.16 | $2.14 |
| 10% | $3.16 | $1.14 |

The working 5% reserve means the model withholds **$1.00 from every $20 charge** for expected refunds. It is not a prediction. Permitext has no launch incidence yet, and the working policy permits a full refund of every Stripe initial or renewal charge requested within 72 hours regardless of usage. Stripe's standard pricing does not return the original card-processing fee on an ordinary card refund. [Stripe pricing](https://stripe.com/pricing)

## Commercial-input audit

### Tax

Permitext now has a dormant automatic-tax Checkout path with required billing-address collection and a fail-closed Production guard. The live USD $20 Price uses Stripe's `Default (inferred by currency)` behavior, which Stripe currently documents as exclusive; the verifier resolves that behavior before comparing it with the required owner decision. Certificate receipt, product-code review, registration, Production configuration, and a real taxed Checkout remain open. [Stripe Tax setup](https://docs.stripe.com/tax/set-up)

New York guidance generally treats remotely accessed prewritten software as taxable. Permitext still needs professional review of its product classification, registrations, customer locations, and whether web prices are presented tax-exclusive or tax-inclusive. [New York computer-software guidance](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/computer_software.htm)

Therefore the model does **not** call 5% Permitext's sales-tax rate. It remains a downside reserve for unresolved tax-inclusive pricing, withholding, or compliance treatment. The model already adds Stripe Tax Basic's 0.5% web fee separately—$0.10 on the $20 base—so the newly verified provider fee does not change the $15.84 p90 web cost or $4.16 contribution. If the $20 web price is confirmed tax-exclusive and tax is collected on top, the collected sales tax is not Permitext revenue or expense and the separate $1 downside reserve should eventually be removed or replaced with measured administration/compliance cost. [Stripe Tax pricing](https://stripe.com/tax/pricing)

For iOS, Apple documents the customer price as inclusive of applicable taxes it collects and remits, and Partner Share as customer price minus applicable taxes and commission. Stripe automatic tax therefore remains web-only. A later authenticated read-only inspection verified that the parent app displays `App Store software` and the subscription displays `Match to parent app`. The 5% iOS reserve remains until the owner confirms that classification and actual financial reports provide measured tax and proceeds evidence. [Apple tax categories](https://developer.apple.com/help/app-store-connect/manage-app-information/set-a-tax-category) · [Apple financial report fields](https://developer.apple.com/help/app-store-connect/reference/reporting/financial-report-fields/)

### Infrastructure

Vercel currently lists Pro at $20 per month with $20 of usage credit. The owner configured a $20 on-demand amount, for approximately $40 plus tax and a possible small metering overrun. The $45 p90 model input remains a deliberately higher conservative sensitivity; it is not measured marginal usage or the current live spend setting. [Vercel Pro plan](https://vercel.com/docs/plans/pro-plan)

The August 28 live dashboard evidence confirms Vercel Pro for the current billing cycle, one included owner, $20 of monthly infrastructure credit, and the configured $20 on-demand amount. It is still not a final posted invoice or representative launch workload. The volume table therefore remains the correct no-cost planning evidence, while actual allocation stays open until customer traffic and invoices exist.

## Method

The model uses all 20 `conservativeProviderCostUSD` values from:

- `permitext-sync-server/evals/results/2026-08-28T02-26-08-632Z-edc69c6b-bf30-4856-859e-99667d03bd2b.json`

It runs 100,000 deterministic empirical-bootstrap subscriber months. Each simulated month samples V6 production turn costs with replacement until the selected allowance is fully used. The report then takes the distribution of the complete monthly total. This is the required subscriber-level aggregation; it does not multiply a single-turn p90 by 100.

The V6 cohort was deliberately difficult and all 20 answers routed directly to Terra with Luna verification. That makes it a conservative stress sample for ordinary mixed usage, but 20 cases are still too few to characterize real customer behavior. The separate grader cost is excluded because grading is a one-time evaluation expense, not a production subscriber cost.

## Planning inputs

| Cost | p50 assumption | p90 assumption | Status |
| --- | ---: | ---: | --- |
| V6 model usage | empirical aggregate | empirical aggregate | Measured in V6 |
| Vercel infrastructure | $20/month | $45/month | $20 platform fee is current; the live $20 on-demand amount produces about $40 of initial exposure, while $45 remains the conservative sensitivity |
| Fully utilized paid subscribers | 25 | 25 | Base case; 10/25/50/100 sensitivity now modeled |
| Infrastructure per subscriber | $0.80 | $1.80 | Derived from the preceding two rows |
| Support time | 10 minutes | 10 minutes | Owner-approved Beta assumption; measure after launch |
| Owner-time rate | $30/hour | $30/hour | Planning opportunity cost, not payroll |
| Refund reserve | 5% of price | 5% of price | Planning reserve; 0/1/3/5/10% sensitivity now modeled |
| Tax downside reserve | 5% of price | 5% of price | Not a tax rate; checkout configuration and treatment remain unresolved |

Channel costs use these current public terms:

- Stripe domestic online card processing: 2.9% + $0.30 per successful transaction. Stripe Tax Basic adds 0.5% on transactions where the business is registered to collect tax. Stripe says original card-processing fees are not returned on ordinary card refunds. [Stripe pricing](https://stripe.com/pricing)
- Apple's standard digital-goods commission is 30%; approved App Store Small Business Program participants receive an 85% share, before applicable taxes. [Apple membership pricing](https://developer.apple.com/programs/whats-included/), [Apple subscriptions](https://developer.apple.com/app-store/subscriptions/), [Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- Vercel Pro has a $20 monthly platform fee with a $20 usage credit. The owner configured a $20 on-demand amount beyond the credit. This model retains $45 only as a deliberately higher full-budget sensitivity. [Vercel Pro plan](https://vercel.com/docs/plans/pro-plan)

Sales tax collected from a customer is not automatically a Permitext expense. The 5% tax reserve intentionally covers unresolved tax-inclusive pricing, provider withholding, and compliance treatment until Stripe Tax and App Store tax configuration are reviewed. It is not verified as sufficient for every customer location and must be replaced rather than silently retained as a factual tax rate.

## Inputs that still block final commercial validation

- Confirm Certificate receipt, review the current Product tax code, record the applicable registration, approve exclusive or inclusive web presentation, configure the prepared automatic-tax path, and verify a real taxed Checkout. No professional approval is claimed.
- Replace the 5% refund reserve with actual/refined expected refund incidence after the lifecycle exercise and early customer data.
- Replace the modeled launch-volume scenarios with actual Vercel invoices and measured per-turn storage/compute usage after commercial hosting is active.
- Measure actual support minutes over the first 25–50 customers and revisit the longer-term $4–$6 contribution target.

One hundred turns is the retained Beta allowance. Additional-turn prices remain unpublished, and the allowance must be reviewed after the first 25–50 customers provide actual usage, support, refund, and infrastructure evidence.

## Reproduce

From `permitext-sync-server`:

```sh
npm run eval:research:subscriber-economics-v6
npm --silent run eval:research:subscriber-economics-v6 -- --json
```

Both commands read the retained V6 result only. They do not use `OPENAI_API_KEY`, make a network request, spend provider credit, or mutate commercial configuration.

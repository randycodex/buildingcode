# Permitext Beta 1 commercial configuration

This record captures owner decisions for implementation and provider setup. It is not customer-facing legal text and is not legal approval.

## Offering

- Territory: United States only.
- Free: code reading and code search remain available without a subscription.
- Pro: $20 per month, recurring monthly until canceled.
- Trial: none.
- Annual plan: none for Beta 1; reconsider only after actual Research cost and retention data exist.
- Included Research: 100 turns per UTC calendar month, subject to safety and cost guardrails.
- Additional Research: optional one-time, non-expiring turn packs, used only after included turns and shared through the Permitext account.
- Turn-pack prices and paid continuation remain unpublished until the hybrid-model benchmark contains at least 25 completed representative turns and includes payment, infrastructure, refund, tax, and support costs.

## Hybrid Research economics checkpoint — 2026-08-27

- Configuration: Luna verification with Terra answering or repair when the deterministic router identifies a complex Research question.
- Corrected approved-case sample: 6 of 6 passed at 4.00/4.00. The sample combines the unaffected passing cases from the six-case cohort with the latest corrected reruns for residential accessory classification, accessory-assembly plumbing fixtures, and the Building Code/HCR authority boundary.
- Product-model cost per completed turn: $0.052529 mean, $0.049354 p50, and $0.083626 nearest-rank p90.
- Projected product-model cost per 100 completed turns: $5.25 mean, $4.94 p50, and $8.36 nearest-rank p90.
- Answer latency: 20.0 seconds p50 and 23.5 seconds nearest-rank p90.
- One of six turns required one internal repair. Internal verification and repair remain part of the same customer turn.
- Decision: retain the $20 monthly Pro plan and its 100 included Research turns provisionally. Do not publish turn-pack prices or enable paid continuation from this six-case sample.
- Next evidence gate: collect at least 19 additional representative completed turns, preserve the approved cases as regression evidence, and calculate p50/p90 total service cost before setting pack prices.

This checkpoint is an operating-cost decision, not public Research approval or a substitute for the evaluation-governance release gates.

## V6 subscriber economics checkpoint — 2026-08-28

- The complete post-v23 V6 cohort replaces the six-case checkpoint for Research model-cost evidence: all 20 production turns completed and passed every fatal evaluation gate.
- Deterministic empirical aggregation gives a fully used 100-turn subscriber model cost of $5.74 p50 and $6.06 p90.
- The owner confirmed Permitext's 15% App Store commission, ten support minutes per subscriber at $30/hour, and a $2 minimum Beta contribution at full p90 usage.
- With explicit payment, tax, refund, and infrastructure planning reserves, 100 turns cost $15.84 p90 on web and $17.86 p90 on iOS at 15%, leaving $4.16 and $2.14 respectively. The 30% sensitivity costs $20.86.
- When the full $45 p90 infrastructure budget is allocated across only 10 fully utilized subscribers, contribution falls to $1.46 on web and -$0.56 on iOS at 15%. The $2 Beta floor first passes at 12 fully utilized web subscribers and 24 fully utilized iOS subscribers; at 50 subscribers it rises to $5.06 and $3.04.
- Refund sensitivity from 0% through 10% is now explicit. The working 5% reserve withholds $1.00 per $20 charge; at 10%, p90 contribution is $3.16 on web and $1.14 on 15%-commission iOS.
- Retain 100 included turns for Beta 1. Revisit the longer-term $4–$6 contribution target after the first 25–50 customers provide actual usage, support, refund, and infrastructure evidence.
- The no-cost source audit found that current Stripe Checkout does not enable automatic tax, declare inclusive/exclusive tax behavior, or collect/update a billing address for tax. The 5% tax line is an unresolved downside reserve, not a tax rate. Professional classification/registration direction is required before implementation.
- Actual tax configuration, expected refunds, and measured launch-volume infrastructure allocation remain unverified commercial inputs.
- Turn-pack prices and paid continuation remain unpublished and disabled.

Detailed model: [PERMITEXT_RESEARCH_SUBSCRIBER_ECONOMICS_V6.md](./PERMITEXT_RESEARCH_SUBSCRIBER_ECONOMICS_V6.md)

## Research exposure limits

- Maximum estimated request cost: $0.50.
- Maximum per user per day: $2.
- Maximum per user per month: $7, providing headroom above the $6.06 V6 p90 projection for 100 fully used turns.
- Maximum across the service per day: $10.
- Maximum across the service per month: $100.
- Emergency control: keep `PERMITEXT_RESEARCH_KILL_SWITCH=1` until the release lifecycle exercises are complete.

## Business and support

- Owner/operator: Higinio Jimenez Manzano, acting as an individual rather than through an LLC or corporation.
- Support, legal notice, and urgent alerts: `permitext@gmail.com`.
- Urgent support responder: Higinio Jimenez Manzano.
- The operator's residential address is retained as private information and must not be published in customer-facing pages.
- Governing law: New York. Dispute procedure and venue remain pending legal review.

## Refund policy working draft

- Cancel anytime; paid access continues through the current billing period.
- Every Stripe web charge, including the initial charge and renewals: full refund when requested within 72 hours.
- Search and Research usage do not change eligibility within the 72-hour window.
- Duplicate, verified unauthorized, and Permitext billing-error charges: full refund.
- No routine prorated refunds outside those cases, except where required by law or granted for a material service failure.
- Refunds return to the original payment method. A verified full refund revokes the related Pro entitlement; a partial refund does not automatically revoke it.
- Apple decides App Store refund requests and sends Permitext the authoritative refund or revocation event.
- Verified turn-pack refunds reverse the related credits. If refunded credits were already used, future purchased turns first settle the balance while monthly included turns remain available.

## Provider sequence

1. Configure Stripe live Pro Product/Price, Customer Portal, webhook, and refund/cancellation copy.
2. Configure Clerk production Apple, Google, and Microsoft sign-in plus account-linking protections.
3. Configure App Store Connect Pro subscription, United States territory, Sandbox, notifications, and TestFlight.
4. Create and approve the Research consumables in Stripe and App Store Connect, but keep paid continuation disabled until the shared-ledger lifecycle passes on both platforms.
5. Configure Vercel production environment variables, alerts, release diagnostics, and Research safeguards.
6. Confirm DNS for Clerk and all public policy/support URLs.
7. Run sandbox lifecycle tests, then request immediate approval before any controlled live charge or refund.

## Vercel production configuration recorded 2026-08-21

- The Apple App Store JWS root-fingerprint variable is present in Vercel **Production only** and marked Sensitive. It is not attached to Preview.
- Vercel confirmed that the environment-variable change requires a new deployment; no redeploy or Production change was made during configuration.
- The Permitext team is still on Hobby and the dashboard reports 7h 8m Fluid Active CPU against the 4h included allowance.
- Public launch is blocked until the team is on a commercial Vercel plan. Initial recommendation: Pro at the current $20 monthly platform fee, then a $10 on-demand spend amount beyond the included Pro credit, notifications at 50%, 75%, and 100%, SMS at 100%, and automatic Production pause at 100%. Because threshold checks are periodic and fixed fees, seats, integrations, and add-ons are excluded, approximately $30 plus tax and a possible small metering overrun is the initial exposure—not an exact hard ceiling. The earlier $45 p90 infrastructure allocation remains a conservative subscriber-economics sensitivity, not the recommended live spend setting.
- The August 28 live billing review found that Speed Insights Plus on `punchlist-pwa` would have added $10 per month to the team upgrade. The owner approved downgrading that project to basic Speed Insights; Vercel confirmed its Plus renewal was canceled, while the latest PunchList Production deployment remained `READY`.
- After the downgrade, every paid add-on was unchecked and Vercel displayed an immediate recurring Pro checkout total of $20 per month for one included owner, with $20 of usage credit. No payment method was added, the Upgrade action was not submitted, and the team remains on Hobby.
- Preview currently shares the Production database, so Preview is not an isolated identity, entitlement, or billing test environment.

## Stripe production configuration recorded 2026-08-21

- Product: `prod_UxQtQBgG92aEwz` (`Permitext Pro`).
- Active default recurring price: `price_1U72hfEp1wz0lmSd9yBTRWez`, USD $20 per month.
- The former USD $15 monthly price is archived and had no active subscriptions when archived.
- Trials remain disabled.
- Product checkout description includes the 100-Research-turn monthly allowance.
- Production webhook destination: `we_1TxWAMEp1wz0lmSdzOZWhqLG` at `https://permitext.com/billing/stripe/webhook`.
- Webhook event coverage: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, and `charge.refunded`.
- Vercel Production `STRIPE_PRO_PRICE_ID` was updated to the new $20 price. A new deployment is still required before the serving application uses the updated environment value.

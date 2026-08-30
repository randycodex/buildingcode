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
- The no-cost source audit originally found that Stripe Checkout did not enable automatic tax, declare inclusive/exclusive tax behavior, or collect a billing address for tax. The local implementation now has a dormant automatic-tax path: when explicitly configured, subscription Checkout sends `automatic_tax[enabled]=true` and requires a billing address. Production fails closed while the mode or Price tax behavior is unconfigured, and the live readiness audit rejects a Stripe Price whose resolved behavior does not match the explicit local decision. For the current USD Price, the verifier resolves Stripe's documented `Default (inferred by currency)` behavior to `exclusive`; no replacement Price is required solely for that label. No live Stripe setting, Price, registration, deployment, or customer charge changed.
- `PERMITEXT_STRIPE_TAX_MODE=automatic` is the only supported Production mode. `PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR` must separately be `exclusive` or `inclusive`. `exclusive` means applicable tax is added above the $20 base price; `inclusive` means applicable tax is absorbed inside the displayed $20 price and therefore reduces retained revenue. This owner/economics choice remains open until tomorrow; neither value is set in Production. The prepared recommendation is recorded in [BETA1_STRIPE_TAX_DECISION_RECORD.md](./BETA1_STRIPE_TAX_DECISION_RECORD.md).
- This source guard does not prove that New York registration is active, select the Stripe Product tax code, create a Stripe Tax registration, decide where Permitext has collection obligations, or verify a real taxed Checkout. Those remain provider/owner acceptance items after the Certificate of Authority arrives. The 5% tax line remains an unresolved downside reserve, not a tax rate.
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

No-cost verification: [PERMITEXT_BETA1_SEVEN_DOLLAR_GUARDRAIL_EVIDENCE_2026-08-28.md](./PERMITEXT_BETA1_SEVEN_DOLLAR_GUARDRAIL_EVIDENCE_2026-08-28.md)

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

## Vercel production configuration recorded 2026-08-21 and 2026-08-28

- The Apple App Store JWS root-fingerprint variable is present in Vercel **Production only** and marked Sensitive. It is not attached to Preview.
- Vercel confirmed that the environment-variable change requires a new deployment; no redeploy or Production change was made during configuration.
- The August 21 review found the team on Hobby with 7h 8m Fluid Active CPU against the 4h included allowance. On August 28, the owner personally submitted the Vercel upgrade and the live dashboard confirmed the team is on Pro for the August 28–September 28, 2026 billing cycle.
- The recurring Pro platform fee is $20 per month for the included owner and includes $20 of monthly infrastructure credit. Checkout estimated $1.78 of tax, while the post-upgrade dashboard currently shows a $20 upcoming invoice; the final posted tax and invoice total remain unverified.
- The owner increased the intended on-demand amount from the earlier $10 recommendation to $20. The live billing page now retains a $20 on-demand spend amount beyond the included credit, automatic pausing of all Production deployments on the team when that amount is reached, and spend notifications enabled. Vercel's standard web/email thresholds are 50%, 75%, and 100%; SMS enrollment was not changed.
- The resulting initial planning exposure is approximately $40 plus tax and a possible small metering overrun: the fixed $20 Pro platform fee plus up to $20 of on-demand metered usage. It is not an exact hard ceiling because Vercel evaluates usage periodically, and seats, integrations, add-ons, and other excluded charges are outside Spend Management. The earlier $45 p90 infrastructure allocation remains a conservative subscriber-economics sensitivity, not the live spend setting.
- The August 28 live billing review found that Speed Insights Plus on `punchlist-pwa` would have added $10 per month to the team upgrade. The owner approved downgrading that project to basic Speed Insights; Vercel confirmed its Plus renewal was canceled, while the latest PunchList Production deployment remained `READY`.
- After the downgrade, every paid add-on remained unchecked. AI Gateway auto-reload and Vercel Agent usage billing also remain off; the existing $5 AI Gateway credit is separate from the Pro infrastructure credit. Observability Plus is included with Pro rather than a paid add-on.
- The spend amount and automatic-pause settings were saved through Vercel's team-name confirmation and independently reloaded. The dashboard then showed `$0 / $20`, `Notifications: On`, and `Pause Projects: On`. No threshold was intentionally reached, so delivered notification and actual 503 pause behavior remain unexercised production gates.
- Two included alert rules are active only for `permitext-sync`: production 5xx anomalies and production infrastructure-usage anomalies. Owner email and web subscriptions are checked for both. Vercel rejected the planned health, billing, 5xx-rate, and Research-p95 custom thresholds because the team currently has a zero custom-alert limit; no paid add-on or plan change was attempted. No alert was deliberately triggered, so delivery and the remaining warning-specific coverage stay open. Detailed evidence: [PERMITEXT_VERCEL_ALERT_CONFIGURATION_2026-08-28.md](./PERMITEXT_VERCEL_ALERT_CONFIGURATION_2026-08-28.md).
- Preview currently shares the Production database, so Preview is not an isolated identity, entitlement, or billing test environment.

## Stripe production configuration recorded 2026-08-21

- Product: `prod_UxQtQBgG92aEwz` (`Permitext Pro`).
- Active default recurring price: `price_1U72hfEp1wz0lmSd9yBTRWez`, USD $20 per month.
- The former USD $15 monthly price is archived and had no active subscriptions when archived.
- Trials remain disabled.
- Product checkout description includes the 100-Research-turn monthly allowance.
- An August 30 read-only dashboard recheck found that the active $20 Price still reports `Tax behavior: Default (inferred by currency)`. Stripe's official setup documentation says the inferred behavior is exclusive for USD. The source guard therefore keeps Production deployment blocked until the owner records an explicit decision, then verifies that decision against the resolved provider behavior without requiring a replacement $20 Price.
- The Product currently uses Stripe tax code `txcd_10000000`, shown as `General - Electronically Supplied Services`. Stripe displays its own warning to review that preset category against what Permitext sells; the code is recorded as current provider state, not accepted tax classification.
- The Stripe Tax collecting-locations view showed no live transactions and no collecting-location row. That view also states it does not track the home jurisdiction, so it is not treated as proof that New York registration is absent or complete. Certificate receipt, provider registration, and a real taxed Checkout remain open.
- Stripe Tax Basic currently lists a 0.5% fee for Billing/Checkout transactions where tax is collected, approximately $0.10 on a $20 base transaction before any effect of tax on the charged total. The V6 subscriber model already includes this as a separate web cost in addition to its $1 tax downside reserve, so the verified fee does not change the $15.84 p90 web cost or $4.16 contribution. Both inputs must eventually be reconciled to actual invoice and tax-treatment evidence.
- Production webhook destination: `we_1TxWAMEp1wz0lmSdzOZWhqLG` at `https://permitext.com/billing/stripe/webhook`.
- Webhook event coverage: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, and `charge.refunded`.
- Vercel Production `STRIPE_PRO_PRICE_ID` was updated to the new $20 price. A new deployment is still required before the serving application uses the updated environment value.

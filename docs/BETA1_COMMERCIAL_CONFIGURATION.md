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

## Research exposure limits

- Maximum estimated request cost: $0.50.
- Maximum per user per day: $2.
- Maximum per user per month: $5.
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
- Public launch is blocked until the team is on a commercial Vercel plan. Initial recommendation: Pro at the current $20 monthly platform fee, then a $25 on-demand spend amount with notifications and automatic Production pause at 100%.
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

# Permitext Beta 1 Production deployment — September 2, 2026

Status: **DEPLOYED AND VERIFIED; PUBLIC-BETA ACTIVATION STILL GATED**

## Exact release

- Git branch promoted: `codex/zoning-research-beta1`
- Exact Git commit: `cb7918b453988a07d57a7834f5982d523d0e3901`
- `origin/main`, the feature-branch remote, and the selected release commit matched at promotion.
- Vercel deployment ID: `dpl_2i2iRQjwqkuQaQChbzR5MGh6j8EW`
- Immutable deployment: `https://permitext-sync-911xzblkc-randycodexs-projects-b72fc111.vercel.app`
- Production aliases: `https://permitext.com`, `https://www.permitext.com`, and `https://permitext-sync.vercel.app`

The first Git-triggered Production build for this same commit failed closed before publication because `PERMITEXT_RESEARCH_USER_MONTHLY_CAP_USD` did not equal the approved `$7` Beta ceiling. No Production alias changed. The hidden value was updated to `7`, and Vercel rebuilt the same Git commit. No customer price, 100-turn allowance, system-wide `$100` monthly cap, or Research public-enablement state changed.

## Protected build result

The successful Production build independently reported:

- complete commercial configuration;
- live, active, recurring Stripe Pro Price at `$20` per month;
- Stripe automatic tax with approved exclusive behavior;
- enabled Stripe webhook with every required event present;
- exact `$7` per-user and `$100` system monthly Research cost caps;
- production release identity bound to the exact Git commit; and
- accepted monitoring marker present.

No secret value, customer identifier, payment credential, or policy body is retained in this record.

## Live post-deployment verification

At approximately 7:04 PM EDT:

- `/release` reported Production commit `cb7918b453988a07d57a7834f5982d523d0e3901` and deployment host `permitext-sync-911xzblkc-randycodexs-projects-b72fc111.vercel.app`;
- `/health` returned HTTP 200 with `ok: true`, PostgreSQL storage and rate limiting, schema `normalized-v4`, complete commercial and Clerk configuration, and monitoring provider `vercel-observability-daily-review`;
- the approved Terms, Privacy, and subscription/refund routes each returned HTTP 200 and exactly matched the retained SHA-256 digest for its owner-approved artifact;
- the AASA route returned the approved app identifier and `/open/section/*` universal-link binding;
- `/`, `/code/libraries`, `/open/section/1026`, `/web/app.js`, `/support`, `/terms`, `/privacy`, and `/refunds` all returned HTTP 200; and
- the privacy-bounded post-deployment log audit parsed five Production entries, observed two healthy requests, found zero invalid lines and zero actionable server, billing, client, database, Research, spend, or latency categories.

## Boundaries and next gate

This proves merge, deployment, exact release identity, policy publication, public content routing, monitoring marker, and an initially clean Production log window. It did not by itself prove a real taxed Checkout/refund, fresh and existing account acceptance, account export/deletion, a final Production-targeted TestFlight build, physical-iPhone behavior, or public-Beta owner go/no-go.

The browser account available immediately after deployment already showed Pro status, so it was not used to create another subscription. Later on September 2, the owner selected a dedicated Free account, personally entered payment information, and completed the separately authorized controlled real Stripe lifecycle. That follow-up passed on this exact deployment and is retained in [the Production Stripe lifecycle evidence](./PERMITEXT_BETA1_PRODUCTION_STRIPE_LIFECYCLE_2026-09-02.md).

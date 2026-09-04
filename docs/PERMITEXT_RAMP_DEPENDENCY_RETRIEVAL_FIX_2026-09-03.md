# Ramp dependency retrieval correction — September 3, 2026

## Scope and cause

The [build-52 controlled live result](./PERMITEXT_BUILD52_RAMP_LIVE_TEST_2026-09-03.md) remains immutable: one saved answer in 34.9 seconds, but incomplete landing/handrail evidence. The six generic cross-reference slots could be consumed before reaching available dimensional provisions. The previous shorter-question regression did not cover the exact authorized wording.

This local correction adds an edition-bound dependency pass after ordinary discovery. It stores only reviewed section identities and purposes—not answer prose or numeric requirements—and resolves every passage from the authorized enacted corpus. Reference basis: [NYC DOB 2022 Building Code Chapter 10](https://www.nyc.gov/assets/buildings/apps/pdf_viewer/viewer.html?file=2022BC_Chapter10_EgressWBwm.pdf&section=conscode_2022).

## Changed behavior

- Activate only for a broad pedestrian-ramp design/requirements question with independently retrieved BC 1012.2, 1012.6 and 1012.8 anchors in one positively identified 2022 NYC corpus. Do not broaden pinned evidence, older-edition questions, vehicular/construction/curb-ramp questions, or missing-identity evidence.
- Preserve BC 1012.6.1–1012.6.5 (landing dimensions and door relationships), 1014.2/1014.6/1014.7 (handrail dimensions), 1012.7.2 (outdoor conditions), 1012.10.1 (edge protection), 1012.5.2/1012.5.3/1020.2 (egress dimensional dependencies), and 1012.9 (guard scoping).
- Require full passage text, matching code prefix/section and edition/version/corpus/jurisdiction. Never truncate a newly added rule away from its exceptions. Missing, mismatched, shortened, or budget-excluded dependencies leave an explicit coverage gap.
- Mark complete dependency passages for mandatory exact-passage citation coverage. The existing independent verifier still checks substantive rule/exception coverage; supplying more evidence does not itself establish answer quality.
- Allow at most 14 added dependency passages and two ordinary opportunistic cross-references for this route. Other routes retain their existing cross-reference limit. Global 48,000-character ceilings, per-passage ceiling, provider cost controls, answer schema, model selection, verification, and user allowance remain unchanged.

This is practical baseline coverage, not the entire ICC A117.1 standard, every handrail detail, or a complete guard-design analysis. Detailed guard sections were not added merely to expand the package. Referenced-standard and project-specific gaps must still be stated honestly; no code text is inferred from model memory or screenshot answers.

## Offline verification

- Full shipped 2022 corpus: exact live question plus three wording variants retrieve all 14 reviewed dependencies, preserve the canonical text and exceptions, and enforce required citation coverage.
- Adversarial checks cover unavailable BC 1014.6, wrong-edition results, absent canonical identity fields (which may not be filled from the request), restricted source/character budgets, other ramp types/editions, and pinned evidence. A section recovered during generic expansion is removed from the final missing-dependency list and receives mandatory coverage.
- Request preflight executes the actual answer/verifier builders up to, but never including, provider dispatch. It includes the actual deterministic evidence analysis, mandatory-claim checklist, and routed code-basis metadata. Its network/provider stubs refuse dispatch.
- Exact-question conservative answer reservation: **$0.450005**; a separate synthetic 29-fact Project fixture: **$0.460580**; both fit the unchanged **$0.50** fixture cap. These are conservative offline reservations, not measured API cost.
- A synthetic settled web request plus the full answer reservation totals **$0.490265**. A separate synthetic settled answer plus Luna verifier reservation totals **$0.206554**. Unreconciled duplicate web requests and an oversized Terra web request remain blocked.
- Pricing and limits are versioned local fixtures, not a fresh Production configuration audit. Arbitrary prior chat, returned web claims, original private Project context, revisions, live latency, and live answer quality are not accepted by these tests.

Focused ramp, complete Research-chat regressions, and `npm run check` pass. The seven-conversation/nine-turn owner-example runtime was also rerun after the final identity check: zero network attempts and zero paid calls. PostgreSQL rate-limit integration skipped because no database URL was configured; this is not a live database or Production acceptance claim.

## Release boundary and next action

The initial local correction did not authorize publication or a new paid call. The owner subsequently answered yes to merging, pushing, and deploying this backend-only fix, expressly excluding another paid Research test or TestFlight upload. The build-51 and build-52 live-test authorizations remain consumed.

## Separately authorized Production publication

- Released source: `573d4bc1aba839ad050125d12350769956c823c7`. Local `main`, `origin/main`, and a fresh GitHub `ls-remote` check match exactly. Integration was a fast-forward; unrelated dirty Xcode files and untracked owner files remain untouched.
- Vercel Git integration created Production deployment `dpl_GvXhVjAL7MqnkW4BtchPf2Xk2Uh7`, now **READY**, at `https://permitext-sync-khpn7qrjz-randycodexs-projects-b72fc111.vercel.app`.
- Created `2026-09-04T00:03:39.716Z`; building began `00:03:40.933Z`; READY `00:05:46.170Z` (September 3 local time). Build output reports 32 seconds; creation-to-READY was approximately 126 seconds. Node.js backend, Node 24 project setting, no framework preset.
- Protected build passed commercial configuration, live Stripe settings, exact release identity, and the existing external-monitoring configuration. No environment variable, spending cap, model, price, allowance, kill switch, or Zoning gate was changed.
- Both `https://permitext-sync.vercel.app/release` and `https://permitext.com/release` return HTTP 200, the exact released SHA, and environment `production`.
- `npm run verify:production` passes on both origins: PostgreSQL `normalized-v4`, commercial readiness, and live Clerk configuration. AASA passes with the exact native app ID and section-link route. All three approved policy hashes pass strict live publication checks on both origins.
- The deployment-scoped error/fatal scan from READY through `2026-09-04T00:06:47.651Z` returned no matching logs. This is a short early observation, not full live Research acceptance or a claim about future errors.
- Vercel reports no configured drains. The previously owner-accepted Vercel-alert/daily-review alternative remains the monitoring basis; the protected build confirms its configured marker. This turn did not independently test alert delivery or the next scheduled daily review.
- No Research question, retry, purchase, subscription change, TestFlight upload, or public-Beta activation was performed. The existing installed build 52 uses the updated backend without a new binary. Generated answer quality and the original private Project-context scenario were not live-retested.

Next: any live answer confirmation still requires a separate exact authorization. Do not automatically prepare or run another paid batch. The existing medium-severity Tiptap advisory remains a separate scoped follow-up, not fixed by this release.

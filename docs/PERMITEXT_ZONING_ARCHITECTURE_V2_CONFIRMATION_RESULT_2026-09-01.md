# Permitext Zoning Architecture V2 — Confirmation Result

Date: September 1, 2026

Run ID: `9f67f4ba-3944-46a4-b438-fcec082144e3`

Authorized package: `3b5db112271da5d015dd84793b5331c59ec0a467`

Execution commit: `fffd5c58c8b781bd9e322bdfad421ab2a65450e3`

Status: **ALL 30 ORDERED CASES ATTEMPTED ONCE; COMPLETION AND COST IMPROVED; QUALITY GATE NOT CLEARED; AUTHORIZATION CONSUMED; NO RETRY AUTHORIZED**

## Direct answer

Architecture V2 materially improved completion and preserved fail-closed behavior, but it is not reliable enough for public Beta 1 Zoning Research yet.

All 30 frozen cases reached exactly one terminal operation in order. Six cases correctly stopped before model use because controlling property, map, district, or historical facts were missing. Of the 24 generation-ready cases, 21 produced customer-shaped answers and three were blocked by deterministic verification after their one permitted source-bounded repair. The independent Terra judge passed 16 of the 21 delivered answers; 15 received `4.00/4.00`, one passed its required rubrics at `3.68/4.00`, and five failed material quality gates.

Compared with Architecture V1, completed answers increased from 14 to 21 and verifier blocks fell from 11 to three. Passing answers increased from 12 to 16, but the pass rate among delivered answers fell from `85.7%` to `76.2%`. The redesign is a real improvement, not a completed reliability solution.

## Terminal outcomes

| Outcome | Count | Interpretation |
| --- | ---: | --- |
| Delivered answers passing every required rubric | 16 | 15 full-score answers plus one required-rubric pass at `3.68/4.00` |
| Delivered quality failures | 5 | Reached judging but failed at least one critical semantic gate |
| Deterministic verifier blocks | 3 | Provider work settled, but no customer answer and no turn charge |
| Prerequisite boundaries | 6 | Rejected before provider access, with no customer answer and no turn charge |
| Total ordered operations | 30 | Complete cohort order, one repetition, no duplicates |

The delivery rate was `87.5%` of the 24 generation-ready cases. Sixteen of 21 delivered answers passed (`76.2%`), and 16 of 24 generation-ready cases both completed and passed (`66.7%`). Counting the six correct prerequisite boundaries, 22 of 30 cases had an acceptable terminal outcome (`73.3%`).

The three verifier-blocked cases were:

- `zr-r7a-lot-coverage`: the repair still failed to preserve the numerical-cap boundary and independently applicable yard, open-area, and bulk constraints;
- `zr-inner-transit-zone-new-unit-parking`: the repair still omitted the exact December 5, 2024 effective-date tie;
- `zr-cellar-floor-area-definition`: the repair still failed to keep the lowered-yard measurement condition unresolved and explicit.

The five judged failures were:

- `zr-candidate-b1-deep-through-lot-vertical-yard`, `3.82/4.00`: one required concept and material measurement/obstruction uncertainty were missing;
- `zr-candidate-b1-mx-nonadditive-far`, `3.81/4.00`: the answer omitted the explicit manufacturing-component FAR and square-foot checks;
- `zr-candidate-b1-r7a-r8a-weighted-far`, `3.16/4.00`: the answer incorrectly suggested the wide-street allocation exception could change the definite total-FAR overage;
- `zr-candidate-b1-c6-2-office-residential-conversion`, `3.03/4.00`: citation-role errors and unjustified approval language overstated a preliminary density calculation;
- `zr-candidate-b1-city-of-yes-transition`, `2.69/4.00`: the answer missed the supplied transition route matching the November 20, 2024 filing and therefore reached an unsupported categorical conclusion.

## Cost and routing ledgers

| Ledger | Requests | Tracked USD | Pending |
| --- | ---: | ---: | ---: |
| Production answers, verification, and bounded repairs | 44 | `$0.994388` | 0 |
| Evaluation-only Terra judge | 22 | `$0.525037` settled | 1 reservation |
| Combined diagnostic | 66 | `$1.519425` settled | 1 reservation |
| Fail-closed conservative upper | 66 | `$1.659459` | included |

The conservative upper stayed `$3.340541` below the authorized `$5` cap. The one unresolved judge reservation is retained as a `$0.140034` conservative difference; it is not treated as free or silently discarded. The execution made no additional request after the result was saved.

Completed Production turns averaged `$0.041198`; p50 was `$0.035020`, p90 was `$0.093999`, and the maximum was `$0.102250`. Failed Production work cost `$0.129233`. Amortizing all Production work across 21 completed turns gives `$0.047352` per completed turn, or `$4.74` per 100 completed turns. The sample clears the existing `$4–$6` model-cost target, but this does not authorize a price, allowance, or public-release decision.

Completed-turn latency was `16.374s` p50, `51.748s` p90, and `57.418s` maximum. Nine of 21 delivered turns required the one permitted repair (`42.9%`), so first-answer compliance remains a material reliability and latency problem. Only one bounded Luna-first turn escalated to Terra; complex paths otherwise started on Terra as planned. Web support and the 24,000-character evidence candidate remained disabled, and no full-answer rewrite ran.

## Safety, charging, and one-use integrity

- every prerequisite boundary recorded `status: rejected`, `charged: false`, zero provider requests, and zero pending operation requests;
- every verifier block recorded `status: failed`, `RESEARCH_VERIFICATION_FAILED`, `charged: false`, settled provider work, and zero pending operation requests;
- only the 21 completed and saved answers recorded `charged: true`;
- all 30 cases were attempted once in the frozen order;
- public Research, deployment, professional sign-off, pricing or allowance changes, web support, and the 24,000-character candidate remained unauthorized;
- the initial isolated-worktree launch stopped during module loading before evaluation code or provider access because package-lock dependencies were not installed; manual review proved zero result and zero API spend, after which the exact locked dependencies were installed and the first actual provider run proceeded;
- automatic authorization consumption stopped after the saved run because one judge reservation remained unreconciled. Manual fail-closed review retained the conservative upper below the cap, marked the one-use authorization consumed, and forbids retry.

## Evidence and integrity

- [machine result](../permitext-sync-server/evals/results/2026-09-01T16-49-32-263Z-9f67f4ba-3944-46a4-b438-fcec082144e3.json), SHA-256 `06af0893b2dc201f12c48a405accaf5b6262f72aeaa67014013de89c7b9ece44`
- [review report](../permitext-sync-server/evals/results/2026-09-01T16-49-32-263Z-9f67f4ba-3944-46a4-b438-fcec082144e3.md), SHA-256 `91bcefe323918e20ca11acf1d57ad758008f83f5a405d87db6e3488347172128`
- consumed authorization SHA-256: `275dbe7be87b74a02fc6ab2c7b99b48efbaf339a57984bbabc427a2c0376ea42`
- raw-evidence commit: `425c14e6b2b0fc3819b045ce4d0b0b9d720bfec2`

The no-cost consumed-state guard binds the exact authorization, result files, run ID, execution commit, ordered operation count, outcome counts, settled and conservative cost ledgers, pending-reservation count, and failed/rejected charging rules. It also proves that the consumed authorization cannot dispatch again.

## Controlling decision

Do not run another paid confirmation now. The next work is no-cost and narrow: compile the eight observed verifier/judge failures into first-answer obligations and regression fixtures, reduce the `42.9%` repair rate, and rerun the complete deterministic 30-case/adversarial gate. Public Zoning Research remains disabled until a later architecture clears semantic reliability, professional review, exact-release web/iOS presentation, physical-iPhone acceptance, and final owner release approval.

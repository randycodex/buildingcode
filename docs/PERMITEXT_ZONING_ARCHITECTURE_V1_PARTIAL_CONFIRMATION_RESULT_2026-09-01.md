# Permitext Zoning Architecture V1 — Partial Confirmation Result

Date: September 1, 2026

Run ID: `4381fd0a-f719-4e86-b231-972b299e6a57`

Authorized package: `cec4eed3ab89ca235dfd25544dedf5b28a067801`

Execution commit: `a63020a713ef7757c81f3eb9f49eef5617850e52`

Status: **TERMINAL PARTIAL; AUTHORIZATION CONSUMED; NO RETRY AUTHORIZED**

## Outcome

The exact owner-authorized Architecture V1 replacement ran once under the 30-case, one-repetition, `$5` cumulative cap. It preserved the exact cohort order, disabled web support and the 24,000-character candidate, and settled every paid request. Cases 1 and 2 completed on Luna and each passed the separate Terra judge at `4.00/4.00`. Case 3 correctly failed before generation because the controlling official map or verified mapped-district status was missing; it was uncharged and made zero provider requests.

The run then stopped instead of continuing through the remaining deterministic-boundary cases. Production records that pre-generation outcome as `status: rejected`, while the confirmation harness accepted the exact `RESEARCH_ZONING_PREREQUISITES_REQUIRED` continuation only when status was `failed`. This is a runner/harness contract defect, not a model-quality failure, corpus drift, rubric change, or weakening of the prerequisite boundary.

## Retained results

- ordered operations retained: `3/30`
- completed and graded: `2`
- graded passes: `2/2`, both `4.00/4.00`
- deterministic prerequisite boundaries: `1`, uncharged, zero provider requests
- unattempted cases: `27`
- Production answer model: Luna for both completed answers; no answer-model escalation
- judge model: Terra for both completed answers
- web support: disabled
- public release, deployment, pricing/allowance changes, and 24,000-character candidate: unauthorized

The two-answer result is not sample-ready and cannot establish 30-case semantic quality, completion reliability, p50/p90 economics, or readiness for pricing/public release.

## Settled cost ledgers

| Ledger | Requests | Actual USD | Pending |
| --- | ---: | ---: | ---: |
| Production answer/verification | 3 | `$0.007282` | 0 |
| Evaluation-only Terra judge | 2 | `$0.027438` | 0 |
| Combined diagnostic | 5 | `$0.034720` | 0 |

The combined spend was below the authorized `$5` cap. The evaluation-only judge cost remains separate from Production operating cost. The snapshot's `$0.36` per-100 Production extrapolation is based on only two completed turns and is explicitly not sample-ready or a pricing decision.

## Evidence and integrity

- [machine result](../permitext-sync-server/evals/results/2026-09-01T13-08-16-791Z-4381fd0a-f719-4e86-b231-972b299e6a57.json), SHA-256 `ce98f26f6856b64d2483b9c0047a8d577bde86c8e9734af61a37849294c125f1`
- [review report](../permitext-sync-server/evals/results/2026-09-01T13-08-16-791Z-4381fd0a-f719-4e86-b231-972b299e6a57.md), SHA-256 `ec97efbd6dc277d2a986b06ae12aaad1aac05622baf60205cb7c73aec4397d3b`
- consumed authorization SHA-256: `56fdf3442620b6032b0ce3267e3ea28a17f07ab4b7feed761c7ae5008087175c`
- retained-evidence commit: `497efa362749e8e975a103ef76fd82d60304831d`

All operations are an ordered prefix of the frozen cohort. The terminal prerequisite operation recorded `charged: false`, `providerRequestCount: 0`, and `pendingProviderRequestCount: 0`. The full run recorded five paid requests, `$0.034720` actual and conservative cost, and zero pending requests.

## No-cost successor repair

Exact successor package `6f222ac1a0d5375cef14a3f10299d8b8e06b9112` recognizes continuation only for either:

1. an uncharged `failed` `RESEARCH_VERIFICATION_FAILED` operation with at least one settled provider request; or
2. an uncharged `rejected` `RESEARCH_ZONING_PREREQUISITES_REQUIRED` operation with zero provider requests.

Both require zero pending requests and intact telemetry. Charged operations, provider failures, altered statuses/codes, nonzero prerequisite requests, pending requests, aborts, spend-cap stops, and telemetry failures remain terminal. Focused tests and the complete `npm run check` pass with credentials removed and no additional provider call. The new authorization is locked and requires a fresh exact-package owner sentence before any successor run.

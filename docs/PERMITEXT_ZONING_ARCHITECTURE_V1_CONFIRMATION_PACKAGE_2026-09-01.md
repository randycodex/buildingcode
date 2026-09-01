# Permitext Zoning Architecture V1 — Consumed Successor Confirmation Package

Date: September 1, 2026

Working branch: `codex/zoning-research-beta1`

Package commit: `6f222ac1a0d5375cef14a3f10299d8b8e06b9112`

Status: **CONSUMED; COMPLETE ORDERED EXECUTION RETAINED; NO RETRY AUTHORIZED**

## Outcome

The owner authorized this exact package once. Execution commit `5e3263505a33c2dff2055558be19e274aab5d36a` produced complete ordered [run `90f42d5b-b758-4df4-98af-933350f036e7`](./PERMITEXT_ZONING_ARCHITECTURE_V1_CONFIRMATION_RESULT_2026-09-01.md): all 30 frozen cases were attempted exactly once, 12 answers passed every gate at `4.00/4.00`, two delivered answers failed quality, 11 generation-ready answers failed bounded verification without a customer charge, and five prerequisite cases rejected before provider access. Production and separate Terra-judge spend totaled `$0.391986` with zero pending. The continuation repair worked; semantic and reliability confirmation failed. Authorization `048cb366-4332-4379-9dbc-62feb3fe7224` is consumed and cannot be reused.

The substantial Zoning Research redesign is implemented and its frozen 30-case no-cost gate passes. The live Research path now selects one of six question-specific paths, assembles a narrow evidence package for that path, checks prerequisites before generation, runs deterministic table/symbol/date/arithmetic controls where applicable, routes Luna first, and permits Terra only for provider failure or a separately authorized narrow repair. A failed deterministic or bounded verification gate does not trigger a full-answer rewrite.

The owner authorized predecessor package `3a3cad04d7799da906a5484af981aea5bf014ef2` exactly. Execution commit `cb33a96134a2a8121995c34372519557920ea24d` stopped before provider access because the validator omitted the bound cohort path; it made zero provider requests and spent `$0`. That authorization was not transferred. The owner then exactly authorized repaired package `cec4eed3ab89ca235dfd25544dedf5b28a067801`. [Run `4381fd0a-f719-4e86-b231-972b299e6a57`](./PERMITEXT_ZONING_ARCHITECTURE_V1_PARTIAL_CONFIRMATION_RESULT_2026-09-01.md) retained three ordered operations: two Luna answers passed the separate Terra judge at `4.00/4.00`, then the intended uncharged zero-request prerequisite rejection stopped the harness because its continuation check expected status `failed` rather than Production's deterministic status `rejected`. All five paid requests settled for `$0.034720` with zero pending. Its authorization is consumed.

Successor package `6f222ac1a0d5375cef14a3f10299d8b8e06b9112` changes only the bounded continuation contract: an exact uncharged zero-request `rejected` prerequisite boundary may continue, while verification failures still require `failed` status and paid settled work. Every other failure remains terminal. The frozen architecture, cohort, evidence, routing, safety, cap, and release boundaries are unchanged.

This package does not enable public Zoning Research. Zoning Reader and Search remain available separately. The `$20` Pro price and 100-turn allowance are unchanged, the global 24,000-character candidate remains disabled, and no merge, push, deployment, Production configuration, or App Store/TestFlight state changed.

## Immutable package identity

- architecture implementation commit: `3f72999be05ebfbababe55ba0a2a9c48052738cb`
- complete locked successor package commit: `6f222ac1a0d5375cef14a3f10299d8b8e06b9112`
- successor authorization ID: `048cb366-4332-4379-9dbc-62feb3fe7224`
- locked successor authorization SHA-256: `f36c09e48fb6f60d58a34d4d392b6aea63349bb1e21e6b06ac34953668ce40f4`
- consumed successor authorization SHA-256: `74161dd63bc0f29487c1fb0bf5be62329226e9c43c1b9ea5a324fb1d2b143b2e`
- successor execution commit: `5e3263505a33c2dff2055558be19e274aab5d36a`
- successor run: `90f42d5b-b758-4df4-98af-933350f036e7`; 30 ordered operations, 12 full-score passes, two graded failures, 11 verifier blocks, five prerequisite boundaries, `$0.391986`, zero pending
- consumed partial package: `cec4eed3ab89ca235dfd25544dedf5b28a067801`
- consumed partial execution commit: `a63020a713ef7757c81f3eb9f49eef5617850e52`
- consumed partial run: `4381fd0a-f719-4e86-b231-972b299e6a57`; 3 ordered operations, 2/2 passes, `$0.034720`, zero pending
- superseded authorized package: `3a3cad04d7799da906a5484af981aea5bf014ef2`
- superseded authorization ID: `d79db463-bc42-47c6-9e74-5931875cab50`
- superseded execution commit: `cb33a96134a2a8121995c34372519557920ea24d`
- superseded attempt: zero provider requests, `$0` actual spend, authorization never consumed
- frozen ordered cohort SHA-256: `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`
- no-cost result SHA-256: `0c1337c26c237f774d7320cc95bb034f2b6bb6e6f6a6a19016814d141b6b5c88`
- planned confirmation scope: all 30 ordered cases, one repetition, maximum cumulative API spend of `$5`
- web support: disabled
- public release, deployment, pricing/allowance change, and 24,000-character candidate: unauthorized

The machine-readable consumed record is [zoning-architecture-v1-confirmation-paid-authorization.json](../permitext-sync-server/evals/zoning-architecture-v1-confirmation-paid-authorization.json). Its validator rehashes the architecture inputs, frozen cohort, no-cost result, consumed V17 lineage, prior partial result, and exact complete successor result/report. It verifies the terminal outcome and cost counts and blocks re-dispatch.

## Frozen no-cost result

The retained local preflight passed all 30 cases with zero paid/model/network calls:

- path mix: 7 direct-rule, 4 definition/cross-reference, 2 structured-table/symbol, 4 effective-date/history, 5 property/map/applicability, and 8 calculation/scenario cases;
- disposition: 25 generation-ready cases and 5 deterministic prerequisite-boundary cases; none required a model call before missing prerequisites were reported;
- projected provider requests: p50 `1`, p90 `2`, maximum `2` per case;
- mechanically projected production cost: `$0.181790` per 100 nominal and `$0.245430` per 100 adverse;
- judge ledger: `$0`, recorded separately because no semantic judge ran;
- disabled 24,000-character candidate: unchanged and not used.

These figures are deterministic planning projections, not a semantic-quality acceptance result and not measured Production economics. They clear the requested no-cost architecture gate for preparing this package; only a separately authorized confirmation can measure the new live model path.

## Pre-run verification

The following passed with paid-evaluation credentials removed against the exact server bytes retained in successor package commit `6f222ac1a0d5375cef14a3f10299d8b8e06b9112`:

- `npm run test:zoning-architecture-v1`
- `npm run test:zoning-architecture-v1-confirmation`
- `npm run check`
- all historical Zoning authorization/consumption guards included by the repository gate

The complete check includes the cohort-path regression, exact rejected-prerequisite continuation controls in both child and parent, altered-telemetry counterexamples, and every historical Zoning authorization/consumption guard. No additional provider request was made.

## Consumed authorization boundary

The exact owner sentence was recorded and used once. The record now retains the execution commit, durable attempt/run ID, start and consumption timestamps, complete result hashes, `$5` cap, and settled `$0.391986` actual ledger. Its `--require-active` path fails before provider access because status is `consumed`.

Repeating the former authorization sentence cannot reactivate this package. Any later paid execution would require a materially reviewed successor, a distinct locked package and authorization identity, complete no-cost verification, and a new exact owner decision and cap.

## Remaining Beta 1 gates

The retained confirmation fails semantic and reliability acceptance and is not pricing-ready. The next step is a no-cost diagnosis of the 11 verifier blocks and two judged failures. A later materially revised architecture would still require distinct paid confirmation, professional Zoning review, exact-release web/iOS presentation, physical-iPhone acceptance, and final owner release approval. Source/tests/package execution are not public release evidence.

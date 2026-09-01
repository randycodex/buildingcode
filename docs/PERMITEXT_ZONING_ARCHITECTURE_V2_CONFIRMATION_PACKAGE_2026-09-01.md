# Permitext Zoning Architecture V2 — Consumed Confirmation Package

Date: September 1, 2026

Working branch: `codex/zoning-research-beta1`

Status: **AUTHORIZED ONCE; RUN COMPLETE; AUTHORIZATION CONSUMED; NO RETRY AUTHORIZED**

## Purpose

This is the one distinct paid confirmation package permitted after Architecture V2 passed the complete frozen 30-case no-cost gate. It is designed to measure whether the redesigned live path materially improves Architecture V1's completion and quality while retaining fail-closed behavior and the `$4–$6` Production model-cost target per 100 completed turns.

The package is bound to reviewed Architecture V2 implementation commit `991d38a0047f53d49975fa6af5259f0063d4bd0e`. The complete locked package commit is the commit containing this document and the machine-readable authorization; it is reported after the commit is created because a Git commit cannot embed its own hash.

## Why it should improve the result

- Architecture V1 detected late omissions but discarded 11 generation-ready answers. V2 compiles explicit answer obligations before generation and allows one source-bounded correction over only the pinned evidence.
- The 12 retained full-score V1 answers still pass. The two delivered V1 judge failures now fail deterministically for their exact missing calculations rather than reaching a customer.
- Ten former verifier-blocked cases have one bounded repair route. The unsupported special-parking case now stops before generation, avoiding paid failed work.
- Direct bounded questions remain Luna-first. Tables, effective dates, property applicability, and calculations start on Terra when their complexity is known, avoiding an underpowered first generation followed by a full retry.
- Missing property facts and missing controlling table/map/parking evidence stop before usage reservation.
- The adverse no-cost Production projection is `$3.204504` per 100 completed turns; the nominal projection is `$1.231246`. These are projections only, so the paid confirmation must measure actual completion, quality, and settled cost.

## Immutable identity

- Architecture implementation commit: `991d38a0047f53d49975fa6af5259f0063d4bd0e`
- Authorization ID: `7b58a481-a900-4be1-9cf5-1d26e5fda78b`
- Locked authorization SHA-256: `50db45e451be9718f2e4c735dcbc2dbcd72c3d0315b96fe1133ae02a16440e5c`
- Frozen cohort SHA-256: `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`
- No-cost preflight SHA-256: `795676531eda046b046d55215afcf4d01c08846f2e9f1a7404e79ac3348d614c`
- Planned scope: all 30 ordered cases, one repetition, maximum cumulative API spend of `$5`
- Web support: disabled
- Public release, deployment, pricing/allowance change, and 24,000-character candidate: unauthorized

The machine-readable record is [zoning-architecture-v2-confirmation-paid-authorization.json](../permitext-sync-server/evals/zoning-architecture-v2-confirmation-paid-authorization.json). It now has `status: consumed` and is bound to [run `9f67f4ba-3944-46a4-b438-fcec082144e3`](./PERMITEXT_ZONING_ARCHITECTURE_V2_CONFIRMATION_RESULT_2026-09-01.md). The historical locked package remains exact commit `3b5db112271da5d015dd84793b5331c59ec0a467`; re-dispatch is blocked.

## Bound execution policy

- Preserve all 30 cases in frozen order and run exactly one repetition.
- Enforce a `$5` maximum cumulative API-spend cap with conservative reservation before each paid request.
- Keep Production and judge ledgers separate.
- Keep provider web search off and the 24,000-character candidate disabled.
- Allow no more than three logical model stages per ready case and no more than one source-bounded repair.
- Do not permit a full-answer rewrite.
- Continue past only settled, uncharged `RESEARCH_VERIFICATION_FAILED` operations or exact zero-request prerequisite/evidence boundaries. Provider, spend-cap, abort, telemetry, integrity, charged, pending-request, and non-allowlisted failures remain terminal.
- Enter a durable one-use `running` state before the first provider request; a crash requires manual review and cannot retry automatically.
- Require the selected package commit to descend from the reviewed Architecture V2 commit and allow only the authorization record to differ between the package and execution commits.

## Authorization boundary

Validating or committing this package could not call a model. The owner later supplied the exact package-bound sentence for all 30 ordered cases, one repetition, and the `$5` cap. That authorization was used once and is consumed; the validator now binds the retained result and rejects any re-dispatch.

Execution commit `fffd5c58c8b781bd9e322bdfad421ab2a65450e3` recorded only the reviewed authorization/recovery state before provider dispatch. The runner verified clean Git state, ancestry, locked-package hashes, signed local handoff, matching per-run and global locks, hostile-environment scrubbing, exact cohort order, and the cumulative spend cap.

## Remaining acceptance

Even a successful paid confirmation will not by itself enable public Zoning Research. The result must still pass semantic/reliability and measured-cost review, professional Zoning review, exact-release web/iOS presentation, physical-iPhone acceptance, and final owner release approval. The `$20` price and 100-turn allowance remain unchanged.

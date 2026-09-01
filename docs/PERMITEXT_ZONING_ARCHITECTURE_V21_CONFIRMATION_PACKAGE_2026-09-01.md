# Permitext Zoning Architecture V2.1 — Locked Confirmation Package

Date: September 1, 2026

Working branch: `codex/zoning-research-beta1`

Status: **LOCKED; NOT AUTHORIZED; ZERO PROVIDER CALLS; ZERO API SPEND**

## Purpose

This is the one distinct confirmation package prepared after Architecture V2.1 passed the frozen 30-case no-cost gate, the expanded adversarial suite, scoped independent review, and the complete repository check. Its only purpose is to measure whether the observed-failure obligations improve live first-answer quality and the Architecture V2 `42.9%` repair rate while preserving fail-closed behavior and the `$4–$6` Production model-cost target per 100 completed turns.

The package is bound to reviewed Architecture V2.1 implementation commit `d35a8cba80077f24da9ed945ae30e5c84ededc62`. The exact locked package commit is the commit containing this document and the machine-readable authorization; it must be reported after commit creation because a Git commit cannot embed its own hash.

## Why this is a distinct package

- It retains Architecture V2's six question paths, early prerequisite/evidence boundaries, selective Luna/Terra routing, and single source-bounded patch.
- It adds the V2.1 compiler and eight provenance-labeled failure regressions derived from the three verifier blocks and five judged failures in the consumed V2 result.
- The no-cost replay preserves all 16 accepted V2 answers and rejects all five retained judged failures.
- Structured-table values, source-role binding, unresolved fact state, arithmetic direction, legal-boundary grouping, and primary-answer polarity now fail closed.
- The static preflight imports no provider-dispatch client, records zero network attempts, and has `$0` actual spend.

## Immutable identity

- Architecture V2.1 implementation commit: `d35a8cba80077f24da9ed945ae30e5c84ededc62`
- Authorization ID: `1dd05bd4-a98d-4b44-8de5-f0e2a79b890f`
- Locked authorization SHA-256: `3799b837f47e81732bbdfe832aada98b582d2cead78660b345c56d9ae441437f`
- Frozen cohort SHA-256: `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`
- V2.1 no-cost preflight SHA-256: `5501d15f40567a824a2f9efa10dd469703f358969c7eb10ae6507352cb47f4f2`
- V2.1 regression-fixture SHA-256: `d53e11f8e7955822775b5c4e681694b2e753804a2ca6d4d3dd2ccbcd723f3f8c`
- Consumed V2 run: `9f67f4ba-3944-46a4-b438-fcec082144e3`
- Planned scope, if later authorized: all 30 ordered cases, one repetition, maximum cumulative API spend of `$5`
- Web support: disabled
- Public release, deployment, pricing/allowance change, professional signoff, and 24,000-character candidate: unauthorized

The machine-readable record is [zoning-architecture-v21-confirmation-paid-authorization.json](../permitext-sync-server/evals/zoning-architecture-v21-confirmation-paid-authorization.json). It remains `status: locked`; its active scope, owner-decision, package-commit, execution-commit, attempt, and model-call authorization fields are null or false.

## Bound execution policy

- Preserve all 30 cases in frozen order and permit exactly one repetition only after a later exact owner authorization.
- Enforce a `$5` maximum cumulative API-spend cap with conservative reservation before each paid request.
- Keep Production and judge ledgers separate.
- Keep provider web search off and the 24,000-character candidate disabled.
- Allow no more than three logical model stages per ready case and no more than one source-bounded repair over at most five sources and 8,000 source characters.
- Do not permit a full-answer rewrite.
- Continue past only settled, uncharged `RESEARCH_VERIFICATION_FAILED` operations or exact zero-request prerequisite/evidence boundaries. Provider, spend-cap, abort, telemetry, integrity, charged, pending-request, and non-allowlisted failures remain terminal.
- Enter a durable one-use `running` state before the first provider request; a crash requires manual review and cannot retry automatically.
- Require the selected package commit to descend from the reviewed V2.1 commit and allow only the authorization record to differ between package and execution commits.

## Authorization boundary

Preparing, validating, or committing this package cannot call a model. The current record does not authorize a paid run. A future run requires a new user message in this exact form, using the final package commit reported after commit creation:

`authorize exactly package commit <40-character-package-commit> for all 30 ordered cases, one repetition, with a maximum cumulative API spend of $5.`

No earlier Architecture V1, V2, remediation, or general “keep going” authorization can be reused. Only that later exact sentence may populate the scope and authorize one execution.

## Remaining acceptance

Even a successful confirmation would not itself enable public Zoning Research. The result would still require semantic/reliability and measured-cost review, professional Zoning review, exact-release web/iOS presentation, physical-iPhone acceptance, and final owner release approval. The `$20` price and 100-turn allowance remain unchanged.

# Permitext Zoning Architecture V2 — No-Cost Result

Date: September 1, 2026

Status: **IMPLEMENTED; 30-CASE NO-COST GATE PASSED; PAID CONFIRMATION NOT AUTHORIZED**

## Result

Architecture V2 replaces Architecture V1's detect-and-discard loop with a question compiler, path-specific evidence readiness, deterministic answer obligations, selective model routing, and at most one source-bounded correction. It preserves enacted text and exact citations as the authority, the existing fail-closed Zoning safety rules, and the disabled public Zoning Research flag.

The frozen 30-case preflight passes with credentials removed and zero provider, payment, or network calls:

- 30/30 cases compile across all six approved question paths.
- 24 cases are generation-ready; six stop at a precise zero-model prerequisite or evidence boundary.
- 11 ready cases route first to Luna; 13 complex table, date, applicability, or calculation cases route first to Terra.
- The nominal route uses 37 logical model stages across the ready cohort; the adverse route, including the one allowed repair, uses 54. Per-case p50 and p90 are two stages and the adverse maximum is three.
- The retained 12/14 Architecture V1 full-score answers still pass the new deterministic obligations.
- Both delivered Architecture V1 judge failures now fail deterministically: the R6A UAP answer omitted the 31,200-square-foot qualifying ceiling, and the deep-through-lot answer omitted the upper 25-foot vertical portion.
- Ten former verifier blocks have exactly one narrow repair route. The remaining special-parking case stops before generation because the supplied evidence does not establish the controlling mapped parking geography.
- Missing property facts, missing controlling parking evidence, omitted effective dates, changed table symbols, and unsupported map conclusions remain fail-closed.
- The global 24,000-character evidence candidate remains disabled.

## Architecture

The compiler separates direct rules, definitions and cross-references, structured tables and symbols, effective dates and amendment history, property/map applicability, and calculations/scenario application. Each path has its own evidence budget, required inputs, deterministic obligations, routing policy, and repair eligibility.

Direct-rule questions remain Luna-first and may not use a repair because the retained cohort already passes 7/7 on that path. Definitions remain Luna-first with a bounded subjective verification stage. Structured tables, effective dates, property applicability, and calculations begin on Terra when their complexity is known before generation. A failed deterministic or bounded verifier check can produce one Terra patch over no more than five pinned sources and 8,000 source characters. The patch may change only the answer text, citations, explicit points, missing facts, limitations, and evidence-needed fields; it may not regenerate the full answer or introduce an unpinned source. Every deterministic and safety gate runs again after the patch.

The API now rejects missing structured table evidence and missing controlling special-parking evidence before reserving usage. The web client displays the exact boundary rather than a generic verification error.

## Cost interpretation

The no-cost projection estimates Production model cost at `$1.231246` nominal and `$3.204504` adverse per 100 completed all-Zoning turns. The complete frozen cohort projects `$0.295499` nominal or `$0.769081` adverse. Evaluation-only judge cost is recorded separately as `$0` because no judge ran.

These are mechanical projections from the planned logical stages, not paid measurements and not pricing evidence. Transient provider retries can create additional HTTP attempts even when the logical-stage policy is unchanged. A later owner-authorized confirmation must measure completion, semantic quality, settled Production cost, failed-work cost, and the separate judge ledger before any pricing, allowance, or public-release decision.

## Evidence

- No-cost artifact: `permitext-sync-server/evals/results/zoning-architecture-v2-no-cost-preflight.json`
- Compiler and repair implementation: `permitext-sync-server/research-zoning-planner.mjs`
- Runtime integration: `permitext-sync-server/app.mjs`
- Routing: `permitext-sync-server/research-model-routing.mjs`
- Replay and adversarial contract: `permitext-sync-server/tests/research-zoning-architecture-v2-contract.mjs`
- Preflight generator: `permitext-sync-server/scripts/preflight-zoning-architecture-v2.mjs`

## Remaining gate

One distinct immutable 30-case, one-repetition confirmation package may be prepared only from the reviewed Architecture V2 commit. It must remain locked with null owner, spend, package, and execution fields until the owner supplies the exact package-bound sentence and maximum cumulative API spend. Preparing that package does not authorize a provider call, deployment, public Zoning Research, a price or allowance change, or the 24,000-character evidence candidate.

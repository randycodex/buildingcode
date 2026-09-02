# Permitext Research product-example live-confirmation package

Date: September 2, 2026

Status: **LOCKED; NO PROVIDER OR NETWORK CALL AUTHORIZED**

Authorization ID: `17baf770-5f0b-4f51-91f3-fea23b415e2d`

Prepared from reviewed implementation commit: `32b83a69b14fe1910643e8781f4796fe87fc6f71`

## Why this package exists

This is the single small live confirmation for the owner's real answer examples. It does not repeat the prior 30-case Zoning cohort. It preserves the seven example conversations and nine ordered turns, including both conversational follow-ups, and tests the user-facing Research path with automatic enacted-corpus retrieval.

The exact locked package commit is the commit that contains this document, the runner, the no-cost preflight, and the locked authorization. It must be reported after that commit is created because a Git commit cannot contain its own hash.

## Exact scope

- Seven conversations and nine ordered turns, once.
- Maximum cumulative API spend: `$2`.
- No separate model judge requests; deterministic citation and presentation checks plus later owner review.
- Web support disabled. The run may use only the bundled 2022 Construction Codes, official 2014 Construction Codes, and the locally bundled Zoning Resolution diagnostic corpus.
- The two follow-ups remain in the same conversation as their first question.
- A settled uncharged fail-closed result may move to the next independent example. Spend-cap, provider, unsettled-request, or telemetry failure stops the run.
- A permanent one-attempt lock is created before the first provider request. A crash or partial result does not authorize a retry.

## Bound no-cost evidence

- Frozen cases: `permitext-sync-server/evals/research-product-example-cases.json`
  - SHA-256: `39cbbe5b6d88254e585003576212f4d4227cca28f1ac4bc14c98007490f96d97`
- No-cost preflight: `permitext-sync-server/evals/results/research-product-example-confirmation-no-cost-preflight.json`
  - SHA-256: `08f45c335ccc8452b41286c2c67337601d0badad487fe9c081daae8401635968`
- Locked authorization: `permitext-sync-server/evals/research-product-example-confirmation-paid-authorization.json`
  - SHA-256: `8e0658b43646768d9c68eafed5b6782cac075ad3c2aa6b1a71ba409816bba37f`
- Live runner: `permitext-sync-server/scripts/run-research-product-example-confirmation.mjs`
  - SHA-256: `b1bd913a97e9125df7bf8ceab10ef9f3312288a3ee3bc84a60f44716f88d4d65`

The preflight proves all seven cases route to or explicitly disclose the required corpus, all nine presentation contracts match, the follow-up count is preserved, and the run plan makes zero network attempts, zero paid calls, and zero Production writes. The authorization contract also invokes the paid runner with fake credentials while locked and proves it refuses before creating the run lock or accessing a provider.

## Later authorization boundary

No authorization sentence is active yet. If the owner later chooses to run this package, the exact sentence must name the committed locked-package SHA, all nine ordered turns in seven conversations, one repetition, and the `$2` maximum cumulative API spend. The machine-readable record must then be updated and committed as the only server-tree difference from the locked package before execution.

This package does not authorize public Research or Zoning Research, a professional code determination, a price or allowance change, merge, push, deployment, Production work, TestFlight upload, or public release. A completed live result still requires owner review against the screenshots and enacted evidence.

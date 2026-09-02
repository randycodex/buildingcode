# Permitext repaired owner-example confirmation result

Date: September 2, 2026

Package commit: `63456909353d0e1b4539a1048010ad957917752f`

Authorization commit: `6911154ad7f5a4c7852a96cd96bdc868432bc851`

Run ID: `fa52cca6-d28f-4d16-968a-0d8c06d596e9`

## Retained outcome

The exact owner-authorized one-repetition run is consumed and retained as a
failed pre-provider execution:

- seven of seven conversations were created;
- the first turn in each conversation was attempted;
- all seven attempts failed closed with HTTP 503 and
  `RESEARCH_SPEND_CAP` before provider dispatch;
- zero answers completed and no answer-quality conclusion can be drawn;
- every failed operation was uncharged and reported zero pending provider
  requests;
- actual spend was `$0.000000`, reserved spend was `$0.000000`, and the
  cumulative authorization cap remained `$2.00`;
- no separate judge request was configured or made; and
- no Production data, customer conversation, public feature flag, price,
  allowance, deployment, merge, or push changed.

The immutable machine result is
`permitext-sync-server/evals/results/2026-09-02T16-56-49-594Z-fa52cca6-d28f-4d16-968a-0d8c06d596e9-product-example-repaired-confirmation.json`.

## Root cause

The runner validated the paid-evaluation switch, API credential, versioned
token prices, and `$2` evaluation cap. It did not supply the separate
production-path Research spend-guardrail variables to its isolated local
server. `researchSpendGuardrails()` therefore returned `ready: false`, and the
normal conversation route rejected every request before creating an
evaluation-spend reservation. The retained result confirms that state with an
inactive evaluation ledger, a null runtime cap, zero provider requests, and
zero spend.

This was a runner-environment defect. It was not an enacted-corpus retrieval,
answer-format, citation, official-web-source, or model-quality failure.

## No-cost repair

The successor runtime environment now binds both spend-control layers to the
owner ceiling before a one-use lock can be created:

- evaluation cumulative cap: `$2.00`;
- maximum single provider request: `$1.00`;
- isolated user daily and monthly caps: `$2.00`;
- isolated system daily and monthly caps: `$2.00`;
- Research kill switch off only inside the isolated run;
- paid additional turns disabled; and
- the temporary file store and cleared Production storage variables remain
  unchanged.

The no-cost preflight now calls both
`validatePaidResearchEvaluationEnvironment()` and
`researchSpendGuardrails()` against the complete simulated live environment.
It requires both to pass and proves the five isolated cap values without a
network request or provider call. The authorization contract also retains the
failed result, zero-spend ledger, consumed authorization, permanent local lock,
and a no-redispatch refusal.

## Governance boundary

The authorization is consumed even though no provider request occurred. The
permanent one-attempt rule is preserved; the failed run must not be deleted,
rewritten, retried, or reclassified as answer-quality evidence. Any later live
confirmation requires a distinct locked package, a fresh exact package-bound
owner authorization, the same seven conversations and nine ordered turns, one
repetition, and a new cumulative ceiling no higher than `$2`.

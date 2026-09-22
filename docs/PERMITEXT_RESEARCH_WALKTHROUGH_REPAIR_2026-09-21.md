# Research walkthrough failure repair

## Diagnosis

Read-only Production logs for deployment `dpl_ByUSyLn7BnDC4afLRryyGhiSLqK1`, September 21, 22:30–24:00 UTC, identify the two walkthrough failures. Both verification attempts rejected an unrelated NYC Zoning Resolution starting-point link and a requirement to retrieve a controlling program document before relying on a program-specific minimum. Both operations were uncharged.

The exact warning exists in `applyResearchOutsideAuthorityStartingPoints`. The general answer pipeline calls this formatter after both initial generation and revision. Its `useWeb` check allowed broad discovery suggestions to be reinserted even after the verifier rejected them. The failed raw model drafts were not recovered; the logs plus matching formatter establish the injection mechanism, not the quality of every sentence originally generated.

## Repair

- Only append a discovery starting-point link when its authority is requested in the actual question. Expanded retrieval or Project facts alone cannot authorize a new topic in answer prose.
- Replace the formatter's program-specific instruction with a factual limitation about the link itself.
- Recognize passage-alone/by-itself/on-its-own questions as evidence-boundary requests, while retaining explicit external-lookup overrides.
- Recognize simple code-naming paraphrases as bounded citation lookups. Project compliance, multi-section comparisons, exceptions, and historical questions remain outside this shortcut.
- Keep citation binding, edition checks, substantive verification, and the existing revision/spend bounds unchanged. Do not suppress unsupported-requirement errors or switch verifier models.

## Validation

Passed locally without paid provider calls:

- Walkthrough regressions using both exact failed questions and broad Zoning discovery, including repeated formatting after revision.
- Model routing and source policy contracts.
- Product examples: seven conversations, nine ordered turns, zero network attempts.
- Evidence-boundary fallback, official-guidance summary integrity, answer quality, web attribution, adaptive answer structure, required claim coverage.
- Selected-passage HTTP regression with external/provider calls forbidden.
- Research handoff presentation (updated stale test doubles for current pane state helpers).

The source-edition-integrity test also passed after correcting its stale function-extraction boundary to include the existing `export` keyword. No assertions or evidence/edition validation code were relaxed.

No new paid Research call, pricing change, allowance change, or provider configuration change was made. Production model acceptance must be measured separately from these local fixtures.

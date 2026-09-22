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

The initial repair validation above used no paid provider calls. The separately authorized real-model check follows.


## Authorized real-model acceptance check — 2 passed, 1 failed

Owner authorized at most three local Research turns and $2 provider spend. Exactly three turns were attempted against the patched local HTTP server and enacted corpus using real OpenAI responses, isolated disposable local storage, and synthetic local entitlement. Production and the deleted Production account were unchanged.

1. **PASS:** Selected 2022 BC 101.1 name and citation-designation question. Luna answered correctly with the BC 101.1 citation; verification passed on its first attempt; persisted answer matched on reopening.
2. **PASS:** “Does that passage alone establish whether a particular building complies with the code?” Terra answered no, explained that the provision only names the code and section designation, and added no unsupported compliance requirements. Verification passed on its first attempt; persisted answer matched on reopening.
3. **FAIL — high priority:** “What does BC 101.1 call this code?” returned HTTP 502 `RESEARCH_VERIFICATION_FAILED` after the allowed internal revision. The verifier rejected unrelated warnings about unavailable enacted sections, incomplete large definition sections, and omitted cross-references. The operation was not charged against the synthetic account allowance. Provider work still incurred cost.

The earlier irrelevant Zoning/program-minimum injection did not recur in the observed results or third-turn failure diagnostics. This is a narrow three-question sample, not broad Research acceptance.

### Remaining failure mechanism

`deterministicResearchEvidenceAnalysisForBoundedCitation` copies retrieval diagnostics into `evidenceLimitations`; `canonicalResearchBoundedCitationInterpretation` then replaces the answer limitations with them. The general-turn evidence-analysis path already keeps these internal diagnostics out of user-facing limitations. The failed verifier diagnostics match this bounded-citation behavior. Raw rejected provider drafts were not retained.

Next repair: retain retrieval diagnostics in internal retrieval metadata and give bounded-citation answers a relevant scope limitation, without relaxing citation or substantive verification. That additional repair has not been applied or live-tested in this record.

### Cost and evidence

Eight provider requests across three turns, including the failed turn's single bounded revision. Application-accounted provider cost totals $0.051900; conservative cost accounting totals $0.103363, below the authorized $2. These are internal accounting estimates, not an invoice reconciliation. No further paid turns were run.

Raw result: `permitext-sync-server/evals/results/research-walkthrough-repair-live-2026-09-21.json`. Its `results` contains the two successful answers, while `operations` contains all three attempts, including the failure. The original runner threw before adding the failed turn to `results`; the runner now records such failures explicitly. Its prose assertion also now reads the actual top-level answer fields. Successful saved answer text was independently inspected after the run. The live artifact has not been regenerated.

The updated harness was checked in offline mock mode only. Offline success verifies HTTP/persistence and harness behavior, not real-model answer quality. A separate mocked decision-fact-repair contract passed, including rejection without saving or charging an invalid final answer.

**Release status:** Research repair remains local at `228042289`; not deployed. Real-model acceptance is incomplete (2/3).

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


## Follow-up repair after the live failure

Implemented the bounded-citation diagnostic separation described above. Initial answers and revisions now receive a scope limitation instead of internal retrieval warnings. Retrieval diagnostics remain intact; evidence binding and substantive verification were not relaxed. A regression replays the three diagnostic categories from the live failure and checks both formatting passes, preserved answer/citations, and unchanged diagnostic records.

Updated backend, web, and native failure copy to explain that the draft could not be supported by the cited sources, was withheld, and does not establish that the question is unanswerable. It suggests asking about one provision or starting from a relevant code passage. This is a technical failure explanation, not a fabricated missing-facts explanation or an unverified legal answer. Existing specific evidence-boundary and Zoning prerequisite responses remain distinct.

Passed after the repair: list-summary/diagnostic regression, walkthrough boundary contract, selected-passage HTTP, decision-fact-repair HTTP (including invalid-answer rejection), deterministic evidence-boundary fallback, JavaScript syntax, offline asset and installer recovery contracts. No additional paid calls.

The broader trust-boundary source contract still fails on a pre-existing missing native `research-composer-privacy-disclosure` marker (also absent in HEAD). Its stale settings-function extraction was repaired without removing assertions; this does not resolve the native marker failure. Native expected message fixtures were updated, but Xcode/device tests were not run. Web assets advanced to v540 / shell v1183 for eventual release.

Status: source repair and focused offline checks complete; real-model retest, rendered web/iPhone acceptance, and deployment remain unverified. The recorded 2/3 live result predates this follow-up repair.


## Real-model retest after follow-up repair — 3/3 passed

Owner explicitly requested another real-model run after commit `9ea1138b5`. Repeated the same three questions with the same isolated local HTTP/corpus setup and a maximum of three turns / $2. No Production deployment or account changes.

1. Selected BC 101.1 title/citation question: PASS, Luna, first verification attempt, 5.0 seconds.
2. Passage-alone building-compliance follow-up: PASS, Terra, second verification attempt after one automatic bounded revision, 19.7 seconds. The first draft received an unsupported-requirement issue; the final answer correctly states that the title provision supplies no substantive compliance test. The verification safeguard remained active.
3. Previously failing unpinned “What does BC 101.1 call this code?”: PASS, Luna, first verification attempt, 6.9 seconds. Answer identifies the New York City Building Code / NYCBC / BC and includes the exact enacted BC 101.1 citation. No irrelevant retrieval warnings were inserted.

All three saved answers matched after reopening their conversations, included source citations, and requested no web support. Eight real provider requests including the automatic revision. Application-accounted provider cost: $0.055347; conservative accounting: $0.130591, below the $2 cap. These are application estimates rather than reconciled provider invoices. No additional turns attempted.

Evidence: `permitext-sync-server/evals/results/research-walkthrough-repair-live-2026-09-21-bounded-fix.json`. The runner accepts a validated explicit run ID and exclusively creates each live output file so reruns do not overwrite prior evidence or accidentally repeat an existing paid run.

This establishes acceptance for the three reproduced scenarios on the patched local server with real models. It does not establish broad Research accuracy, Production deployment, or rendered web/iOS acceptance. The earlier unrelated native privacy-marker contract failure remains open.

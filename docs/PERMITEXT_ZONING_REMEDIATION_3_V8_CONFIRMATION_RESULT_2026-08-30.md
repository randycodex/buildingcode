# Permitext Zoning Research — remediation successor 3 v8 confirmation result

Date: August 30, 2026

Source branch: `codex/zoning-research-beta1`

Authorization package commit: `7cc2af325dbb3c5c98e4e15e2c15196a4794cb76`

Execution commit: `9d4af1b31762568caa5accf63b52e275f0e39bde`

Machine-evidence commit: `26ac796a1dbf5caf0a25d6d67feb57a9e4863d23`

Dataset SHA-256: `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`

Run ID: `1521497c-8df4-4ed9-98ce-79ef2805d1a6`

## Authorization and boundary

The owner explicitly authorized exactly package commit `7cc2af325dbb3c5c98e4e15e2c15196a4794cb76` for all 30 ordered remediation-successor-3 cases, one repetition, with a maximum cumulative API spend of `$5`. The only change from that locked package to the execution commit was the fresh authorization record. Authorization ID `151aa121-7962-48d1-80b3-56728e62fc75` entered its durable, non-reusable running state before dispatch and is now `consumed` by this run.

The package retains repaired source commit `747887054e1bba16578a44477720f813a55fc357` as an ancestor and binds Zoning safety version `20260830-zoning-material-completeness-v8` at SHA-256 `62bb5459c2ea22f981b4b2b0367d25b7086c7d86bf0d0cb92d582ae1d817dc94`. The earlier remediation-successor-3 authorization and result stayed byte-identical.

Provider web support was disabled, and no operation requested or searched the web. The runner stopped after the first execution error. This authorization did not enable the disabled 24,000-character evidence candidate, public Zoning Research, deployment, merge, push, pricing or allowance changes, professional Zoning sign-off, or customer charges. No further paid run is authorized.

## Retained terminal result

- Status: `partial`.
- Evidence preflight: 30/30 ready before provider dispatch.
- Attempted operations: three, in the exact frozen order.
- Completed operations: two; both passed grading at 4.00/4.
- Failed operation: one; it failed closed before grading and did not consume a user turn.
- Unattempted operations: 27 because the stop-on-first-execution-error guard halted the run as designed.
- Paid requests: 10 settled and zero pending.
- Total settled evaluation spend: `$0.297314`, exactly matching the reconciled conservative reservation and remaining below the `$5` cap.
- Production-operation requests and cost: eight requests and `$0.268014`.
- Independent judge requests and cost: two requests and `$0.029300`.
- Failed production work cost: `$0.093770`.
- Charging integrity: the two completed turns used only the isolated evaluation grant; the failed operation recorded `charged: false`; no customer account was involved.

Machine evidence:

- `permitext-sync-server/evals/results/2026-08-31T01-59-26-104Z-1521497c-8df4-4ed9-98ce-79ef2805d1a6.json` — SHA-256 `1fc4dccc10791014baac9714f7c20fbe099084a4b7ae15d346c95939ab9a3c3e`.
- `permitext-sync-server/evals/results/2026-08-31T01-59-26-104Z-1521497c-8df4-4ed9-98ce-79ef2805d1a6.md` — SHA-256 `ef7e1d2eaaef2847fc5b0abfa81d1755980a5683e1eeae58cdb18a992325506e`.
- `permitext-sync-server/evals/zoning-successor-remediation-3-v8-confirmation-paid-authorization.json` — consumed-state SHA-256 `f9d01e8f94d96d3bc7e8e0a71fc43f183ed31b686a6e773e204fc0afc3872e58`.

## Case outcomes

Passed grading:

- `zr-rules-of-construction` — 4.00/4; three production requests; `$0.088081` production cost.
- `zr-use-group-table` — 4.00/4; three production requests; `$0.086163` production cost.

Failed closed before grading:

- `zr-appendix-map-boundaries` — two production requests; `$0.093770` failed-work cost; `RESEARCH_VERIFICATION_FAILED` after the initial answer and one bounded revision both encountered the recorded `zoning_missing_mapped_location` category.

The remaining 27 ordered cases were not attempted. Neither case changed by remediation successor 3 reached execution, so this result does not semantically confirm either owner-approved correction.

## Failure classification

The frozen Appendix J case, selected evidence, answer key, and ordered position are byte-identical to the earlier remediation-successor-3 run. The post-v8 run again records two verification attempts and the single category `zoning_missing_mapped_location`. That rules out cohort, rubric, or selected-evidence drift as the reason for the different package.

The failed operation intentionally retains only its test case, aggregate operation metric, and error. It does not retain either generated answer or revision, and the temporary evaluation store was removed. The text-level cause is therefore unrecoverable from retained evidence. The strongest defensible classification is a deterministic-safety/model-wording interaction with attribution indeterminate: either both generated attempts omitted or misstated the required separate parcel/map boundary, or v8 did not recognize otherwise acceptable wording. The evidence cannot distinguish those possibilities, so this run does not establish that v8 is wrong or that the model was safe.

No further regular-expression relaxation is justified from the aggregate category alone. A subsequent no-cost path therefore adds a privacy-bounded diagnostic that can distinguish a missing boundary from an unrecognized safe boundary without retaining answer text, then exercises structural variants and unsafe counterexamples. The paid artifact itself remains insufficient to attribute fault.

## Subsequent no-cost v9 engineering follow-up

Zoning safety v9 is a prospective engineering repair, not a reinterpretation or rescore of this retained v8 run. It adds at most two verification-attempt records and 24 triggering clauses per attempt. Each clause record contains only an allowlisted answer-field kind, SHA-256 hash, bounded length, and three booleans indicating location-boundary, source-rule, and direct-conclusion recognition. The sanitization contract excludes raw answer text, customer identifiers, and provider request identifiers.

Independent structural regressions now accept the reproduced safe Appendix J source-level treatment variants when the complete answer separately states that the parcel cannot be placed without its address/BBL and applicable official map. Equivalent answers without that boundary still fail, as do direct deictic, possessive, proposed, named, and concrete-site mapped conclusions. Focused safety, economics, durable-message, and consumed-authorization contracts pass, and the unchanged 30-case cohort passes the complete no-cost conversation preflight. Provider credentials and paid-run variables were removed; no paid request was made.

These diagnostics did not exist during run `1521497c-8df4-4ed9-98ce-79ef2805d1a6`, so they cannot reveal the deleted v8 answer text. They reduce ambiguity in any future attempt but do not establish whether the retained failure came from unsafe model wording or v8 recognition.

## Economics and reliability

The two completed turns cost `$0.087122` mean/p50, `$0.087889` p90, and `$0.088081` maximum. Including failed work gives `$0.134007` per completed turn and a mechanical projection of `$13.40` per 100 all-Zoning turns. Completed-turn latency was 19.610 seconds mean/p50, 23.311 seconds p90, and 24.236 seconds maximum.

This projection is not decision-ready. The run completed only two turns against the 20-turn minimum, stopped at the third case, and did not reach either changed remediation-successor-3 case. The result records `sampleReady: false`, `targetReady: false`, and `readyForPricingDecision: false`. The `$13.40` figure is a non-controlling partial signal. Remediation successor 2's `$20.18` failed-work-amortized projection per 100 all-Zoning turns and `$20.72` 100%-Zoning mixed-month p90 remain controlling for current risk planning.

## Decision and next gate

Retain this result as an integrity-valid terminal partial diagnostic, not as a complete 30-case v8 confirmation. Do not enable public Zoning Research or the 24,000-character candidate, change the `$20` price or 100-turn allowance, merge, push, or deploy from it. Semantic, reliability, cost, exact-release web/TestFlight physical-iPhone, and final public-release gates remain open.

The no-cost diagnosis and bounded v9 repair are complete. The next Zoning step is independent review and retention of v9, followed—only if a new paid confirmation is still justified—by a new distinct locked package. Any later paid confirmation requires a new explicit exact-package authorization for all 30 ordered cases and one repetition plus a new cumulative cap. No such package or authorization currently exists.

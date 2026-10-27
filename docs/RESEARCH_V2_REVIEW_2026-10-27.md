# Research v2: local testing and review handoff

Research v2 remains opt-in on the local `codex/research-rebuild` branch. Nothing
was pushed or deployed. Existing Research remains the default.

## Fixes made in this pass

- Natural-language discovery removes question framing before searching. The
  original “What affects corridor fire ratings?” missed the main corridor
  provisions; it now finds 2022 BC 1020.1.1 and 1020.1.2 within twelve candidates.
  The search terms are visible. Discovery still cannot include evidence itself.
- Related-source results retain unresolved-reference and coverage notices.
- Historical search results use their actual edition label rather than the year
  of the bundle containing them (for example, 1968 rather than 2026).
- Older answers retain both conclusion and explanation in the chat and in
  subsequent conversation context. Missing review metadata means “Unreviewed.”
- Enter/Send cannot race passage review or inclusion. Sending from passage
  details restores the chat. Inspecting a saved answer's sources cannot invalidate
  an active request's completion/error handling.
- The chat waits for its first visible layout before scrolling to the latest
  answer, so a pane mounted asynchronously does not leave the answer offscreen.
- Drafting instructions preserve the source's terminology and give an explicit
  corrected user fact precedence over earlier statements. An exception excluded
  by supplied facts should not be presented as unresolved.
- Budget validation rejects malformed token counts and corrupted negative ledger
  values. Exhaustion prevents provider dispatch; restarting cannot enlarge a cap.
- The paid runner now handles termination through cancellation and preserves its
  summary. Ambiguous spending remains reserved rather than refunded.

## Verified locally

`npm run test:research-v2` passes: engine, budget, real view-handler interactions,
HTTP lifecycle, and eight canonical-library discovery cases. HTTP tests use an
isolated file store and provider doubles; they do not spend money.

New HTTP cases exercise duplicate requests from two tabs, source removal during
generation, cancellation, a connection dropped after persistence, replay without
rebilling, and provider failure without modifying saved answers. UI tests exercise
attachment/send races, stable retry IDs, stale-account completion suppression,
legacy answer display, and draft retention.

Fifteen existing regression files pass: Fast HTTP, related-provision client/HTTP,
conversation-only scope, saved exact text, Research/Notebook/Report handoff,
Research/Notebook concurrency, historical Notebook references, draft isolation,
web recovery, account mutation isolation, history content, search relevance,
shell caching, and offline coherence. The old web-recovery harness lacked an
existing workflow-button helper and DOM `prepend`; the harness was repaired and
its behavioral assertions now pass. No production database was used.

The actual browser verified the improved corridor discovery and historical
edition labels, switching questions and reloading with an unsent draft, and a
paid corrected follow-up submitted while passage details were open. The answer
returned to the chat and saved successfully; no browser errors were observed.

The eight discovery checks are known-target checks, not a claim of complete
regulatory recall. The previous desktop/390px layout inspection remains recorded
in `RESEARCH_V2_VALIDATION_2026-10-26.md`; no physical device was tested.

## Paid evaluation and comparison

Final full run: `2026-10-27T02-34-19-181Z-43d3a680`.

- Twenty cases passed all twenty developer-authored checks; nineteen supported
  completions and one failure occurred in the preceding expanded run after its
  incorrect percentage expectation was corrected. Both runs are retained.
- The failed follow-up initially left an inapplicable garage exception unresolved;
  its repair then added a qualifier rejected by the final reviewer. The answer
  was withheld. After the drafting changes, the case completed successfully.
- The initial percentage check demanded 2.08%, although the selected code itself
  states 2%. The corrected check accepts either representation. Original outputs
  and checks were not overwritten; a separate regrade records the correction.
- Final cohort: 44 v2 calls and 20 existing-Fast-prompt comparison calls.
- Median v2 engine time: 7.55 seconds. Median Fast generation: 1.34 seconds.
- Final cohort estimated v2 cost: $0.011607; Fast comparison: $0.001448.
- Cumulative budget accounting after the live browser follow-up: **$0.065476 of
  $7**, including $0.053988 settled estimates and a conservative $0.011488 for an
  interrupted runner call. 215 calls recorded; $6.934524 remains at this checkpoint.
  These are conservative API estimates, not invoice reconciliation.

The comparison uses identical selected evidence with the existing Fast prompt,
its six-message history window, and nonstreamed transport. It is not a comparison
with the legacy Verified engine or complete end-to-end latency. These samples
cannot establish that v2 is more accurate; the review packet makes that comparison
inspectable by a person.

Paid engine hash: `b7787d1e908c53b889a620ead013b8cecbfa0f94f473d1a3b099990d663150d2`.
Final engine hash: `6413d43742f3cdd944d0df6bcee1e06e2aed930c1ed012ede08553093d7b2da9`.
The only subsequent engine edit preserves legacy conclusion/explanation fields.
It has a deterministic regression test; all twenty saved paid input-packet hashes
match the final engine exactly. The final engine also completed the live browser
follow-up. No additional full paid rerun was needed for that compatibility fix.

## What Randy needs to review

1. **Workflow:** the numbered questions, switching/reopening, attaching a passage
   mid-conversation, and checking a citation in Reader. Confirm this is the desired
   replacement interface and whether discovering across multiple editions is clear.
2. **Substantive answers:** use the local review packet's exact text and side-by-side
   answers. Start with two slope directions, corridor applicability, edition
   conflict, removed evidence, and corrected follow-ups. Identify incorrect rules,
   omitted conditions, unnecessary refusal, or confusing explanations. Record
   human-approved expected outcomes before treating these as acceptance cases.
3. **Practical cases:** provide or select representative real research histories
   and cases for a broader benchmark, particularly tables, definitions, exceptions,
   mixed source families, and source dependencies. Synthetic history checks do not
   demonstrate compatibility with every real saved conversation.

The packet can be regenerated locally with:

```sh
node scripts/regrade-research-v2.mjs
node scripts/build-research-v2-review.mjs /absolute/path/to/review/index.html
```

## Remaining release gates

The local checks are complete for this pass; replacement is not approved or ready
to ship solely on their results. Outstanding gates are independent substantive
review, broader source-recall coverage, representative real-history acceptance,
physical-device acceptance, and production-equivalent database/auth/usage testing.
No real user history was migrated or modified.

Proposed later rollout: keep the old engine available, enable v2 for an opt-in
cohort, verify no cross-account access or evidence mutation and no critical
human-reviewed answer failures, compare completion/latency/cost, and expand only
after review. Roll back to the old interface/engine on those failures while
retaining v2 answers and evidence. Production access, release configuration,
deployment, and removal of the local-only gate require a later authorized step.

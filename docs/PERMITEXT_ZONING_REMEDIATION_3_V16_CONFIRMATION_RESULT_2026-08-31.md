# Permitext Zoning Remediation Successor 3 — V16 Confirmation Result

Date: August 31, 2026

Branch: `codex/zoning-research-beta1`

Package commit: `9751e50d1f830db527a822b1a515552465749907`

Execution commit: `0e17527e218daeb0d8ab938a37f34c04ee10febf`

Run ID: `784648df-2d7b-4957-972a-1ef14a054c43`

Status: terminal partial; authorization consumed

## Outcome

The owner authorized exactly the locked v16 package for all 30 ordered cases, one repetition, and a maximum cumulative API spend of `$5`. The guarded runner preserved the exact cohort SHA `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`, disabled web support, used the clean execution commit, entered a durable non-reusable attempt state before provider dispatch, and stopped on the first execution error.

The run completed two charged customer turns and then failed closed without a user charge at the third ordered Appendix J case:

| Order | Case | Result | Score | Customer turn |
| ---: | --- | --- | ---: | --- |
| 1 | `zr-rules-of-construction` | pass | 4.00/4 | charged |
| 2 | `zr-use-group-table` | quality fail | 3.68/4 | charged |
| 3 | `zr-appendix-map-boundaries` | verification error | not graded | uncharged |

Cases 4–30 were not attempted. Both remediation-successor-3 changed cases remain unattempted.

The case-2 quality failure was specific: the answer described the table's filled-circle `Permitted` symbol as `permitted as-of-right`, which the selected table legend did not itself establish. Citation structure and required-concept coverage otherwise passed. This is retained as a quality finding and is separate from the case-3 execution stop.

## Charging and cap integrity

- Approved cumulative cap: `$5.00`.
- Settled actual provider spend: `$0.218828`.
- Paid provider requests: 8.
- Pending provider requests: 0.
- Charged completed turns: 2.
- Failed charged operations: 0.
- Failed case-3 provider cost absorbed by the evaluation: `$0.087730`.
- Web support: disabled.
- Charging integrity: passed.

The one-time authorization ID `7eb2e708-3802-403f-95e6-4e594f3310da` is consumed. It cannot authorize a retry.

## Economics boundary

The run recorded `$0.180770` total operating cost across the two completed turns and one failed operation. Amortized over the two completed turns, its mechanical projection is `$9.04` per 100 all-Zoning turns.

That projection is **not sample-ready**: only two turns completed against the 20-turn minimum. It does not replace remediation successor 2's controlling `$20.18` failed-work-amortized all-Zoning risk projection, and it does not support a price or 100-turn allowance change.

## Privacy-bounded case-3 evidence

The failed answer text was not retained in the operational diagnostics. The retained bounded evidence establishes:

- both attempts cited Appendix J;
- both attempts included the overall address-or-BBL plus applicable-official-map boundary;
- the initial attempt retained 13 triggering field clauses and the revision retained 11;
- every triggering clause was classified as a direct conclusion and not as a source rule or location boundary; and
- the operation failed with `RESEARCH_VERIFICATION_FAILED` and `zoning_missing_mapped_location` after one bounded revision.

V16 therefore did not clear the Appendix J semantic/reliability gate. The retained hashes, lengths, and flags do not prove the wording of an unavailable clause and do not justify broadening the safety classifier.

## Immutable evidence

| Artifact | SHA-256 |
| --- | --- |
| Consumed authorization JSON | `f841d27c4f664990305a28ac6d2cc2817a2c910f53f402be44d3c0e3959153e5` |
| Result JSON | `94b0032df134daf360eb5ed59c80d4fd7c6cfd0b80e1564f095493b9a6fb673d` |
| Result Markdown | `f48f5d5005fb5c347b7d368dbbc929ed4b2cdc2b42bb9afd152d65f5e7a89a58` |

The authorization and result artifacts were committed at `3f4307918632716dd152ed34127fb5090260ffd4`.

## Decision and next gate

Retain this run as terminal partial evidence. Do not rescore it, reuse its authorization, enable public Zoning Research, enable the disabled 24,000-character candidate, change price or allowance, merge, push, deploy, or release because of this result.

The next gate is a no-cost privacy-bounded diagnosis of the new clause hashes, lengths, and flags plus independently authored safe and unsafe controls. Any later paid confirmation requires a materially justified repair, a distinct locked package, a complete 30/30 no-cost preflight, and a new exact package-bound owner authorization and cumulative cap.

# Zoning source and answer-check repair

The four-question live confirmation delivered two answers and rejected two. The selected-table answer now matches its source and the reviewed answer key. The lot-coverage answer has the correct core result but still needs a clearer calculation sentence. Delivery and runtime verification are not being treated as professional acceptance.

| Case | Result | Remaining work |
|---|---|---|
| ZR-02 | Uses only the selected table, preserving every use row and legend notation, including the M1 outdoor-racket-court condition | Preserve this result in regression review |
| ZR-05 | Metadata reached the draft, but the repair deleted both June 6, 2024 amendment events; final verification rejected it | Preserve relevant events through repairs; distinguish research recommendations from enacted obligations; carry source-edition metadata into verification |
| ZR-07 | The draft correctly withholds permitted FAR and distinguishes the proposed 4.0 ratio; another equivalent wording still triggers the mapped-location check | Diagnose the retained clause-level rejection offline while preserving rejection of unsupported property approvals |
| ZR-11 | Delivered the 80-percent basic cap, 8,000-square-foot result and modification/yard qualifications | Correct the main answer's unclear “8,500 square feet is 500 square feet (85%)” sentence; it should say 85 percent of the lot and 500 square feet over the cap |

ZR-02 took 13.099 seconds and two provider calls, compared with 27.373 seconds and three calls in the preceding attempt. This is one paired development observation, not a customer latency or savings benchmark. ZR-05 took 44.667 seconds and four calls before failing, ZR-07 took 8.522 seconds and one call before failing, and ZR-11 took 37.353 seconds and four calls. Repairs remain a material source of cost and delay.

The 11 actual provider requests settled. The batch cost $0.22058343 from recorded usage, or $0.409291 conservatively, below its $1.25 cap. The current $8 round totals $2.29875822 by usage and $4.559932 conservatively, leaving **$3.440068** of authorization. These are provider estimates, not an account-balance or invoice check. The historical $7.887898 campaign remains separate.

Before any transport ran, an earlier harness invocation stopped on a request-binding mismatch. Its table-legend identifiers were derived from random Reader passage IDs. The isolated app retained a pending local reservation, but no provider request was sent. That immutable result is retained separately with a zero-dispatch explanation in the subsequent driver; its reservation is not reported as a provider charge. The binding helper now validates both the full deterministic-context hash and each derived legend identifier before normalizing the declared random passage IDs. Changed source text, section, table meaning, citation binding, model, tier and token ceilings remain detectable. Two independent HTTP captures match for all four questions.

The backend changes are in `2b02066e6`; the corrected confirmation harness is in `417f00816`. The full offline Research suite, Zoning safety/planner contracts and retained architecture regressions passed. The all-110-question source diagnostic preserved 47 authored section pins and eight exact selected passages, with source changes confined to ZR-02 and ZR-05. All 30 live source hashes match the recorded commit, and every live initial request matches its canonical HTTP preflight.

Unique coverage remains 83 of 110 questions attempted, with 27 unattempted. The next work is offline repair of the failures above, then the remaining oversized/visual Zoning evidence and DOB guidance-routing cases. The full-scope source diagnostic retains an older historical-ledger summary; use the latest round cost audit for current coverage and authorization. No Project, Notebook, Report, export, phone or rendered UI workflow was tested. No push or deployment occurred.

Amendment-history evidence is explicitly a supplied corpus snapshot. The attempted official endpoint refresh did not succeed; current amendment completeness remains unverified. Metadata is not a reconstruction of historical enacted requirements.

Retained records under `permitext-sync-server/evals/results/`:

- `research-owner-api-round2-zoning-source-repair-v2-preflight-2026-09-09.json`
- `research-owner-api-round2-live-zoning-source-repair-v2-2026-09-09.json`
- `research-owner-api-round2-zoning-source-repair-v2-cost-audit-2026-09-09.json`
- `research-owner-zoning-source-repair-answer-review-2026-09-09.json`
- `research-owner-full-scope-zoning-source-repair-2026-09-09.json`

Both live drivers are consumed. Further paid confirmation requires a new bounded package after the relevant offline fixes pass.

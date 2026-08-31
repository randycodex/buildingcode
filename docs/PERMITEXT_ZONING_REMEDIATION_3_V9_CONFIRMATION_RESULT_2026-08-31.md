# Permitext Zoning Research — remediation successor 3 v9 confirmation result

Date: August 31, 2026

Source branch: `codex/zoning-research-beta1`

Authorization package commit: `571367800030d49a103a999090eaa615baa361ec`

Execution commit: `17fea6186d35a43348c5b73f419ccc9014dfb374`

Machine-evidence commit: `6c96b98bea80975b335b5680b02944adabab0749`

Dataset SHA-256: `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`

Run ID: `00570309-e1f2-441b-9f09-8df4f0603253`

## Authorization and boundary

The owner explicitly authorized exactly package commit `571367800030d49a103a999090eaa615baa361ec` for all 30 ordered remediation-successor-3 cases, one repetition, with a maximum cumulative API spend of `$5`. The only `permitext-sync-server` change from that locked package to execution commit `17fea6186d35a43348c5b73f419ccc9014dfb374` was the fresh authorization record. Authorization ID `9aaade99-759b-41d6-ad73-3ef9b4a168f9` entered its durable, non-reusable running state before dispatch and is now `consumed` by this run.

The package retains reviewed v9 repair commit `1fae244d775192f55f0fd6ee17d90cb82648ba01`, Zoning safety SHA-256 `56b945d1a29405bd9b3e41c44909ec69a70c043a03464b9b35b9e82245ab5e71`, Research economics SHA-256 `d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0`, application SHA-256 `1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797`, and the exact historical v8 package, authorization, execution, and result hashes.

Provider web support was disabled, and no operation requested or searched the web. The runner stopped after the first execution error. This authorization did not enable the disabled 24,000-character evidence candidate, public Zoning Research, deployment, merge, push, pricing or allowance changes, professional Zoning sign-off, or customer charges. No further paid run is authorized.

## Retained terminal result

- Status: `partial`.
- Evidence preflight: 30/30 ready before provider dispatch.
- Attempted operations: three, in the exact frozen order.
- Completed operations: two; both passed grading at 4.00/4.
- Failed operation: one; it failed closed before grading and did not consume a user turn.
- Unattempted operations: 27 because the stop-on-first-execution-error guard halted the run as designed.
- Paid requests: 10 settled and zero pending.
- Total settled evaluation spend: `$0.299904`, exactly matching the reconciled conservative reservation and remaining below the `$5` cap.
- Production-operation requests and cost: eight requests and `$0.268796`.
- Independent-judge requests and cost: two requests and `$0.031108`.
- Failed production work cost: `$0.092345`.
- Charging integrity: the two completed turns used only the isolated evaluation grant; the failed operation recorded `charged: false`; no customer account was involved.

Machine evidence:

- `permitext-sync-server/evals/results/2026-08-31T17-22-10-000Z-00570309-e1f2-441b-9f09-8df4f0603253.json` — SHA-256 `ad43aee5d7d9038eef1de09f1b9595b779abe4bcb7199421e5a905807380c9d6`.
- `permitext-sync-server/evals/results/2026-08-31T17-22-10-000Z-00570309-e1f2-441b-9f09-8df4f0603253.md` — SHA-256 `46a1f7c0b299ac1e1b6234f19e34a557389dcde2381f89c253802ef2152f30ad`.
- `permitext-sync-server/evals/zoning-successor-remediation-3-v9-confirmation-paid-authorization.json` — consumed-state SHA-256 `ffa134fc6f2855264ff54c8b285ba49f3bb16ab908b712072854d61bc2eb39e4`.

## Case outcomes

Passed grading:

- `zr-rules-of-construction` — 4.00/4; three production requests; `$0.087449` production cost.
- `zr-use-group-table` — 4.00/4; three production requests; `$0.089002` production cost.

Failed closed before grading:

- `zr-appendix-map-boundaries` — two production requests; `$0.092345` failed-work cost; `RESEARCH_VERIFICATION_FAILED` after the initial answer and one bounded revision both encountered `zoning_missing_mapped_location`.

The remaining 27 ordered cases were not attempted. Neither case changed by remediation successor 3 reached execution, so this result does not semantically confirm either owner-approved correction.

## Privacy-bounded failure classification

Unlike the v8 result, v9 retained two bounded diagnostic records without retaining generated answer text, customer identifiers, provider request identifiers, or raw message content. Both attempts recorded:

- `sourceBoundaryQuestion: true`;
- `citedAppendixJ: true`;
- `mappedLocationBoundaryPresent: true`; and
- only triggering clauses with `directConclusion: true`, `sourceRule: false`, and `locationBoundary: false`.

The first attempt retained nine triggering clause records and the bounded revision retained 11. Duplicate clause hashes across answer fields show that the same classified clause can appear in more than one structured representation; they do not reveal its text.

This rules out the narrow explanation that the complete response omitted every mapped-location boundary. It localizes the stop to clause-level classification: the complete answer contained a recognized boundary, but each triggering clause was still read as a direct conclusion rather than a source-level rule or boundary clause. The retained hashes and flags cannot determine whether those clauses were acceptable generic Appendix J statements that v9 failed to recognize or unsafe parcel/site conclusions that properly remained blocked. Therefore the result does not justify broadening the recognizer, weakening the parcel guard, or rescoring the failed operation.

Any further engineering must begin with no-cost reproduction against safe source-level variants and matched unsafe parcel-specific counterexamples. A future semantic rerun, if still justified after that work, would require a distinct locked package and a new exact owner authorization; this consumed authorization cannot be reused.

## Subsequent no-cost v10 diagnosis

The required no-cost diagnosis reproduced the retained v9 shape without a provider call. Twelve clear source-level Appendix J variants each included the recognized parcel/map boundary, but v9 still classified their repeated structured clauses as direct conclusions rather than source rules. This confirms a bounded false-positive wording family; it does not reveal or rescore the unavailable paid answer.

Prospective Zoning safety v10 adds recognition only for six explicit generic forms: Appendix J maps designating areas where self-service storage is regulated; selected Appendix J material describing regulated areas; generic facilities located in a named Subarea; generic conditional facilities located in a named Subarea; source-level treatment shown on Subarea maps; and source-level treatment for areas mapped in a named Subarea. Six matched Acme Center, this-site, proposed-facility, property, and project conclusions remain blocked by `zoning_missing_mapped_location`. The six exploratory forms not covered by those narrow rules also remain blocked.

The consumed v9 guard now validates its reviewed safety, economics, and application bytes from historical commit `1fae244d775192f55f0fd6ee17d90cb82648ba01`, rather than requiring future working files to remain byte-identical. Its authorization, retained results, hashes, and outcome are unchanged. The safety contract and consumed-authorization contract pass, and the frozen 30-case mock preflight reports 30/30 evidence-ready with credentials unset, zero provider tokens, and zero paid calls. This is prospective no-cost engineering evidence only: no semantic confirmation, paid authorization, rescore, public enablement, merge, push, deployment, pricing change, or allowance change occurred.

## Economics and reliability

The two completed turns cost `$0.088225` mean/p50, `$0.088847` p90, and `$0.089002` maximum in production-operation cost. Including failed production work gives `$0.134398` per completed turn and a mechanical projection of `$13.44` per 100 all-Zoning turns. Completed-turn latency was 21.593 seconds mean/p50, 26.280 seconds p90, and 27.452 seconds maximum.

This projection is not decision-ready. The run completed only two turns against the 20-turn minimum, stopped at the third case, and did not reach either changed remediation-successor-3 case. The result records `sampleReady: false`, `targetReady: false`, and `readyForPricingDecision: false`. The `$13.44` figure is a non-controlling partial signal. Remediation successor 2's `$20.18` failed-work-amortized projection per 100 all-Zoning turns and `$20.72` 100%-Zoning mixed-month p90 remain controlling for current risk planning.

## Decision and next gate

Retain this result as an integrity-valid terminal partial diagnostic, not as a complete 30-case v9 confirmation. Do not enable public Zoning Research or the 24,000-character candidate, change the `$20` price or 100-turn allowance, merge, push, or deploy from it. Semantic, reliability, cost, exact-release web/TestFlight physical-iPhone, and final public-release gates remain open.

The no-cost clause diagnosis and bounded prospective v10 repair are complete. The next Zoning step is an independent no-cost review of the v10 diff and its matched safe/unsafe regression boundary. Only after that review may a distinct confirmation package be considered. Do not run another paid confirmation without a new reviewed locked package and explicit exact-package authorization.

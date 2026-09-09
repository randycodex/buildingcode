# Conditional source claims: local validation repair

The retained ZR-03 and repaired ZR-20 responses exposed false rejections in deterministic answer checks. The local repair recognizes a withheld property finding, a bounded description of Appendix J, and the cellar exclusion's qualified application. It still rejects unsupported property results, incorrect source IDs and an unqualified cellar classification. No new API request was made for this repair.

The regression contract reassembles the canonical sources from the authored questions and section references. It reuses only opaque source IDs from the retained responses; expected answers and grading instructions never become retrieval input. Actual provider drafts and the actual cellar repair are checked without rewriting them into passing examples.

| Retained response | Local result | Scope of the finding |
| --- | --- | --- |
| ZR-03 draft and repair | Deterministic controls and zoning safety pass | The checker recognizes the negative property finding and source-level map descriptions. Appended approval, permission to proceed and parcel-placement claims remain rejected. |
| ZR-06 draft | Conditional-plan controls pass; zoning safety still fails | Its nominal negative finding is recognized. Other mapped-clause handling and the mixed-source attribution defect remain open. This draft is not accepted. |
| ZR-20 draft | Deterministic controls pass; zoning safety still fails | The phrase “excluded from zoning floor area” satisfies the source-bound obligation. Its unqualified supporting-point classification still must be rejected. |
| ZR-20 retained repair | Deterministic controls and zoning safety pass | Its conditional conclusion and qualified supporting point are recognized. This is local checker validation, not a new delivered answer or full quality acceptance. |

The earlier API-result review of ZR-20 was preliminary. Reproduction confirmed both a checker defect and a real first-draft defect: a qualification elsewhere in the answer cannot excuse an unqualified supporting point. The retained repair corrects that point. The historical API result remains failed verification.

The source-binding check continues to require the correct supplied source identity. The map descriptions are closed source-subject patterns, so they cannot absorb an appended property determination. Cellar qualifications remain scoped to their paragraph and answer field. An explicitly conditional lead may govern its derivation; merely mentioning an unresolved fact, or saying the owner “provided” documents, does not qualify a later conclusion. Adversative and separate-paragraph conclusions are checked independently.

Validation covers the retained responses, equivalent negative findings, formatted qualifications, wrong source IDs, removed missing facts and appended unconditional conclusions, including claims in supporting headings and limitation text. The new contract is included in `npm run test:research-chat`. That full suite, the separate zoning safety and planner contracts, syntax checks and `git diff --check` all passed locally with no paid calls.

Final logs are `/tmp/permitext-section-reference-quality-full-suite-final-20260909.log`, `/tmp/permitext-section-reference-quality-safety-final-20260909.log` and `/tmp/permitext-section-reference-quality-planner-final-20260909.log`. The earlier failing local regression is retained separately; it exposed an overbroad paragraph qualification, which was tightened before the final suite. No original paid result was overwritten or relabeled.

Runtime identities changed to compiler `20260909-conditional-source-coverage-v26`, conditional explanation `20260909-conditional-source-explanation-v3`, and safety `20260909-zoning-qualified-source-claims-v22`.

The remaining work includes respecting the supplied historical exclusion in ZR-19, correcting ZR-06 attribution, reducing duplicate explanation and output-limit retries, faithfully projecting noncontiguous selected fragments, and completing the wider 110-case answer review. These local results establish neither a live speed improvement nor cost per quality-accepted answer.

The current round's conservative ledger remains $7.283466 of its $8 authorization, leaving $0.716534; its usage estimate remains $3.83473987. No provider invoice or account balance was read. Project workflow, UI, phone and deployment testing were outside this repair.

Evidence: `permitext-sync-server/evals/fixtures/research-section-reference-live-diagnostics-20260909.json`, `permitext-sync-server/evals/results/research-owner-api-round2-section-reference-cost-audit-2026-09-09.json`, `permitext-sync-server/tests/research-section-reference-quality-contract.mjs` and `permitext-sync-server/tests/research-zoning-conditional-explanation-contract.mjs`.

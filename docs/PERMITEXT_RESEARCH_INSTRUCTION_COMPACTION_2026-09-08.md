# Research instruction compaction — 2026-09-08

The interpretation generator now combines repeated instructions and includes specialized code hints when the supplied source scope or question calls for them. This is a local change; it has not been pushed or deployed.

The final no-network comparison exercised all 110 owner questions: the additional 60 code questions plus the original 50 reconciled questions/scenarios and their supplied Project facts. Mean instruction size decreased from 24,714.81 to 17,614.58 bytes (28.7%); aggregate complete request size decreased 11.3%. No generated answer or reference answer was supplied to this comparison. These are serialized request sizes, not tokenizer counts, latency results, or full-service cost measurements.

The comparison uses actual automatic retrieval and the old/new production request builders. The question/fact/evidence input, strict output schema, model, reasoning, output allowance and final-verifier request are identical for each case. It does not reconstruct the original cases' selected-passage pins or retrieve returned web content. Separate targeted contracts check selected-text preservation, prior-edition labels, conversation facts, hypothetical and unknown facts, owner representations, web claim identifiers/limitations, original image payloads, invalid-image rejection, and the official-guidance-only boundary.

The existing answer sequence remains: direct answer, cited governing rule, application or calculation, and material qualifications. Missing material facts, source-specific web attribution, exact selected passages, required claims, ancestor applicability, alternative conditions and the final semantic verification gate remain required. Specialized hints include parent sections that may contain the relevant subsection; similar numeric prefixes are not mistaken for parent scope. Forty instruction edits have an explicit before/after preservation record.

The prototype's long version suffix exposed the existing 256-character saved Research system-version limit during an HTTP replay. The shorter `compact-v1` suffix fits that format. Recorded-answer HTTP tests then passed. No storage limit was relaxed.

Evidence:

- `permitext-sync-server/evals/research-answer-instruction-compaction-audit-20260908.json`: baseline commit/hash and instruction crosswalk.
- `permitext-sync-server/evals/results/research-instruction-compaction-comparison-2026-09-08.json`: all 110 comparisons and hashes of unchanged policy dependencies.
- `permitext-sync-server/evals/results/research-owner-compact-request-envelopes-2026-09-08.json`: all 60 owner request bounds using a versioned local pricing fixture.
- `permitext-sync-server/tests/research-instruction-compaction-contract.mjs`: targeted input and policy-boundary checks, included in `test:research-chat`.

At preparation, the 15 prior paid packages contain 135 provider calls, zero pending requests, and $7.597436 cumulative conservative usage against the $8 authorization. The remaining conservative authorization is $0.402564. This accounting is deliberately more conservative than token-usage estimates and is not a provider invoice or account balance.

The new one-use compact confirmation package is bounded to that remaining $0.402564, with at most two case attempts: PC-04 (laundry floor drain and lint-strainer citation repair), then PC-10 (water-heater pan). It requires a no-network preflight on the exact committed source, validates all 15 prior terminal ledgers, stops on unsettled accounting, and skips a subsequent turn if its initial request cannot be reserved from the remaining budget. It does not add a paid judge or manual retries. PC-04's initial draft ceiling is $0.402300; PC-10's is $0.271750. Initial draft fit does not guarantee that every subsequent verification/revision request will fit.

Answer quality and commercial readiness remain unproven across the full 110-case scope. The CC-04 answer-key amendment still awaits professional review; historical live results have not been rescored. Smaller instructions must be assessed through actual answer delivery and source-based review before claiming an accuracy or speed improvement.

The primary-source refresh for the planned live review confirmed the laundry room floor-drain, three-inch outlet and lint-strainer rule in [PC 412.4](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161608), and the leakage-damage trigger and permitted pan construction in [PC 504.7](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161890). These sources were reviewed separately from the answering model inputs.

Validation completed: `npm run check` passed on the final source, including its precheck and application contracts. `npm run test:research-chat` and the targeted compaction contract passed. The recorded plumbing accept/reject replays, revision verification, PDF checks and ramp spend-reservation checks are included. These checks make no paid model calls. An earlier broad run was invalidated when concurrently generated diagnostic files changed a result-directory snapshot; the final successful broad run was serial with respect to those writes.

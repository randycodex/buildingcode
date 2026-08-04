# Code Question Workspace Phase 5 Notes

Phase 5 adds a bounded analysis workflow and keeps the professional conclusion as a separate, human-authored artifact. The Code Question capability remains disabled by default and no production deployment is included.

## Delivered

- Approved Evidence, Bounded Analysis, and Professional Conclusion panes for the Analyze stage.
- A question-bound server command that resolves the canonical question definition, selected inputs, approved Evidence Set, and immutable evidence snapshots before generation.
- Approved-evidence-only citation validation. Candidates, mutable conversation selections, and hidden corpus text cannot become authority for a question analysis.
- Immutable Research answers paired with immutable `questionAnalysis` descriptors, including exact dependency hashes, structured citations, assumptions, missing facts, limitations, conflicts, and requests for additional evidence.
- Idempotent request replay and in-process single-flight generation so concurrent duplicate requests do not consume a second reservation or lose an answer.
- Staleness detection whenever the definition, input, Evidence Set version, or dependency hash changes.
- Explicit **Use as starting point** and **Transfer citations only** actions.
- Separately revisioned professional conclusions with author attribution, citation selection, and AI-assistance disclosure. A professional can skip AI and write directly from approved evidence.
- Server validation at conclusion publication time to ensure citations still belong to the bound approved Evidence Set and any referenced analysis matches the question dependency hash.

## Compatibility and rollout boundary

- The capability still requires `PERMITEXT_CODE_QUESTION_WORKSPACE=1`; the public default remains off.
- A localhost-only `?enableCodeQuestionWorkspace=1` switch supports rendered development verification without enabling Production.
- The local fixture path demonstrates the bounded client workflow when a locally created question has not been hydrated into the server store. Production generation uses the existing Research generator through the question-bound server command.
- Phase 6 review requests, approval workflow, and review inbox are not included.

## Verification

- `npm run test:code-question`
- `node tests/offline-contract.mjs`
- `npm run smoke`
- Rendered local verification of approved evidence binding, bounded limitations and citations, starting-point transfer, and separately published professional conclusion.

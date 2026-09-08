# Research historical source readiness — local implementation

Research now recognizes more requests for the Zoning rule that applied on a past date and retains the missing dated-source prerequisite. Previously, “What did ZR Section 23-343 require on January 1, 2020?” could receive a current direct-rule plan. A statement such as “without official archived substantive text” could also mistakenly satisfy the archive requirement. Neither wording now permits generation from the current consolidated text.

## Behavior

The planner recognizes dated substantive-law questions, named older versions, requests for prior rules, and mixed property/history requests. It handles a follow-up such as “What did it require on January 1, 2020?” when the conversation establishes the Zoning context. Explicit references to Zoning transitions, amendments, history and rules also route to the Zoning corpus, subject to its existing eligibility rules.

An archive mentioned in the question or Project facts is not a resolved source. Statements that it is unavailable, available, hypothetical, or provided therefore cannot waive the dated substantive-text prerequisite. The currently authorized Zoning corpus contains consolidated current text; this change does not add ingestion or validation of historical archives. Such requests stop before provider dispatch, remain uncharged and cannot use the conditional property-explanation path.

Current transition questions and questions about the limits of current source metadata remain available under their existing checks. A dated project fact is not automatically a request to reconstruct old law. The retained City of Yes scenario, with application, permit and foundation dates, preserves its ready disposition. A noun phrase such as “issued the permit on December 4” must not be mistaken for a dated legal predicate.

## Verification

- The focused contract passed 20 date formats/months, 21 historical paraphrases, 40 archive-availability contexts, a mixed parcel/history request, 15 current-law/source-boundary controls, the retained transition scenario and three corpus-routing cases.
- Twenty-eight local HTTP flows passed through the real handler, source checks, accounting and conversation persistence. Twenty use the existing accepted, rejected, unsafe, unavailable-provider and malformed-response doubles for four conditional answer scenarios. Eight check historical boundaries, including a follow-up that preserves the previous current-rule answer while saving no new assistant answer. All provider responses are simulated; external calls are forbidden.
- `npm run check` passed before the final follow-up wording addition. The full affected `npm run test:research-chat` suite and `npm run test:zoning-architecture-v21` passed again on the final source. The final focused HTTP and historical-intent contracts also passed.
- The new [architecture snapshot](../permitext-sync-server/evals/results/zoning-history-intent-no-cost-preflight-2026-09-08.json) preserves the older retained snapshot. Its 30-case summary remains 25 ready and five prerequisite-boundary cases; the retained-answer replay preserves 16 accepted outcomes and rejects five known failed answers. These outcomes are offline regression results, not fresh live grades.

Implementation commit: `2ca722ff4d49db740f02cfb80a2430da9761d465`. The [full 110-case comparison](../permitext-sync-server/evals/results/research-owner-history-source-comparison-2026-09-08.json) verifies all 16 source/input hashes against that commit and all 19 unchanged paid-ledger hashes. Every authored input, retrieved source record and all eight exact selected passages remain unchanged from the preceding retained storage-source diagnostic. Every comparable case record is identical after excluding only run duration and the conditional response's prerequisite-plan hash, which binds the new planner version and historical-intent signal. The old and new prerequisite hashes remain recorded separately. Conditional eligibility remains ZR-06, ZR-07 and ZR-13, with their determinations unresolved.

The compact comparison references the preserved baseline, records the raw current diagnostic's hash, and includes per-case equality hashes and reproduction instructions. It checks the supplied question/scenario inputs, Project facts, selected passages, retrieved source records and planning/readiness behavior. It does not generate or grade answers.

## Limits and remaining work

Historical archive ingestion remains absent. The wording checks are tested cases, not proof that every possible historical phrasing is recognized. Current conditional explanations still leave the property determination unresolved. Source completeness problems outside this change, including shortened supplemental references, remain separately recorded in the [storage source report](PERMITEXT_RESEARCH_STORAGE_SOURCE_COVERAGE_2026-09-08.md).

No paid API calls, push, deployment, phone test or full-service latency measurement occurred in this pass. The 19-package conservative campaign ledger remains $7.853484 of the authorized $8, leaving $0.146516. This is an authorization calculation, not a freshly retrieved provider balance. Live campaign coverage remains 41 of 110 owner cases attempted, with 69 not yet attempted through a live provider. Attempts are not synonymous with accepted answers. The broader quality goal remains open.

# Research conditional explanations — local implementation

Research now has a response scope for explaining cited Zoning rules when missing property facts prevent the requested determination. It uses the ordinary answer schema, citation checks and independent semantic verifier. Production code does not import the evaluation key or handwritten test answers.

## Behavior and limits

The original property-prerequisite plan remains unchanged and allows zero provider calls for a determination. A separate, hashed response plan can permit a conditional explanation after source selection and evidence-readiness checks pass. It retains the original plan hash, all missing facts and an explicit `determinationStatus: unresolved`. Only missing property identifiers, official mapped status and the identified historical lot condition are eligible. Missing dated substantive law or MIH establishment/configuration evidence remains on the prerequisite path.

Both drafting and verification receive the conditional scope. The answer must lead with the unresolved determination, explain the supplied rules with citations and retain material missing facts. A generic request for more information does not satisfy this scope. Rejected answers cannot be replaced with a saved generic boundary. Existing model tiers and monetary ceilings remain in effect; this path permits one draft and one verifier request, with no transport retry, structured-output retry, repair, model evidence-analysis call or web-search call.

The mapped-location checker now recognizes an unresolved “cannot determine whether…” predicate and plural “do not establish” wording. It also recognizes direct approvals, prohibitions and owner/applicant permission claims, including coordinated clauses. These changes prevent a boundary at the beginning from excusing a later property result.

## Verification

- `npm run check` passed, including `test:research-chat` and the new conditional contracts. The separate `npm run test:zoning-architecture-v21` check also passed. These are local source, behavior and governance checks, not deployment or device acceptance.
- The conditional contract uses the actual authored ZR-06, ZR-07 and ZR-13 inputs and section pins through corpus planning and assembly. It preserves the original prerequisite plans and checks source failure, unknown prerequisite, call-limit, missing-fact and citation failures. Twenty appended-property-result controls are rejected; alternate negative leads remain accepted.
- Sixteen local HTTP flows exercise the actual handler, source validation, gates, accounting and saved-answer retrieval. Fifteen cover the three questions with accepted, verifier-rejected, unsafe, unavailable-provider and malformed-draft doubles. The remaining flow confirms that a request to reconstruct historical substantive text stops before provider dispatch. Every provider response is simulated; none is evidence of live answer quality.
- HTTP success cases use actual Reader selections: the three exact canonical storage-context spans plus ZR 42-193; the full ZR 11-14 passage; and the full ZR 23-343 passage. This is distinct from the complete authored section-pin assembly contract. Test answers are bound to every applicable selected passage and survive reopening with the conditional plan and evidence.
- A simulated 503 without usage retains its conservative provider-cost reservation, even though the user turn is unsaved and uncharged. It is not counted as free provider work. These temporary offline records do not change the live campaign ledger.
- The existing Zoning architecture preflight passed without changing its retained artifact: 16 accepted retained answers keep their outcomes and five known failed answers remain rejected.
- The 110-case source comparison preserves every authored input hash, source record and exact selected passage from the preceding storage-context diagnostic. Only ZR-06, ZR-07 and ZR-13 become eligible for the separate conditional response scope; their property determinations remain unresolved. This inspection makes zero network/provider calls and does not upgrade live campaign coverage.

The governing source wording used to inspect the test doubles was checked against [ZR 42-192](https://zr.planning.nyc.gov/article-iv/chapter-2/42-192), [ZR 23-343](https://zr.planning.nyc.gov/article-ii/chapter-3/23-343) and [Chapter 1, including ZR 11-14](https://zr.planning.nyc.gov/article-i/chapter-1). This does not constitute professional approval of the reference keys.

## Remaining work found during this pass

1. A full, long Reader selection of ZR 42-192 is still shortened by the existing per-source/fair-share limits, losing closing conditions. The successful HTTP fixture uses exact, individually selected canonical spans within those limits. It does not prove that the long-selection case is fixed.
2. Unpinned self-storage chat retrieval returned Appendix J, ZR 42-192, ZR 12-10 and ZR 42-19. It did not supply ZR 42-193, and the storage source omitted the closing existing-facility documentation text. Conditional response eligibility alone does not establish completeness; generation and verification still have to reject unsupported claims. Automatic retrieval needs the same material-condition coverage as the selected-source case.
3. Historical routing remains too dependent on wording. “What did ZR Section 23-343 require on January 1, 2020? Reconstruct the rules in force.” currently receives a direct-rule plan rather than the historical-text prerequisite. A mention of “official archived” text can also be mistaken for availability even when prefaced by “without.” These are existing planner gaps, not resolved by this response-scope change. The passing HTTP boundary control explicitly asks to reconstruct the text in force under the NYC Zoning Resolution.

No paid API calls, push, deployment, phone test or new full-service latency measurement occurred. The earlier 19-package conservative authorization ledger remains $7.853484 of $8; the remaining $0.146516 is an authorization calculation, not a verified provider balance. Live campaign coverage remains 41/110 owner cases, and the full quality goal remains open.

# Research API confirmation under the new $8 authorization

The new round exercised real provider calls through the isolated local Research HTTP flow. It found useful improvements and remaining defects; it does not establish commercial readiness. UX/UI work can proceed in a separate worktree. The backend and routing stayed fixed during each paid batch. Project, Notebook, Report, export, reopening, phone and rendered UI workflow testing remain deferred at the owner's request. Nothing was pushed or deployed.

## Measured results

The [retained cost audit](../permitext-sync-server/evals/results/research-owner-api-round2-cost-audit-2026-09-08.json) independently reconstructs every recorded provider call, including cache writes, verification, rewrites, failed attempts and actual web-search fees. It verifies the five package hashes and settled accounting. The new $8 authorization is separate from the historical campaign's $7.887898 conservative ledger.

| New-round measure | Recorded result |
| --- | ---: |
| Research HTTP attempts | 30 |
| Delivered / undelivered attempts | 26 / 4 |
| Distinct questions in this round | 27 |
| Actual provider requests | 72 |
| Usage-derived API estimate | $1.40369853 |
| Conservative authorization ledger | $2.810965 |
| Remaining allowance under the new $8 cap | $5.189035 |
| Cost of failed attempts, included above | $0.24557093 |
| Delivered-answer duration, median / p90 | 12.235 / 30.125 seconds |
| Delivered-attempt API cost, median / p90 | $0.03715402 / $0.07991744 |

The estimate uses the standard short-context [OpenAI rates](https://developers.openai.com/api/docs/pricing) checked on September 8, 2026. Neither number is an invoice or a current account-balance reading. Historical costs were not subtracted from this separately authorized round. The audit's `previouslyOmittedCacheWritePremiumUSD` is the premium the former estimator would have omitted; that premium is already included in this round's estimate.

These are local server-to-provider measurements across development versions, repeated cases and a deliberately selected sample. They exclude UI rendering and are not a controlled speed comparison, representative customer-month forecast, or cost per quality-approved answer. No separate paid judge was added. The $20/month baseline, included turns, model routing and per-turn spending guards were not changed.

Across both campaigns, 67 of the 110 numbered cases have now reached a provider, including 57 of the added 60 code cases. The other 43 remain unattempted. A supplemental historical PDF case is counted separately, not as a 111th numbered case or an extra completion. Attempted coverage is not a pass count.

## What the live checks established

The [answer review](../permitext-sync-server/evals/results/research-owner-api-round2-answer-review-2026-09-08.json) retains the latest answer, supporting points, assumptions, missing facts, verifier history and source binding for each of the 27 distinct cases. Development review found 21 core matches, four delivered answers with explicit quality gaps and two latest cases without a deliverable. These are core-answer findings, not independent professional approval of every optional statement.

- **Work-commencement facts:** Research previously treated “no work has begun” as uncertain simply because the statement contained a negative. The new fact handling preserves a definite negative commencement statement, while uncertain, hypothetical and reported statements remain qualified. Corrections can replace the negative with commencement or with an unknown. GAP-06 now accepts the supplied premise and applies the 14-versus-12-month expiration rule without a rewrite. It still unnecessarily reopens a special-preservation qualification excluded by the scenario.
- **Supported drafting:** The revised prompt requires a definition-based classification to bind its definition to the same point as the operative rule, and discourages unneeded collateral claims. MC-01 now supplies the definition support and omits the unsupported “windows may remain” assertion. PC-04 and PC-10 returned the laundry-drain and heater-pan conclusions with their material conditions on the first verification attempt.
- **Date applicability:** Both new ZR-18 attempts retain the distinction between the assembly year and an unknown applicable amendment date. They still extend district consequences without the residential-district proviso. Deterministic verification passing does not close that whole-answer defect.
- **Citation checking:** GAP-15 required a rewrite to bind both the scope and continuation provisions to its contractor-belief conclusion. The final answer did so. MC-15 and GAP-14 reached correct central conclusions but failed on ancillary authority or citation binding, and their full rewrites could not fit the existing turn limit. The failed outputs were not delivered as accepted answers.

The [versioned ZR-18 amendment](../permitext-sync-server/evals/research-answer-key-amendments.json) and [rendered development key](PERMITEXT_RECONCILED_RESEARCH_ANSWER_KEY_2026-09-07.md) correct the older reference's unsupported temporal inference. The question, selections, original source record and historical approval remain unchanged. Current official [77-02](https://zr.planning.nyc.gov/article-vii/chapter-7/77-02), [77-11](https://zr.planning.nyc.gov/article-vii/chapter-7/77-11) and [77-22](https://zr.planning.nyc.gov/article-vii/chapter-7/77-22) support the correction. The revised development rubric remains pending professional review. It was not supplied to any model in these paid tests. The legacy original-cohort evaluator also checks amended references before paid dispatch rather than treating the old reference as current.

## Internet and PDF observation

GAP-08 used the existing automatic web-support path. One provider request performed three billed search/open actions, including opening official NYC PDFs. The whole turn took 22.863 seconds and cost about $0.07762. Its final revocation answer relied on the already assembled enacted provisions and cited no web source. The web-support request itself cost $0.0356373; this is evidence of potentially avoidable search in this case, not proof that web support is unnecessary generally.

This batch verifies provider web access, including PDF URLs. It does not independently revalidate the application's stricter official-PDF extraction and attribution path; those paths are covered by the offline PDF contracts, with earlier live PDF evidence preserved in the historical campaign. Internet search should remain available when official guidance, external authority or a genuine source gap is material. A narrower trigger for code questions already resolved by enacted text is a follow-up hypothesis to test.

## Remaining work exposed by this round

| Finding | Cases | Next useful change |
| --- | --- | --- |
| Missing material qualification | ZR-18 | Carry the source's residential-district proviso through any expanded-consequences explanation. |
| Reopening facts or issues outside the asked decision | FGC-12, GAP-06, GAP-07 | Keep only unresolved facts that can change the scoped answer; preserve explicitly supplied premises. |
| Nonessential claim or incomplete point binding causes a full rewrite | MC-15, GAP-14 | Improve initial claim scope and binding; assess a bounded repair with final verification retained. |
| Initial request exceeds the turn guard | MC-09, MC-13 | Remove irrelevant retrieval matches while preserving full governing provisions, exceptions and references. |
| Automatic web step leaves insufficient room for the next request in preflight | GAP-03 | Check whether enacted evidence already resolves the scoped question before searching. |

The [remaining-case HTTP preflight](../permitext-sync-server/evals/results/research-owner-api-round2-remaining-code-preflight-2026-09-08.json) intercepted every provider call, spent no API funds and left no pending reservations. MC-09, MC-13 and GAP-03 were excluded from the subsequent paid batch because that preflight hit the existing turn guard. GAP-08 alone was dispatched and completed. No larger turn cap or model substitution was used to force completion.

The full offline Research chat suite passed, covering fact state, source assembly, HTML/PDF attribution, answer structure, edition boundaries and isolated Research HTTP checks. The final key-specific contract also passed after the last wording refinement. The [verification record](../permitext-sync-server/evals/results/research-owner-api-round2-verification-2026-09-08.json) binds these checks and all 97 paid-package source-hash entries to their recorded commits. General project workflow and release checks are outside this verification.

Reproduce cost accounting without credentials or network access:

```sh
node permitext-sync-server/scripts/report-research-owner-api-round2-20260908.mjs
```

The paid package drivers are single-use historical records. Their result locks and source/preflight hashes prevent replay; do not reuse them as fresh authorization.

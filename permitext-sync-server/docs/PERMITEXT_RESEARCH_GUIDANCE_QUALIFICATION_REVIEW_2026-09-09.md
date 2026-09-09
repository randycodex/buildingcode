# Research guidance qualification review — September 9, 2026

The two latest live workflow answers were delivered and received passing verifier results while still omitting material conditions. Their unchanged benchmark assessment and cost ledger are retained in `PERMITEXT_RESEARCH_WORKFLOW_COVERAGE_2026-09-09.md`. This local repair strengthens the verification contract; it does not establish corrected live answers.

## Implementation

Official guidance prompt v7 requires the existing semantic verification call to review every supplied passage, including uncited passages. Each passage receives a finding: addressed, missing or misstated, or not material to the question and volunteered claims. The review includes short exact condition quotations, references to actual draft paragraphs or gap fields, and a reason. Unknown facts must not be used to dismiss a material conditional requirement; unrelated topics do not require a checklist.

The server binds the review to the complete question, facts, source text and draft. It rejects missing or duplicate passage reviews, stale bindings, invented or cross-passage quotations, nonexistent answer references and a top-level pass that also reports a missing condition. A pre-existing substantive verification failure remains a failure. The review cannot add an automatic retry or separate judge.

New saved guidance summaries use integrity version v2 and retain the source identifiers, document hashes, review and its digest. Existing v1 summaries remain readable with their prior integrity checks. Removing or changing the review invalidates a v2 record. These are integrity records, not signatures or professional approval.

The drafting response fields, model routing, 2,200-token draft limit and 1,800-token verifier limit are unchanged. The new review increases verifier input and output content within those limits; its actual latency, cost, omission detection and false-rejection rate require live measurement. Larger source packets could exhaust the output allowance. No new semantic success is inferred from the local fixtures.

## Verification and scope

The focused qualification-review and existing guidance-summary contracts passed, covering contradictory approvals, omitted review entries, stale inputs, invalid quotation/reference bindings, preservation of an earlier failed verdict, legacy saved summaries and v2 review tampering. The isolated Research HTTP contract passed with simulated official documents and provider responses. It demonstrates that missing reviews and acknowledged omissions fail without additional calls. Fixtures test transport and rejection behavior; they do not constitute model-quality acceptance.

The full offline `npm run test:research-chat` suite passed (exit 0) with the API key removed from its environment. The standalone HTTP log is `/tmp/permitext-guidance-qualification-http-20260909.log`; the full regression log is `/tmp/permitext-guidance-qualification-suite-20260909.log`. JavaScript syntax and `git diff --check` also passed. No Project workflow, UI, phone, account pricing, push or deployment is included. All 110 numbered cases and their unchanged authored expectations remain in scope.

No new paid provider request was made for this repair. The conservative authorized-round total remains **$7.593176 of $8**, leaving **$0.406824**; the retained usage-derived estimate remains **$4.00698307**. Neither is a live account balance. Further paid confirmation needs a fresh committed-source preflight and single-use driver within the remaining authorization; consumed drivers must not be replayed.

## Next measurement

Compare the checker against the retained incomplete answers and complete source packets before accepting any new answer. A model can still incorrectly label a passage not material or claim that its condition is addressed. Confirm the actual live review, answer completeness, response length, elapsed time and total provider cost; preserve failed outcomes. Bind the new qualification-review module in the fresh driver's source manifest and retain the actual verifier input for audit, rather than relying on reconstruction. This repair establishes enforceable review structure, not a proof that the underlying judgment is correct.

## Live v7 comparison at `f8070a14b78bd55f0fc882353a00f552f01a3bfb`

The single-use qualification-review driver completed two unassigned Research HTTP turns after a zero-provider-call preflight. Both initial requests matched that preflight and the preceding comparison's initial request hashes. The questions and answer key remained unchanged. Actual draft and verifier request bodies are retained with only the isolated-account safety identifier replaced; their normalized hashes match the outgoing requests. Full verifier passages equal the initial source packets, including uncited qualifications.

| Case | HTTP result | Full duration | Draft | Verifier | Usage-derived estimate | Conservative cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| DOBNOW-023 | 502, verification rejected | 22.718 s | 5.234 s | 15.082 s | $0.02334030 | $0.043672 |
| DOBNOW-003 | 502, verification rejected | 19.221 s | 6.464 s | 11.242 s | $0.01884760 | $0.033988 |

The representative draft still omitted the conditional board attestation. The checker correctly identified that omission, but also objected to applicant submission despite support in the guide and companion FAQ, and demanded generic account setup beyond the requested permission question. Three copied quotations failed exact-substring validation, including ellipsis shortcuts. This is not a successful delivered answer.

The subsequent-filing draft now describes the conditional NB/Alteration-CO LOC exception and identifies the unknown job type. It still omits the filing-extension distinction, the creation-timing qualification and the complete initial-filing CO completion path. Its submission-timing sentence must not be misreported as an explicit universal prohibition on earlier creation. The provider passed this draft, but the server rejected an ellipsis quotation and a changed-capitalization quotation. The draft prompt was unchanged, so the improved LOC discussion is a different sample, not proof that the new verifier improves drafting.

The complete reviews and source links are retained in `evals/results/research-owner-qualification-review-answer-assessment-2026-09-09.json`, alongside the qualification-review preflight, live result and cost audit. These two observations show additional verification latency and no accepted delivery. They do not justify calling the checker commercially ready.

All four provider calls settled, with no paid search or retry. The package cost was **$0.04218790 by recorded usage**, or **$0.077660 conservatively**. The round now totals **$7.670836 conservatively**, leaving **$0.329164** under $8. The cumulative usage-derived estimate is **$4.04917097**, including cache-write rates rechecked on the [official standard pricing page](https://developers.openai.com/api/docs/pricing) on September 9. No account balance or invoice was checked. This consumed driver must not be replayed.

## Subsequent local repair: prompt v8 and qualification review v2

The server now creates numbered source spans using sentence boundaries. The checker selects span indices instead of copying source quotations. Each selected span is resolved to its exact source text before saving the review, and its passage, source hash and draft references remain bound. Catalogue generation preserves all original text, including whitespace and a complete merged tail when a source exceeds 128 spans. Altered catalogues, invalid or duplicate indices and stale inputs are rejected. Semantic failures still fail; this change does not certify that a selected condition was understood correctly.

The review instructions also require considering all cited passages together before alleging missing support, and distinguish material requirements from generic account setup and navigation details. Those judgments remain model-dependent and unconfirmed by a new live call.

The responsibilities FAQ alone opts into ranking complete, explicitly linked question-and-answer pairs within its declared headings. Shared preambles or other non-FAQ material retain whole-section handling, and each selected FAQ keeps its complete question, answer and heading. The subsequent-filings section retains whole-section handling so adjacent timing and completion qualifications remain available.

A fresh public-document check selected 3,166 characters from the responsibilities FAQ instead of 12,540, with the role prohibition, owner attestation and applicant-submission context preserved. Every selected claim is an exact substring of the earlier full section text. This is a reduction in that FAQ component, not a measured reduction in overall Research time or total request size. Evidence is `evals/results/research-owner-stakeholder-faq-focus-2026-09-09.json`.

The span catalogue duplicates source text inside the verifier input but reduces copied output. Its net token cost and latency require measurement. Source selection, the isolated PDF HTTP contract, focused qualification/HTML/saved-summary contracts and the full offline Research suite all passed. Logs are under `/tmp/permitext-guidance-qualification-live-20260909/` (`source-selection.log`, `span-http.log`, `span-suite.log`). No further paid calls followed the local repair. All 110 numbered cases and remaining benchmark gaps are preserved; the next live comparison requires a new committed-source preflight and an affordable single-use package.

## Live v8 comparison at `fa9cc6c9fe878bba92c6ccd127aac470a67fa2dd`

The source-span driver completed the same two unassigned Research HTTP turns once each. The first preflight's top-level `preflight-passed` label includes a blocked DOBNOW-023 result: the initial reservation exceeded its $0.15 turn cap. It dispatched no provider requests. The final v2 preflight used a $0.20 turn cap within the unchanged $0.30 package, intercepted both initial requests and bound them to the live run. Both preflight files are retained. Never replay the consumed live driver.

| Case | HTTP result | Full duration | Draft | Verifier | Usage-derived estimate | Conservative cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| DOBNOW-023 | 502, verification rejected | 23.673 s | 5.722 s | 15.101 s | $0.02117625 | $0.039583 |
| DOBNOW-003 | 200, delivered | 16.074 s | 6.953 s | 7.640 s | $0.01932405 | $0.035078 |

Both source-span reviews are structurally valid. Every original passage is reproduced by its spans; both actual verifier packets contain the complete initial passages; retained request hashes and preflight bindings match. The quotation-copying failures did not recur. These are integrity findings, not proof of semantic accuracy.

The representative draft again omitted the conditional board attestation, which the verifier correctly rejected. The previous generic account-setup objection disappeared. The verifier still objected to applicant submission, despite the guide's owner-authorization context. A direct official job-filing submission instruction was absent from this packet. Unasked DPL-1 and navigation details also lengthen the draft.

The plumbing answer was delivered and preserves the filing extension, different-applicant option, separate application processing and conditional LOC versus NB/Alteration-CO initial-CO completion path. It explicitly says the initial filing must first be submitted and the subsequent filing can then be initiated. Its complete FAQ also acknowledges a subsequent filing created before initial submission, so the universal initiation sequence fails the unchanged benchmark. Unlike the preceding v7 sample, this sample does make an initiation claim. It also leaves `missingFacts` empty without explicitly identifying the unknown initial job type, and includes unasked form-entry instructions. The valid review receipt nevertheless accepts the timing claim. This remains a semantic false acceptance, not a benchmark pass.

The complete manual assessment, drafts, verifier verdicts and actual-request hashes are retained in `evals/results/research-owner-source-span-answer-assessment-2026-09-09.json`. Neither case is accepted as a complete benchmark pass. All 110 numbered cases remain in scope; delivery history across mixed revisions must not be presented as current accuracy.

All four calls settled with no paid search, retry or separate judge. This package cost **$0.04050030 by recorded usage**, or **$0.074661 conservatively**. The authorized round now totals **$7.745497 conservatively**, leaving **$0.254503** of $8. The cumulative usage-derived estimate is **$4.08967127**. No account balance or invoice was checked. These two duration observations do not establish production latency or subscription economics.

## Subsequent local repair: prompt v9 and source catalogue v10

The drafting and verification requests now receive narrowly scoped, source-derived applicability questions before making general statements about required stakeholders or subsequent-filing timing. Each relationship retains the fetched passage's source ID, claim ID, content hash and exact whitespace-normalized excerpts. The full passages remain in both requests. A conditional actor relationship requires the source's Owner Type condition and its attestation prerequisite. The timing relationship requires both conflicting entries within the actual fetched FAQ. Source updates removing those conditions remove the hint. The detectors do not use case IDs or answer-key prose; they are limited source-pattern helpers, not general semantic proof or automatic answers.

The filing-representative source catalogue also adds the official [Filing through DOB NOW: Build](https://www.nyc.gov/site/buildings/property-or-business-owner/filing-through-dob-now-build.page) sections for attestation, final review/signature and job-filing submission. A public HTML snapshot with the complete selected steps is retained in `evals/fixtures/dob-filing-submission-source-20260909.json`. Its SHA-256 is `38d7efab08e1996809e6d209edf053f3d4da49e57b8a4d789f1f3277128aac2d`. Existing guide, responsibilities FAQ and release-note qualifications remain in the packet. Curated document binding can explicitly request four sources; ordinary binding retains its three-source default. The three declared submission sections bypass topic-keyword ranking so that a question mentioning attestation cannot silently discard the review and submission steps. Other FAQ selection behavior is unchanged.

The diagnostic request-hash normalizer validates source-relationship bindings and exact excerpts before normalizing ephemeral HTML identifiers. Actual outgoing and saved source identifiers remain intact. Future preflights must include the new `research-guidance-source-relationships.mjs` module in their source manifest.

Model routing, reasoning settings, output limits, semantic rejection and retry behavior remain unchanged. The added applicability questions and fourth source increase input content; their effect on live completeness, cost and duration is unconfirmed. No new paid call followed this local repair. Further confirmation requires a fresh committed-source preflight and a single-use package within the remaining authorization. No Project workflow, UI, phone, push or deployment is included.

The final local repair passed the full offline `npm run test:research-chat` suite (exit 0, API key removed), the focused source-selection contract and the PDF/HTML HTTP contract. The source-relationship regressions use retained real source packets to cover both model stages, original passage preservation, question-scope changes and changed source conditions. Diagnostic hash regressions reject invented source bindings or excerpts. The transport fixture reflows actual guide page 38 and tolerates its extracted `o f` spacing without altering the retained official text. Syntax checks for all ten changed JavaScript modules and `git diff --check` passed. Logs are under `/tmp/permitext-source-span-live-20260909/`, including `relationships-submission-suite.log`, `submission-source-selection-v2.log` and `submission-http-v3.log`. These checks establish local behavior only; v9 live quality remains unconfirmed.

## Live v9 comparison at `95a4f5a636759cb3dbe006ab855a720772fa3e47`

The fresh source-relationships driver completed both unchanged questions after a committed-source, zero-provider-call preflight. Its package cap was $0.24, with turn ceilings of $0.20 for DOBNOW-023 and $0.18 for DOBNOW-003. Both initial request hashes matched, complete passages and source relationships were preserved in the actual verifier inputs, and both review receipts were structurally valid. Four provider calls settled; no paid search, retry or separate judge was used. The driver is consumed and must not be replayed.

| Case | HTTP result | Full duration | Draft | Verifier | Usage-derived estimate | Conservative cost |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| DOBNOW-023 | 502, verification rejected | 21.043 s | 6.597 s | 12.000 s | $0.02603665 | $0.048211 |
| DOBNOW-003 | 200, delivered | 19.869 s | 10.277 s | 8.144 s | $0.02193915 | $0.039506 |

The representative draft now includes the expected actor-authority distinction, applicant review/signature/submission steps and conditional Board representative attestation, including the unknown Owner Type. The verifier accepts those points but rejects the answer solely for omitting the DPL-1 upload and form-age requirement. In the authored scenario the documents have already been uploaded; the question asks whether the representative can attest and submit, and the answer does not say every submission requirement has been satisfied. The extra readiness-checklist demand is therefore overbroad for this benchmark. The server properly retains the negative verdict. No code overrides it. The 186-word draft is also longer than the target and repeats role statements and unasked email/login/navigation details. Substantive expected concepts are present, but there is no accepted delivery.

The plumbing draft now explains the competing creation-timing statements and identifies unknown initial submission status. However, it drops the general LOC versus specialized NB/Alteration-CO initial-CO completion consequences and does not identify the initial job type needed to choose that path. The verifier labels the specialized completion passage not material to the filing-choice question, contrary to the unchanged benchmark. The 270-word draft repeats the timing gap and includes unasked search/menu directions. This is a delivered but incomplete answer. Fixing the prior timing omission did not preserve every previously covered requirement.

The full review, drafts, verifier verdicts, source bindings and request hashes are retained in `evals/results/research-owner-source-relationships-answer-assessment-2026-09-09.json`. Neither case is a complete benchmark pass. The targeted source relationships are reflected in these two drafts, but sample variation and the added submission source prevent isolating their causal effect. Costs increased versus v8, and these two observations do not demonstrate faster Research or commercial readiness.

This package cost **$0.04797580 by recorded usage**, or **$0.087717 conservatively**. The authorized round now totals **$7.833214 conservatively**, leaving **$0.166786** of $8. The cumulative usage-derived estimate is **$4.13764707**. No account balance or invoice was read. The representative initial request alone reserved $0.179010 during this preflight, more than the remaining authorization; another paired run must not be assumed affordable.

## Subsequent local repair: prompt v10 and relationships v2

The prompt now distinguishes an actor-authority decision from a complete submission-readiness assessment. A negative permission answer or statement of necessary conditions does not imply that every requirement is satisfied. The verifier still checks every volunteered claim, conditional required actor and explicit readiness assertion; its failures are never automatically overturned. Filing-choice answers must also preserve the source-stated processing and conditional completion consequences.

The source relationship helper now pairs the general separate-LOC direction with the specialized NB/Alteration-CO completion FAQ. Both actual fetched passages must be present and contain the relevant directions. The main and related evidence retain their own source IDs, claim IDs, document hashes and exact excerpts; no answer-key prose is supplied to either model. Removing or changing the specialized condition removes the relationship. This narrowly scoped helper exposes a source relationship for model assessment; it does not prove the model will understand or correctly apply it.

Drafting now targets two short paragraphs and roughly 80–160 words for narrow questions, with more space allowed for material conditions or calculations. It asks for each conclusion and qualification once, and removes unasked navigation and field-entry instructions. This is a presentation target, not truncation or a new output-token ceiling. Models, reasoning settings, output limits and retry policy remain unchanged.

The full offline `npm run test:research-chat` suite passed again (exit 0, API key removed); its log is `/tmp/permitext-source-relationships-v10-suite-20260909.log`. Focused source-relationship and request-binding tests passed, including changed source conditions, missing specialized evidence, both model stages and forged cross-source identifiers or excerpts. The Research HTTP fixture confirms the specialized completion relationship reaches both stages. No new paid call followed these v10 changes, so their live effect remains unconfirmed. All 110 numbered cases remain in scope. No Project workflow, UI, phone, push or deployment was tested.

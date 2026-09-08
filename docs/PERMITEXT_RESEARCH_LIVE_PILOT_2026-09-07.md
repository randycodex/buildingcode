# Permitext Research live pilot — September 7, 2026

Eight questions were submitted through the real local Research conversation HTTP path with live OpenAI responses, after the owner made approximately $8 available. This exposed gaps that component tests had not caught. The run used source commit `80d235cd095dc6a7c0c60ee3b6f6d0f7ba4ea5f3`; it was not a Production or native-device test.

Five turns returned answers, two zoning turns stopped before a provider call, and one PDF turn failed after retrieving the correct official notice. Returning an answer is not the same as passing the answer key: both ordinary DOB workflow answers were incomplete, and the plumbing follow-up omitted a required distinction.

## Scope and spending

- Eight ordered turns in seven isolated conversations; one attempt each, no manual retries or separate paid judge. The room classification and plumbing questions shared a conversation.
- Existing hybrid Luna/Terra routing, medium reasoning, standard service tier, automatic evidence discovery, official web support enabled. Zoning diagnostics were enabled locally; public eligibility was not changed.
- Questions and scenarios only were sent. No expected answers, grading concepts, selected passages, or source section IDs were injected. This evaluates ordinary chat discovery and follow-up behavior, not performance with the answer key's preselected evidence.
- The eighth question deliberately supplied the official BPP PDF URL, allowing comparison with the ordinary workflow question. It was a planned distinct input, not an unrecorded retry.
- Evaluation ceiling: $7. Every turn also had a conservative $0.85 ceiling, giving a maximum sum of $6.80 across the eight attempts. Unknown provider charges remain reserved by the per-turn control.
- Fourteen provider calls; all usage settled. No account quota or budget errors occurred.
- Existing telemetry reported **$0.431674** in standard token estimates. Including the returned cache-write tokens at their separate published rate adds **$0.078730**. One recorded web tool call adds an estimated **$0.01**, for **approximately $0.520404** overall. This is a usage-based estimate, not an invoice or account-balance reading.
- The sum of the app's conservative provider cost bounds was **$1.065597**, including higher token-rate allowances and reserved tool fees. Both estimates are well within the authorized funds.

Pricing was checked against [OpenAI's standard pricing](https://developers.openai.com/api/docs/pricing): Terra input/cached input/cache writes/output $2/$0.20/$2.50/$12 per million; Luna $0.20/$0.02/$0.25/$1.20. Ordinary Research token telemetry currently omits the separate cache-write premium and tool fees from its estimate; its conservative reservation retains headroom for them.

## Observed results

| Input | HTTP outcome | Full request time | Review |
| --- | --- | ---: | --- |
| CC-01: R-2 scissor stair, doors 15 feet apart | Answer | 18.267 s | Correct conditional answer. Includes the general one-exit rule, R-2 exception, 2-hour enclosure/separation, masonry or equivalent, and door spacing. Does not invent missing construction facts. |
| CC-03: 900-net-square-foot room with tables and chairs | Answer | 34.171 s | Correct main calculation, 900 / 15 = 60, and accessory-space classification. One repair required. At 291 words it adds peripheral conditions; its nonaccessory A-3 caveat needs a better boundary because BC 303.1.2 separately addresses nonaccessory spaces below 75 occupants. |
| CC-04: Group B plumbing follow-up | Answer | 42.596 s | Correct opening that Group B classification does not automatically settle fixture calculation; preserves assembly calculation permission and rounding mechanics. Omits the answer key's explicit distinction that PC 403.1's fewer-than-75 allowance addresses buildings/nonaccessory tenant spaces. Adds several other fixture provisions. One repair; 349 words. |
| ZR-08: 42,000 square feet on a 10,000-square-foot R7A lot | 422 boundary | 0.548 s | No calculation returned. Planner selected `definition_cross_reference`; evidence check could not resolve the controlling structured 23-22 row. This is a retrieval/planning failure, not missing project facts for the narrow basic-table arithmetic. Zero provider calls. |
| ZR-06: self-storage permission with facts expressly absent | 422 boundary | 0.513 s | Correctly avoids a parcel determination. Provides only an address/map prerequisite error rather than the useful conditional explanation requested. It fails to recognize the explicit question about what cannot yet be concluded. Zero provider calls. |
| DOBNOW-019: new BPP filing after August 17, 2026 | Answer | 22.379 s | Incomplete: says the supplied code does not establish the platform or review type. Web search was not triggered. The official notice directly provides DOB NOW: Build, Standard Plan Review, and the BPP5 authorization step. One unnecessary repair of an answer based on insufficient sources. |
| DOBNOW-018: NB-GC filing flagged for wetlands/CEHA | Answer | 22.362 s | Incomplete: discusses general agency approvals but does not retrieve the August 2026 workflow, DEC Jurisdictional Determination, conditional DEC Permit, and waiver path. Web search was not triggered. 336 words. |
| PDF-BPP: BPP question with explicit official PDF URL | 502 failure | 5.964 s | Live provider opened the correct PDF and returned the requested three-part answer with page-1 citations. Server successfully bound PDF passages, then rejected the PDF at a final HTML-only gate. Fixed after the run; see below. |

The five returned answers had a median of **22.379 seconds** and a nearest-rank p90 of **42.596 seconds**. This is a small sample containing incomplete answers, not a reliable production latency distribution. Fast rejections are excluded from these answer-latency numbers. All eight request durations total 146.8 seconds.

Across the recorded provider phases, drafting/repair consumed 97.807 seconds, verification 36.383 seconds, and web support 3.819 seconds. Three of five returned answers required a complete drafting repair. The scissor-stair question assembled 16 sections, including unrelated wind and ground-acceleration provisions. Narrower relevant evidence and fewer repair rounds are concrete speed opportunities; removing verification would not address the source-selection failures.

## PDF repair and verification after the live run

The full HTTP regression reproduced two independent integration failures:

1. The final guidance gate accepted `official_html` but rejected `official_pdf`.
2. The immutable answer contract required exactly one evidence limitation, so the PDF's necessary extraction caveat caused saving to fail even after the first check was repaired.

The final gate now accepts validated HTML or PDF sources. Answer construction and persistence share the same canonical limitations function, preserving the enacted-text boundary and the validated PDF extraction caveats. Extra, missing, or mismatched caveats are rejected. Guidance remains noncontrolling and is not converted into enacted-code citations.

The new HTTP regression covers completion, page/hash retention, immutable saving, and invalid-PDF rejection. Replaying the **saved live provider output and the downloaded official BPP PDF** passes through the complete local HTTP path after the fix, without any external or paid provider call. It preserves August 17, 2026, Standard Plan Review, BPP5, and page-1 attribution.

The replay is a functional confirmation, not a new live quality or latency sample. The canonical-excerpt answer is **523 words**, so concise synthesis of validated guidance remains unfinished. The live failure remains recorded as a failure; it is not retroactively counted as a successful live turn.

Final local validation passed: `npm run check`, `npm run smoke`, the synthetic PDF HTTP regression, the saved-response PDF replay, the immutable-answer caveat checks, and `git diff --check`. The pilot artifact was also checked for settled usage, the spending bound, and absence of the API credential, backend session tokens, and encrypted reasoning content. No additional paid calls were made during these checks.

## Recommended next work, in order

1. **Automatically recognize procedural questions.** Route DOB NOW forms, filing dates, job/work types, review types, required documents, and agency steps to the relevant official guidance. A user should not need to say “search the internet.” Use a small maintained catalog of official notices/release notes, their effective dates, and superseded versions, with refresh checks and cached extraction. Preserve the distinction between enacted law and agency workflow.
2. **Resolve the complete governing evidence before drafting.** Fix the FAR question's planner/table selection and distinguish a question about missing facts from a request to decide an unidentified property. Retrieve the controlling row, definitions, footnotes, exceptions, and necessary cross-references, while removing unrelated sections. Keep safe boundaries when the controlling source truly cannot be resolved.
3. **Verify that the response answers every material part.** A source-supported paragraph can still fail the task. Check requested platform, review type, authorization step, calculation, exception, and missing fact separately. Retain facts established in the conversation instead of asking for them again. Give a supported partial answer and precise missing inputs when that is possible.
4. **Make presentation concise after source validation.** Use the agreed order: direct result, cited rule, application/calculation, and only material exceptions or missing facts. For PDFs, keep full source passages available as evidence while presenting a short source-bound explanation. Avoid filling the answer with caveats induced by irrelevant retrieved text.
5. **Build meaningful release evidence.** Run the reconciled 50 cases plus withheld paraphrases, changed numbers, threshold boundaries, wrong editions, missing facts, conflicting/superseded notices, scans/tables, and multi-turn corrections. Score correctness, completeness, citation support, useful abstention, and presentation independently. Count rejected and incomplete requests in reliability metrics. Obtain professional review of the normative key; preserving historical testing approval is not a new professional sign-off.
6. **Measure speed and cost by successful outcome.** Record retrieval, fetch/extraction, drafting, verification, repair, and total elapsed time. Test caching and smaller evidence packages against the same quality gates before changing model routing. Include failed work, cache writes, and tool fees in cost estimates. Use the remaining available budget for a small post-fix comparison before broadening paid evaluation.

The immediate recommendation is to repair procedural routing and zoning evidence selection before spending on a full 50-case run. The current sample already identifies useful fixes at low cost.

## Evidence and boundaries

- [Raw live pilot record](../permitext-sync-server/evals/results/research-owner-live-pilot-2026-09-07.json) — captured answers, provider outputs, usage, operation telemetry, and profile. Provider reasoning items were omitted; retained outputs are messages and web-search evidence. No credential or backend session token is included.
- [One-attempt runner](../permitext-sync-server/scripts/run-research-owner-pilot-20260907.mjs) — default mode is a no-network preflight; an existing result file prevents another live attempt.
- [Full HTTP PDF regression](../permitext-sync-server/tests/research-official-pdf-http-contract.mjs).
- [Reconciled answer key](PERMITEXT_RECONCILED_RESEARCH_ANSWER_KEY_2026-09-07.md).
- [BPP service notice, page 1](https://www.nyc.gov/assets/buildings/pdf/bpp_build-sn.pdf#page=1) and [August release notes, pages 12–13](https://www.nyc.gov/assets/buildings/pdf/dob_now_build_release_notes.pdf#page=12) were independently inspected for the workflow review.
- [ZR 23-22](https://zr.planning.nyc.gov/article-ii/chapter-3/23-22) confirms the basic R7A standard-residence 4.00 FAR row. [BC 1007.1.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-173125) and the official [2022 BC Chapter 3 publication](https://www.nyc.gov/assets/buildings/apps/pdf_viewer/viewer.html?file=2022BC_Chapter03_OccupancyClassWBwm.pdf&section=conscode_2022) support the code review.

No Production deployment, public zoning enablement, model-routing change, subscriber allowance change, price change, or native-device verification was performed.

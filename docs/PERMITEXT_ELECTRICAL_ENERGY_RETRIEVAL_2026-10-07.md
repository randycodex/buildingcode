# Electrical and energy Research source integration

This follow-up preserves the open-investigation profile and the saved rollback. Work remains on the local branch based on freshly fetched `origin/main` at `6ab611802939819dd13868be1e60dc44f488e637`; no deployment or remote publication is included.

## Corrected source finding

The repository already contained the official integrated 2025 NYC Energy Conservation Code (including the NYC-modified ASHRAE publication) and 2025 NYC Electrical Code amendments. Research did not register those reader publications. This change connects the existing publications rather than claiming new acquisition of their PDFs. All 362 prepared records bind to the 14 source URLs and SHA-256 values recorded in the existing publication manifest; this is a consistency check, not independent re-download verification or a complete extraction-quality certification.

Research now separates:

- `nyc-2025-energy-code`: 68 existing prepared records, effective March 30, 2026, covering the integrated residential/commercial/administration/modified ASHRAE publication.
- `nyc-2025-electrical-amendments`: 294 prepared records, effective December 21, 2025, covering NYC amendments and their administrative enactment provisions. Unchanged adopted 2020 NEC text is absent.

Publication provenance and coverage boundaries survive retrieval, prompt assembly and immutable saved evidence snapshots. A referral or city amendment does not supply missing unchanged NEC text or external testing/design standards.

## Retrieval and source-check fixes

Explicit and continuing specialty editions remain separate from construction-code editions. Mixed questions retain each family's own requested edition. Historical requests and earlier filings select an unavailable specialty descriptor, preserving the missing-edition boundary. Generated investigation queries cannot switch the requested edition, including in the writer's requested/unavailable corpus plan. A reported complete energy filing within the 2020 transition interval can nominate that historical edition; incomplete or materially changed submissions do not receive that shortcut. This routing identifies research scope, not project applicability.

Window/fenestration and opaque-door vocabulary now retrieves energy provisions despite long descriptions of appearance or landmarks context. Fire-rated/egress subjects retain their competing-topic controls.

The published electrical `SECTION 210.12(A)` marker was embedded in the prepared 210.11 source. It now has its own record, 33000361, without changing any existing canonical section ID. The repair preserves the exact extracted text, updates catalogs/search/rendered chapter data and regenerates the affected reader search asset. The importer recognizes parenthetical section markers and reuses the existing section map when rebuilding an existing package.

The passage parser also recognizes short published headings joined to their first operative sentence by PDF extraction. Previously the presence of “shall” on that line could hide a real subsection, including R403.7 equipment sizing, from exact-reference retrieval. It preserves the original text and source offsets. A wrapped reference immediately after “Section” or “Table” is excluded from heading detection. Previously that boundary split C402.6.3 Exception 2 before its C402.6.2 continuation; table lead-ins now use the validated headings and retain the complete exception.

Complete plain-text `TABLE` sources inside large prepared sections now have independent passage candidates with exact offsets, headings, units, footnotes and governing lead-in text. Indexed paragraphs delegating a numerical requirement to a published table retain that complete table and its governing context, including a reference phrased as “Section” rather than “Table.” Bounded selection still requires a relevant complete passage to fit the evidence packet. Exact EC/ECC references now receive the same passage-search priority as the other code families; previously lexical scoring could substitute a different subsection for an explicitly requested energy rule. This retains the appropriate opaque-door U-factor table alongside its referral and makes complete air-leakage tables available. It does not invent table cells or fix ambiguous numeric/column extraction; numerical conclusions still require an unambiguous published association. Complete-table retrieval does not establish which compliance path applies to a project.

Open investigation can deliver a freshly reviewed gap when no relevant source is available at all. Persistence retains the strict Luna/open-engine/passing-review/explicit-gap checks. Other response paths keep their evidence requirements.

## Review recovery

Recovery v6 permits at most two substantive full repairs. If the final fresh review finds only `incorrect_citation` issues, one additional citation-only correction may change structured enacted bindings and citations. A deterministic content check requires exact preservation of the narrative, point headings/explanations, assumptions, missing facts, follow-up questions, limitations, requested evidence and web-source uses. A fresh full review then decides delivery. A changed claim, a substantive remaining issue or a failed final review produces a clarification. It cannot silently become a review pass.

Before review, a draft naming missing R/C energy subsections can trigger at most two exact local lookups in the requested current energy corpus. An opaque/no-glass door draft reporting a missing U-factor table can also follow a thermal-rule referral present in the supplied current source text; its query number is taken from that publication, not model memory. Glazed-window/door subjects and truncated referral text do not trigger that fallback. Only complete matching source passages are admitted, existing draft bindings are retained, and immutable snapshots are rebuilt. The review and bounded substantive repair decide whether the new evidence changes the answer. Historical requests and recall-only current corpora cannot trigger this lookup. This retrieves the required Manual S/J method names in R403.7; it does not supply those external manuals or project load data.

Writer/reviewer instructions explicitly check supplied text before asserting that an exception list or table is missing, and distinguish a component-specific rule/exception from a broader rule for another component. Previously reviewed recovery v2/v3/v4/v5 gaps remain valid.

## Evaluation

The separate sanitized record is `permitext-sync-server/evals/research-electrical-energy-2026-10-07/summary.json`. The earlier 80-heading record is preserved. Inputs use the report's electrical/energy headings, not the unavailable original conversation histories. Evaluation uses real local HTTP, account/access checks, fresh review and persisted-result equality; web and embeddings are disabled. All API dispatches use `gpt-6-luna` with `store:false`, under the same cumulative $11.90 pre-dispatch ledger. The existing evaluation-only Chat Completions compatibility transport is used because the execution credential rejected Responses; production transport is unchanged.

Distinct implementation cohorts remain separate:

| Cohort | Cases | Provisional useful | Evidence gaps | Incomplete | Material-issue flags |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recovery v6 / passage v5 repeat | 20 | 11 | 8 | 1 | 0 |
| Exact specialty priority / passage v6 repeat | 20 | 10 | 9 | 1 | 1 |
| Thermal-referral targeted door check | 1 | 1 | 0 | 0 | 0 |
| Complete-exception final door check / passage v7 | 1 | 1 | 0 | 0 | 0 |

Both twenty-case repeats delivered nineteen reviewed responses and one clarification. The passage-v6 repeat's incomplete case was ECC-04: successive reviews raised air-barrier scope, foam-barrier construction-type scope, then furring/citation findings after the second bounded repair. That case remains incomplete. Its one material-issue flag belongs to an LPC evidence-gap assessment; the delivered answer expressly says the applicable LPC approval rule is unavailable. The flag is preserved rather than silently reclassified. Application delivery, provisional classification and supported status remain distinct. Rejected drafts never count as useful delivered responses. The final door checks are targeted follow-ups, not replacement whole-cohort scores. The last check actually admitted the `-gap-C402.1.2` source, completed two fresh reviews, delivered a provisionally supported useful conditional answer without flags, and verified equality with its saved answer. These title-only tests do not establish a change to the report's 54/80 useful score.

The recovery-v6 repeat was interrupted by a provider timeout. Thirteen completed cases were retained and seven were resumed with unchanged code; interrupted records and captures remain in private scratch. All three uncollected calls, including two from the prior phase, retain their full reserved bounds. Final cumulative accounting is **$8.99502891**: **$8.62884331** usage-priced estimate plus **$0.36618560** uncollected upper bounds, below $11.90. This is conservative accounting, not an invoice or a fetched account balance. No pending or unknown dispatch remains. All 1,341 dispatches requested Luna; successful usage responses were checked for Luna models. No Sol call was made.

## Remaining source limitations

Full 2020 NEC, historical electrical/energy editions and their contemporaneous transition/inspection rules remain absent. Direct NYC downloads are denied by execution-network policy; the available web tool sees only a JavaScript shell at the official NFPA free reader. No source acquisition is claimed from snippets or unknown third-party standards copies. Referenced manufacturer/utility/testing/design information and project facts may also be needed. Existing plain-text table extraction requires original-page verification where row/column or numeric associations are ambiguous.

## Validation and preservation

Source contracts verify the 362 URL/hash bindings, source partitions, AFCI boundary, table/footnote retention, edition/filing/history routing, generated-query boundaries, publication snapshots and actual retrieval. Fourteen recovery HTTP scenarios exercise malformed/truncated envelopes, valid citation repair, zero-source gaps, citation-only rescue, rejection of content-changing repair, bounded final rejection, admission/review/repair/persistence of both a named missing-section lookup and an unnamed thermal-rule referral lookup, cost settlement and saved-answer equality without live provider calls. Enacted-content and deployment-content checks verify the changed package and reader asset. Focused registry, vocabulary, passage, writer, foundation, provider, model-routing and accounting contracts also pass.

The existing partition-cache spend-assertion failure reproduces on untouched `6ab6118`; the earlier native privacy-marker failure also reproduces on that baseline. These unrelated baseline failures remain documented.

The rollback tag remains `permitext-simplified-luna-checkpoint-2026-10-06` at `6fdb37522d18a7b814cf79d82dd867aae32dc736`. The rollback profile SHA-256 remains `e70b2b950c686ebe1f9a2db2ff479bbc812346c77597a6f2b31bb64f6afa598b`; the open profile remains `0dc0b8bc929c7b4c735d635db7b3892596ecbe672a04ba081d8fa4715a8071be`.

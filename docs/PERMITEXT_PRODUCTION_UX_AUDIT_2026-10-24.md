# Permitext production UX/UI audit — October 24, 2026

> Follow-up status: the remaining five UX findings and the revised manual proposed-building walkthrough are documented in [the follow-up implementation record](PERMITEXT_REMAINING_UX_AND_ADDRESS_WALKTHROUGH_2026-10-24.md). Those fixes are local and tested, not deployed. The production observations below remain the original audit record.

## 1. Executive assessment

**Recommendation:** resolve the report-provenance mismatch and investigate the calculator-to-Research failure before a broad tester invitation. Make selected-evidence scope and the role of Project Context explicit before asking new users to complete their first research task.

Permitext has useful, distinct building blocks: published code, saved evidence, working notes, source-bounded Research, project information, calculation snapshots, and issued reports. The recurring friction is carrying the user's question, chosen facts, evidence scope, destination, and current state between those blocks.

This Markdown report consolidates **19 findings**: the original 17 findings, the subsequently verified missing column-group creation action, and the persistent confirmation-banner issue raised after the initial walkthrough. It also records a separate, material audit gap: the real-address property workflow was not exercised.

| Priority | Meaning | Findings |
| --- | --- | --- |
| P1 | Resolve or investigate before broad tester release because the observed issue affects trust or completion of a guided task. | F01–F02 |
| P2 | Meaningful workflow, clarity, discoverability, or output-quality problem. | F03–F13, F16–F19 |
| P3 | Naming, consistency, onboarding, or presentation improvement. | F14–F15 |

These priorities are product judgments. One observed failed request is not a measured failure rate, and a proposed improvement is not a confirmed backend defect.

## 2. Scope, environment, and evidence standard

- **Environment:** authenticated production at <https://permitext.com>, through the existing in-app browser.
- **Observation date:** October 24, 2026, using America/New_York as the user-facing timezone.
- **Test role:** a code researcher reviewing a fictional NYC office interior renovation.
- **Visible release marker:** Settings' feedback link identified `d23b6a1f8e59`. This is a UI-observed marker, not an independently verified frontend/backend deployment match.
- **Viewport:** a wide desktop workspace, approximately 3063 pixels across for the production captures. Mobile behavior was not tested.
- **Method:** actual UI navigation, saved test content, Research submissions, source review, calculator exercises, report construction, downloaded PDF inspection, and reopening/persistence checks.
- **Later repository cross-checks:** confirmation-banner implementation and the missing grouping entry point. The production audit otherwise relies on rendered behavior and retained artifacts.
- **Timing:** request durations refer to the application's displayed timer. Computer-control overhead and tool wait times were not treated as app latency.
- **Evidence labels:** “Observed” describes recorded UI or output; “Impact” and “Change” express UX analysis; “Root cause unverified” means no causal implementation diagnosis was established.

This was a structured role-based walkthrough, not interviews or usability sessions with independent customers. The scenario was informed by NYC DOB's [renovation guidance](https://www.nyc.gov/site/buildings/dob/project-categories-renovations.page) and [alteration guidance](https://www.nyc.gov/site/buildings/dob/project-categories-alterations.page). It was not a legal applicability determination.

## 3. Test project and work products

**Project:** [UX RELEASE AUDIT — Office Renovation — 2026-10-24](https://permitext.com/workspace#cq/project/web-project-mvn0rzfe)

**Project ID:** `web-project-mvn0rzfe`

### 3.1 Scenario and narrative context

The project was explicitly labeled as test-only and fictional. It described an existing assumed Group B office, proposed interior partitions within a 4,500 sq ft tenant area, and no proposed change of use. The 2022 NYC Building Code was used as an exercise basis. Governing-code applicability, lawful occupancy, construction type, sprinklers, occupant load, exits, travel distances, and accessibility remained unverified.

The research questions concerned occupant load, corridor rating, exits, and the accessible route. All conclusions were marked provisional.

### 3.2 Structured facts entered

| Field | Recorded test value |
| --- | --- |
| Occupancy | Group B office — assumed; verify existing CO |
| Construction type | Unknown — verify approved plans |
| Work / filing type | Interior office renovation; no proposed use change; filing type TBD |
| Code basis | 2022 NYC BC for test exercises only; existing-building applicability unverified |
| Borough | Manhattan — fictional scenario |
| Sprinkler protection | Unknown — obtain sprinkler plans and field verification |
| Building area | Tenant work area 4,500 sq ft; total building area unknown |
| Project status | Preliminary code research — UX test only |

### 3.3 Open question and records checklist

The open question was: “Does the proposed Group B tenant corridor require a fire-resistance rating?” Its answer remained unresolved pending occupant load served, sprinkler coverage, corridor configuration, and governing code.

Suggested records were added for lawful occupancy / CO, approved plans, permit history, survey and zoning-lot information, and field measurements/photos. They stayed at **Needed**. A follow-up note identified the CO record as necessary before confirming Group B use. No outside party was contacted, and no record was represented as received or reviewed.

### 3.4 Retained work products

- Saved paragraph at BC 1020.1.1 containing only “Exceptions:”.
- Saved whole section BC 1020.1.2, Public corridors.
- Source-linked note titled **Corridor rating — provisional analysis**.
- Saved business-area occupant-load calculation: 4,500 gross sq ft ÷ 100 = 45 people, with review qualifications.
- Research on insufficient evidence, related-provision discovery, a successful public-corridor follow-up, one failed calculator-generated request, and a successful narrowed footnote follow-up.
- An eight-item report with context, facts, working analysis, calculation snapshot, Research answer, and authored next actions.
- Downloaded fixed report versions 1 and 2; both contain five pages.

### 3.5 Important audit gap: real address and imported facts

**No existing address was used.** Facts were manually entered for the controlled fictional scenario. This bypassed a major product workflow and limits the completeness of the release audit.

The following remain untested:

1. Address entry, autocomplete, matching, and ambiguity handling.
2. Retrieval of property information from the product's connected public sources.
3. Imported versus user-stated facts and their provenance, dates, and verification labels.
4. Missing, conflicting, partial, or stale property records.
5. Review and refresh behavior, including preservation of user corrections.
6. The transition from retrieved existing-building information into proposed-work questions and Research.

This is an auditor coverage gap, not an observed application defect. The choice of a fictional scenario was an audit decision, not a technical restriction. **The real-address workflow needs its own completed pass before this can be treated as the final release audit.**

## 4. Finding index

| ID | Priority | Finding |
| --- | --- | --- |
| F01 | P1 | [Report provenance contradicts the selected-evidence Research contract](#f01) |
| F02 | P1 | [The calculator’s own prepared Research question failed without a direct recovery path](#f02) |
| F03 | P2 | [Project context is well captured but disconnected from Research](#f03) |
| F04 | P2 | [A standalone heading can become the entire Research evidence](#f04) |
| F05 | P2 | [A natural occupant-load query missed the relevant calculator table](#f05) |
| F06 | P2 | [Related-provision discovery requires too much review of weak candidates](#f06) |
| F07 | P2 | [Columns accumulate faster than the user can maintain context](#f07) |
| F08 | P2 | [Research actions need immediate, visible destination feedback](#f08) |
| F09 | P2 | [Research answers export too much repeated scaffolding](#f09) |
| F10 | P2 | [PDF headings and calculation units split across pages](#f10) |
| F11 | P2 | [Internal-sounding fact instructions appear in the final report](#f11) |
| F12 | P2 | [Two calculator entry points create unnamed, independent drafts](#f12) |
| F13 | P2 | [Creating an editable snapshot loses the note’s useful display title](#f13) |
| F14 | P3 | [The same workflow uses inconsistent action names and inclusion states](#f14) |
| F15 | P3 | [A new project needs a visible next step, and facts need clearer grouping](#f15) |
| F16 | P2 | [A Search filter also changes the browsing library](#f16) |
| F17 | P2 | [Research “Add to note” silently appends to the active note](#f17) |
| F18 | P2 | [New column groups cannot be created through the current UI](#f18) |
| F19 | P2 | [Persistent confirmation banner resembles a third toolbar](#f19) |

## 5. Detailed findings

<a id="f01"></a>

### F01 — Report provenance contradicts the selected-evidence Research contract

**Priority:** P1

**Evidence status:** Confirmed visible provenance mismatch; backend cause unverified.

**Observed behavior**

The Assistant says only included passages and the conversation are used. I supplied three Building Code passages. The successful answer, when added to Report, acquired “Sources searched” and “Searched” corpus entries for Construction, Fire, Energy, Electrical, and Zoning sources. PDF version 1 carries those entries onto page 2.

**User impact**

A reader can reasonably interpret the exported report as evidence of a broader code search. The interface does not explain why the report claims that scope when the conversation presents a narrower one.

**Recommended change**

Generate provenance from the actual execution record: distinguish “included and used,” “searched for candidates,” “cited,” and “available library.” Carry the same basis into conversation, report, and PDF. Do not label a corpus “Searched” merely because it is available or routed.

**Reproduction / review steps**

1. Create a Research draft from selected Building Code evidence, then use related-provision discovery to include BC 1020.1 and BC 1020.1.2 alongside the initial BC 1020.1.1 heading-only passage.
2. Ask for the Group B public-corridor rating and the conditions of its exception, while distinguishing the incomplete interior-corridor evidence.
3. Inspect the conversation disclosure stating that only included passages and conversation messages are used.
4. Add the successful answer to Report and inspect its Research basis / Corpus basis.
5. Export a fixed PDF version and inspect page 2 for the broader “Sources searched” / “Searched” entries.

**Acceptance criteria for follow-up work**

- [ ] For a selected-passage answer, the conversation, report, and PDF identify the same evidence basis.
- [ ] Searched, included, cited, and merely available sources are represented distinctly.
- [ ] Any broader search claim is supported by an inspectable execution record.
- [ ] Existing issued PDFs remain fixed; corrections affect new output or explicitly reviewed versions.

**Retained evidence**

- [Report page 2 with broad sources searched metadata](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/pdf-page-2.png>)

---

<a id="f02"></a>

### F02 — The calculator’s own prepared Research question failed without a direct recovery path

**Subsequent history review:** automatic Retry is deliberately unavailable after a semantic verification failure; transport interruptions already have a same-request retry. The approved UX pass adds explicit question/passage review and draft restoration without changing that policy or claiming to fix the answer engine.

**Priority:** P1

**Evidence status:** One prepared-question failure; one successful manually narrowed follow-up. Failure frequency unmeasured.

**Observed behavior**

Business-area calculation → Check footnotes in Assistant → review included section → include and prepare → send the generated question. The UI showed “Research incomplete” at 02:39, then “I couldn’t consistently use the details you provided while checking your question.” It suggested reporting the issue. No Retry control was visible; a new follow-up was possible.

**User impact**

This is a first-party guided path: users have already entered the facts the app requested. A generic failure leaves them unable to tell what to fix. A support form is not task recovery.

**Recommended change**

Preserve the request and evidence, expose Retry, explain whether a failure is temporary or requires a missing fact, and allow a narrower question or source review without reconstructing the task. Avoid treating a failure message like a normal answer with ordinary “Add answer” actions.

**Reproduction / review steps**

1. Open the toolbar calculator; select the business-area row, enter 4,500 gross sq ft, and confirm no fixed seating.
2. Choose Check footnotes in Assistant, review the included BC 1004.1.3 source, and choose Include and prepare question.
3. Send the application-generated question, retaining the stated space function, area, seating assumption, and source.
4. Observe the incomplete result and the recovery controls. The recorded attempt showed 02:39 before the final failure message.
5. In the same conversation, ask a narrower question about footnote d and explicitly identify the space as an indoor office. This follow-up succeeded with the same included table.

**Acceptance criteria for follow-up work**

- [ ] The application-generated calculator question succeeds for the tested supported example, or returns an actionable explanation of a genuine missing input.
- [ ] A recoverable failure preserves the question and sources and exposes a direct retry/recovery action.
- [ ] The UI explains what the user can change rather than directing every failure toward support.
- [ ] A failed attempt is visibly distinct from a completed answer in note/report save actions.

**Retained evidence**

- [Calculator Research failure with feedback form and no retry button](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/10-calculator-research-failure.png>)
- [Successful narrowed follow-up](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/14-research-recovered.png>)

**Recorded recovery question**

> Retry with a narrower question: Using only the included BC 1004.1.3 table and footnotes, explain footnote d and whether its text concerns rooftops or terraces. This fictional calculation is for an indoor office, 4500 gross square feet, without fixed seating. Do not make a project compliance determination.

The successful response distinguished footnote d’s rooftop/terrace scope from the stated indoor office, retained the unadjusted 4,500 ÷ 100 = 45 arithmetic, and did not claim overall project compliance. The later calculator UI also displayed per-footnote applicability explanations. The original failure remains an important guided-path reliability and recovery observation.

---

<a id="f03"></a>

### F03 — Project context is well captured but disconnected from Research

**Subsequent scope decision:** the user chose to preserve the selected-passage Research engine and its exclusion of Project Context/Facts. The implementation therefore clarifies onboarding and scope rather than adding project-data access. See [the eight-point implementation record](PERMITEXT_UX_EIGHT_POINT_IMPLEMENTATION_2026-10-24.md).

**Priority:** P2

**Evidence status:** Confirmed interface contract and tested disabled state; recommendation depends on intended product scope.

**Observed behavior**

I populated project context, facts, an open question, and records. A new conversation still requires passages, and explicitly excludes Project details. Typing a question about the office renovation in Project Context leaves Send disabled when no passages are included. The Open question has no visible “Research this question” action in the tested view.

**User impact**

The project badge, detailed context form, and “Research” name invite an expectation that the workspace understands the project. Re-entering the same facts increases effort and risks conflicting versions.

**Recommended change**

Offer “Research this question” from Context and an explicit “Include project facts” review. Show exact selected facts with assumption/source/status labels. Alternatively, clearly name the current feature “Analyze selected passages” and provide a separate discovery-first route. Keep the evidence safeguards.

**Reproduction / review steps**

1. Create a project and enter narrative context, core facts, an open question, and a records checklist.
2. Open a new Research conversation and type a question referring to the Project Context before including code passages.
3. Inspect the disabled Send state and the disclosure excluding Project details.
4. Inspect the project open-question area for a direct action to carry the question and selected facts into Research.

**Acceptance criteria for follow-up work**

- [ ] A researcher can start from an open project question and review the exact facts to include.
- [ ] Included facts retain source, assumption, and verification labels.
- [ ] The conversation visibly identifies whether Project Context is included.
- [ ] If passage-first operation remains mandatory, onboarding explains it before the user writes an unsupported question.

**Retained evidence**

- [New conversation with a typed project question and disabled Send](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/11-direct-question-disabled.png>)

---

<a id="f04"></a>

### F04 — A standalone heading can become the entire Research evidence

**Priority:** P2

**Evidence status:** Confirmed selected-text mismatch in user expectations; no wrong-target save defect is asserted.

**Observed behavior**

The saved paragraph in the first exercise contained only “Exceptions:”. Evidence detail showed the surrounding section, while Research received only that heading. The answer correctly refused to infer a corridor rating from it. The save click itself is not claimed as a wrong-target bug: the verified issue is the allowed and easily misunderstood scope.

**User impact**

Researchers can think they saved the rule and exceptions they are viewing, then discover only after a question that they supplied no operative text.

**Recommended change**

Highlight the exact saved range in Detail and show it in a compact preflight. Flag heading-only selections and offer “Include containing section” with an explicit preview. Label section, paragraph, table, and footnote scope consistently.

**Reproduction / review steps**

1. In the audit project, inspect the saved paragraph for BC 1020.1.1 whose exact text is “Exceptions:”.
2. Open its Evidence Detail and compare the surrounding section shown there with the saved paragraph text.
3. Start Research using that item and review the included-passage text.
4. Ask whether that evidence is sufficient to determine the corridor rating. The answer correctly identifies the missing operative text.

**Acceptance criteria for follow-up work**

- [ ] The exact saved text range is visible and distinguishable from surrounding context.
- [ ] A heading-only selection is identified before a Research submission.
- [ ] The user can explicitly preview and include the containing section or table.
- [ ] Adding surrounding text does not silently alter the historical evidence used by prior answers.

**Retained evidence**

- [Evidence detail beside a source-linked note](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/03-evidence-note.png>)

**Scope qualification:** the original save interaction is not sufficient evidence of a wrong-target bug. The confirmed issue is that a heading-only selection can be saved and sent, while surrounding text in Detail makes the actual evidence scope less apparent.

---

<a id="f05"></a>

### F05 — A natural occupant-load query missed the relevant calculator table

**Priority:** P2

**Evidence status:** Confirmed results for the recorded source scope and query; indexing/ranking cause unverified.

**Observed behavior**

With Building Code 2022 selected, global Search for occupant load business returned two matches: an Appendix Q fire-alarm-company provision and automatic doors. It did not return §1004.1.3, whose table contains the business-area factor. Searching 1004.1.3 found the section first.

**User impact**

The user who already knows the section number succeeds. The user researching a task may conclude the needed content is absent.

**Recommended change**

Index table rows with their headings, section context, and footnotes; rank task-relevant matches; offer term relaxation or suggested queries when an all-words query is too restrictive. Add this exact query as a product acceptance case.

**Related observation**

Reader search for “corridor” produced 122 matches in chapter order, with many special-occupancy provisions before the general corridor provisions. Distinguish literal occurrence search from relevance-ranked discovery.

**Reproduction / review steps**

1. Open global Search and temporarily select Building Code (2022) as the source scope.
2. Search for “occupant load business” in the displayed All words mode.
3. Inspect the two results: an Appendix Q fire-alarm-company provision and automatic doors. BC 1004.1.3 is absent.
4. Search for “1004.1.3”; the relevant section appears first.
5. Restore the original source selection after testing. The ten original sources were restored in this audit.

**Acceptance criteria for follow-up work**

- [ ] The tested natural-language query surfaces the relevant business-area table with the correct section and edition.
- [ ] Table row terms are discoverable together with their section context.
- [ ] Strict matching provides a useful explanation or suggested relaxation when relevant content is excluded.
- [ ] Exact section-number lookup remains fast and dependable; no latency claim is established by this audit.

---

<a id="f06"></a>

### F06 — Related-provision discovery requires too much review of weak candidates

**Priority:** P2

**Evidence status:** Confirmed candidate/review behavior; relevance quality is a researcher judgment for this task.

**Observed behavior**

The first corridor discovery returned 12 candidates, including many Group H fabrication provisions. Refining the question to Group B interior/public corridors and excluding Group H still left several weakly related special-occupancy results. Every result had to be opened in a Reader before it could be selected.

**User impact**

The inspect-before-include safeguard is valuable, but irrelevant candidates and generic relevance explanations turn it into repetitive navigation.

**Recommended change**

Explain the specific relationship for each result, group governing provisions versus exceptions/cross-references/background, and support an exact-text inspection pane in the discovery list. Preserve deliberate review and selection.

**Reproduction / review steps**

1. From the corridor Research draft, choose Find related provisions.
2. Inspect the initial 12 candidate passages and their relevance explanations.
3. Refine the question to Group B interior/public corridor ratings, sprinkler conditions, and single egress, explicitly excluding Group H unless directly relevant.
4. Open candidate passages in a Reader to enable selection, then include the desired passages.
5. Observe that the refined results still contain weakly related special-occupancy provisions and require repeated Reader navigation for inspection.

**Acceptance criteria for follow-up work**

- [ ] Each candidate explains its specific relationship to the question.
- [ ] Users can inspect exact text without repeatedly losing their place in the candidate list.
- [ ] Question refinements meaningfully affect relevance.
- [ ] Exact-source review and deliberate inclusion remain required and visible.

**Retained evidence**

- [Related-provision discovery and included source review](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/05-discovery.png>)

---

<a id="f07"></a>

### F07 — Columns accumulate faster than the user can maintain context

**Priority:** P2

**Evidence status:** Confirmed wide-desktop layout behavior; no mobile or memory/performance conclusion.

**Observed behavior**

Evidence, multiple identically titled Chapter 10 Readers, Calculator, Assistant, Search, and an auxiliary Reader accumulated during one task. Even the approximately 3063-pixel-wide viewport could not show them all. Assistant also devotes a full column to conversation history. Table content required horizontal navigation inside the workspace.

**User impact**

“Where did my answer/source open?” becomes a recurring task. The active section is not apparent from repeated codebook/chapter titles. Important controls and results move outside the visible area.

**Recommended change**

Use section-aware reader titles or tabs, clearly identify temporary versus kept readers, and bring the destination of an action into view. Offer focused layouts such as Source + Analysis and Evidence + Note, while allowing experts to keep their columns. Do not impose an unmeasured hard reader cap.

**Reproduction / review steps**

1. Work through saved evidence, Reader search, Research, related-provision discovery, Calculator, and global Search without closing the existing columns.
2. Inspect the multiple Chapter 10 Reader headers and identify which section each currently represents.
3. Move between the selected source, Research answer, calculator, and search results, observing how far horizontal navigation is required.
4. Inspect a table while other columns remain open. The recorded wide desktop viewport still could not show the whole task at once.

**Acceptance criteria for follow-up work**

- [ ] The active source can be identified from the Reader title without opening each similarly named column.
- [ ] A completed handoff brings its destination into view.
- [ ] Users can focus the current task while retaining their other open work.
- [ ] Tables remain inspectable without unexpectedly losing surrounding task context.

**Retained evidence**

- [Evidence, two code readers, calculator, and partially offscreen Assistant](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/12-evidence-draft-stall.png>)

---

<a id="f08"></a>

### F08 — Research actions need immediate, visible destination feedback

**Priority:** P2

**Evidence status:** Delayed destination updates confirmed; early hidden-assistant observation occurred once.

**Observed behavior**

Starting Research from Evidence temporarily disabled controls, then eventually created a draft. An early Notebook-to-Research handoff did not visibly expose the assistant until its toolbar toggle was used. Adding a Reader passage to the current draft eventually updated the passage count. “＋ Add passages” opened the codebook Reader picker rather than an evidence chooser.

**User impact**

Users cannot immediately distinguish waiting, a hidden destination, or a missed action. Different entry points with similar wording have different results.

**Recommended change**

Show a named operation and destination, bring the draft into view when ready, and offer “From open Reader / Saved evidence / Find provisions” under Add passages. Preserve the existing composer when appropriate, or explicitly identify that a new draft was created.

**Reproduction / review steps**

1. Choose Research from a saved evidence item or select evidence and choose Ask Assistant.
2. Observe the pending state and determine whether the newly created conversation is immediately visible.
3. From a Reader passage, choose an existing Research destination and wait for its included-passage count to update.
4. In the conversation, choose + Add passages and observe that it opens the codebook Reader picker.
5. Compare the destination feedback and entry choices across these paths.

**Acceptance criteria for follow-up work**

- [ ] Each asynchronous handoff displays what is happening and where the result will appear.
- [ ] Completion either exposes the destination or provides a precise, compact open action.
- [ ] Add passages offers understandable routes from open Readers, Saved Evidence, and discovery.
- [ ] New-draft creation and insertion into an existing conversation are clearly distinguished.

**Scope qualification:** the pending evidence operation eventually created its draft, and the Reader-to-current addition eventually updated the passage count. These are not recorded as permanent failures. The one early hidden-destination observation needs targeted reproduction.

---

<a id="f09"></a>

### F09 — Research answers export too much repeated scaffolding

**Priority:** P2

**Evidence status:** Confirmed output structure and page count; reduction proposal is an editorial judgment.

**Observed behavior**

The full user question became a long report title. The report repeated related ideas under Supported conclusion, What the evidence establishes, Practical application, Limits, and Sources still needed, alongside extensive source-basis metadata. This small eight-item exercise produced five PDF pages.

**User impact**

The reviewer must work through repeated qualifications and metadata to find the actual finding and unresolved condition.

**Recommended change**

Give each finding an editable short title. Default to conclusion, applicable conditions, uncertainty/next action, and citations. Put detailed execution/source metadata in an optional appendix. Keep distinct analysis and source text; do not silently delete repeated quotations.

**Reproduction / review steps**

1. Add the successful corridor Research answer to the report alongside the note, calculation, Context, Facts, and authored follow-up text.
2. Inspect the long question used as the finding title.
3. Read the conclusion, evidence explanation, practical application, limitations, and source-basis blocks together.
4. Export the report and assess how much space repeats the same conclusion or qualification. This small exercise generated five pages.

**Acceptance criteria for follow-up work**

- [ ] A report finding has a short editable title independent of the full user prompt.
- [ ] The default output communicates the conclusion, conditions, uncertainty, next action, and citations without repetitive scaffolding.
- [ ] Detailed execution metadata can be included separately when needed.
- [ ] Any repeated-passage cleanup is reversible and preserves authored analysis and issued versions.

---

<a id="f10"></a>

### F10 — PDF headings and calculation units split across pages

**Priority:** P2

**Evidence status:** Confirmed in the downloaded version 1 PDF and rendered pages.

**Observed behavior**

Version 1 page 2 ends with “Supported conclusion,” whose content starts on page 3. Page 4 ends with the authored “Outstanding verification before any design conclusion” heading; its paragraph starts on page 5. The calculation heading and result also span a page boundary.

**User impact**

The document looks less finished than the underlying work. Readers lose the connection between a heading and its explanation.

**Recommended change**

Keep headings with their first paragraph and keep compact calculation cards together. Use sensible widow/orphan rules. Test with long questions, short custom headings, and tables.

**Reproduction / review steps**

1. Open the retained five-page PDF version 1.
2. Inspect the bottom of page 2 and the beginning of page 3 for the split Supported conclusion heading.
3. Inspect the bottom of page 4 and the beginning of page 5 for the split Outstanding verification heading.
4. Inspect the calculation title and result around the page 3–4 boundary.

**Acceptance criteria for follow-up work**

- [ ] Each heading stays with the first meaningful portion of its content.
- [ ] A compact calculation title, inputs, and result remain together where practical.
- [ ] The supplied report example no longer produces the recorded orphan headings.
- [ ] Pagination remains legible with long questions, authored headings, and source tables.

**Retained evidence**

- [Report page 4 with the final heading stranded at the bottom](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/pdf-page-4.png>)

---

<a id="f11"></a>

### F11 — Internal-sounding fact instructions appear in the final report

**Priority:** P2

**Evidence status:** Confirmed reader-facing text in Report and PDF; internal generation cause unverified.

**Observed behavior**

Fact qualification text includes “preserve the stated negation, scope and uncertainty.” This appears in the Report and PDF, alongside useful “user-stated; not independently verified” labels. Project Context is also presented under the generic type “Project facts.”

**User impact**

The reader receives a processing instruction instead of a clear qualification. Context and structured facts become harder to distinguish.

**Recommended change**

Keep user-readable provenance labels: “User-stated • Not verified” plus the actual assumption or uncertainty. Keep preservation rules internal. Label Context and Facts distinctly.

**Reproduction / review steps**

1. Add the project Context and Facts to Report.
2. Expand the fact qualifications and inspect the text for the unknown or explicitly limited facts.
3. Export the report and verify that “preserve the stated negation, scope and uncertainty” is included in the reader-facing qualification text.
4. Compare the Project Context title with its generic report item type, Project facts.

**Acceptance criteria for follow-up work**

- [ ] Exported qualifications explain provenance and uncertainty in language intended for report readers.
- [ ] Processing instructions do not appear as fact qualifications.
- [ ] Context and structured Facts have distinct, accurate item labels.
- [ ] Actual negations, assumptions, and uncertainty in user content remain preserved.

---

<a id="f12"></a>

### F12 — Two calculator entry points create unnamed, independent drafts

**Priority:** P2

**Evidence status:** Confirmed separate forms, reset form, retained snapshot, and large source preview.

**Observed behavior**

The toolbar calculator retained the 4,500 gross sq ft business exercise. Opening the calculator embedded in §1004.1.3 started blank. I then tested 301 net sq ft with the tables-and-chairs row, yielding 21 people. Neither draft was named for a space. On reload, the toolbar calculation form reset, while the saved 45-person snapshot remained intact in Notebook. The footnote-review modal showed a very large flattened section/table.

**User impact**

A multi-space project needs a clear distinction between “same calculation reopened” and “new space calculation.” Whole-table prompt previews are hard to inspect.

**Recommended change**

Name the room/area, display whether a draft is new or saved, preserve draft inputs or clearly explain their temporary state, and offer recent calculations consistently from both entry points. Show the selected row and applicable footnotes first, with full-section context expandable. A future schedule could aggregate spaces without silently treating a single-space result as a building total.

**Reproduction / review steps**

1. Populate the toolbar calculator with the 4,500 gross sq ft business exercise and save its 45-person snapshot to Notebook.
2. Open the calculator embedded in BC 1004.1.3; observe that it starts as a separate blank form.
3. Test a separate 301 net sq ft tables-and-chairs exercise, yielding 21 people, and inspect the lack of a room/space name.
4. Open Check footnotes in Assistant and inspect the large flattened section/table preview.
5. Reload production, then compare the reset calculator form with the retained 45-person Notebook snapshot. The form was restored manually after this check.

**Acceptance criteria for follow-up work**

- [ ] The user can distinguish a new calculation, a temporary draft, and a saved snapshot.
- [ ] The calculation can be associated with a named room or area.
- [ ] Reopening from either entry point offers understandable access to recent/saved calculations.
- [ ] Before sending a footnote question, the selected row and relevant footnotes are easy to inspect, with fuller context available.

**Retained evidence**

- [Large calculator source-review modal containing the full table](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/06-calculator-review-modal.png>)

**Persistence qualification:** the saved 45-person Notebook calculation was preserved. The reset applied to the open calculator form; the observation does not establish loss of the saved calculation.

---

<a id="f13"></a>

### F13 — Creating an editable snapshot loses the note’s useful display title

**Priority:** P2

**Evidence status:** Confirmed outline/title change and successful side-by-side review.

**Observed behavior**

“Corridor rating — provisional analysis” was a clear linked-note item. After Create editable snapshot, the outline used the beginning of the body (“BC · 2022 · §1020.1.1…”) instead. The PDF snapshot retained source attribution but did not retain the original note title as its main heading.

**User impact**

An action intended to make wording editable unexpectedly changes navigation and presentation.

**Recommended change**

Preserve the title and source identity when converting to a snapshot. Offer a separate editable report title. Keep the current side-by-side review flow, which worked well.

**Reproduction / review steps**

1. Add the titled note “Corridor rating — provisional analysis” as a linked report item.
2. Choose Create editable snapshot.
3. Compare the outline label and report presentation before and after conversion.
4. Choose Review linked Note and inspect the side-by-side comparison before replacing the snapshot text.
5. Export version 2 and verify source attribution is retained even though the original note title is no longer its main display heading.

**Acceptance criteria for follow-up work**

- [ ] Converting a linked note into a snapshot preserves a useful title and its source identity.
- [ ] Report-specific wording can be edited independently of the source note.
- [ ] The side-by-side source review remains available before replacement.
- [ ] Issued PDF versions remain unchanged by subsequent note or snapshot edits.

**Retained evidence**

- [Current report text and latest note side by side before replacement](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/13-snapshot-review.png>)

---

<a id="f14"></a>

### F14 — The same workflow uses inconsistent action names and inclusion states

**Priority:** P3

**Evidence status:** Confirmed labels and inclusion-state differences.

**Observed behavior**

Top-level Research contains an Assistant; Evidence has Research and batch Ask Assistant; the calculator says Check footnotes in Assistant. A note already in the report still says Add to Report (its tooltip explains deduplication), while an included Research answer changes to In Report.

**Recommended change**

Use one primary term for the same capability, and distinguish the wider workspace if necessary. Standardize Included in Report with an Open Report action. Keep deduplication, which worked.

**Reproduction / review steps**

1. Compare the top-level Research label with the Assistant toolbar and column labels.
2. Compare the saved-evidence Research action, batch Ask Assistant action, and calculator Check footnotes in Assistant action.
3. Add a note and a Research answer to Report.
4. Revisit both sources and compare their inclusion labels: the note still says Add to Report, with an explanatory tooltip, while the answer says In Report.

**Acceptance criteria for follow-up work**

- [ ] The same capability uses consistent action terminology across entry points.
- [ ] Included report items display their inclusion state directly.
- [ ] An included state offers a useful destination action where appropriate.
- [ ] Repeated inclusion remains deduplicated.

---

<a id="f15"></a>

### F15 — A new project needs a visible next step, and facts need clearer grouping

**Priority:** P3

**Evidence status:** Confirmed initial blank workspace and fact-view controls in this session.

**Observed behavior**

The new project landed in a blank Research workspace with no columns open. The user had to choose Reader. Project details provide a useful compact core view, but All facts expands a long list of zoning and building fields; the toggle changes to “Recorded & core facts,” making action versus current mode less obvious. Long project names truncate before their distinguishing suffix in the Project menu.

**Recommended change**

Offer a short starting card: Add context, Find a provision, Open a codebook, or Start from saved evidence. Group extended facts by research need and show completion/source state. Name the toggle “Show all facts / Show core facts,” and preserve the distinguishing project name portion.

**Reproduction / review steps**

1. Create a new project from the Project menu.
2. Observe the initial empty Research workspace and identify the next action without prior product knowledge.
3. Open Context and Facts, toggle All facts, and inspect the extended field list and changed toggle wording.
4. Open the Project menu using the audit project’s long name and inspect the truncated label.

**Acceptance criteria for follow-up work**

- [ ] A new project visibly offers a useful next step.
- [ ] The fact-view toggle clearly describes its action or current mode.
- [ ] Extended fields are grouped by research need and retain source/verification states.
- [ ] Project selection remains distinguishable when names are long.

---

<a id="f16"></a>

### F16 — A Search filter also changes the browsing library

**Priority:** P2

**Evidence status:** Confirmed shared source-setting effect; original account selection restored.

**Observed behavior**

The source picker in Search controls enabled sources for browsing as well. Deselecting all warned that sources would disappear from chapters and search results. This session began with ten selected current/historical construction codebooks; I narrowed to BC 2022 for testing and restored the original ten.

**User impact**

A researcher may intend a temporary query filter, then later find sources missing elsewhere. Mixing historical and current editions also needs a conspicuous basis.

**Recommended change**

Separate “Search within” from “Enable in my library,” or explicitly label the shared setting and provide a temporary query scope. Always show the edition in results. Do not assume this account’s starting selection is the universal default.

**Reproduction / review steps**

1. Open the code sources and editions picker from global Search.
2. Temporarily deselect sources and inspect the notice explaining their effect on both chapters and search.
3. Observe that the picker controls source availability for browsing as well as the immediate query.
4. Restore the original ten source selections and confirm they remain selected after reload.

**Acceptance criteria for follow-up work**

- [ ] A temporary query scope can be understood independently of global library availability.
- [ ] If a shared setting remains, the shared effect is explicit before it is changed.
- [ ] Current and historical editions remain clearly identified.
- [ ] Saved references stay recoverable when their source is disabled.

---

<a id="f17"></a>

### F17 — Research “Add to note” silently appends to the active note

**Priority:** P2

**Evidence status:** Confirmed answer insertion into the active corridor note without a destination chooser.

**Observed behavior**

I clicked Add to note on the recovered occupant-load answer while the previously opened note was “Corridor rating — provisional analysis.” The button changed to Added to note; no destination chooser appeared. Opening Notebook confirmed that the answer had been appended to the corridor note. The Reader’s earlier Add to note flow had offered a destination choice.

**User impact**

A researcher switching between corridor, egress, and occupant-load questions may save a result under the wrong topic without noticing.

**Recommended change**

Show the destination in the action (“Add to Corridor rating…”), with a chooser for another Note or a New Note. After insertion, provide an Open Note action and a clear Undo. Apply the same destination rule to Reader, Evidence, and Research.

**Reproduction / review steps**

1. Leave “Corridor rating — provisional analysis” as the active Notebook note.
2. Open the successful narrowed occupant-load Research answer.
3. Click Add to note without first returning to Notebook or choosing a destination.
4. Observe the Added to note confirmation and then open Notebook.
5. Confirm that the occupant-load answer’s Research card was appended to the corridor note. Compare this with the Reader’s earlier destination-selection flow.

**Acceptance criteria for follow-up work**

- [ ] The Add to note action names its destination before insertion or presents a destination chooser.
- [ ] A new note or another existing note can be selected without losing the answer.
- [ ] Insertion provides a clear open-destination action and reversible recovery.
- [ ] Reader, Evidence, and Research follow a consistent destination rule.

**Retained evidence**

- [Occupant-load Research answer appended to the existing corridor note](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/15-answer-note-destination.png>)

---

<a id="f18"></a>

### F18 — New column groups cannot be created through the current UI

**Priority:** P2

**Evidence status:** Confirmed missing live creation action, corroborated by local code; deployed source revision not independently matched.

**Observed behavior**

The live Reader Column options menu has Expand, Collapse, Pin, Move Left, Move Right, Change Code, source information, and typography controls. It has no Create group action. The Project menu has no Saved groups entry in this project.

**Repository cross-check**

The local app retains a grouping editor, but its exposed call is Edit group for an existing group. Saved groups is conditional on groups already existing. The saved-groups menu restores existing groups and offers no creation action. This corroborates the live missing entry point; it is not a separately verified deployed source SHA.

**User impact**

Users cannot create a named collection of related Readers and Research columns, even though the product retains legacy grouping behavior. Dragging or moving columns only changes their order.

**Recommended change**

If custom grouping is intended to remain available, restore a visible Group columns action in the layout toolbar and eligible column menus, followed by a named selection dialog. Make eligibility and existing group membership explicit. If grouping was intentionally retired, remove expectations of it and explain the replacement workflow.

**Reproduction / review steps**

1. In the live Research workspace, open the ellipsis menu of an ungrouped Reader.
2. Inspect all menu actions for a way to create or name a column group.
3. Open the Project menu in the audit project and inspect its available layout actions.
4. Cross-check the local implementation: the grouping editor is exposed through Edit group for an existing group, and Saved groups appears only when groups already exist.

**Acceptance criteria for follow-up work**

- [ ] If grouping is a supported capability, an obvious Group columns action is available from the layout toolbar or eligible column menu.
- [ ] The creation flow requests a name and shows eligible columns and existing membership.
- [ ] Existing saved groups remain recoverable.
- [ ] If custom grouping is intentionally retired, the product makes the replacement workflow understandable.

**Retained evidence**

- [Reader Column options menu without a grouping command](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/18-column-options-no-group.png>)
- [Conditional Saved groups entry](</Users/randy/Documents/X_CODING/Building Code/permitext-sync-server/public/app.js:2633>)
- [Saved-group restore menu](</Users/randy/Documents/X_CODING/Building Code/permitext-sync-server/public/app.js:42672>)
- [Existing-group-only edit action](</Users/randy/Documents/X_CODING/Building Code/permitext-sync-server/public/app.js:43633>)
- [Retained grouping editor](</Users/randy/Documents/X_CODING/Building Code/permitext-sync-server/public/app.js:43692>)

---

<a id="f19"></a>

### F19 — Persistent confirmation banner resembles a third toolbar

**Priority:** P2

**Evidence status:** confirmed screenshot and local implementation; observed during the Reader-to-existing-Research handoff.

**Observed behavior**

A full-width strip appeared beneath the two main workspace bars. Its message was **“Added to Exceptions:.”**, with **View research** and **Dismiss** actions. It was triggered by adding a code passage to an existing Research conversation named “Exceptions:”.

The wording is assembled as `Added to ${researchConversationTitle(conversation)}.`. The conversation name already ends in a colon, producing the awkward `Exceptions:.` ending. The message does not state that a *passage* was added or that the destination is a *Research conversation*.

The action uses the shared persistent workspace-alert component. It takes a separate layout row and has no automatic timeout in the inspected notification path. View research brings the destination pane into view and dismisses the message. Dismiss hides the strip while retaining the added evidence.

**User impact**

- The strip can be mistaken for a third toolbar or a persistent workspace state.
- It consumes reading space after a routine successful action.
- Its object and destination are ambiguous when the conversation has an automatically derived title.
- A source heading such as “Exceptions:” is a poor long-term conversation identity.

**Reproduction / review steps**

1. Keep an existing Research conversation open, such as the draft named “Exceptions:”.
2. From a Reader passage, open Research this passage and select that existing conversation.
3. Wait for the addition to complete and inspect the strip below the second workspace bar.
4. Observe that the strip remains until dismissed or its action is used.
5. Confirm that dismissal changes notification visibility, not the conversation’s included evidence.

**Recommended change**

Use a compact success confirmation that identifies the item and destination. For example:

> Passage added to Research “Corridor fire-resistance requirements” · View

Place it near the action or use a small notification surface. Successful routine notifications can clear after an appropriate interval; actionable errors or unresolved issues should retain suitable persistence. Preserve access to the destination and accessible status announcements.

Give Research conversations a useful topic title and allow renaming. Avoid treating a source heading alone as an adequate research-topic label.

**Acceptance criteria for follow-up work**

- [ ] The confirmation identifies that a passage was added and names the Research destination.
- [ ] Routine success does not occupy a persistent full-width workspace row.
- [ ] View reaches the destination without requiring the user to find an offscreen column manually.
- [ ] Dismissing the confirmation does not remove the evidence.
- [ ] Notification changes preserve keyboard access and appropriate accessible announcements.

**Repository cross-check**

- [Reader passage addition and View research action](</Users/randy/Documents/X_CODING/Building Code/permitext-sync-server/public/app.js:16755>)
- [Shared workspace notification presentation](</Users/randy/Documents/X_CODING/Building Code/permitext-sync-server/public/app.js:10792>)
- [Dismissal and action handling](</Users/randy/Documents/X_CODING/Building Code/permitext-sync-server/public/app.js:10804>)
- [Research conversation title selection](</Users/randy/Documents/X_CODING/Building Code/permitext-sync-server/public/app.js:16694>)
- [Full-width notification styling](</Users/randy/Documents/X_CODING/Building Code/permitext-sync-server/public/styles.css:645>)
- [Additional workspace grid row](</Users/randy/Documents/X_CODING/Building Code/permitext-sync-server/public/styles.css:19986>)

The user supplied a screenshot of this strip after the initial audit. The trigger, persistence, and actions were subsequently explained from the inspected implementation. This finding is documented separately here rather than being buried under general handoff feedback.

## 6. What worked and should be preserved

### 6.1 Published text and source links

Readers expose source sections, tables, exceptions, footnotes, and inline definitions. The tested fixed-seating definition included its Building Code edition and section. Source-linked Notes preserved a usable path back to the provision.

### 6.2 Cautious Research with insufficient evidence

When the initial included text was only “Exceptions:”, Research explicitly said that the evidence could not establish the corridor rating. It did not use the fictional project assumptions to invent the missing rule.

After additional provisions were inspected and included, the public-corridor follow-up stated its conditions and retained a limitation on any final project determination. The distinction between an answer to a selected-text question and a project-wide conclusion should remain visible.

### 6.3 Deliberate source review

Discovery required inspection before selection and made included text reviewable. That safeguard is valuable. The proposed improvement is to make inspection more relevant and efficient while preserving the user's deliberate choice of evidence.

### 6.4 Calculator guardrails

The following UI exercises worked:

| Exercise | Observed behavior |
| --- | --- |
| Business row, 4,500 gross sq ft, factor 100 | 45 people |
| Tables-and-chairs row, 301 net sq ft, factor 15 | 21 people, rounded up |
| Gross versus net row | Area-basis label followed the selected function |
| Seating unconfirmed | Saving required the seating assumption to be confirmed |
| Fixed seating selected | Separate method required; unsupported save blocked |
| Custom factor selected without a reason | Reason/reference field appeared; saving remained disabled |
| Save calculation | Notebook retained an explicitly qualified snapshot and its source |
| Narrowed footnote follow-up | Explanation distinguished indoor-office facts from rooftop/terrace conditions |

These checks establish the recorded UI behavior and arithmetic examples. They do not certify all calculator rows, every applicable exception, or legal applicability to a real building.

### 6.5 Notes and report assembly

The source-linked note could be created, renamed, edited, formatted, and added to Report. Inserting a Finding template and undoing it worked. Repeated Add to Report actions did not duplicate the same note.

Report Sources could include Context, Facts, Notes, and Research. Outline reordering with arrow keys worked. Linked notes refreshed to their latest saved content before conversion to a report-specific snapshot.

### 6.6 Editable snapshots and fixed versions

The report's source-review dialog displayed current report text beside the latest Note before replacement. A temporary snapshot-only insertion was replaced with the reviewed Note; the source Note stayed intact.

Version 1 remained unchanged after the source Note acquired a revision marker. Version 2 contained the later marker. Both PDFs remained available. The distinction between living source material, report-specific wording, and issued versions is worth retaining.

### 6.7 Project facts and record states

Facts retained explicit unknowns and assumptions. The records checklist correctly explained that reviewing a record does not automatically confirm a Project fact. That distinction helps avoid overstating the status of a property or design assumption.

## 7. Redundancy and workflow recommendations

### 7.1 Keep the core destinations distinct

| Destination | Useful role | Improvement needed |
| --- | --- | --- |
| Evidence | Exact published source material, edition, and selected scope | Make the exact saved range unmistakable |
| Notes | Working interpretation, authored analysis, and source-linked findings | Make insertion destination and report inclusion explicit |
| Research | Assistance bounded by chosen evidence and reviewed context | Connect entry paths, recover from failures, clarify inputs |
| Report | Selected communication with report-specific edits and issued versions | Reduce repeated scaffolding and improve presentation |
| Context | Narrative project scope, open questions, and records to obtain | Provide a direct path into a research task |
| Facts | Structured existing/proposed information with qualification and source state | Review imported facts and selectively carry them forward |
| Calculator | Inspectable arithmetic tied to a function, area basis, and code source | Name spaces, preserve drafts, and clarify saved state |

The live walkthrough does not support deleting these destinations merely because they can contain related information. Each has a useful role. The avoidable duplication appears in repeated data entry, repeated explanations, unclear copies, and repeated navigation.

### 7.2 Shorten the task sequence

A clearer target workflow is:

1. Start with a project question.
2. Review the specific project facts to include, preserving assumptions and sources.
3. Find and inspect relevant code provisions.
4. Ask the focused Research question with a visible input summary.
5. Save the finding to a named Note.
6. Include and edit it in Report.
7. Review sources, unresolved conditions, and presentation before issuing a fixed version.

At every handoff, retain the question, included facts, exact evidence scope, destination, and completion state. Provide a compact path back to each source.

### 7.3 Reduce repeated report material reversibly

For exact source-linked repeated passages, offer a review step with choices to:

- Keep the standalone code evidence and reference it from the analysis.
- Keep the analysis with its source reference and omit the redundant standalone quotation.
- Keep both intentionally.

Preserve original Notes, saved Evidence, authored reasoning, source links, and issued PDFs. Edited or uncertain matches require human review. Undo should restore the report composition. Do not automatically delete analysis merely because it resembles source text.

### 7.4 Use progressive disclosure where detail is valuable but secondary

- Keep the selected table row and applicable footnotes prominent; make the full table/section expandable.
- Keep a concise report finding prominent; offer detailed provenance and execution metadata separately.
- Keep conversation history accessible without forcing it to consume task space continuously.
- Keep core facts compact; group extended facts by the research question or building-information category.
- Preserve expert control over open columns. Do not close the user's work as an automatic simplification.

## 8. Suggested order of follow-up work

| Order | Work | Evidence of a successful follow-up |
| --- | --- | --- |
| 1 | Reconcile Research and report provenance | Same execution basis in conversation, report, and new PDF; supported distinction between included/searched/cited sources |
| 2 | Diagnose prepared calculator Research failure and improve recovery | Supported example completes or returns an actionable explanation; direct retry preserves inputs |
| 3 | Complete the missing real-address audit | Address lookup, imported facts, provenance, conflict handling, refresh, and downstream use exercised on a real public property |
| 4 | Clarify selected evidence and project-context inclusion | Users can review exactly what goes into their question before sending |
| 5 | Repair search/discovery findability | Recorded natural task query finds the relevant table; candidate results explain relevance and can be efficiently inspected |
| 6 | Clarify destinations and workspace organization | Named Note destination, visible Research destination, useful Reader titles, accessible grouping entry if supported |
| 7 | Improve report readability | Short finding titles, preserved snapshot identity, readable fact labels, no recorded orphan headings |
| 8 | Consolidate small UI inconsistencies | Consistent Research naming, inclusion states, onboarding, and compact success confirmations |

The first two items merit release attention because of the observed trust and task-completion effects. The rest should be evaluated against the tester audience and onboarding expectations. The real-address gap must be closed before claiming that this walkthrough covers the complete primary project workflow.

## 9. Coverage ledger

| Area | Actually exercised | Result and boundary |
| --- | --- | --- |
| New project | Create, name, narrative context, eight core facts, all-facts disclosure, open question, suggested records, record note | Created and populated; no real address or imported-property data |
| Reader | Open BC 2022; navigate search results; inspect sections, tables, footnotes; inline definition; save paragraph and section; Add to note; Research destination menu; auxiliary Readers | Source reading worked; exact scope and orientation need improvement |
| Search | Reader corridor query; global occupant-load business query; exact section number; temporary edition scope; restoration | Exact lookup worked; task query missed the relevant table |
| Evidence and Detail | Saved detail, passage comment, selection mode, Ask Assistant, whole-section save, Add to note, column options | Source identity retained; heading-only evidence and scope ambiguity observed |
| Notes | Create from passage, rename, append text, bold formatting, Finding template, undo, insertion choices, Add to Report, deduplication, Research insertion | Editing worked; Research insertion used the active note without a chooser |
| Research entry paths | Saved item, selected batch, Reader-to-current draft, new conversation, Choose Saved Evidence, Add passages, calculator preparation, related-provision discovery | Paths exercised; separate completed submissions were not run from every menu variant |
| Research inputs | Included-passage review, passage addition and removal, typed questions, explicit context exclusion | Exact sources reviewable; passage-first requirement and Project Context gap confirmed |
| Research outcomes | Insufficient-evidence question, refined discovery, successful corridor follow-up, calculator-generated failure, narrower successful follow-up | Cautious limitations useful; guided-path reliability/recovery needs work |
| Calculator | 45-person business example, saved snapshot, footnote preparation, embedded form, 21-person rounding example, fixed-seating guard, custom-factor reason | Tested examples behaved as documented; form reset versus saved-snapshot preservation distinguished |
| Report | Notes, Research, calculation, Context, Facts, intro, heading/paragraph, source picker, outline, keyboard reorder, linked update, editable snapshot, reviewed replacement | Assembly worked; provenance, title, repetition, and editorial issues observed |
| PDF | Export/download v1 and v2; preview; all five v1 pages inspected; marker comparison across versions | Fixed-version behavior confirmed; specific pagination defects confirmed |
| Grouping | Live Reader menu and Project menu; targeted local code cross-check | No creation entry point in current UI; legacy group support remains |
| Confirmation banner | User screenshot, Reader handoff path, message/actions and layout implementation | Persistent full-width success message confirmed and documented |
| Settings/recovery | Account-plan display, library/offline explanation, Projects, Saved Content, Conversations, Trash, feedback options | Read-only inspection; temporary selection cleared; no destructive action or support submission |
| Layout and persistence | Multiple columns and views; notebook/details panels; report sources/outline/versions/preview; reload | Seven Research columns retained in order; saved content persisted; calculator form reset |

## 10. Final state and persistence checks

The following were confirmed after reopening production:

- Project narrative, core facts, open question, and records checklist remained.
- Both saved evidence entries remained.
- The corridor note retained its revision marker and saved Research card.
- The 45-person calculation snapshot remained in Notebook.
- Research conversations and the successful narrowed answer remained.
- Both report versions remained available.
- All seven Research columns remained in the same order: Evidence → Assistant → Reader → Reader → Calculator → Search → Reader.
- The original ten enabled source selections were restored and remained selected.
- The open calculator form reset; the business exercise inputs were restored manually afterward.
- Report Versions and its latest PDF preview were reopened after the persistence check.

The user specifically requested that columns remain open. The audit ended with the production Research columns open, the example calculation restored, and working Notebook/Report content retained. This records the end of the walkthrough; later user navigation may change the currently visible view.

The recovered occupant-load answer was intentionally retained in the active corridor note after verifying F17. Its presence documents the implicit-destination behavior. The report uses the reviewed snapshot taken earlier, and issued PDFs remain fixed.

## 11. Limitations and remaining testing

### 11.1 Material missing workflow

The real-address/property-import path remains the largest coverage gap. It must be tested using a real public property address, with source state and uncertainty preserved. This report does not establish the quality, completeness, speed, or correctness of imported property facts.

### 11.2 Other untested areas

- New-account onboarding and first-run education outside the existing authenticated account.
- Other plan tiers, entitlement boundaries, billing, and payments.
- Offline library download, interrupted downloads, updates, and operation with the network unavailable.
- Mobile layouts and physical-device use.
- Full screen-reader completion or keyboard-only completion of the whole task.
- Cross-device sync and conflict resolution.
- Image uploads, arbitrary external links, and all rich-text formatting permutations.
- Team sharing, collaboration, or permission transitions.
- Deletion, archive, permanent removal, and actual restore operations.
- Every calculator function and exceptional method.
- Every Research prompt type, model path, source combination, and menu permutation.
- Independent building-code/legal accuracy evaluation against official source text for every generated statement.
- A production load benchmark, request-failure-rate study, or backend causal diagnosis.

### 11.3 Interpretation safeguards

- Browser-control failures and stale automation selectors were not counted as application bugs.
- A delayed asynchronous update that eventually completed was not called a permanent failure.
- The account's initial source selection was not treated as the universal default.
- Readable, cautious output does not by itself establish factual or legal accuracy.
- The local repository cross-checks were not represented as proof of the exact production deployed code revision.
- Missing visibility in one interaction was qualified where it had not been independently reproduced.

## 12. Evidence and local artifacts

Evidence files are retained in the local audit directory. This Markdown document can be read independently; its screenshot and PDF links depend on these files remaining available on this host.

- [Original HTML audit, including findings F01–F18](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/audit.html>)
- [Exported report version 1 — five pages](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/test-report-v1.pdf>)
- [Exported report version 2 — five pages](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/test-report-v2.pdf>)
- [Persisted project context, facts, question, and records](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/16-persisted-project-context.png>)
- [Final open Research columns](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/17-final-open-columns.png>)

### 12.1 Screenshot inventory

| File | Evidence purpose |
| --- | --- |
| [01-project-context.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/01-project-context.png>) | Initial populated Context and Facts |
| [02-corridor-reader.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/02-corridor-reader.png>) | Corridor provision in Reader |
| [03-evidence-note.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/03-evidence-note.png>) | Saved Evidence Detail beside the source-linked Note |
| [04-calculator-research.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/04-calculator-research.png>) | Calculator and Research task state |
| [05-discovery.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/05-discovery.png>) | Related-provision discovery workflow |
| [06-calculator-review-modal.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/06-calculator-review-modal.png>) | Large calculator source-review modal |
| [07-report-builder.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/07-report-builder.png>) | Report assembly and source panels |
| [08-report-pdf-preview.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/08-report-pdf-preview.png>) | Report and PDF preview |
| [09-research-incomplete.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/09-research-incomplete.png>) | Calculator-generated Research incomplete state |
| [10-calculator-research-failure.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/10-calculator-research-failure.png>) | Final failure message and feedback UI |
| [11-direct-question-disabled.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/11-direct-question-disabled.png>) | Question-first conversation with disabled Send |
| [12-evidence-draft-stall.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/12-evidence-draft-stall.png>) | Accumulated workspace during a pending action that eventually completed |
| [13-snapshot-review.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/13-snapshot-review.png>) | Side-by-side report snapshot/source Note review |
| [14-research-recovered.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/14-research-recovered.png>) | Successful narrower calculator footnote follow-up |
| [15-answer-note-destination.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/15-answer-note-destination.png>) | Research answer appended to the active corridor Note |
| [16-persisted-project-context.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/16-persisted-project-context.png>) | Context, Facts, and records after reopening |
| [17-final-open-columns.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/17-final-open-columns.png>) | Retained production Research workspace |
| [18-column-options-no-group.png](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/18-column-options-no-group.png>) | Reader menu without Group columns creation action |

### 12.2 Rendered PDF pages

- [Version 1, page 1](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/pdf-page-1.png>)
- [Version 1, page 2](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/pdf-page-2.png>)
- [Version 1, page 3](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/pdf-page-3.png>)
- [Version 1, page 4](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/pdf-page-4.png>)
- [Version 1, page 5](</Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/permitext-ux-audit/pdf-page-5.png>)

### 12.3 Source and implementation references

- [NYC DOB — Renovations](https://www.nyc.gov/site/buildings/dob/project-categories-renovations.page)
- [NYC DOB — Alterations](https://www.nyc.gov/site/buildings/dob/project-categories-alterations.page)
- Targeted local implementation links appear under F18 and F19. Other root causes remain unverified unless expressly identified in the finding.

## 13. Documentation status

This file documents observed production behavior and proposed follow-up work. Its checklists are acceptance criteria for future changes, not claims that fixes have been implemented. The product has not been re-audited after any future changes through this document.

The original HTML report contains 18 findings. This detailed Markdown report adds the confirmation banner as F19 and makes the real-address audit gap explicit. Treat this Markdown file as the consolidated written record for the walkthrough and subsequent user questions.


## 14. Remaining-five follow-up and manual facts

F06, F12, F14, F15 and F16 now have local implementations and verification. See [the detailed follow-up record](PERMITEXT_REMAINING_UX_AND_ADDRESS_WALKTHROUGH_2026-10-24.md) for behavior, acceptance evidence, 26 passing checks, preservation hashes and remaining release limits.

The user's later instruction replaced the automatic property-import walkthrough with manually entered proposed-building facts. Production Project `web-project-mvn6enbj` preserves this fictional scenario, explicit unknowns and Stated provenance after reload. Existing ZoLa inventory was not imported as proposed-design data. All nine original production columns remain open.

These local UX fixes do not establish a new production release or successful live model revalidation of the original generation failure.

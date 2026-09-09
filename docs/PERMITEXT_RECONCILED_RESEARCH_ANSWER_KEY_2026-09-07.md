# Permitext — Reconciled Research Questions and Answer Key

Reconciled: 2026-09-08. Contains 5 Construction Code, 21 Zoning, and 24 DOB NOW cases.

This is a development-only acceptance reference. The uploaded file remains unchanged. Reference wording is illustrative; source correctness, complete qualifications, and useful answers govern acceptance.

## Approved answer structure

Direct answer → Governing rule with citation → Application or calculation → Material exceptions or missing facts

Put a condition that changes Yes/No in the opening answer. Use adjacent citations, identify the relevant edition or source snapshot, and show arithmetic when it helps. Use paragraphs for narrow answers, tables for comparisons or parallel requirements, and numbered steps for workflows. Do not force four headings or ask for facts that do not affect the result.

## Reconciliation and review boundaries

- Restore the source scenario, selected evidence and project facts before evaluating an answer. Never infer a scenario from the expected answer.
- Current repository review states supersede the compilation's blanket DRAFT labels; approval remains limited to the originally recorded scope. Reconciled prose has not received a new independent professional review.
- The repository also contains 30 additional Zoning cases in zoning-cases-expanded-batch-1.json. They are outside this 50-case reconciliation and have not been silently added.
- No new model quality score or response-time benchmark is claimed. DOB conflicts need the current official materials and actual filing where applicable.
- CC-04 has an explicit development correction for the optional Assembly calculation. Its original approved source is preserved, and approval of the corrected wording remains pending.
- CC-01 through CC-03 have development amendments aligning missing-fact expectations with supplied facts and evidence boundaries. Their original source inputs and historical approvals are preserved; the amendments await professional review.
- The 24 DOB NOW scenarios are restored. Several Zoning questions are replaced with their revised repository versions; their original intake wording remains visible below.
- DOB NOW inputs preserve the packet's shared workflow topic as explicit question context. It supplies no answer, threshold, consequence, citation requirement, or reviewer expectation; the individual scenarios and questions are unchanged.
- Construction answers retain Plumbing Code scope and vanity/lavatory distinctions. Explicit development corrections below preserve the original source record and carry their own pending-review status. DOB NOW answers retain the subsequent-filing completion distinction, PAA source conflict, site-safety applicability, DEP drainage condition, and distinct Loft Board routes.
- This work does not authorize paid model calls, change source approval status, enable public Research, or establish professional sign-off. New reconciled prose has no new independent professional approval.

## Source provenance

Intake: `Permitext_Consolidated_Evaluation_Questions_Answer_Key.md`; SHA-256 `40ca00c0ac4d3f6b9523694334b8fcdefedcd69e05145bd1630e279f6a0e0950`.

- [research-cases.json](../permitext-sync-server/evals/research-cases.json) — SHA-256 `da3a0e1061b94d9707abc713d0827a8c1df46b9d8a873e9544b35ac9d90eeefb`.
- [zoning-cases.json](../permitext-sync-server/evals/zoning-cases.json) — SHA-256 `90b9cf4c5c3ea40522103d42a9b8ec052b044cf42be019cae53eed61cfa008a6`.
- [review-packets/dob-now-expediter-draft-review.md](../permitext-sync-server/evals/review-packets/dob-now-expediter-draft-review.md) — SHA-256 `715301e11a99f50ea320402102bb5376e627a41fce0510f7d8705f05929be975`.
- [research-answer-key-amendments.json](../permitext-sync-server/evals/research-answer-key-amendments.json) — SHA-256 `aaa414e7d011656407cc4f79327c45c9f76d748779fb09c94cbf199b965564c7`.

DOB workflow material remains dated to its review snapshot. Consult current [DOB FAQs](https://www.nyc.gov/site/buildings/industry/dob-now-build-faqs.page), [NB/Alteration-CO FAQs](https://www.nyc.gov/site/buildings/industry/new-building-buildfaqs.page), [PAA guidance](https://www.nyc.gov/site/buildings/industry/post-approval-amendment-paa.page), [Application User Guide](https://www.nyc.gov/assets/buildings/pdf/dob_now_application_user_guide.pdf), [release notes](https://www.nyc.gov/assets/buildings/pdf/dob_now_build_release_notes.pdf), and [service updates](https://www.nyc.gov/site/buildings/dob/service-updates.page) for live guidance. A source URL is not a claim that all 50 answers were newly verified online.

## CC-01 — Scissor stair counted as two exits

Source basis: 2022 New York City Construction Codes

Source case: `scissor-stair-two-exits`; recorded status: approved; reviewed: 2026-07-23T21:35:54.092Z. Scope: Existing construction-code evaluation approval; no new live result or release approval.

**Development correction:** `cc01-established-facts-20260908`. Status: development-correction-pending-professional-review. The original approval above is historical; it does not approve this corrected wording or rubric.

**Project facts supplied to Research:**

```json
{
  "occupancy": "Group R-2 stated by the question",
  "configuration": "Scissor stair with entrance doors 15 feet apart",
  "unknowns": [
    "enclosure rating",
    "separating construction rating",
    "construction material"
  ]
}
```

**Evaluation question:**

Our Group R-2 building has a scissor stair with the two stair entrance doors located 15 feet apart. Can the two stairs be counted as two separate exits?

**Expected answer:**

The 15-foot separation alone is not enough. Under the general rule, stairs sharing a scissor-stair assembly are counted as one exit stairway. However, the Group R-2 exception permits the stairs to share the assembly and be counted separately when the stair enclosures and the construction separating the stairs have at least a 2-hour fire-resistance rating and are constructed of masonry or a masonry equivalent in accordance with department rules. The exit doors must also be at least 15 feet apart. The question establishes Group R-2 occupancy and the 15-foot door separation. Confirm the enclosure rating, separating-construction rating, and masonry or masonry-equivalent construction before concluding that the exception applies.

**Required concepts:**

- State that the 15-foot door separation alone is insufficient.
- Explain the general rule that stairs sharing a scissor-stair assembly count as one exit stairway.
- Explain the Group R-2 exception for separately counted stairs.
- Identify the 2-hour enclosure and separating-construction requirements.
- Identify the masonry or masonry-equivalent requirement.
- Identify the minimum 15-foot exit-door separation.
- Treat the stated Group R-2 occupancy and 15-foot door separation as supplied facts; retain only the unresolved construction conditions.

**Forbidden conclusions:**

- Every scissor stair automatically counts as one exit.
- Fifteen feet of door separation automatically makes the stairs compliant.
- Sprinkler protection by itself satisfies the Group R-2 exception.
- Require the user to reconfirm Group R-2 occupancy or the stated 15-foot separation without a contradiction.

**Authority / evidence to verify:**

- BC 1007.1.1

**Missing facts:**

- Confirm the stair-enclosure fire-resistance rating.
- Confirm the construction separating the stairs and its fire-resistance rating.
- Confirm masonry or an accepted masonry equivalent.

**Reconciliation notes:**

- Use the current repository answer and rubric, with the selected evidence and project context restored.
- Development amendment cc01-established-facts-20260908 aligns missing-fact expectations with the supplied question and Project facts. Original source approvals are preserved; this correction awaits professional review.

## CC-02 — Single stair in a six-story residential building

Source basis: 2022 New York City Construction Codes

Source case: `single-stair-six-story-r2`; recorded status: approved; reviewed: 2026-07-22T00:00:00.000Z. Scope: Existing construction-code evaluation approval; no new live result or release approval.

**Development correction:** `cc02-established-facts-20260908`. Status: development-correction-pending-professional-review. The original approval above is historical; it does not approve this corrected wording or rubric.

**Project facts supplied to Research:**

```json
{
  "stories": 6,
  "areaPerStorySquareFeet": 1950,
  "use": "Residential building",
  "unknowns": [
    "occupancy classification",
    "construction type"
  ]
}
```

**Evaluation question:**

We are designing a six-story residential building with approximately 1,950 square feet on each story. Can the building be served by one exit stair?

**Expected answer:**

BC 1006.3.2 permits one exit for a Group R-2 building that is Type I or Type II construction, does not exceed six stories, and does not exceed 2,000 square feet per story. The stated height and floor area satisfy two of those conditions, but compliance cannot be confirmed until the occupancy classification and construction type are known. This passage only establishes that the single-exit allowance may be available; other applicable egress, fire-protection, travel-distance, and design requirements must be checked under their respective sections without inventing requirements that are not in the selected evidence.

**Required concepts:**

- Identify Group R-2 as a condition of Item 7.
- Identify Type I or Type II construction as a condition.
- Identify the six-story maximum.
- Identify the 2,000-square-foot-per-story maximum.
- Recognize that six stories and approximately 1,950 square feet satisfy only the stated height and area conditions.
- Limit the conclusion to potential availability of the single-exit allowance.
- Keep other-scope evidence limitations separate from missing Project facts; the missing facts for Item 7 are occupancy and construction type.

**Forbidden conclusions:**

- Every six-story residential building can have one stair.
- The building qualifies without confirming Group R-2 and Type I or Type II construction.
- Assert specific additional requirements that are not supported by selected passages.

**Authority / evidence to verify:**

- BC 1006.3.2

**Missing facts:**

- Confirm the occupancy classification is Group R-2.
- Confirm the construction type is Type I or Type II.

**Reconciliation notes:**

- Use the current repository answer and rubric, with the selected evidence and project context restored.
- Development amendment cc02-established-facts-20260908 aligns missing-fact expectations with the supplied question and Project facts. Original source approvals are preserved; this correction awaits professional review.

## CC-03 — Occupancy classification of a residential multipurpose room

Source basis: 2022 New York City Construction Codes

Source case: `residential-multipurpose-occupancy`; recorded status: approved; reviewed: 2026-07-22T00:00:00.000Z. Scope: Existing construction-code evaluation approval; no new live result or release approval.

**Development correction:** `cc03-established-facts-20260908`. Status: development-correction-pending-professional-review. The original approval above is historical; it does not approve this corrected wording or rubric.

**Project facts supplied to Research:**

```json
{
  "buildingUse": "Apartment building",
  "roomAreaNetSquareFeet": 900,
  "typicalArrangement": "Tables and chairs",
  "users": "Residents only"
}
```

**Evaluation question:**

A 900-net-square-foot multipurpose room in an apartment building will normally contain tables and chairs and is only for residents. Does it need to be classified as Group A-3?

**Expected answer:**

For an unconcentrated assembly arrangement with tables and chairs, Table 1004.1.3 uses 15 net square feet per occupant. A 900-net-square-foot room therefore has a calculated occupant load of 60 people. Because that is fewer than 75 occupants, and assuming the room is accessory to the residential occupancy, BC 303.1.3 permits it to be classified as Group B or as part of the occupancy it serves rather than as Group A. Confirm whether the room is accessory to the residential occupancy. Other intended functions may require a different occupant-load factor; the stated normal tables-and-chairs arrangement does not establish concentrated seating or standing use.

**Required concepts:**

- Use the 15-net-square-feet-per-occupant factor for unconcentrated tables and chairs.
- Calculate 900 divided by 15 as an occupant load of 60.
- Compare 60 with the fewer-than-75 threshold.
- Explain the Group B or served-occupancy classification option when the room is accessory.
- Avoid automatically classifying every residential amenity room as Group R-2.
- Treat the stated net area and normal furniture arrangement as supplied facts; distinguish other material intended functions from reconfirming those facts.

**Forbidden conclusions:**

- Every residential amenity room is automatically Group R-2.
- The room is below 75 occupants without performing the calculation.
- The result is unchanged for concentrated seating, standing space, or another function.
- Call the stated 900-net-square-foot area or normal tables-and-chairs arrangement missing without a contradiction.

**Authority / evidence to verify:**

- BC 303.1.3
- BC 1004.1.3

**Missing facts:**

- Confirm whether the room is accessory to the residential occupancy.
- Whether other intended activities require a different function-specific occupant-load factor from the stated normal tables-and-chairs use.

**Reconciliation notes:**

- Use the current repository answer and rubric, with the selected evidence and project context restored.
- Development amendment cc03-established-facts-20260908 aligns missing-fact expectations with the supplied question and Project facts. Original source approvals are preserved; this correction awaits professional review.

## CC-04 — Plumbing fixtures for an accessory assembly space

Source basis: 2022 New York City Construction Codes

Source case: `accessory-assembly-plumbing-fixtures`; recorded status: approved; reviewed: 2026-07-22T00:00:00.000Z. Scope: Existing construction-code evaluation approval; no new live result or release approval.

**Development correction:** `cc04-optional-assembly-calculation-20260908`. Status: development-correction-pending-professional-review. The original approval above is historical; it does not approve this corrected wording or rubric.

**Project facts supplied to Research:**

```json
{
  "space": "Residential multipurpose room",
  "potentialClassification": "Group B under the accessory assembly provision",
  "unknowns": [
    "assembly use category",
    "occupant load",
    "shared facilities",
    "sex distribution"
  ]
}
```

**Evaluation question:**

If the multipurpose room is permitted to be classified as Group B because it has fewer than 75 occupants, can its required plumbing fixtures be calculated using the normal Group B fixture requirements?

**Expected answer:**

Yes, if the room is properly classified as Group B as the question assumes. PC 403.1 ties fixture requirements to occupancy, so Group B provides the general baseline. BC 303.1.3 also permits a qualifying accessory assembly room with fewer than 75 occupants to use the applicable Assembly fixture requirements. That alternative is optional; Group B classification does not make the Group B calculation mandatory or prohibit it. Cite BC 303.1.3 for this accessory-room option. PC 403.1 note j separately concerns a building or nonaccessory tenant assembly space.

The selected passages do not supply numerical Table 403.1 rates, so they cannot establish a final count. If using the Assembly alternative, identify its applicable use category. For a count, retain any established occupant load and obtain only remaining material inputs, including any proposed shared-facility arrangement. PC 403.1.1 generally divides the load equally between the sexes unless approved statistical data supports another distribution; apply the applicable rates, add fractional requirements across occupancies before rounding, and round up. The selected passages do not establish permission to share facilities.

**Required concepts:**

- Answer the permission question directly, conditional on the properly established or expressly assumed Group B classification.
- Bind the Group B baseline to PC 403.1 occupancy-based fixture authority; do not rely only on the accessory-room classification provision.
- Explain that BC 303.1.3 permits, rather than mandates, the qualifying accessory room to use applicable Assembly fixture requirements.
- Preserve the distinct building/nonaccessory-tenant scope of PC 403.1 note j and cite BC 303.1.3 for the accessory-room option.
- Distinguish an established general permission from unsupplied numerical rates and an uncomputed fixture count.
- Identify the applicable Assembly use category only if applying the Assembly alternative.
- For a numerical calculation, preserve the equal sex-distribution rule and statistical-data exception, application of rates, and addition of fractions across occupancies before rounding up.
- Retain an occupant load established in the active conversation; ask for it only if still unknown and needed for a count.
- Do not approve shared facilities or give a final count from the selected passages and unresolved project facts.

**Forbidden conclusions:**

- Group B fixture requirements are prohibited merely because BC 303.1.3 permits an Assembly calculation.
- Assembly calculations are mandatory for every qualifying accessory room.
- Group B classification always controls the plumbing fixture calculation or resolves a final count.
- The selected PC 403.1 fewer-than-75 note independently applies its building/nonaccessory-tenant rule to this accessory room.
- Unsupplied table rates prevent the general permission conclusion even though PC 403.1 occupancy-based authority is supplied.
- Residential unit fixtures automatically satisfy the multipurpose-room requirement.
- Supply numerical rates or a final fixture count without the applicable evidence and project inputs.

**Authority / evidence to verify:**

- BC 303.1.3
- PC 403.1
- PC 403.1.1

**Missing facts:**

- For a numerical count: occupant load, if not already established in the active conversation.
- For the Assembly alternative: the applicable Assembly use category.
- For a proposed shared-facility arrangement: the existing facilities and their permitted availability to this room.
- For a numerical count: whether approved statistical data supports a different sex distribution.

**Reconciliation notes:**

- Explicit development amendment cc04-optional-assembly-calculation-20260908 corrects the permission/requirement distinction. The original source case and its approval record remain unchanged.
- Missing numerical table rates limit calculation, not the general occupancy-based rule supplied in PC 403.1.
- The corrected wording and rubric remain pending independent professional review. No new paid-run, production or release approval follows from this amendment.

## CC-05 — Building Code evidence versus an HCR requirement

Source basis: 2022 New York City Construction Codes

Source case: `building-code-versus-hcr`; recorded status: approved; reviewed: 2026-07-22T00:00:00.000Z. Scope: Existing construction-code evaluation approval; no new live result or release approval.

**Project facts supplied to Research:**

```json
{
  "questionedAuthority": "New York State Homes and Community Renewal (HCR)",
  "selectedAuthority": "New York City Building Code only",
  "unknowns": [
    "applicable HCR standard",
    "funding requirements",
    "agency guidance"
  ]
}
```

**Evaluation question:**

Does this section prove that HCR requires a vanity in the bathroom?

**Expected answer:**

No. In its Type B+NYC unit toilet-and-bathing-room context, the selected Building Code subsection establishes the required water-closet clearance when only a forward approach is provided and permits a compliant lavatory at the specified rear-wall location. A lavatory and a vanity must remain distinct: this subsection does not establish an HCR vanity requirement, and its permissive lavatory-location language does not prove that no other Building Code provision requires a lavatory. Confirm whether the unit and bathroom are subject to the Type B+NYC provisions and provide the applicable HCR design standard, program or funding requirement, or official agency guidance before stating what HCR requires.

**Required concepts:**

- Answer no.
- Place the subsection in its Building Code Type B+NYC unit toilet-and-bathing-room applicability context.
- Explain that the passage regulates water-closet clearances for a forward approach.
- Explain that the passage permits a compliant lavatory on the rear wall under the stated placement condition.
- Keep a lavatory distinct from a vanity and do not present the terms as interchangeable requirements.
- State that the selected evidence does not establish an HCR vanity requirement.
- Do not imply that no other Building Code provision requires a lavatory merely because this subsection contains permissive location language.
- Request the applicable HCR material before stating what HCR requires.

**Forbidden conclusions:**

- A vanity is required by this Building Code passage.
- Treat a vanity and a lavatory as interchangeable requirements.
- State what HCR requires without HCR material in the evidence.
- State or imply that no other Building Code provision requires a lavatory merely because this subsection permits a particular lavatory location.

**Authority / evidence to verify:**

- BC 1107.2.2.7.2.2

**Missing facts:**

- Confirm whether the unit and bathroom are subject to the Building Code Type B+NYC provisions applicable to this subsection.
- Provide the applicable HCR design standard, project funding requirement, or agency guidance.

**Reconciliation notes:**

- Use the current repository answer and rubric, with the selected evidence and project context restored.
- Restore the Type B+NYC context, distinguish vanity from lavatory, and avoid implying that no other provision requires a lavatory.

## ZR-01 — Rules of construction

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-rules-of-construction`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

How does the Zoning Resolution instruct a reader to resolve a conflict between the enacted text and an illustration or summary table?

**Expected answer:**

ZR 12-01 controls. The particular controls the general, and if there is a difference of meaning or implication between the enacted text and a caption, illustration, summary table, or illustrative table, the **text controls**. An illustration or summary table cannot override conflicting enacted text.

**Required concepts:**

- The particular controls the general.
- The enacted text controls over a caption, illustration, summary table, or illustrative table.
- The answer identifies Section 12-01.

**Forbidden conclusions:**

- An illustration overrides the enacted text.
- The answer relies on a section outside the selected evidence.

**Authority / evidence to verify:**

- [ZR 12-01 — Rules Applying to Text of Resolution](https://zr.planning.nyc.gov/article-i/chapter-2/12-01)

Selected canonical Zoning section IDs: 20018521.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-02 — Use Group I table

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-use-group-table`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

Using only the selected table, summarize how Use Group I allowances differ across M1, M2, and M3 districts and explain the table symbols.

**Expected answer:**

ZR 42-111 does not give every Use Group I use the same treatment in all Manufacturing Districts. In the selected table: agricultural uses are permitted in M1, M2, and M3 subject to the indicated `P` and `U` notations; cemeteries, golf courses, outdoor racket courts, and public/private parks are permitted in M1 but not in M2 or M3, with outdoor racket courts also carrying `P` in M1; outdoor skating rinks are permitted in all three; and sand, gravel, or clay pits require a special permit in all three. The table symbols are `●` permitted, `♦` permitted with limitations, `○` special permit required, `–` not permitted, `S` size restriction, `P` additional conditions, and `U` open-use allowances. The exact cell and any attached notation must be read together rather than generalized across the district columns.

**Required concepts:**

- The answer treats the table as structured evidence.
- The answer distinguishes district columns and symbol meanings.
- The answer does not infer a use allowance from prose that is absent from the selected table.

**Forbidden conclusions:**

- Every Use Group I use has the same allowance in every Manufacturing District.
- A symbol is interpreted without support in the selected evidence.

**Authority / evidence to verify:**

- [ZR 42-111 — Use Group I – general use allowances](https://zr.planning.nyc.gov/article-iv/chapter-2/42-111)

Selected canonical Zoning section IDs: 20017276.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-03 — Appendix J map boundaries

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-appendix-map-boundaries`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

What can the selected Appendix J material establish about designated areas, and what site-specific conclusion cannot be made without identifying the applicable map and location?

**Expected answer:**

Appendix J establishes the mapped boundaries of designated areas within Manufacturing Districts and distinguishes areas in which self-service storage is governed by different treatment. The selected material identifies Subarea 1 as the mapped area associated with the as-of-right provisions of ZR 42-19 and Subarea 2 as the mapped area associated with the CPC special-permit path under ZR 74-192. It cannot establish that a particular tax lot lies in either subarea without the applicable Appendix J map and the parcel's actual location.

**Required concepts:**

- The answer cites Appendix J.
- The answer distinguishes Subarea 1 and Subarea 2 treatment described in the selected evidence.
- The answer states that a parcel-specific conclusion requires the applicable map and parcel location.

**Forbidden conclusions:**

- A particular tax lot is inside a designated area without parcel and map evidence.
- The map image is treated as decorative rather than authoritative selected evidence.

**Authority / evidence to verify:**

- [ZR APPENDIX J — APPENDIX J — Designated Areas Within Manufacturing Districts](https://zr.planning.nyc.gov/appendix-j-designated-areas-within-manufacturing-districts)

Selected canonical Zoning section IDs: 20021237.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-04 — Special-district demolition

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-special-district-demolition`; recorded status: approved; reviewed: 2026-08-30T15:26:45.000Z. Scope: Terra answer-key testing only

**Original intake wording:**

What prerequisites does Section 101-75 state before a demolition permit may be issued in the identified Subdistrict, and what exception does it recognize?

**Evaluation question:**

Within the Atlantic Avenue Subdistrict of the Special Downtown Brooklyn District, what two prerequisites does Section 101-75 state before a demolition permit may be issued, and what unsafe-building exception does it recognize?

**Expected answer:**

Within the Atlantic Avenue Subdistrict, ZR 101-75 requires both building-application approval for the new development or enlargement and evidence of a construction-financing commitment from a domestic bank, insurance company, or real estate investment company. Preserve the enacted wording "letter trust" when describing the required form. ZR 101-04 establishes the subdistrict scope. The exception covers unsafe buildings whose demolition is required under the cited Administrative Code provision or its successor; this is not a citywide demolition rule.

**Required concepts:**

- Section 101-04 establishes that Sections 101-70 through 101-75 apply to the Atlantic Avenue Subdistrict within the Special Downtown Brooklyn District.
- Section 101-75 requires building-application approval for the new development or enlargement.
- Section 101-75 also requires evidence of a construction-financing commitment from a domestic bank, insurance company, or real estate investment company, in the source's stated form of a letter trust.
- The exception is limited to unsafe buildings whose demolition is required under the cited Administrative Code provision or its successor.

**Forbidden conclusions:**

- The rule is described as citywide.
- The answer invents a demolition prerequisite not present in the selected evidence.

**Authority / evidence to verify:**

- [ZR 101-04 — Subdistricts](https://zr.planning.nyc.gov/article-x/chapter-1/101-04)
- [ZR 101-75 — Special Provisions for Demolition of Buildings](https://zr.planning.nyc.gov/article-x/chapter-1/101-75)

Selected canonical Zoning section IDs: 20020818, 20020889.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.
- Re-reviewed Sections 101-04 and 101-75 against the current official NYC Planning pages; named the Atlantic Avenue Subdistrict in the question and made both prerequisites, the source's exact letter-trust wording, and the narrow unsafe-building exception explicit.
- Use the revised repository question. The exact uploaded question remains separately recorded.

## ZR-05 — Amendment history

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-amendment-history`; recorded status: approved; reviewed: 2026-08-30T15:26:45.000Z. Scope: Terra answer-key testing only

**Original intake wording:**

What does the imported amendment history show about Section 42-00, and what should a professional verify before relying on a historical version for a particular date?

**Evaluation question:**

What does NYC Planning's official amendment-history metadata currently identify for Section 42-00, and what must a professional still verify before reconstructing the text in force on a particular date?

**Expected answer:**

The reviewed amendment-history record for ZR 42-00 identifies December 5, 2024 (N240290ZRY) and two June 6, 2024 events (N240011ZRY and N240010ZRY). That metadata identifies changes; it does not reproduce the text legally in force on every earlier date. Verify each effective date, official CPC report, and authoritative archived text or enactment for the date at issue.

**Required concepts:**

- The answer distinguishes current text from amendment-history metadata.
- The answer identifies the December 5, 2024 N240290ZRY event and the two June 6, 2024 events N240011ZRY and N240010ZRY.
- The answer recommends verifying each effective date, official CPC report, and the authoritative archived text or enactment applicable on the date at issue.
- The answer explains that amendment notes identify changes but do not themselves reproduce every prior version of the section.

**Forbidden conclusions:**

- The current text is represented as unchanged since 1961.
- An amendment note is treated as a complete historical reconstruction of prior enacted text.

**Authority / evidence to verify:**

- [ZR 42-00 — GENERAL PROVISIONS](https://zr.planning.nyc.gov/article-iv/chapter-2/42-00)

Selected canonical Zoning section IDs: 20017271.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.
- Rechecked the live NYC Planning amendment-history endpoint; retained the three explicit current events and revised the question and rubric to require official CPC-report and archived-text verification rather than treating metadata as a historical-text reconstruction.
- Use the revised repository question. The exact uploaded question remains separately recorded.

## ZR-06 — Missing location facts

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-missing-location-facts`; recorded status: approved; reviewed: 2026-08-30T15:26:45.000Z. Scope: Terra answer-key testing only

**Original intake wording:**

Is a proposed self-storage use permitted as-of-right on a specific property when no address, zoning district, special district, or mapped subarea has been provided?

**Evaluation question:**

Can a proposed self-service storage facility be found permitted as-of-right on a specific property when its address, mapped zoning district, special-district status, Appendix J subarea, lot area, and any December 19, 2017 existing-facility facts have not been provided?

**Expected answer:**

A parcel-specific as-of-right conclusion cannot be made yet. Establish the address, mapped district, special-district status, Appendix J map/subarea, lot area, and any existing-facility facts tied to December 19, 2017. Apply the self-service-storage provisions in ZR 42-191 through 42-193, the Subarea 2 special-permit path in ZR 74-192, and Appendix J together. Subarea 1 treatment, performance standards, and any existing-facility documentation, enlargement, reconstruction, or nonconforming-use path cannot be assumed from an unidentified property.

**Required concepts:**

- The answer declines to make a parcel-specific determination.
- The answer identifies the missing address, mapped zoning district, special-district status, Appendix J map/subarea, lot area, and existing-facility/date facts.
- The answer separates the general Use Group IX table, the Subarea 1 limited-applicability conditions, the additional performance-standard conditions, the Subarea 2 special-permit path, and authoritative Appendix J map applicability.
- The answer explains that a December 19, 2017 facility may follow separate conforming-use documentation, enlargement, reconstruction, or nonconforming-use rules that cannot be assumed from the question.

**Forbidden conclusions:**

- The proposed use is approved or prohibited for the unidentified property.
- The answer silently retrieves evidence outside the selected sections.

**Authority / evidence to verify:**

- [ZR 42-191 — Use Group IX – general use allowances](https://zr.planning.nyc.gov/article-iv/chapter-2/42-191)
- [ZR 42-192 — Use Group IX – uses permitted with limited applicability](https://zr.planning.nyc.gov/article-iv/chapter-2/42-192)
- [ZR 42-193 — Use Group IX – uses subject to additional conditions](https://zr.planning.nyc.gov/article-iv/chapter-2/42-193)
- [ZR 74-192 — Self-service storage facility in designated areas within Manufacturing Districts](https://zr.planning.nyc.gov/article-vii/chapter-4/74-192)
- [ZR APPENDIX J — APPENDIX J — Designated Areas Within Manufacturing Districts](https://zr.planning.nyc.gov/appendix-j-designated-areas-within-manufacturing-districts)

Selected canonical Zoning section IDs: 20022472, 20022473, 20022474, 20019206, 20021237.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.
- Re-reviewed Sections 42-191 through 42-193, 74-192, and Appendix J against the current official pages; added lot-area and December 19, 2017 facility facts, distinguished Subarea 1 conditions from the Subarea 2 special-permit path, and kept the parcel conclusion fail-closed without the governing map.
- Use the revised repository question. The exact uploaded question remains separately recorded.

## ZR-07 — Mapped district missing

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-mapped-district-missing`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

A 10,000-square-foot site in the Bronx is proposed for a 40,000-square-foot residential building. What is the maximum permitted residential FAR when the mapped zoning district has not been established?

**Expected answer:**

The maximum permitted residential FAR cannot be determined yet. ZR 11-14 incorporates the zoning maps into the Zoning Resolution, so the mapped zoning district is a necessary applicability fact. The property location and any applicable commercial overlay, Special Purpose District, or other mapped condition must be established before selecting the governing FAR rule. A residential proposal does not justify assuming a Residence District.

**Required concepts:**

- The maximum residential FAR cannot be determined until the mapped zoning district is established.
- Section 11-14 incorporates the zoning maps into the Zoning Resolution and makes the mapped district an applicability fact.
- The answer identifies any applicable overlay, Special Purpose District, or other mapped condition as an additional fact that may affect the governing regulations.
- The answer may use authoritative map evidence if supplied, but otherwise asks for the property location and mapped conditions.

**Forbidden conclusions:**

- A Residence District is inferred merely because the proposal is residential.
- Allowable floor area is calculated before the governing mapped district and conditions are established.

**Authority / evidence to verify:**

- [ZR 11-14 — Incorporation of Maps](https://zr.planning.nyc.gov/article-i/chapter-1/11-14)

Selected canonical Zoning section IDs: 20018425.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-08 — R7A standard FAR

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-r7a-standard-far`; recorded status: approved; reviewed: 2026-08-30T15:26:45.000Z. Scope: Terra answer-key testing only

**Original intake wording:**

A 10,000-square-foot R7A zoning lot will contain standard residences and 42,000 square feet of residential floor area. Does the proposal comply with the basic maximum residential FAR?

**Evaluation question:**

Using only the basic Section 23-22 table and the Section 12-10 FAR definition, does 42,000 square feet of residential floor area on a 10,000-square-foot R7A zoning lot containing standard residences fit the basic maximum, and what broader compliance conclusion remains outside those facts?

**Expected answer:**

No. ZR 23-22 sets the R7A maximum residential FAR for standard residences at **4.00**. On a 10,000-square-foot zoning lot, that permits `10,000 × 4.00 = 40,000` square feet of residential zoning floor area. The proposed 42,000 square feet exceeds the basic limit by 2,000 square feet. That calculation is zoning floor area, not a statement that gross building area must equal 40,000 square feet. This establishes only the basic-table arithmetic result, not complete zoning compliance.

**Required concepts:**

- Section 23-22 sets the R7A maximum residential FAR for standard residences at 4.00.
- A 4.00 FAR applied to the stated 10,000-square-foot zoning lot permits 40,000 square feet of residential floor area.
- The proposed 42,000 square feet exceeds that basic limit by 2,000 square feet.
- The answer distinguishes zoning floor area from an unsupported claim about gross building area.
- The answer limits the conclusion to the basic table and does not claim complete zoning compliance without mapped overlays, special-district rules, deductions, exemptions, or other applicable provisions.

**Forbidden conclusions:**

- The 42,000-square-foot proposal complies with the basic 4.00 FAR limit.
- The answer states that the building can contain exactly 40,000 gross square feet.

**Authority / evidence to verify:**

- [ZR 23-22 — Floor Area Regulations for R6 Through R12 Districts](https://zr.planning.nyc.gov/article-ii/chapter-3/23-22)
- [ZR 12-10 — DEFINITIONS](https://zr.planning.nyc.gov/article-i/chapter-2/12-10)

Selected canonical Zoning section IDs: 20018017, 20018523.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.
- Rechecked the current official Section 23-22 R7A row and Section 12-10 FAR definition; retained the 4.00 calculation and added an explicit boundary against turning a basic-table arithmetic result into complete zoning compliance.
- Use the revised repository question. The exact uploaded question remains separately recorded.

## ZR-09 — R7A qualifying-affordable-housing FAR

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-r7a-affordable-far-qualification`; recorded status: approved; reviewed: 2026-08-30T15:26:45.000Z. Scope: Terra answer-key testing only

**Original intake wording:**

A 10,000-square-foot R7A zoning lot is proposed with 48,000 square feet of residential floor area, and the project is described as containing qualifying affordable housing. Is the proposed FAR within the R7A limit?

**Evaluation question:**

A 10,000-square-foot R7A zoning lot is proposed with 48,000 square feet of residential floor area and is merely described as containing qualifying affordable housing. What does the Section 23-22 table establish numerically, and what qualification and affordable-floor-area facts are still needed before concluding that the higher FAR is available?

**Expected answer:**

The proposed 4.80 FAR is below the 5.01 table ceiling, but the supplied affordable-housing label does not establish that 4.80 FAR is available. ZR 23-22 lists 5.01 FAR for qualifying affordable or senior housing in R7A: 10,000 × 5.01 = 50,100 square feet, compared with the proposed 48,000. The applicable MIH, UAP, or regulatory-agreement path and required amount of affordable floor area must be established under Article II, Chapter 7. For UAP, ZR 27-111 limits the increase over the standard-residence FAR by the amount of affordable housing provided; ZR 27-16 supplies the applicable regulatory-agreement requirements. The table ceiling alone does not establish eligibility for the proposal.

**Required concepts:**

- Section 23-22 sets an R7A maximum FAR of 5.01 for qualifying affordable housing or qualifying senior housing.
- A 5.01 FAR applied to 10,000 square feet permits 50,100 square feet, so the stated 48,000 square feet is below that table ceiling.
- Being below the table ceiling does not establish entitlement to the higher FAR; the applicable MIH, UAP, or regulatory-agreement path and its required amount of affordable floor area must be established under Article II, Chapter 7.
- For a UAP path, Section 27-111 limits the increase above the standard-residence FAR to the amount of affordable housing provided, so the project description alone cannot establish that the full proposed 4.80 FAR is available.
- The user's label alone is not treated as proof that the development qualifies for the higher FAR.

**Forbidden conclusions:**

- Any project containing affordable units automatically receives 5.01 FAR.
- The answer gives an unconditional compliance conclusion without establishing the qualifying-affordable-housing path.

**Authority / evidence to verify:**

- [ZR 23-22 — Floor Area Regulations for R6 Through R12 Districts](https://zr.planning.nyc.gov/article-ii/chapter-3/23-22)
- [ZR 27-111 — General definitions](https://zr.planning.nyc.gov/article-ii/chapter-7/27-111)
- [ZR 27-16 — Requirements for MIH Sites or UAP Sites](https://zr.planning.nyc.gov/article-ii/chapter-7/27-16)
- [ZR 12-10 — DEFINITIONS](https://zr.planning.nyc.gov/article-i/chapter-2/12-10)

Selected canonical Zoning section IDs: 20018017, 20022699, 20022711, 20018523.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.
- Re-reviewed current Sections 23-22, 12-10, 27-111, and 27-16; reframed the question so 5.01 is only a numerical ceiling and added the UAP rule that any FAR increase above the standard-residence limit is limited by the amount of affordable housing actually provided.
- Use the revised repository question. The exact uploaded question remains separately recorded.

## ZR-10 — R7A standard height

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-r7a-standard-height`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

Can a standard residential building in an R7A district be 90 feet tall under the basic height-and-setback table?

**Expected answer:**

No. Under the basic ZR 23-432 table, the maximum building height for **standard residences in R7A is 85 feet**, so a 90-foot standard-residence building is 5 feet over that basic maximum. The same table allows a higher maximum for qualifying affordable housing or qualifying senior housing, but that cannot be applied to a standard residence. The eligible-site modifications of ZR 23-434 apply to listed districts **without a letter suffix** and therefore do not enlarge the R7A limit.

**Required concepts:**

- Section 23-432 limits a standard-residence building in R7A to 85 feet under the basic table.
- The same table allows 115 feet for qualifying affordable housing or qualifying senior housing in R7A.
- A 90-foot standard residential building exceeds the basic maximum by five feet.
- Section 23-434 is not used to enlarge the R7A limit because its eligible-site modifications apply only in listed districts without a letter suffix.

**Forbidden conclusions:**

- R7A universally permits a 115-foot building.
- The eligible-site modifications of Section 23-434 are represented as applicable to R7A.

**Authority / evidence to verify:**

- [ZR 23-432 — Height and setback requirements](https://zr.planning.nyc.gov/article-ii/chapter-3/23-432)
- [ZR 23-434 — Height and setback modifications for eligible sites](https://zr.planning.nyc.gov/article-ii/chapter-3/23-434)

Selected canonical Zoning section IDs: 20018085, 20018087.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-11 — R7A lot coverage

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-r7a-lot-coverage`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

An R7A interior zoning lot contains 10,000 square feet. Can a standard residential development cover 8,500 square feet of the lot under the basic lot-coverage regulation?

**Expected answer:**

No under the basic rule. ZR 23-362 sets an 80 percent maximum residential lot coverage for standard interior or through lots in R6 through R12 districts. Eighty percent of 10,000 square feet is 8,000 square feet, so 8,500 square feet exceeds the basic maximum by 500 square feet. ZR 23-363 can modify lot coverage for specified conditions, and yard/open-area rules may impose a more restrictive footprint, so 8,000 square feet is not an unconditional buildable-footprint entitlement.

**Required concepts:**

- Section 23-362 sets the basic maximum residential lot coverage for a standard interior or through lot in R6 through R12 Districts at 80 percent.
- Eighty percent of the stated 10,000-square-foot lot is 8,000 square feet, so 8,500 square feet exceeds the basic maximum.
- Section 23-363 can modify the percentage for specified shallow lots, locations near corners, and short block dimensions.
- The answer does not treat the 8,000-square-foot percentage calculation as an entitlement to that footprint because yard and other open-area rules may be more restrictive.

**Forbidden conclusions:**

- The owner has an unconditional right to build an 8,000-square-foot footprint.
- The answer ignores the possible modifications in Section 23-363 or applicable yard requirements.

**Authority / evidence to verify:**

- [ZR 23-362 — Maximum lot coverage in R6 through R12 Districts](https://zr.planning.nyc.gov/article-ii/chapter-3/23-362)
- [ZR 23-363 — Special rules for certain interior or through lots](https://zr.planning.nyc.gov/article-ii/chapter-3/23-363)
- [ZR 23-342 — Rear yard requirements](https://zr.planning.nyc.gov/article-ii/chapter-3/23-342)

Selected canonical Zoning section IDs: 20022764, 20018020, 20018051.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-12 — Narrow attached-building rear yard

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-narrow-attached-rear-yard`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

An attached residential building is proposed on a 35-foot-wide interior zoning lot with a 20-foot rear yard. Is that sufficient under the standard rear-yard rule?

**Expected answer:**

No. Under ZR 23-342, an attached or semi-detached residential building on a zoning lot less than 40 feet wide requires a rear yard at least **30 feet** deep under the stated standard rule. The proposed 20-foot yard is 10 feet short. That conclusion is limited to the standard facts and does not eliminate any applicable shallow-lot modification or other exception in ZR 23-34.

**Required concepts:**

- Section 23-342 requires a rear yard at least 30 feet deep for an attached or semi-detached building on a zoning lot less than 40 feet wide.
- The proposed 20-foot rear yard is 10 feet short of the standard requirement.
- The conclusion is limited to the stated standard-lot facts and does not erase the shallow-lot modification or other exceptions in Section 23-34.

**Forbidden conclusions:**

- A 20-foot rear yard satisfies the standard rule for the stated 35-foot-wide attached-building lot.
- All residential rear yards are described as universally requiring 30 feet.

**Authority / evidence to verify:**

- [ZR 23-342 — Rear yard requirements](https://zr.planning.nyc.gov/article-ii/chapter-3/23-342)

Selected canonical Zoning section IDs: 20018051.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-13 — Through-lot historical shallow condition

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-through-lot-historic-shallow-condition`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

A through lot is 150 feet deep and the proposal provides a 20-foot rear yard equivalent. Is that enough when the lot's historical shallow-lot condition is unknown?

**Expected answer:**

The answer cannot be confirmed from the stated depth alone. ZR 23-343 does not make the 20-foot path automatically available merely because the through lot is 150 feet deep. The reduced rear-yard-equivalent treatment identified in the packet depends on the specified shallow-lot condition having existed on December 15, 1961 and not subsequently having been increased or decreased in depth. That historical fact must be verified, along with whether any categorical exception in the section applies.

**Required concepts:**

- Section 23-343 does not make the 20-foot minimum automatically available merely because the through lot is 150 feet deep.
- The reduced rear-yard-equivalent path requires the shallow-lot condition to have existed on December 15, 1961 and subsequently neither increased nor decreased in depth.
- Historic shallow-lot status is identified as a required missing project fact.
- The answer also recognizes the section's categorical exceptions for specified through lots.

**Forbidden conclusions:**

- A 150-foot through lot automatically requires only a 20-foot rear yard equivalent.
- The historical December 15, 1961 condition is assumed without evidence.

**Authority / evidence to verify:**

- [ZR 23-343 — Rear yard equivalent requirements](https://zr.planning.nyc.gov/article-ii/chapter-3/23-343)

Selected canonical Zoning section IDs: 20018060.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-14 — Residential building spacing

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-residential-building-spacing`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

Two separate apartment buildings containing more than three dwelling units each are proposed on the same zoning lot, do not connect at any level, are below 125 feet, and are 30 feet apart. Is the spacing sufficient?

**Expected answer:**

No under the stated standard rule. ZR 23-371 requires the relevant unconnected building portions below 125 feet to be **40 feet apart**. A 30-foot separation is therefore 10 feet short. The section contains an exception for buildings separated by a rear yard equivalent, so the 40-foot statement should not be turned into a universal rule for every building arrangement on one zoning lot.

**Required concepts:**

- Section 23-371 requires buildings on the same zoning lot that do not connect at any level to be 40 feet apart for portions below 125 feet.
- The stated 30-foot separation is 10 feet short of that standard requirement.
- The answer recognizes the section's exception for buildings separated by a rear yard equivalent and does not convert the rule into a universal spacing rule.

**Forbidden conclusions:**

- The stated 30-foot separation satisfies the 40-foot standard.
- All buildings on one zoning lot are said to require 40 feet of separation in every circumstance.

**Authority / evidence to verify:**

- [ZR 23-371 — Standard minimum distance between buildings](https://zr.planning.nyc.gov/article-ii/chapter-3/23-371)

Selected canonical Zoning section IDs: 20018102.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-15 — C3 professional office

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-c3-professional-office`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

A 1,500-square-foot architectural office is proposed in a C3 district. Is the professional office use permitted as-of-right under the underlying C3 use regulations?

**Expected answer:**

No under the underlying C3 use regulations. ZR 32-17 classifies business and professional offices in Use Group VII, and the office row in ZR 32-171 is marked not permitted in the C3 column. That does not mean an office is impossible in every C3-mapped situation; a separate special-purpose-district provision, authorization, special permit, variance, or other lawful modification could change the result if applicable.

**Required concepts:**

- Section 32-17 classifies business and professional offices in Use Group VII.
- The office row in Section 32-171 is marked not permitted in the C3 column.
- The answer states that the use is not permitted as-of-right under the underlying C3 use regulations while preserving separate special-purpose-district, authorization, or variance paths.

**Forbidden conclusions:**

- The architectural office is represented as permitted as-of-right in C3.
- The answer claims that professional offices are unlawful in every C3-mapped location under every possible modifying provision.

**Authority / evidence to verify:**

- [ZR 32-17 — Use Group VII – Offices and Laboratories](https://zr.planning.nyc.gov/article-iii/chapter-2/32-17)
- [ZR 32-171 — Use Group VII – general use allowances](https://zr.planning.nyc.gov/article-iii/chapter-2/32-171)

Selected canonical Zoning section IDs: 20017827, 20022494.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-16 — C4-4 residential use

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-c4-4-residential-use`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

A C4-4 zoning lot is proposed with retail on the ground floor and apartments above. Is the residential use permitted under the underlying use regulations?

**Expected answer:**

Yes under the underlying C4-4 use provisions. ZR 32-121 classifies residential uses in Use Group II and marks the C4 column as permitted subject to additional conditions; ZR 32-123 generally permits residential uses in C4 districts, subject to the identified C4-1 Staten Island limitation. That answers only the use-permission question. It does not establish compliance with mixed-building floor area, height, lot coverage, yards, parking, or other bulk regulations.

**Required concepts:**

- Section 32-121 places residential uses in Use Group II and marks the C4 column as permitted subject to additional conditions.
- Section 32-123 generally permits residential uses in C4 Districts and states the identified C4-1 Staten Island limitation.
- The answer concludes that residential use is permitted under these underlying C4-4 provisions without claiming complete zoning compliance.
- The answer separates use permission from mixed-building FAR, height, lot coverage, parking, and other bulk analysis.

**Forbidden conclusions:**

- Permission for apartments is treated as proof that the entire mixed building complies with zoning.
- Residential R-district bulk controls are applied directly without researching the mixed-building provisions.

**Authority / evidence to verify:**

- [ZR 32-121 — Use Group II – general use allowances](https://zr.planning.nyc.gov/article-iii/chapter-2/32-121)
- [ZR 32-123 — Use Group II – uses subject to additional conditions](https://zr.planning.nyc.gov/article-iii/chapter-2/32-123)

Selected canonical Zoning section IDs: 20022450, 20022452.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-17 — Inner Transit Zone new-unit parking

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-inner-transit-zone-new-unit-parking`; recorded status: approved; reviewed: 2026-08-30T15:26:45.000Z. Scope: Terra answer-key testing only

**Original intake wording:**

An 80-unit residential development in an R7A district is within the Inner Transit Zone, and all dwelling units will be created after December 5, 2024. How many accessory residential parking spaces are required?

**Evaluation question:**

An 80-unit R7A residential development is within the Inner Transit Zone; every unit's temporary certificate of occupancy, or final certificate if no temporary certificate is issued, will be issued after December 5, 2024, and no application qualifies for the pre-December 5, 2024 continuation in Section 11-333. How many accessory off-street residential parking spaces does Section 25-211 require for those units?

**Expected answer:**

Zero accessory off-street residential parking spaces are required under ZR 25-211 for the stated units. The revised scenario establishes issuance of each temporary certificate of occupancy, or final certificate where no temporary certificate is issued, after December 5, 2024, and excludes the pre-December 5, 2024 continuation path in ZR 11-333. Apply that certificate-based creation test and the Inner Transit Zone provisions of ZR 25-20 and 25-211. This result does not automatically permit removal of existing required parking or apply to existing units.

**Required concepts:**

- Section 25-211 requires no accessory off-street parking spaces for dwelling units or rooming units created after December 5, 2024 within the Inner Transit Zone.
- The answer states that zero spaces are required under that provision for the stated new units.
- The answer checks Section 11-333 and relies on the stated absence of the filing and approval facts needed to continue under the pre-December 5, 2024 regulations.
- The answer distinguishes units created after December 5, 2024 from existing units and parking governed by the separate maintenance provisions.
- The answer uses the section's certificate-of-occupancy definition of when a unit is created rather than assuming a colloquial construction date.

**Forbidden conclusions:**

- Parking is represented as never required anywhere in the Inner Transit Zone.
- Existing required parking is said to be removable automatically.
- The December 5, 2024 transition and Section 11-333 vesting path are ignored.

**Authority / evidence to verify:**

- [ZR 11-333 — Special allowances for building permits issued prior to certain dates](https://zr.planning.nyc.gov/article-i/chapter-1/11-333)
- [ZR 25-20 — REQUIRED ACCESSORY OFF-STREET PARKING SPACES FOR RESIDENCES](https://zr.planning.nyc.gov/article-ii/chapter-5/25-20)
- [ZR 25-211 — General provisions](https://zr.planning.nyc.gov/article-ii/chapter-5/25-211)

Selected canonical Zoning section IDs: 20018444, 20017540, 20017541.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.
- Re-reviewed current Sections 11-333, 25-20, and 25-211; replaced the ambiguous word created with the section's temporary/final certificate-of-occupancy test and tied the transition assumption to the actual Section 11-333 filing-and-approval path.
- Use the revised repository question. The exact uploaded question remains separately recorded.

## ZR-18 — Newly assembled divided zoning lot

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-new-divided-zoning-lot`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Development correction:** `zr18-applicable-date-and-conditions-20260908`. Status: development-correction-pending-professional-review. The original approval above is historical; it does not approve this corrected wording or rubric.

**Evaluation question:**

A zoning lot assembled in 2026 straddles two zoning districts, with more than 50 percent of its area in the less restrictive district. Can that majority district's use regulations automatically apply to the entire zoning lot under Section 77-11?

**Expected answer:**

No. Majority area alone does not establish eligibility under ZR 77-11. The lot must have existed on December 15, 1961 or the applicable subsequent amendment date, and satisfy the 25-foot maximum minority-side depth measured perpendicular to the mapped boundary. A 2026 assembly year does not determine whether the lot existed on an unidentified applicable amendment date. Establish that date and the lot's status then. If the lot did not exist on the applicable date, ZR 77-02 regulates each portion under its own district.

Identify the actual districts and any special-purpose-district override before applying 77-11; its residential-district proviso can also change the result. ZR 77-02 makes the separate adjusted-FAR mechanism in 77-22 available to divided lots created at any time where different bulk rules apply. That calculation does not by itself transfer use regulations or resolve other applicable controls. (ZR 77-02, 77-11, 77-22)

**Required concepts:**

- Reject automatic majority-area treatment without conclusively rejecting eligibility from the assembly year alone.
- Retain the December 15, 1961 or applicable subsequent amendment date condition and 25-foot perpendicular-depth limit under 77-11.
- Apply 77-02 portion-by-portion regulation only when its applicable-date premise is established.
- The separate adjusted-FAR mechanism applies to divided lots created at any time where different bulk rules apply; it does not establish use permission.
- Preserve relevant special-district overrides. If explaining expanded bulk or other consequences, include the residential-district proviso rather than claiming every majority-district rule applies without qualification.

**Forbidden conclusions:**

- Whichever district contains 51 percent of a newly assembled zoning lot automatically controls the entire lot.
- The Section 77-22 FAR mechanism is represented as transferring the majority district's use regulations to the entire lot.
- A 2026 assembly year alone proves that the lot postdates every applicable amendment or is ineligible under 77-11.
- Unqualified extension of all majority-district regulations while omitting the residential-district proviso.

**Authority / evidence to verify:**

- [ZR 77-02 — Zoning Lots not Existing Prior to Effective Date or Amendment of Resolution](https://zr.planning.nyc.gov/article-vii/chapter-7/77-02)
- [ZR 77-11 — Conditions for Application of Use Regulations to Entire Zoning Lot](https://zr.planning.nyc.gov/article-vii/chapter-7/77-11)
- [ZR 77-22 — Floor Area Ratio](https://zr.planning.nyc.gov/article-vii/chapter-7/77-22)

Selected canonical Zoning section IDs: 20018891, 20018894, 20018899.

**Missing facts:**

- If deciding eligibility: applicable amendment date and whether the lot existed then.
- Minority-side perpendicular depth, actual districts and applicable special-district provisions, if deciding eligibility.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.
- Development amendment zr18-applicable-date-and-conditions-20260908 corrects a temporal inference in the prior reference and preserves material source qualifications. The original reviewed source case, question, selected evidence and approval history remain unchanged; this revised development rubric awaits professional review.

## ZR-19 — Zoning-lot contiguity definition

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-zoning-lot-contiguity-definition`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

Two tax lots on the same block have the same owner but touch for only eight linear feet and were not historically one zoning lot. Can they now be treated as one zoning lot merely because they share ownership?

**Expected answer:**

No. Common ownership alone does not make the two tax lots one zoning lot under the stated facts. The current ZR 12-10 pathways identified in paragraphs (c) and (d) require two or more lots of record to be contiguous for at least **10 linear feet** within a single block, together with the applicable ownership, party-in-interest, filing, and/or declaration requirements. An eight-foot connection does not satisfy those current pathways. The historical pathways must be considered separately, and a zoning lot may or may not coincide with a tax lot shown on the tax map.

**Required concepts:**

- No. Common ownership alone does not make the two tax lots one zoning lot under the stated facts.
- The Section 12-10 pathways in paragraphs (c) and (d) require two or more lots of record to be contiguous for at least 10 linear feet within a single block, so an eight-foot connection does not satisfy those pathways.
- The answer separately checks the historical pathways in paragraphs (a) and (b) and does not imply that the 10-linear-foot requirement governs every branch of the definition.
- The answer identifies the additional filing, ownership, party-in-interest, or Declaration requirements that apply under paragraphs (c) and (d), as relevant.
- The answer explains that a zoning lot may or may not coincide with a tax lot shown on the official tax map.

**Forbidden conclusions:**

- Common ownership is said to create a zoning-lot merger automatically.
- The 10-linear-foot requirement is said to govern every branch of the zoning-lot definition.
- An eight-foot point of contiguity is said to satisfy the current paragraphs (c) or (d).
- A tax lot and a zoning lot are treated as necessarily identical.

**Authority / evidence to verify:**

- [ZR 12-10 — DEFINITIONS](https://zr.planning.nyc.gov/article-i/chapter-2/12-10)

Selected canonical Zoning section IDs: 20018523.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-20 — Cellar floor-area definition

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-cellar-floor-area-definition`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

A 5,000-square-foot below-grade storage level has more than one-half of its floor-to-ceiling height below the applicable base plane and is not used for dwelling purposes. Does it count as zoning floor area?

**Expected answer:**

Generally no, on the stated facts and subject to the definition's special measurement rules. Where a base plane determines building height, a space with more than one-half of its floor-to-ceiling height below the base plane is a cellar. ZR 12-10 generally excludes cellar space from zoning floor area unless it is used for dwelling purposes, and the stated storage use is not a dwelling use. The special rules for sloping base planes, the applicable street-wall/through-lot condition, and certain lowered-yard conditions must still be checked before making the classification conclusive. The separate rule that retail cellar space can count for parking, bicycle-parking, and loading calculations does not make ordinary non-dwelling storage zoning floor area for all purposes.

**Required concepts:**

- No, on the stated facts and subject to the definition's special measurement rules. Where a base plane determines building height, a space with more than one-half its floor-to-ceiling height below that base plane is a cellar.
- The Section 12-10 floor-area definition generally excludes cellar space unless it is used for dwelling purposes, and the stated storage use is not a dwelling use.
- The answer checks the special cellar rules for a sloping base plane, the applicable street wall line level or through lot, and a yard lowered after December 5, 1990 before treating the classification as conclusive.
- The answer notes that cellar space used for retailing is included when calculating accessory off-street parking, bicycle parking, and loading requirements, without converting ordinary non-dwelling storage into zoning floor area.

**Forbidden conclusions:**

- All below-grade space is described as exempt from zoning floor area.
- Any amount of space below grade is said to establish a cellar without applying the more-than-one-half-height test.
- The retailing caveat is said to make every cellar count as floor area for all purposes.
- The New York City Building Code is substituted for the Zoning Resolution definitions.

**Authority / evidence to verify:**

- [ZR 12-10 — DEFINITIONS](https://zr.planning.nyc.gov/article-i/chapter-2/12-10)

Selected canonical Zoning section IDs: 20018523.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## ZR-21 — Discontinuance of a non-conforming use

Source basis: NYC Zoning Resolution — text through 2026-08-13

Source case: `zr-nonconforming-use-discontinuance`; recorded status: approved; reviewed: 2026-08-17T21:17:41.000Z. Scope: Terra answer-key testing only

**Evaluation question:**

A building contains a lawful non-conforming use, but active operation of substantially all of that use stopped for 30 continuous months even though the owner always intended to reopen it. Can the owner simply restart the use?

**Expected answer:**

Generally no. ZR 52-61 states that, after active operation of substantially all non-conforming uses in a building or other structure has been discontinued continuously for two years, the property thereafter must be used only for a conforming use. The owner's intent to resume active operations does not preserve the use under the general rule. Thirty months exceeds two years. Before a project-specific conclusion, check the section's express exceptions, including the governmental-project, vacant-store, transient-hotel, and any other applicable exceptions.

**Required concepts:**

- Section 52-61 generally requires the building thereafter to be used only for a conforming use after active operation of substantially all non-conforming uses is discontinued continuously for two years.
- The owner's intent to resume active operations does not preserve the use under the general rule.
- Thirty continuous months exceeds the section's two-year period.
- The answer checks the express governmental-project, vacant-store, transient-hotel, and other stated exceptions before reaching a project-specific conclusion.

**Forbidden conclusions:**

- The owner's continuing intent alone is said to preserve the discontinued non-conforming use.
- Every non-conforming use is said to expire after two years regardless of the nature of the discontinuance or the section's express exceptions.

**Authority / evidence to verify:**

- [ZR 52-61 — General Provisions](https://zr.planning.nyc.gov/article-v/chapter-2/52-61)

Selected canonical Zoning section IDs: 20018658.

**Reconciliation notes:**

- Align with the reviewed August 13 corpus snapshot; the uploaded July 16 snapshot is retained in intake metadata, not relabeled as current.

## DOBNOW-001 — Alteration without a CO-triggering change

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-001`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The proposed interior renovation does not require the alteration to meet New Building requirements. It is consistent with the current Certificate of Occupancy and does not change occupancy, use, exits, or number of stories.

**Evaluation question:**

How should the five DOB NOW Alteration-routing questions be answered, and what job type results?

**Expected answer:**

Answer **No** to all five stated routing conditions. On the facts supplied, the filing remains an **Alteration** rather than an Alteration-CO.

**Required concepts:**

- Evaluate each routing condition separately.
- Connect the resulting job type only to the stated facts.
- State that inconsistent plans, an inaccurate CO, or another unstated scope change could alter the result.

**Forbidden conclusions:**

- Every interior renovation is an Alteration.
- An amended CO is never required.
- The expediter may make the underlying occupancy, use, or egress determination without the Applicant of Record.

**Authority / evidence to verify:**

- Application User Guide, PDF page 6, Job Types — Alteration and the five routing questions.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-002 — Existing element retained in reconstruction

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-002`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

A reconstruction otherwise resembles a new building, but a portion of the existing foundation will remain in place and become part of the completed building.

**Evaluation question:**

Should the applicant select New Building?

**Expected answer:**

**No.** The guide directs a project retaining an existing building element to **Alteration-CO — New Building with Existing Elements to Remain**, rather than New Building. The corresponding Alteration routing response must reflect that the work is required to meet New Building requirements.

**Required concepts:**

- Treat a retained foundation as an existing building element.
- Distinguish a complete New Building from the DOB NOW “existing elements to remain” route.
- Require the plans and Applicant of Record to confirm the factual premise.

**Forbidden conclusions:**

- A mostly new building is always filed as New Building.
- A retained foundation is irrelevant to job-type selection.

**Authority / evidence to verify:**

- Application User Guide, New Building definition and retained-elements instruction, page 7 of the PDF.
- NYC Administrative Code §28-101.4.5 when the evaluation tests the legal basis for retaining existing building elements.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-003 — Subsequent plumbing filing

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-003`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

An initial GC filing has been created for a project. Plumbing work for the same construction project and property will be filed later, potentially by a different applicant.

**Evaluation question:**

Should the plumbing scope receive a new unrelated job number or a subsequent filing under the existing job?

**Expected answer:**

Create the plumbing scope as a **subsequent PL filing under the existing job number**. It may have a different applicant or review type and requires its own approval and permit processing.

Do not give a universal answer about the creation timing or completion document from the public guidance alone. The release history recognizes a subsequent filing created while the initial filing is in pre-filing but not submitted until the initial is submitted; the current general FAQ says initiation and submission occur after the initial is submitted, while another FAQ entry acknowledges a subsequent filing already in pre-filing before the initial is submitted. Check the live form and current DOB direction. Completion also depends on job type: general guidance describes a separate LOC for subsequent filings, while the NB/Alteration-CO FAQ states that subsequent NB and Alteration-CO filings remain Permit Entire and close through the initial filing's CO process.

**Required concepts:**

- Preserve one job number for related construction work on the same property.
- Distinguish the job number from the filing extension.
- State that each filing still requires separate processing and completion.
- Preserve the public-source conflicts about creation timing and completion path.
- Obtain the initial job type before stating whether the subsequent filing closes through an LOC or the initial filing's CO process.

**Forbidden conclusions:**

- A different trade or applicant always requires a new job number.
- Approval or sign-off of one filing automatically approves or signs off all subsequent filings.
- Every subsequent filing receives a separate Letter of Completion regardless of job type.
- Public DOB guidance supports one universal creation-timing answer without checking the live filing.

**Authority / evidence to verify:**

- DOB NOW FAQ, job number and filing-extension explanation.
- Application User Guide, Initial, Subsequent, and PAA filing definitions, pages 6-7 of the PDF.
- DOB NOW: Build Release Notes, May 2023 Subsequent Filings entries.
- New Building and Alteration-CO FAQs, subsequent-filing LOC treatment.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.
- Replace the compilation answer with the reviewed correction/qualification, including official-source conflicts where documented.

## DOBNOW-004 — PAA for an approved-scope change

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-004`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The initial filing is approved, and the approved scope and drawings must now be revised. The filing was not submitted for legalization.

**Evaluation question:**

What filing action is appropriate, and what limits must be disclosed?

**Expected answer:**

The **Applicant of Record files a Post Approval Amendment**. Only one PAA may be in progress at a time, it must be filed by the same Applicant of Record as the original filing, and a PAA cannot be submitted when the filing includes legalization. Current DOB guidance identifies filing review type, address, Applicant of Record, owner, and building type as locked or requiring another process.

Do not give a deterministic answer about changing **Work on Floors** from the public guidance alone. The current PAA webpage says Work on Floors is not editable, while the current FAQ and DOB release history describe adding or removing floors through a PAA. Check the live PAA and current DOB direction before promising that change.

**Required concepts:**

- Confirm that the original filing is approved.
- Confirm that the requested change is within the PAA route.
- Identify immutable fields before promising that a PAA can accomplish the requested change.
- Disclose the official-source conflict concerning Work on Floors.

**Forbidden conclusions:**

- A filing representative can submit the PAA as the Applicant of Record.
- A PAA can change every field on the original filing.
- A legalization filing can always be amended through a PAA.
- Work on Floors is definitely immutable or definitely editable in every current PAA without checking the live filing.

**Authority / evidence to verify:**

- Post Approval Amendment — DOB NOW: Build, current rules and locked fields.
- DOB NOW: Build FAQ, Post Approval Amendments, Work on Floors response.
- DOB NOW: Build release history concerning adding or removing floors through a PAA.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.
- Replace the compilation answer with the reviewed correction/qualification, including official-source conflicts where documented.

## DOBNOW-005 — Small-business response

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-005`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The filing concerns a business that employs 42 people.

**Evaluation question:**

Should the DOB NOW small-business question be answered Yes?

**Expected answer:**

**Yes**, assuming the filing is related to that business. The DOB guide describes a small business for this question as one employing fewer than 100 people. A Yes response permits the business owner to be added as a stakeholder and opens the Small Business section.

**Required concepts:**

- Apply the fewer-than-100 threshold.
- Confirm the filing is actually related to the identified business.

**Forbidden conclusions:**

- Small-business status automatically waives all filing fees or civil penalties.
- A company with exactly 100 employees satisfies a “fewer than 100” definition.

**Authority / evidence to verify:**

- Application User Guide, PDF page 7, Additional Questions — Small Business.
- DOB NOW: Build Release Notes, September 2022 Small Business entry.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-006 — MPP enrollment boundary

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-006`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The project is large and expensive but has not been accepted into the Major Projects Development Program.

**Evaluation question:**

Should the filing be identified as an approved MPP project?

**Expected answer:**

**No.** Project scale does not establish MPP status. A Yes response requires evidence that the application relates to a project enrolled in the Major Projects Development Program.

**Required concepts:**

- Require actual MPP enrollment evidence.
- Distinguish project complexity from program status.

**Forbidden conclusions:**

- Every large project is an MPP project.
- The Researcher can enroll a project or confer MPP status.

**Authority / evidence to verify:**

- Application User Guide, PDF page 7, Additional Questions — Major Projects Development Program.
- DOB NOW: Build Release Notes, September 2022 MPP entry.
- 1 RCNY §101-17 where the evaluation tests program eligibility or procedure.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-007 — Complete roof replacement

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-007`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

A GC alteration removes and replaces the entire existing roof deck or roof assembly.

**Evaluation question:**

How should the DOB NOW roof question be answered?

**Expected answer:**

Answer **Yes**. The Application User Guide states that this response causes the Local Law 92/94 Sustainable Roof Zone item to populate in Required Documents.

**Required concepts:**

- Distinguish entire roof-deck or roof-assembly replacement from limited repair or recover work.
- Treat the generated document item as a trigger for further compliance review, not proof that the design complies.

**Forbidden conclusions:**

- Any roof repair requires a Yes response.
- Selecting Yes establishes Sustainable Roof Zone compliance.

**Authority / evidence to verify:**

- Application User Guide, PW1 roof question and required-document consequence, page 19 of the PDF.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-008 — More than 50 percent of gross floor area

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-008`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The Applicant of Record's documented calculation shows that the proposed alteration **alters 60 percent of the building's gross floor area**. The building type and Construction Superintendent/site-safety applicability facts are not supplied.

**Evaluation question:**

How should the more-than-50-percent alteration question be answered?

**Expected answer:**

Answer **Yes** to the more-than-50-percent gross-floor-area question, provided the plans and calculation confirm the stated 60 percent. Do not conclude from that response alone that a Site Safety Plan is legally required in every project. Confirm the building type and current Construction Superintendent/site-safety criteria. DOB's 2022 code-change materials state that qualifying one-, two-, and three-family work may not require a Construction Superintendent and that a Site Safety Plan is required only when the job requires a Construction Superintendent.

**Required concepts:**

- Use gross floor area and the area altered by the proposed scope.
- Confirm the calculation and scope boundary rather than relying on a verbal estimate.
- Separate the portal response or generated item from the final legal site-safety obligation.
- Check the building type and current Construction Superintendent/site-safety criteria.

**Forbidden conclusions:**

- The percentage may be based on construction cost.
- A Site Safety Plan is the only possible site-safety obligation.
- Every project answering Yes requires a Site Safety Plan regardless of building type or current exceptions.
- “Affected area,” construction cost, and gross floor area altered are interchangeable measures.

**Authority / evidence to verify:**

- Application User Guide, scope questions and Site Safety Plan trigger, page 23 of the PDF.
- 2022 Construction Code Changes in DOB NOW, Site Safety Highlights, including the one-, two-, and three-family Construction Superintendent exception and Site Safety Plan relationship.
- Current Building Code Chapter 33 and Administrative Code Article 110 criteria for any final project-specific conclusion.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.
- Replace the compilation answer with the reviewed correction/qualification, including official-source conflicts where documented.

## DOBNOW-009 — Excavation exactly 12 feet

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-009`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The maximum excavation depth shown on the plans is exactly 12 feet.

**Evaluation question:**

Does the work require excavation greater than 12 feet?

**Expected answer:**

**No**, because exactly 12 feet is not greater than 12 feet. This answer addresses only this DOB NOW threshold and does not determine every excavation, safety, insurance, or adjacent-property requirement.

**Required concepts:**

- Apply the word “greater” precisely.
- Require confirmation of the maximum depth from the plans.
- Preserve other excavation obligations outside this narrow answer.

**Forbidden conclusions:**

- Twelve feet satisfies a greater-than-12-feet threshold.
- A No response means no excavation controls or insurance requirements can apply.

**Authority / evidence to verify:**

- Application User Guide, excavation-depth question and PGL consequence, pages 22-23 of the PDF.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-010 — Plumbing impact on sprinkler/standpipe supply

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-010`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The plumbing work will interrupt or otherwise affect the water supply serving the building's sprinkler or standpipe system.

**Evaluation question:**

How should the corresponding plumbing question be answered?

**Expected answer:**

Answer **Yes**. The Application User Guide identifies an **FDNY Letter of No Objection** as a required document before approval.

**Required concepts:**

- Confirm an actual impact on the fire-protection water supply.
- State the document timing as prior to approval.

**Forbidden conclusions:**

- Any plumbing work triggers the FDNY document.
- The Researcher can determine FDNY acceptance or issue the letter.

**Authority / evidence to verify:**

- Application User Guide, Plumbing question, page 22 of the PDF.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-011 — Standpipe outage longer than 24 hours

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-011`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The scope requires the standpipe service to be out of service for 36 hours.

**Evaluation question:**

How should the longer-than-24-hours question be answered?

**Expected answer:**

Answer **Yes**. The Application User Guide identifies an **FDNY Letter of No Objection** as a required document before approval.

**Required concepts:**

- Compare the planned outage duration with the stated threshold.
- State that separate fire-safety and impairment procedures may apply outside this field.

**Forbidden conclusions:**

- A DOB NOW response is authorization to impair the standpipe.
- The Letter of No Objection replaces every operational fire-safety requirement.

**Authority / evidence to verify:**

- Application User Guide, Standpipe question, page 22 of the PDF.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-012 — Stormwater disjunctive thresholds

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-012`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The project will disturb 19,000 square feet of soil and create exactly 5,000 square feet of impervious surface. It is an otherwise applicable NB, Alteration-CO, or Alteration-with-enlargement filing.

**Evaluation question:**

Does the stated DOB NOW stormwater condition apply?

**Expected answer:**

**Yes for the DOB NOW field and generated-document trigger.** Although soil disturbance is below 20,000 square feet, creation of 5,000 square feet or more of impervious surface independently satisfies the stated alternative threshold. The guide identifies a DEP Stormwater Construction Permit before approval and a DEP Stormwater Maintenance Permit or Notice of Termination before sign-off.

Do not treat the numerical response alone as a final legal permit determination. Current DEP guidance also requires that the project can drain to a City-owned sewer system and directs users to current Title 15 Chapter 19.1 exclusions and definitions.

**Required concepts:**

- Treat the two thresholds as alternatives joined by “or.”
- Recognize that exactly 5,000 square feet satisfies “5,000 or more.”
- Confirm whether the separate larger-common-plan question also applies.
- Distinguish the DOB NOW field/document trigger from final DEP permit applicability.
- Confirm City-owned-sewer drainage and current exclusions before making the legal permit conclusion.

**Forbidden conclusions:**

- Both thresholds must be met.
- A Yes response proves that DEP has issued the required permit.
- Meeting the numerical DOB NOW threshold alone conclusively establishes legal DEP permit applicability.

**Authority / evidence to verify:**

- Application User Guide, Soil Disturbance questions and consequences, pages 23-24 of the PDF.
- DEP Stormwater Permits, current sewer-drainage condition, numerical thresholds, and Title 15 Chapter 19.1 reference.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.
- Replace the compilation answer with the reviewed correction/qualification, including official-source conflicts where documented.

## DOBNOW-013 — Occupied residential units during construction

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-013`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

At least one residential unit will be occupied during construction at some point before the permit is signed off by DOB.

**Evaluation question:**

How should the occupied-dwelling-unit question be answered, and what follows?

**Expected answer:**

The owner should answer **Yes** to the occupied-dwelling-unit question. The Application User Guide states that a **Tenant Protection Plan is required** when residential units will be occupied at any time before permit sign-off.

**Required concepts:**

- Apply the occupancy condition across the entire period before sign-off, not just the application date.
- Identify this as an owner statement requiring owner review and attestation.

**Forbidden conclusions:**

- Temporary vacancy on the filing date permits a No response when units will later be occupied before sign-off.
- The expediter may attest to the owner's occupancy statement.

**Authority / evidence to verify:**

- Application User Guide, Statements & Signatures, Occupied Dwelling Units, page 38 of the PDF.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-014 — Rent-regulated-unit data conflict

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-014`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The DOB NOW workflow indicates that DHCR data identifies at least one rent-controlled or rent-stabilized unit. The owner believes the building contains none but has not provided supporting documentation.

**Evaluation question:**

May the filing simply answer No to the rent-regulated-housing question?

**Expected answer:**

**Not without resolving the record conflict.** The Application User Guide states that when at least one rent-regulated unit appears in the referenced data, the owner must answer Yes or provide a document confirming zero regulated units and explaining why the DHCR records are inaccurate.

**Required concepts:**

- Surface the conflict rather than selecting the owner's preferred answer.
- Require owner confirmation and supporting evidence.
- Avoid deciding the legal rent-regulated status from DOB NOW data alone.

**Forbidden conclusions:**

- The Researcher can conclusively determine rent regulation from a single dataset.
- The expediter may override DHCR data without documentation.

**Authority / evidence to verify:**

- Application User Guide, Statements & Signatures, Rent Controlled or Rent Stabilized Housing, page 38 of the PDF.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-015 — Condo/co-op board stakeholder

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-015`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The Owner Type is Condo Unit Owner.

**Evaluation question:**

Is the unit owner's attestation sufficient for the filing to proceed?

**Expected answer:**

**No.** Under the February 2026 DOB NOW update, selecting Condo Unit Owner or Co-op Tenant-Shareholder adds the Condo/Co-op Board as a required stakeholder. The owner and the board representative must both complete their Statements & Signatures attestations before the filing can proceed.

**Required concepts:**

- Apply the rule only to the identified owner types.
- Require an NYC.ID login and attestation by the board representative.

**Forbidden conclusions:**

- The unit owner may attest for the board.
- Every condominium filing requires every unit owner to attest.

**Authority / evidence to verify:**

- DOB NOW: Build Release Notes, February 2026, Condo/Co-op Board stakeholder update.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-016 — Loft Law flag and affected IMD unit

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-016`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The DOB NOW Property Profile contains a Loft Law flag, and the proposed work will occur in or affect an Interim Multiple Dwelling unit.

**Evaluation question:**

How should the IMD-impact question be answered, and what approval boundary follows?

**Expected answer:**

Answer **Yes** because the work will take place in or affect an Interim Multiple Dwelling unit. After the job filing is submitted, add a Loft Board request and file for **Loft Board Certification**, including the required **Narrative Statement**. The DOB job filing cannot be approved until the Loft Board Certification has been issued. A Loft Board Letter of No Objection is the distinct route for a No response involving work in a commercial unit that does not affect an IMD unit; it is not the clearance for this scenario.

**Required concepts:**

- Require both the property flag and scope relationship stated in the scenario.
- Distinguish submitting the request from obtaining the Certification.
- Map the Yes and No responses to their distinct Loft Board submission types.
- Include the Narrative Statement in the Yes/Certification path.

**Forbidden conclusions:**

- A Loft Law flag alone proves that every proposed scope affects an IMD unit.
- Submission of a request is equivalent to Loft Board clearance.
- A Yes response may be cleared by either an LNO or Certification at the applicant's choice.

**Authority / evidence to verify:**

- Loft Board Requests service notice, effective February 2, 2026.
- DOB NOW: Build Release Notes, February 2026, Loft Board Requests.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.
- Replace the compilation answer with the reviewed correction/qualification, including official-source conflicts where documented.

## DOBNOW-017 — Basement ADU radon/vapor document

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-017`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

An applicable NB or Alteration-CO GC filing for a newly erected single-family residence includes an Ancillary Dwelling Unit in the basement.

**Evaluation question:**

Which DOB NOW responses and document requirement follow?

**Expected answer:**

Answer **Yes** to the ADU question and select **Basement** as the location. Under the August 2026 release, a DOHMH Radon and Vapor Level Certificate is required before Final CO. The release notes state that it may be uploaded before TCO, a waiver request is allowed, and deferral is not allowed.

**Required concepts:**

- Preserve all scenario qualifiers: applicable job type, GC/PW1, newly erected single-family residence, ADU, and basement or cellar location.
- Distinguish optional timing before TCO from required timing before Final CO.
- Distinguish waiver from deferral.

**Forbidden conclusions:**

- Every ADU in every location triggers the same certificate.
- The certificate is required before filing based solely on the cited release note.
- A deferral is permitted.

**Authority / evidence to verify:**

- DOB NOW: Build Release Notes, August 2026, DOHMH Radon and Vapor Level Certificate for ADUs.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-018 — Wetland-area required documents

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-018`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

An initial NB-GC filing is on a property flagged in DOB NOW as potentially affected by Tidal Wetlands, Freshwater Wetlands, or a Coastal Erosion Hazard Area.

**Evaluation question:**

What documents and conditional responses are required under the August 2026 workflow?

**Expected answer:**

For each applicable Yes property flag, the filing must include a **DEC Jurisdictional Determination**, and DOB NOW adds the corresponding DEC Permit document item. If the determination says a DEC Permit is required, submit it before approval. If the determination says a permit is not required, submit a waiver request for the corresponding DEC Permit item.

**Required concepts:**

- Confirm that the job and work types fall within the release-note criteria.
- Treat the property flag as a trigger for agency determination, not as proof that DEC has jurisdiction or that a permit is required.
- Preserve the difference between the determination and the permit.
- Use DEC Permit. Treat the service notice's isolated DEP Permit reference as an apparent typo because the operative table and release notes identify DEC.

**Forbidden conclusions:**

- Every flagged property necessarily requires a DEC Permit.
- The DOB NOW flag is itself a DEC jurisdictional determination.
- The document requirement may simply be ignored when DEC says no permit is required.

**Authority / evidence to verify:**

- DOB NOW: Build Release Notes, August 2026, Required Documents for DOB NOW Job Filings in Wetland Areas.
- DOB Service Updates, effective August 17, 2026.
- Wetland-area Required Documents service notice, including the operative document table.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.
- Replace the compilation answer with the reviewed correction/qualification, including official-source conflicts where documented.

## DOBNOW-019 — New Builders Pavement Plan filing

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-019`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

A new Builders Pavement Plan application is initiated after August 17, 2026.

**Evaluation question:**

Where must it be filed, which review type applies, and what authorization step appears?

**Expected answer:**

File it in **DOB NOW: Build** using the **Builders Pavement Plan** work type and **Standard Plan Review**. The BPP5 Authorization to DOT tab must be completed so DOT can issue its construction permit for the BPP work.

**Required concepts:**

- Apply the current effective date.
- State that new BPP filings are no longer initiated in BIS.
- Distinguish DOB's BPP processing from DOT's construction permit.

**Forbidden conclusions:**

- Professional Certification is an available BPP review type under the cited release.
- Completing BPP5 means DOT has issued its construction permit.

**Authority / evidence to verify:**

- DOB NOW: Build Release Notes, August 2026, Builders Pavement Plan filings.
- DOB Service Updates, effective August 17, 2026.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-020 — LPC-calendared property

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-020`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The DOB NOW Property Profile identifies the property as LPC-calendared. The proposed filing is an otherwise applicable Alteration initial filing.

**Evaluation question:**

Can the Researcher promise immediate DOB approval without LPC processing?

**Expected answer:**

**No.** The August 2026 release notes state that LPC-calendared properties receive an automatic 40-day hold before approval. The applicable LPC Approval/Permit document is required before approval and/or permit depending on when the property was marked calendared. The Researcher must determine the filing review type, filing sequence, scope, exemptions, and timing before stating the exact document deadline.

**Required concepts:**

- Distinguish calendared, designated landmark, and historic-district facts.
- Preserve the 40-day hold and conditional document timing.
- Check exemptions and the live Property Profile.

**Forbidden conclusions:**

- Calendared status and designated-landmark status are interchangeable for every purpose.
- Every filing has identical LPC document timing.
- The Researcher can waive the hold or issue LPC approval.

**Authority / evidence to verify:**

- DOB NOW: Build Release Notes, August 2026, Updated Landmarks Requirements.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-021 — Insufficient facts for code review year

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-021`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The user provides only the property address and asks which Building Code review year to select in DOB NOW.

**Evaluation question:**

What is the right Researcher answer?

**Expected answer:**

**Insufficient information. Do not select a code year.** Request at least the job type, work type, filing and application dates, existing-building and prior-code facts, proposed scope, related or prior filings, and the Applicant of Record's claimed legal basis. The portal options alone do not establish which code may lawfully govern the project.

**Required concepts:**

- Separate the existence of a dropdown option from eligibility to use it.
- Identify the missing facts needed for a supported determination.
- Require applicable current law and transition provisions, not only the user guide.

**Forbidden conclusions:**

- The property address determines the code review year.
- The oldest building date automatically selects the oldest code.
- The current portal's default selection is necessarily the legally correct one.

**Authority / evidence to verify:**

- Application User Guide, code-review-year field, page 19 of the PDF.
- Applicable enacted code and transition provisions selected by the reviewer.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-022 — Insufficient facts for Professional Certification

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-022`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The user provides a brief work description but no property restrictions, filing type, complete scope, agency approvals, or Applicant of Record certification basis.

**Evaluation question:**

May the Researcher recommend Professional Certification rather than Standard Plan Examination?

**Expected answer:**

**Insufficient information.** The Researcher may explain the two review routes but must not recommend Professional Certification until the job and work types, scope, property restrictions, applicable exclusions, agency approvals, and Applicant of Record's willingness and legal basis to certify full compliance are established.

**Required concepts:**

- State that Professional Certification relies on an RDP's certification of compliance and remains subject to DOB audit.
- Identify project-specific eligibility facts as missing.
- Keep the ultimate certification with the Applicant of Record.
- Confirm owner consent and the current restriction on changing the selected review route.

**Forbidden conclusions:**

- Professional Certification is simply the faster option for any filing.
- An expediter or the Researcher can make the professional certification.
- Professional Certification prevents DOB audit.

**Authority / evidence to verify:**

- Application User Guide, Filing Review Type, page 13 of the PDF.
- Current DOB exclusions and restrictions applicable to the proposed filing.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-023 — Filing representative attestation boundary

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-023`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

A filing representative has completed data entry and uploaded the documents. The applicant and owner have not yet completed their attestations.

**Evaluation question:**

Can the filing representative attest for them and submit the job filing?

**Expected answer:**

**No.** A filing representative may perform permitted preparation, data-entry, and upload functions but cannot replace the required electronic attestations of the Applicant of Record and owner. The applicant must review, sign, and submit the filing through the required DOB NOW steps; current releases may add other required stakeholder attestations.

**Required concepts:**

- Distinguish preparation access from legal attestation authority.
- Identify the Applicant of Record and owner attestations.
- Check whether another required stakeholder, such as a condo/co-op board representative, must also attest.

**Forbidden conclusions:**

- Association with the filing authorizes a person to attest for another stakeholder.
- An expediter's review substitutes for the owner or RDP statement.

**Authority / evidence to verify:**

- Filing through DOB NOW: Build, attestation, preview, and submission steps.
- Application User Guide, Statements & Signatures, page 38 of the PDF.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

## DOBNOW-024 — Letter of Completion readiness

Source basis: Official DOB workflow review snapshot 2026-08-22; refresh before live filing guidance.

Source case: `dobnow-024`; recorded status: approved-for-answer-key-testing-only; reviewed: 2026-08-22. Scope: Terra answer-key testing only

**Authored context supplied to Research:**

DOB NOW workflow

**Scenario supplied to Research:**

The filing does not require an initial or amended Certificate of Occupancy. Its status is Permit Entire; final PW3 costs are verified; all required documents are submitted; applicable final technical reports are certified; all permits are inspected and Signed-Off; and all AHV permits are approved.

**Evaluation question:**

Is the filing ready for an LOC request under the guide's listed prerequisites?

**Expected answer:**

**Yes, based on the supplied facts.** The owner or Applicant of Record may request the Letter of Completion from the filing action. The answer must remain conditional on the live filing actually showing every prerequisite and no newer restriction or unresolved item.

**Required concepts:**

- Confirm each listed prerequisite independently.
- Distinguish readiness to request from DOB issuance of the LOC.
- Confirm that a Certificate of Occupancy is not required.

**Forbidden conclusions:**

- Meeting the checklist means DOB has already issued the LOC.
- Sign-off of one permit automatically satisfies all permit and filing requirements.
- A filing requiring an initial or amended CO can use an LOC as a substitute.

**Authority / evidence to verify:**

- Application User Guide, Letter of Completion prerequisites, page 37 of the PDF.

**Reconciliation notes:**

- Restore the original scenario and use the corrected, owner-reviewed answer and rubric; retain the limited testing approval.

# Permitext AI Evaluation — Draft Case Review Packet

**Development-only document — contains private answer keys and must not be served to Permitext customers.**

Generated from `evals/research-cases.json` on 2026-07-25T10:53:29.411Z.

This packet contains 12 draft cases. Reviewing this document does not alter the evaluation dataset or approve a case automatically.

For each case, confirm that the exact enacted passages are correct, the proposed conclusion follows from those passages, the required concepts and citations are complete, and the missing-fact and forbidden-claim rules are appropriate. Select one decision and write any corrections. A case remains a draft until the decision is deliberately entered into Permitext's owner review system.

## Reviewer summary

| Case | Decision | Initials |
| --- | --- | --- |
| nyc-001-mixed-occupancy-fixture-rounding | Approve / Correct / Reject |  |
| nyc-002-stated-occupancy-movable-seats | Approve / Correct / Reject |  |
| nyc-011-legacy-fire-alarm-enlargement | Approve / Correct / Reject |  |
| nyc-013-b-m-co-accessibility-boundary | Approve / Correct / Reject |  |
| nyc-015-sidewalk-cafe-evidence-boundary | Approve / Correct / Reject |  |
| nyc-016-enclosed-garage-intermittent-ventilation | Approve / Correct / Reject |  |
| nyc-017-prior-code-floor-surface-area-110-percent | Approve / Correct / Reject |  |
| nyc-018-fire-district-map-boundary | Approve / Correct / Reject |  |
| nyc-019-buildings-bulletin-policy-boundary | Approve / Correct / Reject |  |
| nyc-020-existing-plumbing-repair-boundary | Approve / Correct / Reject |  |
| nyc-021-prior-code-wind-surface-area-trigger | Approve / Correct / Reject |  |
| nyc-022-reestablished-prior-occupancy-boundary | Approve / Correct / Reject |  |

---

## 1. Fractional plumbing-fixture aggregation in a mixed-use residential cellar

- **Case ID:** `nyc-001-mixed-occupancy-fixture-rounding`
- **Current status:** draft
- **Jurisdiction:** New York City, New York
- **Code edition:** 2022 New York City Construction Codes
- **Difficulty:** advanced
- **Topics:** plumbing fixtures, mixed occupancies, accessory assembly, fractional calculations, evidence limits

### Scenario source

Scenario adapted and anonymized from the Archinect thread “NYC Architects- Plumbing fixtures code question,” June 24, 2024: https://archinect.com/forum/thread/150433902/nyc-architects-plumbing-fixtures-code-question. Forum replies are not part of the answer key.

The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.

### Project context

buildingUse: Residential building with cellar support and amenity spaces; cellarUses: Group B, Group F, Group S, Multipurpose assembly room with fewer than 75 occupants; unknowns: actual function and classification of each room, occupant loads, whether the multipurpose room is accessory, applicable Assembly category, whether occupants may share the same facilities, existing fixture availability

### Question

A residential-building cellar contains Group B, F, and S spaces plus a multipurpose assembly room with fewer than 75 occupants that may qualify as accessory to the residential occupancy. After the correct Table 403.1 ratio has been applied separately to each occupancy, may the resulting fractional fixture requirements be added before rounding, and may the accessory multipurpose room use Assembly fixture requirements?

### Exact selected Permitext evidence

#### BC 303.1.3

Canonical section ID: `132`

Passage 1:

> A room or space used for assembly purposes with an occupant load of fewer than 75 persons and accessory to another occupancy shall be classified as a Group B occupancy or as part of that occupancy, except that the number of plumbing fixtures for such a room or space is permitted to be calculated in accordance with the requirements for assembly occupancies.

#### PC 403.1

Canonical section ID: `11909`

Passage 1:

> Plumbing fixtures shall be provided for the type of occupancy and in the minimum number shown in Table 403.1 . Types of occupancies not shown in Table 403.1 shall be considered individually by the commissioner. The number of occupants shall be determined by the New York City Building Code . Occupancy classification shall be determined in accordance with the New York City Building Code .

Passage 2:

> The number of fixtures for building or nonaccessory tenant space used for assembly purposes by fewer than 75 persons and classified as Group B occupancy in accordance with Section 303.1, Exception 2 of the New York City Building Code shall be permitted to be calculated in accordance with the requirements for Assembly occupancies.

#### PC 403.1.1

Canonical section ID: `11910`

Passage 1:

> To determine the occupant load of each sex, the total occupant load shall be divided in half. To determine the required number of fixtures, the fixture ratio or ratios for each fixture type shall be applied to the occupant load of each sex in accordance with Table 403.1 . Fractional numbers resulting from applying the fixture ratios of Table 403.1 shall be rounded up to the next whole number. For calculations involving multiple occupancies, such fractional numbers for each occupancy shall first be summed and then rounded up to the next whole number. Fixture calculations in Group B office occupancies shall utilize the total occupant load on a given floor to determine the number of fixtures required for that floor.

Passage 2:

> Exception: The total occupant load shall not be required to be divided in half where approved statistical data indicates a distribution of the sexes of other than 50 percent of each sex.

### Proposed expected conclusion

PC 403.1.1 permits the occupancy-specific fractional requirements for multiple occupancies to be summed before rounding up. The calculation must preserve the applicable fixture type, sex allocation, and occupancy-specific Table 403.1 ratio; it does not permit all uses to be collapsed into one occupancy calculation. BC 303.1.3 directly permits a qualifying accessory assembly room with fewer than 75 occupants to use Assembly fixture requirements. The selected PC 403.1 footnote addresses a different condition—building or nonaccessory tenant assembly space—and must not be used as independent authority for the accessory room. A final fixture count cannot be established without the missing project facts, and the selected evidence does not establish whether all occupants may share the proposed toilet rooms.

### Expected uncertainty

level: conditional; description: The selected evidence establishes the calculation method and a conditional accessory-room permission, but it does not support a final count or shared-facility conclusion.

### Required citations and the claim each must support

- **BC 303.1.3:** Direct authority for using Assembly fixture requirements for a qualifying accessory assembly room.
- **PC 403.1:** General Table 403.1 framework, Building Code control of classification and occupant load, and the selected footnote's limited nonaccessory scope.
- **PC 403.1.1:** Sex allocation, occupancy-specific fixture ratios, summing fractional results for multiple occupancies, and final rounding.

### Required concepts

- Sum occupancy-specific fractional fixture requirements before final rounding.
- Preserve separate calculations by fixture type and applicable sex allocation.
- Do not replace the individual occupancy ratios with one combined occupancy ratio.
- Attribute the accessory-room permission directly to BC 303.1.3.
- Limit the selected PC 403.1 footnote to building or nonaccessory tenant space.
- Use Building Code occupant loads and classifications before applying Table 403.1.
- State that the selected evidence does not establish whether shared facilities are permitted.
- Avoid giving a final fixture count without the necessary inputs.

### Facts the answer must identify as missing

- Actual function and occupancy classification of each cellar room.
- Occupant load for each space.
- Whether the multipurpose room is genuinely accessory and has fewer than 75 occupants.
- Applicable Assembly category and Table 403.1 ratio.
- Whether the same facilities may legally and practically serve all occupants.
- Existing fixture availability and location.
- Whether approved statistical data supports a non-50/50 sex distribution.
- Filing and Certificate of Occupancy implications.

### Claims the answer must not make

- Each occupancy fraction must be rounded separately before the results are added.
- All occupant loads may be combined and evaluated using one occupancy's fixture ratio.
- The selected PC 403.1 footnote independently applies its nonaccessory rule to the accessory room.
- Group B classification automatically requires the Group B fixture ratio for the accessory assembly room.
- Residential dwelling-unit fixtures automatically satisfy the cellar-space requirement.
- The proposed shared toilet rooms are permitted solely because fractions may be aggregated.
- A final fixture count can be given without confirmed classifications, loads, ratios, and sharing conditions.

### Existing drafting note

Draft candidate NYC-001 and deliberate variation of accessory-assembly-plumbing-fixtures. Its distinct promotion rationale is the multiple-occupancy fraction-and-rounding rule; reviewers should avoid double-weighting the shared accessory-assembly rubric. Exact passages were copied from Permitext canonical content, but the scenario, expected conclusion, concepts, forbidden claims, and uncertainty rules still require knowledgeable human review.

### Reviewer decision

- [ ] Approve as written
- [ ] Approve after the corrections written below
- [ ] Reject

**Reviewer name:** ________________________________________________

**Review date:** ___________________________________________________

**Corrections or notes:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

---

## 2. Movable seating and a proposed lower stated occupant load

- **Case ID:** `nyc-002-stated-occupancy-movable-seats`
- **Current status:** draft
- **Jurisdiction:** New York City, New York
- **Code edition:** 2022 New York City Construction Codes
- **Difficulty:** advanced
- **Topics:** occupant load, multiple functions, movable seating, commissioner approval, missing project facts

### Scenario source

Scenario adapted and anonymized from the Reddit r/Architects thread “NYC - is stated occupancy a thing?”, April 8, 2025: https://www.reddit.com/r/Architects/comments/1jueo7n/nyc_is_stated_occupancy_a_thing/. Replies are not part of the answer key.

The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.

### Project context

floorAreaSquareFeet: 8000; existingDocumentation: Group B floor documented at 1 occupant per 100 square feet; proposedFunctions: conference rooms, soft seating, coffee-break and lounge areas; seating: Movable, not fixed; reportedCalculatedLoad: More than 200 occupants overall, with no individual room at 75 or more; proposedReduction: Count selected seats and treat some functions as nonsimultaneous; unknowns: room-by-room net and gross areas, actual functions and furniture layouts, simultaneous-use conditions, commissioner-approved lower basis, egress capacity, filing and posted-occupancy requirements

### Question

For this 2022-code evaluation scenario, may the conference floor's occupant load be documented by counting selected movable seats, omitting lounge and break functions as nonsimultaneous, and retaining the existing 1:100 load without a commissioner-established lower basis?

### Exact selected Permitext evidence

#### BC 1004.1.2

Canonical section ID: `2151`

Passage 1:

> Where an area under consideration contains multiple functions having different occupant load factors, the design occupant load for such area shall be based on the floor area of each function calculated independently.

#### BC 1004.1.3

Canonical section ID: `2152`

Passage 1:

> For areas without fixed seating, the occupant load shall be not less than that number determined by dividing the floor area under consideration by the occupant load factor assigned to the function of the space as set forth in Table 1004.1.3.

#### BC 1004.1.3.1

Canonical section ID: `2153`

Passage 1:

> Where the actual number of occupants of any space will be significantly lower than listed in Table 1004.1.3 , the commissioner may establish a lower basis for the determination of the number of occupants.

#### BC 1004.3

Canonical section ID: `2156`

Passage 1:

> For areas having fixed seats and aisles, the occupant load shall be determined by the number of fixed seats installed therein. The occupant load for areas in which fixed seating is not installed, such as waiting spaces, shall be determined in accordance with Section 1004.1.3 and added to the number of fixed seats.

### Proposed expected conclusion

No. BC 1004.3 uses the number of installed seats for fixed seating, while areas without fixed seating must be determined under BC 1004.1.3. BC 1004.1.2 requires the floor area of each function with a different occupant-load factor to be calculated independently. A lower actual-occupancy basis is not automatic: BC 1004.1.3.1 states that the commissioner may establish it when actual occupancy will be significantly lower. The selected evidence does not establish that the lounge and break areas may be omitted as nonsimultaneous, nor does it resolve filing type, place-of-assembly status, posted occupancy, or egress capacity. Those conclusions require the actual plans, functions, use assumptions, existing records, and applicable official authority.

### Expected uncertainty

level: conditional; description: The selected passages reject automatic movable-seat counting and require independent functional calculations, but a final occupant load and any approved lower basis depend on missing plans, facts, and commissioner action.

### Required citations and the claim each must support

- **BC 1004.1.2:** Independent floor-area calculations for multiple functions having different occupant-load factors.
- **BC 1004.1.3:** Minimum area-and-function occupant-load calculation for areas without fixed seating.
- **BC 1004.1.3.1:** Commissioner authority to establish a lower basis when actual occupancy will be significantly lower.
- **BC 1004.3:** Fixed-seat counting applies to installed fixed seats; areas without fixed seating remain subject to BC 1004.1.3.

### Required concepts

- Distinguish fixed seating from movable seating.
- State that movable-seat areas remain subject to the area-and-function method in BC 1004.1.3.
- Calculate different functions independently under BC 1004.1.2.
- State that a lower actual-occupancy basis must be established by the commissioner under the selected passage.
- State that the selected evidence does not establish a nonsimultaneous-use exception.
- Request the room areas, functions, furniture layouts, simultaneous-use conditions, existing records, and official approval before providing a final load.
- Keep filing type, PACO, posted occupancy, and egress conclusions outside the selected evidence.

### Facts the answer must identify as missing

- Room-by-room net and gross floor areas.
- Actual function and furniture layout of each room and open area.
- Whether uses can occur simultaneously.
- Existing Certificate of Occupancy and approved occupant loads.
- Whether the commissioner has established a lower basis.
- Exit number, capacity, widths, travel distance, and common path.
- Applicable PACO, posted-occupancy, and filing authority.

### Claims the answer must not make

- Movable seats may be counted as fixed seats under BC 1004.3.
- The existing 1:100 documentation automatically controls the altered conference-floor occupant load.
- Lounge and break areas may automatically be omitted as nonsimultaneous.
- The design team may establish a lower basis without commissioner action.
- Professional certification makes an unsupported occupant-load method compliant.
- The selected evidence resolves the filing type, PACO requirement, posted occupancy, or egress compliance.

### Existing drafting note

Draft candidate NYC-002. The source project had not selected a governing code edition; this case is deliberately framed as a 2022-code evaluation variation and does not claim that the source project elected the 2022 Code.

### Reviewer decision

- [ ] Approve as written
- [ ] Approve after the corrections written below
- [ ] Reject

**Reviewer name:** ________________________________________________

**Review date:** ___________________________________________________

**Corrections or notes:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

---

## 3. Legacy fire-alarm system scope after a Group B enlargement

- **Case ID:** `nyc-011-legacy-fire-alarm-enlargement`
- **Current status:** draft
- **Jurisdiction:** New York City, New York
- **Code edition:** 2022 New York City Construction Codes
- **Difficulty:** advanced
- **Topics:** fire alarm, existing systems, building enlargement, occupancy changes, large-area Group B

### Scenario source

Scenario derived from NYC Department of Buildings Bulletin 2024-001, February 9, 2024: https://www.nyc.gov/assets/buildings/bldgs_bulletins/bb_2024-001.pdf. The bulletin is scenario provenance and is not silently included in the selected production evidence.

The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.

### Project context

occupancy: Group B; existingSystem: Previously approved legacy fire-alarm system; project: Building enlargement with no stated use or occupancy change; resultingArea: May exceed 100,000 gross square feet; unknowns: highest occupied-floor height above Fire Department vehicle access, exact enlargement and system-modification scope, whether any occupancy classification or usage changes, existing-system capacity and compatibility, other Chapter 9 triggers

### Question

An existing prior-code Group B building has a previously approved legacy fire-alarm system. A proposed enlargement does not change the stated use or occupancy, but the resulting Group B gross area may exceed 100,000 square feet. The height of the highest occupied floor above the lowest level of Fire Department vehicle access has not been confirmed. Does the selected 2022 Building Code evidence automatically require replacement of the entire legacy system, and what additional facts determine the required scope?

### Exact selected Permitext evidence

#### BC 901.9.1

Canonical section ID: `1550`

Passage 1:

> Additions, alterations, renovations or repairs to existing systems shall conform to that required for new systems without requiring the existing system to comply with all of the requirements of this code, except as otherwise required in Sections 901.9.2 through 901.9.6. Additions, alterations or repairs shall not cause an existing installation to become unsafe, hazardous or overloaded.

#### BC 901.9.2

Canonical section ID: `1552`

Passage 1:

> Fire protection systems governed by this chapter shall be provided:

Passage 2:

> 1. To the entire building as if the building were hereafter erected, where a change is made in the main use or dominant occupancy of such building.

Passage 3:

> 2. Throughout a space, where a change is made in the occupancy group classification or usage of the space.

#### BC 901.9.3

Canonical section ID: `1553`

Passage 1:

> Fire protection systems shall be provided in enlarged portions of a building and where this chapter would require such systems in new construction for a space or building.

#### BC 907.2.2.2

Canonical section ID: `1755`

Passage 1:

> Group B occupancies having a total gross area exceeding 100,000 square feet (9290.3 m 2 ) located in buildings where the highest occupied floor is 75 feet (22 860 mm) or less above the lowest level of Fire Department vehicle access shall be provided with automatic smoke detection connected to an automatic fire alarm system in accordance with Section 907.2.13.1 and an emergency voice/alarm communication system in accordance with Section 907.5.2.2 that initiates a total evacuation signal.

### Proposed expected conclusion

The enlargement does not, by itself, prove that the entire legacy system must be replaced. BC 901.9.1 requires additions and alterations to existing systems to comply with new-system requirements without automatically requiring the entire existing system to comply, subject to the additional triggers in Sections 901.9.2 through 901.9.6. BC 901.9.3 requires fire-protection systems in enlarged portions and where Chapter 9 would require them for new construction. If the resulting Group B occupancy exceeds 100,000 square feet and the highest occupied floor is 75 feet or less above the lowest Fire Department vehicle-access level, BC 907.2.2.2 requires the identified smoke-detection, fire-alarm, and emergency voice/alarm systems for the qualifying Group B occupancy; that requirement cannot automatically be limited to only the enlarged portion. On the stated facts, BC 901.9.2 is not triggered unless the asserted absence of an occupancy or use change is incorrect. A main-use or dominant-occupancy change applies to the entire building; a space occupancy-classification or usage change applies throughout that space. The selected evidence does not determine whether the legacy equipment can be extended, interfaced, or retained, or whether technical conditions ultimately require modification or replacement. Applicable Buildings Bulletin 2024-001 conditions and project-specific DOB and FDNY review remain necessary outside the selected evidence.

### Expected uncertainty

level: conditional; description: The selected passages establish upgrade triggers and scope principles, but they cannot establish whether the existing system may be retained or must be replaced without project-specific system, occupancy, area, height, and compatibility facts.

### Required citations and the claim each must support

- **BC 901.9.1:** New-work requirements for additions or alterations to existing systems and the rule against automatic whole-system compliance.
- **BC 901.9.2:** Entire-building versus space-level consequences of occupancy or usage changes.
- **BC 901.9.3:** Fire-protection requirements for enlarged portions and new-construction triggers.
- **BC 907.2.2.2:** Group B large-area and height conditions and the resulting required systems.

### Required concepts

- Reject automatic full-system replacement based solely on enlargement.
- Explain BC 901.9.1's new-work rule and its protection against automatic whole-system compliance.
- Explain the enlarged-portion and new-construction trigger in BC 901.9.3.
- Distinguish whole-building main or dominant-occupancy changes from space-level classification or usage changes.
- Apply both BC 907.2.2.2 conditions: gross area over 100,000 square feet and the stated height relationship.
- Identify the systems expressly required by BC 907.2.2.2 when both conditions apply.
- Do not automatically limit the BC 907.2.2.2 system requirement to only the enlarged portion when both conditions apply to the qualifying Group B occupancy.
- State that technical compatibility, retention, interface, and replacement cannot be resolved from the selected passages.
- Request the missing project and existing-system information.

### Facts the answer must identify as missing

- Resulting total gross Group B area.
- Highest occupied-floor height relative to Fire Department vehicle access.
- Confirmation that neither main or dominant occupancy nor space classification or usage changes.
- Exact enlargement and existing-system modification scope.
- Existing-system approval records, listing, condition, capacity, available parts, and sequence of operation.
- Compatibility of new and existing equipment.
- Whether other Chapter 9 triggers apply.
- Applicable Buildings Bulletin 2024-001 conditions and project-specific DOB and FDNY review.
- Applicable electrical, emergency-power, testing, monitoring, and FDNY requirements.

### Claims the answer must not make

- Every enlargement requires replacement of the entire fire-alarm system.
- A previously approved legacy system may automatically remain unchanged.
- Exceeding 100,000 square feet alone triggers BC 907.2.2.2 without confirming the height condition.
- When both BC 907.2.2.2 conditions apply to the qualifying Group B occupancy, its required systems may automatically be limited to only the enlarged portion.
- Any occupancy change anywhere requires whole-building compliance.
- BC 901.9.2 concerns only occupancy-group labels and not changes in space usage.
- The selected evidence proves that the old and new systems can be interfaced.
- The DOB bulletin constitutes project-specific approval.
- The selected passages resolve FDNY acceptance, electrical compliance, system listing, or sequence-of-operation requirements.

### Existing drafting note

Draft candidate NYC-011. Exact enacted passages were copied from Permitext canonical content. The project scenario and answer rubric require knowledgeable fire-alarm and NYC code review before approval.

### Reviewer decision

- [ ] Approve as written
- [ ] Approve after the corrections written below
- [ ] Reject

**Reviewer name:** ________________________________________________

**Review date:** ___________________________________________________

**Corrections or notes:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

---

## 4. B-to-M or M-to-B alteration after zoning Use Group renumbering

- **Case ID:** `nyc-013-b-m-co-accessibility-boundary`
- **Current status:** draft
- **Jurisdiction:** New York City, New York
- **Code edition:** 2022 New York City Construction Codes
- **Difficulty:** advanced
- **Topics:** accessibility, Certificate of Occupancy, occupancy classification, zoning use groups, evidence limits

### Scenario source

Scenario derived from NYC Department of Buildings Bulletin 2025-002, April 1, 2025: https://www.nyc.gov/assets/buildings/bldgs_bulletins/bb_2025-002.pdf. The bulletin and unselected Administrative Code and Zoning Resolution material are not part of the production evidence.

The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.

### Project context

building: Prior-code building asserted but not confirmed; project: Small existing establishment changing between Group B and Group M; zoningContext: Proposed after the 2024 zoning Use Group renumbering; unknowns: existing Certificate of Occupancy wording, former and current zoning uses, actual Building Code classifications, whether the work is an alteration or ordinary repair, applicable Administrative Code exception and official guidance

### Question

A small existing establishment proposes an alteration described as a change between Group B and Group M after the 2024 zoning Use Group renumbering. Based only on the selected Building Code passages, can we conclude that the work qualifies for an exception to amending the Certificate of Occupancy, and what accessibility consequence can be stated?

### Exact selected Permitext evidence

#### BC 1101.3

Canonical section ID: `2625`

Passage 1:

> The provisions of this chapter shall apply to alterations, including minor alterations but excluding ordinary repairs, and changes of use or occupancy to prior code buildings, portions of such buildings, and spaces within such buildings in accordance with Sections 1101.3.1 through 1101.3.5.

#### BC 1101.3.1

Canonical section ID: `2626`

Passage 1:

> Accessible features and construction governed by this chapter shall be provided:

Passage 2:

> 2. Throughout a space, including the immediate entrance(s) thereto, where an alteration is made that is considered either: (i) a change in occupancy classification of such space in accordance with this code, or (ii) a change in the zoning use group of such space in accordance with the New York City Zoning Resolution.

### Proposed expected conclusion

No Certificate of Occupancy exception can be established from the selected evidence. BC 1101.3 addresses accessibility in alterations and changes of use or occupancy in prior-code buildings; it is not the authority for a Certificate of Occupancy amendment exception. If the project is an alteration in a prior-code building and is considered a change in the space's Building Code occupancy classification or zoning use group, BC 1101.3.1 conditionally requires the Chapter 11 accessible features and construction throughout the space, including its immediate entrances. The existing Certificate of Occupancy, the actual former and current zoning uses under the applicable transition rule, the Building Code classifications, and the governing Administrative Code and official agency material must be reviewed before deciding either the Certificate of Occupancy issue or whether this accessibility trigger applies.

### Expected uncertainty

level: outside selected authority; description: The selected evidence supports only a conditional Building Code accessibility conclusion. It cannot resolve the Certificate of Occupancy exception or the zoning transition without additional enacted and official authority.

### Required citations and the claim each must support

- **BC 1101.3:** Prior-code-building accessibility applicability context for alterations and changes of use or occupancy; it does not support a Certificate of Occupancy exception.
- **BC 1101.3.1:** Conditional accessibility trigger throughout the space and immediate entrances when the alteration is considered a qualifying occupancy-classification or zoning-use-group change.

### Required concepts

- Distinguish the selected accessibility provisions from the unselected Certificate of Occupancy exception authority.
- State that BC 1101.3 applies in the selected text to prior-code buildings and excludes ordinary repairs.
- Make BC 1101.3.1's accessibility result conditional on an alteration considered a change in occupancy classification or zoning use group.
- Identify the selected consequence as accessibility throughout the space, including immediate entrances.
- State that old and new zoning labels alone do not establish eligibility for the Certificate of Occupancy exception.
- Request the unselected Administrative Code, current Zoning Resolution transition material, official interpretation, and actual Certificate of Occupancy rather than inventing their content.

### Facts the answer must identify as missing

- Whether the building is a prior-code building.
- Exact existing Certificate of Occupancy wording and former zoning Use Group.
- Current zoning use and applicable transition rule.
- Existing and proposed Building Code occupancy classifications.
- Whether the work is an alteration rather than an ordinary repair.
- Exact accessibility scope and conditions.
- Applicable enacted Administrative Code provision and current official agency guidance.

### Claims the answer must not make

- BC 1101.3 or BC 1101.3.1 grants an exception from amending the Certificate of Occupancy.
- Every small B-to-M or M-to-B alteration automatically qualifies for the exception.
- Renumbering from an old numeric Use Group to a new Roman-numeral group by itself proves that no relevant use change occurred.
- Avoiding an amended Certificate of Occupancy eliminates accessibility obligations.
- The selected evidence establishes compliance with Administrative Code Section 28-118.3 or the current Zoning Resolution.
- The selected evidence proves that the entire project is approved or compliant.

### Existing drafting note

Draft candidate NYC-013. Exact Building Code passages were copied from Permitext canonical content. The Certificate of Occupancy and zoning parts deliberately test recognition that the selected evidence is insufficient.

### Reviewer decision

- [ ] Approve as written
- [ ] Approve after the corrections written below
- [ ] Reject

**Reviewer name:** ________________________________________________

**Review date:** ___________________________________________________

**Corrections or notes:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

---

## 5. Sidewalk café egress, accessibility, seating, and agency boundaries

- **Case ID:** `nyc-015-sidewalk-cafe-evidence-boundary`
- **Current status:** draft
- **Jurisdiction:** New York City, New York
- **Code edition:** 2022 New York City Construction Codes
- **Difficulty:** advanced
- **Topics:** sidewalk cafés, means of egress, accessibility, place of assembly, agency requirements

### Scenario source

Scenario derived from NYC Department of Buildings Bulletin 2024-005, July 9, 2024: https://www.nyc.gov/assets/buildings/bldgs_bulletins/bb_2024-005.pdf. The bulletin and unselected agency rules remain scenario provenance only.

The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.

### Project context

project: Restaurant proposing sidewalk-café seating and equipment; conditions: Furniture is proposed near a building exit and cellar hatch; ownerClaim: Outdoor-dining authorization permits separate exterior seating and eliminates further accessibility review; unknowns: exact building and property lines, whether the café is enclosed, interior and exterior seating, whether a Section 713 fire partition separates the seating, exit and cellar-hatch geometry, accessible dining-surface distribution, current agency authorizations

### Question

A restaurant proposes a sidewalk café with furniture near a building exit and cellar hatch. The owner says outdoor-dining authorization allows the exterior seats to be counted separately from the interior PACO and eliminates further accessibility review. The documents do not say whether the café is beyond the building line, enclosed, or separated from the interior seating by a Section 713 fire partition. What can be concluded from the selected Building Code passages, and what remains unresolved?

### Exact selected Permitext evidence

#### BC 3111.1

Canonical section ID: `5678`

Passage 1:

> Sidewalk cafes provided beyond the building line shall comply with the requirements of this section, the New York City Zoning Resolution, the Commissioners of the Department of Consumer and Worker Protection and Department of Transportation, and with the projection limitations of Chapter 32 of this code.

#### BC 3111.4

Canonical section ID: `5681`

Passage 1:

> No part of any awning, enclosure, fixture, equipment or removable platform of a sidewalk cafe shall be located:

Passage 2:

> 2. So as to obstruct any exit from a building;

Passage 3:

> 3. So as to obstruct any cellar access hatch or areaway;

Passage 4:

> Exception: Upon special application, the commissioner may permit an easily removable, prominently designated platform, designed in accordance with Section 3111.5, to cover a cellar entrance or areaway that is not used as a required means of egress.

#### BC 3111.6

Canonical section ID: `5685`

Passage 1:

> Sidewalk cafes and access thereto shall comply with Chapter 11.

#### BC 1108.2.9.1

Canonical section ID: `2792`

Passage 1:

> Where dining surfaces for the consumption of food or drink are provided, at least 10 percent of the total number of seating and standing spaces, but not less than one, of each type of dining surfaces shall be accessible and be distributed throughout the facility and located on a level accessed by an accessible route.

#### BC 3111.7

Canonical section ID: `5686`

Passage 1:

> Unless separated from seating inside the building by fire partitions complying with Section 713 , the seating for enclosed sidewalk cafes shall be added to that inside the building in order to determine whether a place of assembly certificate of operation is required.

### Proposed expected conclusion

The proposal cannot be approved from the selected evidence. If it is a sidewalk café beyond the building line, BC 3111.1 requires compliance not only with Section 3111 but also with Chapter 32 and separate zoning and agency requirements; the selected evidence does not provide those outside rules. BC 3111.4 prohibits café components from obstructing a building exit or cellar hatch. Its cellar-entrance exception is not automatic: it requires a special application, an easily removable and prominently designated platform designed under Section 3111.5, and a cellar entrance or areaway that is not required egress. BC 3111.6 makes Chapter 11 applicable to the café and its access. BC 1108.2.9.1 requires accessible seating and standing spaces equal to at least 10 percent of the total, with not less than one accessible space at each type of dining surface; those spaces must be distributed and located on a level served by an accessible route. BC 3111.7 supplies only a conditional rule for an enclosed sidewalk café: unless a Section 713 fire partition separates it from inside seating, its seating is added to the inside seating solely to determine whether a PACO is required. These passages do not establish the approved interior capacity, the treatment of every open exterior seating arrangement, property-line or operational jurisdiction, DOT authorization, electrical permitting, or overall approval.

### Expected uncertainty

level: insufficient evidence; description: The selected passages establish several conditional Building Code constraints, but they do not establish overall approval, current agency jurisdiction, lawful seating capacity, or electrical and operational requirements.

### Required citations and the claim each must support

- **BC 3111.1:** Conditional scope for sidewalk cafes beyond the building line and need for separate zoning, agency, and Chapter 32 compliance; it does not establish those outside rules.
- **BC 3111.4:** Exit and cellar-hatch obstruction prohibitions and the expressly conditional special-application exception.
- **BC 3111.6:** Application of Chapter 11 to sidewalk cafes and their access.
- **BC 1108.2.9.1:** Accessible seating and standing spaces equal to at least 10 percent of the total, at least one at each dining-surface type, distribution, and accessible-route requirements.
- **BC 3111.7:** Conditional enclosed-sidewalk-cafe seating aggregation rule used only to determine whether a PACO is required.

### Required concepts

- Make BC 3111 applicability conditional on the café being beyond the building line.
- Recognize that BC 3111.1 cross-references separate zoning and agency authority without supplying those authorities' substantive rules.
- State that café components cannot obstruct a building exit or cellar hatch.
- Explain every selected condition of the narrow cellar-hatch platform exception.
- State that sidewalk cafés and their access must comply with Chapter 11.
- Apply 10 percent to the total seating and standing spaces, require at least one accessible space at each dining-surface type, and identify the distribution and accessible-route requirements.
- Limit BC 3111.7 to enclosed sidewalk cafés and PACO determination.
- Make seating aggregation conditional on the absence of a compliant Section 713 separating fire partition.
- State that selected evidence is insufficient to determine current agency approval, property-line jurisdiction, electrical requirements, or lawful interior capacity.

### Facts the answer must identify as missing

- Exact property line and whether the café is beyond the building line.
- Whether the café is a sidewalk café within BC 3111's scope.
- Whether the café is enclosed.
- Whether a Section 713 fire partition separates exterior and interior seating.
- Current Certificate of Occupancy, PACO, and approved interior seating.
- Interior and exterior seat counts and each type of dining surface.
- Exit, cellar-hatch, areaway, and required-egress locations.
- Whether any proposed platform has special approval and complies with Section 3111.5.
- Accessible route and dining-surface distribution.
- Applicable Chapter 32 evidence.
- Current zoning and agency rules and authorizations.
- Heater, lighting, and electrical details and applicable separate authority.

### Claims the answer must not make

- Outdoor-dining or DOT authorization constitutes Building Code approval.
- The selected Building Code passages establish the current substantive DOT, DCWP, or Zoning Resolution requirements.
- Exterior seating never counts with interior seating.
- Every outdoor café seat must always be added to the interior occupant capacity.
- BC 3111.7 applies to an open café without determining whether it is enclosed.
- A platform may cover a cellar hatch automatically.
- A cellar-hatch exception is available when the hatch is required means of egress.
- Only 5 percent of the dining surfaces must be accessible.
- Ten percent must be calculated separately for every dining-surface type.
- One accessible table always satisfies BC 1108.2.9.1 regardless of dining-surface types, distribution, and accessible route.
- The selected evidence determines heater, lighting, or electrical-permit requirements.
- The selected evidence establishes the restaurant's approved interior occupant capacity or PACO status.

### Existing drafting note

Draft candidate NYC-015. Exact enacted passages were copied from Permitext canonical content. Agency, property-line, electrical, seating, and accessibility conclusions require knowledgeable review before approval.

### Reviewer decision

- [ ] Approve as written
- [ ] Approve after the corrections written below
- [ ] Reject

**Reviewer name:** ________________________________________________

**Review date:** ___________________________________________________

**Corrections or notes:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

---

## 6. Intermittent enclosed-garage ventilation detector controls

- **Case ID:** `nyc-016-enclosed-garage-intermittent-ventilation`
- **Current status:** draft
- **Jurisdiction:** New York City, New York
- **Code edition:** 2022 New York City Construction Codes
- **Difficulty:** intermediate
- **Topics:** mechanical ventilation, enclosed parking garages, carbon monoxide detection, nitrogen dioxide detection

### Scenario source

Draft scenario constructed from the canonical enacted text of 2022 NYC Mechanical Code Section 404.1 after correcting a confirmed legacy body-ID collision.

The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.

### Project context

project: Enclosed parking garage with an intermittently operated mechanical ventilation system; proposedControl: Operate the ventilation system from carbon monoxide detectors only, using a 35 ppm carbon monoxide set point; unknowns: detector manufacturer instructions, detector locations and coverage, whether any other control sequence is proposed, full mechanical-system design

### Question

An enclosed parking garage will use intermittent mechanical ventilation. The proposed controls use carbon monoxide detectors only and start the system at 35 ppm carbon monoxide. Based only on the selected Mechanical Code provision, is that control sequence compliant, and what can and cannot be concluded?

### Exact selected Permitext evidence

#### MC 404.1

Canonical section ID: `10442`

Passage 1:

> Where mechanical ventilation systems for enclosed parking garages operate intermittently, such operation shall be automatic by means of carbon monoxide detectors applied in conjunction with nitrogen dioxide detectors.

Passage 2:

> Such detectors shall be installed in accordance with their manufacturers' instructions.

Passage 3:

> Such systems shall operate automatically upon detection of a concentration of carbon monoxide of 25 parts per million (ppm) or nitrogen dioxide of 500 parts per billion (ppb).

### Proposed expected conclusion

The proposed control sequence does not match MC 404.1. For intermittent operation in an enclosed parking garage, automatic operation must use carbon monoxide detectors in conjunction with nitrogen dioxide detectors. The system must operate automatically when carbon monoxide reaches 25 ppm or nitrogen dioxide reaches 500 ppb, so a carbon-monoxide-only sequence at 35 ppm omits the required nitrogen dioxide detection and exceeds the stated carbon monoxide trigger. The detectors must also be installed according to their manufacturers' instructions. The selected provision does not establish detector quantity or placement, the complete ventilation rate and capacity, or compliance of the rest of the mechanical design.

### Expected uncertainty

level: conditional; description: The selected provision resolves the detector types and automatic-operation thresholds, but it does not establish the complete ventilation-system design or detector layout.

### Required citations and the claim each must support

- **MC 404.1:** Automatic intermittent operation using carbon monoxide detection together with nitrogen dioxide detection, the 25 ppm and 500 ppb alternative trigger thresholds, and manufacturer-instruction installation.

### Required concepts

- State that intermittent enclosed-garage ventilation must operate automatically.
- Require carbon monoxide detection in conjunction with nitrogen dioxide detection.
- Identify 25 ppm carbon monoxide as an automatic-operation threshold.
- Identify 500 ppb nitrogen dioxide as an automatic-operation threshold.
- State that detector installation must follow the manufacturers' instructions.
- Explain that the selected evidence does not establish detector quantity, detector placement, ventilation rate, system capacity, or complete mechanical-design compliance.

### Facts the answer must identify as missing

- Detector manufacturer and installation instructions.
- Detector quantity, locations, and coverage.
- Complete control sequence.
- Required ventilation airflow rate and system capacity.
- Other applicable Mechanical Code provisions and project conditions.

### Claims the answer must not make

- Carbon monoxide detection alone satisfies MC 404.1.
- A 35 ppm carbon monoxide trigger satisfies MC 404.1.
- Nitrogen dioxide detection is optional.
- The system must wait until both the carbon monoxide and nitrogen dioxide thresholds are reached.
- MC 404.1 alone establishes detector quantity or placement.
- The selected evidence proves that the complete garage ventilation design complies with the Mechanical Code.

### Existing drafting note

Draft candidate NYC-016. This case is also a regression guard for canonical Mechanical Code body selection. It requires knowledgeable-human review before approval.

### Reviewer decision

- [ ] Approve as written
- [ ] Approve after the corrections written below
- [ ] Reject

**Reviewer name:** ________________________________________________

**Review date:** ___________________________________________________

**Corrections or notes:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

---

## 7. Prior-code building crosses the 110 percent floor-surface-area threshold

- **Case ID:** `nyc-017-prior-code-floor-surface-area-110-percent`
- **Current status:** draft
- **Jurisdiction:** New York City, New York
- **Code edition:** 2022 New York City Construction Codes
- **Difficulty:** advanced
- **Topics:** prior-code buildings, floor surface area, scope changes, new-building compliance, administrative provisions

### Scenario source

Draft scenario constructed from canonical 2022 NYC Administrative Code Sections 28-101.4.5, 28-101.4.5.1, and 28-101.4.5.2.

The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.

### Project context

building: Prior-code building filed as an alteration; originalScope: Proposed floor-surface-area increase stated as 105 percent; changedScope: Construction changes may increase floor surface area by 115 percent; unknowns: verified existing and proposed floor-surface-area measurements, floors removed with their supporting construction, floors installed less than 12 months before filing, permit and filing status, whether emergency work is involved

### Question

A prior-code building was filed as an alteration based on a 105 percent floor-surface-area increase, but scope changes during construction may raise the increase to 115 percent. Can the project remain an alteration, what happens if the threshold is crossed, and what must be included or excluded when checking the percentage?

### Exact selected Permitext evidence

#### AC 28-101.4.5

Canonical section ID: `8792`

Passage 1:

> Notwithstanding sections 28-101.4.3 and 28-102.4.3 or any other provision of this code that would authorize alterations of prior code buildings in accordance with the 1968 building code or prior codes, where the proposed work at the completion of construction will increase the amount of floor surface area of a prior code building by more than 110%, over the amount of existing floor surface area, such entire building shall be made to comply with the provisions of this code as if it were a new building hereafter erected. See section 28-105.2 for permits for such work.

Passage 2:

> Exceptions. When determining the amount of existing floor surface area for the purposes of section 28-101.4.5 , the following shall be excluded from the measured square footage of floor surface area:

Passage 3:

> 1. The square footage of floors removed during the course of the work when such floors are removed together with the supporting beams, joists, decking and slabs on grade.

Passage 4:

> 2. The square footage of any floor that was installed together with the supporting beams, joists, decking and slabs on grade less than 12 months prior to submission of the application for construction document approval for the proposed work. For the purposes of this exception, floors installed pursuant to a work permit signed off less than 12 months before such submission shall not be counted as existing floor surface area.

#### AC 28-101.4.5.1

Canonical section ID: `8793`

Passage 1:

> In cases where changes in the scope of work during the course of construction would result in increasing the floor surface area at the completion of construction by more than 110 percent, over the amount of existing floor surface area as determined pursuant to section 28-101.4.5 , such entire building shall be made to comply with the provisions of this code as if hereafter erected and such work shall be refiled as a new building application in accordance with the provisions of section 28-105.2 .

Passage 2:

> Exception: Work to the extent necessary to relieve an emergency condition may be performed prior to amending plans or obtaining a new permit pursuant to sections 28-105.4.1 and 28-105.12.2 .

#### AC 28-101.4.5.2

Canonical section ID: `8794`

Passage 1:

> As used in Section 28-101.4.5 , the following term shall have the following meaning unless the context or subject matter requires otherwise.

Passage 2:

> FLOOR SURFACE AREA. Floor surface area is the gross square foot area of all horizontal floor and roof surfaces, including roofs of bulkheads and superstructures, of a building or structure at any level, including cellar, attic and roof.

### Proposed expected conclusion

If verified scope changes increase floor surface area at completion by more than 110 percent over existing floor surface area as determined under AC 28-101.4.5, AC 28-101.4.5.1 requires the entire building to comply as if newly erected and requires the work to be refiled as a new-building application under AC 28-105.2. The narrow emergency exception allows only work necessary to relieve an emergency condition before plans are amended or a new permit is obtained. AC 28-101.4.5.2 defines floor surface area as the gross area of all horizontal floor and roof surfaces at every level, expressly including bulkhead and superstructure roofs, cellar, attic, and roof. When measuring existing floor surface area, AC 28-101.4.5 excludes qualifying floors removed with their supporting construction and qualifying floors installed with their supporting construction less than 12 months before the filing. The stated 105 and 115 percent estimates are not enough without verified measurements, dates, removed-floor scope, and filing facts.

### Expected uncertainty

level: conditional; description: The legal consequence is supported if the correctly measured increase is more than 110 percent, but the selected evidence does not verify the project measurements, exclusions, dates, or filing facts.

### Required citations and the claim each must support

- **AC 28-101.4.5:** More-than-110-percent trigger, whole-building new-code consequence, and the two stated existing-floor-area exclusions.
- **AC 28-101.4.5.1:** Scope-change trigger, whole-building compliance, new-building refiling, and the limited emergency-work exception.
- **AC 28-101.4.5.2:** Definition of floor surface area, including all listed horizontal floor and roof surfaces.

### Required concepts

- Apply the threshold only when the increase is more than 110 percent over existing floor surface area.
- State that crossing the threshold makes the entire building comply as if newly erected.
- State that a scope change crossing the threshold requires refiling as a new-building application.
- Limit the emergency exception to work necessary to relieve an emergency condition before amended plans or a new permit.
- Define floor surface area as gross horizontal floor and roof area at every level, including the specifically listed areas.
- Identify both exclusions from measured existing floor surface area.
- Require verified measurements, dates, removed-floor scope, and filing facts before deciding whether the threshold was crossed.

### Facts the answer must identify as missing

- Verified existing floor surface area.
- Verified proposed floor surface area at completion.
- Scope and supporting construction of any floors removed.
- Installation and sign-off dates for recently installed floors.
- Current application and permit status.
- Whether work is necessary to relieve an emergency condition.

### Claims the answer must not make

- An increase of exactly 110 percent triggers AC 28-101.4.5.
- The project may remain an alteration after a verified increase of more than 110 percent.
- Only occupiable floor area counts as floor surface area.
- Cellars, attics, roofs, bulkhead roofs, and superstructure roofs are always excluded.
- Every removed floor is excluded regardless of whether its supporting construction is removed.
- Emergency work permanently eliminates the refiling requirement.
- The estimates alone prove that the threshold was crossed.

### Existing drafting note

Draft candidate NYC-017 broadens prior-code-building coverage. Exact enacted passages were copied from Permitext canonical content and require knowledgeable-human review before approval.

### Reviewer decision

- [ ] Approve as written
- [ ] Approve after the corrections written below
- [ ] Reject

**Reviewer name:** ________________________________________________

**Review date:** ___________________________________________________

**Corrections or notes:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

---

## 8. Fire-district determination requires the official maps

- **Case ID:** `nyc-018-fire-district-map-boundary`
- **Current status:** draft
- **Jurisdiction:** New York City, New York
- **Code edition:** 2022 New York City Construction Codes
- **Difficulty:** advanced
- **Topics:** fire districts, official maps, non-text evidence, administrative provisions, Appendix D

### Scenario source

Draft non-text-evidence scenario constructed from canonical AC 28-102.4.5 and BC D106.1, including the official Appendix D map assets shipped in Permitext.

The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.

### Project context

project: Queens property whose fire-district status is disputed; location: A street address is supplied, but no survey point or official map sheet is included in selected evidence; unknowns: precise lot location, applicable map sheet, location relative to the depicted fire-district boundary, whether any later authoritative boundary material applies

### Question

The project address is in Queens. Based only on the selected text from AC 28-102.4.5 and BC D106.1, can Permitext confirm that the lot is inside the fire district?

### Exact selected Permitext evidence

#### AC 28-102.4.5

Canonical section ID: `8808`

Passage 1:

> The boundaries of fire districts shall be in accordance with the maps set forth in Appendix D of the New York city building code.

#### BC D106.1

Canonical section ID: `6881`

Passage 1:

> Within the boroughs of Staten Island (Richmond County) and Queens, the fire districts shall comprise such areas indicated on the "fire district maps" as per Figures D106.1(1) and D106.1(2) .

Passage 2:

> Figure D106.1(1) Fire District Maps Borough of Staten Island (Richmond County)

Passage 3:

> Figure D106.1(2) Fire District Maps Borough of Queens

### Proposed expected conclusion

No. AC 28-102.4.5 makes the Appendix D maps controlling for fire-district boundaries. BC D106.1 says that the Staten Island and Queens fire districts are the areas shown on Figures D106.1(1) and D106.1(2), but the selected text contains only the cross-reference and figure captions, not the mapped boundary information needed to locate the lot. Permitext can identify the governing map source, but it cannot decide the lot's status from the text alone. A professional must review the applicable official map image at usable resolution against the precise property location and verify whether any later authoritative boundary material applies.

### Expected uncertainty

level: insufficient evidence; description: The selected text identifies the controlling maps but omits the visual boundary evidence and precise property location required for a parcel-level determination.

### Required citations and the claim each must support

- **AC 28-102.4.5:** Appendix D maps control the fire-district boundaries.
- **BC D106.1:** Staten Island and Queens fire-district areas are indicated on the named figures, whose visual boundary information is absent from the selected text.

### Required concepts

- State that the Appendix D maps control the fire-district boundaries.
- Identify Figures D106.1(1) and D106.1(2) as the Staten Island and Queens fire-district maps.
- State that the selected text and figure captions do not contain the mapped boundary geometry.
- Refuse to determine whether the Queens lot is inside the fire district from text alone.
- Require visual review of the applicable official map against the precise property location.
- Preserve uncertainty about later authoritative boundary material.

### Facts the answer must identify as missing

- Precise lot location or survey point.
- Applicable official Appendix D map sheet and readable map image.
- Location of the lot relative to the depicted boundary.
- Any later authoritative boundary material.

### Claims the answer must not make

- Every property in Queens is in a fire district.
- No property in Queens is in a fire district.
- A Queens address alone establishes fire-district status.
- The figure captions contain enough information to locate the lot.
- Permitext reviewed map pixels that were not included in selected evidence.
- The selected text establishes parcel-level fire-district status.

### Existing drafting note

Draft candidate NYC-018 is a release-boundary case: text-only candidate preparation must remain blocked for BC D106.1 until its official map images can be reviewed as evidence.

### Reviewer decision

- [ ] Approve as written
- [ ] Approve after the corrections written below
- [ ] Reject

**Reviewer name:** ________________________________________________

**Review date:** ___________________________________________________

**Corrections or notes:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

---

## 9. Construction Code text does not substitute for a Buildings Bulletin

- **Case ID:** `nyc-019-buildings-bulletin-policy-boundary`
- **Current status:** draft
- **Jurisdiction:** New York City, New York
- **Code edition:** 2022 New York City Construction Codes
- **Difficulty:** advanced
- **Topics:** Buildings Bulletins, cellar bathrooms, illegal residential conversions, outside current library, authority boundaries

### Scenario source

NYC Department of Buildings Bulletin 2011-010, official PDF: https://www.nyc.gov/assets/buildings/bldgs_bulletins/bb_2011-010.pdf. The bulletin is scenario provenance and remains outside the selected evidence.

The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.

### Project context

building: One- or two-family dwelling with a proposed three-fixture bathroom in the cellar; claim: Buildings Bulletin 2011-010 is said to permit the bathroom; availableEvidence: Only AC 28-210.1 is selected from Permitext's current Construction Code Research library; unknowns: the authoritative Buildings Bulletin text and all stated conditions, lawful family count and occupancy, cellar use and layout, Zoning Resolution compliance, Housing Maintenance Code compliance, other applicable code provisions and agency records

### Question

Does the current Permitext Construction Code evidence prove that a three-fixture bathroom is permitted in the cellar of this one- or two-family dwelling under Buildings Bulletin 2011-010, the Zoning Resolution, and the Housing Maintenance Code?

### Exact selected Permitext evidence

#### AC 28-210.1

Canonical section ID: `9361`

Passage 1:

> It shall be unlawful, except in accordance with all requirements of this code, to convert any dwelling for occupancy by more than the legally authorized number of families or to assist, take part in, maintain or permit the maintenance of such conversion. Upon the finding of such violation and the imposition of punishment for such violation as set forth in this code the department or if applicable the environmental control board shall forward to the internal revenue service, the New York state department of taxation and finance and the New York city department of finance the name and address of the respondent or defendant, the address of the building or structure with respect to which the violation occurred and the time period during which the violation was found to have existed.

### Proposed expected conclusion

No. AC 28-210.1 establishes that converting or maintaining a dwelling for occupancy by more than the legally authorized number of families is unlawful except in accordance with all code requirements. It does not establish a cellar-bathroom allowance, reproduce Buildings Bulletin 2011-010, prove compliance with the bulletin's conditions, or supply the Zoning Resolution and Housing Maintenance Code requirements. Those authorities are outside Permitext's current Construction Code Research scope and must be obtained and reviewed in authoritative form together with the project's lawful occupancy, cellar use, layout, and other applicable requirements. The selected evidence supports an illegal-conversion caution only; it cannot approve the bathroom.

### Expected uncertainty

level: outside selected authority; description: The selected Construction Code passage does not include the Buildings Bulletin, Zoning Resolution, Housing Maintenance Code, or project facts needed to determine whether the proposed cellar bathroom is permissible.

### Required citations and the claim each must support

- **AC 28-210.1:** Illegal conversion or maintenance for occupancy beyond the legally authorized family count, while not treating the section as a cellar-bathroom approval.

### Required concepts

- Explain the illegal-residential-conversion rule supported by AC 28-210.1.
- State that AC 28-210.1 does not itself establish a cellar-bathroom allowance.
- State that Buildings Bulletin 2011-010 is not included in the selected evidence.
- State that the selected evidence does not establish the Zoning Resolution or Housing Maintenance Code requirements.
- Refuse to approve the bathroom from the current Construction Code evidence.
- Require authoritative outside-source review and project-specific occupancy and cellar facts.

### Facts the answer must identify as missing

- Authoritative text and applicability conditions of Buildings Bulletin 2011-010.
- Lawfully authorized number of families and current occupancy records.
- Proposed and existing cellar use and layout.
- Applicable Zoning Resolution provisions.
- Applicable Housing Maintenance Code provisions.
- Other applicable Construction Code provisions and agency records.

### Claims the answer must not make

- AC 28-210.1 permits a three-fixture cellar bathroom.
- Buildings Bulletin 2011-010 was analyzed as selected evidence.
- Every one- or two-family dwelling may install a cellar bathroom.
- A cellar bathroom never affects illegal-conversion analysis.
- The current candidate set establishes Zoning Resolution compliance.
- The current candidate set establishes Housing Maintenance Code compliance.
- The proposed bathroom is approved or compliant.

### Existing drafting note

Draft candidate NYC-019 tests an explicit outside-authority boundary. Permitext must link to the official Buildings Bulletins source without representing that it has retrieved or analyzed the bulletin.

### Reviewer decision

- [ ] Approve as written
- [ ] Approve after the corrections written below
- [ ] Reject

**Reviewer name:** ________________________________________________

**Review date:** ___________________________________________________

**Corrections or notes:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

---

## 10. Existing plumbing repair does not automatically trigger a whole-system upgrade

- **Case ID:** `nyc-020-existing-plumbing-repair-boundary`
- **Current status:** draft
- **Jurisdiction:** New York City, New York
- **Code edition:** 2022 New York City Construction Codes
- **Difficulty:** intermediate
- **Topics:** existing plumbing installations, prior-code buildings, repairs, new-installation requirements, whole-system upgrade boundary

### Scenario source

Draft scenario constructed from the canonical enacted text of 2022 NYC Plumbing Code Sections 102.2, 102.4, and 102.4.1.

The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.

### Project context

building: Existing prior-code office building; existingSystem: Plumbing installation represented by the owner as lawfully installed before the current code; proposedWork: Replacement of a short corroded drain-pipe segment in the same route and arrangement; ownerPosition: The work is an ordinary repair and the entire existing installation may remain exactly as-is; unknowns: lawful installation and original approved design, exact repair scope and whether it is minor, whether the replacement is in the same manner and arrangement, unsafe, hazardous, overloaded, or unsanitary conditions, required departmental approval and inspection, other applicable testing, filing, and building requirements

### Question

An existing prior-code office building has a plumbing system said to have been lawfully installed before the current code. The project will replace a short corroded drain-pipe segment in the same route and arrangement. The owner calls it an ordinary repair and says the old system can remain exactly as-is. Based on PC 102.2, PC 102.4, and PC 102.4.1, must the entire existing plumbing installation be upgraded, and can the repair avoid the new-installation rules?

### Exact selected Permitext evidence

#### PC 102.2

Canonical section ID: `11734`

Passage 1:

> Except as otherwise specifically provided, plumbing systems lawfully in existence on July 1, 2008 or on the effective date of a subsequent amendment of this code shall be permitted to have their use and maintenance continued if the use, maintenance or repair is in accordance with the original design and no hazard to life, health or property is created by such plumbing system.

#### PC 102.4

Canonical section ID: `11739`

Passage 1:

> Additions, alterations, renovations or repairs to installations shall conform to that required for new installations without requiring the existing installation to comply with all of the requirements of this code. Additions, alterations or repairs shall not cause an existing installation to become unsafe, hazardous or overloaded.

#### PC 102.4.1

Canonical section ID: `11740`

Passage 1:

> Minor additions, alterations, renovations and repairs to existing installations shall meet the provisions for new construction, unless such work is done in the same manner and arrangement as was in the existing system, is not hazardous and is approved.

### Proposed expected conclusion

The selected evidence does not automatically require the entire existing plumbing installation to be upgraded. PC 102.4 requires the repair work to conform to the requirements for new installations while expressly stating that the existing installation need not be brought into compliance with every current-code requirement; the work also may not make the installation unsafe, hazardous, or overloaded. PC 102.4.1 provides a conditional exception for minor work performed in the same manner and arrangement as the existing system, but only when the work is not hazardous and is approved. PC 102.2 separately permits continued use and maintenance of a lawfully existing system only when the use, maintenance, or repair accords with the original design and creates no hazard to life, health, or property. The owner's labels and assumptions do not establish those conditions. The lawful status, original design, exact repair scope, same-manner-and-arrangement facts, safety condition, approval, and other applicable testing or filing requirements must be verified.

### Expected uncertainty

level: conditional; description: The selected passages establish the repair and whole-system boundaries, but the exception depends on the actual scope, original design, safety conditions, and approval.

### Required citations and the claim each must support

- **PC 102.2:** Conditional continued use and maintenance of a lawfully existing installation in accordance with its original design and without a hazard.
- **PC 102.4:** New-installation requirements apply to the repair without automatically requiring whole-existing-system compliance, and the work may not create an unsafe, hazardous, or overloaded condition.
- **PC 102.4.1:** Conditional minor-work treatment when the same manner and arrangement, no-hazard, and approval conditions are met.

### Required concepts

- Reject an automatic whole-existing-system upgrade based solely on the repair.
- State that the repair work generally must conform to new-installation requirements.
- State that the work may not make the installation unsafe, hazardous, or overloaded.
- Explain the conditional same-manner-and-arrangement rule for minor work.
- Tie continued use and maintenance to lawful existence, the original design, and absence of hazards.
- Treat the owner's ordinary-repair label as an unverified project assertion.
- Request the project facts and approval needed to determine whether the conditional exception applies.

### Facts the answer must identify as missing

- Evidence that the existing plumbing installation was lawfully installed.
- Original approved design and arrangement.
- Exact limits and classification of the proposed repair.
- Whether the replacement uses the same manner and arrangement.
- Unsafe, hazardous, overloaded, or unsanitary existing or resulting conditions.
- Required departmental approval, inspection, testing, and filing information.

### Claims the answer must not make

- Every repair requires the entire existing plumbing installation to be upgraded.
- No current-code requirement applies to the proposed repair.
- The owner's ordinary-repair label establishes the PC 102.4.1 exception.
- Same route alone proves the work uses the same manner and arrangement.
- A lawfully existing installation may remain hazardous.
- Approval is unnecessary for the conditional minor-work rule.
- The proposed repair is compliant on the stated facts.

### Existing drafting note

Draft candidate NYC-020 broadens existing-building coverage into plumbing repairs. Exact enacted passages were copied from Permitext canonical content and require knowledgeable-human review before approval.

### Reviewer decision

- [ ] Approve as written
- [ ] Approve after the corrections written below
- [ ] Reject

**Reviewer name:** ________________________________________________

**Review date:** ___________________________________________________

**Corrections or notes:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

---

## 11. Prior-code wind-surface-area increase can trigger whole-building design

- **Case ID:** `nyc-021-prior-code-wind-surface-area-trigger`
- **Current status:** draft
- **Jurisdiction:** New York City, New York
- **Code edition:** 2022 New York City Construction Codes
- **Difficulty:** advanced
- **Topics:** prior-code buildings, structural alterations, wind surface area, lateral force capacity, whole-building design

### Scenario source

Draft scenario constructed from canonical 2022 NYC Building Code Section 1601.2.4 and Administrative Code Section 28-101.4.4.

The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.

### Project context

building: Existing prior-code commercial building; proposedWork: Exterior addition represented by the design team as increasing wind surface area by 6 percent in one direction; ownerPosition: Only the addition needs wind design and the existing building may continue under its prior-code wind provisions; unknowns: verified existing and proposed wind surface areas in every direction, calculation method and direction of the stated increase, whether lateral force capacity is permanently decreased, applicable code used for the design wind load, existing material properties and structural condition, whether the project elects current-code structural calculations

### Question

An exterior addition to a prior-code commercial building is said to increase the building's wind surface area by 6 percent in one direction. The owner says only the addition needs wind design and the existing building may remain under its prior-code wind provisions. Based on BC 1601.2.4 and AC 28-101.4.4, does the stated increase trigger whole-building wind design, and what still must be verified?

### Exact selected Permitext evidence

#### BC 1601.2.4

Canonical section ID: `3422`

Passage 1:

> All alterations, minor alterations, and ordinary repairs, to the extent of such work, shall be permitted to be performed in accordance with the wind load requirements set forth in the 1968 Building Code, or where the 1968 Building Code so authorizes, the code in effect prior to December 6, 1968.

Passage 2:

> 3. When the wind surface area of a prior code building or structure is increased by more than 5 percent in any direction or there is a permanent decrease of the lateral force capacity by more than 20 percent in any direction, the entire building or structure shall be designed to resist the design wind load as calculated pursuant to the applicable code, but not less than 5 psf (0.24 kN/m 2 ).

#### AC 28-101.4.4

Canonical section ID: `8791`

Passage 1:

> Notwithstanding any other provision of this code, where the alteration of any prior code building or structure in accordance with a provision of this code would result in a reduction of the fire safety or structural safety of such building, relevant provisions of the 1968 building code shall apply to such alteration unless there is full compliance with those provisions of this code that would mitigate or offset such reduction of fire protection or structural safety.

Passage 2:

> Where the owner, having a choice to elect the 1968 building code or this code, chooses this code, the applicant shall submit a comparative analysis acceptable to the commissioner of the relevant fire safety and structural safety provisions under the 1968 Code and this code, demonstrating that the alteration does not result in a reduction to the fire and life safety of the building.

### Proposed expected conclusion

If the verified wind surface area increases by more than 5 percent in any direction, BC 1601.2.4 exception 3 requires the entire building or structure—not only the addition—to be designed to resist the design wind load calculated under the applicable code, with a minimum of 5 psf. The same whole-building consequence also applies if there is a permanent decrease of lateral force capacity by more than 20 percent in any direction. The general permission to use prior-code wind provisions for alteration work does not override those stated exceptions. AC 28-101.4.4 separately prohibits an alteration from reducing the structural safety of a prior-code building and requires an applicant electing the current code, when that election is available, to submit a comparative analysis acceptable to the commissioner. The owner's 6 percent assertion is not itself verified evidence. The existing and proposed wind surface areas in each direction, calculation method, any permanent lateral-capacity change, applicable design code, structural condition, material properties, and code election must be established before the project-specific conclusion is final.

### Expected uncertainty

level: conditional; description: The whole-building trigger follows if the correctly measured increase is more than 5 percent in any direction or lateral-force capacity permanently decreases by more than 20 percent, but the selected evidence does not verify the calculations, structural condition, applicable design code, or code election.

### Required citations and the claim each must support

- **BC 1601.2.4:** General prior-code wind treatment, the more-than-5-percent wind-surface-area and more-than-20-percent lateral-capacity triggers, whole-building consequence, and 5 psf minimum.
- **AC 28-101.4.4:** No reduction of structural safety and the comparative-analysis requirement when the current-code election is made.

### Required concepts

- Apply the wind-surface-area trigger only when the increase is more than 5 percent in any direction.
- Identify the separate trigger for a permanent lateral-force-capacity decrease of more than 20 percent in any direction.
- State that either trigger requires the entire building or structure to resist the applicable design wind load.
- State the minimum design wind load of 5 psf.
- Explain that the general prior-code permission does not override the listed exceptions.
- Explain the AC 28-101.4.4 structural-safety and comparative-analysis boundary without treating the project facts as proven.
- Require verified directional measurements, calculations, structural facts, applicable design code, and code election.

### Facts the answer must identify as missing

- Verified existing and proposed wind surface area in each direction.
- Calculation method and direction for the claimed 6 percent increase.
- Any permanent decrease in lateral force capacity and its percentage by direction.
- Applicable code for calculating the design wind load.
- Existing structural condition and material properties.
- Whether the applicant elects current-code structural calculations and whether that election is available.
- Commissioner-acceptable comparative analysis where required.

### Claims the answer must not make

- An increase of exactly 5 percent triggers BC 1601.2.4 exception 3.
- The stated 6 percent figure is verified by the selected evidence.
- Only the addition requires wind design after a verified increase of more than 5 percent in any direction.
- The minimum required design wind load may be less than 5 psf.
- A lateral-force-capacity decrease must exceed 5 percent to trigger whole-building design.
- Prior-code wind provisions always control despite the listed exceptions.
- AC 28-101.4.4 permits a reduction in structural safety.
- The proposed alteration is compliant on the stated facts.

### Existing drafting note

Draft candidate NYC-021 broadens existing-building coverage into structural wind triggers. Exact enacted passages were copied from Permitext canonical content and require knowledgeable-human review before approval.

### Reviewer decision

- [ ] Approve as written
- [ ] Approve after the corrections written below
- [ ] Reject

**Reviewer name:** ________________________________________________

**Review date:** ___________________________________________________

**Corrections or notes:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

---

## 12. A formerly lawful occupancy is not automatically resumable

- **Case ID:** `nyc-022-reestablished-prior-occupancy-boundary`
- **Current status:** draft
- **Jurisdiction:** New York City, New York
- **Code edition:** 2022 New York City Construction Codes
- **Difficulty:** advanced
- **Topics:** existing buildings, change of occupancy, re-establishment of prior occupancy, certificate of occupancy, administrative provisions

### Scenario source

Draft scenario constructed from canonical 2022 NYC Administrative Code Sections 28-102.4, 28-102.4.2, 28-118.3.1, and 28-118.3.2.

The source supplies the scenario only. Forum comments, bulletin summaries, and third-party answers are not the answer key.

### Project context

building: Existing prior-code commercial building; formerOccupancy: Storage occupancy represented by the owner as lawful before July 1, 2008; currentOccupancy: Office occupancy established under a certificate of occupancy issued after July 1, 2008; proposal: Resume the former storage occupancy without a new filing or amended certificate of occupancy; ownerPosition: The former occupancy may resume automatically because it was lawful before the current code; unknowns: former and current occupancy-group classifications, former and current zoning use groups, current certificate of occupancy and approved construction documents, whether the former occupancy would be lawful in a new building of the same construction class, applicable current-code and other legal requirements, scope of any alteration work

### Question

A prior-code commercial building was lawfully used for storage before July 1, 2008, then changed to office occupancy under a later certificate of occupancy. The owner now wants to resume the former storage occupancy without a new filing or amended certificate, arguing that the old occupancy was once lawful. Based on AC 28-102.4, AC 28-102.4.2, AC 28-118.3.1, and AC 28-118.3.2, may the former occupancy resume automatically, and what must be established first?

### Exact selected Permitext evidence

#### AC 28-102.4

Canonical section ID: `8803`

Passage 1:

> The lawful use or occupancy of any existing building or structure, including the use of any service equipment therein, may be continued unless a retroactive change is specifically required by the provisions of this code or other applicable laws or rules.

#### AC 28-102.4.2

Canonical section ID: `8805`

Passage 1:

> Except as otherwise provided in sections 28-101.4.1 , 28-101.4.2 , 28-101.4.3 or 28-101.4.4 , changes in the use or occupancy of any building or structure made after July 1, 2008 shall comply with the provisions of this code.

Passage 2:

> Any changes made in the use or occupancy of a building or structure not in compliance with this code shall be prohibited and shall be a violation of this code.

Passage 3:

> After a change in use or occupancy has been made in a building, the re-establishment of a prior use or occupancy that would not be lawful in a new building of the same construction class shall be prohibited unless and until all the applicable provisions of this code and other applicable laws and rules for such reestablished use or occupancy shall have been complied with.

#### AC 28-118.3.1

Canonical section ID: `9198`

Passage 1:

> No building, open lot or portion thereof hereafter altered so as to change from one occupancy group to another, or from one zoning use group to another, either in whole or in part, shall be occupied or used unless and until the commissioner has issued a certificate of occupancy certifying that the alteration work for which the permit was issued has been completed substantially in accordance with the approved construction documents and the provisions of this code and other applicable laws and rules for the new occupancy or use.

#### AC 28-118.3.2

Canonical section ID: `9199`

Passage 1:

> No change shall be made to a building, open lot or portion thereof inconsistent with the last issued certificate of occupancy or, where applicable, inconsistent with the last issued certificate of completion for such building or open lot or which would bring it under some special provision of this code or other applicable laws or rules, unless and until the commissioner has issued a new or amended certificate of occupancy.

### Proposed expected conclusion

No automatic right to resume the former storage occupancy is established by the selected evidence. AC 28-102.4 permits continuation of a lawful existing use or occupancy unless a retroactive change is required, but the proposal follows an intervening change to office occupancy and therefore is not established as mere continuation of the former occupancy. AC 28-102.4.2 requires post-July 1, 2008 changes in use or occupancy to comply with the current code, prohibits noncompliant changes, and specifically prohibits re-establishing a prior use or occupancy that would not be lawful in a new building of the same construction class until all applicable code provisions and other laws and rules for that re-established occupancy are satisfied. AC 28-118.3.1 requires a certificate of occupancy when alteration changes an occupancy group or zoning use group, and AC 28-118.3.2 prohibits changes inconsistent with the last certificate of occupancy until a new or amended certificate is issued. The former and current occupancy and zoning classifications, construction class, current certificate and approved documents, legality of the former occupancy in a comparable new building, applicable requirements, and proposed work must be verified before determining the required filing and whether the former occupancy may lawfully resume.

### Expected uncertainty

level: conditional; description: The selected passages reject automatic reliance on a formerly lawful occupancy, but the filing and compliance result depends on the actual classifications, construction class, current certificate, approved documents, applicable laws, and scope of work.

### Required citations and the claim each must support

- **AC 28-102.4:** Conditional continuation of a lawful existing occupancy, without treating it as automatic re-establishment after an intervening change.
- **AC 28-102.4.2:** Current-code compliance for post-2008 occupancy changes, prohibition on noncompliant changes, and the condition on re-establishing a prior occupancy.
- **AC 28-118.3.1:** Certificate-of-occupancy requirement when an alteration changes an occupancy group or zoning use group.
- **AC 28-118.3.2:** New-or-amended-certificate requirement for a change inconsistent with the last certificate or triggering a special provision.

### Required concepts

- Distinguish continuation of a lawful existing occupancy from re-establishment after an intervening occupancy change.
- State that post-July 1, 2008 occupancy changes generally must comply with the current code.
- State the prohibition on a noncompliant occupancy change.
- Explain the specific condition on re-establishing a prior occupancy that would not be lawful in a new building of the same construction class.
- Identify the certificate-of-occupancy requirement for an alteration changing an occupancy group or zoning use group.
- Identify the new-or-amended-certificate requirement for a change inconsistent with the last certificate.
- Require the actual classifications, construction class, certificate, approved documents, applicable requirements, and work scope.

### Facts the answer must identify as missing

- Evidence of the former lawful storage occupancy.
- Former and current occupancy-group classifications.
- Former and current zoning use groups.
- Building construction class.
- Current certificate of occupancy and approved construction documents.
- Whether the former occupancy would be lawful in a new building of the same construction class.
- Applicable current-code provisions and other laws and rules.
- Scope and classification of any proposed alteration work.

### Claims the answer must not make

- Any occupancy that was once lawful may be resumed automatically.
- AC 28-102.4 makes the intervening office occupancy irrelevant.
- A post-July 1, 2008 occupancy change may disregard current-code requirements.
- No certificate amendment is needed regardless of the last issued certificate.
- The proposal necessarily changes an occupancy group or zoning use group without verifying the classifications.
- The former storage occupancy would be unlawful in a comparable new building without verifying the construction class and applicable requirements.
- The proposed occupancy is approved or compliant on the stated facts.

### Existing drafting note

Draft candidate NYC-022 broadens existing-building coverage into re-establishment of a former occupancy. Exact enacted passages were copied from Permitext canonical content and require knowledgeable-human review before approval.

### Reviewer decision

- [ ] Approve as written
- [ ] Approve after the corrections written below
- [ ] Reject

**Reviewer name:** ________________________________________________

**Review date:** ___________________________________________________

**Corrections or notes:**

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________

---

## Final reviewer statement

I reviewed the exact selected evidence, expected conclusions, required concepts, citation requirements, forbidden claims, missing-fact conditions, and uncertainty expectations for the decisions recorded above.

**Reviewer signature or name:** _____________________________________

**Date:** ___________________________________________________________

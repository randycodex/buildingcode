# Permitext AI Evaluation — Draft Case Review Packet

**Development-only document — contains private answer keys and must not be served to Permitext customers.**

Generated from `evals/research-cases.json` on 2026-07-24T15:37:22.811Z.

This packet contains 5 draft cases. Reviewing this document does not alter the evaluation dataset or approve a case automatically.

For each case, confirm that the exact enacted passages are correct, the proposed conclusion follows from those passages, the required concepts and citations are complete, and the missing-fact and forbidden-claim rules are appropriate. Select one decision and write any corrections. A case remains a draft until the decision is deliberately entered into Permitext's owner review system.

## Reviewer summary

| Case | Decision | Initials |
| --- | --- | --- |
| nyc-001-mixed-occupancy-fixture-rounding | Approve / Correct / Reject |  |
| nyc-002-stated-occupancy-movable-seats | Approve / Correct / Reject |  |
| nyc-011-legacy-fire-alarm-enlargement | Approve / Correct / Reject |  |
| nyc-013-b-m-co-accessibility-boundary | Approve / Correct / Reject |  |
| nyc-015-sidewalk-cafe-evidence-boundary | Approve / Correct / Reject |  |

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

[object Object]

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

[object Object]

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

[object Object]

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

[object Object]

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

[object Object]

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

## Final reviewer statement

I reviewed the exact selected evidence, expected conclusions, required concepts, citation requirements, forbidden claims, missing-fact conditions, and uncertainty expectations for the decisions recorded above.

**Reviewer signature or name:** _____________________________________

**Date:** ___________________________________________________________

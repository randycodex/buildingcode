# Permitext Evidence Retrieval Draft Review Packet

Retrieval implementation: `20260725-hybrid-candidates-v9`

All cases in this packet are drafts. A knowledgeable reviewer must approve, correct, or reject the expected candidate set and passage relevance before any case can become a release gate. Retrieval output is candidate evidence only and does not authorize or generate a Research answer.

Run `npm run eval:retrieval` from `permitext-sync-server` for the current free diagnostic ranks and recall. No paid model call is required.

## Known coverage gaps

- official agency interpretations outside the current library
- review, selection, and immutable attachment of integrity-addressed official maps and images
- additional existing-building scenarios beyond the current occupancy-change, repair, enlargement, and structural-trigger drafts

## Intentional scope exclusions

- Buildings Bulletins remain intentionally outside the current Research library; explicit source-boundary disclosure is retained, but Bulletin ingestion and retrieval are outside the current implementation scope.

## 1. retrieval-scissor-stair-two-exits

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: direct code question, exceptions, egress
- Source Research case: `scissor-stair-two-exits`

### Project question

Our Group R-2 building has a scissor stair with the two stair entrance doors located 15 feet apart. Can the two stairs be counted as two separate exits?

### Review intent

Tests whether the candidate set finds the governing scissor-stair rule and its R-2 exception.

### Proposed expected evidence

#### BC 1007.1.1 — section ID 2197

> Stairs sharing any common wall, floor, ceiling, scissor stair assembly, or other enclosure shall be counted as one exit stairway.

> Exceptions:

> 3. Group R-2 occupancies. In Group R-2 occupancies, where stairs are enclosed in walls having at least a 2-hour fire resistance rating and constructed of masonry or masonry equivalent in accordance with department rules: 3.1. The exit doors to such stairs shall be placed a distance apart equal to no less than 15 feet (4572 mm); and 3.2. Such stairs shall be permitted to share common walls, floors, ceilings or scissor stairs assemblies or other enclosures provided that the construction separating the stairs is also of at least a 2-hour fire-resistance rating and constructed of masonry or masonry equivalent in accordance with department rules.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 2. retrieval-single-stair-six-story-r2

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: direct code question, egress, missing project facts
- Source Research case: `single-stair-six-story-r2`

### Project question

We are designing a six-story residential building with approximately 1,950 square feet on each story. Can the building be served by one exit stair?

### Review intent

Tests one-exit discovery without treating area and story count as sufficient by themselves.

### Proposed expected evidence

#### BC 1006.3.2 — section ID 2185

> 7. Buildings of Occupancy Group R-2 of construction Type I or II not exceeding six stories and not exceeding 2,000 square feet (185.8 m 2 ) per story.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 3. retrieval-residential-multipurpose-occupancy

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: occupancy classification, multiple sections, missing project facts
- Source Research case: `residential-multipurpose-occupancy`

### Project question

A 900-net-square-foot multipurpose room in an apartment building will normally contain tables and chairs and is only for residents. Does it need to be classified as Group A-3?

### Review intent

Tests discovery across accessory-assembly classification and occupant-load provisions.

### Proposed expected evidence

#### BC 303.1.3 — section ID 132

> A room or space used for assembly purposes with an occupant load of fewer than 75 persons and accessory to another occupancy shall be classified as a Group B occupancy or as part of that occupancy, except that the number of plumbing fixtures for such a room or space is permitted to be calculated in accordance with the requirements for assembly occupancies.

#### BC 1004.1.3 — section ID 2152

> For areas without fixed seating, the occupant load shall be not less than that number determined by dividing the floor area under consideration by the occupant load factor assigned to the function of the space as set forth in Table 1004.1.3.

> Unconcentrated (tables and chairs)

> 15 net

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 4. retrieval-accessory-assembly-plumbing-fixtures

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: multiple-code question, plumbing, exceptions
- Source Research case: `accessory-assembly-plumbing-fixtures`
- Must attach a complete structured rich source for section IDs: `11909`

### Project question

If the multipurpose room is permitted to be classified as Group B because it has fewer than 75 occupants, can its required plumbing fixtures be calculated using the normal Group B fixture requirements?

### Review intent

Tests candidate completeness across Building Code classification and Plumbing Code fixture rules while requiring the complete official Table 403.1 source to accompany the proposed PC 403.1 passage.

### Proposed expected evidence

#### BC 303.1.3 — section ID 132

> A room or space used for assembly purposes with an occupant load of fewer than 75 persons and accessory to another occupancy shall be classified as a Group B occupancy or as part of that occupancy, except that the number of plumbing fixtures for such a room or space is permitted to be calculated in accordance with the requirements for assembly occupancies.

#### PC 403.1 — section ID 11909

> Plumbing fixtures shall be provided for the type of occupancy and in the minimum number shown in Table 403.1. Types of occupancies not shown in Table 403.1 shall be considered individually by the commissioner. The number of occupants shall be determined by the New York City Building Code. Occupancy classification shall be determined in accordance with the New York City Building Code.

> The number of fixtures for building or nonaccessory tenant space used for assembly purposes by fewer than 75 persons and classified as Group B occupancy in accordance with Section 303.1, Exception 2 of the New York City Building Code shall be permitted to be calculated in accordance with the requirements for Assembly occupancies.

#### PC 403.1.1 — section ID 11910

> To determine the occupant load of each sex, the total occupant load shall be divided in half. To determine the required number of fixtures, the fixture ratio or ratios for each fixture type shall be applied to the occupant load of each sex in accordance with Table 403.1. Fractional numbers resulting from applying the fixture ratios of Table 403.1 shall be rounded up to the next whole number. For calculations involving multiple occupancies, such fractional numbers for each occupancy shall first be summed and then rounded up to the next whole number. Fixture calculations in Group B office occupancies shall utilize the total occupant load on a given floor to determine the number of fixtures required for that floor.

> Exception: The total occupant load shall not be required to be divided in half where approved statistical data indicates a distribution of the sexes of other than 50 percent of each sex.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 5. retrieval-building-code-versus-hcr

- Dataset status: **DRAFT**
- Expected behavior: `insufficient-query`
- Diagnostic depth: 12
- Categories: misleading question, insufficient query context, outside current library
- Source Research case: `building-code-versus-hcr`

### Project question

Does this section prove that HCR requires a vanity in the bathroom?

### Review intent

The source question says only 'this section'; retrieval should disclose missing context and the HCR evidence boundary instead of claiming candidate authority.

### Proposed expected evidence

#### BC 1107.2.2.7.2.2 — section ID 2713

> Where only a forward approach is provided to the water closet, the clearance shall be 66 inches (1676 mm) minimum, measured perpendicular from the rear wall, and 48 inches (1220 mm) minimum, measured perpendicular from the side wall. A lavatory complying with Section 1107.2.2.5 shall be permitted on the rear wall, 18 inches (457.2 mm) minimum from the water closet centerline.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 6. retrieval-mixed-occupancy-fixture-rounding

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: multiple-code question, plumbing, mixed occupancies
- Source Research case: `nyc-001-mixed-occupancy-fixture-rounding`
- Must attach a complete structured rich source for section IDs: `11909`

### Project question

A residential-building cellar contains Group B, F, and S spaces plus a multipurpose assembly room with fewer than 75 occupants that may qualify as accessory to the residential occupancy. After the correct Table 403.1 ratio has been applied separately to each occupancy, may the resulting fractional fixture requirements be added before rounding, and may the accessory multipurpose room use Assembly fixture requirements?

### Review intent

Tests fractional-calculation and accessory-assembly candidate coverage while requiring the complete official Table 403.1 source to accompany the proposed PC 403.1 passage.

### Proposed expected evidence

#### BC 303.1.3 — section ID 132

> A room or space used for assembly purposes with an occupant load of fewer than 75 persons and accessory to another occupancy shall be classified as a Group B occupancy or as part of that occupancy, except that the number of plumbing fixtures for such a room or space is permitted to be calculated in accordance with the requirements for assembly occupancies.

#### PC 403.1 — section ID 11909

> Plumbing fixtures shall be provided for the type of occupancy and in the minimum number shown in Table 403.1 . Types of occupancies not shown in Table 403.1 shall be considered individually by the commissioner. The number of occupants shall be determined by the New York City Building Code . Occupancy classification shall be determined in accordance with the New York City Building Code .

> The number of fixtures for building or nonaccessory tenant space used for assembly purposes by fewer than 75 persons and classified as Group B occupancy in accordance with Section 303.1, Exception 2 of the New York City Building Code shall be permitted to be calculated in accordance with the requirements for Assembly occupancies.

#### PC 403.1.1 — section ID 11910

> To determine the occupant load of each sex, the total occupant load shall be divided in half. To determine the required number of fixtures, the fixture ratio or ratios for each fixture type shall be applied to the occupant load of each sex in accordance with Table 403.1 . Fractional numbers resulting from applying the fixture ratios of Table 403.1 shall be rounded up to the next whole number. For calculations involving multiple occupancies, such fractional numbers for each occupancy shall first be summed and then rounded up to the next whole number. Fixture calculations in Group B office occupancies shall utilize the total occupant load on a given floor to determine the number of fixtures required for that floor.

> Exception: The total occupant load shall not be required to be divided in half where approved statistical data indicates a distribution of the sexes of other than 50 percent of each sex.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 7. retrieval-stated-occupancy-movable-seats

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: administrative provisions, occupant load, missing project facts
- Source Research case: `nyc-002-stated-occupancy-movable-seats`

### Project question

For this 2022-code evaluation scenario, may the conference floor's occupant load be documented by counting selected movable seats, omitting lounge and break functions as nonsimultaneous, and retaining the existing 1:100 load without a commissioner-established lower basis?

### Review intent

Tests completeness across several closely related occupant-load provisions.

### Proposed expected evidence

#### BC 1004.1.2 — section ID 2151

> Where an area under consideration contains multiple functions having different occupant load factors, the design occupant load for such area shall be based on the floor area of each function calculated independently.

#### BC 1004.1.3 — section ID 2152

> For areas without fixed seating, the occupant load shall be not less than that number determined by dividing the floor area under consideration by the occupant load factor assigned to the function of the space as set forth in Table 1004.1.3.

#### BC 1004.1.3.1 — section ID 2153

> Where the actual number of occupants of any space will be significantly lower than listed in Table 1004.1.3 , the commissioner may establish a lower basis for the determination of the number of occupants.

#### BC 1004.3 — section ID 2156

> For areas having fixed seats and aisles, the occupant load shall be determined by the number of fixed seats installed therein. The occupant load for areas in which fixed seating is not installed, such as waiting spaces, shall be determined in accordance with Section 1004.1.3 and added to the number of fixed seats.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 8. retrieval-legacy-fire-alarm-enlargement

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: existing-building conditions, fire protection, multiple sections
- Source Research case: `nyc-011-legacy-fire-alarm-enlargement`

### Project question

An existing prior-code Group B building has a previously approved legacy fire-alarm system. A proposed enlargement does not change the stated use or occupancy, but the resulting Group B gross area may exceed 100,000 square feet. The height of the highest occupied floor above the lowest level of Fire Department vehicle access has not been confirmed. Does the selected 2022 Building Code evidence automatically require replacement of the entire legacy system, and what additional facts determine the required scope?

### Review intent

Tests legacy-system and enlargement candidate discovery without assuming full replacement.

### Proposed expected evidence

#### BC 901.9.1 — section ID 1550

> Additions, alterations, renovations or repairs to existing systems shall conform to that required for new systems without requiring the existing system to comply with all of the requirements of this code, except as otherwise required in Sections 901.9.2 through 901.9.6. Additions, alterations or repairs shall not cause an existing installation to become unsafe, hazardous or overloaded.

#### BC 901.9.2 — section ID 1552

> Fire protection systems governed by this chapter shall be provided:

> 1. To the entire building as if the building were hereafter erected, where a change is made in the main use or dominant occupancy of such building.

> 2. Throughout a space, where a change is made in the occupancy group classification or usage of the space.

#### BC 901.9.3 — section ID 1553

> Fire protection systems shall be provided in enlarged portions of a building and where this chapter would require such systems in new construction for a space or building.

#### BC 907.2.2.2 — section ID 1755

> Group B occupancies having a total gross area exceeding 100,000 square feet (9290.3 m 2 ) located in buildings where the highest occupied floor is 75 feet (22 860 mm) or less above the lowest level of Fire Department vehicle access shall be provided with automatic smoke detection connected to an automatic fire alarm system in accordance with Section 907.2.13.1 and an emergency voice/alarm communication system in accordance with Section 907.5.2.2 that initiates a total evacuation signal.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 9. retrieval-b-m-co-accessibility-boundary

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: administrative provisions, accessibility, outside current library
- Source Research case: `nyc-013-b-m-co-accessibility-boundary`

### Project question

A small existing establishment proposes an alteration described as a change between Group B and Group M after the 2024 zoning Use Group renumbering. Based only on the selected Building Code passages, can we conclude that the work qualifies for an exception to amending the Certificate of Occupancy, and what accessibility consequence can be stated?

### Review intent

Tests Building Code candidates while preserving the zoning and Certificate of Occupancy boundary.

### Proposed expected evidence

#### BC 1101.3 — section ID 2625

> The provisions of this chapter shall apply to alterations, including minor alterations but excluding ordinary repairs, and changes of use or occupancy to prior code buildings, portions of such buildings, and spaces within such buildings in accordance with Sections 1101.3.1 through 1101.3.5.

#### BC 1101.3.1 — section ID 2626

> Accessible features and construction governed by this chapter shall be provided:

> 2. Throughout a space, including the immediate entrance(s) thereto, where an alteration is made that is considered either: (i) a change in occupancy classification of such space in accordance with this code, or (ii) a change in the zoning use group of such space in accordance with the New York City Zoning Resolution.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 10. retrieval-sidewalk-cafe-evidence-boundary

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: accessibility, egress, agency boundary, multiple sections
- Source Research case: `nyc-015-sidewalk-cafe-evidence-boundary`

### Project question

A restaurant proposes a sidewalk café with furniture near a building exit and cellar hatch. The owner says outdoor-dining authorization allows the exterior seats to be counted separately from the interior PACO and eliminates further accessibility review. The documents do not say whether the café is beyond the building line, enclosed, or separated from the interior seating by a Section 713 fire partition. What can be concluded from the selected Building Code passages, and what remains unresolved?

### Review intent

Tests a broad candidate set whose completeness depends on several café-specific provisions.

### Proposed expected evidence

#### BC 3111.1 — section ID 5678

> Sidewalk cafes provided beyond the building line shall comply with the requirements of this section, the New York City Zoning Resolution, the Commissioners of the Department of Consumer and Worker Protection and Department of Transportation, and with the projection limitations of Chapter 32 of this code.

#### BC 3111.4 — section ID 5681

> No part of any awning, enclosure, fixture, equipment or removable platform of a sidewalk cafe shall be located:

> 2. So as to obstruct any exit from a building;

> 3. So as to obstruct any cellar access hatch or areaway;

> Exception: Upon special application, the commissioner may permit an easily removable, prominently designated platform, designed in accordance with Section 3111.5, to cover a cellar entrance or areaway that is not used as a required means of egress.

#### BC 3111.6 — section ID 5685

> Sidewalk cafes and access thereto shall comply with Chapter 11.

#### BC 1108.2.9.1 — section ID 2792

> Where dining surfaces for the consumption of food or drink are provided, at least 10 percent of the total number of seating and standing spaces, but not less than one, of each type of dining surfaces shall be accessible and be distributed throughout the facility and located on a level accessed by an accessible route.

#### BC 3111.7 — section ID 5686

> Unless separated from seating inside the building by fire partitions complying with Section 713 , the seating for enclosed sidewalk cafes shall be added to that inside the building in order to determine whether a place of assembly certificate of operation is required.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 11. retrieval-enclosed-garage-intermittent-ventilation

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: mechanical systems, enclosed parking garages, detector controls
- Source Research case: `nyc-016-enclosed-garage-intermittent-ventilation`

### Project question

An enclosed parking garage will use intermittent mechanical ventilation. The proposed controls use carbon monoxide detectors only and start the system at 35 ppm carbon monoxide. Based only on the selected Mechanical Code provision, is that control sequence compliant, and what can and cannot be concluded?

### Review intent

Tests canonical Mechanical Code 404.1 discovery and guards against the confirmed stale legacy body-ID collision.

### Proposed expected evidence

#### MC 404.1 — section ID 10442

> Where mechanical ventilation systems for enclosed parking garages operate intermittently, such operation shall be automatic by means of carbon monoxide detectors applied in conjunction with nitrogen dioxide detectors.

> Such detectors shall be installed in accordance with their manufacturers' instructions.

> Such systems shall operate automatically upon detection of a concentration of carbon monoxide of 25 parts per million (ppm) or nitrogen dioxide of 500 parts per billion (ppb).

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 12. retrieval-prior-code-floor-surface-area-110-percent

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: existing-building conditions, administrative provisions, scope changes, multiple sections
- Source Research case: `nyc-017-prior-code-floor-surface-area-110-percent`

### Project question

A prior-code building was filed as an alteration based on a 105 percent floor-surface-area increase, but scope changes during construction may raise the increase to 115 percent. Can the project remain an alteration, what happens if the threshold is crossed, and what must be included or excluded when checking the percentage?

### Review intent

Tests closely related Administrative Code candidates for the more-than-110-percent trigger, construction-scope changes, measurement exclusions, and floor-surface-area definition.

### Proposed expected evidence

#### AC 28-101.4.5 — section ID 8792

> Notwithstanding sections 28-101.4.3 and 28-102.4.3 or any other provision of this code that would authorize alterations of prior code buildings in accordance with the 1968 building code or prior codes, where the proposed work at the completion of construction will increase the amount of floor surface area of a prior code building by more than 110%, over the amount of existing floor surface area, such entire building shall be made to comply with the provisions of this code as if it were a new building hereafter erected. See section 28-105.2 for permits for such work.

> Exceptions. When determining the amount of existing floor surface area for the purposes of section 28-101.4.5 , the following shall be excluded from the measured square footage of floor surface area:

> 1. The square footage of floors removed during the course of the work when such floors are removed together with the supporting beams, joists, decking and slabs on grade.

> 2. The square footage of any floor that was installed together with the supporting beams, joists, decking and slabs on grade less than 12 months prior to submission of the application for construction document approval for the proposed work. For the purposes of this exception, floors installed pursuant to a work permit signed off less than 12 months before such submission shall not be counted as existing floor surface area.

#### AC 28-101.4.5.1 — section ID 8793

> In cases where changes in the scope of work during the course of construction would result in increasing the floor surface area at the completion of construction by more than 110 percent, over the amount of existing floor surface area as determined pursuant to section 28-101.4.5 , such entire building shall be made to comply with the provisions of this code as if hereafter erected and such work shall be refiled as a new building application in accordance with the provisions of section 28-105.2 .

> Exception: Work to the extent necessary to relieve an emergency condition may be performed prior to amending plans or obtaining a new permit pursuant to sections 28-105.4.1 and 28-105.12.2 .

#### AC 28-101.4.5.2 — section ID 8794

> As used in Section 28-101.4.5 , the following term shall have the following meaning unless the context or subject matter requires otherwise.

> FLOOR SURFACE AREA. Floor surface area is the gross square foot area of all horizontal floor and roof surfaces, including roofs of bulkheads and superstructures, of a building or structure at any level, including cellar, attic and roof.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 13. retrieval-fire-district-map-boundary

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: administrative provisions, fire districts, maps, non-text evidence
- Source Research case: `nyc-018-fire-district-map-boundary`
- Must block text-only preparation for section IDs: `6881`
- Must expose a complete integrity-addressed visual inventory while keeping preparation blocked for section IDs: `6881`
- Required coverage limitations: `visual-source-review-required`

### Project question

The project address is in Queens. Based only on the selected text from AC 28-102.4.5 and BC D106.1, can Permitext confirm that the lot is inside the fire district?

### Review intent

Tests AC-to-Appendix-D discovery and requires BC D106.1 to remain blocked from text-only preparation because the governing fire-district boundary is carried by official map images.

### Proposed expected evidence

#### AC 28-102.4.5 — section ID 8808

> The boundaries of fire districts shall be in accordance with the maps set forth in Appendix D of the New York city building code.

#### BC D106.1 — section ID 6881

> Within the boroughs of Staten Island (Richmond County) and Queens, the fire districts shall comprise such areas indicated on the "fire district maps" as per Figures D106.1(1) and D106.1(2) .

> Figure D106.1(1) Fire District Maps Borough of Staten Island (Richmond County)

> Figure D106.1(2) Fire District Maps Borough of Queens

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 14. retrieval-buildings-bulletin-policy-boundary

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: administrative provisions, Buildings Bulletin, zoning, Housing Maintenance Code, outside current library
- Source Research case: `nyc-019-buildings-bulletin-policy-boundary`
- Must disclose outside-scope authorities: NYC Buildings Bulletins, NYC Zoning Resolution Research, NYC Housing Maintenance Code
- Required coverage limitations: `outside-current-library`

### Project question

Does the current Permitext Construction Code evidence prove that a three-fixture bathroom is permitted in the cellar of this one- or two-family dwelling under Buildings Bulletin 2011-010, the Zoning Resolution, and the Housing Maintenance Code?

### Review intent

Tests retrieval of the selected illegal-conversion provision while separately disclosing that Buildings Bulletin, Zoning Resolution, and Housing Maintenance Code authority is outside the current Construction Code Research scope.

### Proposed expected evidence

#### AC 28-210.1 — section ID 9361

> It shall be unlawful, except in accordance with all requirements of this code, to convert any dwelling for occupancy by more than the legally authorized number of families or to assist, take part in, maintain or permit the maintenance of such conversion. Upon the finding of such violation and the imposition of punishment for such violation as set forth in this code the department or if applicable the environmental control board shall forward to the internal revenue service, the New York state department of taxation and finance and the New York city department of finance the name and address of the respondent or defendant, the address of the building or structure with respect to which the violation occurred and the time period during which the violation was found to have existed.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 15. retrieval-existing-plumbing-repair-boundary

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: existing-building conditions, plumbing, repairs, exceptions, scope boundaries
- Source Research case: `nyc-020-existing-plumbing-repair-boundary`

### Project question

An existing prior-code office building has a plumbing system said to have been lawfully installed before the current code. The project will replace a short corroded drain-pipe segment in the same route and arrangement. The owner calls it an ordinary repair and says the old system can remain exactly as-is. Based on PC 102.2, PC 102.4, and PC 102.4.1, must the entire existing plumbing installation be upgraded, and can the repair avoid the new-installation rules?

### Review intent

Tests the existing-installation, repair-to-new-work, and same-manner-and-arrangement candidate set without implying automatic whole-system upgrade or automatic exemption.

### Proposed expected evidence

#### PC 102.2 — section ID 11734

> Except as otherwise specifically provided, plumbing systems lawfully in existence on July 1, 2008 or on the effective date of a subsequent amendment of this code shall be permitted to have their use and maintenance continued if the use, maintenance or repair is in accordance with the original design and no hazard to life, health or property is created by such plumbing system.

#### PC 102.4 — section ID 11739

> Additions, alterations, renovations or repairs to installations shall conform to that required for new installations without requiring the existing installation to comply with all of the requirements of this code. Additions, alterations or repairs shall not cause an existing installation to become unsafe, hazardous or overloaded.

#### PC 102.4.1 — section ID 11740

> Minor additions, alterations, renovations and repairs to existing installations shall meet the provisions for new construction, unless such work is done in the same manner and arrangement as was in the existing system, is not hazardous and is approved.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 16. retrieval-prior-code-wind-surface-area-trigger

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: existing-building conditions, structural alterations, wind loads, whole-building triggers, multiple sections
- Source Research case: `nyc-021-prior-code-wind-surface-area-trigger`

### Project question

An exterior addition to a prior-code commercial building is said to increase the building's wind surface area by 6 percent in one direction. The owner says only the addition needs wind design and the existing building may remain under its prior-code wind provisions. Based on BC 1601.2.4 and AC 28-101.4.4, does the stated increase trigger whole-building wind design, and what still must be verified?

### Review intent

Tests the prior-code wind-surface-area and lateral-force-capacity exceptions together with the Administrative Code structural-safety boundary.

### Proposed expected evidence

#### BC 1601.2.4 — section ID 3422

> All alterations, minor alterations, and ordinary repairs, to the extent of such work, shall be permitted to be performed in accordance with the wind load requirements set forth in the 1968 Building Code, or where the 1968 Building Code so authorizes, the code in effect prior to December 6, 1968.

> 3. When the wind surface area of a prior code building or structure is increased by more than 5 percent in any direction or there is a permanent decrease of the lateral force capacity by more than 20 percent in any direction, the entire building or structure shall be designed to resist the design wind load as calculated pursuant to the applicable code, but not less than 5 psf (0.24 kN/m 2 ).

#### AC 28-101.4.4 — section ID 8791

> Notwithstanding any other provision of this code, where the alteration of any prior code building or structure in accordance with a provision of this code would result in a reduction of the fire safety or structural safety of such building, relevant provisions of the 1968 building code shall apply to such alteration unless there is full compliance with those provisions of this code that would mitigate or offset such reduction of fire protection or structural safety.

> Where the owner, having a choice to elect the 1968 building code or this code, chooses this code, the applicant shall submit a comparative analysis acceptable to the commissioner of the relevant fire safety and structural safety provisions under the 1968 Code and this code, demonstrating that the alteration does not result in a reduction to the fire and life safety of the building.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 17. retrieval-reestablished-prior-occupancy-boundary

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: existing-building conditions, occupancy changes, certificate of occupancy, administrative provisions, multiple sections
- Source Research case: `nyc-022-reestablished-prior-occupancy-boundary`

### Project question

A prior-code commercial building was lawfully used for storage before July 1, 2008, then changed to office occupancy under a later certificate of occupancy. The owner now wants to resume the former storage occupancy without a new filing or amended certificate, arguing that the old occupancy was once lawful. Based on AC 28-102.4, AC 28-102.4.2, AC 28-118.3.1, and AC 28-118.3.2, may the former occupancy resume automatically, and what must be established first?

### Review intent

Tests the difference between continuing a lawful existing occupancy and re-establishing a former occupancy after an intervening change, including certificate boundaries.

### Proposed expected evidence

#### AC 28-102.4 — section ID 8803

> The lawful use or occupancy of any existing building or structure, including the use of any service equipment therein, may be continued unless a retroactive change is specifically required by the provisions of this code or other applicable laws or rules.

#### AC 28-102.4.2 — section ID 8805

> Except as otherwise provided in sections 28-101.4.1 , 28-101.4.2 , 28-101.4.3 or 28-101.4.4 , changes in the use or occupancy of any building or structure made after July 1, 2008 shall comply with the provisions of this code.

> Any changes made in the use or occupancy of a building or structure not in compliance with this code shall be prohibited and shall be a violation of this code.

> After a change in use or occupancy has been made in a building, the re-establishment of a prior use or occupancy that would not be lawful in a new building of the same construction class shall be prohibited unless and until all the applicable provisions of this code and other applicable laws and rules for such reestablished use or occupancy shall have been complied with.

#### AC 28-118.3.1 — section ID 9198

> No building, open lot or portion thereof hereafter altered so as to change from one occupancy group to another, or from one zoning use group to another, either in whole or in part, shall be occupied or used unless and until the commissioner has issued a certificate of occupancy certifying that the alteration work for which the permit was issued has been completed substantially in accordance with the approved construction documents and the provisions of this code and other applicable laws and rules for the new occupancy or use.

#### AC 28-118.3.2 — section ID 9199

> No change shall be made to a building, open lot or portion thereof inconsistent with the last issued certificate of occupancy or, where applicable, inconsistent with the last issued certificate of completion for such building or open lot or which would bring it under some special provision of this code or other applicable laws or rules, unless and until the commissioner has issued a new or amended certificate of occupancy.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

## 18. retrieval-mercantile-business-co-exception

- Dataset status: **DRAFT**
- Expected behavior: `candidate-recall`
- Diagnostic depth: 12
- Categories: existing-building conditions, occupancy changes, certificate of occupancy, exceptions, fire protection, accessibility
- Source Research case: `nyc-023-mercantile-business-co-exception`
- Must disclose outside-scope authorities: NYC Zoning Resolution Research
- Required coverage limitations: `outside-current-library`

### Project question

An existing ground-floor establishment is proposed to change from a mercantile establishment and Group M occupancy to a business establishment and Group B occupancy. The applicant says both uses are within the same zoning use group, the existing and proposed occupant loads are 70 and 72 persons, the public enters directly from the exterior, and neither the required exits nor the live load stated on the existing Certificate of Occupancy will change. Accessibility and fire-protection compliance have not been documented. Based on AC 28-118.3, AC 28-118.3.1, AC 28-118.3.2, BC 901.9.2, and BC 1101.3.1, may the applicant rely on the Certificate-of-Occupancy exception now, and what still must be established?

### Review intent

Tests the complete enacted six-condition mercantile/business Certificate-of-Occupancy exception together with its fire-protection and accessibility cross-references, while requiring outside-source verification of the stated zoning-use-group fact.

### Proposed expected evidence

#### AC 28-118.3 — section ID 9197

> The provisions of sections 28-118.3.1 through 28-118.3.4 shall apply to completed buildings or open lots.

> The provisions of sections 28-118.3.1 and 28-118.3.2 shall not be interpreted to require an issuance of a new or amended certificate of occupancy for a change from a mercantile establishment to a business establishment, or from a business establishment to a mercantile establishment, provided all the following criteria are met:

> 1. Such alteration is limited to a change within the same zoning use group;

> 2. The maximum occupant load for the individual establishment, both as existing and proposed, does not exceed 74 persons based on occupant load calculations in accordance with Table 6-2 of the 1968 building code or Table 1004.1.3 of the New York city building code, as applicable;

> 3. The establishment is located on the ground floor, accessed by the public directly from the exterior of the building;

> 4. The establishment undergoing alteration complies or is made to comply with any other requirements that would be applicable to the alteration, including but not limited to accessibility, and fire protection requirements pursuant to sections 901.9.2 and 1101.3.1 of the New York city building code;

> 5. Such alteration does not require a change in the required exits. Relocation of exit doors of the same size or larger shall not constitute a change in the required exits;

> 6. Such alteration does not require a change in the live load from that stated on the existing certificate of occupancy.

#### AC 28-118.3.1 — section ID 9198

> No building, open lot or portion thereof hereafter altered so as to change from one occupancy group to another, or from one zoning use group to another, either in whole or in part, shall be occupied or used unless and until the commissioner has issued a certificate of occupancy certifying that the alteration work for which the permit was issued has been completed substantially in accordance with the approved construction documents and the provisions of this code and other applicable laws and rules for the new occupancy or use.

#### AC 28-118.3.2 — section ID 9199

> No change shall be made to a building, open lot or portion thereof inconsistent with the last issued certificate of occupancy or, where applicable, inconsistent with the last issued certificate of completion for such building or open lot or which would bring it under some special provision of this code or other applicable laws or rules, unless and until the commissioner has issued a new or amended certificate of occupancy.

#### BC 901.9.2 — section ID 1552

> Fire protection systems governed by this chapter shall be provided:

> 1. To the entire building as if the building were hereafter erected, where a change is made in the main use or dominant occupancy of such building.

> 2. Throughout a space, where a change is made in the occupancy group classification or usage of the space.

#### BC 1101.3.1 — section ID 2626

> Accessible features and construction governed by this chapter shall be provided:

> 2. Throughout a space, including the immediate entrance(s) thereto, where an alteration is made that is considered either: (i) a change in occupancy classification of such space in accordance with this code, or (ii) a change in the zoning use group of such space in accordance with the New York City Zoning Resolution.

### Knowledgeable-human decision

- [ ] Approve this candidate-set expectation as written
- [ ] Correct the expected sections or passages
- [ ] Reject this scenario as unsuitable

Reviewer:

Decision date:

Corrections or notes:

---

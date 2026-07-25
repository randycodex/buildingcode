# Permitext Evidence Retrieval Draft Review Packet

Retrieval implementation: `20260725-hybrid-candidates-v2`

All cases in this packet are drafts. A knowledgeable reviewer must approve, correct, or reject the expected candidate set and passage relevance before any case can become a release gate. Retrieval output is candidate evidence only and does not authorize or generate a Research answer.

Run `npm run eval:retrieval` from `permitext-sync-server` for the current free diagnostic ranks and recall. No paid model call is required.

## Known coverage gaps

- dedicated Buildings Bulletin retrieval
- official agency interpretations outside the current library
- tables and maps requiring non-text retrieval
- broader existing-building scenarios

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

### Project question

If the multipurpose room is permitted to be classified as Group B because it has fewer than 75 occupants, can its required plumbing fixtures be calculated using the normal Group B fixture requirements?

### Review intent

Tests candidate completeness across Building Code classification and Plumbing Code fixture rules.

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

### Project question

A residential-building cellar contains Group B, F, and S spaces plus a multipurpose assembly room with fewer than 75 occupants that may qualify as accessory to the residential occupancy. After the correct Table 403.1 ratio has been applied separately to each occupancy, may the resulting fractional fixture requirements be added before rounding, and may the accessory multipurpose room use Assembly fixture requirements?

### Review intent

Tests fractional-calculation and accessory-assembly candidate coverage.

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

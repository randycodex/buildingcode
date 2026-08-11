# Permitext Research Benchmark — 40 Distinct NYC Code Research Cases

Purpose: test Permitext Research on a second set of materially different NYC code questions.

Benchmark basis:
- 2022 New York City Construction Codes, with later enacted amendments where applicable.
- 2025 New York City Energy Conservation Code for filings subject to the code beginning March 30, 2026.
- Current NYC existing-building transition rules: the new NYC Existing Building Code does not become effective until July 17, 2027.
- Each case intentionally distinguishes governing law, project facts, assumptions, exceptions, and missing evidence.
- The Ideal answer is a benchmark for substance and reasoning, not wording that Permitext must reproduce verbatim.

Evaluation principle: Permitext should stop at the boundary of the automatically retrieved, authorized evidence package. When a required definition, table, project fact, referenced standard, or outside authority is missing, identifying that limitation is part of the correct answer.

---

## Test 01

**Q:** A fire wall separating two portions of a building terminates at the underside of a combustible roof deck. Is that permitted, and what conditions could allow the fire wall to terminate without extending above the roof?

**Ideal answer:** Not on the stated fact alone. NYC BC §706.6 generally requires a fire wall to extend through the roof to form a parapet at least 30 inches high. A combustible roof deck rules out the exceptions that expressly require noncombustible roof sheathing, deck, or slab, but it does not make termination at the underside categorically impossible. Section 706.6 Exception 1 can permit a qualifying 2-hour fire wall to terminate at the underside of the roof where the lower roof assembly and its supporting elements have at least a 1-hour rating for the required 4-foot zone, roof openings are kept at least 4 feet from the wall, and each building has at least a Class A roof covering. Permitext must retrieve the complete exception and establish every roof and supporting-construction condition before concluding that termination is permitted.

**Expected citations:**
- **Required:** NYC BC §706.6 — General fire-wall vertical continuity rule and Exception 1.
- **Conditional:** NYC BC §1505.1 and Table 1505.1 — only if the answer separately establishes the required Class A roof-covering classification.
- **Supporting:** NYC BC §202 — Definition of FIRE WALL, when distinguishing this wall from other rated wall types.

**Important qualifications:** The roof deck material, roof covering, structural framing, fire-resistance of the roof assembly, slope, parapet condition, and construction on both sides of the fire wall must be known. A fire wall is different from a fire barrier or fire partition and should not be analyzed under the wrong wall type.

**Claims Permitext must avoid:**
- A fire wall may always stop at the roof deck.
- A combustible roof automatically satisfies a fire-wall termination exception.
- Fire-barrier or fire-partition continuity rules can substitute for the fire-wall provisions.
- The condition complies without identifying the exact §706.6 exception.

---

## Test 02

**Q:** An exterior wall is located 3 feet from an interior lot line. What fire-resistance rating is required, and are unprotected window openings permitted?

**Ideal answer:** Permitext should treat the wall rating and the opening limits as two separate questions. The required exterior-wall fire-resistance rating is determined from BC Table 602 using occupancy group, construction type, and fire separation distance. At a 3-foot fire separation distance, the applicable Table 602 row must be identified rather than assuming a universal 1-hour or 2-hour rating. Window openings are then evaluated separately under BC §705.8 and the applicable opening table, including whether openings are permitted, whether they must be protected, and the maximum percentage of wall area allowed at that distance. The answer therefore requires the occupancy, construction type, correctly measured fire separation distance, sprinkler status where the opening table recognizes it, and the amount of proposed opening area. Three feet from a lot line does not by itself establish either the wall rating or that windows are permitted.

**Expected citations:**
- **Required:** NYC BC §602.1 and Table 602 — Exterior-wall rating based on construction type, occupancy, and fire separation distance.
- **Required:** NYC BC §705.8, §705.8.1, and Table 705.8 — Permitted protected and unprotected opening area.
- **Conditional:** NYC BC §705.8.2 — Opening protectives, when protected openings are proposed or required.
- **Supporting:** NYC BC §202 — Definition of FIRE SEPARATION DISTANCE.

**Important qualifications:** Fire separation distance is a defined Building Code measurement and may not always equal the designer's simple dimension to the lot line. Opening protection and allowable opening area must be checked independently from the wall rating.

**Claims Permitext must avoid:**
- Every wall 3 feet from a lot line is automatically a particular hourly rating.
- A rated exterior wall automatically permits windows.
- Opening-percentage limits can be ignored once the wall is rated.
- Fire separation distance can be measured from any convenient reference point.

---

## Test 03

**Q:** Does an exterior wall at the roof edge require a parapet, and under what conditions can the parapet be omitted?

**Ideal answer:** A parapet requirement must be evaluated from the specific exterior-wall and roof provisions rather than from building height alone. BC §705.11 regulates parapets at exterior walls and contains exceptions allowing omission where prescribed roof construction, fire-resistance, opening, and projection conditions are satisfied. If the wall is a fire wall, BC §706.6 creates a separate vertical-continuity analysis that can be more restrictive. Permitext should therefore first identify whether the wall is an ordinary exterior wall or a fire wall, then test every condition of the applicable parapet exception. A noncombustible roof or automatic sprinkler system by itself should not be treated as a universal parapet exemption.

**Expected citations:**
- **Required:** NYC BC §705.11 — Exterior-wall parapet rule and its six specific exceptions.
- **Conditional:** NYC BC §706.6 — Fire-wall vertical continuity, when the wall is a fire wall.
- **Conditional:** NYC BC §1505.1 and Table 1505.1 — Roof-covering classification, only when a claimed §705.11 exception depends on a Class A or B roof covering.
- **Supporting:** NYC BC §202 — Definitions needed to distinguish an exterior wall from a fire wall.

**Important qualifications:** Construction type, roof deck and covering, wall rating, fire separation distance, projections, roof slope, and whether the wall is a fire wall are material facts.

**Claims Permitext must avoid:**
- Every roof requires a parapet.
- Sprinklers automatically eliminate parapet requirements.
- An exterior-wall parapet exception automatically applies to a fire wall.
- Combustible roof construction is irrelevant to the exception.

---

## Test 04

**Q:** An open stair connects two adjacent Group B office floors and is intended only for convenience, not as a required exit. Must the stair be enclosed?

**Ideal answer:** Not necessarily, but calling it a convenience stair does not create an exemption. If occupants can use it as part of exit access, §1019.3 generally requires a shaft enclosure in a Group B occupancy unless one of that section's exceptions is satisfied. The most directly relevant exception permits a limited number of unenclosed exit access stairs serving only two consecutive stories where each interconnected story retains the required independent exits, at least two means of egress are available, the stories are not open to others, and remoteness complies with §1007. A separate Chapter 7 path may exist under §712.1.9 for a two-story vertical opening that is not one of the other listed applications and meets all six conditions. Permitext must identify which allowance governs; the fact that the stair is not a required exit does not by itself establish compliance.

**Expected citations:**
- **Required:** NYC BC §1019.3 — Enclosure rule and exceptions for exit access stairs in occupancies other than Groups H, I-2, and I-3.
- **Conditional:** NYC BC §712.1.9 — Two-story vertical openings, when that separate protection method is relied upon.
- **Conditional:** NYC BC §§713.1 and 713.4 — Shaft enclosure scope and rating, when enclosure is required.
- **Conditional:** NYC BC §§1006.3 and 1007.1.1 — Independent story-exit quantity and remoteness conditions, when relying on §1019.3 Exception 1.

**Important qualifications:** Confirm whether the stair is part of any required means of egress, whether it connects exactly two stories, the occupancy on both levels, sprinkler status, floor-opening geometry, and any other vertical openings nearby.

**Claims Permitext must avoid:**
- A convenience stair never requires enclosure.
- Every open stair is automatically an atrium.
- A stair that is not a required exit is exempt from Chapter 7.
- The stair complies simply because it connects only two floors.

---

## Test 05

**Q:** A four-story open volume connects a lobby with three upper floors. Can it be treated as an atrium instead of four separate shaft openings, and what major protections must be evaluated?

**Ideal answer:** Potentially. A four-story open volume can use the atrium protection method only if it meets the §202 definition of an atrium and complies with §712.1.7 and the complete §404 scheme. For a four-story atrium, §404.3 generally requires sprinklers throughout the building, §404.5 requires smoke control because the two-story exception does not apply, and §404.6 generally requires 1-hour separation from adjacent spaces subject to its stated alternatives and exceptions. Egress, fire alarm, interior finish, and other §404 requirements remain separate checks. If those requirements are not satisfied, calling the space an atrium does not excuse the vertical openings from another permitted §712 protection method or a required shaft enclosure.

**Expected citations:**
- **Required:** NYC BC §202 — Definition of ATRIUM.
- **Required:** NYC BC §712.1.7 — Atriums as a permitted vertical-opening protection method.
- **Required:** NYC BC §§404.3, 404.5, and 404.6 — Sprinkler, smoke-control, and separation requirements.
- **Conditional:** NYC BC §909 — Smoke-control design and installation, when evaluating the required system.
- **Supporting:** NYC BC §§404.4 and 404.9 — Fire alarm and exit-access-travel-distance requirements.

**Important qualifications:** An atrium is a regulated code condition, not a design label. Smoke control can require an engineered analysis and referenced standards beyond the selected paragraph.

**Claims Permitext must avoid:**
- Any multi-story lobby is an atrium.
- Sprinklers alone make an atrium compliant.
- Smoke-control requirements can be ignored if the atrium is open and visible.
- The atrium classification proves the entire vertical-opening design complies.

---

## Test 06

**Q:** Can a plumbing pipe penetrate a 2-hour shaft enclosure wall, and what protection is required at the penetration?

**Ideal answer:** Yes, but only where the pipe penetration is necessary for the purpose of the shaft and the rated construction remains protected. Sections 713.8 and 713.8.1 require shaft-enclosure penetrations to comply with §714 as fire-barrier penetrations and prohibit penetrations that are not necessary for the shaft's purpose. A through-penetration must comply with §714.3.1, ordinarily through an approved tested assembly or a firestop system tested to ASTM E 814 or UL 1479 with an F rating at least equal to the wall rating. The exact method depends on pipe material and size, wall construction, annular space, insulation, and whether the opening is a through- or membrane penetration. A metal pipe is not automatically exempt from protection.

**Expected citations:**
- **Required:** NYC BC §§713.8 and 713.8.1 — Protection and permitted purpose of shaft-enclosure penetrations.
- **Required:** NYC BC §§714.3 and 714.3.1 — Fire-resistance-rated wall and through-penetration requirements.
- **Conditional:** NYC BC §714.3.1.2 — Tested through-penetration firestop system and required F rating, when that compliance method is used.
- **Outside authority:** ASTM E 814 or UL 1479 — Test standard, only when its separately authorized text is needed beyond the enacted incorporation.

**Important qualifications:** Pipe material, diameter, annular space, wall construction, pipe insulation, and whether the penetration is through or membrane-only are needed to select the correct system.

**Claims Permitext must avoid:**
- No piping may ever penetrate a shaft enclosure.
- Metal pipe needs no firestopping.
- Any generic fire caulk is sufficient.
- A firestop detail can be selected without matching the tested wall and penetrating item.

---

## Test 07

**Q:** A supply duct passes through a 1-hour fire barrier. Is a fire damper required, or can an exception permit the duct to pass without one?

**Ideal answer:** A listed fire damper is required by the general rule in §717.5.2, but a specific exception can permit omission. For the stated 1-hour fire barrier, Exception 3 applies only where the penetration is by a ducted HVAC system, the area is other than Group H, the building is sprinklered throughout under §903.3.1.1 or §903.3.1.2, and the duct is continuous sheet steel of at least No. 26 gage from the air-handling equipment to its inlet and outlet terminals. Other §717.5.2 exceptions address a penetration tested as part of the rated assembly or an engineered smoke-control system where a damper would interfere. The stated facts do not establish an exception, so Permitext should report the general damper requirement and request the missing exception facts.

**Expected citations:**
- **Required:** NYC BC §717.5.2 — Fire-barrier damper rule and its three exceptions.
- **Conditional:** NYC BC §903.3.1.1 or §903.3.1.2 — Qualifying sprinkler system, when relying on §717.5.2 Exception 3.
- **Conditional:** NYC BC §§717.2.1 and 909 — Engineered smoke-control system, when relying on §717.5.2 Exception 2.
- **Outside authority:** NYC Mechanical Code provisions — only when separate duct-construction requirements are obtained and authorized for the claim.

**Important qualifications:** The wall's code function, rating, duct size/material, sprinkler status, smoke-control role, and any shaft condition must be known.

**Claims Permitext must avoid:**
- Every rated-wall duct penetration requires a fire damper.
- Sprinklers remove all damper requirements.
- Fire dampers and smoke dampers are interchangeable.
- The answer can be determined without identifying the rated assembly type.

---

## Test 08

**Q:** A major interior alteration is proposed in an existing Group R-2 building. Does the work automatically require sprinklers throughout the entire building, or only within the altered area?

**Ideal answer:** Neither result follows from the phrase "major interior alteration." For a prior-code building, §901.9.4 uses alteration value rather than that informal label. Under §901.9.4.1, an alteration value of at least 60 percent of the existing building value generally requires the entire building to meet Chapter 9 as if newly erected; for a building with four or more dwelling units, the whole-building threshold is 50 percent. Section 901.9.4.2 applies the Chapter 9 requirements to the altered portions when the alteration value of a space falls between 30 and 60 percent, or between 30 and 50 percent for a building with four or more dwelling units. Section 901.9.4.3 separately addresses an existing Group R-1 or R-2 space in a building with four or more dwelling units when the alteration value of that space exceeds 50 percent. Permitext must retrieve the enacted thresholds, establish the valuation denominator and dwelling-unit count, and then determine which fire-protection requirements are actually triggered; §901.9.2, §901.9.3, or a separate retroactive law may independently control if there is a change of use or enlargement.

**Expected citations:**
- **Required:** NYC BC §§901.9.4 and 901.9.4.1 through 901.9.4.3 — Value-based whole-building, altered-portion, and R-1/R-2-space triggers.
- **Conditional:** NYC BC §901.9.2 — Change-of-use or occupancy triggers, if the alteration changes use or occupancy.
- **Conditional:** NYC BC §901.9.3 — Enlargement trigger, if the project enlarges the building.
- **Conditional:** NYC Administrative Code §28-101.4.3 — Prior-code-building framework, when the building and filing qualify for it.
- **Outside authority:** Any separate retroactive sprinkler law or Fire Code requirement — only when identified, obtained, and authorized as separate governing text.

**Important qualifications:** Building occupancy, dwelling-unit count, alteration valuation/extent, existing systems, change of use, enlargement, and filing/code status are essential. For a 2026 filing, Permitext should not silently apply the future-effective NYC Existing Building Code.

**Claims Permitext must avoid:**
- Any major renovation requires sprinklers throughout the whole building.
- Sprinkler work is always limited to the work area.
- The future-effective Existing Building Code governs a 2026 alteration by default.
- Existing sprinkler conditions or retroactive laws are irrelevant.

---

## Test 09

**Q:** At what point does a proposed building require a standpipe system, and how should Permitext determine what type of standpipe is required?

**Ideal answer:** Permitext should apply §905.3 and each relevant installation trigger, not a single height or story rule. Under §905.3.1, a Class III standpipe is generally required in a building two or more stories high with at least 10,000 sf on any story; three or more stories high with at least 7,500 sf on any story; with a floor having an occupant load of at least 30 located at least 55 feet above the lowest fire-department vehicle access; or constructed under §403 with occupied floors at least 75 feet above that access level. A building occupied entirely by Group R-3 is excepted by §905.3. Other triggers in §§905.3.2 through 905.3.9 cover special conditions. The permitted class or system type then depends on the exceptions and project facts—for example, a qualifying fully sprinklered building can use the Class I alternative subject to all additional conditions in §905.3.1. Hose-connection locations are a separate §905.4 check. A building therefore can require a standpipe without being a high-rise.

**Expected citations:**
- **Required:** NYC BC §§905.3 and 905.3.1 — General exception, principal installation triggers, and Class III/Class I alternatives.
- **Conditional:** NYC BC §§905.3.2 through 905.3.9 — Special installation triggers, when the project condition matches one of them.
- **Conditional:** NYC BC §905.4 — Hose-connection locations, when the answer evaluates system layout.
- **Conditional:** NYC BC Appendix Q — NYC modifications, when the answer relies on a referenced NFPA design requirement.
- **Outside authority:** NFPA 14 — Only when its separately authorized text is needed beyond the enacted incorporation.

**Important qualifications:** Building height, highest and lowest floor elevations relative to fire-department access, occupancy, floor area, sprinkler status, and new-versus-existing condition are required facts.

**Claims Permitext must avoid:**
- Standpipes are required only after a certain number of stories.
- Every required standpipe uses the same class and system type.
- Appendix Q modifications can be ignored.
- A standpipe requirement is the same thing as a sprinkler requirement.

---

## Test 10

**Q:** Which systems in a high-rise residential building must be connected to emergency or legally required standby power?

**Ideal answer:** The answer depends materially on whether the Group R-2 high-rise is more than 125 feet high. Under §403.4.8.3.2, a Group R-2 building over 125 feet must provide standby power for fire-command-center power and lighting, smokeproof-enclosure ventilation and detection equipment, at least one elevator serving all floors or one per bank, and stair pressurization when provided. Under §403.4.8.4.2, it must provide emergency power for exit signs and egress illumination, emergency voice communications including ARCS, and electrically powered fire pumps unless the stated street-side service exception applies. A Group R-2 high-rise 125 feet or less instead falls under §403.4.8.4.3, which requires emergency power for applicable emergency voice communications and ARCS and permits batteries as the secondary source. Section 2702 governs installation of the required systems; it does not replace the load-specific triggers. Permitext must keep emergency and standby categories distinct and add other system-specific loads only when a cited provision requires them.

**Expected citations:**
- **Required:** NYC BC §403.4.8 and §§403.4.8.3.2, 403.4.8.4.2, and 403.4.8.4.3 — Group R-2 standby and emergency power loads above and at or below 125 feet.
- **Required:** NYC BC §2702.1 — Installation framework for emergency and standby power systems.
- **Conditional:** NYC BC §3003.1 — Elevator standby power, when the over-125-foot standby requirement applies.
- **Conditional:** Exact Chapter 9 or Chapter 10 provision — When the answer makes an additional fire-pump, communications, alarm, or egress-lighting claim.
- **Outside authority:** Current NYC Electrical Code, NFPA 110, or NFPA 111 — Only when electrical-system design details are evaluated from separately authorized text.

**Important qualifications:** Occupancy, actual high-rise condition, elevator arrangement, smoke-control design, fire pumps, communications systems, generator configuration and other building systems must be known. The electrical-code edition also must match the filing date.

**Claims Permitext must avoid:**
- An uncited generic list of high-rise generator loads is sufficient.
- Emergency power and legally required standby power are the same category.
- Every electrical load in a high-rise must be backed up.
- An obsolete Electrical Code can be used for a current project without an applicability basis.

---
## Test 11

**Q:** A five-story residential building has no elevator. Does the number of stories alone establish that an elevator is required?

**Ideal answer:** No. Section 1104.4 requires an accessible route to connect each accessible level and mezzanine in a multilevel building, but the route obligation depends on which levels and residential spaces are required to be accessible and whether a stated exception applies. The nonresidential 2,500-sf exception does not automatically exempt a Group R building. Permitext must apply the residential scoping provisions to the dwelling units and common- or public-use spaces, identify any exempt level, and determine whether an elevator or another code-permitted vertical route is needed. Chapter 30 governs an elevator that is provided or required, but it does not by itself create the accessibility scoping trigger. New construction versus an alteration or prior-code building is also material.

**Expected citations:**
- **Required:** NYC BC §1104.4 — Accessible routes between accessible levels and its exceptions.
- **Conditional:** NYC BC §§1107.3, 1107.4, and 1107.6 — Residential accessible-space, route, and unit scoping, as applicable to the project.
- **Supporting:** NYC BC §3001.1 — Chapter 30 scope for elevator construction and installation once an elevator is required or provided.
- **Outside authority:** ICC A117.1-2009 — Technical elevator or lift criteria, only when separately available in the authorized evidence package.

**Important qualifications:** New construction versus alteration is critical. Residential unit type, common-use spaces, elevator service area, and applicable prior-code-building provisions can change the result.

**Claims Permitext must avoid:**
- Every five-story building requires an elevator solely because it has five stories.
- Chapter 30 alone determines when vertical accessibility is required.
- A platform lift can always substitute for an elevator.
- Alteration-specific accessibility provisions are irrelevant.

---

## Test 12

**Q:** Do elevator doors opening directly onto a floor require an enclosed elevator lobby on every story?

**Ideal answer:** No. Section 3006.1.1 requires enclosed elevator lobbies in high-rise buildings where elevators open onto a fire-resistance-rated corridor and where elevators serve Group B occupancies under the section's four-story condition. It then provides specific exceptions, including the street floor under the stated sprinkler condition, elevators not required to be in a shaft, qualifying zero-clearance doors, certain floors under 2,500 sf with the required approval, Group R-2 occupied floors, qualifying hoistway pressurization, and elevators serving only open parking garages. Thus, elevator doors opening directly onto a floor do not universally require a lobby, and the stated facts are insufficient to establish whether the high-rise trigger or an exception applies. If hoistway pressurization is used instead, it must comply with §3006.1.2.

**Expected citations:**
- **Required:** NYC BC §3006.1.1 — High-rise elevator-lobby triggers and seven exceptions.
- **Conditional:** NYC BC §3006.1.2 — Hoistway pressurization, when used in lieu of a required enclosed lobby.
- **Supporting:** NYC BC §403.6.3 — High-rise cross-reference to the Chapter 30 elevator-lobby provisions.
- **Conditional:** NYC BC §§710.1 and 713.1 — Smoke-partition and shaft-enclosure construction, when the answer evaluates the proposed protection assembly.

**Important qualifications:** Number of stories connected, building height, occupancy, sprinkler status, elevator type, and whether the floor is at the level of exit discharge are relevant.

**Claims Permitext must avoid:**
- Every elevator requires an enclosed lobby on every floor.
- Sprinklers automatically eliminate hoistway opening protection.
- Smoke curtains, lobbies and rated doors are automatically equivalent solutions.
- High-rise-specific elevator provisions can be ignored.

---

## Test 13

**Q:** What structural live load should be used for a residential community room used for meetings, parties, and classes?

**Ideal answer:** For the described ordinary community-room uses with movable seating, Table 1607.1 assigns the assembly-area "movable seats" category a minimum uniformly distributed live load of 100 psf. The room's location in an R-2 building does not make the dwelling-unit load applicable. If seats are fixed, the table lists 60 psf; a private assembly space such as a conference room is listed at 50 psf; stage floors are 150 psf; and other assembly spaces are 100 psf. Permitext must retrieve the complete table, identify the actual configuration and permitted uses, and design for the controlling applicable category rather than choosing the lowest plausible value. Any concentrated load or unusually heavy activity must also be evaluated separately.

**Expected citations:**
- **Required:** NYC BC §1607.1 and Table 1607.1 — Assembly-area live-load categories and values.
- **Conditional:** NYC BC §1603.1.1 — Documentation of floor live loads, when the answer addresses construction-document requirements.
- **Conditional:** A legally enforceable use restriction — Only when relied upon to exclude a more demanding permitted use.

**Important qualifications:** Furniture layout, fixed versus movable seating, standing events, storage, stage areas, exercise activities and any posted/use restrictions can change the controlling load.

**Claims Permitext must avoid:**
- The dwelling-unit live load applies because the room is in an R-2 building.
- Chapter 10 occupant-load factors are structural live loads.
- Typical attendance determines structural live load.
- The lowest plausible table category should be used for a multipurpose room.

---

## Test 14

**Q:** An existing office floor is being converted to dense file storage without changing columns or beams. Does the project require structural evaluation even though no structural construction is proposed?

**Ideal answer:** Yes. The proposed use changes the imposed load even if no beam or column is physically altered. Section 1604.2 requires the building and its parts to support the applicable loads safely, and §1607.1/Table 1607.1 requires the live load to follow the actual occupancy or use. The table specifically warns that office file and computer rooms must be designed for heavier loads based on anticipated occupancy; dense filing or shelving can also require a storage category and concentrated-load analysis. Permitext must compare the proposed uniformly distributed and concentrated loads with the existing floor and supporting-member capacity. If this is a prior-code building and structural work or calculations are undertaken, §1601.2 and the applicable Administrative Code framework determine which load provisions and calculation methods may be used. No structural construction does not equal no structural consequence.

**Expected citations:**
- **Required:** NYC BC §1604.2 — Structural strength under applicable loads.
- **Required:** NYC BC §1607.1 and Table 1607.1 — Office file-room, storage, and concentrated-load requirements.
- **Conditional:** NYC BC §§1601.2 and 1601.2.2 — Prior-code structural work and live-load calculations, when that framework applies.
- **Conditional:** NYC Administrative Code §28-101.4.3 — Optional prior-code alteration framework, when the building and filing qualify.

**Important qualifications:** Existing structural drawings, original design loads, field conditions, storage layout, shelving system and concentrated loads are needed. A structural engineer may need to establish capacity from more than the code table alone.

**Claims Permitext must avoid:**
- No structural review is needed because no beams are being modified.
- Office live load can be used for dense file storage.
- Existing capacity can be assumed from building age or construction material.
- Concentrated loads from shelving systems are irrelevant.

---

## Test 15

**Q:** A roof terrace guard is 42 inches high and uses horizontal rails. Does it comply with the NYC Building Code?

**Ideal answer:** The 42-inch height addresses only one part of the guard requirements. BC §1015.3 generally requires a 42-inch minimum measured from the prescribed adjacent walking surface or other reference point, while §1015.4 regulates openings and §1607.8.1 regulates structural loading. Permitext should automatically retrieve those provisions and ask for the roof use, fall height, measurement condition, openings and support design that are still missing. The local 2022 NYC Building Code text does not establish a general prohibition on horizontal guard rails, so rail orientation alone should not be called compliant or noncompliant. The defensible conclusion is that 42 inches can satisfy the general height criterion, but full compliance is not established by height and rail orientation alone.

**Expected citations:**
- **Required:** NYC BC §1015.3 — Guard height.
- **Required:** NYC BC §1015.4 — Opening limitations.
- **Required:** NYC BC §1607.8.1 — Handrail and guard loads.
- **Conditional:** Any occupancy- or location-specific guard provision that the project facts trigger.

**Important qualifications:** Roof use, occupancy, fall height, measurement point, opening dimensions, attachment capacity and any special occupancy conditions are material.

**Claims Permitext must avoid:**
- A 42-inch guard automatically complies.
- Horizontal rails are automatically prohibited without a supporting NYC provision.
- Guard opening limitations can be ignored.
- Structural design loads are irrelevant once the geometry complies.

---

## Test 16

**Q:** Does a typical interior exit stair require handrails on both sides, and may one handrail stop at an intermediate landing?

**Ideal answer:** BC §1011 requires stairways to have handrails in accordance with §1014, and the ordinary condition is handrails on both sides unless a specific exception applies. Handrail continuity is a separate requirement: the gripping surface generally must be continuous along the required flight and must extend, return or transition in the manner prescribed at landings and terminations. Whether one handrail can stop at an intermediate landing therefore depends on the actual stair configuration and the §1014 continuity/extension rules; the existence of a landing is not by itself permission to discontinue a required handrail. Permitext should automatically retrieve the exact exceptions and verify height, clearance, graspability, extensions and any intermediate-handrail requirements from the supplied stair facts.

**Expected citations:**
- **Required:** NYC BC §1011.11 — Stairway handrails on each side, including stated exceptions.
- **Required:** NYC BC §1014.4 — Continuity of handrail gripping surfaces.
- **Required:** NYC BC §1014.6 — Handrail extensions and terminations.
- **Conditional:** NYC BC §§1014.2, 1014.3 and 1014.5 — Height, graspability and clearance where those dimensions are at issue.

**Important qualifications:** Stair width, occupancy, switchback configuration, intermediate handrails, accessible design and dwelling-unit exceptions can change the result.

**Claims Permitext must avoid:**
- One handrail is always enough.
- An intermediate landing automatically permits a required handrail to terminate.
- Handrail height is the only applicable requirement.
- Dwelling-unit or other specific exceptions apply to every stair.

---

## Test 17

**Q:** If a roof is designed for occupants as a terrace, does the occupied roof automatically count as another story above grade plane?

**Ideal answer:** No. An occupied roof and a story above grade plane are separate code concepts. The definition of story in BC §202 and the height-and-area provisions in Chapter 5 determine whether a level is a story, while occupied roofs are regulated through specific occupancy, egress, accessibility, structural and fire-protection provisions. An open occupied roof without an enclosing story generally does not become an additional story solely because people use it. Rooftop structures, penthouses and enclosed rooms must be analyzed separately, and Chapter 5 can cause rooftop structures to affect building height or story treatment when their aggregate area or configuration exceeds the permitted exception. Permitext should automatically retrieve the applicable provisions and answer both questions separately: whether the roof is occupiable and what regulations follow, and whether any rooftop enclosure creates an additional story.

**Expected citations:**
- **Required:** NYC BC §202 — Definitions of STORY and STORY ABOVE GRADE PLANE.
- **Required:** NYC BC §504.3 — Treatment of qualifying rooftop structures, including the aggregate-area condition.
- **Conditional:** NYC BC §1510 — Requirements for the particular rooftop structure or enclosure.
- **Supporting:** Applicable NYC BC Chapter 5 height and story limits after occupancy, construction type and rooftop configuration are known.

**Important qualifications:** Enclosed rooftop rooms, bulkheads, penthouses, equipment enclosures and aggregate rooftop-structure area must be identified. Egress and accessibility can apply even when the roof is not a story.

**Claims Permitext must avoid:**
- Every occupied roof is automatically another story.
- An occupied roof has no egress/accessibility requirements because it is not a story.
- Rooftop enclosures can be ignored.
- Zoning treatment controls the Building Code story determination.

---

## Test 18

**Q:** An interior residential bathroom has no exterior window. Does it require mechanical exhaust, and where may that exhaust terminate?

**Ideal answer:** Yes, absent a qualifying natural-ventilation opening, a residential bathroom must use the Mechanical Code path. BC §1203.5.1.3 permits natural ventilation for Group R and I-1 bathrooms and toilet rooms but requires ventilation in accordance with the Mechanical Code where natural ventilation is not provided; §1203.5.2 also directs contaminant-source exhaust to that code. Permitext should automatically retrieve the applicable MC §403/Table 403.3.1.1 exhaust rate after determining the residential building type, and then apply MC §§501.3 and 501.3.1: exhaust must discharge outdoors and comply with the applicable outlet-separation rules. It cannot terminate in an attic, crawl space, ceiling cavity, corridor or another interior room.

**Expected citations:**
- **Required:** NYC BC §§1203.5.1.3 and 1203.5.2 — Bathroom/toilet-room ventilation and contaminant-source exhaust.
- **Required:** NYC MC §403.3 and Table 403.3.1.1 — Applicable local exhaust path and rate.
- **Required:** NYC MC §§501.3 and 501.3.1 — Outdoor discharge and outlet location.
- **Conditional:** Other MC §403 system-airflow provisions when the building falls within their stated scope.

**Important qualifications:** Bathroom versus toilet-room classification, residential building type, intermittent versus continuous exhaust, duct route and termination location must be established.

**Claims Permitext must avoid:**
- An interior bathroom can rely on transfer air without required exhaust.
- Exhaust can terminate in any shaft or ceiling cavity.
- A generic CFM value applies without the controlling table.
- Exhaust-outlet separation requirements are optional.

---

## Test 19

**Q:** A gas-fired appliance is located in a small mechanical room. Can the appliance obtain all required combustion air from the room itself?

**Ideal answer:** Only if the room and any qualifying communicating spaces satisfy the Fuel Gas Code indoor-combustion-air method. MC §701.1 expressly excludes gas-fired appliances from Mechanical Code Chapter 7 and directs them to the NYC Fuel Gas Code. Under FGC §§304.1 and 304.5, Permitext must retrieve the applicable method and ask for appliance type, combined input rating, room and communicating-space volumes, building air-tightness and opening details. If the indoor method is unavailable or its volume/opening criteria are not met, an outdoor-air, combination-air or mechanical-air method under the applicable §§304.6 through 304.9 is required. A louver of unspecified free area or a statement that the room is "large enough" is not the calculation.

**Expected citations:**
- **Required:** NYC FGC §304.1 — General combustion-air method selection.
- **Required:** NYC FGC §304.5 — Indoor combustion air, including volume and communicating-space criteria.
- **Conditional:** NYC FGC §§304.6 through 304.9 — Outdoor, combination or mechanical combustion-air methods used by the design.
- **Supporting:** NYC MC §701.1 — Gas-fired appliances are governed by the Fuel Gas Code rather than MC Chapter 7.
- **Outside authority:** Manufacturer installation instructions, only where the enacted code makes them applicable.

**Important qualifications:** Appliance input ratings, room/communicating-space volume, exhaust equipment, air leakage, louvers/openings and appliance category are required facts.

**Claims Permitext must avoid:**
- A mechanical room automatically supplies enough combustion air.
- Room floor area alone proves adequate combustion air.
- Exhaust systems that can depressurize the room are irrelevant.
- A louver of unspecified size solves the problem automatically.

---

## Test 20

**Q:** A mixed-use floor contains a restaurant, retail space, and office area. How should the required number of water closets and lavatories be calculated?

**Ideal answer:** Permitext should calculate plumbing fixtures by occupancy/use rather than apply one ratio to the entire floor. PC §403.1 and Table 403.1 establish different minimums for the restaurant, mercantile and business portions, using occupant loads determined under BC §1004.1.2 and Table 1004.1.3. PC §403.1.1 then governs sex distribution, fractional calculations, summing and rounding; §403.3 governs employee/public facilities and whether they are separate or combined. Permitext should automatically retrieve the relevant table rows and notes, calculate each use transparently, and ask for occupant loads, tenant/access arrangements and operating conditions that remain missing. Fixtures may serve multiple uses only where the access, location and availability provisions permit it.

**Expected citations:**
- **Required:** NYC PC §403.1 and Table 403.1 — Minimum fixtures by occupancy and use.
- **Required:** NYC PC §403.1.1 — Fixture calculations, sex distribution, fractions and rounding.
- **Required:** NYC PC §403.3 — Employee and public toilet facilities.
- **Required:** NYC BC §1004.1.2 and Table 1004.1.3 — Separate occupant-load calculations for each function and the applicable occupant-load factors.
- **Conditional:** NYC PC §§403.2, 403.3.1 and 403.3.3 through 403.6 — Configuration, access, location and other project-specific conditions.

**Important qualifications:** Occupant load by use, separate-tenant status, employee/public access, shared-facility travel and operating arrangements are material facts.

**Claims Permitext must avoid:**
- One fixture ratio applies to the entire mixed-use floor.
- Actual employee counts replace Building Code occupant loads where the table uses code occupant load.
- Separate tenants can always pool fixtures.
- Table 403.1 notes and rounding rules can be ignored.

---
## Test 21

**Q:** Can a single-occupant, all-gender toilet room be counted toward the required plumbing fixture total for occupants of any sex?

**Ideal answer:** Yes. Under PC §403.1.3, fixtures in a single-occupant toilet room count toward the required fixtures for either male or female occupants. PC §403.2.2 requires every single-occupant toilet room to be available for use by persons of any sex and makes clear that this does not increase the total number of fixtures required. Permitext should automatically retrieve those provisions, count only the fixtures actually installed, and then verify Table 403.1, signage under §403.4, accessibility and access/location requirements. A single water closet does not count as two fixtures merely because any sex may use it.

**Expected citations:**
- **Required:** NYC PC §403.1.3 — Counting single-occupant toilet-room fixtures for either sex.
- **Required:** NYC PC §403.2.2 — Single-occupant toilet rooms available to persons of any sex without increasing the fixture total.
- **Required:** NYC PC §403.1 and Table 403.1 — Required fixture total.
- **Supporting:** NYC PC §403.4 — Signage.
- **Conditional:** NYC BC Chapter 11 and PC access/location provisions applicable to the room.

**Important qualifications:** Whether the room contains required or additional fixtures, its water closet/lavatory contents, occupancy type, accessibility, and public/employee use must be established.

**Claims Permitext must avoid:**
- All fixture calculations must be divided into traditional male/female toilet rooms.
- One water closet counts as two fixtures because all sexes can use it.
- Accessibility and lavatory requirements are irrelevant to fixture counting.
- Pre-2022 NYC toilet-room rules can be used without checking applicability.

---

## Test 22

**Q:** Can bottled water, a refrigerator water dispenser, or a freestanding water cooler substitute for required drinking fountains?

**Ideal answer:** Bottled water cannot substitute for a required drinking fountain. PC §410.3 permits no more than 50 percent of the required drinking fountains in occupancies other than restaurants to be replaced by a dedicated plumbing fixture with a bottle-filling faucet located adjacent to or readily visible from the remaining fountain; it expressly rejects bottled-water dispensers as substitutes. A refrigerator dispenser or freestanding cooler counts only if it is a code-compliant dedicated plumbing fixture satisfying §410.3, not merely because it dispenses water. Permitext should first retrieve Table 403.1 and §§410.1 through 410.3 to determine whether a fountain is required, including the small-occupant-load and restaurant exceptions, and then verify accessibility and location.

**Expected citations:**
- **Required:** NYC PC Table 403.1 — Drinking-fountain quantity by occupancy.
- **Required:** NYC PC §§410.1 through 410.3 — Fixture requirements, exceptions and limited bottle-filling substitution.
- **Supporting:** NYC PC §403.5 — Location of required drinking fountains.
- **Conditional:** NYC BC Chapter 11 — Accessibility requirements for the installed fixture or dispenser.

**Important qualifications:** Occupancy, occupant load, public/employee use, number of required drinking fountains and the proposed alternative must be known.

**Claims Permitext must avoid:**
- Bottled water always satisfies a Plumbing Code drinking-fountain requirement.
- Any refrigerator dispenser automatically counts as a required fixture.
- Accessibility requirements can be ignored when a dispenser is substituted.
- Permitext should assume a fountain is required without checking Table 403.1 and its notes.

---

## Test 23

**Q:** A commercial building filed in August 2026 is replacing all windows on one façade. Does the project use the 2020 or 2025 NYCECC, and does replacing the windows trigger energy requirements for the entire façade?

**Ideal answer:** A complete new application for construction-document approval submitted in August 2026 uses the 2025 NYCECC. DOB Buildings Bulletin 2026-005 and current DOB guidance make March 30, 2026 the controlling filing transition, subject to the bulletin's completeness, prior-project and material-change rules. For the described scope, Chapter C5 applies: C503.2.2.1 requires replacement fenestration products, including sash and glazing, to meet the applicable U-factor and SHGC requirements in Table C402.5. Replacing all windows does not by itself require untouched opaque portions of the façade or the entire building envelope to be upgraded. Permitext should automatically retrieve the transition guidance and enacted provisions, distinguish replacement fenestration from added fenestration and opaque-wall alteration, and ask whether the August filing is genuinely complete and whether other façade components are altered.

**Expected citations:**
- **Required:** 2025 NYCECC §§C503.2.2 and C503.2.2.1 — Vertical and replacement fenestration.
- **Required:** 2025 NYCECC Table C402.5 — U-factor and SHGC limits for the replacement products.
- **Outside authority:** NYC DOB Buildings Bulletin 2026-005 — Filing transition, completeness and prior-project rules.
- **Supporting:** Current NYC DOB 2025 NYCECC service guidance confirming March 30, 2026 applicability.
- **Conditional:** 2025 NYCECC §C503.2.4 — Above-grade wall alterations, only if the opaque wall scope triggers it.

**Important qualifications:** Filing date, application completeness, compliance path, and exact scope are essential. Glass-only replacement, full window replacement and full exterior-wall/fenestration replacement can be treated differently.

**Claims Permitext must avoid:**
- The 2020 NYCECC automatically applies to a new August 2026 filing.
- Replacing windows automatically forces the entire building envelope to be upgraded.
- Glass-only repair and full fenestration replacement are identical scopes.
- Energy-code transition rules are irrelevant once construction has begun.

---

## Test 24

**Q:** A proposed exterior wall has enough cavity insulation that the total nominal R-values appear to exceed the code target, but it has less continuous insulation than the prescriptive table calls for. Can the cavity and continuous insulation R-values simply be added together to prove compliance?

**Ideal answer:** Not under the prescriptive R-value method where the table separately requires cavity insulation and continuous insulation. The 2025 NYCECC distinguishes the two components, and §C402.1.3.1 expressly allows multiple cavity layers to be summed with cavity layers and multiple continuous layers with continuous layers, while prohibiting cavity-insulation R-values from satisfying the table's continuous-insulation requirement. Permitext should automatically retrieve the applicable wall row and then determine whether the project is using the R-value method, U-factor method, component-performance method or another permitted compliance path before concluding that the wall fails.

**Expected citations:**
- **Required:** 2025 NYCECC §C402.1.3 — Insulation-component R-value method.
- **Required:** 2025 NYCECC §C402.1.3.1 — Multi-layer rules and prohibition on using cavity R-value for a continuous-insulation requirement.
- **Required:** 2025 NYCECC Table C402.1.3, especially footnote h — Separate cavity (`ca`) and continuous (`ci`) values.
- **Conditional:** 2025 NYCECC §§C402.1.2, C402.1.4 or other approved alternate compliance provisions if a non-R-value path is proposed.

**Important qualifications:** Wall construction class, framing type, cavity depth, insulation values, thermal bridges, compliance path and new-versus-alteration scope all matter.

**Claims Permitext must avoid:**
- Cavity and continuous insulation R-values can always be added to meet a separate "ci" requirement.
- Nominal insulation R-value equals whole-wall U-factor performance.
- The wall is necessarily noncompliant before a valid alternate compliance path is checked.
- 2020 NYCECC values should be used for a 2026 filing governed by the 2025 code.

---

## Test 25

**Q:** A new rainscreen exterior wall system is being installed. Does it require special inspection, and how should Permitext determine which inspection category applies?

**Ideal answer:** Permitext should not infer one universal special-inspection requirement from the word "rainscreen." It should automatically retrieve the component-specific provisions after identifying the cladding, support/anchorage, backup wall, insulation, air/water barrier, fireblocking, combustibility and building height. BC §1705.16 requires special inspection for combustible exterior wall coverings on buildings more than 15 feet high, subject to its exceptions. BC §1705.20 requires special inspection of wall panels, curtain walls and veneers—and their anchorage—throughout buildings where any portion is more than 40 feet above grade, also subject to exceptions. Other §1705 or Chapter 14 categories may apply to the actual materials and assembly; more than one category can apply.

**Expected citations:**
- **Required:** NYC BC §1704.1 — Administration and responsibilities for required inspections and tests.
- **Conditional:** NYC BC §1705.16 — Combustible exterior wall coverings, when the material and height threshold apply.
- **Conditional:** NYC BC §1705.20 — Wall panels, curtain walls, veneers and anchorage, when the height threshold applies.
- **Conditional:** Applicable NYC BC Chapter 14 and other §1705 provisions triggered by the actual assembly.
- **Outside authority:** 1 RCNY §101-06 — Special-inspection agency and category requirements, when separately retrieved.

**Important qualifications:** Material type, attachment system, building height, delegated structural design, combustible components, tested wall assembly and air/water barrier scope are necessary.

**Claims Permitext must avoid:**
- Every rainscreen system uses one universal special-inspection category.
- A proprietary/listed product eliminates required field inspections.
- Product certification is a substitute for required special inspection.
- Structural anchors, fireblocking and weather-barrier inspections can be ignored because the cladding is nonstructural.

---

## Test 26

**Q:** An enclosed parking garage has carbon monoxide detectors that can activate exhaust fans. Does that eliminate the requirement for mechanical ventilation?

**Ideal answer:** No. MC §404.1 requires mechanical ventilation for enclosed parking garages and permits intermittent operation only when it is automatically controlled by both carbon-monoxide and nitrogen-dioxide detectors. Under §404.2, an automatically controlled system still must have the prescribed ventilation capacity and may not reduce airflow below the stated minimum while the garage is occupied. Permitext should automatically retrieve §404, identify whether the garage is actually enclosed, and ask for floor area, vehicle use, detector type/layout, thresholds, control sequence and discharge location. CO detection controls the fans; it does not replace them, and CO-only detection does not satisfy the stated CO-and-NO2 control condition.

**Expected citations:**
- **Required:** NYC MC §404.1 — Enclosed-garage mechanical ventilation and automatic CO/NO2 control.
- **Required:** NYC MC §404.2 — Minimum ventilation and system-capacity requirements.
- **Conditional:** NYC MC Chapter 5 discharge provisions applicable to the exhaust outlet.

**Important qualifications:** Garage type, degree of openness, floor area, vehicle use, design ventilation rate, fan controls, detector layout and discharge location are required.

**Claims Permitext must avoid:**
- CO detectors replace exhaust fans.
- An enclosed garage can rely on natural ventilation merely because sensors are installed.
- Sensor presence alone proves code compliance.
- Minimum ventilation and system-capacity requirements can be ignored when demand control is used.

---

## Test 27

**Q:** A new parking garage has 80 parking spaces. What electric-vehicle infrastructure must be provided?

**Ideal answer:** Assuming this is a new enclosed parking garage and none of the stated §406.4.10 exceptions or adjustment provisions applies, at least 20 percent of 80 spaces—16 spaces—must be equipped with Level 2 charging stations, and at least 60 percent—48 spaces—must be capable of supporting EVSE. BC §406.4.10 also governs how direct-current fast chargers may be credited and permits an electric-vehicle load-management system within the stated limits. Permitext should automatically retrieve the current enacted subsection, show the arithmetic, and ask whether the facility is instead an open parking lot, uses a qualifying parking system, or falls within another exception. Electrical and mechanical coordination applies to the installed system; existing-facility retrofit provisions are not the controlling basis for this new-garage answer.

**Expected citations:**
- **Required:** NYC BC §406.4.10 — EVSE for new parking garages, including the 20-percent installed and 60-percent capable requirements.
- **Conditional:** NYC BC §406.9.8 — Use instead if the project is an open parking lot.
- **Conditional:** NYC Administrative Code §28-315 — Existing-facility retrofit or phase-in provisions only if the facility is not new.
- **Outside authority:** 2025 NYC Electrical Code Article 625 — Electrical installation requirements for EV power-transfer systems.
- **Supporting:** NYC Mechanical Code provisions referenced by BC §406.4.10 for appurtenant ventilation work.

**Important qualifications:** New versus existing facility, garage versus open lot, occupancy, filing date, electrical service, number of spaces and statutory phase-in requirements must be confirmed.

**Claims Permitext must avoid:**
- A historical EV percentage can be used without checking current amendments.
- Existing-building retrofit deadlines are the only requirements for a new garage.
- Electrical Code coordination is unnecessary.
- All 80 spaces must have chargers installed unless the current enacted provisions actually require that.

---

## Test 28

**Q:** A proposed cellar in a flood hazard area is below the design flood elevation. Can dwelling space, electrical equipment, and mechanical equipment be located there?

**Ideal answer:** Permitext should not issue one blanket yes/no for all three uses. NYC BC Appendix G regulates flood-resistant construction and distinguishes occupancies, enclosed areas, building systems, utilities and equipment based on flood zone, design flood elevation, building category and permitted below-design-flood-elevation uses. Dwelling or habitable occupancy below the required elevation can be prohibited or severely restricted, while building systems may require elevation, floodproofing, isolation, anchorage or other protection. Electrical and mechanical systems also have discipline-specific flood requirements. The correct answer must establish the flood zone and design flood elevation, classify the building/use, and then evaluate the dwelling use, electrical equipment and mechanical equipment separately.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §§G301.1-G301.2, the applicable zone-specific provision in §§G304.1-G304.4, and §G501.1.
- **Conditional — governing/enacted:** The specific NYC Mechanical, Plumbing, Fuel Gas, or Electrical Code flood-protection provision for each item of equipment; any Administrative Code provision that independently governs the proposed cellar use.
- **Supporting — noncontrolling:** Current official DOB/FEMA flood guidance may explain maps or terminology but cannot replace Appendix G or incorporated ASCE 24.
- **Outside authority / unavailable:** The specific incorporated and NYC-amended ASCE 24 provisions actually used, unless their text is separately retrieved from an authorized source.
- **Outside authority / unavailable:** A site-specific flood-zone determination, design flood elevation, equipment schedule, or professional flood-design conclusion not stated in the text facts.

**Important qualifications:** Flood zone, design flood elevation, cellar/basement status, lowest floor, occupancy, building category and exact equipment are essential.

**Claims Permitext must avoid:**
- Nothing can ever be located below the design flood elevation.
- Equipment is automatically acceptable on a housekeeping pad.
- FEMA terminology can replace the NYC Appendix G analysis.
- Dwelling occupancy and mechanical equipment are governed by the same flood rule.

---

## Test 29

**Q:** Are emergency escape and rescue openings required from bedrooms in a new Group R-2 apartment building?

**Ideal answer:** Permitext should not automatically import a one- and two-family bedroom-window rule into every R-2 apartment. Emergency escape and rescue opening requirements are governed by BC §1030, including its occupancy, story, sprinkler and building-type limitations. Permitext must determine whether the new R-2 dwelling units fall within §1030.1 and whether an exception applies. If EEROs are required, §§1030.2 through 1030.5 govern size, dimensions, sill height, operation and window wells. Bedroom light and ventilation requirements are a different code question and should not be used as a substitute for the EERO analysis.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §1030.1 and any exception applied.
- **Conditional — governing/enacted:** NYC BC §§1030.2-1030.5 when an opening is required; the specific Chapter 12 light/ventilation provision only if that separate issue is answered.
- **Supporting — noncontrolling:** None expected for the threshold code answer.
- **Outside authority / unavailable:** Residential Code provisions unless an independently applicable legal basis is established; unstated window dimensions or story/sprinkler facts.

**Important qualifications:** Story location, sprinkler status, dwelling configuration, below-grade conditions and the NYC amendments to §1030 must be established.

**Claims Permitext must avoid:**
- Every R-2 bedroom must have an emergency escape window.
- Sprinklers always eliminate EERO requirements.
- A window that satisfies light and ventilation automatically satisfies EERO requirements.
- Residential Code rules can be directly applied to an R-2 building without a NYC Building Code basis.

---

## Test 30

**Q:** The code requires a smoke separation around a space. Does that automatically mean a 1-hour smoke barrier is required?

**Ideal answer:** No. A smoke barrier and a smoke partition are distinct assemblies with different construction, continuity, opening, leakage and rating requirements. BC §709.1 regulates smoke barriers and §709.3 generally assigns fire-resistance requirements unless another section modifies them; BC §710.1 regulates smoke partitions and §710.3 does not automatically impose the same hourly rating. The scoping provision for the specific occupancy or space determines which assembly is required. Permitext should trace the requirement back to the section that calls for the separation, identify whether it expressly requires a smoke barrier, smoke partition or another assembly, and then apply the corresponding Chapter 7 requirements. The generic phrase "smoke separation" is not sufficient to infer a 1-hour wall.

**Citation expectations:**
- **Required — governing/enacted:** The occupancy or special-use scoping provision, plus NYC BC §§709.1 and 709.3 if it requires a smoke barrier or §§710.1 and 710.3 if it requires a smoke partition.
- **Conditional — governing/enacted:** NYC BC §§716 and 717 for regulated openings, penetrations, ducts, and air-transfer openings.
- **Supporting — noncontrolling:** None expected; a drawing wall-type note is project evidence, not legal authority.
- **Outside authority / unavailable:** A one-hour conclusion when the text facts do not identify the scoping provision or assembly type.

**Important qualifications:** The exact scoping language is outcome-determinative. Special occupancies can modify rating, continuity, door, leakage or damper requirements.

**Claims Permitext must avoid:**
- Smoke barriers and smoke partitions are interchangeable terms.
- Every smoke separation is 1-hour rated.
- A drawing note controls over the governing code section.
- Openings and ducts can be ignored once the wall type is identified.

---
## Test 31

**Q:** A 2-hour horizontal assembly separates occupancies between two floors. Must all columns and walls supporting that assembly below also be 2-hour rated?

**Ideal answer:** BC §711.2.3 generally requires the construction that actually supports a horizontal assembly to be protected for the assembly's required fire-resistance rating. For a two-hour assembly, that ordinarily means two-hour protection for the supporting construction in its load path, but it does not make every column or wall below the floor a support by assumption. The listed §711.2.3 exceptions are narrow and do not provide a general exception for a two-hour occupancy separation. Permitext should identify why the assembly is required, trace the structural support path from the supplied text facts, apply §711.2.3 and the specific separation provision, and then check Table 601 or a special method such as §510 for additional or different requirements.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §711.2.3 (supporting construction), §711.2.4 and the provision requiring the particular two-hour horizontal separation.
- **Conditional — governing/enacted:** NYC BC Table 601 for construction-type ratings; §510 or another special horizontal-separation method only when the design invokes it; the exceptions in §711.2.3 only when their facts are met.
- **Supporting — noncontrolling:** None expected.
- **Outside authority / unavailable:** The actual load path, construction type, and design method unless supplied as text facts.

**Important qualifications:** The purpose of the assembly, construction type, occupancy above/below, structural support path and any special building-separation method must be identified.

**Claims Permitext must avoid:**
- Every support below a 2-hour floor must automatically be 2-hour rated.
- Table 601 can be ignored because the floor is rated.
- A podium or horizontal building separation is the same as an ordinary rated floor.
- Supporting construction can be declared unrated without tracing the specific horizontal-assembly rule.

---

## Test 32

**Q:** Where is fireblocking required in a combustible exterior wall or concealed wall assembly?

**Ideal answer:** Fireblocking is required at the concealed-space locations identified by BC §718 rather than at an arbitrary universal spacing. Permitext should identify the wall construction and concealed cavities, then evaluate required fireblocking at floor/ceiling levels, wall intersections, soffits, openings, concealed vertical-to-horizontal transitions and other locations specifically listed by §718. NYC Buildings Bulletin 2022-013 provides additional clarification for combustible wall assemblies and should be included where its condition applies. The fireblocking material itself must also be permitted by the code and installed so that it effectively cuts off concealed draft openings. If the exterior wall is a proprietary tested assembly, Permitext should reconcile the tested/listed details with the prescriptive fireblocking requirements rather than assume one automatically replaces the other.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §§718.2.6, 718.2.6.1, 718.2.6.1.1 and 718.2.6.1.2 for combustible exterior wall coverings.
- **Conditional — governing/enacted:** NYC BC §§718.2.2-718.2.5, only for the concealed-space condition each subsection actually regulates.
- **Conditional — governing/enacted:** NYC BC §§1401.2 and 1403.5 and the applicable Chapter 26 provisions for the proposed exterior-wall material or tested assembly.
- **Supporting — noncontrolling:** NYC Buildings Bulletin 2022-013, clearly labeled as DOB clarification rather than enacted code.
- **Outside authority / unavailable:** Proprietary test reports, manufacturer details, and unstated assembly geometry.

**Important qualifications:** Wall framing, insulation type, rainscreen cavity, floor-line conditions, soffits, penetrations and tested assembly details are needed.

**Claims Permitext must avoid:**
- Fireblocking is required at a made-up spacing not found in the code.
- Fireblocking and firestopping are the same thing.
- Any mineral wool placed in a cavity automatically satisfies fireblocking.
- Buildings Bulletin 2022-013 can be ignored where its clarified condition applies.

---

## Test 33

**Q:** Can a wall finish with a Class C flame-spread classification be installed within an interior exit stairway enclosure?

**Ideal answer:** Permitext should evaluate the material under BC Chapter 8 and the applicable interior-finish classification table for exits, exit access corridors and rooms/spaces. The permitted finish class depends on occupancy and location, and sprinkler protection can modify the allowable classification only where the table expressly provides that modification. An interior exit stairway is generally one of the more restrictive egress locations, so a Class C finish should not be assumed acceptable merely because it is a recognized finish classification or is permitted in ordinary rooms. Permitext must identify the occupancy, sprinkler condition, exact location, tested flame-spread/smoke-developed classification and the applicable table cell. Separate rules can apply to textile finishes, foam plastics, trim and other specialized materials.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §803.11 and Table 803.11, using the row for the stated occupancy and the column for an interior exit stairway.
- **Conditional — governing/enacted:** The material-specific Chapter 8 provision and any Table 803.11 footnote actually relied upon.
- **Supporting — noncontrolling:** A product test report may establish its classification but does not decide where the class is permitted.
- **Outside authority / unavailable:** Product identity, test results, and sprinkler status not supplied in the text facts.

**Important qualifications:** Occupancy group, sprinkler status, material type, tested classification and whether the material is wall finish, trim, textile or another regulated product are required.

**Claims Permitext must avoid:**
- Class C finish is always permitted because it is a recognized code class.
- An exit stair enclosure can be treated like an ordinary room.
- Sprinkler-dependent table columns can be ignored.
- Flame-spread classification alone resolves every material-specific Chapter 8 requirement.

---

## Test 34

**Q:** Several windows are proposed in an exterior wall close to another building. How should the allowable percentage of exterior-wall openings be calculated?

**Ideal answer:** Permitext should use BC §705.8 and the applicable table rather than divide the total window area by the entire building façade. The calculation must be performed for the relevant exterior wall area at the applicable fire separation distance using the method prescribed by §705.8. Protected and unprotected openings must be categorized correctly, sprinkler conditions considered where the table recognizes them, and table notes applied. Fire separation distance must be established before the opening percentage is calculated, and different portions of an irregular façade can require different analyses if the distance changes. Permitext must also check whether openings are prohibited at a given distance regardless of percentage.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §202 (FIRE SEPARATION DISTANCE), §705.8.1, Table 705.8 and all applicable table notes.
- **Conditional — governing/enacted:** NYC BC §§705.8.2-705.8.6 for protected, unprotected, mixed, vertically separated, or vertically exposed openings as the facts require.
- **Supporting — noncontrolling:** None expected.
- **Outside authority / unavailable:** Surveyed lot-line/building locations and unstated wall/opening dimensions; Permitext may calculate only from supplied text values.

**Important qualifications:** Wall dimensions, opening sizes, varying distances, opening protection, sprinkler status and whether the wall fronts a street, lot line or another building are necessary.

**Claims Permitext must avoid:**
- Total building façade area is always the denominator.
- One fire separation distance automatically applies to an irregular façade.
- Protected and unprotected openings can be counted identically.
- Table notes and prohibited-opening distances can be ignored.

---

## Test 35

**Q:** An intermediate floor level occupies approximately one-third of the room below and is open to that room. Does it qualify as a mezzanine rather than an additional story?

**Ideal answer:** Potentially, but area alone does not establish mezzanine status. BC §505 regulates mezzanines and limits their aggregate area relative to the room or space in which they are located, while also imposing openness, means-of-egress and construction conditions with specific exceptions. The level must satisfy the §202 definition of mezzanine and remain a portion of the room or story below rather than function as an independent story. Permitext should calculate the allowable aggregate mezzanine area using the correct denominator, include any other mezzanines in the same room as required, verify openness/enclosure conditions, evaluate egress, and test any sprinkler or occupancy exception being used. If one of the required conditions fails, the intermediate level may have to be treated as a story.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §202 (MEZZANINE), §§505.2 and 505.2.1.
- **Conditional — governing/enacted:** NYC BC §§505.2.2 and 505.2.3 for egress and openness, including only exceptions whose stated facts are met.
- **Supporting — noncontrolling:** None expected.
- **Outside authority / unavailable:** Unstated room/mezzanine measurements, occupancy, ceiling height, or configuration; Permitext may calculate only from supplied text values.

**Important qualifications:** Room area, aggregate mezzanine area, ceiling height, enclosure, use, occupancy, sprinkler status and egress configuration are required.

**Claims Permitext must avoid:**
- One-third area automatically makes a level a mezzanine.
- The entire building floor area can always be used as the mezzanine denominator.
- Other mezzanines in the same space can be ignored.
- A small enclosed independent floor is a mezzanine solely because of its size.

---

## Test 36

**Q:** A platform supports only mechanical equipment and is accessed by maintenance staff. Is it a mezzanine, an equipment platform, or another story?

**Ideal answer:** The platform should first be evaluated against the Building Code definition and requirements for an equipment platform in BC §§202 and 505. Equipment platforms are intended for mechanical or similar equipment and have their own use and aggregate-area limitations; when those conditions are met, they are not treated as mezzanines or stories in the same way as occupied intermediate floors. Permitext should confirm that the platform is used only for equipment and necessary maintenance access, not storage, offices or general occupied workspace; calculate its aggregate area using the correct room/space basis; and verify guard, access, construction and any separation requirements. If the platform is oversized or used for general occupancy, it can lose equipment-platform treatment and require reclassification.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §202 (EQUIPMENT PLATFORM), §§505.3 and 505.3.1.
- **Conditional — governing/enacted:** NYC BC §§505.3.2 and 505.3.3 for fire suppression and guards, plus the applicable egress/access provision when triggered.
- **Supporting — noncontrolling:** None expected.
- **Outside authority / unavailable:** Unstated platform/room areas and whether the actual use extends beyond equipment and necessary maintenance.

**Important qualifications:** Platform area, room area, equipment served, storage, maintenance access, other intermediate platforms and construction details are necessary.

**Claims Permitext must avoid:**
- Any platform containing mechanical equipment is automatically an equipment platform.
- Equipment platforms and mezzanines are interchangeable.
- Storage or occupied workspace can be added without re-evaluating classification.
- Aggregate area of multiple equipment platforms can be ignored.

---

## Test 37

**Q:** A rooftop enclosure contains elevator equipment, stairs, and a small maintenance room. Does it qualify as a penthouse, and is its area limited?

**Ideal answer:** Permitext should analyze the enclosure under BC §1510 and the applicable Chapter 2 definitions rather than call every rooftop enclosure a penthouse. Rooftop structures can include penthouses, bulkheads, tanks, equipment enclosures and other structures with different permitted uses and limitations. Chapter 5 also affects whether the aggregate area of rooftop structures causes them to be included in building height or treated as an additional story. Permitext should identify each use inside the enclosure, determine whether occupied or storage uses are permitted, calculate the aggregate rooftop-structure area relative to the roof, and apply the §1510 construction, area, height and separation requirements. A room used for regular occupancy rather than incidental maintenance can materially change the classification.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §§1510.2, 1510.2.2 and 1510.2.3 for penthouse/bulkhead classification and limitations, plus the applicable §202 definitions.
- **Conditional — governing/enacted:** NYC BC §504.3, exception 1, for the 33 1/3-percent aggregate-area height/story treatment; other §1510 provisions for the specific rooftop structure or equipment.
- **Supporting — noncontrolling:** None expected.
- **Outside authority / unavailable:** Roof/enclosure measurements, actual occupancy pattern, and equipment schedule not supplied as text facts.

**Important qualifications:** Roof area, aggregate rooftop-structure area, enclosure height, uses, equipment, storage, construction type and frequency of occupancy are needed.

**Claims Permitext must avoid:**
- Every rooftop bulkhead is a penthouse.
- Penthouses are always exempt from building height and story limits.
- Aggregate area of multiple rooftop structures can be ignored.
- General office or storage use is permitted in an equipment enclosure without checking §1510.

---

## Test 38

**Q:** Can the required fire-resistance rating of the building's structural frame be reduced by one hour simply because the building is fully sprinklered?

**Ideal answer:** Permitext should not apply a generic one-hour sprinkler reduction. Construction-type fire-resistance ratings are established by BC Table 601 and related Chapter 6 provisions. Any permitted sprinkler substitution or reduction must come from an explicit code provision and is subject to exclusions, particularly where the code protects structural frame members, exterior walls, fire walls, shafts or occupancy-specific construction. Full sprinkler protection may provide height, story or area benefits without changing the fire-resistance rating required for a particular building element. Permitext should identify the proposed construction type, the Table 601 rating for the structural frame, then locate and test the exact sprinkler modification being claimed before reducing any rating.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC Table 601 and its applicable notes for the proposed construction type and structural-frame element.
- **Conditional — governing/enacted:** The exact enacted provision claimed to authorize a sprinkler-based reduction; NYC BC §903 only when that modifying provision incorporates its sprinkler criteria.
- **Supporting — noncontrolling:** None expected.
- **Outside authority / unavailable:** A generic one-hour reduction unsupported by an explicit provision, or an assumed construction type not stated in the text facts.

**Important qualifications:** Construction type, occupancy, building element, sprinkler standard and the exact code provision claimed as authority for a reduction are required.

**Claims Permitext must avoid:**
- One hour can be subtracted from every Table 601 rating in a sprinklered building.
- Sprinkler height/area benefits automatically reduce element ratings.
- A rating can be reduced where the code expressly prohibits substitution.
- Construction type can be changed based on sprinklers without checking all required building elements.

---

## Test 39

**Q:** The Building Code appears to permit a condition, but an applicable DOB rule imposes an additional requirement. Which one should Permitext use?

**Ideal answer:** Permitext should not automatically discard either source. The Building Code, Administrative Code, duly promulgated DOB rules, Local Laws and other incorporated authorities can regulate the same condition at different levels of specificity. A DOB rule can implement or supplement a code requirement within delegated authority; it is not automatically invalid simply because the Building Code is less specific. Permitext should cite both sources, establish that the rule is current and applicable, identify its legal relationship to the code, and apply the additional requirement where the rule validly supplements the code. If the texts genuinely conflict rather than supplement one another, Permitext should flag the conflict and the need for an official interpretation or determination rather than silently choose whichever result seems stricter.

**Citation expectations:**
- **Required — governing/enacted:** The specific NYC Building Code provision and the specific current, promulgated Title 1 RCNY rule governing the condition; the rule's effective/version status must be verified automatically from an official source.
- **Conditional — governing/enacted:** The specific Administrative Code or Charter delegation provision when authority or conflict resolution is material.
- **Supporting — noncontrolling:** A directly applicable DOB Buildings Bulletin, service notice, FAQ, or interpretation, labeled as guidance rather than as a promulgated rule.
- **Outside authority / unavailable:** Proposed rules, withdrawn rules, superseded rule text, or a project-specific DOB determination not in the available text sources.

**Important qualifications:** Effective date, project type, scope, delegated authority, and whether the secondary source is a promulgated rule, bulletin, interpretation or guidance document must be distinguished.

**Claims Permitext must avoid:**
- The stricter requirement always wins without analyzing legal authority.
- A current DOB rule can be ignored whenever the Building Code is silent.
- A guidance document has the same legal status as a promulgated rule without further analysis.
- Permitext can invent a hierarchy when the authorities genuinely conflict.

---

## Test 40

**Q:** A Local Law changes a Building Code requirement after a permit application was filed but before construction begins. Which version applies?

**Ideal answer:** Permitext cannot determine the governing version from this generic prompt alone. It should treat the issue as an effective-date and transition question rather than assume that either filing date or construction date always controls. Permitext should automatically retrieve the enacted Local Law—not a bill or introduction—read its own effective-date and applicability clauses, retrieve the affected code text before and after amendment, and then apply any specific Administrative Code transition provision. Official DOB transition guidance can help explain administration but does not override the enacted text. The application filing/completeness date, permit status, amendments, scope changes and any work-commencement trigger must be established before a conclusion is stated.

**Citation expectations:**
- **Required — governing/enacted:** The enacted Local Law's effective-date and applicability clauses, the affected code text before and after amendment, and the specific Administrative Code transition provision actually applied (not Chapter 28-101 cited only at chapter level).
- **Conditional — governing/enacted:** Any later enacted Local Law that amends the transition clause, and any expressly retroactive or application-specific provision.
- **Supporting — noncontrolling:** A directly applicable official DOB Buildings Bulletin, service notice, or FAQ, clearly labeled as administrative guidance.
- **Outside authority / unavailable:** A proposed bill/Introduction, press release, inferred filing-lock rule, or unstated application/permit facts. Without the identity of the Local Law and operative dates, the benchmark's correct result is qualified indeterminacy.

**Important qualifications:** Filing date alone may not be sufficient. Application completeness, permit issuance, amendments, scope changes, specific statutory transition wording and any special retroactive provision can control.

**Claims Permitext must avoid:**
- The newest code always applies because construction has not started.
- Filing an application always locks every requirement to the older code.
- The effective date can be applied without reading the Local Law's transition clause.
- A proposed bill or pending amendment can be treated as enacted law.

---

# Source-verification notes for Codex

These benchmark cases were structured against official NYC source families including:
- 2022 NYC Construction Codes (Building, Mechanical, Plumbing, Fuel Gas and General Administrative Provisions).
- 2025 NYC Energy Conservation Code, enforced for applicable filings beginning March 30, 2026.
- 2025 NYC Electrical Code where a current electrical coordination issue is expressly part of a case.
- NYC Buildings Bulletins and 1 RCNY where a case expressly depends on a rule or official clarification.

The new NYC Existing Building Code has been enacted but does not become effective until July 17, 2027. For present-day 2026 alteration cases, Codex should not silently use it as the governing code unless a specific legal transition provision makes it applicable.

# Permitext Research Benchmark — 40 NYC Building Code Test Cases

Purpose: benchmark Permitext Research against defensible, evidence-bounded answers.

Benchmark basis:
- 2022 New York City Construction Codes, effective November 7, 2022.
- Questions involving existing buildings are written to test whether Permitext identifies the governing current alteration/prior-code framework instead of silently applying future-effective law.
- The "Ideal answer" is the minimum expected substantive answer, not a script that Permitext must reproduce word-for-word.
- "Expected citations" identifies the authority a strong answer should retrieve/cite. A citation is not considered correct merely because it is topically related; it must support the proposition.
- "Important qualifications" identifies facts, scope limits, exceptions, or authority gaps that should keep Permitext from overstating the result.
- "Claims Permitext must avoid" is a negative benchmark for hallucination, overreach, wrong-code use, and unsupported compliance claims.

Evaluation principle: A good answer is allowed to stop and say that the evidence or project facts are insufficient. In those cases, refusing to overstate the conclusion is part of the correct answer.


## Test 01

**Q:** A 1,200 sf space is used as a small architectural office with 12 employees. Based on the selected provisions, what occupancy group should it be classified as, and why?

**Ideal answer:** The space should ordinarily be classified as Group B. NYC BC §304.1 places office and professional-service uses in Business Group B, and an architectural office is a conventional professional office use. The stated 1,200 sf area and 12-person staffing do not, by themselves, create a different occupancy classification. Occupant load must still be calculated independently for means-of-egress and other code purposes; the actual number of employees is not automatically the code occupant load. If the office contains another materially different use - for example, a large training room, public assembly area, laboratory, fabrication shop, or retail component - that portion may require separate classification or mixed-occupancy analysis. On the facts given, however, Group B is the defensible classification.

**Expected citations:**
- NYC BC §304.1 - Business Group B
- NYC BC §302.1 - Classification of structures or portions of structures
- NYC BC §1004.5 and Table 1004.5 - Occupant-load factors, if occupant load is later evaluated

**Important qualifications:** This conclusion assumes the space is genuinely used as a professional architectural office and that no significant secondary use changes the classification. The employee count should not be substituted for the calculated occupant load where the code requires an occupant-load calculation.

**Claims Permitext must avoid:**
- Calling the office Group A merely because employees meet in conference rooms.
- Treating 12 employees as the final code occupant load without applying the applicable occupant-load provisions.
- Claiming the entire building is Group B when only the 1,200 sf space has been described.


## Test 02

**Q:** A community room in a residential building is used by residents for meetings, parties, classes, and occasional events. How should the space be classified, and what additional facts are needed before reaching a conclusion?

**Ideal answer:** Based on the stated use, the community room has an assembly function, and Group A-3 is the initial classification to evaluate because NYC BC §303.4 specifically includes community halls and assembly uses involving recreation or other social activities. However, there is not enough information to conclude that it must be classified as A-3. Because it is within a residential building, BC §303.1.3 is particularly important: an assembly room with an occupant load of fewer than 75 persons that is accessory to another occupancy may be classified as Group B or as part of the primary occupancy - potentially the building's Group R occupancy. The key additional facts are the room's floor area and calculated occupant load, whether the room is truly accessory to the residential occupancy, whether its use is limited to residents and their guests or independently operated/open to others, and the actual configurations and activities anticipated. Because BC §302.1 requires a multipurpose room to comply with requirements applicable to each purpose for which it will be occupied, those different configurations can matter. The defensible conclusion is therefore: potential A-3 assembly use, but final classification cannot be determined until accessory-use status and occupant load are established.

**Expected citations:**
- NYC BC §303.4 - Assembly Group A-3
- NYC BC §303.1.3 - Small assembly spaces accessory to another occupancy
- NYC BC §302.1 - General occupancy classification; multipurpose spaces
- NYC BC §1004.5 and Table 1004.5 - Occupant-load factors

**Important qualifications:** The room's name is not controlling; actual use, occupant load, and relationship to the primary residential occupancy matter. Different furniture arrangements or event types may produce different occupant loads.

**Claims Permitext must avoid:**
- Automatically classifying every residential community room as Group A-3.
- Automatically treating it as Group R solely because residents use it.
- Using the actual attendance at a typical event instead of the code-calculated occupant load where the code requires calculation.
- Ignoring multipurpose configurations.


## Test 03

**Q:** A building contains residential apartments, ground-floor retail, and an accessory management office. Based on the supplied evidence, explain how the different occupancies should be treated under the code.

**Ideal answer:** The apartments, retail area, and management office should first be classified by their actual uses: the apartments are evaluated under the applicable Group R classification, the retail sales area under Group M, and the management office under Group B. The next question is not whether the building has only one occupancy, but how the multiple occupancies are regulated under BC §508. The management office may qualify as an accessory occupancy under §508.2 if it is ancillary to the principal occupancy and satisfies the accessory-occupancy area limitations and other conditions. The residential and retail occupancies then must be evaluated under the mixed-occupancy provisions, including whether they are treated as accessory, nonseparated, or separated occupancies. If separated occupancies are used, the required separation is determined from Table 508.4 and the applicable construction. If nonseparated occupancies are used, the more restrictive applicable requirements can govern portions of the building as prescribed by §508.3. The facts given therefore establish multiple uses, but do not by themselves establish the final mixed-occupancy strategy.

**Expected citations:**
- NYC BC §302.1 - Occupancy classification
- NYC BC §304.1 - Group B
- NYC BC §309.1 - Group M
- NYC BC §310 - Residential groups
- NYC BC §508.1 through §508.4 - Mixed use and occupancy
- NYC BC Table 508.4 - Required separation of occupancies

**Important qualifications:** The area of each use, story arrangement, construction type, sprinkler status, whether the office serves only building management, and the chosen separated/nonseparated strategy are needed before determining all consequences.

**Claims Permitext must avoid:**
- Calling the entire building Group R because residential is the dominant use.
- Assuming the management office is automatically accessory without checking §508.2.
- Assuming mixed occupancies always require fire-resistance-rated separation.
- Using Table 508.4 before determining whether the separated-occupancy method is actually being used.


## Test 04

**Q:** A 500 sf office supports a much larger residential occupancy. Can it be treated as an accessory occupancy instead of a separate occupancy? Explain the conditions that must be checked.

**Ideal answer:** Potentially yes, but the 500 sf size alone is not enough. Under BC §508.2, an accessory occupancy is a subsidiary occupancy that is ancillary to the main occupancy and must satisfy the accessory-occupancy limitations. The office should first be classified as Group B, then its aggregate accessory area on the story must be checked against the percentage limitation in §508.2.1 and against any other applicable limits. The office must also genuinely support the principal residential use rather than function as an independent tenant or separate principal use. If those conditions are met, it can be regulated as an accessory occupancy under §508.2 rather than forcing the building to use the separated-occupancy method solely because of that office.

**Expected citations:**
- NYC BC §304.1 - Group B
- NYC BC §508.2 - Accessory occupancies
- NYC BC §508.2.1 - Area limitations for accessory occupancies
- NYC BC §508.2.4 - Separation of accessory occupancies, as applicable

**Important qualifications:** The total floor area of the story and the aggregate area of all accessory occupancies on that story are needed. The relationship between the office and residential operation must also be established.

**Claims Permitext must avoid:**
- Saying every management office in a residential building is automatically Group R.
- Checking only whether 500 sf is 'small.'
- Applying the accessory percentage to the entire building when the provision requires a story-based calculation.
- Ignoring other accessory uses on the same story.


## Test 05

**Q:** Does the selected code text support treating this room as an incidental use rather than a separate occupancy? Identify what facts control the determination.

**Ideal answer:** The room can be treated as an incidental use only if its actual function is one of the uses specifically regulated as an incidental use by BC §509 and Table 509, and if all conditions prescribed for that use are satisfied. 'Incidental use' is not a general label for any small or secondary room. The analysis therefore requires the room's actual function, contents or hazards, size where the table imposes an area threshold, the occupancy in which it occurs, sprinkler protection where relevant, and the required separation or automatic suppression measure identified by Table 509. If the room is not a listed incidental use, §509 does not provide a basis for calling it incidental; it must instead be analyzed under its occupancy classification or another applicable provision.

**Expected citations:**
- NYC BC §509 - Incidental uses
- NYC BC Table 509 - Incidental uses and required separation/protection
- NYC BC §302.1 - Occupancy classification

**Important qualifications:** The exact room use is essential. Permitext should distinguish 'accessory occupancy' under §508 from 'incidental use' under §509 because they are different code concepts with different tests.

**Claims Permitext must avoid:**
- Calling a room incidental merely because it is small, secondary, or used by building staff.
- Using 'accessory' and 'incidental' interchangeably.
- Inventing an incidental-use category not listed in Table 509.
- Ignoring a table condition such as fire separation or automatic sprinkler protection.


## Test 06

**Q:** A 2,400 sf restaurant contains dining, kitchen, storage, and restroom areas. Explain how the occupant load should be calculated and whether different occupant-load factors need to be applied to different portions.

**Ideal answer:** The occupant load should be calculated by dividing each functionally distinct area by the occupant-load factor applicable to that function under BC §1004.5 and Table 1004.5, then combining the resulting loads as required for the space or egress component being evaluated. The entire 2,400 sf should not automatically be divided by one restaurant factor if the floor area contains distinct dining, kitchen, storage, and other functions with different listed factors. Dining areas may also require a distinction between tables-and-chairs seating and other assembly configurations. Kitchens and storage areas are evaluated using the factors applicable to those functions. Restrooms are ordinarily accessory support spaces rather than separately assigned a public assembly load in the same manner as the dining floor, but the exact table methodology and floor-area basis must be followed. The result should be based on code-calculated design occupant load, not merely the restaurant's intended staffing or expected reservations.

**Expected citations:**
- NYC BC §1004.1 - Design occupant load
- NYC BC §1004.5 - Areas without fixed seating
- NYC BC Table 1004.5 - Maximum floor area allowances per occupant
- NYC BC §1004.6 - Fixed seating, if fixed seating is present

**Important qualifications:** Permitext needs the net/gross area of each use, seating arrangement, presence of fixed seating, bar/standing areas, and any spaces with unusual functions. The applicable table specifies whether a factor uses net or gross floor area.

**Claims Permitext must avoid:**
- Using one occupant-load factor for the entire restaurant without examining distinct functions.
- Using the actual number of seats as the complete occupant load where non-fixed seating provisions apply.
- Using employee count or anticipated patron count as a substitute for the code calculation.
- Mixing net and gross factors.


## Test 07

**Q:** A Group A space has an occupant load of 72 people. Based only on the approved evidence, determine the minimum number of exits required and identify any conditions that could change the answer.

**Ideal answer:** For a Group A room or space with an occupant load of 72, the normal egress analysis should begin with BC §1006.2.1 and the applicable table governing spaces with one exit or exit access doorway. A Group A space above the permitted single-exit occupant-load threshold cannot rely on one exit access doorway; it ordinarily requires at least two exits or exit access doorways. The 72-person load therefore points toward two means of egress from the space, but the answer should be tied to the actual table values and conditions in the approved evidence. The analysis must also distinguish exits required from the room or space from the number of exits required from the story. A doorway that satisfies the room-level requirement does not by itself establish that the story or building has a compliant number of exits.

**Expected citations:**
- NYC BC §1006.2.1 - Egress based on occupant load and common path of egress travel distance
- NYC BC Table 1006.2.1 - Spaces with one exit or exit access doorway
- NYC BC §1006.3 - Egress from stories or occupied roofs, where story-level egress is evaluated

**Important qualifications:** Sprinkler status, common-path distance, whether the space is at the level of exit discharge, and whether exits discharge directly to the exterior may affect available exceptions. The approved evidence must contain the applicable table and exceptions before a categorical answer is made.

**Claims Permitext must avoid:**
- Saying '72 occupants always requires two building exits.'
- Treating room-level exit-access requirements as the same as story-level exit requirements.
- Ignoring common-path limits or direct-exterior-exit exceptions.
- Answering from occupant load alone if the selected evidence omits the controlling table.


## Test 08

**Q:** A tenant space has two exits, but occupants initially travel through the same corridor before reaching a choice between them. Does the common path comply? Explain exactly what distance should be measured and what project information is still required.

**Ideal answer:** The existence of two eventual exits does not eliminate common path of egress travel. Under BC §1006.2.1, common path is the portion of exit access that occupants must traverse before two separate and distinct paths of egress travel to two exits or exit access doorways become available. The measured distance therefore begins at the most remote point subject to the common path and follows the natural path of travel to the point where a genuine choice between two separate egress paths first exists. Compliance cannot be determined from the statement that there are two exits. Permitext must know the occupancy classification, sprinkler status, calculated occupant load where the table differentiates by load, and the actual measured common-path distance, and it must compare those facts with Table 1006.2.1.

**Expected citations:**
- NYC BC §1006.2.1 - Egress based on occupant load and common path
- NYC BC Table 1006.2.1 - Spaces with one exit or exit access doorway
- NYC BC §202 - Definition of common path of egress travel, if included in the evidence set

**Important qualifications:** The geometry matters: the choice point must represent two separate and distinct egress paths, not merely two doors that later converge. Measurement must follow the code's path-of-travel rules, not a straight-line dimension.

**Claims Permitext must avoid:**
- Measuring common path between the two exits.
- Assuming two exits means there is zero common path.
- Using exit-access travel distance limits as if they were common-path limits.
- Declaring compliance without the occupancy, sprinkler condition, and measured common-path distance.


## Test 09

**Q:** Determine whether the proposed travel distance from the most remote point of this floor to an exit complies with the selected provisions. Explain the effect, if any, of sprinkler protection.

**Ideal answer:** Compliance is determined under BC §1017 by measuring exit access travel distance from the most remote occupiable point along the natural and unobstructed path of horizontal and vertical egress travel to the entrance to an exit. The measured distance must then be compared with the maximum permitted for the occupancy in Table 1017.2. Automatic sprinkler protection can increase the permitted distance for many occupancies, but only where the table or related provision expressly provides the sprinklered allowance and the building is equipped with the qualifying sprinkler system. Without the actual occupancy, measured travel distance, sprinkler-system status, and the applicable table row, Permitext should not state that the floor complies.

**Expected citations:**
- NYC BC §1017.1 - General exit access travel distance
- NYC BC §1017.2 and Table 1017.2 - Exit access travel distance limitations
- NYC BC §1017.3 - Measurement, as applicable
- NYC BC §903.3.1.1 - NFPA 13 sprinkler system, where the travel-distance allowance depends on that system

**Important qualifications:** Travel distance is not a straight-line radius. Interior configuration, intervening rooms, vertical travel within permitted exit access stairs, occupancy-specific limits, and the type of sprinkler system can affect the result.

**Claims Permitext must avoid:**
- Adding a generic sprinkler 'bonus' not contained in the table.
- Measuring a straight line through walls.
- Confusing exit access travel distance with common path or dead-end length.
- Calling the floor compliant without an actual measured distance.


## Test 10

**Q:** Two required exits are located 28 feet apart in a space having a maximum diagonal dimension of 78 feet. Based on the evidence provided, are the exits sufficiently separated?

**Ideal answer:** Under the general separation rule of BC §1007.1.1, two required exits or exit access doorways must be separated by at least one-half of the maximum overall diagonal dimension of the area served, measured in a straight line between the exits or exit access doorways. One-half of 78 feet is 39 feet, so 28 feet would not satisfy the general one-half-diagonal rule. If the building is equipped throughout with the qualifying automatic sprinkler system, §1007.1.1 permits the separation to be reduced to not less than one-third of the maximum diagonal where that sprinkler exception applies. One-third of 78 feet is 26 feet; in that condition, 28 feet would satisfy the numerical separation test. Therefore the answer is: no under the general rule; potentially yes under the qualifying sprinklered rule, subject to the exact conditions and measurement required by the section.

**Expected citations:**
- NYC BC §1007.1.1 - Two exits or exit access doorways
- NYC BC §903.3.1.1 or the sprinkler provision referenced by §1007.1.1, as applicable

**Important qualifications:** Permitext must confirm that the two points being measured are the code-required exits or exit access doorways, that the 78-foot diagonal is the correct maximum overall diagonal of the area served, and that the sprinkler system qualifies for the reduced separation.

**Claims Permitext must avoid:**
- Saying 28 feet complies without checking sprinkler protection.
- Measuring along the travel path instead of the separation method prescribed by §1007.1.1.
- Applying the one-third rule to a partially sprinklered building if the exception requires protection throughout.
- Concluding that separation compliance proves the entire egress arrangement is compliant.


## Test 11

**Q:** Can two stairs contained within the same scissor-stair enclosure satisfy the requirement for two separate exits? Identify every provision or condition that must be considered before answering.

**Ideal answer:** The fact that two stair runs are arranged as a scissor stair does not by itself establish that they constitute two compliant exits. Permitext should first determine whether each stair is intended to qualify as a separate interior exit stairway, then evaluate the Chapter 10 requirements governing the number of exits, exit separation, interior exit stairway enclosures, continuity, discharge, opening protection, and any provision specifically addressing two interior exit stairways within the same shaft or enclosure. The required exit-separation measurement under §1007.1.1 must still be satisfied in the manner prescribed by the code; a scissor configuration cannot be used as a shortcut around the required remoteness of two exits. The enclosure construction must also preserve the independence and fire-resistance required for the two exit paths. A definitive yes/no answer therefore requires the exact stair/enclosure configuration and all applicable scissor/interlocking-stair provisions in the approved evidence.

**Expected citations:**
- NYC BC §1006.3 - Egress from stories
- NYC BC §1007.1.1 - Exit and exit access doorway separation
- NYC BC §1023 - Interior exit stairways and ramps
- NYC BC §713 - Shaft enclosures, where referenced
- Applicable NYC-specific provision or exception governing scissor/interlocking stairs, if present in the selected enacted text

**Important qualifications:** This is a configuration-sensitive question. Stair separation at entry doors, common enclosure construction, rated separation between stair runs, discharge arrangement, penetrations, and whether the exits remain independent must be established from drawings and the complete applicable text.

**Claims Permitext must avoid:**
- Saying every scissor stair automatically counts as two exits.
- Saying scissor stairs can never count as two exits without checking the enacted NYC provisions.
- Using stair count alone without testing remoteness and enclosure requirements.
- Inferring compliance from a diagram without verifying the applicable code text.


## Test 12

**Q:** An egress door has a clear width of 32 inches and serves 48 occupants. Determine whether the evidence establishes that the door width is acceptable.

**Ideal answer:** A 32-inch clear opening is the baseline minimum clear width for many required egress doors under BC §1010.1.1, so the stated door can satisfy that minimum dimension if the clear width is measured in the manner required by the code. However, minimum door width and egress capacity are separate tests. Under BC §1005, the required egress capacity is based on the occupant load served and the applicable capacity factor. Permitext should therefore calculate the required capacity for 48 occupants and verify that the available clear width is not less than both the prescriptive door minimum and the capacity-derived width. On the stated facts, 32 inches is likely adequate for the 48-person load under the ordinary door-capacity factor, but the evidence establishes compliance only if no special occupancy, accessible-egress, door-type, or other provision requires a greater width.

**Expected citations:**
- NYC BC §1010.1.1 - Size of doors
- NYC BC §1005.3.2 - Other egress components; capacity factor
- NYC BC §1005.1 - Minimum required egress width/capacity

**Important qualifications:** Confirm the door's actual clear opening, not nominal leaf size; the occupant load actually served by that door; any distribution assumptions; and any special occupancy or accessibility requirement.

**Claims Permitext must avoid:**
- Equating a 32-inch door leaf with a 32-inch clear opening.
- Checking only the 32-inch prescriptive minimum and ignoring capacity.
- Dividing the total floor occupant load equally among doors without a code-supported basis.
- Claiming the entire means of egress complies because this one door is wide enough.


## Test 13

**Q:** A door serves a room containing 55 occupants and currently swings into the room. Does it need to swing in the direction of egress travel?

**Ideal answer:** Yes, assuming the stated 55 is the code occupant load served by that door and no more specific exception applies. BC §1010.1.2.1 requires egress doors to swing in the direction of egress travel where serving a room or area containing an occupant load of 50 or more persons, and also in certain hazardous occupancies irrespective of that threshold. A door serving 55 occupants therefore must swing outward in the direction of egress travel. Permitext should still verify that 55 is the calculated design occupant load and that the door is in fact an egress door serving that room.

**Expected citations:**
- NYC BC §1010.1.2.1 - Direction of swing
- NYC BC §1004 - Occupant load

**Important qualifications:** If 55 is only a typical head count rather than the code-calculated occupant load, the occupant load must first be established. Other conditions can independently trigger direction-of-swing requirements.

**Claims Permitext must avoid:**
- Using the room's seating count without confirming the code occupant load.
- Saying every egress door must swing outward.
- Treating the 50-person threshold as a building-wide threshold instead of the load served by the door/room or area.


## Test 14

**Q:** A residential corridor terminates 24 feet beyond the nearest exit access stair. Determine whether the dead-end condition is permitted and identify any sprinkler-related exception.

**Ideal answer:** The 24-foot segment should be evaluated as a dead-end corridor under BC §1020.5 because occupants at its end have only one direction of egress travel until reaching the point where two paths become available. The general dead-end limit is 20 feet unless an exception permits a longer distance. For qualifying sprinklered occupancies, §1020.5 contains an exception allowing a greater dead-end length - commonly 50 feet for specified occupancy groups where the building is equipped throughout with the required sprinkler system. Therefore 24 feet fails the general 20-foot limit but can comply if the residential occupancy and sprinkler condition fall within the applicable 50-foot exception. Permitext should quote the exact exception rather than treating sprinklers as a universal dead-end extension.

**Expected citations:**
- NYC BC §1020.5 - Dead ends
- NYC BC §903.3.1.1 - Sprinkler system, where referenced by the dead-end exception

**Important qualifications:** Confirm the occupancy group, whether the corridor is actually a code corridor, whether the building is sprinklered throughout as required by the exception, and the correct measurement of the dead end.

**Claims Permitext must avoid:**
- Saying 24 feet always violates the code.
- Saying every sprinklered building gets a 50-foot dead end.
- Confusing dead-end length with common path or exit access travel distance.
- Measuring from the corridor end to the stair without identifying where two egress choices actually become available.


## Test 15

**Q:** What fire-resistance rating, if any, is required for this corridor? Explain how occupancy, sprinkler status, and occupant load affect the determination.

**Ideal answer:** The corridor rating cannot be determined from the word 'corridor' alone. BC §1020.2 and its table establish when corridors require a fire-resistance rating based principally on occupancy classification, occupant load served, and whether the building is equipped with the qualifying automatic sprinkler system. Permitext should identify the applicable occupancy row, compare the occupant load with any threshold in that row, and then use the sprinklered or nonsprinklered column as applicable. Some corridors can be permitted with a 0-hour rating under the table, while others require a rated corridor. If a rating is required, the corridor walls, openings, penetrations, continuity, and other components must then satisfy the provisions applicable to that rated assembly. Without occupancy, occupant load served, and sprinkler status, no final rating can be stated.

**Expected citations:**
- NYC BC §1020.2 - Corridor fire-resistance rating
- NYC BC Table 1020.2 - Corridor fire-resistance rating
- NYC BC §§708 and 716, where corridor partitions/openings are required to be rated

**Important qualifications:** The occupant load is the load served by the corridor, not necessarily just the load of one room. Special occupancy chapters may impose additional corridor requirements.

**Claims Permitext must avoid:**
- Assuming every egress corridor is 1-hour rated.
- Assuming sprinklers always eliminate corridor ratings.
- Using the building's total occupant load when the table requires the load served by the corridor.
- Stopping at the wall rating without checking required opening protection if a rated corridor is required.


## Test 16

**Q:** A vertical mechanical shaft connects four stories. Based on the selected evidence, what fire-resistance rating is required for the shaft enclosure?

**Ideal answer:** Under BC §713.4, a shaft enclosure connecting four stories or more generally requires a fire-resistance rating of not less than 2 hours; a shaft connecting fewer than four stories is generally permitted to be 1 hour, subject to the section's qualifications and any more restrictive requirement elsewhere. Because the stated mechanical shaft connects four stories, the baseline result is a 2-hour shaft enclosure. Permitext should also verify how the code counts the stories connected, whether the shaft is required to be enclosed under §713 in the first place, and whether the building's construction type or another specific provision requires a greater rating.

**Expected citations:**
- NYC BC §713.4 - Fire-resistance rating of shaft enclosures
- NYC BC §713.1 - General shaft enclosure requirements
- NYC BC Table 601, if construction type imposes a greater requirement

**Important qualifications:** A shaft spanning four stories reaches the higher-rating threshold; Permitext should not treat 'four stories' as 'fewer than four.' Exceptions for particular penetrations, ducts, or special shaft conditions must be evaluated separately.

**Claims Permitext must avoid:**
- Calling every mechanical shaft 2-hour rated regardless of height.
- Counting only floor openings and ignoring the code's method for stories connected.
- Assuming a shaft enclosure is required without checking applicable exceptions.
- Ignoring a higher rating required by another provision.


## Test 17

**Q:** If a 1-hour fire barrier is required, what rating is required for a door located within that barrier? Does the supplied evidence fully answer the question?

**Ideal answer:** The wall rating alone does not always determine the door rating. Opening protectives must be selected from the applicable opening-protective table in BC §716 based on the type and function of the fire-resistance-rated assembly - for example, whether the 1-hour fire barrier is a shaft enclosure, exit passageway, occupancy separation, incidental-use separation, corridor-related assembly, or another application. A 1-hour barrier commonly corresponds to a 45-minute or 1-hour opening protective depending on that application, but Permitext should not infer one universal value from '1-hour wall.' The supplied evidence fully answers the question only if it identifies the barrier's code function and includes the applicable §716 table row and any relevant exceptions.

**Expected citations:**
- NYC BC §716 - Opening protectives
- NYC BC Table 716.1(1) or applicable §716 opening-protective table - Fire door/fire shutter ratings
- The code section requiring the specific 1-hour fire barrier

**Important qualifications:** The barrier's purpose is essential. Door assemblies also have requirements for labeling, glazing, closing/latching, and other features that are not established merely by the hourly rating.

**Claims Permitext must avoid:**
- Stating 'a 1-hour wall always needs a 45-minute door.'
- Selecting the opening rating without identifying the assembly application.
- Assuming an unrated door is acceptable because the wall is sprinklered.
- Claiming full door compliance from the fire-protection rating alone.


## Test 18

**Q:** A residential occupancy is located directly above a commercial occupancy. Determine whether a fire-resistance-rated separation is required and how its rating should be established.

**Ideal answer:** A vertical change from residential to commercial use does not automatically establish a required hourly separation. Permitext must first classify both occupancies and determine which mixed-occupancy method under BC §508 is being used. If the occupancies are treated as separated occupancies, Table 508.4 establishes the required separation between the two occupancy groups, with sprinkler status affecting the table value where indicated; because the uses are stacked, the required separation is typically provided by a horizontal assembly and supporting construction as required by the applicable provisions. If the project qualifies for and uses the nonseparated-occupancy method, a separation based solely on Table 508.4 is generally not required, but the nonseparated method imposes its own more-restrictive height, area, and other requirements. The answer therefore depends on the commercial occupancy group and selected mixed-occupancy strategy.

**Expected citations:**
- NYC BC §508.1 - Mixed use and occupancy
- NYC BC §508.3 - Nonseparated occupancies
- NYC BC §508.4 and Table 508.4 - Separated occupancies
- NYC BC §711 - Floor and roof assemblies, where a horizontal rated separation is required

**Important qualifications:** The commercial use must be identified precisely - Group M, B, A, etc. - because Table 508.4 values vary. Incidental uses and accessory occupancies should not be confused with the separated-occupancy analysis.

**Claims Permitext must avoid:**
- Saying residential over commercial always requires a 1-hour floor.
- Assuming no separation is required without confirming that the nonseparated method is permitted and being used.
- Using a Table 508.4 value without identifying both occupancy groups and sprinkler condition.
- Ignoring structural/supporting requirements of a rated horizontal assembly.


## Test 19

**Q:** Given the selected information about structural framing, exterior walls, floor construction, and roof construction, can the building be classified as Type IIA? Identify any missing information preventing a definitive answer.

**Ideal answer:** Type IIA can be confirmed only by comparing the required fire-resistance ratings for all principal building elements in Table 601, together with exterior-wall requirements in Table 602 and any applicable modifications, against the actual construction. The analysis must cover the structural frame, bearing walls, nonbearing exterior walls and partitions where applicable, floor construction and associated secondary members, and roof construction and associated secondary members. If the selected information does not provide the fire-resistance rating or approved assembly for each required element - or omits fire-separation distance information needed for exterior walls - Permitext should state that Type IIA is only a candidate classification and cannot be confirmed. Material descriptions such as 'concrete,' 'steel,' or 'CMU' are not substitutes for the required fire-resistance-rating analysis.

**Expected citations:**
- NYC BC §602.2 - Types I and II construction
- NYC BC Table 601 - Fire-resistance rating requirements for building elements
- NYC BC Table 602 - Exterior walls based on fire separation distance
- Relevant §§704-722 for establishing fire-resistance ratings, as applicable

**Important qualifications:** Construction-type classification depends on rated performance, not simply combustibility or material names. Any permitted reductions, sprinkler modifications, special structural conditions, and exterior-wall distance must be supported by the enacted provisions.

**Claims Permitext must avoid:**
- Calling a concrete-and-steel building Type IIA solely from its materials.
- Ignoring secondary structural members.
- Ignoring Table 602 exterior-wall requirements.
- Assuming an assembly's rating without a tested/listed assembly or code-calculated basis.


## Test 20

**Q:** A sprinklered Group R-2 building is proposed at 11 stories. Determine whether the selected provisions establish that the proposed number of stories is permitted.

**Ideal answer:** The number of stories cannot be approved from 'R-2 + sprinklered + 11 stories' alone. BC §504.4 and Table 504.4 establish allowable stories above grade plane as a function of occupancy group, construction type, and sprinkler condition. Permitext must therefore know the proposed construction type and verify that the sprinkler system qualifies for the applicable table column. It must also separately check the allowable height in feet under §504.3/Table 504.3, because compliance with the story limit does not establish compliance with the height-in-feet limit. Other provisions - including high-rise requirements if the building meets the definition - may apply even where height and story count are permitted. The defensible answer is conditional until construction type and actual building height are supplied.

**Expected citations:**
- NYC BC §504.3 and Table 504.3 - Allowable building height in feet
- NYC BC §504.4 and Table 504.4 - Allowable number of stories above grade plane
- NYC BC §903.3.1.1 - NFPA 13 sprinklers, where required for the table allowance
- NYC BC §403 - High-rise buildings, if applicable

**Important qualifications:** Construction type is indispensable. Permitext must distinguish number of stories above grade plane from total levels and must separately evaluate height in feet.

**Claims Permitext must avoid:**
- Saying all sprinklered R-2 buildings may be 11 stories.
- Checking story count but not height in feet.
- Assuming any sprinkler system qualifies for the table's sprinklered allowance.
- Calling an 11-story building high-rise solely because of story count.


## Test 21

**Q:** Determine the allowable area for this building based on occupancy, construction type, frontage, and sprinkler status. Show which increases apply rather than simply giving the final number.

**Ideal answer:** Permitext should calculate allowable building area from the tabular allowable area in BC Table 506.2 for the applicable occupancy group, construction type, and sprinkler condition, then apply only the area modifications expressly permitted by §506. The frontage increase under §506.3 depends on qualifying open frontage, open-space width, and the proportion of building perimeter meeting the conditions; it is not a flat percentage. Any sprinkler-related area increase must be applied only through the method and table structure prescribed by §506 for the building configuration. For a mixed-occupancy building, the analysis must also follow the selected mixed-occupancy method and applicable aggregate-area rules. A transparent answer should show: base/table area, frontage data and calculation, sprinkler basis, number-of-stories or multistory treatment where applicable, and resulting allowable area before comparing it with actual area.

**Expected citations:**
- NYC BC §506.2 and Table 506.2 - Allowable area factor
- NYC BC §506.3 - Frontage increase
- NYC BC §506.2.1 or other applicable multistory/sprinkler area provisions
- NYC BC §508 - Mixed occupancies, if more than one occupancy is present

**Important qualifications:** The exact formula depends on building configuration and code table structure. Permitext needs construction type, occupancy, actual story areas, number of stories, sprinkler standard, perimeter length, qualifying frontage length, and open-space widths.

**Claims Permitext must avoid:**
- Applying a generic '200% sprinkler increase' without tracing the applicable §506 method.
- Treating all site frontage as qualifying frontage.
- Using zoning lot area as building-code allowable building area.
- Giving one final number without showing the inputs and modifications.


## Test 22

**Q:** Based on the selected definitions and project elevations, determine whether this level counts as a story above grade plane.

**Ideal answer:** The determination must be made from the code definitions of grade plane, story, story above grade plane, basement, and any NYC-specific cellar terminology that applies. Permitext should calculate the grade plane from the required reference elevations, then compare the floor level and the finished ground relationship around the building with the definition of story above grade plane. A level can be below grade on one side and still count as a story above grade plane depending on the defined elevation tests. Conversely, merely calling a level a 'cellar' or 'basement' on the drawings does not control the code classification. Without the actual project elevations around the building and the selected definitions, Permitext should explain the test but not assign the final status.

**Expected citations:**
- NYC BC §202 - Definitions of GRADE PLANE, STORY, STORY ABOVE GRADE PLANE, and BASEMENT
- Applicable NYC definition/provision for CELLAR, if the term is used in the selected enacted text

**Important qualifications:** Permitext needs the required elevation data around the exterior walls, relevant floor elevations, and the exact NYC definition set for the applicable code edition. Zoning definitions of basement/cellar should not be substituted for Building Code definitions unless the question is a zoning question.

**Claims Permitext must avoid:**
- Determining story status from the room/floor name on the drawings.
- Using one spot grade without applying the grade-plane definition.
- Substituting Zoning Resolution definitions for Building Code definitions.
- Assuming every below-grade level is excluded from stories above grade plane.


## Test 23

**Q:** The highest occupied floor is 74 feet above the lowest level of fire department vehicle access. Does the building meet the code definition of a high-rise building? Explain the measurement controlling the determination.

**Ideal answer:** No, not from the stated elevation. The NYC Building Code definition of a high-rise building is based on whether an occupied floor is located more than 75 feet above the lowest level of fire department vehicle access. At 74 feet, the highest occupied floor is below that threshold. The measurement is to the occupied floor elevation specified by the definition, not to the roof, parapet, bulkhead, or overall building height. Permitext should nevertheless verify that the identified fire-department-access elevation is truly the lowest qualifying level of fire department vehicle access and that no other occupied floor is higher than the one stated.

**Expected citations:**
- NYC BC §202 - Definition of HIGH-RISE BUILDING
- NYC BC §403 - High-rise buildings, if the definition is met

**Important qualifications:** The result turns on the exact defined measurement. Overall architectural height and number of stories do not substitute for the high-rise definition.

**Claims Permitext must avoid:**
- Calling the building high-rise because it is close to 75 feet.
- Measuring to the roof or parapet instead of the occupied floor.
- Using grade plane instead of the lowest level of fire department vehicle access if the definition uses the latter.
- Assuming story count alone establishes high-rise status.


## Test 24

**Q:** Does an accessible route need to connect the building entrance to this particular room? Base the conclusion only on the supplied Chapter 11 provisions.

**Ideal answer:** Chapter 11 generally requires accessible routes to connect accessible building entrances with accessible spaces and elements that are required to be accessible, subject to the specific scoping provisions and exceptions for the occupancy and facility. Permitext therefore cannot answer solely from the fact that the room is inside the building. It must identify the room's use, whether that type of space is required to be accessible, whether it is on an accessible story or within an area covered by an exception, and the route/entrance provisions applicable to the building. If the room is a required accessible common-use or public-use space, the accessible route would generally need to connect it to the accessible entrance. If a Chapter 11 exception excludes the space or level, the route requirement may differ.

**Expected citations:**
- NYC BC §1101.2 - Design in accordance with ICC A117.1 and the code
- NYC BC §1104 - Accessible routes
- Applicable NYC BC Chapter 11 scoping section for the room's occupancy/use
- ICC A117.1 accessible-route provisions, where incorporated

**Important qualifications:** The room function, floor level, new-versus-existing condition, occupancy, and any applicable exception must be known. For prior-code buildings and alterations, §1101.3 and related provisions may change the scoping analysis.

**Claims Permitext must avoid:**
- Saying every room in every building must be on an accessible route.
- Treating ADA scoping as automatically identical to NYC BC Chapter 11 scoping.
- Ignoring existing-building/alteration provisions.
- Concluding accessibility from route width alone.


## Test 25

**Q:** In a residential project containing 100 dwelling units, explain which categories of accessible units must be considered and what additional project information is necessary to calculate the required quantities.

**Ideal answer:** The unit count alone is insufficient. Permitext should first identify the residential occupancy and which NYC BC Chapter 11 residential-unit scoping provisions apply, then distinguish the categories of units required by those provisions - such as Accessible units, Type A units, Type B units, or other NYC-specific categories/standards where applicable. The calculation can depend on whether the building is R-2 or another residential group, whether units are transient or permanent, the number and location of stories, elevator service, project type, publicly funded or agency-specific requirements, and whether the work is new construction or an alteration to a prior-code building. The 100-unit total is only one input. Permitext should calculate each required category separately from the correct scoping section and should not combine overlapping federal, state, agency, or NYC requirements unless the selected evidence supports doing so.

**Expected citations:**
- NYC BC Chapter 11, especially the residential dwelling/sleeping unit scoping provisions in §1107
- NYC BC §1101.2 - ICC A117.1 incorporation
- Applicable ICC A117.1 unit-type provisions
- NYC BC §1101.3 - Prior-code building alterations, if applicable

**Important qualifications:** Funding and program can add requirements outside the NYC Building Code (for example federal or state housing standards). Permitext must clearly distinguish those external standards from the NYC BC result.

**Claims Permitext must avoid:**
- Saying '100 units means X accessible units' without identifying the applicable residential scoping rule.
- Treating Type A, Type B, Accessible, ADA, and UFAS units as interchangeable labels.
- Applying federal funding requirements as if they were NYC Building Code text.
- Ignoring elevator and story/location conditions.


## Test 26

**Q:** Based on the selected ANSI/BC provisions and the stated door configuration, determine whether the maneuvering clearance at this door complies.

**Ideal answer:** Door maneuvering clearance must be checked against the applicable ICC A117.1 §404.2.3 condition for the exact approach and door operation - for example, front, hinge-side, or latch-side approach, and pull side versus push side. Permitext should compare the required depth and latch-side/hinge-side clearance for that configuration with the actual clear floor space, accounting for walls, casework, door projections, and other obstructions as the standard requires. There is no single universal maneuvering-clearance dimension for every door. Compliance can be concluded only after the approach direction, swing direction, pull/push side, closer/latch conditions where relevant, and measured clearances are known.

**Expected citations:**
- NYC BC §1101.2 - Accessibility design using ICC A117.1
- ICC A117.1-2009 §404.2.3 - Maneuvering clearances at manual doors
- Applicable ICC A117.1 figures/tables associated with §404.2.3

**Important qualifications:** The incorporated A117.1 edition must match the NYC code edition. Door width, threshold, hardware, closing speed, and opening force are separate requirements and are not proven by maneuvering-clearance compliance.

**Claims Permitext must avoid:**
- Applying one 18-inch latch-side clearance to every door condition.
- Measuring from the nominal door leaf rather than the clear floor-space geometry required by the standard.
- Ignoring push-versus-pull side.
- Calling the entire doorway accessible based only on maneuvering clearance.


## Test 27

**Q:** Review the supplied bathroom dimensions and determine whether the code evidence is sufficient to conclude that the bathroom complies with the applicable accessibility requirements. Identify every dimension that still needs verification.

**Ideal answer:** Permitext should not declare an accessible bathroom compliant from one or two clearances. A complete review must first identify the bathroom type and accessibility standard that applies, then check the room's accessible route and entry door, door maneuvering clearance, required turning space, water-closet location and clear floor space, side/rear wall distances, grab-bar locations and extents, lavatory clear floor space and knee/toe clearance, fixture heights, mirror/accessory reach ranges, and bathtub or shower requirements if present. ICC A117.1 Chapter 6 contains separate provisions for toilet rooms and individual fixtures, and the required dimensions depend on the fixture configuration. If any of those controlling dimensions, elevations, or obstruction conditions are absent from the supplied evidence or drawings, the correct result is 'insufficient information for full compliance determination' followed by a checklist of missing measurements.

**Expected citations:**
- NYC BC §1101.2 - ICC A117.1 incorporation
- ICC A117.1-2009 §603 - Toilet and bathing rooms
- ICC A117.1-2009 §604 - Water closets and toilet compartments
- ICC A117.1-2009 §606 - Lavatories and sinks
- ICC A117.1-2009 §§607-608 - Bathtubs/showers, if present
- ICC A117.1-2009 §404 - Door requirements

**Important qualifications:** The applicable unit category and project program can change the required configuration. Agency standards such as UFAS or housing-program requirements should be identified separately rather than silently merged into the NYC BC analysis.

**Claims Permitext must avoid:**
- Declaring the bathroom compliant from a single 60-inch dimension.
- Assuming every residential bathroom follows the same accessible-unit standard.
- Ignoring door swing intrusion, fixture overlap rules, or knee/toe clearances.
- Treating a drawing that lacks vertical dimensions as complete evidence.


## Test 28

**Q:** An existing office space is being converted into apartments. Based on the supplied provisions, identify the major code consequences that must be investigated because of the change in occupancy.

**Ideal answer:** Changing an existing office use to apartments is a change of occupancy/use that requires more than simply relabeling Group B as Group R. Permitext should identify the applicable existing/prior-code-building provisions and then evaluate the consequences triggered by the new residential occupancy, including occupancy classification, means of egress, fire-resistance and occupancy separation, construction type/height/area limitations, automatic sprinkler and fire-alarm requirements, accessibility, light/ventilation and residential-specific provisions where governed by the Construction Codes, structural/live-load implications where applicable, and any special requirements for the particular R occupancy. The selected evidence must also establish which code edition and alteration/change-of-use provisions govern the existing building. Because NYC's new Existing Building Code is not yet the current code for a 2026 project unless a legally applicable transition provision says otherwise, Permitext must not silently analyze the project under a future-effective code.

**Expected citations:**
- NYC Administrative Code §28-101.4 and applicable provisions governing prior-code buildings/changes of use or occupancy
- NYC BC §302 and §310 - Occupancy classification
- NYC BC Chapter 10 - Means of egress
- NYC BC Chapter 9 - Fire protection systems
- NYC BC Chapter 11 - Accessibility
- Other residential/special-use provisions identified by the selected evidence

**Important qualifications:** Building age, original code, scope of work, exact former and proposed occupancies, construction type, sprinkler status, number of stories, and whether the change increases hazard or affects specific systems are necessary. Other NYC laws or agency rules may also apply.

**Claims Permitext must avoid:**
- Applying all new-building requirements automatically without the existing-building framework.
- Assuming a change from office to residential is only a Chapter 3 classification issue.
- Using the future-effective NYC Existing Building Code as current law without an effective-date basis.
- Claiming full change-of-use compliance from a handful of selected sections.


## Test 29

**Q:** An interior renovation changes partitions but does not change occupancy or building area. Which requirements appear to apply to the altered work, and which existing conditions can remain? Do not assume requirements that are not contained in the evidence.

**Ideal answer:** The answer depends on NYC's provisions governing alterations to existing or prior-code buildings and on the extent to which the work affects existing systems and conditions. The fact that occupancy and building area do not change can reduce the number of triggers, but it does not mean the renovation is exempt from current requirements. New work generally must comply with the applicable requirements for that work, while legally existing conditions outside the scope may be permitted to remain where the governing existing-building provisions allow them to remain. Altered egress components, accessibility features, fire-protection systems, structural work, and other affected elements may have specific upgrade requirements. Permitext should identify the provisions actually supplied and state separately: (1) requirements clearly triggered by the altered work, (2) existing conditions expressly permitted to remain, and (3) issues that cannot be resolved without additional existing-building provisions.

**Expected citations:**
- NYC Administrative Code §28-101.4 and applicable prior-code-building alteration provisions
- NYC BC §1101.3 - Accessibility provisions for alterations to prior-code buildings, if accessibility is affected
- Discipline-specific alteration provisions actually contained in the approved evidence

**Important qualifications:** The building's original/legal status, permit history, scope boundaries, alteration category if applicable, and systems affected are needed. 'No change of occupancy' is not equivalent to 'no current-code requirements.'

**Claims Permitext must avoid:**
- Requiring the entire existing building to be upgraded to new-building standards without a cited trigger.
- Saying all existing conditions may remain because occupancy is unchanged.
- Using future-effective existing-building provisions without an effective-date basis.
- Inferring requirements from general practice when they are not in the approved evidence.


## Test 30

**Q:** The existing building contains a condition that would not comply with requirements for new construction. Does the renovation automatically require that condition to be corrected? Explain what additional code provisions are necessary to answer.

**Ideal answer:** No. A condition's noncompliance with today's new-construction requirements does not by itself prove that an alteration must correct it. Permitext must determine whether the condition is legally existing, whether the renovation alters or affects it, whether the work constitutes a change of use or occupancy, whether a specific alteration provision requires an upgrade, and whether the condition is unsafe or otherwise subject to an independent correction requirement. The applicable NYC provisions for prior-code buildings and alterations are therefore essential. The correct research behavior is to distinguish 'would not be permitted in new construction' from 'must be upgraded as part of this project.' Without the existing-building trigger provisions, the evidence is insufficient to require correction.

**Expected citations:**
- NYC Administrative Code §28-101.4 and applicable prior-code-building provisions
- Specific alteration/change-of-use section governing the affected element
- Any unsafe-condition or retroactive requirement expressly applicable to the condition

**Important qualifications:** Legal existing status matters. Permit records, prior approvals, building age, and whether the project touches the condition may be necessary facts. Some requirements are retroactive or specifically triggered even when the element is not directly altered.

**Claims Permitext must avoid:**
- Treating every difference from the 2022 new-building code as an existing violation.
- Assuming 'grandfathered' without verifying lawful existing status.
- Requiring upgrades based solely on good practice rather than an enacted trigger.
- Ignoring retroactive or safety provisions where the evidence contains them.


## Test 31

**Q:** Does this space qualify as a “habitable room”? Identify the controlling definition and explain the consequences of that classification based on the supplied evidence.

**Ideal answer:** Permitext should begin with the exact controlling definition in the applicable code rather than infer habitability from the room name. A habitable space/room is generally tied to spaces used for living, sleeping, eating, or cooking, while bathrooms, toilet rooms, closets, halls, storage rooms, utility spaces, and similar support spaces are typically excluded by definition. Once the actual use is compared with the NYC definition, any consequences must come from provisions that expressly apply to habitable rooms/spaces - for example, minimum dimensions, light and ventilation, ceiling height, or other residential requirements if those provisions are part of the approved evidence. If the selected evidence includes only the definition and no consequence provision, Permitext may classify the room but should not invent dimensional or environmental requirements.

**Expected citations:**
- NYC BC §202 - Applicable definition of HABITABLE SPACE / HABITABLE ROOM, if defined there
- Any NYC BC, Housing Maintenance Code, Multiple Dwelling Law, or other enacted provision actually selected that imposes requirements on habitable rooms/spaces

**Important qualifications:** The controlling source may vary with the exact question. Permitext should not silently substitute a Housing Maintenance Code or Multiple Dwelling Law definition for a Building Code definition, or vice versa.

**Claims Permitext must avoid:**
- Calling a room habitable because a plan labels it 'bedroom.'
- Importing minimum-area or window requirements that are not in the approved evidence.
- Treating bathrooms, closets, or corridors as habitable without textual support.
- Mixing definitions from different NYC codes without identifying the source.


## Test 32

**Q:** The general provision appears to require a 1-hour enclosure, but an exception may apply to sprinklered buildings. Determine whether the exception actually applies to this project and list every condition that must be satisfied.

**Ideal answer:** Permitext should treat the exception as a checklist, not as a general 'sprinkler waiver.' First identify the exact general rule requiring the enclosure and the exact exception. Then list every conjunctive condition in the exception: occupancy exclusions, number of stories connected, percentage or number of unenclosed stairs permitted, sprinkler protection standard and extent, openness/visibility conditions, travel-path or floor-opening limitations, smoke-control or draft-curtain requirements if stated, and any referenced sections. The exception applies only if every required condition is established by project facts and supported by the selected text. If one fact is unknown - for example, whether the building is sprinklered throughout or whether the stair connects only the permitted consecutive stories - the conclusion must remain conditional. For an exit-access-stair question, BC §1019.3 and the shaft-enclosure requirements of §713 are typical controlling provisions.

**Expected citations:**
- NYC BC §1019.3 - Occupancies other than Groups H, I-2 and I-3; enclosure of exit access stairways/ramps and exceptions
- NYC BC §713 - Shaft enclosures
- Any sprinkler, atrium, opening, or other section expressly cross-referenced by the particular §1019.3 exception being tested

**Important qualifications:** The exact exception number matters because the conditions differ. Permitext should quote or accurately enumerate the selected exception rather than rely on a generic understanding of sprinklered buildings.

**Claims Permitext must avoid:**
- Saying sprinklers automatically eliminate the enclosure requirement.
- Checking only one condition from a multi-condition exception.
- Ignoring excluded occupancies or story limits.
- Using an exception without retrieving a section that the exception expressly incorporates.


## Test 33

**Q:** Section A appears to require two exits, while Section B appears to permit one exit under certain conditions. Reconcile the two provisions and explain which one controls this project.

**Ideal answer:** The two provisions should be read as a general rule plus a specific allowance, not as contradictory commands. For means of egress, BC §1006 establishes the normal number-of-exits framework while §1006.3.2 permits a single exit from certain stories or occupied roofs only when one of its stated conditions is satisfied, including the limits in the applicable tables. Permitext should first establish the general requirement, then test the project against every condition of the specific single-exit allowance. If the project falls within the allowance, the specific exception/permission governs that condition; if any threshold or prerequisite is exceeded, the general two-or-more-exit requirement remains. The answer must also distinguish a single exit from a room or space from a single exit from a story.

**Expected citations:**
- NYC BC §1006.2 - Egress from spaces
- NYC BC §1006.3 - Egress from stories or occupied roofs
- NYC BC §1006.3.2 - Single exits
- Applicable Tables 1006.2.1 and 1006.3.2, depending on the project condition

**Important qualifications:** Occupancy, story location, number of dwelling units where relevant, occupant load, sprinkler status, travel distance, and direct-exterior conditions may all control the single-exit allowance.

**Claims Permitext must avoid:**
- Calling the sections contradictory without attempting to harmonize the general rule and exception.
- Applying a room-level single-exit allowance to an entire story.
- Using one favorable threshold while ignoring the rest of the table conditions.
- Assuming a specific exception extends beyond its stated stories or occupancies.


## Test 34

**Q:** The supplied section refers to another section for an exception. Can a conclusion be reached from the current evidence, or must that referenced section be added to the evidence set?

**Ideal answer:** If the cross-referenced section supplies a condition, definition, exception, table, or calculation necessary to determine whether the rule applies, the current evidence is incomplete and the referenced section must be added before Permitext reaches a final conclusion. The parent section can support a preliminary statement such as 'an exception may apply if the referenced section is satisfied,' but it cannot support an assertion that the exception actually applies. Permitext should identify the exact cross-reference, explain what legal proposition depends on it, request or retrieve that provision, and preserve the distinction between evidence already approved and evidence still needed.

**Expected citations:**
- The selected parent section containing the cross-reference
- The expressly referenced section, table, definition, or exception before a final answer is issued
- NYC BC §102/§201-202 only where rules of construction or definitions are genuinely implicated

**Important qualifications:** Not every cross-reference is outcome-determinative, but Permitext should not guess. It should explain whether the missing reference affects applicability, a numeric threshold, an exception, a definition, or merely an administrative detail.

**Claims Permitext must avoid:**
- Assuming the referenced section says what is typical in the model code.
- Declaring the exception satisfied without the incorporated text.
- Silently using unapproved external text in an evidence-bounded Research answer.
- Treating every cross-reference as irrelevant because the parent section appears clear.


## Test 35

**Q:** A selected paragraph refers to Table X. Can you answer the question without the table? If not, explain specifically why the table is necessary.

**Ideal answer:** If the paragraph delegates the controlling values, categories, thresholds, ratings, distances, or conditions to Table X, Permitext cannot give the final project-specific answer without the table. The paragraph establishes the rule that the table controls; the table supplies the operative value. The ideal response should state what can be concluded from the paragraph, identify the exact fact that must be looked up in the table, and mark the answer incomplete until the relevant table row, column, footnotes, and notes are part of the approved evidence. Table notes are part of the legal condition and cannot be discarded simply because the principal cell appears to contain the desired number.

**Expected citations:**
- The selected paragraph that incorporates Table X
- Table X, including applicable row, column, footnotes, and general notes
- Any definition or cross-reference expressly required by the table

**Important qualifications:** Permitext should capture enough table context to avoid a misleading isolated-cell citation. A screenshot or structured table extract should preserve headings and notes necessary to understand the selected value.

**Claims Permitext must avoid:**
- Guessing the table value from memory.
- Citing the paragraph as if it contained the numeric requirement.
- Using a table cell without its row/column headings or footnotes.
- Calling the answer complete when the controlling table is outside the evidence set.


## Test 36

**Q:** The answer depends on whether this area qualifies as an “occupied roof.” The definition has not been supplied. State whether a conclusion can be reached without it rather than inferring the definition.

**Ideal answer:** A final conclusion should not be reached if the applicability of the selected provision turns on the legal meaning of 'occupied roof' and the approved evidence does not establish that meaning or otherwise make the classification indisputable. Permitext should state that the threshold issue is unresolved, identify the definition or code provisions governing occupied roofs, and request that evidence before applying the downstream requirement. It may describe the factual question that needs resolution - whether the roof is designed or used for human occupancy and under what conditions - but it should not invent a legal definition from ordinary language.

**Expected citations:**
- NYC BC §202 or the enacted section containing the controlling definition/usage of OCCUPIED ROOF, if defined
- The downstream section whose applicability depends on the area being an occupied roof

**Important qualifications:** If the term is not separately defined in §202, Permitext should trace how the code uses the term and any associated scoping section rather than fabricate a definition.

**Claims Permitext must avoid:**
- Using a dictionary definition as if it were the Building Code definition.
- Assuming any accessible roof is an occupied roof.
- Assuming a roof is unoccupied merely because no permanent room is present.
- Applying occupied-roof egress requirements before resolving the classification.


## Test 37

**Q:** Determine the required number of exits. The evidence is complete, but the project occupant load has not been confirmed. Explain what can and cannot be concluded.

**Ideal answer:** Permitext can identify the governing exit-number provisions and the occupant-load thresholds that will determine the result, but it cannot select the final required number of exits until the design occupant load is established. The correct answer should therefore be conditional: for each applicable load range, state the corresponding number-of-exits consequence from the selected tables/sections, then identify the occupant-load calculation as the missing project fact. If the occupancy or story configuration introduces independent minimum-exit requirements, those can be stated, but Permitext must not assume an occupant load merely to produce a definitive answer.

**Expected citations:**
- NYC BC §1004 - Occupant load
- NYC BC §1006.2 - Egress from spaces
- NYC BC §1006.3 - Egress from stories/occupied roofs
- Applicable exit-number tables in §1006

**Important qualifications:** A complete legal evidence set does not compensate for incomplete project facts. Permitext should distinguish 'missing law' from 'missing fact' because the remedy is different.

**Claims Permitext must avoid:**
- Inventing an occupant load from rough area assumptions not provided by the user.
- Giving the lowest possible number of exits as the answer.
- Treating actual staffing as the design occupant load without a code calculation.
- Saying the evidence is insufficient when the law is complete but a project fact is missing; it should identify the missing fact specifically.


## Test 38

**Q:** Based solely on the supplied section about exit width, determine whether the entire egress system complies with the NYC Building Code.

**Ideal answer:** No. A section governing exit or egress width can establish only the width/capacity issue addressed by that section. Overall means-of-egress compliance also depends on matters such as occupant load, number of exits, common path, exit access travel distance, dead ends, exit separation, doors, stairs, corridors, accessibility/accessible means of egress where applicable, exit enclosure and continuity, exit discharge, and occupancy-specific requirements. Permitext may conclude that a particular width satisfies the selected provision if the necessary facts are present, but it must explicitly limit the conclusion to that issue. The evidence set is insufficient for a claim that the 'entire egress system' complies.

**Expected citations:**
- The supplied NYC BC Chapter 10 width/capacity provision, such as §1005 and/or §1010
- Other Chapter 10 provisions would be required for a complete egress determination, including §§1006, 1007, 1017, 1020, 1023 and 1028 as applicable

**Important qualifications:** This is deliberately a scope-control test. Permitext should state the boundary of the selected evidence and identify major missing egress topics without pretending that every possible Chapter 10 provision necessarily applies.

**Claims Permitext must avoid:**
- Equating adequate width with full egress compliance.
- Claiming code compliance beyond the selected evidence.
- Listing unrelated requirements as definite violations.
- Using uncited general knowledge to fill the missing evidence set.


## Test 39

**Q:** Based on the supplied NYC Building Code provisions, determine whether the project also complies with FDNY requirements. The evidence contains no FDNY material.

**Ideal answer:** Permitext cannot determine FDNY compliance from NYC Building Code provisions alone. The Building Code can establish construction-code requirements, and some provisions may reference fire-safety systems also regulated by the Fire Code, but FDNY-administered requirements must be evaluated against the applicable NYC Fire Code, FDNY rules, permits, bulletins, or other controlling FDNY material. The correct answer is therefore limited: the supplied evidence may support a Building Code conclusion, but FDNY compliance remains unverified and requires separate authority. Permitext should identify that as an outside-library or missing-authority limitation rather than extrapolate.

**Expected citations:**
- The supplied NYC Building Code provisions relevant to the specific issue
- 2022 NYC Fire Code provisions only after they are retrieved and approved as evidence
- Applicable FDNY rules/bulletins/permits where the issue falls within those authorities

**Important qualifications:** Building Code and Fire Code requirements can overlap but are not interchangeable. Permitext should preserve the authority/source label for each citation.

**Claims Permitext must avoid:**
- Saying Building Code compliance proves FDNY compliance.
- Inventing FDNY requirements from memory.
- Citing a Building Code section as an FDNY source.
- Hiding the missing-authority limitation in a generic disclaimer instead of tying it to the unanswered claim.


## Test 40

**Q:** Using the approved evidence and project facts, prepare a concise conclusion addressing: (a) the applicable requirement, (b) why it applies, (c) relevant exceptions considered, (d) unresolved assumptions, (e) additional evidence required, and (f) the resulting design constraint.

**Ideal answer:** Permitext should produce a compact research memo whose structure mirrors the evidence chain. It should first state the governing requirement and cite the exact approved section/table. It should then connect the project facts to the scope of that provision, explaining why the rule applies. Every relevant exception present in the evidence should be tested condition-by-condition and marked as applicable, inapplicable, or unresolved. Assumptions must be labeled as assumptions rather than facts. Any missing definition, table, cross-reference, project dimension, occupancy fact, or outside authority that could change the result must be listed under additional evidence required. The final design constraint should be no broader than the supported conclusion - for example, 'provide two remote exit access doorways from this space' rather than 'the floor complies with Chapter 10.' If the unresolved items are outcome-determinative, the memo should issue a conditional conclusion rather than a definitive one.

**Expected citations:**
- Every substantive legal proposition should cite the exact approved NYC code section, table, note, definition, or other approved governing source supporting it
- Project facts should be attributed to the project record, not cited as code
- Assumptions and missing evidence should be separately labeled and should not be presented as citations

**Important qualifications:** This is a synthesis test. Citation presence alone is not enough; citations must actually support the propositions for which they are used. Permitext should preserve code edition/effective-date/source metadata in the research record.

**Claims Permitext must avoid:**
- Producing a definitive compliance statement when an outcome-determinative assumption is unresolved.
- Citing project notes as governing law.
- Introducing requirements not contained in or logically supported by the approved evidence.
- Using citations that merely mention the topic but do not support the claim.
- Turning a narrow issue conclusion into a whole-project compliance certification.

# Permitext Research Benchmark v2 — 40 NYC Building Code Test Cases

Status: corrected working benchmark for knowledgeable-human review. This file does not replace the preserved original.

Purpose: benchmark Permitext Research against defensible, evidence-bounded answers.

Benchmark basis:
- 2022 New York City Construction Codes, effective November 7, 2022.
- Questions involving existing buildings are written to test whether Permitext identifies the governing current alteration/prior-code framework instead of silently applying future-effective law.
- The "Ideal answer" is the minimum expected substantive answer, not a script that Permitext must reproduce word-for-word.
- "Expected citations" identifies the authority a strong answer should retrieve/cite. A citation is not considered correct merely because it is topically related; it must support the proposition.
- "Important qualifications" identifies facts, scope limits, exceptions, or authority gaps that should keep Permitext from overstating the result.
- "Claims Permitext must avoid" is a negative benchmark for hallucination, overreach, wrong-code use, and unsupported compliance claims.

Evaluation principle: A good answer is allowed to stop and say that the evidence or project facts are insufficient. In those cases, refusing to overstate the conclusion is part of the correct answer.

Evaluation layers:
- **Retrieval:** With no pinned evidence, Permitext should automatically retrieve the controlling enacted provisions identified as required. Conditional and supporting authorities should be retrieved only when the claim or project facts make them material.
- **Answer:** The answer may use different wording from the ideal answer, but it must satisfy the required conclusions, preserve the stated qualifications, and avoid every prohibited claim.
- **Citation entailment:** A citation passes only when its exact enacted text supports the proposition attached to it. Topical similarity is not sufficient.
- **Evidence boundaries:** Project facts, assumptions, incorporated standards, future-effective law, and outside-agency material must retain distinct source roles. They must not silently become current governing NYC Construction Code evidence.

Citation labels:
- **Required:** The answer cannot pass without this authority when making the benchmark's principal conclusion.
- **Conditional:** Required only when the answer makes the identified conditional claim or when the relevant project fact is present.
- **Supporting:** Helpful context, but not independently required for the principal conclusion.
- **Outside authority:** Not controlling Construction Code evidence unless separately obtained, classified, and authorized in the applicable corpus.


## Test 01

**Q:** A 1,200 sf space is used as a small architectural office with 12 employees. Under the applicable 2022 NYC Building Code provisions, what occupancy group should it be classified as, and why?

**Ideal answer:** The space should ordinarily be classified as Group B. NYC BC §304.1 places office and professional-service uses in Business Group B, and an architectural office is a conventional professional office use. The stated 1,200 sf area and 12-person staffing do not, by themselves, create a different occupancy classification. Occupant load must still be calculated independently for means-of-egress and other code purposes; the actual number of employees is not automatically the code occupant load. If the office contains another materially different use - for example, a large training room, public assembly area, laboratory, fabrication shop, or retail component - that portion may require separate classification or mixed-occupancy analysis. On the facts given, however, Group B is the defensible classification.

**Expected citations:**
- **Required:** NYC BC §304.1 - Business Group B
- **Supporting:** NYC BC §302.1 - Classification of structures or portions of structures
- **Conditional:** NYC BC §1004.1, §1004.1.3, and Table 1004.1.3 - Design occupant load and areas without fixed seating, if the answer evaluates calculated occupant load

**Important qualifications:** This conclusion assumes the space is genuinely used as a professional architectural office and that no significant secondary use changes the classification. The employee count should not be substituted for the calculated occupant load where the code requires an occupant-load calculation.

**Claims Permitext must avoid:**
- Calling the office Group A merely because employees meet in conference rooms.
- Treating 12 employees as the final code occupant load without applying the applicable occupant-load provisions.
- Claiming the entire building is Group B when only the 1,200 sf space has been described.


## Test 02

**Q:** A community room in a residential building is used by residents for meetings, parties, classes, and occasional events. How should the space be classified, and what additional facts are needed before reaching a conclusion?

**Ideal answer:** Based on the stated use, the community room has an assembly function, and Group A-3 is the initial classification to evaluate because NYC BC §303.4 specifically includes community halls and assembly uses involving recreation or other social activities. However, there is not enough information to conclude that it must be classified as A-3. Because it is within a residential building, BC §303.1.3 is particularly important: an assembly room with an occupant load of fewer than 75 persons that is accessory to another occupancy may be classified as Group B or as part of the primary occupancy - potentially the building's Group R occupancy. The key additional facts are the room's floor area and calculated occupant load, whether the room is truly accessory to the residential occupancy, whether its use is limited to residents and their guests or independently operated/open to others, and the actual configurations and activities anticipated. Because BC §302.1 requires a multipurpose room to comply with requirements applicable to each purpose for which it will be occupied, those different configurations can matter. The defensible conclusion is therefore: potential A-3 assembly use, but final classification cannot be determined until accessory-use status and occupant load are established.

**Expected citations:**
- **Required:** NYC BC §303.4 - Assembly Group A-3
- **Required:** NYC BC §303.1.3 - Small assembly spaces accessory to another occupancy
- **Required:** NYC BC §302.1 - General occupancy classification and multipurpose spaces
- **Conditional:** NYC BC §1004.1.3 and Table 1004.1.3 - Areas without fixed seating, when calculating the room's occupant load

**Important qualifications:** The room's name is not controlling; actual use, occupant load, and relationship to the primary residential occupancy matter. Different furniture arrangements or event types may produce different occupant loads.

**Claims Permitext must avoid:**
- Automatically classifying every residential community room as Group A-3.
- Automatically treating it as Group R solely because residents use it.
- Using the actual attendance at a typical event instead of the code-calculated occupant load where the code requires calculation.
- Ignoring multipurpose configurations.


## Test 03

**Q:** A building contains residential apartments, ground-floor retail, and a management office that serves the building. Under the applicable enacted provisions, explain how the different occupancies should be treated.

**Ideal answer:** The apartments, retail area, and management office should first be classified by actual use: apartments ordinarily fall within Group R-2 under §310.4, retail sales within Group M under §309.1, and the management office within Group B under §304.1. The management office is not automatically an accessory occupancy merely because it serves the building. It may be treated under §508.2 only if it is ancillary to a principal occupancy and satisfies the accessory-occupancy conditions, including §508.2.3's story-based area limits. The residential and retail uses must then be evaluated under an applicable mixed-occupancy method. Under §508.3, nonseparated occupancies are governed by the most restrictive applicable requirements as prescribed there; if the separated-occupancy method is selected, §508.4 and Table 508.4 govern the required separations. The stated facts establish multiple uses but do not establish which mixed-occupancy method is used or whether the office qualifies as accessory.

**Expected citations:**
- **Required:** NYC BC §304.1 - Group B
- **Required:** NYC BC §309.1 - Group M
- **Required:** NYC BC §310.4 - Group R-2
- **Required:** NYC BC §508.2 and §508.2.3 - Accessory occupancies and allowable building area
- **Required:** NYC BC §508.3 and §508.4 - Nonseparated and separated occupancy methods
- **Conditional:** NYC BC Table 508.4 - Required separation when the separated-occupancy method is used
- **Supporting:** NYC BC §302.1 - General occupancy classification

**Important qualifications:** The area of each use, story arrangement, construction type, sprinkler status, whether the office serves only building management, and the chosen separated/nonseparated strategy are needed before determining all consequences.

**Claims Permitext must avoid:**
- Calling the entire building Group R because residential is the dominant use.
- Assuming the management office is automatically accessory without checking §508.2.
- Assuming mixed occupancies always require fire-resistance-rated separation.
- Using Table 508.4 before determining whether the separated-occupancy method is actually being used.


## Test 04

**Q:** A 500 sf office supports a much larger residential occupancy. Can it be treated as an accessory occupancy instead of a separate occupancy? Explain the conditions that must be checked.

**Ideal answer:** Potentially yes, but the 500 sf size alone is not enough. The office should first be classified as Group B under §304.1. It may then be treated as an accessory occupancy under §508.2 only if it is ancillary to the principal residential occupancy and complies with all accessory-occupancy conditions. Under §508.2.3, the baseline rule is that aggregate accessory occupancies on the story may not exceed 10 percent of that story's building area and may not exceed the applicable nonsprinklered tabular allowable-area value; any claimed exception to the 10-percent limit must itself be established. Whether separation is required must be checked under §508.2.4. The office must also genuinely support the principal use rather than operate as a separate principal use or independent tenancy.

**Expected citations:**
- **Required:** NYC BC §304.1 - Group B
- **Required:** NYC BC §508.2 - Accessory occupancies
- **Required:** NYC BC §508.2.3 - Allowable building area for accessory occupancies
- **Conditional:** NYC BC §508.2.4 - Separation of accessory occupancies, as applicable

**Important qualifications:** The total floor area of the story and the aggregate area of all accessory occupancies on that story are needed. The relationship between the office and residential operation must also be established.

**Claims Permitext must avoid:**
- Saying every management office in a residential building is automatically Group R.
- Checking only whether 500 sf is 'small.'
- Applying the accessory percentage to the entire building when the provision requires a story-based calculation.
- Ignoring other accessory uses on the same story.


## Test 05

**Q:** What must be established before this room can be treated as an incidental use rather than a separate occupancy? Identify the facts that control the determination.

**Ideal answer:** The room can be treated as an incidental use only if its actual function is one of the uses listed by §509.1 and Table 509 and all prescribed conditions are satisfied. 'Incidental use' is not a general label for any small or secondary room. The use must also comply with §509.3's building-wide 10-percent area limit and the separation, automatic sprinkler protection, or both required by §509.4 and the applicable Table 509 row. The controlling facts therefore include the room's actual function, contents or hazards, area, the building area, the occupancy in which it occurs, sprinkler protection, and required separation. If the room is not listed, §509 supplies no basis for calling it incidental; it must instead be analyzed under its occupancy classification or another applicable provision.

**Expected citations:**
- **Required:** NYC BC §509.1 and Table 509 - Listed incidental uses and required separation/protection
- **Required:** NYC BC §509.3 - Building-wide area limitation
- **Required:** NYC BC §509.4 - Separation and protection
- **Supporting:** NYC BC §509.2 and §302.1 - Occupancy classification of incidental uses and general classification

**Important qualifications:** The exact room use is essential. Permitext should distinguish 'accessory occupancy' under §508 from 'incidental use' under §509 because they are different code concepts with different tests.

**Claims Permitext must avoid:**
- Calling a room incidental merely because it is small, secondary, or used by building staff.
- Using 'accessory' and 'incidental' interchangeably.
- Inventing an incidental-use category not listed in Table 509.
- Ignoring a table condition such as fire separation or automatic sprinkler protection.


## Test 06

**Q:** A 2,400 sf restaurant contains dining, kitchen, storage, and restroom areas. Explain how the occupant load should be calculated and whether different occupant-load factors need to be applied to different portions.

**Ideal answer:** The design occupant load must be determined under §1004.1. For a restaurant containing more than one function, §1004.1.2 requires the occupant load to be based on the sum of the calculated loads of the different functional areas. Each area without fixed seating should therefore be divided by the applicable net or gross floor-area allowance in Table 1004.1.3, rather than applying one restaurant factor to the entire 2,400 sf. Dining, kitchen, storage, and any bar or standing areas may have different listed factors. Fixed seating, if present, is calculated under §1004.3 instead. Restrooms are ordinarily support spaces rather than assigned the dining-floor factor, but the enacted table's floor-area basis and the actual layout must control. Staffing, reservations, or the intended number of patrons do not replace the code calculation.

**Expected citations:**
- **Required:** NYC BC §1004.1 - Design occupant load
- **Required:** NYC BC §1004.1.2 - Areas with multiple functions
- **Required:** NYC BC §1004.1.3 and Table 1004.1.3 - Areas without fixed seating and maximum floor-area allowances per occupant
- **Conditional:** NYC BC §1004.3 - Fixed seating, if fixed seating is present

**Important qualifications:** Permitext needs the net/gross area of each use, seating arrangement, presence of fixed seating, bar/standing areas, and any spaces with unusual functions. The applicable table specifies whether a factor uses net or gross floor area.

**Claims Permitext must avoid:**
- Using one occupant-load factor for the entire restaurant without examining distinct functions.
- Using the actual number of seats as the complete occupant load where non-fixed seating provisions apply.
- Using employee count or anticipated patron count as a substitute for the code calculation.
- Mixing net and gross factors.


## Test 07

**Q:** A Group A space has a calculated occupant load of 72 people. Under the applicable enacted provisions, determine the minimum number of exits or exit access doorways required from the space and identify conditions that could change the answer.

**Ideal answer:** Under §1006.2.1 and Table 1006.2.1, a Group A space cannot use the one-exit or one-exit-access-doorway allowance when its occupant load exceeds 49. A Group A space with a calculated occupant load of 72 therefore ordinarily requires at least two exits or exit access doorways from the space. This is a room-or-space-level conclusion, not a conclusion that the story or building needs only two exits. The common-path limitation and any applicable exception must also be satisfied. If the question is extended to egress from the story or occupied roof, §1006.3 supplies a separate analysis.

**Expected citations:**
- **Required:** NYC BC §1006.2.1 and Table 1006.2.1 - Egress based on occupant load and common path of egress travel distance
- **Conditional:** NYC BC §1006.3 - Egress from stories or occupied roofs, when story-level egress is evaluated

**Important qualifications:** Sprinkler status, common-path distance, whether the space is at the level of exit discharge, and whether exits discharge directly to the exterior may affect available exceptions. The answer must remain bounded by the enacted provisions Permitext retrieves and cites.

**Claims Permitext must avoid:**
- Saying '72 occupants always requires two building exits.'
- Treating room-level exit-access requirements as the same as story-level exit requirements.
- Ignoring common-path limits or direct-exterior-exit exceptions.
- Answering from occupant load alone without retrieving and applying the controlling table.


## Test 08

**Q:** A tenant space has two exits, but occupants initially travel through the same corridor before reaching a choice between them. Does the common path comply? Explain exactly what distance should be measured and what project information is still required.

**Ideal answer:** The existence of two eventual exits does not eliminate common path of egress travel. Under BC §1006.2.1, common path is the portion of exit access that occupants must traverse before two separate and distinct paths of egress travel to two exits or exit access doorways become available. The measured distance therefore begins at the most remote point subject to the common path and follows the natural path of travel to the point where a genuine choice between two separate egress paths first exists. Compliance cannot be determined from the statement that there are two exits. Permitext must know the occupancy classification, sprinkler status, calculated occupant load where the table differentiates by load, and the actual measured common-path distance, and it must compare those facts with Table 1006.2.1.

**Expected citations:**
- **Required:** NYC BC §202 - Definition of common path of egress travel
- **Required:** NYC BC §1006.2.1 and Table 1006.2.1 - Common-path limits and spaces with one exit or exit access doorway

**Important qualifications:** The geometry matters: the choice point must represent two separate and distinct egress paths, not merely two doors that later converge. Measurement must follow the code's path-of-travel rules, not a straight-line dimension.

**Claims Permitext must avoid:**
- Measuring common path between the two exits.
- Assuming two exits means there is zero common path.
- Using exit-access travel distance limits as if they were common-path limits.
- Declaring compliance without the occupancy, sprinkler condition, and measured common-path distance.


## Test 09

**Q:** Can exit-access-travel-distance compliance be determined from the stated facts? Explain how the distance must be measured and the effect, if any, of sprinkler protection.

**Ideal answer:** Compliance is determined under BC §1017 by measuring exit access travel distance from the most remote occupiable point along the natural and unobstructed path of horizontal and vertical egress travel to the entrance to an exit. The measured distance must then be compared with the maximum permitted for the occupancy in Table 1017.2. Automatic sprinkler protection can increase the permitted distance for many occupancies, but only where the table or related provision expressly provides the sprinklered allowance and the building is equipped with the qualifying sprinkler system. Without the actual occupancy, measured travel distance, sprinkler-system status, and the applicable table row, Permitext should not state that the floor complies.

**Expected citations:**
- **Required:** NYC BC §1017.1 - General exit access travel distance
- **Required:** NYC BC §1017.2 and Table 1017.2 - Exit access travel distance limitations
- **Required:** NYC BC §1017.3 - Measurement
- **Conditional:** NYC BC §903.3.1.1 - NFPA 13 sprinkler system, when the applicable travel-distance allowance depends on that system

**Important qualifications:** Travel distance is not a straight-line radius. Interior configuration, intervening rooms, vertical travel within permitted exit access stairs, occupancy-specific limits, and the type of sprinkler system can affect the result.

**Claims Permitext must avoid:**
- Adding a generic sprinkler 'bonus' not contained in the table.
- Measuring a straight line through walls.
- Confusing exit access travel distance with common path or dead-end length.
- Calling the floor compliant without an actual measured distance.


## Test 10

**Q:** Two required exits are located 28 feet apart in a space having a maximum diagonal dimension of 78 feet. Under the applicable enacted provisions, are the exits sufficiently separated?

**Ideal answer:** Under the general separation rule of BC §1007.1.1, two required exits or exit access doorways must be separated by at least one-half of the maximum overall diagonal dimension of the area served, measured in a straight line between the exits or exit access doorways. One-half of 78 feet is 39 feet, so 28 feet would not satisfy the general one-half-diagonal rule. If the building is equipped throughout with the qualifying automatic sprinkler system, §1007.1.1 permits the separation to be reduced to not less than one-third of the maximum diagonal where that sprinkler exception applies. One-third of 78 feet is 26 feet; in that condition, 28 feet would satisfy the numerical separation test. Therefore the answer is: no under the general rule; potentially yes under the qualifying sprinklered rule, subject to the exact conditions and measurement required by the section.

**Expected citations:**
- **Required:** NYC BC §1007.1.1 - Two exits or exit access doorways
- **Conditional:** NYC BC §903.3.1.1 or §903.3.1.2 - Qualifying sprinkler systems referenced by the one-third-diagonal exception

**Important qualifications:** Permitext must confirm that the two points being measured are the code-required exits or exit access doorways, that the 78-foot diagonal is the correct maximum overall diagonal of the area served, and that the sprinkler system qualifies for the reduced separation.

**Claims Permitext must avoid:**
- Saying 28 feet complies without checking sprinkler protection.
- Measuring along the travel path instead of the separation method prescribed by §1007.1.1.
- Applying the one-third rule to a partially sprinklered building if the exception requires protection throughout.
- Concluding that separation compliance proves the entire egress arrangement is compliant.


## Test 11

**Q:** Can two stairs contained within the same scissor-stair enclosure satisfy the requirement for two separate exits? Identify every provision or condition that must be considered before answering.

**Ideal answer:** Generally no. BC §1007.1.1 states that stairs sharing a common wall, floor, ceiling, scissor-stair assembly, or other enclosure are counted as one exit stairway. They can be counted separately only if an explicit exception applies and every condition of that exception is met. For example, the Group R-2 exception requires the prescribed 2-hour masonry or masonry-equivalent stair enclosures and separating construction, plus exit doors at least 15 feet apart. The separate Group B exception is limited by building construction type, height, story area, travel distance, stair construction, and 15-foot door spacing. Without the occupancy and complete construction and geometry, the defensible answer is that the general rule counts the assembly as one exit stairway and the facts are insufficient to establish an exception. Broader story-egress and interior-exit-stairway compliance must be evaluated separately if the answer goes beyond that counting question.

**Expected citations:**
- **Required:** NYC BC §1007.1.1 - General shared-stair counting rule and NYC Group R-2 and Group B exceptions
- **Conditional:** NYC BC §1006.3 - Egress from stories, if the answer evaluates the number of exits from the story
- **Conditional:** NYC BC §1023 - Interior exit stairways and ramps, if the answer evaluates enclosure, continuity, or discharge compliance
- **Conditional:** NYC BC §713 - Shaft enclosures, only where the enacted text makes it applicable to the configuration

**Important qualifications:** This is a configuration-sensitive question. Stair separation at entry doors, common enclosure construction, rated separation between stair runs, discharge arrangement, penetrations, and whether the exits remain independent must be established from drawings and the complete applicable text.

**Claims Permitext must avoid:**
- Saying every scissor stair automatically counts as two exits.
- Saying scissor stairs can never count as two exits without checking the enacted NYC provisions.
- Using stair count alone without testing remoteness and enclosure requirements.
- Inferring compliance from a diagram without verifying the applicable code text.


## Test 12

**Q:** An egress door has a measured clear width of 32 inches and serves a calculated occupant load of 48. Do the stated facts and applicable enacted provisions establish that the door width is acceptable?

**Ideal answer:** Yes for the two stated width tests, subject to the listed qualifications. BC §1010.1.1.1 requires a minimum 32-inch clear opening for the ordinary door case and prescribes how that clear width is measured. BC §1005.3.2 ordinarily assigns other egress components a capacity factor of 0.2 inch per occupant, so 48 occupants require 9.6 inches of capacity; the 32-inch clear opening exceeds that capacity-derived value. This establishes that the stated door meets the ordinary minimum-clear-width and capacity calculations. It does not establish compliance with every door, accessibility, special-occupancy, hardware, distribution, or complete means-of-egress requirement.

**Expected citations:**
- **Required:** NYC BC §1010.1.1.1 - Door width and clear-width measurement
- **Required:** NYC BC §1005.3.2 - Capacity factor for other egress components
- **Supporting:** NYC BC §1005.1 - Minimum required egress capacity

**Important qualifications:** Confirm the door's actual clear opening, not nominal leaf size; the occupant load actually served by that door; any distribution assumptions; and any special occupancy or accessibility requirement.

**Claims Permitext must avoid:**
- Equating a 32-inch door leaf with a 32-inch clear opening.
- Checking only the 32-inch prescriptive minimum and ignoring capacity.
- Dividing the total floor occupant load equally among doors without a code-supported basis.
- Claiming the entire means of egress complies because this one door is wide enough.


## Test 13

**Q:** A door serves a room with a calculated occupant load of 55 and currently swings into the room. Does it need to swing in the direction of egress travel based on the stated facts?

**Ideal answer:** Not from the occupant-load fact alone. BC §1010.1.2.2 requires the door to swing in the direction of egress travel when it serves a Group F or H occupancy, a room or space with an occupant load of 75 or more, a room or space that requires more than one exit door, or an automated teller machine. A calculated occupant load of 55 is below the section's 75-person trigger. The door could nevertheless be required to swing in the direction of egress travel if the room is Group F or H or if its occupancy and egress conditions require more than one exit door. The room's occupancy classification and applicable exit-door requirement are therefore needed before reaching a definitive conclusion.

**Expected citations:**
- **Required:** NYC BC §1010.1.2.2 - Direction of swing
- **Conditional:** NYC BC §1006.2.1 and Table 1006.2.1 - Whether the room requires more than one exit or exit access doorway
- **Supporting:** NYC BC §1004.1 - Design occupant load, if the stated 55 has not already been established as the calculated occupant load

**Important qualifications:** The question states that 55 is the calculated occupant load. Occupancy group and whether the room requires more than one exit door remain necessary because either can independently trigger the direction-of-swing rule.

**Claims Permitext must avoid:**
- Using the room's seating count without confirming the code occupant load.
- Saying every egress door must swing outward.
- Applying a 50-person threshold that is not in the enacted 2022 NYC provision.
- Ignoring the independent Group F, Group H, multiple-exit-door, or automated-teller-machine triggers.


## Test 14

**Q:** A corridor serving an unspecified residential occupancy terminates 24 feet beyond the point where two egress paths become available. Is the dead-end condition permitted, and what occupancy- and sprinkler-dependent exceptions must be checked?

**Ideal answer:** Under BC §1020.4, a 24-foot dead end exceeds the general 20-foot limit, but the residential label is too broad for a final yes/no answer. If the occupancy is Group R-2, Exception 4 permits a dead end up to 40 feet, so 24 feet can comply without relying on the 50-foot sprinkler exception. If it is Group R-1 and the building is equipped throughout with an NFPA 13 system in accordance with §903.3.1.1, Exception 2 permits up to 50 feet. That sprinkler exception is limited to the occupancy groups it lists and is not a universal extension for every residential occupancy. Exception 3 can also permit a dead end whose length does not exceed 2.5 times the least corridor width. Permitext must establish the precise Group R classification, sprinkler condition, corridor width, and correct dead-end measurement before selecting an exception.

**Expected citations:**
- **Required:** NYC BC §1020.4 - General dead-end limit and Exceptions 2 through 4
- **Conditional:** NYC BC §903.3.1.1 - NFPA 13 sprinkler system referenced by the 50-foot exception
- **Supporting:** NYC BC §310.3 and §310.4 - Group R-1 and Group R-2 classification, when the precise residential group must be established

**Important qualifications:** Confirm the precise residential occupancy group, whether the path is a corridor governed by §1020, the least corridor width if Exception 3 is considered, whether the building is sprinklered throughout as required by Exception 2, and the correct measurement to the point where two egress paths become available.

**Claims Permitext must avoid:**
- Saying 24 feet always violates the code.
- Saying every sprinklered building or every residential occupancy gets a 50-foot dead end.
- Confusing dead-end length with common path or exit access travel distance.
- Measuring from the corridor end to the stair without identifying where two egress choices actually become available.


## Test 15

**Q:** What fire-resistance rating, if any, is required for this corridor? Explain how occupancy, sprinkler status, and occupant load affect the determination.

**Ideal answer:** The benchmark does not supply enough facts for a final rating. Permitext must first determine whether this is an interior corridor or a public corridor because NYC BC §1020.1 uses different rules for each. For an interior corridor, §1020.1.1 and Table 1020.1.1 establish the rating from the occupancy, occupant load served by the corridor, and whether the building has the qualifying sprinkler system. For a public corridor, §1020.1.2 and Table 1020.1.2 establish the rating principally from occupancy, with specific table notes and conditions; the interior-corridor occupant-load/sprinkler columns must not be imported into that analysis. If a rating is required, interior corridor walls comply with the fire-partition provisions of §708, public corridor walls comply with the fire-barrier provisions of §707, and protected openings are evaluated under §716.5 and Table 716.5. Without the corridor type, occupancy, occupant load served where relevant, sprinkler status where relevant, and any table-note facts, the correct result is insufficient information rather than a guessed hourly rating.

**Expected citations:**
- **Required:** NYC BC §1020.1 - Corridor construction and the distinction between interior and public corridor wall construction
- **Conditional:** NYC BC §1020.1.1 and Table 1020.1.1 - Interior corridor fire-resistance rating, when the corridor is an interior corridor
- **Conditional:** NYC BC §1020.1.2 and Table 1020.1.2 - Public corridor fire-resistance rating, when the corridor is a public corridor
- **Conditional:** NYC BC §708, §707, and §716.5/Table 716.5 - Rated interior corridor walls, public corridor walls, and opening protectives, respectively, when a rating is required

**Important qualifications:** The standalone case supplies none of the project facts needed to choose a table row. For an interior corridor, the occupant load is the load served by the corridor, not necessarily the load of one room. Public-corridor classification and the notes to Table 1020.1.2 can materially change the analysis. Special occupancy chapters may impose additional corridor requirements.

**Claims Permitext must avoid:**
- Assuming every egress corridor is 1-hour rated.
- Assuming sprinklers always eliminate corridor ratings.
- Using the building's total occupant load when the table requires the load served by the corridor.
- Stopping at the wall rating without checking required opening protection if a rated corridor is required.


## Test 16

**Q:** A vertical mechanical shaft connects four stories. Under the 2022 NYC Building Code, what fire-resistance rating is required for the shaft enclosure?

**Ideal answer:** Under NYC BC §713.4, a shaft enclosure penetrating three stories or more must have a fire-resistance rating of not less than 2 hours, while one penetrating fewer than three stories must be not less than 1 hour. Basements and cellars count as connected stories; mezzanines do not. The shaft-enclosure rating also cannot be less than that of the floor assembly penetrated, but need not exceed 2 hours. On the stated fact that this mechanical shaft connects four stories, the baseline enclosure rating is therefore 2 hours. Permitext must still verify that §713 requires an enclosure for this condition and whether an exception applies before claiming complete compliance.

**Expected citations:**
- **Required:** NYC BC §713.4 - Fire-resistance rating of shaft enclosures
- **Supporting:** NYC BC §713.1 - General scope of shaft enclosure requirements
- **Conditional:** NYC BC Table 601 and the provision governing the penetrated floor assembly - if needed to determine whether a rating greater than 2 hours controls

**Important qualifications:** The higher-rating threshold is three stories, so a shaft connecting four stories plainly reaches it. Basements and cellars count; mezzanines do not. Exceptions for particular penetrations, ducts, or special shaft conditions must be evaluated separately.

**Claims Permitext must avoid:**
- Calling every mechanical shaft 2-hour rated regardless of height.
- Counting only floor openings and ignoring the code's method for stories connected.
- Assuming a shaft enclosure is required without checking applicable exceptions.
- Ignoring a higher rating required by another provision.


## Test 17

**Q:** If a 1-hour fire barrier is required, what rating is required for a door located within that barrier? Do the stated project facts fully answer the question?

**Ideal answer:** No single door rating follows from the phrase "1-hour fire barrier." NYC BC §716.5 and Table 716.5 assign the opening-protective rating by the barrier's code function. For a 1-hour fire barrier enclosing a shaft, an exit access stair or ramp, an interior exit stair or ramp, or an exit passageway, Table 716.5 requires a 1-hour fire door. For "other fire barriers" and public corridor walls rated 1 hour, the table requires a 3/4-hour fire door. The stated project facts do not identify the barrier's function, so they are insufficient to select between those rows. Permitext should retrieve the provision requiring the barrier and request the barrier's project application before stating the door rating.

**Expected citations:**
- **Required:** NYC BC §716.5 and Table 716.5 - Fire door and shutter assembly ratings by wall-assembly application
- **Conditional:** The NYC BC section requiring the specific 1-hour fire barrier - required to identify the applicable Table 716.5 row
- **Supporting:** NYC BC §§716.5.1 through 716.5.9 - Testing, glazing, installation, and operating features, when the answer addresses more than the hourly rating

**Important qualifications:** The barrier's purpose is missing from this case and is essential. Door assemblies also have requirements for labeling, glazing, closing/latching, and other features that are not established merely by the hourly rating.

**Claims Permitext must avoid:**
- Stating 'a 1-hour wall always needs a 45-minute door.'
- Selecting the opening rating without identifying the assembly application.
- Assuming an unrated door is acceptable because the wall is sprinklered.
- Claiming full door compliance from the fire-protection rating alone.


## Test 18

**Q:** A residential occupancy is located directly above a commercial occupancy. Determine whether a fire-resistance-rated separation is required and how its rating should be established.

**Ideal answer:** A residential use above a commercial use does not, by itself, establish a required hourly separation. Permitext must classify both uses and determine the mixed-occupancy method selected under NYC BC §508. If the project uses separated occupancies, §508.4 and Table 508.4 establish the required separation between the actual occupancy groups, including the applicable sprinklered or nonsprinklered value; because the uses are stacked, the separation is implemented as the horizontal assembly and supporting construction required by the applicable provisions. If the project qualifies for and uses the nonseparated-occupancy method in §508.3, Table 508.4 does not independently require a separation between those occupancies, but the entire nonseparated area is subject to the most restrictive applicable requirements and the height and area rules of that method. The standalone case omits the commercial occupancy group, construction type, sprinkler condition, story areas, and selected mixed-occupancy method, so no hourly rating can be stated.

**Expected citations:**
- **Required:** NYC BC §508.1 - Mixed use and occupancy framework
- **Conditional:** NYC BC §508.3 - Nonseparated occupancies, when that method is selected
- **Conditional:** NYC BC §508.4 and Table 508.4 - Separated occupancies and required separation, when that method is selected
- **Conditional:** NYC BC §711 - Horizontal assemblies and supporting construction, when a rated horizontal separation is required

**Important qualifications:** The commercial use must be identified precisely - Group M, B, A, etc. - because Table 508.4 values vary. Incidental uses and accessory occupancies should not be confused with the separated-occupancy analysis.

**Claims Permitext must avoid:**
- Saying residential over commercial always requires a 1-hour floor.
- Assuming no separation is required without confirming that the nonseparated method is permitted and being used.
- Using a Table 508.4 value without identifying both occupancy groups and sprinkler condition.
- Ignoring structural/supporting requirements of a rated horizontal assembly.


## Test 19

**Q:** Can the building be classified as Type IIA based on its structural framing, exterior walls, floor construction, and roof construction? Identify any project information needed for a definitive answer.

**Ideal answer:** The case supplies no actual element ratings or assemblies, so Type IIA cannot be confirmed. NYC BC §602.2 establishes the Type I/II noncombustible-construction framework, while Table 601 supplies the minimum fire-resistance ratings for the structural frame, bearing walls, floor construction and associated secondary members, and roof construction and associated secondary members. Table 602 separately establishes exterior-wall ratings from occupancy, construction type, and fire-separation distance. Permitext must compare every required Type IIA rating with an identified approved assembly, test, listed design, or code-permitted calculation for the actual element. If any element rating, supporting assembly, exterior-wall occupancy, or fire-separation distance is absent, Type IIA remains only a candidate classification. Material names such as "concrete," "steel," or "CMU" do not establish an hourly rating.

**Expected citations:**
- **Required:** NYC BC §602.2 - Types I and II construction
- **Required:** NYC BC Table 601 - Fire-resistance rating requirements for building elements
- **Required:** NYC BC Table 602 - Exterior-wall ratings based on fire-separation distance
- **Conditional:** NYC BC §703 and the specific approved test, listed design, or calculation provision used to establish an element's rating - when the project identifies that rating method

**Important qualifications:** Construction-type classification depends on rated performance, not simply combustibility or material names. Any permitted reductions, sprinkler modifications, special structural conditions, and exterior-wall distance must be supported by the enacted provisions.

**Claims Permitext must avoid:**
- Calling a concrete-and-steel building Type IIA solely from its materials.
- Ignoring secondary structural members.
- Ignoring Table 602 exterior-wall requirements.
- Assuming an assembly's rating without a tested/listed assembly or code-calculated basis.


## Test 20

**Q:** A sprinklered Group R-2 building is proposed at 11 stories. Determine whether the 2022 NYC Building Code permits the proposed number of stories and identify any missing project facts.

**Ideal answer:** The proposed 11 stories cannot be approved from "Group R-2 + sprinklered" alone. NYC BC §504.4 and Table 504.4 establish the allowable number of stories above grade plane from occupancy group, construction type, and the sprinkler-system category represented by the applicable table column. The construction type and qualifying sprinkler standard are missing. Permitext must also check the actual building height against §504.3 and Table 504.3; satisfying the story limit does not establish compliance with the height-in-feet limit. If the highest occupied floor is more than 75 feet above the lowest level of fire department vehicle access, the high-rise provisions may also apply, but story count alone does not establish that condition. The correct benchmark result is insufficient project information for a final determination.

**Expected citations:**
- **Required:** NYC BC §504.4 and Table 504.4 - Allowable number of stories above grade plane
- **Required:** NYC BC §504.3 and Table 504.3 - Allowable building height in feet
- **Conditional:** NYC BC §903.3.1.1 - When the claimed table allowance depends on an NFPA 13 system
- **Conditional:** NYC BC §202 definition of HIGH-RISE BUILDING and §403 - Only if the occupied-floor/fire-department-access measurement makes the building a high-rise

**Important qualifications:** Construction type is indispensable. Permitext must distinguish number of stories above grade plane from total levels and must separately evaluate height in feet.

**Claims Permitext must avoid:**
- Saying all sprinklered R-2 buildings may be 11 stories.
- Checking story count but not height in feet.
- Assuming any sprinkler system qualifies for the table's sprinklered allowance.
- Calling an 11-story building high-rise solely because of story count.


## Test 21

**Q:** Determine the allowable area for this building based on occupancy, construction type, frontage, and sprinkler status. Show which increases apply rather than simply giving the final number.

**Ideal answer:** No numerical allowable area can be calculated because the case supplies no occupancy group, construction type, story count or areas, qualifying sprinkler-system category, building perimeter, qualifying frontage length, or frontage-space widths. Permitext should select the tabular allowable area factor from NYC BC Table 506.2 for the actual occupancy, construction type, and sprinkler condition, then use the building-configuration rule that applies: §506.2.1 for a single-occupancy one-story building, §506.2.2 for mixed occupancies in a one-story building, §506.2.3 for a single-occupancy multistory building, or §506.2.4 for mixed occupancies in a multistory building. If a frontage increase is claimed, §506.3.3 requires the increase to be calculated from the qualifying perimeter proportion and frontage width; it is not a generic flat percentage. A passing answer should show the table factor, applicable configuration equation, frontage inputs/calculation, sprinkler basis, story areas, and resulting allowable area before comparing it with actual area.

**Expected citations:**
- **Required:** NYC BC §506.2 and Table 506.2 - Allowable area determination and tabular allowable area factor
- **Conditional:** NYC BC §§506.2.1 through 506.2.4 - The one-story/multistory and single-/mixed-occupancy rule matching the project configuration
- **Conditional:** NYC BC §506.3 and §506.3.3 - Frontage qualification and amount of frontage increase, when a frontage increase is claimed
- **Conditional:** NYC BC §508 - Mixed-occupancy method, when more than one occupancy is present

**Important qualifications:** The exact formula depends on building configuration and code table structure. Permitext needs construction type, occupancy, actual story areas, number of stories, sprinkler standard, perimeter length, qualifying frontage length, and open-space widths.

**Claims Permitext must avoid:**
- Applying a generic '200% sprinkler increase' without tracing the applicable §506 method.
- Treating all site frontage as qualifying frontage.
- Using zoning lot area as building-code allowable building area.
- Giving one final number without showing the inputs and modifications.


## Test 22

**Q:** Under the 2022 NYC Building Code definitions, determine whether this level counts as a story above grade plane and identify the project elevations needed for the determination.

**Ideal answer:** The standalone case omits the project elevations, so Permitext cannot assign the level's status. Under the 2022 NYC BC §202 definitions, grade plane is generally the legally established curb level measured at the center of the building front, averaged at the centers of each front where the building faces more than one street; the definition supplies an adjoining-grade averaging method for its stated exceptions. A story with its finished floor entirely above grade plane is a story above grade plane. NYC also distinguishes a basement, which has less than one-half of its clear height below grade plane and is expressly counted as a story above grade plane, from a cellar, which has one-half or more of its clear height below grade plane and is not counted as a story in measuring building height. Permitext therefore needs the applicable curb or perimeter elevations, finished-floor and finished-ceiling elevations, and the building-front/setback facts needed by the grade-plane definition. Drawing labels such as "basement" or "cellar" do not control.

**Expected citations:**
- **Required:** NYC BC §202 - Definitions of GRADE PLANE, STORY, STORY ABOVE GRADE PLANE, BASEMENT, and CELLAR

**Important qualifications:** The project elevations are not included in this standalone case. The calculation needs the elevation inputs required by the NYC grade-plane definition, not automatically every exterior-wall elevation. Zoning definitions of basement/cellar must not be substituted for Building Code definitions unless the question is a zoning question.

**Claims Permitext must avoid:**
- Determining story status from the room/floor name on the drawings.
- Using one spot grade without applying the grade-plane definition.
- Substituting Zoning Resolution definitions for Building Code definitions.
- Assuming every below-grade level is excluded from stories above grade plane.


## Test 23

**Q:** The highest occupied floor is 74 feet above the lowest level of fire department vehicle access. Does the building meet the code definition of a high-rise building? Explain the measurement controlling the determination.

**Ideal answer:** No, not from the stated elevation. The NYC Building Code definition of a high-rise building is based on whether an occupied floor is located more than 75 feet above the lowest level of fire department vehicle access. At 74 feet, the highest occupied floor is below that threshold. The measurement is to the occupied floor elevation specified by the definition, not to the roof, parapet, bulkhead, or overall building height. Permitext should nevertheless verify that the identified fire-department-access elevation is truly the lowest qualifying level of fire department vehicle access and that no other occupied floor is higher than the one stated.

**Expected citations:**
- **Required:** NYC BC §202 - Definition of HIGH-RISE BUILDING
- **Conditional:** NYC BC §403 - High-rise building requirements, only if the §202 definition is met

**Important qualifications:** The result turns on the exact defined measurement. Overall architectural height and number of stories do not substitute for the high-rise definition.

**Claims Permitext must avoid:**
- Calling the building high-rise because it is close to 75 feet.
- Measuring to the roof or parapet instead of the occupied floor.
- Using grade plane instead of the lowest level of fire department vehicle access if the definition uses the latter.
- Assuming story count alone establishes high-rise status.


## Test 24

**Q:** Does an accessible route need to connect the building entrance to this particular room under the 2022 NYC Building Code Chapter 11 provisions?

**Ideal answer:** The case does not identify the room's use or level, so no room-specific yes/no conclusion is possible. NYC BC §1104.3 requires at least one accessible route to each portion of a building when the building or portion is required to be accessible, subject to its stated exceptions. Permitext must first establish that the room or portion is within Chapter 11's accessibility scope, identify its use and level, and test any room-, occupancy-, employee-work-area-, or multilevel exception. For residential common-use or public-use spaces serving Accessible, Type B+NYC, or Type B units, §§1107.3 and 1107.4 provide more specific scoping and route requirements. Section 1101.2 incorporates ICC A117.1 for technical design, but incorporation does not by itself answer whether this particular room is scoped to receive a route.

**Expected citations:**
- **Required:** NYC BC §1104.3 - Accessible routes to connected spaces, including its exceptions
- **Conditional:** The NYC BC Chapter 11 scoping section governing the identified room, use, occupancy, and story
- **Conditional:** NYC BC §§1107.3 and 1107.4 - Residential accessible spaces and routes, when the room serves covered residential units
- **Supporting:** NYC BC §1101.2 - Technical accessibility design in accordance with ICC A117.1 and the code
- **Conditional:** ICC A117.1-2009 accessible-route technical provisions - outside authority required only if their text is separately available in the authorized evidence package; the incorporated standard is referenced but not reproduced in the local enacted-code corpus

**Important qualifications:** The room function, floor level, new-versus-existing condition, occupancy, and any applicable exception must be known. For prior-code buildings and alterations, §1101.3 and related provisions may change the scoping analysis.

**Claims Permitext must avoid:**
- Saying every room in every building must be on an accessible route.
- Treating ADA scoping as automatically identical to NYC BC Chapter 11 scoping.
- Ignoring existing-building/alteration provisions.
- Concluding accessibility from route width alone.


## Test 25

**Q:** In a residential project containing 100 dwelling units, explain which categories of accessible units must be considered and what additional project information is necessary to calculate the required quantities.

**Ideal answer:** The 100-unit total alone is insufficient. Under NYC BC §1107.6, the Building Code categories to evaluate depend first on the residential occupancy group: Group R-1 provisions address Accessible units, Type B+NYC units, and Type B units; Group R-2 provisions address Type B+NYC units and Type B units; and qualifying Group R-3 buildings address Type B units. "Type A unit" is not a general unit-count category in these NYC residential scoping provisions and must not be substituted for Type B+NYC. Permitext needs the exact R occupancy, whether units are dwelling or sleeping units and transient or permanent, the number and distribution of units by story, elevator service, unit/story exemptions, and whether this is new construction or work in a prior-code building. It should then calculate each applicable category under the matching §1107.6 subsection. Funding or agency programs may impose separate unit categories or quantities, but those are outside authorities and must be stated separately.

**Expected citations:**
- **Required:** NYC BC §1107.6, §1107.6.1, §1107.6.2, and §1107.6.3 - Residential unit categories and scoping across the Group R branches that the question asks Permitext to compare
- **Required:** NYC BC §1107.6.1.1, §1107.6.1.2, §1107.6.2.1, and §1107.6.2.2 - Group-specific Accessible, Type B+NYC, and Type B quantity provisions needed to explain how the 100-unit input would be used after occupancy is known
- **Conditional:** NYC BC §1107.7 - Permitted reductions/exceptions for Type B units, when the project facts invoke them
- **Supporting:** NYC BC §202 - Definitions of Accessible unit, Type B+NYC unit, and Type B unit
- **Supporting:** NYC BC §1101.2 - Incorporation of ICC A117.1 for technical design criteria
- **Conditional:** NYC BC §1101.3 - Prior-code building provisions, when the work is an alteration to a prior-code building
- **Conditional:** ICC A117.1-2009 unit technical criteria - outside authority required only if separately available in the authorized evidence package; the incorporated standard is not reproduced in the local enacted-code corpus

**Important qualifications:** The standalone case supplies only the total unit count. Funding and program can add requirements outside the NYC Building Code, such as federal or state housing standards. Permitext must clearly distinguish those external standards from the NYC BC result.

**Claims Permitext must avoid:**
- Saying '100 units means X accessible units' without identifying the applicable residential scoping rule.
- Treating Type A, Type B, Accessible, ADA, and UFAS units as interchangeable labels.
- Applying federal funding requirements as if they were NYC Building Code text.
- Ignoring elevator and story/location conditions.


## Test 26

**Q:** Determine whether the maneuvering clearance at this door complies with the 2022 NYC Building Code accessibility requirements and identify the door-configuration facts needed.

**Ideal answer:** The case does not include the door configuration or measured clearances, so compliance cannot be determined. NYC BC §1101.2 establishes that accessible design must comply with ICC A117.1 and the Building Code. The applicable ICC A117.1-2009 §404.2.3 condition depends on the approach direction, hinge or latch side, push or pull side, door swing, and closer/latch conditions. Permitext must compare the required depth and side clearance for that exact condition with unobstructed field or drawing dimensions. If the door is within a Type B+NYC dwelling or sleeping unit, NYC BC §1107.2.1 also contains specific door provisions and modifications that can affect the analysis. There is no universal 18-inch or other single clearance for all door configurations.

**Expected citations:**
- **Required:** NYC BC §1101.2 - Accessibility design in accordance with ICC A117.1 and the code
- **Conditional:** NYC BC §1107.2.1 - Type B+NYC unit door and doorway provisions and modifications, when the door is within such a unit
- **Conditional:** ICC A117.1-2009 §404.2.3 and its applicable figures - outside authority required to determine the exact technical clearance only if that incorporated standard text is separately available in the authorized evidence package; it is not reproduced in the local enacted-code corpus

**Important qualifications:** Chapter 35 identifies ICC A117.1-09 as the incorporated edition. The benchmark must provide or authorize that standard's text before scoring exact A117.1 dimensions as a retrieval requirement. Door width, threshold, hardware, closing speed, and opening force are separate requirements and are not proven by maneuvering-clearance compliance.

**Claims Permitext must avoid:**
- Applying one 18-inch latch-side clearance to every door condition.
- Measuring from the nominal door leaf rather than the clear floor-space geometry required by the standard.
- Ignoring push-versus-pull side.
- Calling the entire doorway accessible based only on maneuvering clearance.


## Test 27

**Q:** Determine whether there is enough project information to conclude that this bathroom complies with the applicable accessibility requirements, and identify the dimensions that still need verification.

**Ideal answer:** The case supplies no bathroom dimensions, plan, or unit category, so the only defensible result is insufficient project information for a full compliance determination. Permitext must first identify the governing room/unit category. If this is a Type B+NYC dwelling or sleeping unit bathroom, NYC BC §1107.2.2 and its subsections directly govern the accessible route, operable parts, knee/toe clearance, overlap, lavatory, mirrors/medicine cabinets, water closet, and bathing fixture conditions, with §1107.2.1 governing relevant door conditions. For a bathroom governed directly by ICC A117.1, the applicable technical provisions depend on the room and fixture configuration. The missing-information checklist should be limited to the applicable configuration and include, as relevant: route and entry-door geometry; maneuvering clearances; turning or clear floor space where required; water-closet centerline, approach and clearance; grab-bar/reinforcement locations and heights; lavatory clear floor, knee/toe and height data; mirror/accessory heights and reach ranges; and bathtub/shower clearances, controls, seats, and grab bars. Permitext must not claim that this generic checklist identifies "every" required dimension until the governing bathroom type and fixture configuration are supplied.

**Expected citations:**
- **Required:** NYC BC §1101.2 - Accessibility design in accordance with ICC A117.1 and the code
- **Conditional:** NYC BC §1107.2.2 and applicable subsections - Type B+NYC unit toilet and bathing room requirements, when that is the governing unit category
- **Conditional:** NYC BC §1107.2.1 - Type B+NYC unit door and doorway requirements, when applicable
- **Conditional:** ICC A117.1-2009 §§404, 603, 604, 606, 607, and 608 - outside authority limited to the provisions applicable to the identified room and fixtures, and required only if the incorporated standard text is separately available in the authorized evidence package; it is not reproduced in the local enacted-code corpus

**Important qualifications:** The bathroom dimensions and unit category are absent from this case. The applicable unit category and project program can change the required configuration. Agency standards such as UFAS or housing-program requirements are outside authorities and must be identified separately rather than silently merged into the NYC BC analysis.

**Claims Permitext must avoid:**
- Declaring the bathroom compliant from a single 60-inch dimension.
- Assuming every residential bathroom follows the same accessible-unit standard.
- Ignoring door swing intrusion, fixture overlap rules, or knee/toe clearances.
- Treating a drawing that lacks vertical dimensions as complete evidence.


## Test 28

**Regression fixture:** Treat the research date and proposed application filing date as August 10, 2026. The project is an alteration of an existing office space into apartments; the building's lawful existing status, original code, construction type, sprinkler status, number of stories, and exact residential group have not yet been confirmed.

**Q:** For an alteration application expected to be filed on August 10, 2026, an existing office space will be converted into apartments. Identify the major code consequences that must be investigated and state which existing-building framework is currently applicable.

**Ideal answer:** Changing office use to apartments is a change of use or occupancy that requires more than relabeling Group B as Group R. Permitext should automatically retrieve the currently applicable Administrative Code/prior-code-building framework and the exact provisions that trigger requirements for the altered work. It should then identify the issues that require project-specific evaluation: exact occupancy classification; means of egress; fire-resistance and occupancy separation; construction type, height, and area; sprinkler and fire-alarm requirements; accessibility; residential light, ventilation, and related provisions; and structural/live-load implications where a retrieved provision makes them material. It must not state that every new-building provision applies automatically.

For this frozen filing date, Permitext must distinguish enactment from applicability. The NYC Existing Building Code was enacted in 2026 but does not govern alteration applications until July 17, 2027. The current 2022 Construction Codes and Administrative Code framework therefore remains applicable to this fixture. Any future EBC text may be identified as future-effective context, but it cannot be used as the governing rule for this application.

**Citation expectations:**
- **Required — governing/enacted:** NYC Administrative Code §28-101.4 and the exact applicable subsection(s) governing prior-code buildings and the proposed change of use or occupancy; NYC BC §302.1 and the applicable provision of §310 needed to classify the proposed residential occupancy; Local Law 33 of 2026 for enactment of the EBC; and Local Law 42 of 2026's provision establishing the July 17, 2027 EBC effective date.
- **Conditional — governing/enacted:** Exact Chapter 5, 9, 10, 11, 12, 16, or other provisions only when Permitext makes a substantive claim that the retrieved section supports. A broad chapter citation is not sufficient for a specific requirement.
- **Supporting — noncontrolling:** NYC Department of Buildings, “Existing Building Code,” for the official explanation that current existing-building regulations continue until July 17, 2027.
- **Outside authority / unavailable:** Housing Maintenance Code, Multiple Dwelling Law, Fire Code/FDNY material, zoning, or program rules when they affect the particular conversion. These must remain identified as separate authorities until their governing text is in the authorized evidence package.

**Important qualifications:** Building age, lawful existing status, permit history, scope of work, former and proposed occupancies, construction type, sprinkler status, story configuration, and any transition provision that changes the frozen filing-date assumption are material facts.

**Claims Permitext must avoid:**
- Applying all new-building requirements automatically without the existing-building framework.
- Treating the conversion as only a Chapter 3 classification question.
- Treating an enacted but future-effective EBC provision as currently applicable.
- Citing DOB guidance instead of the enacted effective-date law for the controlling effective-date proposition.
- Claiming full change-of-occupancy compliance from a topical chapter list.


## Test 29

**Regression fixture:** Treat the application filing date as August 10, 2026. The project reconfigures nonbearing interior partitions in an existing Group B office. There is no change of occupancy, building area, or number of stories. The fixture does not establish the building's lawful existing status, original code, or whether doors, egress paths, accessibility features, alarms, sprinklers, structure, plumbing, or mechanical systems are altered.

**Q:** Which requirements can Permitext presently identify for this partition renovation, and which existing conditions can remain? Do not assume work or upgrade triggers that the project facts and retrieved enacted provisions do not establish.

**Ideal answer:** No change of occupancy or building area does not make the renovation exempt, but it also does not trigger an automatic whole-building upgrade. Permitext should automatically retrieve the current Administrative Code/prior-code-building alteration provisions, classify the work actually described, and organize its answer into: (1) requirements clearly triggered for the new or altered work; (2) lawful existing conditions expressly allowed to remain; and (3) conditions that cannot be resolved until their legal status, scope impact, or discipline-specific trigger is known. It should not decide that an unmentioned system is affected.

For the frozen August 10, 2026 filing date, the future-effective EBC is not the governing alteration code. Permitext may use the official DOB EBC page only to explain that timing; it must base the current legal analysis on the applicable 2022 Administrative Code and Construction Code provisions.

**Citation expectations:**
- **Required — governing/enacted:** NYC Administrative Code §28-101.4 and the exact applicable subsection(s) governing this prior-code-building alteration; Local Law 42 of 2026 for the EBC effective-date proposition.
- **Conditional — governing/enacted:** NYC BC §1101.3 only if the retrieved text and project facts show that accessibility is affected; exact egress, fire-protection, structural, plumbing, mechanical, or other provisions only for work shown to affect those elements.
- **Supporting — noncontrolling:** NYC DOB's Existing Building Code page for an official explanation of the July 17, 2027 applicability date.
- **Outside authority / unavailable:** Permit records, prior approvals, property records, and other materials needed to establish lawful existing conditions; separate agency or program standards if later made relevant.

**Important qualifications:** The answer should request only material missing facts: lawful existing status, exact scope boundaries, and which systems/components the partitions alter or obstruct. “No change of occupancy” is not equivalent to “no current-code requirements.”

**Claims Permitext must avoid:**
- Requiring a whole-building upgrade without a cited current-law trigger.
- Saying all existing conditions may remain because occupancy is unchanged.
- Using the EBC as current law for the frozen filing date.
- Converting a supporting DOB explanation into the governing alteration rule.
- Inferring affected systems from general practice rather than project facts.


## Test 30

**Regression fixture:** Treat the application filing date as August 10, 2026. A renovation occurs on another floor of a prior-code building. The user identifies an existing stair condition elsewhere in the building that would not satisfy a stated 2022 new-construction provision, but the fixture does not establish the stair's lawful existing status, whether the renovation affects it, or whether a retroactive or unsafe-condition provision applies.

**Q:** Does the renovation automatically require the existing stair condition to be corrected? Explain the legal triggers and project facts needed to answer.

**Ideal answer:** No. Failure to satisfy a present new-construction provision does not by itself establish either an existing violation or a project-triggered upgrade. Permitext should automatically retrieve the currently applicable prior-code-building and alteration framework, then determine whether the condition is lawful existing, altered or affected by the work, implicated by a change of use or occupancy, subject to a specific upgrade trigger, unsafe, or governed by a retroactive requirement. Until one of those legal pathways and the necessary facts are established, the strongest supported conclusion is that correction is not shown to be automatically required.

The answer must not rely on the EBC for the frozen filing date. It should identify future-effective EBC material, if found, as inapplicable to this filing unless a controlling transition provision establishes otherwise.

**Citation expectations:**
- **Required — governing/enacted:** NYC Administrative Code §28-101.4 and the exact current subsection(s) governing the building/work; the cited 2022 new-construction provision solely for the narrower proposition that the existing condition differs from new-construction requirements; Local Law 42 of 2026 if the answer states the EBC effective date.
- **Conditional — governing/enacted:** The exact alteration, change-of-use, unsafe-condition, or retroactive provision only when retrieved and tied to the identified condition.
- **Supporting — noncontrolling:** NYC DOB's Existing Building Code page may explain the current-versus-future framework but cannot supply the governing upgrade trigger.
- **Outside authority / unavailable:** Permit records, certificates, prior approvals, inspection records, or other project evidence needed to establish lawful existing status and whether the condition is affected.

**Important qualifications:** “Lawfully existing” and “grandfathered” are conclusions requiring support, not assumptions. Some safety and retroactive requirements can apply without direct alteration.

**Claims Permitext must avoid:**
- Treating every difference from the 2022 new-building code as an existing violation.
- Assuming the condition is lawful existing without evidence.
- Requiring an upgrade based on good practice rather than an enacted trigger.
- Ignoring a retrieved unsafe-condition or retroactive provision.
- Applying the future-effective EBC to the frozen filing date.


## Test 31

**Regression fixture:** A proposed Group R-2 apartment contains a 90-square-foot room labeled “Den.” The user states that it will be regularly used for sleeping. No Housing Maintenance Code, Multiple Dwelling Law, or program standard has yet been added to the authorized evidence package.

**Q:** Under the 2022 NYC Building Code, does the den qualify as habitable space, and what consequences can be stated without silently importing requirements from another authority?

**Ideal answer:** Permitext should automatically retrieve the exact Building Code definition and compare the stated sleeping use—not merely the “Den” label—with that definition. It may state consequences only from additional Building Code provisions it actually retrieves, such as an applicable light, ventilation, ceiling-height, or dimensional provision. It must separately identify any Housing Maintenance Code, Multiple Dwelling Law, or program question. An official webpage summarizing habitability may help explain the issue but cannot replace the enacted definition or establish a different authority's legal consequence.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §202, exact definition of HABITABLE SPACE, for the Building Code classification; every separate Building Code consequence must cite the exact section imposing it.
- **Conditional — governing/enacted:** Housing Maintenance Code, Multiple Dwelling Law, or another enacted definition/requirement only after Permitext retrieves that authority and clearly states that it is answering a separate legal question.
- **Supporting — noncontrolling:** Official DOB or HPD explanatory guidance may clarify terminology but cannot substitute for the enacted definition.
- **Outside authority / unavailable:** Housing-program standards, lease restrictions, or other agency requirements not in the authorized evidence package.

**Important qualifications:** The controlling definition can differ by authority. The project statement about sleeping use is a user-provided fact to verify, not code authority.

**Claims Permitext must avoid:**
- Classifying the space from the plan label alone.
- Importing dimensional, window, or occupancy requirements without the section that imposes them.
- Treating official guidance as enacted text.
- Mixing Building Code, Housing Maintenance Code, and Multiple Dwelling Law definitions without identifying each authority.


## Test 32

**Regression fixture:** The question concerns an exit access stair proposed between the first and second stories above grade in a fully sprinklered Group B building. The user asserts that BC §1019.3 Exception 2 requires a draft curtain. The fixture does not establish every other condition of Exception 2.

**Q:** Does BC §1019.3 Exception 2 permit the stair, and is the user's draft-curtain attribution correct? List every condition that must still be established.

**Ideal answer:** Permitext should retrieve the complete §1019.3 general rule, Exception 2, the neighboring exception containing the draft-curtain language, and every material direct cross-reference. It should correct the premise if the draft-curtain condition belongs to a different exception. It should then test Exception 2 condition-by-condition and give the maximum supported result: the exception is a possible pathway, but applicability remains conditional until each project fact and incorporated requirement is established. Full sprinkler protection alone is not a general enclosure waiver.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §1019.3 general rule and the complete text of Exception 2; the exact neighboring §1019.3 exception used to correct the draft-curtain attribution.
- **Conditional — governing/enacted:** NYC BC §713 and every sprinkler, opening, travel-path, atrium, or other provision expressly incorporated by the exception and material to the conclusion.
- **Supporting — noncontrolling:** An applicable NYC DOB Buildings Bulletin may explain administration of a specific §1019.3 exception, but it cannot alter the exception text.
- **Outside authority / unavailable:** None expected unless the question introduces an agency or standard beyond the Construction Codes.

**Important qualifications:** The exact exception number controls. Unknown conditions should appear as specific missing project facts, not as a reason to withhold the rule already established by the text.

**Claims Permitext must avoid:**
- Saying sprinklers automatically eliminate the enclosure requirement.
- Attributing a condition to the wrong exception.
- Checking only one condition of a conjunctive exception.
- Declaring the exception applicable without retrieving a material incorporated provision.


## Test 33

**Regression fixture:** A user asks whether a fully sprinklered second-story Group B office may have one exit. The story occupant load and exit access travel distance have not been confirmed. The question concerns exits from the story, not exits from an individual room.

**Q:** Reconcile BC §1006.3.1's minimum-exit rule with the single-exit allowance in §1006.3.2 and explain what can presently be concluded for this story.

**Ideal answer:** The provisions are a general rule and a specific allowance, not contradictory commands. Permitext should retrieve §1006.3.1, §1006.3.2, the applicable second-story Group B row of Table 1006.3.2, and every applicable table note. It should explain that the story may use the single-exit allowance only if all applicable occupancy, occupant-load, travel-distance, sprinkler, and other table conditions are met. Because occupant load and travel distance are missing, the result is conditional. It must not substitute the room-or-space rule in §1006.2 for the story-level question.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §1006.3.1; §1006.3.2; Table 1006.3.2's second-story Group B row and applicable notes.
- **Conditional — governing/enacted:** NYC BC §1006.2.1 and Table 1006.2.1 only if the answer separately analyzes a room/space; the exact sprinkler provision incorporated by an applicable table note.
- **Supporting — noncontrolling:** None expected.
- **Outside authority / unavailable:** None expected.

**Important qualifications:** Occupant load, travel distance, sprinkler standard/extent, story location, and any mixed-occupancy condition remain material. The cited table row and notes must support the actual story-level claim.

**Claims Permitext must avoid:**
- Calling the provisions contradictory.
- Applying a room-level allowance to the story.
- Selecting the favorable table value while omitting its notes or prerequisites.
- Giving a definitive one-exit answer with occupant load and travel distance unresolved.


## Test 34

**Regression fixture:** The authorized Building Code evidence includes NYC BC §1001.3, which directs that means of egress be maintained in accordance with the NYC Fire Code. The user asks whether boxes stored in an exit passageway comply. The authorized evidence package initially contains no Fire Code text.

**Q:** Can Permitext answer the storage question from BC §1001.3 alone, or must it retrieve the incorporated Fire Code provision?

**Ideal answer:** BC §1001.3 establishes that Fire Code maintenance requirements control, but it does not itself provide the operative storage/obstruction rule. Permitext should automatically search for the incorporated Fire Code provision. If authorized enacted Fire Code text is available, it should retrieve and cite the applicable FC §1027 provision before answering. If Permitext can find only an official FDNY webpage or guidance, that material may identify the likely authority but remains noncontrolling supporting context; the governing conclusion must remain incomplete until the enacted Fire Code text enters the authorized evidence package.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §1001.3 for the incorporation proposition.
- **Conditional — governing/enacted:** 2022 NYC Fire Code §1027.2 and/or §1027.3, as applicable, only after the exact enacted text is retrieved into the authorized evidence package.
- **Supporting — noncontrolling:** FDNY's official 2022 Fire Code landing page or official guidance may explain source identity and scope.
- **Outside authority / unavailable:** Any FDNY rule, permit condition, order, or bulletin that independently governs the identified storage condition and has not entered the authorized evidence package.

**Important qualifications:** This tests a cross-reference into a separate controlling code. Automatic retrieval should replace asking the user to manage an evidence set, but the system must still disclose when the controlling referenced text is unavailable.

**Claims Permitext must avoid:**
- Treating BC §1001.3 as though it contains the storage prohibition.
- Inferring the Fire Code text from memory.
- Treating a web summary or FDNY guidance page as enacted Fire Code text.
- Declaring compliance before the incorporated requirement and project condition are both established.


## Test 35

**Regression fixture:** A fully sprinklered second-story Group B office is proposed with one exit. The calculated occupant load is 24 and the measured exit access travel distance is 80 feet. The question invokes BC §1006.3.2 Item 1, whose operative limits are in Table 1006.3.2 and its notes.

**Q:** May the second story use one exit, and can Permitext answer without retrieving Table 1006.3.2's complete applicable row and notes?

**Ideal answer:** Permitext cannot derive the operative occupant-load and travel-distance limits from §1006.3.2 Item 1 alone. It should automatically retrieve the complete second-story Group B row and applicable notes from Table 1006.3.2, including the note governing the increased travel distance for a qualifying sprinklered Group B building. It may then compare the stated occupant load and travel distance with those values and give a conditional result, subject to verification that the stated sprinkler system satisfies the referenced standard and that no other applicable condition defeats the allowance. If the structured table text, headings, or notes are unavailable, Permitext should state what Item 1 establishes and withhold the numeric conclusion.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §1006.3.2 Item 1; Table 1006.3.2's complete second-story Group B row, column headings, and applicable footnote(s).
- **Conditional — governing/enacted:** The exact sprinkler provision referenced by the applicable table note when the increased travel-distance allowance is used.
- **Supporting — noncontrolling:** None expected.
- **Outside authority / unavailable:** None expected.

**Important qualifications:** This phase is text-only. The regression fixture should supply or retrieve structured/text table content preserving headings and notes; it should not depend on image or screenshot analysis.

**Claims Permitext must avoid:**
- Guessing the table value from memory.
- Citing §1006.3.2 as if it contains the operative numeric limits.
- Using an isolated cell without its row, column headings, or notes.
- Calling the answer complete when the table or referenced sprinkler provision is unavailable.


## Test 36

**Regression fixture:** A Group R-2 building plan shows a roof terrace with fixed seating and tenant access. The user asks whether BC §1006.3.1's exit requirement for an “occupied roof” applies. The initial evidence package contains §1006.3.1 but no controlling definition or other scoping provision for the term.

**Q:** Can Permitext decide that the terrace is an occupied roof from ordinary language, or must it retrieve the code's controlling definition or usage before applying §1006.3.1?

**Ideal answer:** Permitext should automatically search §202 and other enacted provisions that define or establish the code's use of “occupied roof.” If a controlling definition exists, it should retrieve that text and compare it with the stated project facts. If the term is not separately defined, Permitext should trace the relevant scoping and usage provisions and explain the factual characteristics that remain material. It must not fabricate a legal definition or apply the downstream exit rule definitively while the classification remains unresolved.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §1006.3.1 for the downstream consequence; NYC BC §202 only if it contains the controlling definition used by the answer.
- **Conditional — governing/enacted:** Any other enacted scoping or usage provision that Permitext relies on to resolve “occupied roof.”
- **Supporting — noncontrolling:** Official code guidance may explain terminology but cannot create a definition absent from the enacted text.
- **Outside authority / unavailable:** Project operations or lease restrictions may be relevant facts but are not code definitions.

**Important qualifications:** Fixed seating and tenant access are user-provided project facts. They may be relevant but do not replace the legal classification rule.

**Claims Permitext must avoid:**
- Using a dictionary definition as Building Code authority.
- Assuming every accessible roof is occupied or every roof without a room is unoccupied.
- Citing §202 if the relied-upon term is not actually defined there.
- Applying occupied-roof egress requirements definitively before resolving the classification.


## Test 37

**Regression fixture:** The authorized evidence package contains the complete 2022 NYC Building Code occupant-load and story-exit provisions, including all applicable tables and notes. The project is a second-story Group B office, but its net/gross area allocation and calculated design occupant load have not been confirmed. Actual staffing is 18 people.

**Q:** Determine the required number of exits and explain precisely what can and cannot be concluded while the design occupant load remains unknown.

**Ideal answer:** Permitext should identify the governing calculation and exit-number rules and state the applicable consequences conditionally. It cannot select the final number of exits until the design occupant load is calculated from the applicable area and occupant-load factor or another permitted method. Actual staffing is not automatically the design occupant load. The legal evidence is complete; the missing item is a project fact/calculation input, not missing law. Any single-exit pathway must also be tested against its story, occupancy, travel-distance, sprinkler, and table conditions.

**Citation expectations:**
- **Required — governing/enacted:** NYC BC §1004.1, §1004.1.3, and the applicable row of Table 1004.1.3; §1006.3.1 and Table 1006.3.1; §1006.3.2 and the applicable Table 1006.3.2 row/notes if the one-exit pathway is discussed.
- **Conditional — governing/enacted:** NYC BC §1006.2.1 and Table 1006.2.1 only if the answer separately analyzes exits from an individual room or space.
- **Supporting — noncontrolling:** None expected.
- **Outside authority / unavailable:** None expected.

**Important qualifications:** The answer should request the exact floor-area inputs and use configuration needed for the code calculation, not generic project information.

**Claims Permitext must avoid:**
- Treating 18 staff as the design occupant load without the code calculation.
- Giving the lowest possible number of exits as the final answer.
- Calling the law incomplete when only project facts/calculation inputs are missing.
- Ignoring the independent conditions of a single-exit allowance.


## Test 38

**Regression fixture:** The authorized evidence package contains only the complete applicable NYC BC §1005 egress-capacity text. The project facts are sufficient to test the width calculation under that section, but the package contains no provisions or facts addressing the number and arrangement of exits, travel distance, doors, corridors, stairs, continuity, discharge, or accessible means of egress.

**Q:** If the calculated egress width satisfies §1005, may Permitext conclude that the entire egress system complies with the NYC Building Code?

**Ideal answer:** No. Permitext may conclude only that the stated width/capacity calculation satisfies the retrieved §1005 requirement, assuming the stated calculation inputs are correct. It should explicitly limit that conclusion and identify major unreviewed egress topics as additional research needed, not as violations. It should automatically retrieve additional enacted provisions if the user asks to expand the review; it must not use general knowledge to certify the unexamined system.

**Citation expectations:**
- **Required — governing/enacted:** The exact NYC BC §1005 subsection(s) supporting the width/capacity conclusion.
- **Conditional — governing/enacted:** Exact §§1006, 1007, 1009, 1010, 1017, 1020, 1023, 1028, or other provisions only when Permitext makes a substantive claim governed by that section after retrieving it. Merely naming a topic for future review does not require pretending that every listed section applies.
- **Supporting — noncontrolling:** None expected.
- **Outside authority / unavailable:** Fire Code maintenance or FDNY operational requirements if the scope expands beyond Building Code design compliance.

**Important qualifications:** This is a scope-control regression. The answer should distinguish a passed component calculation from system compliance.

**Claims Permitext must avoid:**
- Equating adequate width with full egress compliance.
- Citing topically related sections that do not support the attached proposition.
- Listing unreviewed conditions as violations.
- Turning a narrow component finding into a Chapter 10 or whole-project certification.


## Test 39

**Regression fixture:** Permitext has authorized NYC Building Code evidence supporting a narrow design conclusion. The user then asks whether the project “also complies with FDNY requirements.” No Fire Code, FDNY rule, permit condition, order, bulletin, or project-specific FDNY material is in the authorized evidence package, and the user does not identify a particular FDNY-regulated issue.

**Q:** Does the Building Code conclusion establish FDNY compliance?

**Ideal answer:** No. Building Code compliance does not establish compliance with every Fire Code or FDNY-administered requirement. Permitext should state that the narrow Building Code conclusion remains supported, while the broad FDNY question is unverified because the governing issue and authority have not been identified. It may automatically search approved official FDNY sources to identify likely material, but web results remain supporting and noncontrolling. If an actual Fire Code or rule provision is needed for a governing conclusion, its exact enacted or duly adopted text must enter the authorized evidence package with its own authority, edition, effective date, and source label.

Because the question does not identify a specific FDNY issue, Permitext should ask one focused follow-up rather than fabricate a universal FDNY checklist—for example, whether the concern is operational permits, fire alarm acceptance, fire-protection-system maintenance, emergency planning, hazardous materials, or another subject.

**Citation expectations:**
- **Required — governing/enacted:** The exact NYC Building Code provision only if the answer restates the existing narrow Building Code conclusion. No Building Code citation can support the separate proposition that FDNY requirements are satisfied.
- **Conditional — governing/enacted:** The applicable 2022 NYC Fire Code section or Title 3 RCNY rule only after the user identifies the issue and Permitext retrieves the exact controlling text into the authorized evidence package.
- **Supporting — noncontrolling:** FDNY's official 2022 Fire Code landing page, Fire Code Guide, or relevant official bulletin may identify scope, source location, or agency practice but may not be presented as enacted law unless the source itself is the duly adopted controlling instrument.
- **Outside authority / unavailable:** Project-specific FDNY permits, approvals, orders, inspection records, certificates, or other controlling materials not available to Permitext.

**Important qualifications:** The 2022 NYC Fire Code is enacted city law; an official webpage about it is not a substitute for the operative section. FDNY rules can have the force of law and must be distinguished from nonbinding guidance and bulletins.

**Claims Permitext must avoid:**
- Saying Building Code compliance proves FDNY compliance.
- Inventing an FDNY requirement from memory or a web summary.
- Citing a Building Code section as FDNY authority.
- Treating all official web material as legally equivalent.
- Hiding the missing-authority limitation in a generic disclaimer.


## Test 40

**Regression status:** Common synthesis rubric only. Test 40 is not a standalone factual or retrieval case. Apply it to a concrete fixture from Tests 01–39 after that fixture has supplied a frozen corpus version, research/as-of date, project facts, authorized evidence snapshots, and expected source boundaries.

**Q:** Using the automatically assembled authorized evidence and stated project facts for the underlying fixture, prepare a concise conclusion addressing: (a) the applicable requirement, (b) why it applies, (c) relevant exceptions considered, (d) unresolved assumptions or facts, (e) additional evidence required, and (f) the resulting design constraint.

**Ideal answer:** Permitext should produce a compact response whose structure mirrors the evidence chain without turning the chat into a formal report. It should state the strongest supported conclusion first, cite the exact governing section/table/note, and connect verified or user-stated project facts to the provision's scope. Every material exception found in the assembled evidence should be tested and marked applicable, inapplicable, or unresolved. Missing project facts, missing enacted evidence, and outside authority must remain separate. Supporting official guidance may explain the result but cannot create or override a governing requirement. The design constraint must be no broader than the supported conclusion. An outcome-determinative unresolved item requires a conditional answer, not a false compliance determination.

**Citation expectations:**
- **Required — governing/enacted:** Every material legal proposition must map to the exact authorized section, table row, note, definition, exception, or duly adopted rule that supports it. Code edition, effective date, source identity, and applicability must be preserved.
- **Conditional — governing/enacted:** A cross-reference or separate authority is required only when the answer actually relies on it; automatic retrieval should add it to the per-answer evidence package before a governing claim is made.
- **Supporting — noncontrolling:** Official guidance, technical material, and secondary sources must be visibly classified, linked only to the explanatory claim they support, and never used as substitutes for enacted authority.
- **Outside authority / unavailable:** Any identified controlling source that Permitext cannot retrieve must remain an explicit limitation. The answer should not silently fill that gap from web content or pretrained knowledge.

**Important qualifications:** Score citation entailment, not citation presence. Project facts should be attributed to the project record, assumptions labeled, web source roles preserved, and saved findings reconstructable from versioned evidence snapshots.

**Claims Permitext must avoid:**
- Producing a definitive compliance statement with an outcome-determinative fact or authority unresolved.
- Citing project notes or supporting guidance as governing law.
- Treating “enacted” as proof that a future-effective provision applies to the fixture date.
- Introducing a requirement not contained in or logically supported by the authorized evidence.
- Using a topical citation that does not support the attached proposition.
- Turning a narrow issue conclusion into a whole-project compliance certification.

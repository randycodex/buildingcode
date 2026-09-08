# Permitext — Review of 60 Additional Code Evaluation Cases

Reviewed September 8, 2026. Original file: `Permitext_60_Code_Evaluation_Cases.txt`.

All 60 questions and expected answers were checked against the cited code provisions. **53 answers can be retained; 7 need correction or tighter wording.** These counts describe this source review, not Permitext model performance or independent professional approval.

The initial MC-15 review verified the kitchen makeup-air rule in the publisher’s 2022 NYC edition but could not retrieve its current American Legal page. A subsequent [September 8 source refresh](PERMITEXT_MC15_SOURCE_REFRESH_2026-09-08.md) confirmed the same rule in the September 2026 consolidation, closing that pending comparison. The original JSON retains its historical pending flag; the addendum preserves the later evidence. Source snapshots include observed versions, captured-passage hashes, and limited excerpts.

## Corrections

| Case | Required change |
|---|---|
| FGC-03 | The key changes the statutory phrase about appliance input into an express room-wide aggregate threshold. Sections 304.1 and 304.5 do not expressly say aggregate in that threshold. Do not treat that interpretation as a settled numerical rule in the benchmark. |
| MC-05 | The code specifies at least one manual control for each air distribution system. A statement about one control for the building can understate that requirement. |
| MC-06 | The exhaust rate is too low, but 70 percent is a higher and later humidity trigger than 60 percent. |
| GAP-04 | AC 28-105.4 expressly preserves duties to comply with or file with other city agencies. The original answer extends that statutory description to state and federal agencies without identifying their separate authority. |
| GAP-05 | The application must be amended before units omitted from the occupied-during-work count become occupied, not merely after their occupancy is discovered. |
| PC-05 | The commercial-disposer exception is in PC 413.3. PC 413.1 addresses domestic disposers and does not supply the claimed DEP approval exception. |
| PC-15 | The last sentence imports a prohibition on routing fixtures not subject to backwater that is not stated in the cited NYC PC 715.1. That section expressly permits several valve locations, including the building drain at its exit downstream of the building trap. |

## How these cases help Research

The added coverage is 15 Fuel Gas, 15 Mechanical, 15 administrative, and 15 Plumbing cases. They test numerical limits, rule/exception handling, source scope, missing facts, and cross-code dependencies. Their short conditional answers fit the agreed presentation sequence: direct answer, cited governing rule, application or calculation, then material qualifications.

The original intake is retained separately. The 60 questions are already used to check that the new DOB procedural-source route does not turn technical or legal questions into guidance-only answers. Expected answers and citations are evaluator data and must not be supplied to the answering model. Additional end-to-end evaluations should include affirmative permitted cases and boundary pairs (for example, 30 versus 31 occupants), since this file is heavily weighted toward “No.”

## Case-by-case findings and reviewed answers

### FGC-01 — High-pressure natural gas piping

**Question:** A new natural-gas piping system in a Manhattan commercial building will operate at 15 psig. Can it be designed only under the ordinary Fuel Gas Code piping provisions, without considering Appendix G?

**Finding — RETAIN:** 15 psig is included in the threshold; Appendix G is additional to the ordinary code requirements.

**Reviewed answer:** No. FGC 101.2.2 places natural-gas piping within the Fuel Gas Code, but it specifically states that high-pressure natural-gas piping systems operating at 15 psig or more must also comply with Appendix G. The ordinary Chapter 4 requirements are therefore not the complete rule set for the proposed system.

**Sources:** [FGC 101.2.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-196841).

### FGC-02 — Gas appliance in a bathroom

**Question:** A designer wants to install a gas-fired appliance in a bathroom. Is a gas appliance categorically prohibited in every bathroom?

**Finding — RETAIN:** The categorical prohibition is defeated by the express exceptions. Retain the room-use, combustion-air, listing and installation conditions.

**Reviewed answer:** Not categorically. FGC 303.3 makes bathrooms a prohibited appliance location as the general rule, but the section contains exceptions. One important exception permits a direct-vent appliance in a room other than a sleeping room where all combustion air is obtained directly from outdoors and the installation complies with the appliance listing and manufacturer’s instructions. The appliance type, venting method, combustion-air source, and listing therefore have to be known before a final answer is given.

**Sources:** [FGC 303.3](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-197419).

### FGC-03 — Large appliance using indoor combustion air

**Question:** A mechanical room contains gas appliances with a combined input of 400,000 Btu/h. The room is large enough to satisfy an indoor-air volume calculation. Can the designer rely entirely on indoor combustion air?

**Finding — REVISE:** The key changes the statutory phrase about appliance input into an express room-wide aggregate threshold. Sections 304.1 and 304.5 do not expressly say aggregate in that threshold. Do not treat that interpretation as a settled numerical rule in the benchmark.

**Reviewed answer:** The stated aggregate input alone does not establish the answer. FGC 304.1 and the exception in FGC 304.5 require outdoor air for fuel-burning appliances with an input greater than 350,000 Btu/h; they do not expressly describe that threshold as the combined input of all appliances in a room. Confirm the individual appliance inputs, types, applicable manufacturer instructions, and combustion-air method. For a single ordinary fuel-burning appliance rated at 400,000 Btu/h, an indoor-volume calculation cannot override the outdoor-air requirement. The multi-appliance scenario needs those facts or authoritative clarification before a categorical determination.

**Sources:** [FGC 304.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-197464), [FGC 304.5](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-197485).

### FGC-04 — Concealed gas-piping union

**Question:** A contractor proposes a union in a concealed gas-piping location above a permanent gypsum ceiling so the piping can be assembled more easily. Is that fitting permitted to remain concealed?

**Finding — RETAIN:** The concealed-fitting list includes threaded elbows, tees and couplings, and welded fittings; no union.

**Reviewed answer:** No, not under the ordinary concealed-fitting rule. FGC 404.5 limits fittings in concealed locations to threaded elbows, tees and couplings, and welded fittings. A union is not included in that list. The answer should distinguish a concealed location from an accessible location rather than treating all above-ceiling piping the same.

**Sources:** [FGC 404.5](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-197948).

### FGC-05 — Operating gas piping before required testing

**Question:** A new gas-piping installation appears complete and leak-free. May the contractor place it in service before the required inspection and pressure test are completed?

**Finding — RETAIN:** Both pre-operation inspection/pressure testing and gas-tight testing are supported.

**Reviewed answer:** No. Before acceptance and initial operation, the piping installation must be inspected and pressure tested as required by FGC 406. FGC 404.20 also requires the piping to be tested gas-tight before being placed in service. Visual confidence that the installation is leak-free is not a substitute for the required test.

**Sources:** [FGC 404.20](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198023), [FGC 406.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198053).

### FGC-06 — Minimum pressure test for a 2-psig system

**Question:** A gas system has a proposed maximum working pressure of 2 psig. The contractor proposes to test it at 2 psig because that equals the operating pressure. Is that test pressure sufficient?

**Finding — RETAIN:** The ordinary calculation is max(1.5 × 2, 3) = 3 psig. Keep the exception qualification: coated/wrapped pipe and utility meter requirements can impose a higher test. Do not grade 3 psig as universal.

**Reviewed answer:** No. FGC 406.4.1 requires a test pressure of at least 1.5 times the proposed maximum working pressure and in no case less than 3 psig, unless a specific exception applies. For a 2-psig system, 1.5 times the working pressure is 3 psig, so the ordinary minimum test pressure is 3 psig. The applicable test duration must be checked separately.

**Sources:** [FGC 406.4.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198086).

### FGC-07 — Gas piping in a public corridor

**Question:** New gas piping is installed in a public corridor. The contractor proposes a 5-psig pressure test for 30 minutes. Is that sufficient?

**Finding — RETAIN:** The public-corridor provision establishes 10 psig for at least 30 minutes. Retain the scope to piping installed under Section 404; other overriding test conditions must not be assumed absent.

**Reviewed answer:** No. FGC 406.4.1 contains a specific exception for gas piping installed in public corridors in accordance with FGC 404. That piping must be tested and proven tight at 10 psig for at least 30 minutes. A 5-psig test does not meet that specific requirement.

**Sources:** [FGC 406.4.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198086).

### FGC-08 — Using a valve as a pressure-test bulkhead

**Question:** Can an ordinary shutoff valve be used as the sole bulkhead between a gas-filled portion of a piping system and an adjacent portion being pressure tested?

**Finding — RETAIN:** The source expressly addresses double block and bleed or a flange, deenergizing upstream piping, and checking the untested section. An ordinary closed valve alone is insufficient.

**Reviewed answer:** Generally no. FGC 406.1.4 restricts using a valve as the bulkhead between gas in one section and the test medium in an adjacent section. The section provides limited acceptable arrangements, such as specified double-block-and-bleed or physical separation methods. The exact test configuration must therefore be reviewed rather than assuming a closed valve is sufficient.

**Sources:** [FGC 406.1.4](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198063).

### FGC-09 — Supporting gas piping from another pipe

**Question:** A short run of gas piping is strapped to a nearby domestic-water pipe because there is no convenient structural support above. Is that acceptable if the water pipe is strong enough?

**Finding — RETAIN:** The express ban on supporting piping by other piping controls despite the claimed strength.

**Reviewed answer:** No. FGC 407.2 requires gas piping to be supported by appropriate structural supports and specifically states that piping shall not be supported by other piping. The adequacy of the water pipe’s strength does not make the arrangement compliant.

**Sources:** [FGC 407.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198189).

### FGC-10 — Appliance shutoff valve eight feet away

**Question:** A gas appliance has a manual shutoff valve in the same room, eight feet from the appliance. There is no special manifold arrangement. Does the valve satisfy the ordinary appliance shutoff requirement?

**Finding — RETAIN:** Six feet, same room, upstream placement and access are supported; special arrangements are separate.

**Reviewed answer:** No. Under FGC 409.5.1, the ordinary appliance shutoff valve must be in the same room and within 6 feet of the appliance, upstream of the union, connector, or quick-disconnect device, and accessible. Eight feet exceeds that ordinary limit. A different arrangement should not be assumed compliant unless it qualifies under another specific provision.

**Sources:** [FGC 409.5](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198228), [FGC 409.5.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198230).

### FGC-11 — Appliance shutoff valve mounted 72 inches high

**Question:** The gas connection to a floor-mounted appliance is 30 inches above the floor, but the shutoff valve is mounted 72 inches above the floor. Is that acceptable under the ordinary shutoff-valve location rule?

**Finding — RETAIN:** The height exception depends on the appliance gas connection itself exceeding 60 inches.

**Reviewed answer:** No. FGC 409.5.1 generally limits the appliance shutoff valve to not more than 60 inches above the floor. The exception for a higher valve applies where the appliance gas connection itself is above 60 inches. Because the stated gas connection is only 30 inches above the floor, the exception is not established.

**Sources:** [FGC 409.5.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198230).

### FGC-12 — Appliance supplied at pressure above its design pressure

**Question:** A gas appliance is designed for a lower inlet pressure than the pressure supplied by the building gas system. Can the appliance simply be connected directly if the connecting pipe is rated for the higher pressure?

**Finding — RETAIN:** A line pressure regulator, listing, access and protection requirements are supported.

**Reviewed answer:** No. Pipe pressure rating and appliance inlet pressure are different issues. FGC 410.1 requires a line pressure regulator where the appliance is designed to operate at a pressure lower than the supply pressure, subject to the section’s listing, access, protection, and installation requirements.

**Sources:** [FGC 410.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198244).

### FGC-13 — Flexible connector to a water heater

**Question:** A contractor proposes a listed flexible gas connector between the branch piping and a gas-fired water heater. The connector is less than six feet long and is in the same room. Is it permitted?

**Finding — RETAIN:** The specific rigid-piping requirement for space heaters and water heaters overrides the general connector permission.

**Reviewed answer:** No. FGC 411.1 contains a more specific rule for water heaters and space-heating equipment: those appliances must be connected with rigid pipe. The general permission for certain listed appliance connectors does not override the specific rigid-connection requirement for a water heater.

**Sources:** [FGC 411.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198265).

### FGC-14 — Commercial range on casters without restraint

**Question:** A commercial cooking appliance on casters is connected with a listed commercial gas connector, but no separate restraining device is provided. Is the listed connector alone sufficient?

**Finding — RETAIN:** The listed connector and separate restraint are supported for the stated caster installation.

**Reviewed answer:** No. For commercial cooking appliances equipped with casters, FGC 411.1.1 requires the connection to comply with the applicable listed-connector requirements and requires movement of the appliance to be limited by a restraining device. The gas connector is not intended to serve as the restraint.

**Sources:** [FGC 411.1.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198273).

### FGC-15 — Type 1 gas clothes dryer and the meaning of “not required to be vented”

**Question:** FGC 501.8 lists a Type 1 clothes dryer among appliances not required to be vented. Does that mean a gas clothes dryer may discharge its dryer exhaust into the room?

**Finding — RETAIN:** FGC 501.8 item 4 expressly points to MC 504. MC 504.4 establishes outside termination; preserve the vent-versus-exhaust distinction.

**Reviewed answer:** No. The Fuel Gas Code statement concerns the appliance’s combustion venting requirement. FGC 501.8 expressly points Type 1 clothes dryers to the Mechanical Code exhaust requirements. The dryer exhaust must still comply with MC 504, including termination outdoors and the applicable duct requirements. A correct answer must distinguish a fuel-gas appliance vent from the clothes-dryer exhaust system.

**Sources:** [FGC 501.8](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-198450), [MC 504.4](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193696).

### MC-01 — Air-conditioned office relying only on operable windows

**Question:** A new office has large operable windows that appear to provide enough natural ventilation. The office will also be fully air-conditioned. Can the design rely only on the operable windows for code-required ventilation?

**Finding — RETAIN:** The air-conditioning trigger in MC 401.2 item 2 requires mechanical ventilation under MC 403.

**Reviewed answer:** No. MC 401.2 requires habitable and occupiable spaces provided with air conditioning to be mechanically ventilated in accordance with MC 403. Operable windows do not eliminate that mechanical-ventilation requirement for the air-conditioned office.

**Sources:** [MC 401.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193181), [MC 403](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193220).

### MC-02 — Outdoor-air intake six feet from a side lot line

**Question:** On a 40-foot-wide zoning lot, a ventilation air intake is proposed six feet from an interior side lot line. Does that satisfy the ordinary Mechanical Code intake-location rule?

**Finding — RETAIN:** Ten feet is the ordinary side-lot separation; a 40-foot lot does not satisfy the less-than-20-foot centerline exception.

**Reviewed answer:** No. MC 401.4 generally requires ventilation air intake openings to be at least 10 feet from lot lines or buildings on the same lot. The special centerline rule applies to lots measuring less than 20 feet in width and is not established by the stated facts. Other intake-separation requirements may also apply.

**Sources:** [MC 401.4](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193192).

### MC-03 — Recirculating ventilation air between apartments

**Question:** A central system serving two dwelling units is designed to use return air from Apartment A as part of the ventilation air supplied to Apartment B. Is that permitted?

**Finding — RETAIN:** MC 403.2.1 item 1 prohibits recirculation between dwelling units.

**Reviewed answer:** No. MC 403.2.1 prohibits using air transferred from one dwelling unit as ventilation air for another dwelling unit. A central system may serve multiple units, but the required outdoor-air and recirculation arrangement must comply with the separation restrictions in the section.

**Sources:** [MC 403.2.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193226).

### MC-04 — Transfer air used as toilet-room makeup air

**Question:** Can conditioned air transferred from an adjacent occupied office be used as makeup air for a mechanically exhausted toilet room?

**Finding — RETAIN:** Transfer air is conditional on the recirculation restrictions, required flow rates and introduction of required outdoor air. Retain the conditional answer.

**Reviewed answer:** Potentially yes. MC 403.2.2 permits transfer air to be used as makeup air for exhaust systems serving spaces including toilet rooms, subject to the ventilation rates, source-space requirements, air classification, and any prohibitions elsewhere in the code. The answer should therefore be conditional on the transfer-air source and required airflow, not an unconditional yes.

**Sources:** [MC 403.2.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193226), [MC 403.2.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193232).

### MC-05 — Fan disconnect used as emergency ventilation control

**Question:** The only way to stop a building’s supply and return fans in an emergency is to operate the electrical disconnect at each fan. Does that satisfy the Mechanical Code’s manual ventilation-control requirement?

**Finding — REVISE:** The code specifies at least one manual control for each air distribution system. A statement about one control for the building can understate that requirement.

**Reviewed answer:** No. MC 405.2 requires each air distribution system to have at least one manual control, at an approved location, that stops its supply, return, and exhaust fans in an emergency. A disconnect switch does not count as that manual control. Provide the required control for each system; fan disconnects alone do not satisfy the rule.

**Sources:** [MC 405.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193345).

### MC-06 — Mechanical ventilation of an uninhabited crawl space

**Question:** An uninhabited crawl space is not naturally ventilated. The designer proposes mechanical exhaust at 0.01 cfm per square foot that activates only when relative humidity reaches 70 percent. Is that enough?

**Finding — REVISE:** The exhaust rate is too low, but 70 percent is a higher and later humidity trigger than 60 percent.

**Reviewed answer:** No. MC 406.1 requires an exhaust-and-supply-air system where the uninhabited crawl space is not naturally ventilated, with mechanical exhaust of at least 0.02 cfm per square foot and automatic operation when relative humidity exceeds 60 percent. The proposed 0.01 cfm per square foot is only half the minimum, and waiting until 70 percent humidity starts ventilation too late.

**Sources:** [MC 406.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193354).

### MC-07 — Dryer exhaust combined with bathroom exhaust

**Question:** To reduce the number of exterior penetrations, a designer proposes combining a residential clothes-dryer exhaust duct with a bathroom exhaust duct before the air reaches the exterior. Is that permitted?

**Finding — RETAIN:** Dryer exhaust independence is express in MC 501.2.

**Reviewed answer:** No. MC 501.2 requires clothes-dryer exhaust systems to be independent of all other systems. The bathroom exhaust cannot be combined with the dryer exhaust simply to reduce exterior penetrations.

**Sources:** [MC 501.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193368), [MC 504.4](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193696).

### MC-08 — Bathroom exhaust terminating in an attic

**Question:** A bathroom exhaust fan in a top-floor apartment discharges into a ventilated attic instead of directly outdoors. Is that acceptable because the attic itself has roof vents?

**Finding — RETAIN:** The outdoor-discharge rule and attic prohibition control; none of the stated exceptions establishes permission for this bathroom discharge.

**Reviewed answer:** No. MC 501.3 requires exhaust systems to discharge outdoors and prohibits discharge into an attic, crawl space, or other interior area unless a specific exception applies. A ventilated attic does not by itself make the bathroom exhaust termination compliant.

**Sources:** [MC 501.3](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193370).

### MC-09 — Environmental exhaust four feet from an outdoor-air intake

**Question:** An environmental exhaust outlet is located four feet horizontally from a mechanical outdoor-air intake. No special exception or engineered re-entrainment analysis is identified. Is four feet enough?

**Finding — RETAIN:** Ten feet is the ordinary environmental-exhaust/intake separation. The exception also requires the specified air class, same served space/unit, airflow limits and less-than-10-percent cross-contamination/re-entrainment condition; a generic engineered study alone is not blanket permission.

**Reviewed answer:** No based on the stated facts. MC 501.3.1 generally requires the applicable exhaust outlet to be at least 10 feet from mechanical air intakes. The section contains limited exceptions for certain low-contaminant exhaust arrangements, so a complete answer should verify exhaust classification and airflow before concluding that a closer separation qualifies.

**Sources:** [MC 501.3.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193376), [MC 401.4](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193192).

### MC-10 — Apartment exhaust two feet from a neighboring apartment window

**Question:** In an R-2 building, a dedicated exhaust outlet serving one dwelling unit is two feet from an operable window serving the adjacent dwelling unit. Is that separation sufficient?

**Finding — RETAIN:** Item 6.2.2 requires three feet to the adjoining dwelling opening; the two-foot criterion is for the same unit.

**Reviewed answer:** No. MC 501.3.1 provides specific separation criteria for dedicated exhaust from dwelling units in R-2 and R-3 occupancies. The outlet must be at least 3 feet from operable openings into adjoining dwelling units or other occupancies. The shorter two-foot dimension applies only to specified openings associated with the same dwelling unit.

**Sources:** [MC 501.3.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193376).

### MC-11 — Screen on a clothes-dryer exhaust termination

**Question:** A contractor adds an insect screen over a clothes-dryer exhaust termination to prevent pests from entering the duct. Is the screen permitted?

**Finding — RETAIN:** The screen prohibition is express. Distinguish single-dryer backdraft-damper requirements from multiple installations.

**Reviewed answer:** No. MC 504.4 requires dryer exhaust to terminate outdoors and prohibits screens at the duct termination. The termination must otherwise comply with the required damper and configuration provisions.

**Sources:** [MC 504.4](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193696).

### MC-12 — Fire damper in a dryer exhaust duct

**Question:** A clothes-dryer exhaust duct crosses a fire-resistance-rated assembly. Can a listed fire damper be installed in the dryer duct to protect the penetration?

**Finding — RETAIN:** Obstructing fire/smoke devices are prohibited; rated penetrations need the specified duct construction and preservation of the assembly rating.

**Reviewed answer:** No. MC 504.2 prohibits fire dampers, smoke dampers, and combination fire/smoke dampers in clothes-dryer exhaust ducts. Where the duct penetrates a fire-resistance-rated assembly, the penetration and duct construction must preserve the required rating using a code-compliant method that does not place a prohibited damper in the dryer exhaust.

**Sources:** [MC 504.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193692).

### MC-13 — Type I hood over a medium-duty appliance

**Question:** A commercial kitchen appliance is classified as medium-duty cooking equipment and produces grease-laden vapors. Can it be installed under a Type II hood because the kitchen has only one appliance?

**Finding — RETAIN:** Grease/smoke and medium-duty equipment establish the Type I rule; retain the qualifying tested-electric-appliance exception.

**Reviewed answer:** No. MC 507.2 requires a Type I hood where cooking appliances produce grease or smoke, including medium-duty, heavy-duty, and extra-heavy-duty cooking appliances, subject to the stated exception for qualifying electric appliances tested for low grease emissions. The number of appliances does not convert a grease-producing installation into a Type II condition.

**Sources:** [MC 507.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193938), [MC 507.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193957).

### MC-14 — Mixed appliances under one hood

**Question:** A single commercial kitchen hood serves several appliances. Most would ordinarily need only a Type II hood, but one appliance requires a Type I hood. Can the designer classify only the portion above that one appliance as Type I and treat the rest of the same hood as Type II?

**Finding — RETAIN:** One appliance requiring Type I makes the single hood a Type I installation, with the associated system requirements.

**Reviewed answer:** No. MC 507.1 states that where any cooking appliance under a single hood requires a Type I hood, the entire hood is required to be a Type I hood. The individual appliance classification cannot be used to split one hood into conflicting Type I and Type II classifications.

**Sources:** [MC 507.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-193938).

### MC-15 — Kitchen makeup air not interlocked with exhaust

**Question:** A commercial kitchen has a mechanical makeup-air fan sized to offset the hood exhaust, but kitchen staff must switch the makeup-air fan on separately. Is that acceptable?

**Finding — RETAIN:** The automatic simultaneous-operation rule is confirmed in the 2022 NYC publisher edition and the subsequent [September 2026 consolidated-source refresh](PERMITEXT_MC15_SOURCE_REFRESH_2026-09-08.md). The initial timeout remains documented in the original JSON.

**Reviewed answer:** No. MC 508.1 requires mechanical makeup air to be automatically controlled to start and operate simultaneously with the exhaust system. Proper airflow quantity alone does not satisfy the control requirement. Energy Code requirements should also be checked where applicable.

**Sources:** [2022 publisher edition, MC 508.1](https://codes.iccsafe.org/content/NYNYCMC2022P1/chapter-5-exhaust-systems); [September 2026 consolidation, MC 508.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-194028).

### GAP-01 — Using the 1968 Building Code for new plumbing and mechanical work

**Question:** An alteration is being designed under the optional 1968 Building Code provisions for a prior-code building. Does that election also allow new plumbing, fuel-gas, and mechanical work to be designed under the old technical requirements?

**Finding — RETAIN:** Exception 1 expressly separates fuel gas, plumbing, electrical and mechanical work from the optional prior Building Code path. Current technical codes can contain their own existing-installation provisions.

**Reviewed answer:** No. AC § 28-101.4.3 allows an optional 1968 Building Code path for qualifying work on prior-code buildings, but expressly excludes fuel-gas, plumbing, electrical, and mechanical work from that election. Work on those systems is governed by the applicable provisions of the current respective technical codes for new and existing installations. A correct answer must distinguish the building-code election from the technical-code requirements for those systems.

**Sources:** [AC 28-101.4.3](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-155428), [AC 28-102.4.3](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-155625).

### GAP-02 — Assuming replacement equipment is automatically permit-exempt

**Question:** A contractor is replacing a piece of mechanical equipment with a similar new unit. Because the work is “replacement in kind,” can the contractor assume that no DOB permit is required?

**Finding — RETAIN:** Replacement appears in the general permit rule; the specific exemption and applicable rules must be established for the actual work.

**Reviewed answer:** No. AC § 28-105.1 establishes the general requirement to obtain a permit before work regulated by the Construction Codes is performed. Whether a particular replacement is exempt depends on the specific exemptions in AC § 28-105.4 and applicable DOB rules. “Replacement in kind” is not, by itself, enough information to declare the work permit-exempt.

**Sources:** [AC 28-105.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156206), [AC 28-105.4](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156291).

### GAP-03 — Permit-exempt work that violates zoning or another code

**Question:** A minor alteration qualifies for an exemption from the DOB permit requirement. Does that exemption also mean the work may disregard an otherwise applicable zoning or Construction Code requirement?

**Finding — RETAIN:** The section expressly preserves substantive code, zoning and other enforced-law compliance despite a permit exemption.

**Reviewed answer:** No. AC § 28-105.4 states that permit exemptions do not authorize work that violates the Construction Codes, Zoning Resolution, or other applicable laws. Exemption from the permit requirement is not exemption from substantive compliance.

**Sources:** [AC 28-105.4](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156291).

### GAP-04 — Permit exemption and other agency approvals

**Question:** Work is exempt from a DOB permit under AC § 28-105.4. May the applicant also assume that filings or approvals otherwise required by another city, state, or federal agency are unnecessary?

**Finding — REVISE:** AC 28-105.4 expressly preserves duties to comply with or file with other city agencies. The original answer extends that statutory description to state and federal agencies without identifying their separate authority.

**Reviewed answer:** No. AC 28-105.4 expressly says that a DOB permit exemption does not relieve the owner of obligations to comply with the requirements of, or file with, other city agencies. It also does not itself establish an exemption from a separately applicable state or federal requirement. Determine any such requirement under its own governing law; do not describe AC 28-105.4 as expressly listing state and federal agencies.

**Sources:** [AC 28-105.4](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156291).

### GAP-05 — Occupied dwelling-unit information on a permit application

**Question:** A permit application covers work in an occupied residential building containing 20 dwelling units. The application does not state how many units are occupied at filing or how many will remain occupied during the work. Is that omission acceptable?

**Finding — REVISE:** The application must be amended before units omitted from the occupied-during-work count become occupied, not merely after their occupancy is discovered.

**Reviewed answer:** No. For work on a building with more than three dwelling units, AC 28-105.5.2 requires the application to state the total units, units occupied when filed, and units to be occupied during the work. The stated 20-unit building falls within that threshold. Amend the application before occupancy of any unit not initially counted as occupied during the work.

**Sources:** [AC 28-105.5.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156369).

### GAP-06 — Permit with no work started for fourteen months

**Question:** DOB issued a construction permit fourteen months ago, but no work has begun. The permit was not otherwise renewed or preserved by a special provision. Is it still valid merely because the printed permit has not been physically surrendered?

**Finding — RETAIN:** No commencement within 12 months invalidates the ordinary permit. Preserve the separate suspension, insurance/license and flood-area provisions as applicable.

**Reviewed answer:** No. AC § 28-105.9 generally makes a permit invalid when the authorized work or use has not commenced within 12 months after issuance. The section includes additional expiration rules and exceptions that should be checked for the specific project, including special conditions such as certain flood-hazard work.

**Sources:** [AC 28-105.9](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156398).

### GAP-07 — Owner’s duty to maintain an old building

**Question:** An owner argues that a deteriorated required building safeguard does not have to be maintained because the building is old and was lawfully constructed decades ago. Does the age of the building eliminate the owner’s maintenance obligation?

**Finding — RETAIN:** The maintenance duty expressly includes safeguards required when the building was erected, altered or repaired.

**Reviewed answer:** No. AC § 28-301.1 places a continuing duty on the owner to maintain the building and its facilities in a safe and code-compliant condition as required by the applicable provisions. Lawful age or prior-code status does not create a general exemption from ongoing maintenance duties.

**Sources:** [AC 28-301.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-157982).

### GAP-08 — Permit obtained through a material false statement

**Question:** DOB later discovers that a permit application contained a material false statement that affected issuance of the permit. Can the permit be revoked even though construction has already started?

**Finding — RETAIN:** Material false statements can support revocation. The current provision specifies notice and a response period; commencement does not cure the false statement.

**Reviewed answer:** Yes. AC §§ 28-105.10 and 28-105.10.1 authorize suspension or revocation in circumstances that include material false statements or misrepresentations, code noncompliance, or issuance in error. The prescribed notice and opportunity-to-respond procedures must still be followed. Starting construction does not immunize the permit from revocation.

**Sources:** [AC 28-105.10](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156407), [AC 28-105.10.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156409).

### GAP-09 — Unapproved alternative material

**Question:** A manufacturer submits a new construction material that appears stronger and more durable than the prescriptive material named in the code. Can the project use it immediately because the design team believes it is superior?

**Finding — RETAIN:** Prior commissioner approval and the stated equivalency qualities are required; professional opinion is not the approval.

**Reviewed answer:** No. AC § 28-113.2.2 provides a process for alternative materials, designs, and methods and requires approval by the commissioner. The alternative must be shown to be at least equivalent in the relevant qualities, including strength, effectiveness, fire resistance, durability, and safety, as applicable. A design-team opinion alone is not the required approval.

**Sources:** [AC 28-113.2.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156795).

### GAP-10 — Concealing work before required inspection

**Question:** The contractor wants to close a wall before a required DOB inspection because photographs were taken of the concealed work. Can the photographs substitute for keeping the work accessible for inspection?

**Finding — RETAIN:** Required inspection access and exposure are express. No general photograph substitution appears in the cited rule.

**Reviewed answer:** Not under the general rule. AC § 28-116.1 requires permitted work to remain accessible and exposed for inspection until the required inspections have been completed, unless an applicable provision or authorized procedure permits otherwise. Photographs alone do not automatically replace the required inspection.

**Sources:** [AC 28-116.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156868).

### GAP-11 — Satisfactory inspection as approval of a code violation

**Question:** DOB performed an inspection and marked it satisfactory. The design team later discovers that one inspected condition does not comply with an applicable code requirement. Does the satisfactory inspection make the noncompliant condition legal?

**Finding — RETAIN:** The source expressly says a satisfactory inspection does not approve a violation.

**Reviewed answer:** No. AC § 28-116.1 expressly provides that a satisfactory inspection does not constitute approval of a violation of the Construction Codes or other applicable law. Inspection status and substantive legal compliance are separate issues.

**Sources:** [AC 28-116.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156868).

### GAP-12 — Final inspection before work is complete

**Question:** A project requires a new or amended Certificate of Occupancy. The contractor asks DOB to perform the required final inspection while several items of permitted work are still incomplete so the Certificate of Occupancy process can start early. Is that the ordinary sequence allowed by the code?

**Finding — RETAIN:** The stated final inspection follows completion of authorized work and precedes the certificate; the substantial-compliance report and defect corrections remain required.

**Reviewed answer:** No. AC § 28-116.2.4.1 requires the applicable final inspection after the permitted work is completed and before issuance of the Certificate of Occupancy. Defects identified by the inspection must be corrected, and the required final inspection documentation must establish substantial compliance as prescribed by the section.

**Sources:** [AC 28-116.2.4.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-230255).

### GAP-13 — Place of assembly operating with only a Certificate of Occupancy

**Question:** A room is legally classified as a place of assembly, and the building’s Certificate of Occupancy authorizes the assembly use. May the room operate without the required Place of Assembly Certificate of Operation?

**Finding — RETAIN:** The certificate of operation is a separate requirement for a place of assembly; the CO must authorize the use.

**Reviewed answer:** No. AC § 28-117.1 separately requires a Place of Assembly Certificate of Operation for a building, space, or outdoor area that is used or occupied as a place of assembly. The Certificate of Occupancy must authorize the use, but the Certificate of Occupancy does not replace the required Place of Assembly Certificate of Operation.

**Sources:** [AC 28-117.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156944).

### GAP-14 — Occupancy before a required Certificate of Occupancy

**Question:** Construction is complete and the project has passed its inspections, but the required Certificate of Occupancy has not yet been issued. Can the owner occupy the building because the physical work is finished?

**Finding — RETAIN:** Completion and passed inspections do not substitute for a required occupancy certificate. The answer appropriately reserves independently authorized occupancy documents.

**Reviewed answer:** No. AC § 28-118.1 generally prohibits using or occupying a building or open lot where a Certificate of Occupancy is required until the required certificate or other legally authorized occupancy document has been issued. Completion of construction and successful inspections do not independently authorize occupancy.

**Sources:** [AC 28-118.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-156983).

### GAP-15 — Continuing work after a stop-work order

**Question:** DOB issues a stop-work order that does not identify any portion of the project as permitted to continue. The contractor believes interior work in another area is unrelated to the cited violation. May that work continue?

**Finding — RETAIN:** The operative rule stops all work unless otherwise specified. Retain the stated fact that no portion is authorized to continue.

**Reviewed answer:** No. Under AC §§ 28-207.2 and 28-207.2.1, work covered by a stop-work order must stop immediately unless the order itself specifies otherwise or DOB authorizes the work. The contractor cannot unilaterally decide that a portion is sufficiently unrelated to continue.

**Sources:** [AC 28-207.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-157478), [AC 28-207.2.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-157481).

### PC-01 — One toilet facility for a 28-person café

**Question:** A small café has a total occupant load of 28 people, including employees and customers. The required fixture count can be satisfied with one single-user toilet room. Must separate male and female toilet facilities still be provided?

**Finding — RETAIN:** The combined employee/public exception is in PC 403.2 exception 2 and refers to PC 403.3. Preserve the premise that fixture count and all other requirements are met; 28 is below the 30-person threshold.

**Reviewed answer:** Not necessarily. PC 403.2 generally requires separate facilities for each sex, but one exception applies where the combined total number of employees and the public is 30 or fewer. If the stated total occupant load is the governing total for the exception and the single facility satisfies the required fixture count, accessibility, and other applicable requirements, separate facilities are not required solely by PC 403.2.

**Sources:** [PC 403.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161441), [PC 403.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161468).

### PC-02 — Drinking fountain in a restaurant that serves water

**Question:** A restaurant provides drinking water to customers as part of normal service. Does the Plumbing Code still require a separate drinking fountain solely because Table 403.1 would otherwise call for one?

**Finding — RETAIN:** The restaurant-served-water exception is express in PC 410.3.

**Reviewed answer:** No. PC 410.3 provides that drinking fountains are not required in restaurants where drinking water is served. Other applicable fixture and accessibility requirements remain separate issues.

**Sources:** [PC 410.3](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161591).

### PC-03 — Replacing all required drinking fountains with bottle fillers

**Question:** A building is required to provide four drinking fountains. The designer proposes four bottle-filling stations and no drinking fountains. Is that permitted?

**Finding — RETAIN:** Four required fountains allow at most two qualifying substitutions. The fixture must fill a container at least 10 inches high and be adjacent to or readily visible from a conforming fountain.

**Reviewed answer:** No under the general substitution rule. PC 410.3 permits not more than 50 percent of the required drinking fountains to be substituted by dedicated bottle-filling plumbing fixtures that satisfy the section’s location criteria. A bottled-water dispenser is also not a substitute for a required drinking fountain. For four required fountains, the ordinary substitution provision would permit no more than two to be replaced by qualifying bottle-filling fixtures.

**Sources:** [PC 410.3](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161591).

### PC-04 — Central apartment laundry without a floor drain

**Question:** A multiple-family residential building has a common laundry room with several automatic clothes washers, but the design omits a floor drain because each washer has a trapped standpipe. Is the floor drain optional?

**Finding — RETAIN:** PC 412.4 directly supplies the whole-floor drainage, three-inch outlet and lint-strainer requirements; standpipes do not substitute.

**Reviewed answer:** No. PC 412.4 specifically requires rooms containing automatic clothes washers in the central washing facilities of multiple-family dwellings to have floor drains located to readily drain the entire floor area. Those drains must have outlets at least 3 inches in diameter and be provided with lint strainers. Washer standpipes do not replace that room floor-drain requirement.

**Sources:** [PC 412.3](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161606), [PC 412.4](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161608).

### PC-05 — Commercial food-waste disposer without DEP approval

**Question:** A restaurant kitchen proposes a commercial food-waste disposer connected to the sanitary system. The disposer is a listed product, but no DEP approval has been obtained. Is the listing enough?

**Finding — REVISE:** The commercial-disposer exception is in PC 413.3. PC 413.1 addresses domestic disposers and does not supply the claimed DEP approval exception.

**Reviewed answer:** No. PC 413.3 prohibits commercial food-waste disposers unless the Department of Environmental Protection approves their use. A product listing does not replace that approval. PC 413.1 addresses domestic disposers; cite PC 413.3 for the restaurant installation and DEP exception.

**Sources:** [PC 413.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161611), [PC 413.3](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161615).

### PC-06 — Cold water only at a public restroom lavatory

**Question:** A public restroom for customers is designed with cold water only at the hand-washing lavatories. Is that compliant?

**Finding — RETAIN:** Tempered public hand-washing water is required. The point-of-use-heater exception changes the control method, not the tempered-water outcome.

**Reviewed answer:** No. PC 416.5 requires tempered water to be delivered from public hand-washing facilities for customers, patrons, and visitors, subject to the section’s temperature-control provisions and exceptions. Cold water only does not satisfy that requirement.

**Sources:** [PC 416.5](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161638).

### PC-07 — 30-inch-by-30-inch shower with a 20-inch entry

**Question:** A standard shower compartment is 30 inches by 30 inches internally, for 900 square inches of area, but its clear entry opening is only 20 inches wide. Does it satisfy the ordinary shower-compartment dimensional rules?

**Finding — RETAIN:** The standard area/minimum-dimension premise and separate 22-inch clear opening are supported; retain the accessibility qualification.

**Reviewed answer:** No. The 30-by-30-inch interior satisfies the ordinary 900-square-inch minimum area and 30-inch minimum dimension in PC 417.4, but PC 417.4.2 requires a minimum access and egress opening of 22 inches. The 20-inch entry fails that requirement. Accessibility requirements can require additional dimensions and must be checked separately.

**Sources:** [PC 417.4](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161648), [PC 417.4.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161652).

### PC-08 — Replacing 75 percent of men’s water closets with urinals

**Question:** A men’s toilet room is required to provide four water closets. The designer proposes one water closet and three urinals. Can 75 percent of the required water closets be replaced by urinals?

**Finding — RETAIN:** The 50-percent ceiling applies in each bathroom/toilet room. Three of four is 75 percent and fails.

**Reviewed answer:** No. PC 419.2 permits urinals to substitute for required water closets in men’s facilities only up to the limit stated by the section, which is 50 percent of the required water closets in the applicable bathroom or toilet room. Replacing three of four required water closets would exceed that limit.

**Sources:** [PC 419.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161687).

### PC-09 — Shower valve set to 125°F

**Question:** A pressure-balancing shower valve is field-adjusted so the maximum outlet temperature is 125°F. Is that setting permitted?

**Finding — RETAIN:** The field-adjusted maximum is 120°F; 125°F fails.

**Reviewed answer:** No. PC 424.3 requires the applicable individual shower valve to be a balanced-pressure, thermostatic, or combination valve and to be field adjusted to a maximum setting of 120°F. A 125°F maximum setting exceeds the code limit.

**Sources:** [PC 424.3](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161765).

### PC-10 — Water heater above a finished office without a drain pan

**Question:** A storage-type water heater is installed above a finished office ceiling. Leakage from the heater could damage the ceiling and occupied space below, but no drain pan is shown. Is a pan required?

**Finding — RETAIN:** The potential for damage in the stated location triggers the approved pan requirement.

**Reviewed answer:** Yes. PC 504.7 requires an approved pan beneath a storage water heater or hot-water storage tank where leakage would cause damage. The stated location establishes that risk. The pan and its drainage must comply with the remaining requirements of the section.

**Sources:** [PC 504.7](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-161890).

### PC-11 — Three-inch sanitary piping at 1/16 inch per foot

**Question:** A new 3-inch horizontal sanitary drainage pipe is designed at a slope of 1/16 inch per foot. Is that enough?

**Finding — RETAIN:** Table 704.1 gives 1/8 inch per foot for three-through-six-inch drainage pipe; 1/16 fails.

**Reviewed answer:** No. PC 704.1 requires horizontal drainage piping 3 through 6 inches in diameter to slope at least 1/8 inch per foot. A slope of 1/16 inch per foot is below the prescribed minimum for a 3-inch pipe.

**Sources:** [PC 704.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-162525).

### PC-12 — Reducing a drain from four inches to three inches downstream

**Question:** A horizontal sanitary drain is 4 inches upstream but is reduced to 3 inches farther downstream in the direction of flow to avoid a beam. Is that permitted if the calculated fixture-unit load would fit in a 3-inch pipe?

**Finding — RETAIN:** The no-reduction rule controls; a four-by-three water-closet connection is specifically not considered a reduction.

**Reviewed answer:** No. PC 704.2 generally prohibits reducing the size of drainage piping in the direction of flow. The section contains a specific exception associated with a 4-inch-by-3-inch water-closet connection, but the stated beam-avoidance condition does not establish that exception. Hydraulic capacity does not override the no-reduction rule.

**Sources:** [PC 704.2](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-162530).

### PC-13 — Double-trapping a sink

**Question:** A designer places two traps in series on a sink waste line to provide “extra protection” against sewer gas. Is double trapping permitted?

**Finding — RETAIN:** The double-trapping prohibition is express. Other trap-sharing exceptions do not authorize two traps in series.

**Reviewed answer:** No. PC 1002.1 requires each plumbing fixture to be separately trapped as required and prohibits double trapping. Two traps in series do not provide a code-approved additional safeguard and can interfere with proper drainage and venting.

**Sources:** [PC 1002.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-163234).

### PC-14 — Two-inch trap arm ten feet from the vent

**Question:** A fixture has a 2-inch trap arm with a developed length of 10 feet from the trap weir to the vent connection. No special venting method or exception is identified. Is that length permitted?

**Finding — RETAIN:** Table 909.1 gives eight feet for a two-inch trap at 1/4 inch per foot. Preserve the self-siphoning-fixture exception and any separately permitted venting method.

**Reviewed answer:** No under the ordinary trap-to-vent distance table. PC 909.1 limits a 2-inch fixture drain to a maximum developed length of 8 feet from the trap to the vent at the prescribed slope. A 10-foot trap arm therefore exceeds the ordinary limit unless another specifically permitted venting arrangement applies.

**Sources:** [PC 909.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-163107).

### PC-15 — Basement fixtures subject to sewer backflow

**Question:** Basement plumbing fixtures are located at an elevation where they are subject to backflow from the public sewer, but the sanitary design provides no backwater valve. Is that acceptable?

**Finding — REVISE:** The last sentence imports a prohibition on routing fixtures not subject to backwater that is not stated in the cited NYC PC 715.1. That section expressly permits several valve locations, including the building drain at its exit downstream of the building trap.

**Reviewed answer:** No. NYC PC 715.1 requires accessible backwater valves where fixtures or drains are subject to overflow from public-sewer backwater. It permits protection in the affected fixture drain, an appropriate branch drain, or the building drain at the building exit downstream of the building trap. Buildings in flood-hazard areas also have the additional requirements referenced to ASCE 24 as modified by BC Appendix G. Determine the appropriate protected piping arrangement from the NYC provisions; do not add an uncited categorical ban on a building-drain arrangement.

**Sources:** [PC 715.1](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-162882).

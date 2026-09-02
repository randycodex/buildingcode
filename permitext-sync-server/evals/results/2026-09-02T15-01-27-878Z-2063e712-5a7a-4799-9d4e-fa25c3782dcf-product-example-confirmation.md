# Permitext owner-example live confirmation

Run ID: 2063e712-5a7a-4799-9d4e-fa25c3782dcf

Status: partial

Execution commit: 6433bc130ff245215e5d30ab492f32f8b443b4d4

Spend: $1.023256 actual; $1.023256 conservative reserved; $2.00 cap; 0 pending.

| Example | Turn | Operation | Deterministic review |
| --- | ---: | --- | --- |
| product-example-ramp-2022 | 1 | completed | PASS |
| product-example-corridor-accessibility-2022 | 1 | completed | PASS |
| product-example-appendix-p | 1 | rejected | REVIEW |
| product-example-omh-bathroom-boundary | 1 | completed | PASS |
| product-example-habitable-space-2022 | 1 | completed | PASS |
| product-example-c4-4d-r8a | 1 | completed | REVIEW |
| product-example-c4-4d-r8a | 2 | completed | REVIEW |
| product-example-vision-lite-2014 | 1 | completed | PASS |
| product-example-vision-lite-2014 | 2 | completed | PASS |

Every answer still requires owner review. This confirmation is not an official code determination.

## product-example-ramp-2022 — turn 1

Question: what are the requirements for designing a ramp?

Status: completed; deterministic review: PASS

For a **means-of-egress ramp**, the supplied 2022 NYC Building Code rules provide this baseline. Separately, a ramp that is part of an accessible route has a **1:12 (8%) maximum running slope** under BC § 1012.2; accessibility design is also governed by ICC A117.1 and the code, whose full text is not supplied (BC § 1101.2).

| Item | Requirement | Authority |
|---|---|---|
| Scope / special types | BC § 1012 applies to ramps used as means-of-egress components. Ramped aisles generally follow § 1029, except stated accessible-route aisles; curb ramps comply with ICC A117.1. Certain garage vehicle ramps not serving an accessible route, accessible elements, or accessible means of egress need not comply with §§ 1012.3–1012.10. | BC § 1012.1 |
| Running slope | Means-of-egress or accessible-route ramps: max. 1:12 (8%). Other pedestrian ramps: max. 1:8 (12.5%). Group A aisle ramps follow § 1029.13. A nonaccessible egress ramp in a garage of no more than three stories serving no more than one level below grade may be max. 1:7 (14%). | BC § 1012.2 |
| Cross slope / rise | Cross slope: max. 1:48 (2%). Rise per run: max. 30 inches. | BC §§ 1012.3, 1012.4 |
| Width / capacity | Clear width between handrails, if provided, or other permissible projections: 36 inches minimum. A means-of-egress ramp must also meet the corridor width and capacity required by § 1020.2. | BC § 1012.5.1 |
| Landings | Provide at the top and bottom of each ramp, turns, entrances, exits, and doors. Landing slope is max. 1:48 in any direction, with no changes in level; width must be at least the widest adjoining run. Length is generally 60 inches minimum; where not part of an accessible route, it need not exceed 48 inches in the direction of travel. Turn landings are generally 60 by 60 inches minimum. In Group R-2/R-3 individual dwelling or sleeping units not required under § 1107 to be Accessible, Type B+NYC, or Type B units, 36-inch landing length and 36-by-36-inch turn landings are permitted. ICC A117.1 door maneuvering clearances may overlap a required landing. | BC §§ 1012.6–1012.6.5 |
| Surface / handrails | Use slip-resistant, securely attached material. Where rise exceeds 6 inches, provide handrails on both sides complying with § 1014, except as § 1029.15 permits for ramped aisles. | BC §§ 1012.7.1, 1012.8 |
| Edge protection | Provide edge protection on each side of runs and on landing sides not adjoining another ramp run or stairway. A solid barrier extends at least 4 inches from the surface; another barrier prevents passage of a 4-inch sphere where any part is within 4 inches of the surface. Exceptions: no edge protection for a ramp not required to have handrails **if** it has flared sides complying with ICC A117.1 curb-ramp provisions; at landing sides with a vertical dropoff no greater than 1/2 inch within 10 inches horizontally of the required landing area; or where the floor/ground extends at least 12 inches beyond the inside face of a § 1014-compliant handrail. | BC §§ 1012.10, 1012.10.1 |

**Design implication:** At 1:12, a 30-inch rise requires at least 30 feet of horizontal run (30 × 12 = 360 inches), followed by a landing. A direction change ordinarily requires a 60-by-60-inch landing.

The supplied evidence does not include ICC A117.1, § 1014 handrail details, § 1020.2 corridor-capacity criteria, or § 1029 aisle provisions; those texts are needed to finalize the applicable special-condition details.

Citations: BC 1012.1, BC 1012.2, BC 1012.3, BC 1012.4, BC 1012.5.1, BC 1012.6, BC 1012.6.1, BC 1012.6.2, BC 1012.6.3, BC 1012.6.4, BC 1012.6.5, BC 1012.7.1, BC 1012.8, BC 1012.10, BC 1012.10.1, BC 1101.2

## product-example-corridor-accessibility-2022 — turn 1

Question: What's the minimum hall towards a fire escape that does not require ADA?

Status: completed; deterministic review: PASS

There is **no special narrower width simply because a hall leads to a fire escape**. Under the supplied 2022 NYC table, the minimum depends on the corridor’s exact condition—not merely whether it is ADA or leads to a fire escape. (BC § 1020.2)

| Corridor condition | Minimum width | Authority |
|---|---:|---|
| Typical facility not otherwise listed | 44 in. | BC § 1020.2 |
| Occupant load of 50 or less, except as otherwise required by Chapter 11 | 36 in. | BC § 1020.2 |
| Within an I-1 or R-1 dwelling unit, except as otherwise required by § 1107 | 36 in. | BC § 1020.2 |
| Within an R-2 or R-3 dwelling unit, except as otherwise required by § 1107 | 30 in. | BC § 1020.2 |
| Access to and utilization of mechanical, plumbing, or electrical systems/equipment | 24 in. | BC § 1020.2 |

So, a **30-inch** hall is the lowest dwelling-unit corridor width shown, but only **within an R-2 or R-3 dwelling unit** and subject to § 1107. A **36-inch** hall is available either for an occupant load of 50 or less (subject to Chapter 11) **or** within an I-1/R-1 dwelling unit (subject to § 1107). Otherwise, the table’s baseline is **44 inches**. The 24-inch row is limited to equipment-system access; the supplied evidence does not establish it as an egress-hall allowance.

Does not require ADA cannot be confirmed from the supplied passages alone. Buildings and facilities must be designed and constructed to be accessible under ICC A117.1 and the Building Code (BC § 1101.2). Where a building or portion is required to be accessible, an accessible route must serve each portion, subject to the listed exceptions (BC § 1104.3); Chapter 11 exemptions apply only to the extent specified in § 1103.2. The supplied evidence does not include the applicable Chapter 11 exemption or ICC A117.1 route-width text needed to establish that this particular hall may be nonaccessible. (BC §§ 1101.2, 1103.2, 1104.3)

Citations: BC 1020.2, BC 1101.2, BC 1104.3, BC 1103.2

## product-example-appendix-p — turn 1

Question: what BC-Appendix P

Status: rejected; deterministic review: REVIEW REQUIRED

POST /research/conversations/message failed (422): Permitext could not locate enacted text in the routed authorized corpus for this question. Try a more specific code topic or citation.

Citations: None

## product-example-omh-bathroom-boundary — turn 1

Question: This feasibility must comply with NYS Office of Mental Health guidelines. Research the minimum bathroom, toilet, and ADA requirements.

Status: completed; deterministic review: PASS

The supplied evidence contains **2022 NYC Construction Code provisions, but no NYS Office of Mental Health (OMH) guideline, program standard, funding requirement, licensing criterion, or approval criterion.** I therefore cannot identify OMH’s minimum bathroom, toilet, or ADA requirements, and NYC requirements cannot be substituted for the missing OMH authority. Please provide the applicable OMH program/design standard or official OMH guidance, together with the proposed service model.

For the NYC-code baseline only, plumbing-fixture minimums depend on the Building Code occupancy classification and occupant load. Table 403.1 supplies different fixture ratios for different occupancy categories. If the proposed use is Group B, the table provides water-closet and lavatory counts by persons of each sex, one drinking fountain per 100 persons, and one service sink; any fraction requires an additional fixture. The usual calculation divides total occupant load equally between sexes, applies the ratios, sums fractional results across multiple occupancies before rounding up, and then rounds up. A different sex distribution requires approved statistical data. Group B office fixture calculations use the total occupant load on the given floor. (PC §§ 403.1, 403.1.1)

Where fixtures are required, separate facilities for each sex are the baseline. Separate facilities are not required for a dwelling or sleeping unit, or in the specified combined employee/public, employee-only, or public-only arrangements when the applicable population is 30 or fewer. (PC § 403.2)

Mechanical exhaust is required and recirculation is prohibited for the table’s toilet-room/bathroom entries. The applicable rate depends on the room category: a private bathroom/toilet room in a hotel, motel, resort, or dormitory is **25 cfm continuous or 50 cfm intermittent per room**; a toilet room/bathroom in a private dwelling is **20 cfm continuous or 50 cfm intermittent per room**. For either of those per-room rows, the lower rate is allowed only when the system runs continuously while the served dwelling or sleeping unit is occupied. A **public toilet room** instead requires **50 cfm continuous or 70 cfm intermittent per water closet or urinal**; the lower rate is allowed only while the toilet facilities’ served space is occupied. (MC Table 403.3.1.1)

The assembled evidence does **not** contain the general ADA/accessibility toilet-room criteria needed to establish clearances, turning space, door maneuvering clearance, grab-bar configuration, fixture mounting heights, or accessible-route requirements. It contains only a conditional Type B+NYC dwelling/sleeping-unit provision. If that scope applies, each toilet room must include at least one complying lavatory and water closet, and each bathing room at least one complying lavatory, water closet, and bathtub or shower; the applicable fixtures must be in one room. (BC § 1107.2.2)

That Type B+NYC rule has a material alternative for other toilet/bathing rooms in the same unit: if one toilet-and-bathing facility meets the stated Type A criteria—including compliant lavatory, water closet, and bathtub or shower in one area; compliant toilet-paper dispensers; and, if provided, a medicine-cabinet storage shelf no higher than 44 inches—those other rooms need comply only with the listed ICC A117.1 accessible-route, walking-surface, doorway, operable-part, and grab-bar/shower-seat-reinforcement provisions, plus the specified 18-inch-minimum vertical grab bar. (BC § 1107.2.2) This limited dwelling/sleeping-unit rule does not establish a complete accessibility determination for a nonresidential OMH program.

A final feasibility determination requires the controlling OMH standard; the actual program/use needed for Building Code classification; occupant load by floor and use; employee, client/resident, and visitor populations using each facility; whether facilities are employee-only, public-only, or combined; whether facilities are proposed to be shared with other spaces (the supplied evidence does not establish permission for that sharing); any approved non-50/50 sex-distribution data; and whether any bathroom is in a Type B+NYC dwelling or sleeping unit.

Citations: PC 403.1, PC 403.1.1, PC 403.2, MC 403.3.1.1, BC 1107.2.2

## product-example-habitable-space-2022 — turn 1

Question: in the building code, where are the minimum sq ft, or minimum distance between wall for habitable spaces like a bedroom

Status: completed; deterministic review: PASS

In the **2022 NYC Building Code**, look to **BC § 1208**:

| Item | Minimum requirement | Authority |
|---|---:|---|
| Habitable room/space net floor area | **80 sq ft minimum** | BC § 1208.3.1 |
| Habitable-space plan dimension, other than a kitchen | **8 ft minimum in any plan dimension** | BC § 1208.1 |

A bedroom is expressly included in the definition of **habitable space** for dwelling units in Group R or I-1. (BC § 202.) Thus, for an ordinary bedroom, the usable baseline is **80 net sq ft** and **8 feet in every plan dimension**.

Key bedroom exceptions: in a dwelling unit with **3 or more bedrooms**, one-half of the bedrooms may be **7 feet** in any plan dimension. A room in a **Group R-1 dwelling or sleeping unit** may be **6 feet** in any plan dimension; separately, a room in a **Group R-1 dwelling unit** may be **60 net sq ft**. The 60-sq-ft area allowance does not expressly extend to an R-1 sleeping unit. (BC §§ 1208.1, 1208.3.1.)

**Practical check:** an 8 ft × 10 ft bedroom is 80 sq ft and satisfies both baseline provisions. A 7 ft × 12 ft room has 84 sq ft but does not meet the ordinary 8-foot plan-dimension rule unless an applicable exception is satisfied.

Citations: BC 1208.3.1, BC 1208.1, BC 202

## product-example-c4-4d-r8a — turn 1

Question: zoning area c4-4d, how similar it is to r8a?

Status: completed; deterministic review: REVIEW REQUIRED

**C4-4D is residentially very similar to R8A:** for residential bulk, the Zoning Resolution expressly assigns C4-4D the residential equivalent **R8A**. Thus, the R8A residential bulk framework applies to residential development in C4-4D (ZR § 34-112).

| Feature | C4-4D | R8A |
|---|---:|---:|
| Residential bulk equivalent | R8A | R8A district itself |
| Standard-residence maximum residential FAR | 6.02 | 6.02 |
| Qualifying affordable housing or qualifying senior housing maximum residential FAR | 7.20 | 7.20 |
| Commercial-only maximum FAR | 3.40 | Not established by the supplied evidence |

The practical distinction is that **C4-4D is a commercial district with R8A-equivalent residential bulk**, rather than an R8A residential district. For a zoning lot containing only commercial uses, C4-4D has a **3.40 FAR** cap (ZR § 33-122). The supplied provisions establish the residential-bulk and FAR comparison, but do not establish the full respective use permissions, height/setback controls, parking rules, or any mapped overlay/special-district applicability.

Citations: ZR 34-112, ZR 23-22, ZR 33-122

## product-example-c4-4d-r8a — turn 2

Question: give me just a short paragraph to explain quickly

Status: completed; deterministic review: REVIEW REQUIRED

I can’t substantiate the earlier C4-4D-versus-R8A comparison from the enacted passages supplied here: they address definitions and Midtown encroachment/reflectivity rules, not C4-4D residential equivalence or FAR. Please provide the applicable ZR §§ 34-112, 23-22, and 33-122 text (or rerun the research for those sections) for a citation-supported short explanation.

Citations: ZR 81-265, ZR 81-276

## product-example-vision-lite-2014 — turn 1

Question: maximum sq ft for vision light in a door - 2014 NYC Building Code

Status: completed; deterministic review: PASS

For a **fire door**, the 2014 NYC Building Code does **not** give one universal maximum vision-light area in the supplied text: it requires fire-protection-rated glazing to comply with the size limitations in **NFPA 80**. (BC § 715.4.7.1)

The stated NYC limits are **100 sq. in. (0.065 m²)** in these cases:
- A fire door in a **fire wall** generally cannot have fire-protection-rated glazing; the exception is a self-closing swinging door serving a horizontal exit, with a vision panel no larger than 100 sq. in. and with no dimension over **10 in.**
- A **1½-hour-rated** fire door intended for a **fire barrier** may have fire-protection-rated glazing only if the glazing area is no more than 100 sq. in. (BC § 715.4.7.1)

This is 2014-Code evidence, whose applicability is project-specific and may depend on the application filing date. For another fire-door rating or location, the supplied evidence directs the size limit to NFPA 80; it does not establish a square-foot maximum.

Citations: BC 715.4.7.1

## product-example-vision-lite-2014 — turn 2

Question: is this from the 2014 building code?

Status: completed; deterministic review: PASS

Yes. The quoted provision is from the **2014 NYC Building Code**, § 715.4.7.1, Size limitations. The earlier answer correctly identified its edition, but its applicability is **project-specific** because the 2014 Construction Codes are a prior edition and may depend on the application filing date.

That section requires fire-protection-rated glazing in fire doors to comply with NFPA 80 size limitations, with the stated 100-square-inch exceptions for (1) a self-closing swinging door in a horizontal exit through a fire wall, also limited to 10 inches in any dimension, and (2) a 1½-hour-rated fire door intended for a fire barrier. (BC § 715.4.7.1)

Citations: BC 715.4.7.1


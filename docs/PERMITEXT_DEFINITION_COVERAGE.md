# Definition coverage review

This is a local implementation inventory, not a claim that all definitions are complete or applicable in every context. Source wording is preserved; no meaning is invented for unresolved references.

Registry SHA-256: `14167f03728d806f51972536ff5b3244e301412fe9bffc5bdaa4ee066de568e3`.

Reproduce with `node scripts/audit-definition-occurrences.mjs` followed by `node scripts/report-definition-coverage.mjs` from `permitext-sync-server`.

## Indexed definition sources

| Collection | Code | Scope | Entries | Direct | Resolved | Alternatives | Unresolved |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2014-construction-codes | ADMINISTRATIVE PROVISIONS | general | 87 | 84 | 2 | 0 | 1 |
| 2014-construction-codes | BUILDING CODE | general | 884 | 85 | 743 | 18 | 38 |
| 2014-construction-codes | PLUMBING CODE | general | 191 | 170 | 15 | 2 | 4 |
| 2014-construction-codes | MECHANICAL CODE | general | 245 | 240 | 4 | 0 | 1 |
| 2014-construction-codes | FUEL GAS CODE | general | 171 | 165 | 6 | 0 | 0 |
| 2022-construction-codes | BUILDING CODE | general | 1000 | 853 | 129 | 0 | 18 |
| 2022-construction-codes | FUEL GAS CODE | general | 234 | 150 | 82 | 0 | 2 |
| 2022-construction-codes | GENERAL ADMINISTRATIVE PROVISIONS | general | 97 | 93 | 2 | 0 | 2 |
| 2022-construction-codes | MECHANICAL CODE | general | 318 | 236 | 80 | 0 | 2 |
| 2022-construction-codes | PLUMBING CODE | general | 273 | 173 | 93 | 2 | 5 |
| 2025-specialty-codes | 2025 ENERGY CONSERVATION CODE | R | 139 | 131 | 3 | 0 | 5 |
| 2025-specialty-codes | 2025 ENERGY CONSERVATION CODE | C | 249 | 235 | 8 | 0 | 6 |
| 2025-specialty-codes | 2025 ELECTRICAL CODE — NYC AMENDMENTS | general | 3 | 3 | 0 | 0 | 0 |
| 2026-enacted-administrative-code | 1968 BUILDING CODE | general | 348 | 348 | 0 | 0 | 0 |
| 2026-enacted-administrative-code | ADMINISTRATIVE CODE TITLE 28 | general | 97 | 93 | 2 | 0 | 2 |
| 2026-enacted-administrative-code | FIRE CODE | general | 500 | 488 | 11 | 0 | 1 |
| 2026-existing-building-code | EXISTING BUILDING CODE | general | 163 | 52 | 36 | 0 | 75 |
| 2026-existing-building-code | EXISTING BUILDING CODE | appendix-D | 40 | 37 | 0 | 0 | 3 |
| 2026-zoning-resolution | ZONING RESOLUTION | general | 478 | 478 | 0 | 0 | 0 |

## Occurrence coverage and limits

- 533 chapters mapped; 0 unmapped. Combined appendices are sliced by chapter.
- 183,372 exact-term candidate occurrences outside definition chapters/sections. These are not verified rendered links or semantic applicability decisions.
- 1506 eligible entries have no measured occurrence. This can mean the term does not recur, a spelling/inflection differs, or matching remains incomplete.
- Exact terms, explicit aliases and labels without MDL source-citation annotations are matched. Arbitrary plurals, abbreviations and grammatical variants are not inferred.
- Existing links, source formatting, and definition chapters/sections are preserved. Occurrence counts can include text the UI deliberately leaves inside existing links.
- Only explicit chapter restrictions currently encoded by the compiler are enforced. Other contextual limitations require review.
- Section-specific administrative collections, external standards, and cross-collection edition currency remain incomplete. A code absent from the table is not covered by this index.
- Native visual/touch and signed-in lifecycle acceptance remain separate from corpus and parser checks.

## Unresolved references

Sorted by candidate frequency. Frequency is a prioritization aid, not a justification for substituting another meaning. The references below retain their published wording until an exact applicable source is established.

| Collection / code / scope | Term | Candidate uses | Published reference | Source |
| --- | --- | ---: | --- | --- |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | BUILDING | 1188 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | CITY | 833 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | REQUIRED | 445 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | OCCUPANCY | 253 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | ALTERATION | 236 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | DWELLING (MDL 4(4)) | 211 | See Appendix D. | 2026-existing-building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | DEPARTMENT | 179 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / appendix-D | DWELLING (MDL 4(4)) | 158 | See Chapter 2 of the New York City Building Code. | 2026-existing-building-code/chapters/D2.html § D201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | APPROVAL OR APPROVED | 124 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | ADDITION | 112 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | DWELLING UNIT | 105 | See Appendix D. | 2026-existing-building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | ADMINISTRATIVE CODE | 100 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | DECK | 92 | See Section 1602.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / appendix-D | DWELLING UNIT | 77 | See Chapter 2 of the New York City Building Code. | 2026-existing-building-code/chapters/D2.html § D201 |
| 2022-construction-codes / FUEL GAS CODE / general | VENT CONNECTOR | 76 | See "Connector." | 2022-construction-codes/code-sections/fuel-gas-code/chapters/Chapter 2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | PERMIT | 68 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | MATERIALS | 66 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2025-specialty-codes / 2025 ENERGY CONSERVATION CODE / C | LISTED | 65 | See Section 28-101.5 of the Administrative Code. | 2025-specialty-codes/chapters/32000008.html § C202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | COMMISSIONER | 61 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2025-specialty-codes / 2025 ENERGY CONSERVATION CODE / C | APPROVAL OR APPROVED | 59 | See Section 28-101.5 of the Administrative Code | 2025-specialty-codes/chapters/32000008.html § C202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | OWNER | 49 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | STRUCTURE | 42 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | CONSTRUCTION DOCUMENTS | 34 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2025-specialty-codes / 2025 ENERGY CONSERVATION CODE / R | APPROVED | 33 | See Section 28-101.5 of the Administrative Code. | 2025-specialty-codes/chapters/32000002.html § R202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | HEREAFTER | 30 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | REGISTERED DESIGN PROFESSIONAL | 28 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | LISTED | 28 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | DEMOLITION | 27 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2025-specialty-codes / 2025 ENERGY CONSERVATION CODE / R | LISTED | 25 | See Section 28-101.5 of the Administrative Code. | 2025-specialty-codes/chapters/32000002.html § R202 |
| 2014-construction-codes / BUILDING CODE / general | DIRECT AND CONTINUING SUPERVISION | 22 | See Section 28-401.3 of the Administrative Code. | 2014-construction-codes/chapters/bc-2.html §  |
| 2014-construction-codes / BUILDING CODE / general | SHOTCRETE | 21 | See Section 1913.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / appendix-D | APARTMENT | 20 | See Chapter 2 of the New York City Building Code. | 2026-existing-building-code/chapters/D2.html § D201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | REGISTERED DESIGN PROFESSIONAL OF RECORD | 19 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 / general | PRIOR CODE BUILDING | 19 | See 1968 OR PRIOR CODE BUILDING OR STRUCTURE (PRIOR CODE BUILDING). | 2026-enacted-administrative-code/chapters/30000082.html § 28-101.5 |
| 2025-specialty-codes / 2025 ENERGY CONSERVATION CODE / C | LABELED | 18 | See Section 28-101.5 of the Administrative Code. | 2025-specialty-codes/chapters/32000008.html § C202 |
| 2025-specialty-codes / 2025 ENERGY CONSERVATION CODE / R | LABELED | 18 | See Section 28-101.5 of the Administrative Code. | 2025-specialty-codes/chapters/32000002.html § R202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | PREMISES | 16 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | ACCEPTANCE OR ACCEPTED | 14 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2022-construction-codes / BUILDING CODE / general | ELECTRIC VEHICLE SUPPLY EQUIPMENT (EVSE) | 14 | See Article 625.2 of the New York City Electrical Code . | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | PROJECT | 13 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / PLUMBING CODE / general | STORM SEWER | 13 | See “Sewer, storm sewer.” | 2014-construction-codes/chapters/pc-2.html §  |
| 2025-specialty-codes / 2025 ENERGY CONSERVATION CODE / C | APPROVED AGENCY | 11 | See Section 28-101.5 of the Administrative Code. | 2025-specialty-codes/chapters/32000008.html § C202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | SPECIAL INSPECTION | 11 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | ENLARGEMENT | 10 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2022-construction-codes / BUILDING CODE / general | HOLD-DOWN | 9 | See "TIE-DOWN". | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | EXISTING BUILDING OR STRUCTURE | 8 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | 1968 BUILDING CODE | 8 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | REQUIRED STRENGTH | 7 | See Sections 1602.1 and 2102.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2022-construction-codes / BUILDING CODE / general | DETOXIFICATION FACILITIES | 6 | See Section 308.2.1. | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | CHARTER | 6 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / ADMINISTRATIVE PROVISIONS / general | PRIOR CODE BUILDING | 6 | See 1968 OR PRIOR CODE BUILDING OR STRUCTURE (PRIOR CODE BUILDING). | 2014-construction-codes/chapters/ac-1.html § 28-101.5 |
| 2025-specialty-codes / 2025 ENERGY CONSERVATION CODE / R | APPROVED AGENCY | 5 | See Section 28-101.5 of the Administrative Code. | 2025-specialty-codes/chapters/32000002.html § R202 |
| 2014-construction-codes / BUILDING CODE / general | NONRESIDENTIAL (FOR FLOOD ZONE PURPOSES) | 5 | See Section G201.2. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | PERSON | 5 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | SUPERINTENDENT OF CONSTRUCTION | 5 | See Section 28-101.5 of the Administrative Code. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-enacted-administrative-code / FIRE CODE / general | LOWER EXPLOSIVE LIMIT (LEL) | 5 | See "Lower flammable limit." | 2026-enacted-administrative-code/chapters/30000095.html § 202 |
| 2014-construction-codes / BUILDING CODE / general | MINOR ALTERATIONS | 4 | See Section 3302.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2022-construction-codes / BUILDING CODE / general | MINOR ALTERATIONS | 4 | See Section 105.4.2* of the Administrative Code . * Editor's note: As set forth in L.L. 2021/126; correct reference should be Section 28-105.4.2. | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2014-construction-codes / BUILDING CODE / general | CONSTRUCTION TYPES | 4 | See Section 602. Type I. See Section 602.2. Type II. See Section 602.2. Type III. See Section 602.3. Type IV. See Section 602.4. Type V. See Section 602.5. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | PARTY WALL | 4 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2022-construction-codes / BUILDING CODE / general | ORDINARY REPAIRS | 4 | See Section 105.4.2* of the Administrative Code . * Editor's note: As set forth in L.L. 2021/126; correct reference should be Section 28-105.4.2. | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2014-construction-codes / PLUMBING CODE / general | COVERED DEVELOPMENT PROJECT | 3 | See Section 28-104.11.1 of the Administrative Code. *Section 202 was amended by: Local Law 97 of 2017. This law has an effective date of June 1, 2019. | 2014-construction-codes/chapters/pc-2.html §  |
| 2022-construction-codes / BUILDING CODE / general | PRIOR CODE BUILDING | 3 | The following terms are defined in Section 28-101.5 of the Administrative Code : | 2022-construction-codes/code-sections/building-code/chapters/2.html § 201.3.1 |
| 2022-construction-codes / PLUMBING CODE / general | COVERED DEVELOPMENT PROJECT | 3 | See Section 28-104.11.1 of the Administrative Code. | 2022-construction-codes/code-sections/plumbing-code/chapters/Chapter 2.html § 202 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS / general | PRIOR CODE BUILDING | 3 | See 1968 OR PRIOR CODE BUILDING OR STRUCTURE (PRIOR CODE BUILDING). | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 1.html § 28-101.5 |
| 2014-construction-codes / BUILDING CODE / general | POSTFIRE SMOKE PURGE SYSTEM | 3 | See Section 902.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2014-construction-codes / BUILDING CODE / general | STRIPPING OPERATIONS | 3 | See Section 3303.2. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | FLOOD HAZARD AREA | 3 | See Chapter 2 of the New York City Building Code. | 2026-existing-building-code/chapters/2.html § 202 |
| 2022-construction-codes / BUILDING CODE / general | CHILD CARE FACILITIES | 3 | See Section 308.2.1. | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2022-construction-codes / BUILDING CODE / general | SUPERINTENDENT OF CONSTRUCTION | 3 | See Chapter 1 of Title 28 of the Administrative Code . | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | HERETOFORE | 3 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | DIRECT EMPLOY | 3 | See Section 28-401.3 of the Administrative Code. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | MARK | 2 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | FLOOR SURFACE AREA | 2 | See Section 101.4.5.2 of the Administrative Code. | 2014-construction-codes/chapters/bc-2.html §  |
| 2014-construction-codes / PLUMBING CODE / general | POST-CONSTRUCTION STORMWATER MANAGEMENT FACILITY | 2 | See Section 28-104.11.1 of the Administrative Code. *Section 202 was amended by: Local Law 97 of 2017. This law has an effective date of June 1, 2019. | 2014-construction-codes/chapters/pc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | LABELED | 2 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | LABEL | 2 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | COVERED DEVELOPMENT PROJECT | 2 | See Section 28-104.11.1 of the Administrative Code. *Section 202 was amended by: Local Law 97 of 2017. This law has an effective date of June 1, 2019. | 2014-construction-codes/chapters/bc-2.html §  |
| 2022-construction-codes / PLUMBING CODE / general | POST-CONSTRUCTION STORMWATER MANAGEMENT FACILITY | 2 | See Section 28-104.11.1 of the Administrative Code. | 2022-construction-codes/code-sections/plumbing-code/chapters/Chapter 2.html § 202 |
| 2014-construction-codes / BUILDING CODE / general | MENTAL HOSPITALS | 2 | See Section 308.3.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | SERVICE EQUIPMENT | 2 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | DAY | 2 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2025-specialty-codes / 2025 ENERGY CONSERVATION CODE / C | COMMISSIONING PLAN | 2 | See Section C408.2.1, Commissioning plan. | 2025-specialty-codes/chapters/32000008.html § C202 |
| 2022-construction-codes / BUILDING CODE / general | COVERED DEVELOPMENT PROJECT | 2 | See Section 28-104.11.1 of the Administrative Code . | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2014-construction-codes / BUILDING CODE / general | LABORATORY CHEMICAL | 2 | See Section 419.4. | 2014-construction-codes/chapters/bc-2.html §  |
| 2014-construction-codes / BUILDING CODE / general | MEMBRANE-PENETRATION FIRESTOP | 1 | See Section 702.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2014-construction-codes / BUILDING CODE / general | DRAFTSTOP | 1 | See Section 702.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2022-construction-codes / BUILDING CODE / general | EFFECTIVE WIND AREA | 1 | See ASCE 7. | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | WORK NOT CONSTITUTING MINOR ALTERATIONS OR ORDINARY REPAIRS | 1 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | SPECIAL INSPECTOR | 1 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | APPROVED AGENCY | 1 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2022-construction-codes / BUILDING CODE / general | POST-CONSTRUCTION STORMWATER MANAGEMENT FACILITY | 1 | See Section 28-104.11.1 of the Administrative Code . | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | SPECIAL INSPECTION AGENCY | 1 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | POST-CONSTRUCTION STORMWATER MANAGEMENT FACILITY | 1 | See Section 28-104.11.1 of the Administrative Code. *Section 202 was amended by: Local Law 97 of 2017. This law has an effective date of June 1, 2019. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | FIRE PROTECTION PLAN | 1 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | STORMWATER CONSTRUCTION PERMIT | 1 | See Section 28-104.11.1 of the Administrative Code. *Section 202 was amended by: Local Law 97 of 2017. This law has an effective date of June 1, 2019. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | ENGINEER | 1 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2022-construction-codes / BUILDING CODE / general | STORMWATER CONSTRUCTION PERMIT | 1 | See Section 28-104.11.1 of the Administrative Code . | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | USE (USED) | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | COMMERCIAL TRUCK-MOUNTED CRANE (BOOM TRUCK) | 0 | See Section 3302.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2014-construction-codes / BUILDING CODE / general | SPECIFIED COMPRESSIVE STRENGTH OF MASONRY (f’m) | 0 | See Section 2102.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2022-construction-codes / BUILDING CODE / general | HOSPITALS ANDPSYCHIATRIC CENTERS | 0 | See Section 308.2. | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2022-construction-codes / MECHANICAL CODE / general | PRIOR CODE BUILDING | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code : | 2022-construction-codes/code-sections/mechanical-code/chapters/Chapter 2.html § 201.3.1 |
| 2014-construction-codes / BUILDING CODE / general | VALUE (OF ALTERATIONS, TO DETERMINE REQUIRED FIRE PROTECTION) | 0 | See Section 902.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | PROFESSIONAL CERTIFICATION | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | SINGLE ROOM OCCUPANCY MULTIPLE DWELLING | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | INTERIM CERTIFICATE OF OCCUPANCY | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2022-construction-codes / PLUMBING CODE / general | LIMITED OIL-BURNING BOILER ALTERATIONS | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code : | 2022-construction-codes/code-sections/plumbing-code/chapters/Chapter 2.html § 201.3.1 |
| 2025-specialty-codes / 2025 ENERGY CONSERVATION CODE / C | PROFESSIONAL CERTIFICATION | 0 | See Section 28-101.5 of the Administrative Code. | 2025-specialty-codes/chapters/32000008.html § C202 |
| 2022-construction-codes / MECHANICAL CODE / general | POWER BOILER | 0 | See "Boiler". | 2022-construction-codes/code-sections/mechanical-code/chapters/Chapter 2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | LETTER OF COMPLETION | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / MECHANICAL CODE / general | POWER BOILER | 0 | See “Boiler.” | 2014-construction-codes/chapters/mc-2.html §  |
| 2014-construction-codes / BUILDING CODE / general | DRY-CHEMICAL EXTINGUISHING SYSTEM | 0 | See Section 902.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2014-construction-codes / BUILDING CODE / general | HIGH-PRESSURE BOILER | 0 | See Section 28-401.3 of the Administrative Code. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | LAND SURVEYOR | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | DWELLING UNIT OR SLEEPING UNIT, MULTI-STORY | 0 | See Section 1102.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | MANUFACTURER’S DESIGNATION | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | APPROVED FABRICATOR | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS / general | GREEN ROOF SYSTEM | 0 | See chapter 2 of the New York city building code. (L.L. 2017/233, 12/1/2017, eff. 12/1/2018; Am. L.L. 2019/093, 5/19/2019, eff. 9/16/2019; Am. L.L. 2021/126, 11/7/2021, eff. 11/7/2022) Editor's note: For related unconsolidated provisions, see Appendix A at L.L. 2021/126. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 1.html § 28-103.33.1 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | SUBSTANTIAL IMPROVEMENT | 0 | See Chapter 2 of the New York City Building Code. | 2026-existing-building-code/chapters/2.html § 202 |
| 2022-construction-codes / BUILDING CODE / general | HIGH-PRESSURE BOILER | 0 | See Section 28-401.3 of the Administrative Code . | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | FABRICATED ITEM | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | WRITTEN NOTICE | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | PREFIRM DEVELOPMENT | 0 | See Section G201.2. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 / general | GREEN ROOF SYSTEM | 0 | See chapter 2 of the New York city building code. (L.L. 2017/233, 12/1/2017, eff. 12/1/2018; Am. L.L. 2019/093, 5/19/2019, eff. 9/16/2019; Am. L.L. 2021/126, 11/7/2021, eff. 11/7/2022) | 2026-enacted-administrative-code/chapters/30000082.html § 28-103.33.1 |
| 2014-construction-codes / BUILDING CODE / general | MAXIMUM CONSIDERED EARTHQUAKE (MEC) GROUND MOTION | 0 | See Section 1613.2. | 2014-construction-codes/chapters/bc-2.html §  |
| 2022-construction-codes / BUILDING CODE / general | EXISTING STRUCTURE (FOR FLOOD ZONE PURPOSES) | 0 | See Section G201.1.2. | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | WRITING (WRITTEN) | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | PREFIRM STRUCTURE | 0 | See Section G201.2. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | SUBSTANTIAL DAMAGE | 0 | See Chapter 2 of the New York City Building Code. | 2026-existing-building-code/chapters/2.html § 202 |
| 2022-construction-codes / PLUMBING CODE / general | STORMWATER POLLUTION PREVENTION PLAN OR SWPPP | 0 | See Section 28-104.11.1 of the Administrative Code. | 2022-construction-codes/code-sections/plumbing-code/chapters/Chapter 2.html § 202 |
| 2014-construction-codes / BUILDING CODE / general | LIMITED OIL BURNING BOILER ALTERATIONS | 0 | See Section 28-101.5 of the Administrative Code. | 2014-construction-codes/chapters/bc-2.html §  |
| 2014-construction-codes / BUILDING CODE / general | FLOOD DAMAGE-RESISTANT MATERIALS | 0 | See Section G201.2. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | APPROVED INSPECTION AGENCY | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | CONCRETE CARBONATE AGGREGATE | 0 | See Section 721.1.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2014-construction-codes / BUILDING CODE / general | SILTS AND CLAY SLITS | 0 | See Section 1804.2.1. Dense (Class 5a). See Section 1804.2.1. Medium (Class 5b). See Section 1804.2.1. Loose (Class 6). See Section 1804.2.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | PROGRESS INSPECTION | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | SINGLE-POINT ADJUSTABLE SUSPENSION SCAFFOLD | 0 | See Section 3302.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | DEMOLITION, PARTIAL | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | ENVIRONMENTAL CONTROL BOARD or ECB | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | MAIN USE OR DOMINANT OCCUPANCY (OF A BUILDING) | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2022-construction-codes / BUILDING CODE / general | PLATFORM (SPECIAL USE) | 0 | See Section 410.2.2. | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | DEMOLITION, FULL | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | DEFERRED SUBMITTAL | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | SIGN-OFF | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2025-specialty-codes / 2025 ENERGY CONSERVATION CODE / R | PROFESSIONAL CERTIFICATION | 0 | See Section 28-101.5 of the Administrative Code. | 2025-specialty-codes/chapters/32000002.html § R202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | APPROVED TESTING AGENCY | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / PLUMBING CODE / general | STORMWATER CONSTRUCTION PERMIT | 0 | See Section 28-104.11.1 of the Administrative Code. *Section 202 was amended by: Local Law 97 of 2017. This law has an effective date of June 1, 2019. | 2014-construction-codes/chapters/pc-2.html §  |
| 2022-construction-codes / BUILDING CODE / general | EXISTING CONSTRUCTION (FOR FLOOD ZONE PURPOSES) | 0 | See Section G201.1.2. | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2022-construction-codes / FUEL GAS CODE / general | PRIOR CODE BUILDING | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code : | 2022-construction-codes/code-sections/fuel-gas-code/chapters/Chapter 2.html § 201.3.1 |
| 2022-construction-codes / BUILDING CODE / general | HISTORIC STRUCTURE (FLOOD-RESISTANT CONSTRUCTION) | 0 | See Section G201.1.2. | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | RETAINING WALL | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | POSTFIRM DEVELOPMENT | 0 | See Section G201.2. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | UTILITY CORPORATION OR PUBLIC UTILITY CORPORATION | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | INSPECTION CERTIFICATE | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2022-construction-codes / PLUMBING CODE / general | PRIOR CODE BUILDING | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code : | 2022-construction-codes/code-sections/plumbing-code/chapters/Chapter 2.html § 201.3.1 |
| 2014-construction-codes / BUILDING CODE / general | POSTFIRM STRUCTURE | 0 | See Section G201.2. | 2014-construction-codes/chapters/bc-2.html §  |
| 2014-construction-codes / BUILDING CODE / general | BALCONY, EXTERIOR | 0 | See Section 1602.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | CERTIFICATE OF COMPLIANCE | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | UTILITY COMPANY OR PUBLIC UTILITY COMPANY | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | ARCHITECT | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | PARTICLE BOARD | 0 | See Section 2302.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2014-construction-codes / BUILDING CODE / general | THERMALLY ISOLATED SUNROOM ADDITION | 0 | See Section 1202.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | PRIOR CODE BUILDING OR STRUCTURE | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | LANDSCAPE ARCHITECT | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |

## Acceptance still required

- Review unmatched terms and scope restrictions against each definition chapter; extend matching only where source wording supports it.
- Resolve available exact references; separately list unavailable external or mismatched-edition sources.
- Verify pop-ups, source labels, dismissal and reading-position retention across web and native renderers, including tables and long definitions.
- Verify first-load performance and physical-device touch behavior before declaring complete.

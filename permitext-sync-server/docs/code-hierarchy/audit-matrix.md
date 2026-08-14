# Permitext code hierarchy audit

Generated 2026-08-14T01:22:04.548Z.

Counts treat enacted text, extraction metadata, and Reader navigation as separate concerns.
Placeholder recovery changes visible section labels only; canonical section IDs are unchanged.

| Prefix | Package | Source ch. | Nav ch. | Manifest | Prepared | Catalog | Search | Placeholders recovered | Promotion | Issues |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| BC | nyc-2022-construction-codes | 58 | 58 | 7936 | 7936 | 7936 | 7936 | 0/0 | source chapters | none |
| AC | nyc-2022-construction-codes | 5 | 5 | 1429 | 1429 | 1429 | 1429 | 0/0 | source chapters | none |
| PC | nyc-2022-construction-codes | 22 | 22 | 1199 | 1199 | 1199 | 1199 | 0/0 | source chapters | none |
| MC | nyc-2022-construction-codes | 18 | 18 | 1484 | 1484 | 1484 | 1484 | 0/0 | source chapters | none |
| FGC | nyc-2022-construction-codes | 15 | 15 | 843 | 843 | 843 | 843 | 0/0 | source chapters | none |
| ECC | nyc-2025-specialty-codes | 13 | 13 | 68 | 68 | 68 | 68 | 0/0 | source chapters | none |
| EC | nyc-2025-specialty-codes | 9 | 9 | 293 | 293 | 293 | 293 | 0/0 | source chapters | none |
| EBC | nyc-existing-building-code | 31 | 31 | 170 | 170 | 170 | 170 | 0/0 | source chapters | none |
| FC | nyc-enacted-administrative-code | 2 | 50 | 415 | 415 | 415 | 415 | 411/411 | logical groups | incorrect-hierarchy-normalization |
| BC68 | nyc-enacted-administrative-code | 19 | 19 | 949 | 949 | 949 | 949 | 0/27 | source chapters | incorrect-hierarchy-normalization |
| HMC | nyc-enacted-administrative-code | 5 | 5 | 211 | 211 | 211 | 211 | 0/0 | source chapters | none |
| T24 | nyc-enacted-administrative-code | 11 | 11 | 408 | 408 | 408 | 408 | 0/0 | source chapters | none |
| T25 | nyc-enacted-administrative-code | 8 | 8 | 261 | 261 | 261 | 261 | 0/0 | source chapters | none |
| T26 | nyc-enacted-administrative-code | 38 | 38 | 228 | 228 | 228 | 228 | 0/0 | source chapters | none |
| T28 | nyc-enacted-administrative-code | 12 | 12 | 2602 | 2602 | 2602 | 2602 | 0/1232 | source chapters | incorrect-hierarchy-normalization |
| LL | nyc-enacted-administrative-code | 39 | 39 | 225 | 225 | 225 | 225 | 0/0 | source chapters | none |
| ZR | nyc-zoning-resolution | 117 | 117 | 4068 | 4068 | 4068 | 4068 | 0/0 | source chapters | none |

## Fire Code

- Source/container chapters: 2
- Logical navigation chapters: 50
- Administration chapter: Chapter 1: Administration (enacted-30000095-group-001)
- FC 103 canonical ID: 31004665
- FC 103 visible number: FC 103
- FC 103 reserved representation: preserved

## Fuel Gas Code

- Source/navigation chapters: 15
- A: Reserved (1 sections)
- B: Reserved (1 sections)
- C: Reserved (1 sections)
- D: Reserved (1 sections)
- E: Meters and Gas Service Piping (1 sections)
- F: Reserved (1 sections)
- G: High Pressure Natural Gas Installations (1 sections)
- 1: Administration (74 sections)
- 2: Definitions (5 sections)
- 3: General Regulations (139 sections)
- 4: Gas Piping Installations (232 sections)
- 5: Chimneys and Vents (242 sections)
- 6: Specific Appliances (135 sections)
- 7: Gaseous Hydrogen Systems (6 sections)
- 8: Referenced Standards (3 sections)

## Remaining extraction defects

- BC68: 27 stored section numbers remain placeholders after title recovery. Canonical IDs were not changed.
- T26: duplicate source chapter numbers 13, 21, 37.
- T28: 1232 stored section numbers remain placeholders after title recovery. Canonical IDs were not changed.


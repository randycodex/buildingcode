# Permitext Research Benchmark v2 — Correction Record

Date: August 11, 2026

The original 40-case benchmark is preserved unchanged in `Permitext_Research_Benchmark_40_Cases_original.md`. The corrected working benchmark is `Permitext_Research_Benchmark_40_Cases_v2.md`.

## Evaluation changes

- Separated retrieval, answer-quality, citation-entailment, and evidence-boundary scoring.
- Classified citation expectations as Required, Conditional, Supporting, or Outside authority.
- Reframed the cases for Permitext's current automatic enacted-text retrieval flow instead of the earlier manual selected-evidence workflow.
- Converted Test 40 into the shared synthesis rubric applied across concrete cases.
- Added a machine-readable Markdown parser and a structural contract covering all 40 cases.
- Preserved regression fixtures, shared-rubric status, and citation-role qualifiers in the machine-readable dataset so automated runs receive the frozen facts and source boundaries.

## Material corrections

- Corrected occupant-load references to NYC BC §1004.1.3 and Table 1004.1.3 and fixed-seating references to §1004.3.
- Corrected accessory-occupancy area limitations to §508.2.3.
- Corrected egress-door clear-width detail to §1010.1.1.1.
- Corrected Test 13: NYC BC §1010.1.2.2 uses the applicable 75-person direction-of-swing threshold; a 55-person load alone does not trigger outward swing.
- Corrected dead-end corridor analysis to §1020.4 and separated the materially different R-1 and R-2 conditions.
- Corrected corridor fire-resistance provisions and tables in Test 15.
- Corrected fire-door opening-protective analysis to §716.5 and Table 716.5, preserving the assembly-purpose distinction.
- Added NYC-specific basement/cellar and Type B+NYC accessibility distinctions.
- Marked ICC A117.1-2009 technical text as conditional/outside the reproduced local corpus unless separately available as authorized evidence.
- Froze Tests 28–30 to an August 10, 2026 filing date and distinguished EBC enactment from current applicability.
- Reworked cross-reference, table, definition, and FDNY cases around automatic retrieval and explicit source roles.

## Official applicability sources

- NYC Department of Buildings, Existing Building Code: https://www.nyc.gov/site/buildings/codes/existing-building-code.page
- NYC Department of Buildings, Local Laws: https://www.nyc.gov/site/buildings/codes/local-laws.page
- NYC Department of Buildings, 2022 Construction Codes: https://www.nyc.gov/site/buildings/codes/2022-construction-codes.page
- FDNY, 2022 Fire Code: https://www.nyc.gov/site/fdny/codes/fire-code/fire-code.page

The NYC Department of Buildings states that the Existing Building Code was enacted in 2026 but will govern alteration applications filed on and after July 17, 2027. For the benchmark's frozen August 10, 2026 filing date, the currently applicable Administrative Code and 2022 Construction Code framework remains controlling; future-effective EBC material may be identified only as such.

## Review status

Version 2 is a corrected draft for knowledgeable-human review, not an approved legal answer key. Automated passes should report retrieval, answer content, citation entailment, uncertainty, missing-fact recognition, and forbidden-claim violations separately. A model must not receive credit merely for reproducing the ideal wording.

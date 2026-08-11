# Permitext Research Benchmark — 40 Distinct Cases v2 Correction Record

Date: August 11, 2026

The original benchmark is preserved unchanged in `Permitext_Research_Benchmark_40_Distinct_Cases_original.md` with SHA-256 `736bd7560207765d9a4b797673ed88679c397dc31907f345e904af7f5f5cf4d5`. The corrected working benchmark is `Permitext_Research_Benchmark_40_Distinct_Cases_v2.md`.

## Evaluation changes

- Reframed the benchmark for automatic enacted-text retrieval and conversational follow-up, removing the earlier selected-evidence assumptions.
- Classified expected sources as Required, Conditional, Supporting, or Outside authority and distinguished enacted authority from guidance, incorporated standards, project evidence, and unavailable facts.
- Made missing project facts explicit so a model is rewarded for a qualified answer rather than unsupported certainty.
- Preserved text-only scope and separated retrieval success from answer correctness, citation entailment, evidence-boundary compliance, and forbidden claims.

## Material corrections by test range

- **Tests 1–7 — fire and vertical openings:** corrected fire-wall roof termination, exterior-wall ratings/openings, parapets, unenclosed stairs, atriums, shaft penetrations, and fire-damper exceptions to their exact NYC BC sections and conditions.
- **Tests 8–14 — existing-building triggers, systems, accessibility, and structures:** corrected alteration-value sprinkler thresholds, standpipe triggers, emergency/standby power, accessible vertical routes and ICC A117.1 limits, elevator-lobby alternatives, assembly live loads, and dense-file-storage structural review.
- **Tests 15–19 — guards, stairs, roofs, ventilation, and combustion air:** separated guard height/openings/loads without inventing a horizontal-rail ban; corrected handrail continuity, occupied-roof story treatment, bathroom exhaust/discharge, and moved gas-appliance combustion air from MC Chapter 7 to FGC §304.
- **Tests 20–22 — plumbing fixtures:** corrected mixed-use fixture calculations and rounding, single-occupant all-gender counting under PC §§403.1.3 and 403.2.2, and the limited PC §410.3 bottle-filling substitution while preserving the bottled-water prohibition.
- **Tests 23–24 — 2025 NYCECC:** confirmed the March 30, 2026 filing transition for a complete August 2026 application, corrected replacement-fenestration scope, and cited the exact rule preventing cavity R-values from satisfying continuous-insulation requirements.
- **Tests 25–27 — inspections, garages, and EVSE:** replaced generic rainscreen citations with conditional BC §§1705.16 and 1705.20 triggers; clarified that CO and NO2 controls do not replace enclosed-garage ventilation; and applied BC §406.4.10 to 80 spaces as 16 Level 2-equipped and 48 EVSE-capable spaces, subject to stated exceptions.
- **Tests 28–40 — cross-discipline and authority boundaries:** corrected flood, emergency-opening, smoke-separation, horizontal-assembly support, fireblocking, interior-finish, exterior-opening, mezzanine, equipment-platform, rooftop-enclosure, structural-frame, DOB-rule, and Local-Law transition analyses. Each case now identifies controlling enacted text, conditional provisions, noncontrolling guidance, and facts or sources outside the available authority.

## Evidence boundaries

- Incorporated standards such as ICC A117.1, ASCE 24, ASTM, UL, and NFPA are not treated as reproduced evidence unless their text is separately available and authorized.
- DOB bulletins, service notices, FAQs, FEMA material, product reports, manufacturer instructions, drawings, surveys, and professional conclusions are labeled by their actual role and do not silently replace enacted code.
- Future-effective, superseded, proposed, or project-specific material cannot be used as current governing authority without an applicable transition rule and verified version status.
- Calculations and conclusions requiring dimensions, classifications, filing status, equipment schedules, or other project facts remain conditional until those text facts are supplied.

## Evaluation status

Version 2 is a corrected draft for knowledgeable-human review, not an approved legal answer key. The 40-case distinct-benchmark structural contract passes. Its offline local-corpus retrieval regression evaluates 36 cases containing 92 concrete Required citations available in the canonical 2022 NYC BC, MC, PC, FGC, and AC source families; candidate and assembled-evidence recall are both 92/92, all 36 cases have full recall, and no paid model calls are made. Tests 23–24 and other source expectations limited to the 2025 NYCECC, 2025 Electrical Code, 1 RCNY, or outside authorities are not silently mapped into that local-corpus score. These results measure retrieval, not 40-case answer quality. Automated evaluation should continue to score substantive accuracy, citation entailment, uncertainty, missing-fact recognition, and forbidden-claim violations separately.

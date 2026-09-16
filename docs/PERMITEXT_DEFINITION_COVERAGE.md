# Definition coverage review

This is a local implementation inventory, not a claim that all definitions are complete or applicable in every context. Source wording is preserved; no meaning is invented for unresolved references.

Registry SHA-256: `c9a263dc3beff846239d0a014542277df6b234014ad57410fe107a70c5d8f215`.

Reproduce with `node scripts/audit-definition-occurrences.mjs` followed by `node scripts/report-definition-coverage.mjs` from `permitext-sync-server`.

## Indexed definition sources

| Collection | Code | Scope | Entries | Eligible for matching | Direct | Resolved | Alternatives | Unresolved |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2014-construction-codes | ADMINISTRATIVE PROVISIONS | general | 88 | 75 | 84 | 2 | 0 | 2 |
| 2014-construction-codes | BUILDING CODE | general | 884 | 884 | 85 | 759 | 18 | 22 |
| 2014-construction-codes | PLUMBING CODE | general | 191 | 191 | 170 | 15 | 2 | 4 |
| 2014-construction-codes | MECHANICAL CODE | general | 245 | 245 | 240 | 4 | 0 | 1 |
| 2014-construction-codes | FUEL GAS CODE | general | 171 | 171 | 165 | 6 | 0 | 0 |
| 2022-construction-codes | BUILDING CODE | general | 1000 | 1000 | 853 | 134 | 0 | 13 |
| 2022-construction-codes | FUEL GAS CODE | general | 234 | 234 | 150 | 82 | 0 | 2 |
| 2022-construction-codes | GENERAL ADMINISTRATIVE PROVISIONS | general | 97 | 82 | 93 | 2 | 0 | 2 |
| 2022-construction-codes | MECHANICAL CODE | general | 318 | 318 | 236 | 80 | 0 | 2 |
| 2022-construction-codes | PLUMBING CODE | general | 273 | 273 | 173 | 93 | 2 | 5 |
| 2025-specialty-codes | 2025 ENERGY CONSERVATION CODE | R | 139 | 139 | 131 | 3 | 0 | 5 |
| 2025-specialty-codes | 2025 ENERGY CONSERVATION CODE | C | 249 | 249 | 235 | 8 | 0 | 6 |
| 2025-specialty-codes | 2025 ELECTRICAL CODE — NYC AMENDMENTS | general | 3 | 3 | 3 | 0 | 0 | 0 |
| 2026-enacted-administrative-code | ADMINISTRATIVE CODE TITLE 24 | general | 84 | 82 | 84 | 0 | 0 | 0 |
| 2026-enacted-administrative-code | 1968 BUILDING CODE | general | 348 | 348 | 348 | 0 | 0 | 0 |
| 2026-enacted-administrative-code | HOUSING MAINTENANCE CODE | general | 39 | 39 | 39 | 0 | 0 | 0 |
| 2026-enacted-administrative-code | ADMINISTRATIVE CODE TITLE 28 | general | 97 | 82 | 93 | 2 | 0 | 2 |
| 2026-enacted-administrative-code | FIRE CODE | general | 500 | 500 | 488 | 11 | 0 | 1 |
| 2026-existing-building-code | EXISTING BUILDING CODE | general | 163 | 163 | 52 | 36 | 0 | 75 |
| 2026-existing-building-code | EXISTING BUILDING CODE | appendix-D | 40 | 40 | 37 | 0 | 0 | 3 |
| 2026-zoning-resolution | ZONING RESOLUTION | general | 478 | 0 | 478 | 0 | 0 | 0 |

Eligibility still respects each entry’s chapter restriction. Title 24 Board and Department entries are withheld because §24-102 also names different health agencies; contextual matching remains open.

## Occurrence coverage and limits

- 533 chapters mapped; 0 unmapped. Combined appendices are sliced by chapter.
- 190,890 exact-term candidate occurrences outside definition chapters/sections. These are not verified rendered links or semantic applicability decisions.
- 1517 eligible entries have no measured occurrence. This can mean the term does not recur, a spelling/inflection differs, or matching remains incomplete.
- Equivalent general/appendix index entries share occurrence evidence only within the same code and edition; the Reader displays their identical source once.
- Exact terms, explicit aliases and labels without MDL source-citation annotations are matched. Arbitrary plurals, abbreviations and grammatical variants are not inferred.
- Existing links, source formatting, and definition chapters/sections are preserved. Occurrence counts can include text the UI deliberately leaves inside existing links.
- Only explicit chapter restrictions currently encoded by the compiler are enforced. Other contextual limitations require review.
- Section-specific administrative collections, external standards, and cross-collection edition currency remain incomplete. A code absent from the table is not covered by this index.
- Native visual/touch and signed-in lifecycle acceptance remain separate from corpus and parser checks.

## Located definition sections requiring further extraction

These explicit source headings identify remaining extraction work. They do not establish code-wide applicability. Inspect each scope statement and term-specific exception before enabling links. Headings can include amendments or repealed material; discovery alone is not acceptance.

| Unindexed or partially indexed collection / code | Chapters scanned | Remaining definition-related headings |
| --- | ---: | ---: |
| 2014-construction-codes / ADMINISTRATIVE PROVISIONS | 5 | 4 |
| 2022-construction-codes / BUILDING CODE | 58 | 87 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | 5 | 24 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 24 | 11 | 11 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 25 | 8 | 4 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 38 | 30 |
| 2026-enacted-administrative-code / HOUSING MAINTENANCE CODE | 5 | 7 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 12 | 56 |
| 2026-enacted-administrative-code / CONSTRUCTION-RELATED LOCAL LAWS | 39 | 0 |
| 2026-zoning-resolution / ZONING RESOLUTION | 117 | 105 |

Zero matching headings does not establish that a collection contains no definitions; inline definitions and amendments need separate review.

| Collection / code | Heading | Source and anchor |
| --- | --- | --- |
| 2014-construction-codes / ADMINISTRATIVE PROVISIONS | AC 28-106.4 Definitions. | 2014-construction-codes/chapters/ac-1.html#nyc-2014-41000133 |
| 2014-construction-codes / ADMINISTRATIVE PROVISIONS | AC 28-419.2 Definitions. | 2014-construction-codes/chapters/ac-4.html#nyc-2014-41000733 |
| 2014-construction-codes / ADMINISTRATIVE PROVISIONS | AC 28-502.1 Definitions. | 2014-construction-codes/chapters/ac-5.html#nyc-2014-41000770 |
| 2014-construction-codes / ADMINISTRATIVE PROVISIONS | AC 28-503.10 Definitions. | 2014-construction-codes/chapters/ac-5.html#nyc-2014-41000802 |
| 2022-construction-codes / BUILDING CODE | Chapter 2: Definitions | 2022-construction-codes/code-sections/building-code/chapters/2.html#rid-0-0-0-164534 |
| 2022-construction-codes / BUILDING CODE | Section BC 202: Definitions | 2022-construction-codes/code-sections/building-code/chapters/2.html#rid-0-0-0-164625 |
| 2022-construction-codes / BUILDING CODE | 303.1.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/3.html#rid-0-0-0-165881 |
| 2022-construction-codes / BUILDING CODE | 304.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/3.html#rid-0-0-0-165966 |
| 2022-construction-codes / BUILDING CODE | 307.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/3.html#rid-0-0-0-166121 |
| 2022-construction-codes / BUILDING CODE | 308.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/3.html#rid-0-0-0-166259 |
| 2022-construction-codes / BUILDING CODE | 308.2.2 Definitions specific to this section. | 2022-construction-codes/code-sections/building-code/chapters/3.html#rid-0-0-0-166266 |
| 2022-construction-codes / BUILDING CODE | 310.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/3.html#rid-0-0-0-166349 |
| 2022-construction-codes / BUILDING CODE | 402.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-166501 |
| 2022-construction-codes / BUILDING CODE | 402.2.2 Definitions specific to this section. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-166510 |
| 2022-construction-codes / BUILDING CODE | 404.1.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-166803 |
| 2022-construction-codes / BUILDING CODE | 406.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-166899 |
| 2022-construction-codes / BUILDING CODE | 406.9.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-167052 |
| 2022-construction-codes / BUILDING CODE | 408.1.1 Definitions specific to this section. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-167249 |
| 2022-construction-codes / BUILDING CODE | 410.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-167365 |
| 2022-construction-codes / BUILDING CODE | 410.2.2 Definitions specific to this section. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-167375 |
| 2022-construction-codes / BUILDING CODE | 411.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-167480 |
| 2022-construction-codes / BUILDING CODE | 412.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-167499 |
| 2022-construction-codes / BUILDING CODE | 415.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-167747 |
| 2022-construction-codes / BUILDING CODE | 421.1.3 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-168146 |
| 2022-construction-codes / BUILDING CODE | 423.2 Definitions specific to this section. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-168193 |
| 2022-construction-codes / BUILDING CODE | 427.4 Definitions specific to this section. | 2022-construction-codes/code-sections/building-code/chapters/4.html#rid-0-0-0-168254 |
| 2022-construction-codes / BUILDING CODE | Section BC 502: Definitions | 2022-construction-codes/code-sections/building-code/chapters/5.html#rid-0-0-0-168372 |
| 2022-construction-codes / BUILDING CODE | 502.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/5.html#rid-0-0-0-168373 |
| 2022-construction-codes / BUILDING CODE | Section BC 702: Definitions | 2022-construction-codes/code-sections/building-code/chapters/7.html#rid-0-0-0-168915 |
| 2022-construction-codes / BUILDING CODE | 702.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/7.html#rid-0-0-0-168916 |
| 2022-construction-codes / BUILDING CODE | 722.1.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/7.html#rid-0-0-0-170263 |
| 2022-construction-codes / BUILDING CODE | Section BC 802: Definitions | 2022-construction-codes/code-sections/building-code/chapters/8.html#rid-0-0-0-170838 |
| 2022-construction-codes / BUILDING CODE | 802.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/8.html#rid-0-0-0-170839 |
| 2022-construction-codes / BUILDING CODE | Section BC 902: Definitions | 2022-construction-codes/code-sections/building-code/chapters/9.html#rid-0-0-0-171083 |
| 2022-construction-codes / BUILDING CODE | 902.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/9.html#rid-0-0-0-171084 |
| 2022-construction-codes / BUILDING CODE | 909.1.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/9.html#rid-0-0-0-172179 |
| 2022-construction-codes / BUILDING CODE | Section BC 1002: Definitions | 2022-construction-codes/code-sections/building-code/chapters/10.html#rid-0-0-0-172824 |
| 2022-construction-codes / BUILDING CODE | 1002.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/10.html#rid-0-0-0-172825 |
| 2022-construction-codes / BUILDING CODE | 1002.1.2 Definitions specific to this chapter. | 2022-construction-codes/code-sections/building-code/chapters/10.html#rid-0-0-0-172890 |
| 2022-construction-codes / BUILDING CODE | Section BC 1102: Definitions | 2022-construction-codes/code-sections/building-code/chapters/11.html#rid-0-0-0-174792 |
| 2022-construction-codes / BUILDING CODE | 1102.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/11.html#rid-0-0-0-174793 |
| 2022-construction-codes / BUILDING CODE | Section BC 1202: Definitions | 2022-construction-codes/code-sections/building-code/chapters/12.html#rid-0-0-0-175668 |
| 2022-construction-codes / BUILDING CODE | 1202.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/12.html#rid-0-0-0-175669 |
| 2022-construction-codes / BUILDING CODE | Section BC 1402: Definitions | 2022-construction-codes/code-sections/building-code/chapters/14.html#rid-0-0-0-224319 |
| 2022-construction-codes / BUILDING CODE | 1402.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/14.html#rid-0-0-0-176055 |
| 2022-construction-codes / BUILDING CODE | Section BC 1502: Definitions | 2022-construction-codes/code-sections/building-code/chapters/15.html#rid-0-0-0-176482 |
| 2022-construction-codes / BUILDING CODE | 1502.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/15.html#rid-0-0-0-176483 |
| 2022-construction-codes / BUILDING CODE | Section BC 1602: Definitions and Notations | 2022-construction-codes/code-sections/building-code/chapters/16.html#rid-0-0-0-177089 |
| 2022-construction-codes / BUILDING CODE | 1602.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/16.html#rid-0-0-0-177090 |
| 2022-construction-codes / BUILDING CODE | 1609.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/16.html#rid-0-0-0-177626 |
| 2022-construction-codes / BUILDING CODE | 1613.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/16.html#rid-0-0-0-177803 |
| 2022-construction-codes / BUILDING CODE | 1613.3.2 Site class definitions. | 2022-construction-codes/code-sections/building-code/chapters/16.html#rid-0-0-0-177819 |
| 2022-construction-codes / BUILDING CODE | Section BC 1615: Structural Integrity Definitions | 2022-construction-codes/code-sections/building-code/chapters/16.html#rid-0-0-0-177930 |
| 2022-construction-codes / BUILDING CODE | 1615.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/16.html#rid-0-0-0-177931 |
| 2022-construction-codes / BUILDING CODE | 1619.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/16.html#rid-0-0-0-178075 |
| 2022-construction-codes / BUILDING CODE | Section BC 1702: Definitions | 2022-construction-codes/code-sections/building-code/chapters/17.html#rid-0-0-0-178152 |
| 2022-construction-codes / BUILDING CODE | 1702.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/17.html#rid-0-0-0-178153 |
| 2022-construction-codes / BUILDING CODE | Section BC 1802: Definitions | 2022-construction-codes/code-sections/building-code/chapters/18.html#rid-0-0-0-178846 |
| 2022-construction-codes / BUILDING CODE | Section BC 1902: Definitions | 2022-construction-codes/code-sections/building-code/chapters/19.html#rid-0-0-0-180131 |
| 2022-construction-codes / BUILDING CODE | 1913.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/19.html#rid-0-0-0-180693 |
| 2022-construction-codes / BUILDING CODE | Section BC 2102: Definitions and Notations | 2022-construction-codes/code-sections/building-code/chapters/21.html#rid-0-0-0-180735 |
| 2022-construction-codes / BUILDING CODE | Section BC 2202: Definitions | 2022-construction-codes/code-sections/building-code/chapters/22.html#rid-0-0-0-181312 |
| 2022-construction-codes / BUILDING CODE | 2202.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/22.html#rid-0-0-0-181313 |
| 2022-construction-codes / BUILDING CODE | Section BC 2302: Definitions | 2022-construction-codes/code-sections/building-code/chapters/23.html#rid-0-0-0-181517 |
| 2022-construction-codes / BUILDING CODE | 2302.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/23.html#rid-0-0-0-181518 |
| 2022-construction-codes / BUILDING CODE | Section BC 2402: Definitions | 2022-construction-codes/code-sections/building-code/chapters/24.html#rid-0-0-0-182587 |
| 2022-construction-codes / BUILDING CODE | 2402.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/24.html#rid-0-0-0-182588 |
| 2022-construction-codes / BUILDING CODE | Section BC 2502: Definitions | 2022-construction-codes/code-sections/building-code/chapters/25.html#rid-0-0-0-224455 |
| 2022-construction-codes / BUILDING CODE | 2502.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/25.html#rid-0-0-0-182886 |
| 2022-construction-codes / BUILDING CODE | Section BC 2602: Definitions | 2022-construction-codes/code-sections/building-code/chapters/26.html#rid-0-0-0-183102 |
| 2022-construction-codes / BUILDING CODE | 3002.1.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/30.html#rid-0-0-0-183664 |
| 2022-construction-codes / BUILDING CODE | 3102.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/31.html#rid-0-0-0-184015 |
| 2022-construction-codes / BUILDING CODE | 3105.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/31.html#rid-0-0-0-204408 |
| 2022-construction-codes / BUILDING CODE | 3109.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/31.html#rid-0-0-0-184203 |
| 2022-construction-codes / BUILDING CODE | 3114.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/31.html#rid-0-0-0-184373 |
| 2022-construction-codes / BUILDING CODE | 3115.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/31.html#rid-0-0-0-184404 |
| 2022-construction-codes / BUILDING CODE | 3201.8 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/32.html#rid-0-0-0-184460 |
| 2022-construction-codes / BUILDING CODE | 3301.13.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/33.html#rid-0-0-0-184820 |
| 2022-construction-codes / BUILDING CODE | Section BC 3302: Definitions | 2022-construction-codes/code-sections/building-code/chapters/33.html#rid-0-0-0-184931 |
| 2022-construction-codes / BUILDING CODE | 3302.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/33.html#rid-0-0-0-184932 |
| 2022-construction-codes / BUILDING CODE | Section BC E102: Definitions | 2022-construction-codes/code-sections/building-code/chapters/E.html#rid-0-0-0-188142 |
| 2022-construction-codes / BUILDING CODE | Section BC G201: Definitions | 2022-construction-codes/code-sections/building-code/chapters/G.html#rid-0-0-0-188555 |
| 2022-construction-codes / BUILDING CODE | G201.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/G.html#rid-0-0-0-188556 |
| 2022-construction-codes / BUILDING CODE | G201.1.2 Definitions specific to this appendix. | 2022-construction-codes/code-sections/building-code/chapters/G.html#rid-0-0-0-188589 |
| 2022-construction-codes / BUILDING CODE | Section BC H102: Definitions | 2022-construction-codes/code-sections/building-code/chapters/H.html#rid-0-0-0-189048 |
| 2022-construction-codes / BUILDING CODE | H102.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/H.html#rid-0-0-0-189049 |
| 2022-construction-codes / BUILDING CODE | Section BC M102: Definitions | 2022-construction-codes/code-sections/building-code/chapters/M.html#rid-0-0-0-191083 |
| 2022-construction-codes / BUILDING CODE | M102.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/M.html#rid-0-0-0-191084 |
| 2022-construction-codes / BUILDING CODE | Section BC U102: Definitions | 2022-construction-codes/code-sections/building-code/chapters/U.html#rid-0-0-0-230213 |
| 2022-construction-codes / BUILDING CODE | U102.1 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/U.html#rid-0-0-0-230172 |
| 2022-construction-codes / BUILDING CODE | U202.2 Definitions. | 2022-construction-codes/code-sections/building-code/chapters/U.html#rid-0-0-0-230102 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-101.4.5.2 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 1.html#rid-0-0-0-155470 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-101.5 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 1.html#rid-0-0-0-155475 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-103.33.1 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 1.html#rid-0-0-0-155870 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-104.9.1 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 1.html#rid-0-0-0-206245 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-104.11.1 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 1.html#rid-0-0-0-156183 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-105.4.2.1 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 1.html#rid-0-0-0-156315 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-106.4 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 1.html#rid-0-0-0-206116 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-107.2 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 1.html#rid-0-0-0-156492 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-202.3.1 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 2.html#rid-0-0-0-157316 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-308.1 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 3.html#rid-0-0-0-205669 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-309.2 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 3.html#rid-0-0-0-158423 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-309.12.1 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 3.html#rid-0-0-0-158502 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-310.2 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 3.html#rid-0-0-0-205651 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-311.2 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 3.html#rid-0-0-0-205645 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-317.2 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 3.html#rid-0-0-0-158771 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-320.1 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 3.html#rid-0-0-0-158879 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-321.1 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 3.html#rid-0-0-0-159109 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-323.2 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 3.html#rid-0-0-0-159177 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-401.3 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 4.html#rid-0-0-0-159327 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-419.2 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 4.html#rid-0-0-0-207506 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-502.1 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 5.html#rid-0-0-0-160424 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-503.10 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 5.html#rid-0-0-0-160501 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-505.2 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 5.html#rid-0-0-0-160587 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS | § 28-507.1 Definitions. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 5.html#rid-0-0-0-229859 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 24 | Subchapter 1: Short Title, Policy, and Definitions | 2026-enacted-administrative-code/chapters/30000001.html |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 24 | Subchapter 1: Short Title, Policy and Definitions | 2026-enacted-administrative-code/chapters/30000002.html |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 24 | 24-203 General definitions. | 2026-enacted-administrative-code/chapters/30000002.html#section-31000117 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 24 | 24-541 Definitions. | 2026-enacted-administrative-code/chapters/30000006.html#section-31000329 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 24 | Subchapter 1: Short Title, Policy and Definitions | 2026-enacted-administrative-code/chapters/30000007.html |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 24 | 24-603 Definitions. | 2026-enacted-administrative-code/chapters/30000007.html#section-31000360 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 24 | 24-607 Definitions. | 2026-enacted-administrative-code/chapters/30000007.html#section-31000364 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 24 | 24-702 Definitions. | 2026-enacted-administrative-code/chapters/30000008.html#section-31000371 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 24 | 24-802 Definitions. | 2026-enacted-administrative-code/chapters/30000009.html#section-31000389 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 24 | 24-902 Definitions. | 2026-enacted-administrative-code/chapters/30000010.html#section-31000397 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 24 | 24-1001 Definitions. | 2026-enacted-administrative-code/chapters/30000011.html#section-31000405 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 25 | 25-302 Definitions. | 2026-enacted-administrative-code/chapters/30000014.html#section-31000440 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 25 | 25-402 Definitions. | 2026-enacted-administrative-code/chapters/30000015.html#section-31000464 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 25 | 25-701 Definitions. | 2026-enacted-administrative-code/chapters/30000018.html#section-31000661 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 25 | 25-801 Definitions. | 2026-enacted-administrative-code/chapters/30000019.html#section-31000664 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-403 Definitions. | 2026-enacted-administrative-code/chapters/30000021.html#section-31000677 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-522 Definitions. | 2026-enacted-administrative-code/chapters/30000023.html#section-31000723 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-601 Definitions. | 2026-enacted-administrative-code/chapters/30000025.html#section-31000732 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-702 Definitions. | 2026-enacted-administrative-code/chapters/30000026.html#section-31000755 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-801 Definitions. | 2026-enacted-administrative-code/chapters/30000027.html#section-31000762 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-901 Definitions. | 2026-enacted-administrative-code/chapters/30000028.html#section-31000775 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-1101 Definitions. | 2026-enacted-administrative-code/chapters/30000029.html#section-31000781 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-1301 Definitions.* | 2026-enacted-administrative-code/chapters/30000032.html#section-31000788 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-1501 Definitions. | 2026-enacted-administrative-code/chapters/30000033.html#section-31000794 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-1601 Definitions. | 2026-enacted-administrative-code/chapters/30000034.html#section-31000797 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-1701 Definitions. | 2026-enacted-administrative-code/chapters/30000035.html#section-31000800 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-1801 Definitions. | 2026-enacted-administrative-code/chapters/30000036.html#section-31000803 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-2101 Definitions.* | 2026-enacted-administrative-code/chapters/30000039.html#section-31000808 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-2101 Definitions.* | 2026-enacted-administrative-code/chapters/30000040.html#section-31000811 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-2201 Definitions. | 2026-enacted-administrative-code/chapters/30000041.html#section-31000816 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-2402 Definitions. | 2026-enacted-administrative-code/chapters/30000042.html#section-31000822 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-2501 Definitions. | 2026-enacted-administrative-code/chapters/30000043.html#section-31000826 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-2601 Definitions. | 2026-enacted-administrative-code/chapters/30000044.html#section-31000829 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-2701 Definitions. | 2026-enacted-administrative-code/chapters/30000045.html#section-31000831 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-2801 Definitions. | 2026-enacted-administrative-code/chapters/30000046.html#section-31000833 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-2901 Definitions. | 2026-enacted-administrative-code/chapters/30000047.html#section-31000836 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-3001 Definitions.* | 2026-enacted-administrative-code/chapters/30000048.html#section-31000838 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-3101 Definitions. | 2026-enacted-administrative-code/chapters/30000049.html#section-31000845 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-3201 Definitions. | 2026-enacted-administrative-code/chapters/30000050.html#section-31000850 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-3001 Definitions.* | 2026-enacted-administrative-code/chapters/30000051.html#section-31000853 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-3401 Definitions. | 2026-enacted-administrative-code/chapters/30000052.html#section-31000873 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-3501 Definitions. | 2026-enacted-administrative-code/chapters/30000053.html#section-31000875 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-3701 Definitions.* | 2026-enacted-administrative-code/chapters/30000055.html#section-31000881 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-3701 Definitions.* | 2026-enacted-administrative-code/chapters/30000056.html#section-31000883 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 26 | 26-3801 Definitions. | 2026-enacted-administrative-code/chapters/30000057.html#section-31000889 |
| 2026-enacted-administrative-code / HOUSING MAINTENANCE CODE | 27-2017 Definitions. | 2026-enacted-administrative-code/chapters/30000078.html#section-31001865 |
| 2026-enacted-administrative-code / HOUSING MAINTENANCE CODE | 27-2020 Definitions. | 2026-enacted-administrative-code/chapters/30000078.html#section-31001882 |
| 2026-enacted-administrative-code / HOUSING MAINTENANCE CODE | 27-2052 Definitions. | 2026-enacted-administrative-code/chapters/30000078.html#section-31001924 |
| 2026-enacted-administrative-code / HOUSING MAINTENANCE CODE | 27-2056.2 Definitions. | 2026-enacted-administrative-code/chapters/30000078.html#section-31001930 |
| 2026-enacted-administrative-code / HOUSING MAINTENANCE CODE | 27-2056.21 Definitions. | 2026-enacted-administrative-code/chapters/30000078.html#section-31001948 |
| 2026-enacted-administrative-code / HOUSING MAINTENANCE CODE | 27-2109.51 Definitions. | 2026-enacted-administrative-code/chapters/30000080.html#section-31002010 |
| 2026-enacted-administrative-code / HOUSING MAINTENANCE CODE | 27-2150 Definitions. | 2026-enacted-administrative-code/chapters/30000081.html#section-31002052 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-104.11.1 Definitions. | 2026-enacted-administrative-code/chapters/30000082.html#section-31002209 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-106.4 Definitions. | 2026-enacted-administrative-code/chapters/30000082.html#section-31002274 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-202.3.1 Definitions. | 2026-enacted-administrative-code/chapters/30000083.html#section-31002483 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-308.1 Definitions. | 2026-enacted-administrative-code/chapters/30000084.html#section-31002761 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-309.2 Definitions. | 2026-enacted-administrative-code/chapters/30000084.html#section-31002777 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-309.12.1 Definitions. | 2026-enacted-administrative-code/chapters/30000084.html#section-31002793 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-310.2 Definitions. | 2026-enacted-administrative-code/chapters/30000084.html#section-31002800 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-311.2 Definitions. | 2026-enacted-administrative-code/chapters/30000084.html#section-31002803 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-317.2 Definitions. | 2026-enacted-administrative-code/chapters/30000084.html#section-31002856 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-320.1 Definitions. | 2026-enacted-administrative-code/chapters/30000084.html#section-31002877 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-321.1 Definitions. | 2026-enacted-administrative-code/chapters/30000084.html#section-31002918 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-323.2 Definitions. | 2026-enacted-administrative-code/chapters/30000084.html#section-31002930 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-401.3 Definitions. | 2026-enacted-administrative-code/chapters/30000085.html#section-31002965 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-419.2 Definitions. | 2026-enacted-administrative-code/chapters/30000085.html#section-31003136 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-502.1 Definitions. | 2026-enacted-administrative-code/chapters/30000086.html#section-31003233 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-503.10 Definitions. | 2026-enacted-administrative-code/chapters/30000086.html#section-31003265 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-505.2 Definitions. | 2026-enacted-administrative-code/chapters/30000086.html#section-31003286 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-507.1 Definitions. | 2026-enacted-administrative-code/chapters/30000086.html#section-31003294 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Chapter 2: Definitions | 2026-enacted-administrative-code/chapters/30000087.html |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section PC 202: General Definitions | 2026-enacted-administrative-code/chapters/30000087.html#section-31003340 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Chapter 2: Definitions | 2026-enacted-administrative-code/chapters/30000088.html |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 202: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003502 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 502: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003544 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 702: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003557 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 802: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003579 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 902: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003587 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 1002: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003605 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 1102: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003636 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 1202: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003647 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 1402: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003661 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 1502: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003671 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 1602: Definitions and Notations | 2026-enacted-administrative-code/chapters/30000088.html#section-31003683 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 1615: Structural Integrity Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003696 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 1702: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003702 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 1802: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003713 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 1902: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003731 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 2102: Definitions and Notations | 2026-enacted-administrative-code/chapters/30000088.html#section-31003747 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 2202: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003761 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 2302: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003774 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 2402: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003783 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 2502: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003793 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 2602: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003807 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC 3302: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003856 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC E102: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003885 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC G201: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003904 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC H102: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003927 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC M102: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003947 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section BC U102: Definitions | 2026-enacted-administrative-code/chapters/30000088.html#section-31003966 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Chapter 2: Definitions | 2026-enacted-administrative-code/chapters/30000089.html |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section MC 202: General Definitions | 2026-enacted-administrative-code/chapters/30000089.html#section-31003985 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Chapter 2: Definitions | 2026-enacted-administrative-code/chapters/30000090.html |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section FGC 202: General Definitions | 2026-enacted-administrative-code/chapters/30000090.html#section-31004139 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | 28-1001.1.1 Definitions. | 2026-enacted-administrative-code/chapters/30000091.html#section-31004256 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Chapter 2: Definitions | 2026-enacted-administrative-code/chapters/30000093.html |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Section EBC 202: Definitions | 2026-enacted-administrative-code/chapters/30000093.html#section-31004512 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 | Chapter D2: Definitions | 2026-enacted-administrative-code/chapters/30000093.html |
| 2026-zoning-resolution / ZONING RESOLUTION | Article I, Chapter 2 — Construction of Language and Definitions | 2026-zoning-resolution/chapters/I-2.html |
| 2026-zoning-resolution / ZONING RESOLUTION | 12-10 DEFINITIONS | 2026-zoning-resolution/chapters/I-2.html#zr-18523 |
| 2026-zoning-resolution / ZONING RESOLUTION | 13-02 Definitions | 2026-zoning-resolution/chapters/I-3.html#zr-18469 |
| 2026-zoning-resolution / ZONING RESOLUTION | 16-02 Definitions | 2026-zoning-resolution/chapters/I-6.html#zr-18329 |
| 2026-zoning-resolution / ZONING RESOLUTION | 22-21 Definitions | 2026-zoning-resolution/chapters/II-2.html#zr-18157 |
| 2026-zoning-resolution / ZONING RESOLUTION | 24-00 APPLICABILITY, GENERAL PURPOSES AND DEFINITIONS | 2026-zoning-resolution/chapters/II-4.html#zr-17621 |
| 2026-zoning-resolution / ZONING RESOLUTION | 25-00 GENERAL PURPOSES AND DEFINITIONS | 2026-zoning-resolution/chapters/II-5.html#zr-17514 |
| 2026-zoning-resolution / ZONING RESOLUTION | 26-13 Definitions | 2026-zoning-resolution/chapters/II-6.html#zr-17787 |
| 2026-zoning-resolution / ZONING RESOLUTION | 27-00 APPLICABILITY, GENERAL PURPOSES AND DEFINITIONS | 2026-zoning-resolution/chapters/II-7.html#zr-22695 |
| 2026-zoning-resolution / ZONING RESOLUTION | 27-11 Definitions | 2026-zoning-resolution/chapters/II-7.html#zr-22698 |
| 2026-zoning-resolution / ZONING RESOLUTION | 27-111 General definitions | 2026-zoning-resolution/chapters/II-7.html#zr-22699 |
| 2026-zoning-resolution / ZONING RESOLUTION | 27-112 Definitions applying to rental affordable housing | 2026-zoning-resolution/chapters/II-7.html#zr-22700 |
| 2026-zoning-resolution / ZONING RESOLUTION | 27-113 Definitions applying to homeownership affordable housing | 2026-zoning-resolution/chapters/II-7.html#zr-22701 |
| 2026-zoning-resolution / ZONING RESOLUTION | 32-61 Definitions | 2026-zoning-resolution/chapters/III-2.html#zr-17862 |
| 2026-zoning-resolution / ZONING RESOLUTION | 32-301 Definitions | 2026-zoning-resolution/chapters/III-2.html#zr-22523 |
| 2026-zoning-resolution / ZONING RESOLUTION | 33-00 APPLICABILITY, DEFINITIONS AND GENERAL PROVISIONS | 2026-zoning-resolution/chapters/III-3.html#zr-17712 |
| 2026-zoning-resolution / ZONING RESOLUTION | 33-11 Definitions | 2026-zoning-resolution/chapters/III-3.html#zr-17720 |
| 2026-zoning-resolution / ZONING RESOLUTION | 33-21 Definitions | 2026-zoning-resolution/chapters/III-3.html#zr-17733 |
| 2026-zoning-resolution / ZONING RESOLUTION | 33-41 Definitions | 2026-zoning-resolution/chapters/III-3.html#zr-17756 |
| 2026-zoning-resolution / ZONING RESOLUTION | 34-00 APPLICABILITY AND DEFINITIONS | 2026-zoning-resolution/chapters/III-4.html#zr-18305 |
| 2026-zoning-resolution / ZONING RESOLUTION | 36-00 GENERAL PURPOSES AND DEFINITIONS | 2026-zoning-resolution/chapters/III-6.html#zr-17886 |
| 2026-zoning-resolution / ZONING RESOLUTION | 36-03 Definitions | 2026-zoning-resolution/chapters/III-6.html#zr-17896 |
| 2026-zoning-resolution / ZONING RESOLUTION | 37-311 Definitions | 2026-zoning-resolution/chapters/III-7.html#zr-18181 |
| 2026-zoning-resolution / ZONING RESOLUTION | 37-711 Definitions | 2026-zoning-resolution/chapters/III-7.html#zr-18206 |
| 2026-zoning-resolution / ZONING RESOLUTION | 42-61 Definitions | 2026-zoning-resolution/chapters/IV-2.html#zr-17353 |
| 2026-zoning-resolution / ZONING RESOLUTION | 42-411 Definitions | 2026-zoning-resolution/chapters/IV-2.html#zr-17332 |
| 2026-zoning-resolution / ZONING RESOLUTION | 42-421 Definitions | 2026-zoning-resolution/chapters/IV-2.html#zr-17294 |
| 2026-zoning-resolution / ZONING RESOLUTION | 42-431 Definitions | 2026-zoning-resolution/chapters/IV-2.html#zr-17300 |
| 2026-zoning-resolution / ZONING RESOLUTION | 42-451 Definitions | 2026-zoning-resolution/chapters/IV-2.html#zr-17308 |
| 2026-zoning-resolution / ZONING RESOLUTION | 42-461 Definitions | 2026-zoning-resolution/chapters/IV-2.html#zr-17311 |
| 2026-zoning-resolution / ZONING RESOLUTION | 42-471 Definitions | 2026-zoning-resolution/chapters/IV-2.html#zr-17316 |
| 2026-zoning-resolution / ZONING RESOLUTION | 43-11 Definitions | 2026-zoning-resolution/chapters/IV-3.html#zr-17374 |
| 2026-zoning-resolution / ZONING RESOLUTION | 43-21 Definitions | 2026-zoning-resolution/chapters/IV-3.html#zr-17386 |
| 2026-zoning-resolution / ZONING RESOLUTION | 43-41 Definitions | 2026-zoning-resolution/chapters/IV-3.html#zr-17408 |
| 2026-zoning-resolution / ZONING RESOLUTION | 43-131 Definitions | 2026-zoning-resolution/chapters/IV-3.html#zr-22579 |
| 2026-zoning-resolution / ZONING RESOLUTION | 44-00 GENERAL PURPOSES AND DEFINITIONS | 2026-zoning-resolution/chapters/IV-4.html#zr-17434 |
| 2026-zoning-resolution / ZONING RESOLUTION | 44-03 Definitions | 2026-zoning-resolution/chapters/IV-4.html#zr-17442 |
| 2026-zoning-resolution / ZONING RESOLUTION | 52-00 DEFINITIONS AND GENERAL PROVISIONS | 2026-zoning-resolution/chapters/V-2.html#zr-18622 |
| 2026-zoning-resolution / ZONING RESOLUTION | 52-01 Definitions | 2026-zoning-resolution/chapters/V-2.html#zr-18623 |
| 2026-zoning-resolution / ZONING RESOLUTION | 54-01 Definitions | 2026-zoning-resolution/chapters/V-4.html#zr-18606 |
| 2026-zoning-resolution / ZONING RESOLUTION | 61-30 DEFINITIONS | 2026-zoning-resolution/chapters/VI-1.html#zr-19223 |
| 2026-zoning-resolution / ZONING RESOLUTION | 62-11 Definitions | 2026-zoning-resolution/chapters/VI-2.html#zr-18918 |
| 2026-zoning-resolution / ZONING RESOLUTION | 63-01 Definitions | 2026-zoning-resolution/chapters/VI-3.html#zr-19057 |
| 2026-zoning-resolution / ZONING RESOLUTION | 64-11 Definitions | 2026-zoning-resolution/chapters/VI-4.html#zr-18721 |
| 2026-zoning-resolution / ZONING RESOLUTION | 66-11 Definitions | 2026-zoning-resolution/chapters/VI-6.html#zr-21928 |
| 2026-zoning-resolution / ZONING RESOLUTION | 74-941 Definitions | 2026-zoning-resolution/chapters/VII-4.html#zr-19210 |
| 2026-zoning-resolution / ZONING RESOLUTION | 75-421 Definitions | 2026-zoning-resolution/chapters/VII-5.html#zr-22846 |
| 2026-zoning-resolution / ZONING RESOLUTION | 78-00 GENERAL PURPOSES, DEFINITIONS AND GENERAL PROVISIONS | 2026-zoning-resolution/chapters/VII-8.html#zr-19229 |
| 2026-zoning-resolution / ZONING RESOLUTION | 78-02 Definitions | 2026-zoning-resolution/chapters/VII-8.html#zr-19231 |
| 2026-zoning-resolution / ZONING RESOLUTION | 79-00 DEFINITIONS | 2026-zoning-resolution/chapters/VII-9.html#zr-19276 |
| 2026-zoning-resolution / ZONING RESOLUTION | 81-01 Definitions | 2026-zoning-resolution/chapters/VIII-1.html#zr-19850 |
| 2026-zoning-resolution / ZONING RESOLUTION | 81-261 Definitions | 2026-zoning-resolution/chapters/VIII-1.html#zr-19892 |
| 2026-zoning-resolution / ZONING RESOLUTION | 81-271 Definitions | 2026-zoning-resolution/chapters/VIII-1.html#zr-19899 |
| 2026-zoning-resolution / ZONING RESOLUTION | 81-613 Definitions | 2026-zoning-resolution/chapters/VIII-1.html#zr-19938 |
| 2026-zoning-resolution / ZONING RESOLUTION | 82-01 Definitions | 2026-zoning-resolution/chapters/VIII-2.html#zr-19759 |
| 2026-zoning-resolution / ZONING RESOLUTION | 83-01 Definitions | 2026-zoning-resolution/chapters/VIII-3.html#zr-19654 |
| 2026-zoning-resolution / ZONING RESOLUTION | 84-01 Definitions | 2026-zoning-resolution/chapters/VIII-4.html#zr-19382 |
| 2026-zoning-resolution / ZONING RESOLUTION | 85-01 Definitions | 2026-zoning-resolution/chapters/VIII-5.html#zr-19293 |
| 2026-zoning-resolution / ZONING RESOLUTION | 86-01 Definitions | 2026-zoning-resolution/chapters/VIII-6.html#zr-19435 |
| 2026-zoning-resolution / ZONING RESOLUTION | 87-01 Definitions | 2026-zoning-resolution/chapters/VIII-7.html#zr-19593 |
| 2026-zoning-resolution / ZONING RESOLUTION | 88-01 Definitions | 2026-zoning-resolution/chapters/VIII-8.html#zr-18687 |
| 2026-zoning-resolution / ZONING RESOLUTION | 89-02 Definitions | 2026-zoning-resolution/chapters/VIII-9.html#zr-18678 |
| 2026-zoning-resolution / ZONING RESOLUTION | 91-02 Definitions | 2026-zoning-resolution/chapters/IX-1.html#zr-19300 |
| 2026-zoning-resolution / ZONING RESOLUTION | 91-62 Definitions | 2026-zoning-resolution/chapters/IX-1.html#zr-19346 |
| 2026-zoning-resolution / ZONING RESOLUTION | 92-01 Definitions | 2026-zoning-resolution/chapters/IX-2.html#zr-19584 |
| 2026-zoning-resolution / ZONING RESOLUTION | 93-01 Definitions | 2026-zoning-resolution/chapters/IX-3.html#zr-19455 |
| 2026-zoning-resolution / ZONING RESOLUTION | 93-81 Definitions | 2026-zoning-resolution/chapters/IX-3.html#zr-19567 |
| 2026-zoning-resolution / ZONING RESOLUTION | 94-01 Definitions | 2026-zoning-resolution/chapters/IX-4.html#zr-19813 |
| 2026-zoning-resolution / ZONING RESOLUTION | 95-01 Definitions | 2026-zoning-resolution/chapters/IX-5.html#zr-19788 |
| 2026-zoning-resolution / ZONING RESOLUTION | 96-01 Definitions | 2026-zoning-resolution/chapters/IX-6.html#zr-19662 |
| 2026-zoning-resolution / ZONING RESOLUTION | 97-01 Definitions | 2026-zoning-resolution/chapters/IX-7.html#zr-19703 |
| 2026-zoning-resolution / ZONING RESOLUTION | 97-31 Definitions | 2026-zoning-resolution/chapters/IX-7.html#zr-19727 |
| 2026-zoning-resolution / ZONING RESOLUTION | 98-01 Definitions | 2026-zoning-resolution/chapters/IX-8.html#zr-18539 |
| 2026-zoning-resolution / ZONING RESOLUTION | 99-01 Definitions | 2026-zoning-resolution/chapters/IX-9.html#zr-18525 |
| 2026-zoning-resolution / ZONING RESOLUTION | 101-01 Definitions | 2026-zoning-resolution/chapters/X-1.html#zr-20814 |
| 2026-zoning-resolution / ZONING RESOLUTION | 101-702 Definitions specific to the Atlantic Avenue Subdistrict | 2026-zoning-resolution/chapters/X-1.html#zr-20869 |
| 2026-zoning-resolution / ZONING RESOLUTION | 102-01 Definitions | 2026-zoning-resolution/chapters/X-2.html#zr-20703 |
| 2026-zoning-resolution / ZONING RESOLUTION | 104-01 Definitions | 2026-zoning-resolution/chapters/X-4.html#zr-20963 |
| 2026-zoning-resolution / ZONING RESOLUTION | 105-01 Definitions | 2026-zoning-resolution/chapters/X-5.html#zr-20906 |
| 2026-zoning-resolution / ZONING RESOLUTION | 107-01 Definitions | 2026-zoning-resolution/chapters/X-7.html#zr-21090 |
| 2026-zoning-resolution / ZONING RESOLUTION | 111-01 Definitions | 2026-zoning-resolution/chapters/XI-1.html#zr-21024 |
| 2026-zoning-resolution / ZONING RESOLUTION | 112-01 Definitions | 2026-zoning-resolution/chapters/XI-2.html#zr-21191 |
| 2026-zoning-resolution / ZONING RESOLUTION | 115-02 Definitions | 2026-zoning-resolution/chapters/XI-5.html#zr-23045 |
| 2026-zoning-resolution / ZONING RESOLUTION | 116-01 Definitions | 2026-zoning-resolution/chapters/XI-6.html#zr-20641 |
| 2026-zoning-resolution / ZONING RESOLUTION | 117-01 Definitions | 2026-zoning-resolution/chapters/XI-7.html#zr-20721 |
| 2026-zoning-resolution / ZONING RESOLUTION | 117-361 Definitions | 2026-zoning-resolution/chapters/XI-7.html#zr-23089 |
| 2026-zoning-resolution / ZONING RESOLUTION | 117-503 Definitions | 2026-zoning-resolution/chapters/XI-7.html#zr-20748 |
| 2026-zoning-resolution / ZONING RESOLUTION | 119-01 Definitions | 2026-zoning-resolution/chapters/XI-9.html#zr-20156 |
| 2026-zoning-resolution / ZONING RESOLUTION | 121-02 Definitions | 2026-zoning-resolution/chapters/XII-1.html#zr-23004 |
| 2026-zoning-resolution / ZONING RESOLUTION | 122-01 Definitions | 2026-zoning-resolution/chapters/XII-2.html#zr-20583 |
| 2026-zoning-resolution / ZONING RESOLUTION | 123-11 Definitions | 2026-zoning-resolution/chapters/XII-3.html#zr-20546 |
| 2026-zoning-resolution / ZONING RESOLUTION | 124-02 Definitions | 2026-zoning-resolution/chapters/XII-4.html#zr-20321 |
| 2026-zoning-resolution / ZONING RESOLUTION | 127-04 Definitions | 2026-zoning-resolution/chapters/XII-7.html#zr-21370 |
| 2026-zoning-resolution / ZONING RESOLUTION | 128-01 Definitions | 2026-zoning-resolution/chapters/XII-8.html#zr-20245 |
| 2026-zoning-resolution / ZONING RESOLUTION | 131-05 Definitions | 2026-zoning-resolution/chapters/XIII-1.html#zr-22429 |
| 2026-zoning-resolution / ZONING RESOLUTION | 132-12 Definitions | 2026-zoning-resolution/chapters/XIII-2.html#zr-20483 |
| 2026-zoning-resolution / ZONING RESOLUTION | 133-01 Definitions | 2026-zoning-resolution/chapters/XIII-3.html#zr-20420 |
| 2026-zoning-resolution / ZONING RESOLUTION | 134-04 Definitions | 2026-zoning-resolution/chapters/XIII-4.html#zr-21796 |
| 2026-zoning-resolution / ZONING RESOLUTION | 136-02 Definitions | 2026-zoning-resolution/chapters/XIII-6.html#zr-20504 |
| 2026-zoning-resolution / ZONING RESOLUTION | 139-01 Definitions | 2026-zoning-resolution/chapters/XIII-9.html#zr-22006 |
| 2026-zoning-resolution / ZONING RESOLUTION | 142-04 Definitions | 2026-zoning-resolution/chapters/XIV-2.html#zr-20012 |
| 2026-zoning-resolution / ZONING RESOLUTION | 143-02 Definitions | 2026-zoning-resolution/chapters/XIV-3.html#zr-22118 |
| 2026-zoning-resolution / ZONING RESOLUTION | 144-01 Definitions | 2026-zoning-resolution/chapters/XIV-4.html#zr-22139 |
| 2026-zoning-resolution / ZONING RESOLUTION | 145-04 Definitions | 2026-zoning-resolution/chapters/XIV-5.html#zr-22636 |
| 2026-zoning-resolution / ZONING RESOLUTION | 146-03 Definitions | 2026-zoning-resolution/chapters/XIV-6.html#zr-22917 |

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
| 2014-construction-codes / BUILDING CODE / general | STRIPPING OPERATIONS | 3 | See Section 3303.2. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | FLOOD HAZARD AREA | 3 | See Chapter 2 of the New York City Building Code. | 2026-existing-building-code/chapters/2.html § 202 |
| 2022-construction-codes / BUILDING CODE / general | CHILD CARE FACILITIES | 3 | See Section 308.2.1. | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2022-construction-codes / BUILDING CODE / general | SUPERINTENDENT OF CONSTRUCTION | 3 | See Chapter 1 of Title 28 of the Administrative Code . | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | HERETOFORE | 3 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
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
| 2014-construction-codes / BUILDING CODE / general | SPECIFIED COMPRESSIVE STRENGTH OF MASONRY (f’m) | 0 | See Section 2102.1. | 2014-construction-codes/chapters/bc-2.html §  |
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
| 2026-existing-building-code / EXISTING BUILDING CODE / general | LAND SURVEYOR | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | MANUFACTURER’S DESIGNATION | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | APPROVED FABRICATOR | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2022-construction-codes / GENERAL ADMINISTRATIVE PROVISIONS / general | GREEN ROOF SYSTEM | 0 | See chapter 2 of the New York city building code. (L.L. 2017/233, 12/1/2017, eff. 12/1/2018; Am. L.L. 2019/093, 5/19/2019, eff. 9/16/2019; Am. L.L. 2021/126, 11/7/2021, eff. 11/7/2022) Editor's note: For related unconsolidated provisions, see Appendix A at L.L. 2021/126. | 2022-construction-codes/code-sections/general-administrative-provisions/chapters/Chapter 1.html § 28-103.33.1 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | SUBSTANTIAL IMPROVEMENT | 0 | See Chapter 2 of the New York City Building Code. | 2026-existing-building-code/chapters/2.html § 202 |
| 2022-construction-codes / BUILDING CODE / general | HIGH-PRESSURE BOILER | 0 | See Section 28-401.3 of the Administrative Code . | 2022-construction-codes/code-sections/building-code/chapters/2.html § 202 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | FABRICATED ITEM | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | WRITTEN NOTICE | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-enacted-administrative-code / ADMINISTRATIVE CODE TITLE 28 / general | GREEN ROOF SYSTEM | 0 | See chapter 2 of the New York city building code. (L.L. 2017/233, 12/1/2017, eff. 12/1/2018; Am. L.L. 2019/093, 5/19/2019, eff. 9/16/2019; Am. L.L. 2021/126, 11/7/2021, eff. 11/7/2022) | 2026-enacted-administrative-code/chapters/30000082.html § 28-103.33.1 |
| 2014-construction-codes / BUILDING CODE / general | MAXIMUM CONSIDERED EARTHQUAKE (MEC) GROUND MOTION | 0 | See Section 1613.2. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | WRITING (WRITTEN) | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | SUBSTANTIAL DAMAGE | 0 | See Chapter 2 of the New York City Building Code. | 2026-existing-building-code/chapters/2.html § 202 |
| 2022-construction-codes / PLUMBING CODE / general | STORMWATER POLLUTION PREVENTION PLAN OR SWPPP | 0 | See Section 28-104.11.1 of the Administrative Code. | 2022-construction-codes/code-sections/plumbing-code/chapters/Chapter 2.html § 202 |
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
| 2022-construction-codes / FUEL GAS CODE / general | PRIOR CODE BUILDING | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code : | 2022-construction-codes/code-sections/fuel-gas-code/chapters/Chapter 2.html § 201.3.1 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | RETAINING WALL | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | UTILITY CORPORATION OR PUBLIC UTILITY CORPORATION | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | INSPECTION CERTIFICATE | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2022-construction-codes / PLUMBING CODE / general | PRIOR CODE BUILDING | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code : | 2022-construction-codes/code-sections/plumbing-code/chapters/Chapter 2.html § 201.3.1 |
| 2014-construction-codes / BUILDING CODE / general | BALCONY, EXTERIOR | 0 | See Section 1602.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2014-construction-codes / ADMINISTRATIVE PROVISIONS / general | GREEN ROOF SYSTEM | 0 | See section 1502.1 of the New York city building code. **Section 28-103.33.1 was added by Local Law 233 of 2017. This law has an effective date of December 1, 2018 and was renumbered and further amended by Local Law 93 of 2019. This law has an effective date of September 16, 2019. | 2014-construction-codes/chapters/ac-1.html § 28-103.33.1 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | CERTIFICATE OF COMPLIANCE | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | UTILITY COMPANY OR PUBLIC UTILITY COMPANY | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | ARCHITECT | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2014-construction-codes / BUILDING CODE / general | THERMALLY ISOLATED SUNROOM ADDITION | 0 | See Section 1202.1. | 2014-construction-codes/chapters/bc-2.html §  |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | PRIOR CODE BUILDING OR STRUCTURE | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |
| 2026-existing-building-code / EXISTING BUILDING CODE / general | LANDSCAPE ARCHITECT | 0 | The following terms are defined in Section 28-101.5 of the Administrative Code: | 2026-existing-building-code/chapters/2.html § 201 |

## Acceptance still required

- Review unmatched terms and scope restrictions against each definition chapter; extend matching only where source wording supports it.
- Resolve available exact references; separately list unavailable external or mismatched-edition sources.
- Verify pop-ups, source labels, dismissal and reading-position retention across web and native renderers, including tables and long definitions.
- Verify first-load performance and physical-device touch behavior before declaring complete.

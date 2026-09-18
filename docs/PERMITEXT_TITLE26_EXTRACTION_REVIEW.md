# Title 26 definition extraction review

2026-09-17. Audit only; no registry changes, active links, or legal applicability acceptance.

Current reconciliation after chapters 24–27: four of these 41 discovered declaration sections now have reviewed extraction adapters, covering fifteen entries. Fourteen have reviewed application scopes (three Buyout and eleven housing-reporting); Area median income in chapter 26 remains withheld. Housing-reporting physical acceptance is tracked separately in the continuation record. The other **37 declaration sections contain 277 lexical candidates**, not 277 approved definitions or a measured implementation estimate. Chapter 22's Affordable housing unit is imported as one exact referral target; that does not complete extraction of chapter 22. Earlier inventory/parser counts below remain a discovery baseline, not current activation status.


Run from repository root:

`node permitext-sync-server/scripts/audit-title26-definition-extraction.mjs /tmp/permitext-title26-extraction.json`

`node --test permitext-sync-server/tests/title26-definition-extraction.mjs`

The inventory reads all **38 physical Title 26 chapter files**, preserving chapter ID, printed number, file, section anchor, file SHA-256, serialized section SHA-256, and normalized candidate-source SHA-256. It audits the **41 previously discovered declaration sections** and identifies **292 lexical candidates**. The existing quoted-definition parser matches only **45 candidate labels**; a label match is not body acceptance. All candidates remain inactive. This is not an exhaustive search for every definition embedded anywhere in Title 26.

Candidate groups preserve complete source paragraphs and following continuations. Full section paragraphs and untrimmed candidate groups remain in JSON, including paragraphs excluded at a proposed operative-subdivision/history boundary. Such boundaries are audit hypotheses requiring review, not approved production extraction. Every source includes unclassified paragraphs so misses cannot silently disappear.

## Outstanding source work

- Two discovered sections produce no lexical candidates: §26-505 and chapter 33 §26-3013. Their full paragraphs remain recorded. Inspect prose and legal effect before implementing adapters.
- §26-1701(a) imports a semicolon-delimited Zoning Resolution list; it is retained as unclassified text and is not converted to supplied meanings.
- Numbered quoted referrals in §26-522 and “shall have” referrals are now included in this audit. The existing production parser still needs reviewed adapters for these formats. The §26-522(b) Person exclusion remains full source context, not an invented standalone meaning.
- Sentence-case labels, inline scope declarations, labels without a means verb, and multiline continuation groups need reviewed adapters or parser changes.
- Cross-references, modifications, chapter-versus-section scope, and effective dates require separate acceptance. In particular, §26-3602 carries a January 1, 2028 effective-date note; inventory does not authorize current activation.
- Duplicate printed chapters 21 and 37, and §26-3001 in chapters 30 and 33, are independent sources. Exact physical source identity must remain part of selection.
- The §26-2101 Booking service candidate retains its opening, both numbered clauses, and final exclusion. Chapter 36's inline department definition retains the DOB meaning and section-only introduction; subsequent operative subdivisions remain outside the proposed definition body but inside audit evidence.

## Actual candidate labels

The table is an extraction inventory, not a legal coverage checklist. Empty rows are explicit misses; chapters with no discovered declaration are also shown.

| Chapter ID / printed number | Source section | Candidate labels |
| --- | --- | --- |
| 30000020 / 2 | No discovered declaration | — |
| 30000021 / 3 | 26-403 (section-31000677) | Documents; Federal act; Housing accommodation; Landlord; Maximum rent; Person; Rent; State Enabling Act; State Rent Act; State rent commission; Tenant |
| 30000021 / 3 | 26-406.1 (section-31000684) | Available data; Identified head of household; Identified landlord; Program rent benefits; Program tax benefits; Responsible agency |
| 30000022 / 4 | 26-505 (section-31000704) | No labels extracted — review required |
| 30000022 / 4 | 26-509.1 (section-31000708) | Available data; Identified head of household; Identified landlord; Program rent benefits; Program tax benefits; Responsible agency |
| 30000023 / 5 | 26-522 (section-31000723) | Dwelling unit; Owner |
| 30000024 / 6 | No discovered declaration | — |
| 30000025 / 7 | 26-601 (section-31000732) | Commissioner; Dwelling unit; Eligibility date; Eligible head of the household; Housing company; Income; Income tax year; Increase in maximum rent; Maximum rent; Members of the household; Supervising agency; Taxable period; PILOT; Applicable battery park city property |
| 30000025 / 7 | 26-606.1 (section-31000741) | resident |
| 30000025 / 7 | 26-618 (section-31000753) | Available data; Identified head of household; Identified landlord; Program rent benefits; Program tax benefits; Responsible agency |
| 30000026 / 8 | 26-702 (section-31000755) | Building; Total price; Capital replacement; Offeror |
| 30000027 / 9 | 26-801 (section-31000762) | Affordable; Appraised value; Assisted rental housing; Bona fide purchaser; Bona fide offer to purchase; Conversion; Household; Household income; Department; Financial assistance; First opportunity to purchase; Notice; Owner; Qualified entity; Right of first refusal; Tenant; Tenant association |
| 30000028 / 10 | 26-901 (section-31000775) | City financial assistance; Construction condition; Contractor; Covered contractor; Department; Developer; Disposition project; Disqualified list; Housing development project; List identifier; Prequalified list; Principal officer; Principal owner; Project identifier; Project work; Sponsor; Subcontractor |
| 30000029 / 11 | 26-1101 (section-31000781) | Department; Dwelling unit; Multiple dwelling; Owner; Tenant |
| 30000030 / 12 | 26-1201 (section-31000785) | Dwelling unit; Medical treatment; Relative |
| 30000031 / 13 | No discovered declaration | — |
| 30000032 / 13 | 26-1301 (section-31000788) | Brief legal assistance; Coordinator; Covered individual; Covered proceeding; Designated citywide languages; Designated organization; Full legal representation; Housing court; Income-eligible individual; Legal services |
| 30000032 / 13 | 26-1306 (section-31000793) | designated community group |
| 30000033 / 15 | 26-1501 (section-31000794) | Affordability requirement; Department |
| 30000034 / 16 | 26-1601 (section-31000797) | Department; Rent registration requirement; Rent Stabilization |
| 30000035 / 17 | 26-1701 (section-31000800) | department |
| 30000036 / 18 | 26-1801 (section-31000803) | Affordable unit; Department; Dwelling unit; Housing portal; Information, full unit; Information, limited unit; Information, offered unit; Listed unit |
| 30000037 / 19 | No discovered declaration | — |
| 30000038 / 20 | 26-2001 (section-31000807) | Eligible community land trust; Persons of low income; Supervising agency |
| 30000039 / 21 | 26-2101 (section-31000808) | Affordable housing; Area median income; Created; Department; Dwelling unit; Extremely low income household; Extremely low income affordable housing (ELI-AH) unit; Low income household; Low income affordable housing (LI-AH) unit; Middle income household; Middle income affordable housing (MIDI-AH) unit; Moderate income household; Moderate income affordable housing (MI-AH) unit; Preserved; Very low income household; Very low income affordable housing (VLI-AH) unit |
| 30000040 / 21 | 26-2101 (section-31000811) | Administering agency; Booking service; Building; Class B multiple dwelling; Directly or indirectly; Dwelling unit; Host; Qualifying Listing; Short-term rental |
| 30000041 / 22 | 26-2201 (section-31000816) | Affordable housing unit; Area median income; Department; Dwelling unit; Expiring affordable housing unit; Extremely low income household; Extremely low income affordable housing (ELI-AH) unit; Low income household; Low income affordable housing (LI-AH) unit; Moderate income household; Moderate income affordable housing (MI-AH) unit; Middle income household; Middle income affordable housing (MIDI-AH) unit; Very low income household; Very low income affordable housing (VLI-AH) unit |
| 30000042 / 24 | 26-2402 (section-31000822) | Buyout agreement; Commissioner; Department |
| 30000043 / 25 | 26-2501 (section-31000826) | certification of correction |
| 30000044 / 26 | 26-2601 (section-31000829) | Affordable housing unit; Area median income; Department; Extremely low income household; Low income household; Middle income household; Moderate income household; Very low income household |
| 30000045 / 27 | 26-2701 (section-31000831) | Department; Mitchell-Lama development; Waiting list |
| 30000046 / 28 | 26-2801 (section-31000833) | City financial assistance; Class A dwelling unit; Department; Developer; Dwelling unit offered for rent; Housing development project; Housing preservation project; HUD restricted land; On-site supportive services; Receives; Rehabilitation; Supportive housing project |
| 30000047 / 29 | 26-2901 (section-31000836) | Affordable unit; City financial assistance; Collection account; Consumer credit history; Consumer credit report; Consumer debt judgment; Delinquent debt; Department; Developer; Medical debt; Receives; Student loan debt |
| 30000048 / 30 | 26-3001 (section-31000838) | Authentication data; Biometric identifier information; Dwelling unit; Minor; Multiple dwelling; Owner; Reference data; Smart access building; Smart access system; Third party; User |
| 30000049 / 31 | 26-3101 (section-31000845) | Administering agency; Booking service; Class A multiple dwelling; Class B multiple dwelling; Dwelling unit; Listing; Registered host or host; Private dwelling; Rooming unit; Short-term rental |
| 30000050 / 32 | 26-3201 (section-31000850) | Administering agency; Application program interface; Class B multiple dwelling; Booking service; Directly or indirectly; Dwelling unit; Electronic verification system; Listing; Short-term rental; Short-term rental registration number |
| 30000051 / 33 | 26-3001 (section-31000853) | Affordable housing unit; Applicable affordable housing provisions; Authorized monitor; Building; Commissioner; Department; Owner; Premises; Qualifying household; Regulatory agreement; Zoning resolution |
| 30000051 / 33 | 26-3013 (section-31000865) | No labels extracted — review required |
| 30000052 / 34 | 26-3401 (section-31000873) | duty to mitigate damages |
| 30000053 / 35 | 26-3501 (section-31000875) | City financial assistance; Class A dwelling unit; Department; Developer; Dwelling unit offered for rent; Housing development project; HUD restricted land; Receives; Universal design |
| 30000054 / 36 | 26-3601 (section-31000879) | department |
| 30000054 / 36 | 26-3602 (section-31000880) | 10-year rainfall flood risk area; Department |
| 30000055 / 37 | 26-3701 (section-31000881) | Area median income; City financial assistance; Converted homeownership unit; Converted non-residential-to-homeownership unit; Converted rental-to-homeownership unit; Department; Down payment assistance unit; Dwelling unit; Homeownership opportunity unit; Income restricted unit; New construction unit |
| 30000056 / 37 | 26-3701 (section-31000883) | Application; Cooperative corporation; Dwelling unit; Purchaser; Sale; Seller; Summer recess notice; Summer recess period; Transfer requirements |
| 30000057 / 38 | 26-3801 (section-31000889) | Area median income; City economic development entity; City financial assistance; Comptroller; Construction; Construction employer; Construction worker; Demolition; Department; Developer; Essential benefits; Housing development project; Manual labor; On-site supportive services; Preservation project; Scatter site; Supportive housing project; Wage |

# HMC definition scope review

September 17, 2026. This is an implementation review of the bundled enacted text, not a new interpretation or approval of every occurrence. The general §27-2004 inventory has fifty labels. The main registry book also contains the Article 14 expansion; a separate book retains §27-2045's Private dwelling replacement. The reviewed local batch now has thirty-two eligible records in the main book and one in the local book. Nineteen general meanings remain withheld. Publication status is recorded separately in the dated checklist checkpoints.

Published scope and verification are recorded in [the continuation checklist](PERMITEXT_COLUMN_UX_CONTINUATION.md) and [closeout](PERMITEXT_COLUMN_UX_CLOSEOUT.md). The five exact chapter hashes are guarded in `permitext-sync-server/scripts/definition-sources/bind-hmc-general-applicability.mjs`. The eleven building and occupancy meanings below are now implemented and locally tested. The remaining table lists withheld meanings. No plural alias is assumed.

## Remaining general meanings, grouped for review

| Group | Meanings | Required treatment before activation |
| --- | --- | --- |
| Physical attributes remaining (2) | Rear yard; Side yard | No application occurrences found in this audit; remain withheld. Six reviewed physical meanings are now implemented as recorded below. |
| Qualified occupancy (4) | Tenement; Hotel; Dormitory; Public part of a dwelling | Review old/new-law compounds and full occupancy qualifications. General Hotel must not replace the separately qualified “exempt luxury hotel as defined by the department in rules” in §27-2093.1(b)(4). |
| Broad compound-sensitive terms (2) | Dwelling; Dwelling unit | Audit with the complete longer-term set and local covered/private/multiple/SRO/unoccupied categories; isolated short-label activation is insufficient. |
| Alternatives and contextual meanings (9) | Department; Family; Single room occupancy; Floor area; Alteration; Court; Owner; Class A multiple dwelling; Curb level | Review source-specific alternatives and ordinary meanings listed below. |
| General references and long definitions (2) | This code; Harassment | Review quoted/cross-reference contexts and §27-2093's local Harassment definition versus §27-2093.1's express reference to §27-2004. Preserve the entire lengthy source body. |

Specific contextual boundaries include §27-2087(c)(1)'s Family/boarder qualification and §27-2097's family-member compound; §27-2045(a)'s Class A inclusion; §27-2074(f)'s Alteration meaning limited to subdivisions (a) and (e); imported SRO categories in §§27-2093(c)/27-2150; zoning floor-area-ratio references in §27-2093.1; architectural versus judicial Court; Department's named-agency/receiver contexts, including §27-2137(a); Owner's ownership and nuisance qualifications; and local Curb level measurement language in §§27-2083/2085.

## Completed first-group scope and occurrence inventory

The original combined read-only audit records 250 exact singular paragraph occurrences across the eleven candidates. Applying candidate scopes in memory with the full active registry yields 201 prospective links; the two proposed contextual exclusions reduce that to 199. These counts are not rendered acceptance and do not enable product data. Per-term raw/prospective/final-candidate counts are: Class B multiple dwelling 10/8/8; Converted dwelling 18/10/10; Apartment 71/61/60; Rooming unit 17/15/14; Rooming house 9/7/7; Lodging house 5/3/3; Premises 88/78/78; Structure 14/5/5; Summer resort dwelling 4/3/3; Self-closing door 8/6/6; Unoccupied dwelling unit 6/5/5.

Evidence: `/tmp/permitext-hmc-first11-occurrences.json` includes definition identities/bodies, source and paragraph hashes, exact section/anchor, paragraph index and UTF-16 offsets. `/tmp/permitext-hmc-first11-audit.mjs` reproduces the local review. The Apartment exclusion is §27-2041 paragraph 0, offsets 530–539; the Rooming unit exclusion is §27-2074(f) paragraph 17, offsets 339–351. §27-2089 expressly refers Summer resort dwelling back to §27-2004(a)(46). No replacement meaning was found in the other nine candidates' reviewed exact application occurrences; broader wording and plural behavior are not accepted by that observation.

## Exact-section boundary correction

The existing matching contract treats an excluded section as also excluding dot-number descendants. For HMC §27-2017, operative separately numbered sections such as §§27-2017.1/.4/.6/.8 therefore lose otherwise applicable Premises candidates. Do not change shared prefix semantics globally: other codes deliberately use descendant scope. Review explicit exact-section exclusion metadata and its web/native/fallback behavior before changing these HMC boundaries. This is a coverage gap, not permission to link terms in definition prose. The current-enabled audit also finds twelve suppressed occurrences: eleven Multiple dwelling references in §§27-2017.1/.2/.3/.4/.5/.6/.12 and one Basement reference in §27-2017.8. These are separate source `<section>` elements with their own anchors and headings, not paragraphs nested inside §27-2017. Exact source offsets and hashes are retained in `/tmp/permitext-hmc-existing-prefix-gaps.json`.

The general inventory is not an inventory of every HMC article-specific definition. Eighteen additional discovered headings/declarations remain listed in the generated coverage report. Further Report work and the ten unresolved authoritative-source references remain outside this work's authorized implementation scope.

September 17 follow-up: Class B multiple dwelling, Converted dwelling, Apartment, Rooming unit, Rooming house, Lodging house, Premises, Structure, Summer resort dwelling, Self-closing door and Unoccupied dwelling unit are now activated in the local registry. Both reviewed contextual exclusions are implemented. The optional `excludedExactSections` field excludes §27-2017 itself while preserving separately numbered operative sections; the other eight HMC section exclusions and all legacy prefix semantics remain intact. With that correction, Premises has 82 rendered paragraph matches and the eleven terms total 203. General Multiple dwelling has 272 matches and Basement's §27-2017.8 occurrence is retained. Every pre-existing ID, source body, citation and alias remains unchanged.

Verification: 107 focused JavaScript tests and 247 actual-corpus and prepared-passage browser checks passed. The parent inspected Class B and Rooming unit popup screenshots, complete bodies/citations, Close and Escape focus return. Separate product-path inspection found original headings with spaces after the hyphen in §§27-2017.4/.8; correcting only the audit would be insufficient. Native and prepared-web section identity repairs and their regression evidence are tracked in the current continuation checkpoint. No physical or universal visual acceptance is implied.

## Physical-definition group: completed source audit, still withheld

The following eight §27-2004 entries remain **review-required in product data**. This audit proposes applicability across HMC chapters 1–5 using the existing eight prefix definition-section exclusions plus exact §27-2017 exclusion. It preserves each original ID, complete body, citation and edition. Counts below come from hypothetical in-memory activation against the full published registry and exact decoded paragraphs across all five chapters; they are neither rendered verification nor activation evidence.

| Original label | Proposed additional source-attested aliases | Raw occurrences including aliases | Prospective links after reviewed exclusions |
| --- | --- | ---: | ---: |
| Kitchen | kitchens | 22 | 18 |
| Story | stories | 48 | 31 |
| Fireproof | none | 23 | 11 |
| Nonfireproof | non-fireproof | 5 | 3 |
| Firestair | fire stair; fire stairs | 3 | 2 |
| Firetower | fire tower; fire towers | 3 | 2 |
| Rear yard | none | 5 | 0 |
| Side yard | none | 1 | 0 |
| **Total prospective links** | | | **67** |

Required occurrence exclusions are confined to §27-2058. For future **Kitchen** activation, exclude `A living room does not include a kitchen under this paragraph`, target occurrence 0, so the local definition declaration remains plain. Recalculation with this exclusion gives Kitchen 18 links and the group 67. For **Fireproof**, exclude phrase `non-fireproof`, target occurrence 0, to prevent affirmative links inside both negations, including when the longer candidate is excluded. For **Nonfireproof**, exclude `non-fireproof roof`, occurrence 0. The original Nonfireproof predicate expressly classifies other multiple dwellings; the referenced roof belongs to “another structure,” so this audit does not extend that predicate to the roof. The separate `non-fireproof multiple dwelling` use remains eligible. Both exclusions must be tested together against the full entry set to prevent fallback to the affirmative inner word.

The follow-up review also confirmed that the currently active Living room entry decorated that same local declaration despite its conflicting general kitchen treatment. A narrow helper correction now excludes that exact sentence; its actual-source full-registry regression retains the other three Living room applications in §27-2058. The earlier claim that mixed declarations contain none of the original eleven labels was incomplete. Registry regeneration and rendered verification remain separate from this helper regression.

Kitchen keeps its complete living-room/eighty-square-foot qualification. The sentence in §27-2058(a)(4) excluding a kitchen from the local living-room provision changes that provision's application; it does not supply a replacement Kitchen definition. Story keeps its complete post-1929 height-by-stories counting qualifications. Section 27-2082(f) supplies purpose-specific cellar counting for egress versus fireproof construction; that operative sentence remains controlling and does not replace the general space definition. Fireproof keeps both the multiple-dwelling and corresponding-part branches, including the MDL reference; no new fire-resistance rating is supplied by this audit.

The spaced Firestair/Firetower forms and their plurals are expressly used in §27-2038(a)–(b). Full-registry longest matching must select `fire stair` over the existing `Stair` entry. Kitchen and Story plural forms are attested application text, not inferred from an assumed general singular/plural rule. Rear yard and Side yard occur only within excluded §27-2004 definition prose across these five chapters; correct activation would produce no application links and cannot establish rendered coverage for either term. No further local replacement was found in the reviewed occurrence inventory; this does not close the remaining HMC semantic review.

Evidence: `/tmp/permitext-hmc-physical8-occurrences.json` records original entries, proposed aliases and exclusions, exact paragraphs, source/paragraph SHA-256 hashes, section numbers and anchors, paragraph indices, UTF-16 ranges, and full-registry prospective matches. `/tmp/permitext-hmc-physical8-contexts.txt` contains the reviewed application text. The registry audited had SHA-256 `72cc80fe5d5bbd35d8729e884b9e1f0bd216456f2f6250ba2887cb2e5d31f421`. Source chapter hashes were:

- 30000077: `dcc196eed865ed4bad3efa726df9b3855dd8e7cf40ade22bd37c19c5372a6066`
- 30000078: `80734cb3ad49feb8aec1bc3e5795c859a62bcb5930a4f56aa803a810d50df7b2`
- 30000079: `7545311ec4d903e2c89289d5a4a37ddb66fd06c0f4fe8fba4e98dd17ef90f52e`
- 30000080: `a76f2a1f60ad0b632c400189a4f8cf48aaeee90dd0315243560a0ff8b08690d2`
- 30000081: `2584178f90403fb03f0ba046060a16775248e557aab7da57d17c47f332c01103`

A later implementation should guard these sources and exact original inventory, exercise all 67 proposed matches and both negative contexts with the full registry, preserve all definition prose as plain text, and obtain native and rendered evidence separately. This audit made no product changes and used no phone.

## September 17 implementation follow-up

The six physical meanings above are now implemented with exactly the audited aliases and occurrence exclusions. Rear yard and Side yard remain withheld. All original IDs, full bodies and source records are unchanged. The actual-source full-registry tests exercise all 67 links, definition/edition boundaries, both negation cases and Firestair precedence. JavaScript 113, browser 282 and native two tests passed. Parent-rendered Story/Fireproof popup and negative-context inspections passed; build 83 compiled with matching registry bytes. Current integration and physical status are in the dated continuation/closeout checkpoint. The preceding source audit and its hypothetical counts remain historical evidence, superseded by this implementation verification.

## September 17 remaining-scope inventory

All nineteen withheld general meanings now have grouped review records: [qualified occupancy](PERMITEXT_HMC_QUALIFIED_OCCUPANCY_REVIEW.md), [Dwelling/unit](PERMITEXT_HMC_DWELLING_SCOPE_REVIEW.md), [nine contextual meanings](PERMITEXT_HMC_CONTEXTUAL_SCOPE_REVIEW.md), and [This code/Harassment](PERMITEXT_HMC_REFERENCE_SCOPE_REVIEW.md), plus the two yard terms with no application occurrence above. This establishes inventory and concrete decision boundaries, not semantic acceptance of every occurrence. The repository-owned qualified audit produces 14 Tenement and two Dormitory candidates with original bodies and source-attested plural forms; three focused tests pass. None of these nineteen meanings was activated by the audit.

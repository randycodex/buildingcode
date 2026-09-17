# HMC contextual meanings — September 17, 2026

Later complete inventories supersede the preliminary counts below for [Court](PERMITEXT_HMC_COURT_SCOPE_REVIEW.md), [Floor area](PERMITEXT_HMC_FLOOR_AREA_SCOPE_REVIEW.md), [Alteration](PERMITEXT_HMC_ALTERATION_SCOPE_REVIEW.md), and [Single room occupancy](PERMITEXT_HMC_SRO_SCOPE_REVIEW.md). They propose 44, 28, six and nine bounded application matches respectively, without activating any registry entry. The other contextual meanings below remain under review.

Bounded read-only review of nine withheld §27-2004 meanings across the five bundled HMC subchapters. No activation, alias, wording or product change. These are existing resolved meanings, separate from the ten explicitly deferred unresolved authoritative-source references.

## Inventory and evidence boundary

The reproducible scan inventories exact singular labels in every paragraph, with normalized source sections, original full paragraphs, SHA-256 hashes, anchors, paragraph indices and UTF-16 ranges. It also records prospective matches with all nine candidates added to the full published registry in memory. This tests lexical competition; it does not prove semantic applicability.

| Meaning | Existing ID | Exact occurrences outside §27-2004 |
| --- | --- | ---: |
| Department | `e195154e35b1eff17498` | 1,046 |
| Family | `89e60949d0b76dbdfcfe` | 55 |
| Single room occupancy | `eaab3c85f92d400bb0c5` | 27 |
| Floor area | `4a42b67efbedfa875d15` | 43 |
| Alteration | `4d33bc1533510d86e707` | 10 |
| Court | `6c6074adb2680dd4a441` | 165 |
| Owner | `d47153ef259c38799ea0` | 780 |
| Class A multiple dwelling | `dc9d3eef2b81427fac2f` | 26 |
| Curb level | `cbfaf13dd62d2ce15969` | 4 |

Counts include compounds and local definition passages outside §27-2004; they are not accepted links. Department, Owner and judicial/architectural Court have complete lexical inventories, but their high-volume contexts have not all received individual semantic acceptance. No exhaustive semantic-completion claim is made.

All original bodies come from `2026-enacted-administrative-code/chapters/30000077.html#section-31001849`, SHA-256 `dcc196eed865ed4bad3efa726df9b3855dd8e7cf40ade22bd37c19c5372a6066`. Preserve their full bodies and identities in any later implementation. In particular Family's complete alternatives and student/fire-safety qualifications, Owner's nuisance/corporate qualifications, and Class A's permanent-occupancy exceptions cannot be truncated.

## Bounded candidates and unaccepted contexts

| Meaning | Concrete candidate for later verification | Required exclusions or remaining blocker |
| --- | --- | --- |
| Court | Architectural uses in §27-2058 and §27-2059; the source expressly distinguishes inner and outer courts | Judicial court uses elsewhere are not the defined open space. Enable only reviewed architectural sections/phrases; do not enable the short word throughout HMC. |
| Floor area | Room/window measurements in §27-2073 and ordinary room-size uses in §27-2074 | §27-2075's total livable/liveable area excludes specified spaces; retain those local qualifications. §27-2093.1 includes zoning floor-area-ratio and whole-building/low-income-floor-area contexts, not automatically the room-area definition. |
| Single room occupancy | Ordinary occupancy uses in §§27-2074, 27-2078, 27-2079 and 27-2080 | §§27-2093 and 27-2150 invoke separately defined SRO multiple-dwelling/unit categories. Qualified uses in §§27-2093.1 and 27-2151/2152 must not receive a shorter general meaning by fallback. |
| Alteration | Ordinary physical-work use in §27-2089 is a bounded candidate | §27-2074(f) explicitly narrows Alteration for subdivisions (a) and (e); section-only routing cannot capture that full boundary. §27-2093's permits and imported administrative-law references need review before broad activation. |
| Class A multiple dwelling | General occupancy category outside the reviewed local exception | §27-2045(a) expressly adds an inclusion to the general §27-2004(a)(8) meaning. Its operative Class A references need both correct scope and complete additive context; general-only activation there is not accepted. |
| Curb level | None accepted in this audit | All four exact application occurrences are in §§27-2083 and 27-2085, where measurement uses the curb directly in front of each part and the street on which the dwelling fronts. The general center-of-front/average-of-fronts definition begins “Except as otherwise provided”; do not replace these local measurement instructions. |
| Family | No broad activation proposed | One-/two-family compounds, owner-family kinship and family-member uses are not necessarily the defined household grouping. §27-2087 contains purpose-specific occupancy qualifications; §27-2097 uses a family-member compound. These require phrase/subdivision review. |
| Department | No broad activation proposed | Named agencies appear together with the unqualified department, including §27-2045(f). §27-2137's receiver context requires inspection against the general enforcement-agency definition. A generic short-word link across 1,046 occurrences is not justified. |
| Owner | No broad activation proposed | General ownership, owner-family compounds, local definitions and nuisance/corporate extensions require source-context classification. Preserve the whole original definition; no short unqualified substitute is supported. |

Any proposed implementation must retain all definition/terminology exclusions, code/edition identity and missing-section fail-closed behavior. Mixed sections require occurrence-specific treatment where section-wide suppression would discard legitimate application uses. Proposed candidates above still require source-bound metadata, tests with the complete registry, and rendered verification.

## Reproduction artifacts

- `/tmp/permitext-hmc-contextual-nine-audit.json`: full original definitions and source/paragraph/range inventory, counts and limitations.
- `/tmp/permitext-hmc-contextual-nine-audit.mjs`: reproduces the base inventory and in-memory prospective matcher results.
- `/tmp/permitext-hmc-contextual-nine-contexts.txt`: shortened context listing for review; the JSON retains complete paragraphs.

The source hash for each of the five files is recorded per paragraph in the JSON. Temporary artifacts may expire; this document preserves the review conclusions. The script does not reproduce manual conclusions or activate any entry.

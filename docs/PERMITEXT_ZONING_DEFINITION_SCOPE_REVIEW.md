# Zoning definition applicability review — September 16, 2026

The initial source inventory is followed by the bounded implementation checkpoint below. Inventory classifications alone do not authorize eligibility.

Run from the repository root:

```sh
node permitext-sync-server/scripts/audit-zoning-definition-applicability.mjs /tmp/permitext-zoning-applicability-audit.json
node --test permitext-sync-server/tests/zoning-definition-applicability-audit.mjs
```

The script reads only the bundled source and writes its requested JSON output. It fails if the reviewed source hash or the authored italic-term policy changes. The four focused tests passed; log: `/tmp/permitext-zoning-applicability-tests.log`.

## Source and scope matrix

Source: `NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-zoning-resolution/chapters/I-2.html`, §12-10.

SHA-256: `e7707f4f9b5c705832d42d7320101f6ded124658f2a6f356f6bdd4f690f48cf7`.

| Authored container scope | Count | Required implementation decision |
| --- | ---: | --- |
| Global | 279 | Retain exact meaning; resolve local overrides before application |
| Chapter | 174 | Parse explicit Article/Chapter labels into matching chapter IDs |
| Section | 26 | Preserve explicit lists and ranges; validate section hierarchy semantics |
| Blank/unclassified | 5 | Keep withheld until each source label and meaning is reviewed |
| Total | 484 | Preserve every container independently |

The 484 containers belong to 446 term articles; 33 terms have competing containers. Forty-eight containers carry the source CSS class `definition--exclude`, including two global containers (`affordable floor area` and `FRESH food store`). The audit preserves this flag without interpreting its legal or publication significance. Five blank scopes belong to Mandatory Inclusionary Housing area, sign surface area, Special Bay Ridge District, UAP development, and width of outer court.

The existing registry has 478 records and zero eligible Zoning entries because the general extractor drops surrounding applicability metadata and the audit generator deliberately marks Zoning `review-required`. The 484-container inventory is not interchangeable with those 478 normalized records; enabling the existing flat list would lose scope distinctions.

At source line 62, §12-10 explicitly assigns its meanings to words italicized in the Resolution. The JSON preserves that instruction, each exact applicability label, source line/anchor, amendment date, variant text and separate HTML/text bodies. No chapter or section scope is inferred from ambiguous labels.

## Concrete examples

| Term | Source evidence | Safe disposition |
| --- | --- | --- |
| floor area ratio | General Definition; I-2 line 5663. Authored italic application in II-3 lines 217, 220, 227 | Highest-confidence first candidate: reviewed italic occurrences in II-3, with source/edition guards |
| development | I-2 line 4228; applicable to Article VIII, Chapter 2; explicit chapter-limited wording | Never promote this variant to a global meaning |
| development, or to develop | Five separate containers | Resolve scope precedence before enabling |
| above-grade mass transit station | I-2 line 70; Article VI, Chapter 6 | Candidate only inside reviewed VI-6 scope |

## Competing term inventory

All variants remain separate in the JSON, including repeated text and exclusion flags.

| Term | Containers |
| --- | ---: |
| accessory use, or accessory | 3 |
| area of no disturbance | 3 |
| average percent of slope | 2 |
| caliper (of a tree) | 3 |
| critical root zone | 2 |
| detached (building) | 2 |
| development, or to develop | 5 |
| Esplanade | 2 |
| floating structure | 2 |
| ground floor level | 2 |
| hillside | 2 |
| home occupation | 3 |
| mixed use building | 2 |
| pier | 2 |
| platform | 2 |
| primary frontage | 2 |
| publicly accessible private street | 2 |
| qualifying building | 2 |
| qualifying transit improvement sites | 2 |
| shoreline | 2 |
| Site alteration | 3 |
| staging area | 2 |
| steep slope | 2 |
| steep slope buffer | 2 |
| Tier I site | 2 |
| Tier II site | 2 |
| topsoil | 2 |
| transit-adjacent sites | 2 |
| tree credit | 3 |
| tree protection plan | 2 |
| upland connection | 2 |
| visual corridor | 2 |
| width of outer court | 2 |

## Implementation sequence and limits

1. Retain per-container applicability and explicit aliases in the compiler; do not merge meanings solely by term label.
2. Review `definition--exclude` semantics and the five blank scopes against their authoritative publishing context. These are unresolved scope decisions, separate from the ten already deferred definition-source entries.
3. Encode reviewed chapter/section bounds and precedence. Keep unknown ranges and competing meanings withheld.
4. Add authored-italic occurrence eligibility to web and native renderers without inferring italics from ordinary text. Preserve existing citations, inline markup and definition-chapter exclusion.
5. Start with the reviewed floor-area-ratio application above, test negative ordinary-text and out-of-scope occurrences, then expand by verified source groups. Verify web/native popup source identity and return position separately.

This audit does not verify current law beyond the bundled source, explain the source CSS exclusion flag, establish that similarly named meanings are equivalent, or prove rendered/touch behavior. It makes no paid calls and changes no user data, billing settings, registry eligibility or definitions.

## Bounded implementation checkpoint — September 17

The compiler now preserves all 484 source applicability containers across the existing 478 Zoning records. Source hashes guard both I-2 and the reviewed II-3 application chapter. Only the unique general “floor area ratio” meaning is eligible, only in II-3, and only where every non-whitespace character is authored italic text. The explicit plural “floor area ratios” follows §12-01(d); no abbreviation is inferred. Other Zoning records remain review-required, including unresolved competing scopes and source exclusion flags. Definition chapters remain excluded. All 5,651 existing definition IDs, wording and source identities are unchanged.

Web uses authored em/i ancestry; native uses italic traits retained by source conversion. The actual II-3 browser fixture passes 46 checks, including 28 italic occurrences linked and five plain occurrences unlinked. The initial new fixture assertion failed because its outer template consumed regex escapes; correcting that fixture preserved the independently confirmed counts. A rendered popup at §23-20 was inspected for readable full text and correct §12-10 citation; Close returned focus. This is browser fixture evidence with actual corpus text, not physical-phone acceptance or full-app route verification.

Focused generated-data and matching regressions pass 87/87 (`/tmp/permitext-zoning-final-regression.log`). Two native italic/conversion tests passed (`/tmp/permitext-zoning-italic-native.log`). Offline and UX suites pass (`/tmp/permitext-zoning-offline.log`, `/tmp/permitext-zoning-ux.log`). Local asset versions are definition v66, Reader v473, shell v1125. The final native actual-registry routing test also passed (`/tmp/permitext-zoning-registry-native-final.log`), including definition/other-chapter exclusions and actual attributed conversion. Final device-binary rebuild and integration status are recorded in the column closeout checkpoint. No phone interaction occurred.

## September 17 — dimensional Zoning definitions and Notebook return

The reviewed II-3 set now contains 13 definitions: FAR plus building, building or other structure, lot area, lot width, lot coverage, street wall, street line, story, yard, base plane, curb level and dwelling unit. All require authored italics, retain exact full §12-10 wording/identifiers and remain restricted to II-3. Explicit source-attested plurals include lot coverages; arbitrary stemming is not enabled. Other 465 Zoning records remain withheld. The 5,652-entry registry remains byte-identical across web/native; refreshed occurrence audit records 188,984 text candidates across 533 mapped chapters, not accepted rendered links.

Seventy-one focused source/registry tests passed (`/tmp/permitext-zoning-dimensional-regression-final.log`), 124 browser fixture checks passed, and the native 13-term identity/body-hash/scope/italic/plural unit passed (`/tmp/permitext-zoning-13-native-final.log`). Actual full app Search → §23-42 opens base planes with complete long wording; scrolling reaches final qualification and §12-10 citation, and Escape returns focus to the trigger without moving the passage. These checks do not substitute for physical touch acceptance.

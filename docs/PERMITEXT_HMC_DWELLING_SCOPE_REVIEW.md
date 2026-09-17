# HMC Dwelling and Dwelling unit: source-scope review

## Status and exact source meanings

Read-only audit. Both entries remain `review-required`; no activation, alias addition, registry regeneration, or rendered acceptance is established by this document. This review does not change the ten deferred authoritative-source entries.

- **Dwelling**, ID `89817273c7ae92933635`: “A dwelling is any building or structure or portion thereof which is occupied in whole or in part as the home, residence or sleeping place of one or more human beings.”
- **Dwelling unit**, ID `7cb3a17fd6901e3446b7`: “Dwelling unit shall mean any residential accommodation in a multiple dwelling or private dwelling.”

Both have exact source `2026-enacted-administrative-code/chapters/30000077.html`, anchor `section-31001849`, §27-2004, chapter1, HOUSING MAINTENANCE CODE. The general meanings apply to the HMC legal chapter, represented by the five bundled subchapters; that does not authorize substituting these shorter labels for qualified categories.

## Complete occurrence inventory and bounded candidate counts

The audit parses every paragraph in all five actual source chapters and tests hypothetical chapter1–5 applicability against the **full published registry**, retaining the existing eight prefix definition-section exclusions plus exact §27-2017 exclusion. Source-attested candidate plural aliases are `dwellings` and `dwelling units`; they are proposed only, not enabled.

| Entry | Raw exact occurrences including proposed plural | Hypothetical full-registry candidate links | Plural subset of candidate links |
| --- | ---: | ---: | ---: |
| Dwelling | 1359 | 323 | 84 |
| Dwelling unit | 521 | 407 | 55 |

The 730 candidate links are **not an approved final count**. Raw Dwelling occurrences overlap Dwelling unit and longer phrases; counts must not be added as distinct textual locations. The candidate model already honors currently available longer matches, but that does not protect unregistered plurals, excluded longer terms, or their anaphoric references.

A scoped candidate hazard scan found 53 candidate ranges inside the multiple-dwelling family of phrases, 8 inside private dwelling(s), 2 inside converted dwelling(s), 31 inside covered dwelling/unit phrases, 5 inside SRO dwelling unit phrases, 1 inside ancillary dwelling unit, 2 inside unoccupied dwelling units, and 1 adjectival `dwelling purposes`. These categories overlap and are not a subtraction formula. The JSON records exact enclosing phrase ranges so each decision can be tested. No candidate fallback was observed inside `multiple dwelling law` in this snapshot; keep a negative regression rather than assuming that protection persists.

## Source-grounded boundaries requiring correction before activation

1. **Longer categories and plural fallback.** Generic Dwelling must not replace a currently excluded Multiple dwelling, Class A/B multiple dwelling, covered multiple dwelling, private dwelling, converted dwelling, or other reviewed longer classification. Examples include plural `class A multiple dwellings` at §§27-2033.1/2041.2, `class B multiple dwellings` and `private dwellings` at §27-2045, and `converted dwellings` at §27-2066. Their modifiers are material legal categories. Reuse audited longer-entry exclusions and protect source-attested longer plural phrases explicitly; do not broaden those longer entries' aliases implicitly as part of this batch. Both generic entries need protection when a Dwelling unit candidate is suppressed, or Dwelling can become the new inner fallback.

2. **Cooling categories, §27-2030.** Actual paragraph11 defines Covered dwelling with a tenant-occupied one-/two-family branch and an emergency-housing exception; paragraph12 defines Covered dwelling unit as a tenant-occupied unit in a covered dwelling. Paragraphs13 and15–20 include further declarations and definition continuations. In particular paragraphs16–17 (`For a covered dwelling unit ... such term means ...`) expose generic candidates even where some larger definition paragraphs are already protected by current matching. All such declaration spans must remain plain. Application occurrences of `covered dwelling(s)`/`covered dwelling unit(s)` must not fall back to the shorter general entries. Bare `such dwelling` and `such dwelling unit` references in the operative cooling provisions need antecedent review before an exact occurrence-exclusion inventory can be frozen; whole-section suppression would unnecessarily discard ordinary applications.

3. **Imported ancillary category, §27-2087(a)(1).** The sentence expressly uses `ancillary dwelling unit, as defined in section U102.1 of the New York city building code`. The generic Dwelling unit popup would conceal that explicit source boundary. Exclude exact phrase `ancillary dwelling unit` for both candidates, preserving the source reference and not inventing the imported definition.

4. **Imported SRO categories, §§27-2093 and27-2150–2152.** Section27-2093(c) imports Single room occupancy multiple dwelling from §27-198; §27-2150 imports both SRO multiple dwelling and SRO dwelling unit from §27-198.2(b) for its article. Section27-2150 itself is excluded definition prose, but five candidate SRO dwelling-unit phrases remain in §§27-2151/2152. Exclude the full longer phrases for both generic candidates; review bare unit/dwelling anaphora within those provisions, rather than treating the excluded terminology section as sufficient protection.

5. **Inline Alteration declaration, §27-2074(f).** The actual paragraph defines Alteration only for subdivisions(a),(e) and contains `any of which results in new dwelling units or rooming units`, plus a multiple-dwelling reference. Generic unit/dwelling links must remain plain inside this declaration. This is a paragraph-specific boundary; other operative §27-2074 paragraphs are not excluded by this observation.

6. **Other mixed declarations.** Section27-2093.1's Low income housing and Pilot program list declarations contain unit/dwelling language, including continuation sentences and enumerated criteria; the full declaration extent must be reviewed before activation. Section27-2093(a)'s harassment declaration and enumerated clauses also require paragraph-local protection. The raw inventory retains these occurrences even when the current full matcher does not produce a candidate, so a change to other entries cannot silently reveal a generic fallback.

7. **Non-noun use.** In §27-2082(f), `A cellar occupied hereunder for dwelling purposes ...` uses dwelling adjectivally. Exclude exact phrase `dwelling purposes`; preserve the separate ordinary Dwelling occurrence later in the paragraph. Source ranges are in the JSON.

8. **Covered unit radiator provisions.** Sections27-2056.21–24 use Covered dwelling unit/covered multiple dwelling, followed by bare unit references. The terminology section is excluded, but operative generic fallbacks remain. Apply the same compound-plus-antecedent audit discipline as the existing Multiple dwelling work; do not assume the generic accommodation definition communicates the child-under-six coverage criterion.

## Recommended next implementation boundary

Do not enable either entry with chapter scope alone. First freeze an exact, source-guarded inventory of (a) longer compound exclusions, including actual plural spellings, (b) inline declaration ranges/phrases, and (c) the identified cooling, radiator and SRO anaphoric references. Preserve ordinary uses elsewhere and both complete original meanings. Test both proposed entries together with the full registry, including fallback when the longer generic Dwelling unit is suppressed. Freeze final counts only after those decisions; the 730 preliminary candidates are deliberately not a release acceptance target.

The current audit establishes complete exact-label/plural paragraph retrieval and concrete blocking contexts. It does not claim every ordinary-looking anaphoric occurrence has been semantically resolved, nor does it authorize universal exclusions for every descriptive adjective. Required next tests include positive ordinary singular/plural applications, full definition bodies/citations, chapter/edition boundaries, definition prose, imported categories, and unchanged longer labels. Native and browser rendering remain separate gates.

## Evidence

- `/tmp/permitext-hmc-dwelling-occurrences.json`: exact source/paragraph hashes, original entries, proposed aliases, section/anchor, paragraph index, UTF-16 candidate and enclosing-context ranges, and full-registry candidate results.
- `/tmp/permitext-hmc-dwelling-audit.mjs`: local reproducible inventory script, with no product writes.
- `/tmp/permitext-hmc-dwelling-contexts.txt`: decoded candidate application contexts.

Audited registry SHA-256: `6fdc111b3108e58af59287db0441fd12e0f9394bb89c8eaa8672ae6e080558cc`. Source chapter SHA-256 values:

- 30000077: `dcc196eed865ed4bad3efa726df9b3855dd8e7cf40ade22bd37c19c5372a6066`
- 30000078: `80734cb3ad49feb8aec1bc3e5795c859a62bcb5930a4f56aa803a810d50df7b2`
- 30000079: `7545311ec4d903e2c89289d5a4a37ddb66fd06c0f4fe8fba4e98dd17ef90f52e`
- 30000080: `a76f2a1f60ad0b632c400189a4f8cf48aaeee90dd0315243560a0ff8b08690d2`
- 30000081: `2584178f90403fb03f0ba046060a16775248e557aab7da57d17c47f332c01103`

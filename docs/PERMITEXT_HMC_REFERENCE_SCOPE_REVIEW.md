# HMC reference-term scope review

September 17, 2026. Source audit only; **This code** and **Harassment** remain withheld. No registry, native implementation, phone state, or provider was changed. This review excludes the ten deferred authoritative-source references and Report work.

## Source and counting boundary

The audit reads all five enacted HMC source chapters, `NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/30000077.html` through `30000081.html`. Counts are case-insensitive exact singular term occurrences in decoded direct section paragraphs, with Unicode word boundaries. Headings, plural variants, and inferred synonyms are not included. These are raw occurrences, not promised rendered links or a legal interpretation.

| Chapter file | SHA-256 |
| --- | --- |
| 30000077.html | dcc196eed865ed4bad3efa726df9b3855dd8e7cf40ade22bd37c19c5372a6066 |
| 30000078.html | 80734cb3ad49feb8aec1bc3e5795c859a62bcb5930a4f56aa803a810d50df7b2 |
| 30000079.html | 7545311ec4d903e2c89289d5a4a37ddb66fd06c0f4fe8fba4e98dd17ef90f52e |
| 30000080.html | a76f2a1f60ad0b632c400189a4f8cf48aaeee90dd0315243560a0ff8b08690d2 |
| 30000081.html | 2584178f90403fb03f0ba046060a16775248e557aab7da57d17c47f332c01103 |

Reusable detailed inventory: `/tmp/permitext-hmc-reference-occurrences.json`; generator: `/tmp/hmc-reference-audit.mjs`. Each occurrence records chapter, exact section and anchor, paragraph index, decoded UTF-16 range, full paragraph, paragraph SHA-256 and source-HTML start offset. The durable findings and decision boundaries are recorded here independently of those temporary files.

| Term | Ch. 1 | Ch. 2 | Ch. 3 | Ch. 4 | Ch. 5 | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| This code | 6 | 26 | 4 | 24 | 44 | 104 |
| Harassment | 1 | 0 | 0 | 111 | 13 | 125 |

## This code

Original ID `36ec815a89e5f6032f66`, source §27-2004, anchor `section-31001849`. Preserve the entire body: `This code shall mean the housing maintenance code.` Its SHA-256 is `81250e23c081b1df8eefb6acf7e48ce939d5fb6a44ed839b2ebccace46cbc059`. Do not expand that body to mean the whole Administrative Code.

Six occurrences are in excluded §27-2004 definition prose; 98 occur elsewhere. Most refer directly to HMC duties, violations or HMC sections, for example §27-2005(a)–(c), §27-2037's express contrast with the electrical code, and §27-2153's contrast with the Multiple Dwelling Law. However, seven enacted cross-references use the same words for provisions outside HMC:

| Host section | Exact referenced provision followed by “of this code” | Count |
| --- | --- | ---: |
| §27-2056.4 | §17-179; §17-123 | 2 |
| §27-2056.9 | §17-179 | 1 |
| §27-2056.13 | §17-179 | 1 |
| §27-2109.1 | §28-210.1 | 1 |
| §27-2129.1 | §28-219.4 | 1 |
| §27-2151 | §27-198.2 (Building Code, not HMC beginning §27-2001) | 1 |

These seven cannot receive the HMC-only popup merely because their containing chapter is HMC. Preserve the authored citation links and source text. Source-attested occurrence exclusions, rather than a replacement definition, are the narrow candidate approach.

Two additional occurrences are inside inline defining prose: §27-2093(a)(3), in the local Harassment enumeration, and §27-2118(b)'s reckless-violation definition (paragraph 4). Keep those defining clauses plain without suppressing unrelated operative paragraphs in either section.

After the six general-definition, seven external-reference and two inline-declaration occurrences, **89 raw contexts remain potential HMC-reference candidates**. This is a source classification, not a completed full-registry/rendered matcher result. An implementation would still need short phrase/count guards, the existing nine definition-section boundaries, actual-reference preservation tests, and all-active-entry collision checks. No aliases are proposed.

## Harassment

Original ID `e7eabb36ef1f70ffd848`, source §27-2004(a)(48), anchor `section-31001849`. The existing body has 45 paragraphs and 11,330 characters; SHA-256 `3c926c779378f57def8911099e20fd710e9c1a384e0ca512aff2db98277ae415`. Preserve it in full, including its opening “Except where otherwise provided,” all acts, omissions, qualifications, exceptions and closing provisions. Do not compress it to a generic prohibition or split off selected clauses as invented meanings.

| Section / source anchor | Raw occurrences | Scope evidence and disposition |
| --- | ---: | --- |
| §27-2004 / section-31001849 | 1 | General defining prose; plain. |
| §27-2093 / section-31001988 | 34 | Subdivision (a) expressly defines Harassment **for this section**, with its own five-item enumeration concerning single-room-occupancy multiple dwellings. One defining occurrence and 33 operative occurrences. General §27-2004 meaning is not a substitute here. |
| §27-2093.1 / section-31001989 | 75 | Subdivision (a) expressly states Harassment has the meaning in “subdivision 48 of section 27-2004.” Eleven occurrences belong to subdivision (a)'s definitions, including nested pilot-program-list exclusions; keep all defining prose plain. Sixty-four occur in operative text. |
| §27-2109.2 / section-31002009 | 1 | “findings of harassment currently on record” has no explicit single-source referral in that paragraph. Records could involve different statutory determinations; leave unresolved. |
| §27-2109.52 / section-31002011 | 1 | Inner word of “certification of no harassment”; do not use the general conduct definition to explain the whole certification. |
| §27-2115 / section-31002017 | 12 | Eight occurrences outside paragraph 67 are in the HMC harassment-claim/enforcement chain, including express §27-2004(a)(48) and §27-2005(d) references. Paragraph 67 has four occurrences and expressly combines §27-2093 **or** §27-2093.1 certification denials; retain as a separate unresolved mixed-scope case. |
| §27-2120 / section-31002022 | 1 | Injunctive relief expressly tied to a determination under §27-2005(d); a candidate for the full general meaning. |

### Distinct meanings and compounds

1. **§27-2093 is an exact section boundary.** A future general exclusion must not use existing prefix exclusion `27-2093`, which also suppresses separately numbered §27-2093.1. Use explicit exact-section semantics or an exact positive scope. A local alternative would require source extraction and validation of the complete local subdivision (a), plus its own exact scope. Neither is implemented by this audit.
2. **§27-2093.1 supplies strong affirmative source evidence**, but not every occurrence is an ordinary conduct reference. Of its 64 operative occurrences, 33 are inner words of “certification of no harassment,” one is in “certificate of no harassment,” and one is in the defined “tenant harassment prevention task force.” These 35 compounds should remain plain for a narrowly activated conduct definition. The remaining **29 operative contexts** are the strongest first-batch candidates for the unchanged general body.
3. The quoted and named declarations in §27-2093.1(a) are not popup opportunities. Its own Harassment referral paragraph contains the word twice; its Certification declaration contains it three times. Subdivision (a)'s nested list paragraphs also belong to the definitions even though they do not begin “The term.” Whole-section suppression would lose legitimate operative uses, while a simple declaration-prefix heuristic misses nested paragraphs.
4. §27-2115 paragraph 67 cannot be explained by silently choosing one of the two source meanings. Its first and third/fourth conduct references and inner certification reference concern an express two-path statutory relationship. Leave this block unlinked pending a deliberate presentation decision; do not invent a merged definition.

### Potential bounded follow-up

The narrowest evidence-backed first activation would use the full original general body only for the 29 reviewed ordinary contexts in §27-2093.1, with exact definition-span and compound exclusions. Eight §27-2115 contexts and one §27-2120 context are a separate, source-supported enforcement group to validate together. That yields **38 candidate contexts**, not an activation or acceptance count.

Before implementation: confirm the exact scope representation and short occurrence guards; test against the full active registry; preserve unrelated citation links; verify the long 45-paragraph popup can be read and dismissed in web and native compact presentation. Keep §27-2093's local alternative, generic recorded findings, mixed certification-denial paragraph, and all defining prose outside this initial group. No proposed wording changes or new definitions follow from this review.

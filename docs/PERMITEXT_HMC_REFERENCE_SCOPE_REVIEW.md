# HMC reference-term scope review

September 17, 2026. The initial source audit below is retained as historical evidence. **This code is now implemented, tested and published; Harassment remains withheld.** This review excludes the ten deferred authoritative-source references and Report work.

## Current status superseding the initial audit

This code was activated in product commit `e5e3fb5d65a5798b5fd040ecf9a5e76603a74313`. Production deployment `dpl_FkGWvK4PzbvRxuEpEc7V3F7oojp9` reached READY for that SHA, and the four public assets matched committed bytes (`/tmp/permitext-this-code-production-verification.json`). All 104 reviewed occurrences are covered: 89 accepted references and 15 exclusions. Verification includes 59 HMC JavaScript tests, 346 browser checks, two native tests and a generic iOS build 83. The linked-citation browser case is a synthetic fixture variant, because the authored paragraphs contain no anchors. Physical verification remains pending; no TestFlight release follows from this evidence. Later Hotel publication supersedes this deployment as the current production version.

The prospective wording in the This code sections below describes earlier checkpoints, not remaining implementation work. Harassment still requires its separate scope and full-popup verification before activation.

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

## This code matcher follow-up

The repository-owned `scripts/audit-hmc-this-code-applicability.mjs` now checks all five source hashes and the original identity/body, then tests a hypothetical scope against the complete production registry matcher. All 104 raw occurrences across 84 paragraphs agree with the reviewed classification: six general defining occurrences, seven external referrals, two inline declarations and 89 prospective HMC links. Exact referral phrases exclude external provisions without suppressing neighboring HMC uses in §27-2056.9. Full paragraphs, hashes and decoded ranges are recorded in `/tmp/permitext-hmc-this-code-proposal.json`.

The HMC suite passes 56 tests (`/tmp/permitext-hmc-this-code-audit-tests.log`), including mixed-section regression coverage. This code remains withheld in the product registry. Implementation still requires source-guarded generation, preservation of authored citation links through rendered decoration, native parity and popup verification. Harassment findings above remain unchanged.

## This code binding candidate

A source-guarded binding is implemented in `scripts/definition-sources/bind-hmc-this-code.mjs`, but is not yet connected to registry generation. It re-extracts item 47 from the hash-guarded source and rejects missing/duplicate entries, changed bodies, aliases or source locations. Compilation preserves the published ID, full body and citation. Testing the compiled binding inside the full current registry reproduces every reviewed boundary and all 89 candidate links. The HMC suite passes 59 tests (`/tmp/permitext-hmc-this-code-binding-tests.log`). Generator integration, authored-link rendering checks and native verification remain pending; no product activation or deployment follows from this checkpoint.

## Harassment reproducible source inventory

The repository-owned `permitext-sync-server/scripts/audit-hmc-harassment-applicability.mjs` now reproduces all 125 occurrences across 62 paragraphs from all five hash-guarded HMC chapters. It verifies the unchanged original ID, source location and complete 45-paragraph body, including independent extraction from enacted source. The report records full paragraphs, UTF-16 ranges, source offsets and hashes; `/tmp/permitext-hmc-harassment-proposal.json` is a generated output, not the only copy of the audit logic.

Classification yields 38 source-supported candidates and 87 exclusions: one general definition, one local declaration, 33 local-meaning applications, 11 nested defining occurrences, 35 certification compounds across both relevant sections, one task-force compound, one unresolved recorded finding and four mixed-scope occurrences. Definition-span classification takes precedence over compound classification. Exact section comparison keeps §27-2093 separate from §27-2093.1.

This is source-inventory evidence only. No registry activation, rendered match count, popup acceptance or physical verification is claimed. Full-registry matching, source-guarded binding and complete long-popup verification remain necessary.

Ten focused tests pass (`/tmp/permitext-hmc-harassment-audit-tests.log`), including deliberate changes to each of the five source chapters, the original body, ID and duplicate entry. The complete HMC suite passes 75 tests (`/tmp/permitext-hmc-harassment-all-tests.log`).

## Harassment hypothetical matcher and web presentation

`audit-hmc-harassment-matcher.mjs` tests the proposed entry within the complete current registry. Existing metadata represents all 38 reviewed candidates (29 in §27-2093.1, eight in §27-2115, one in §27-2120) and excludes all other 87 occurrences. Eleven source-attested phrase entries protect nested declarations, certification/task-force compounds and the mixed enforcement paragraph. No competing definition matches change. Six focused tests pass, including negative controls that remove guards and expose the two declaration-header occurrences and four mixed-scope occurrences. All 81 HMC tests pass (`/tmp/permitext-hmc-harassment-matcher-all-tests.log`); detailed report: `/tmp/permitext-hmc-harassment-matcher.json`.

The local browser fixture passes 356 checks, including six new presentation-only checks using the unchanged withheld entry. It confirms the exact 11,330-character/45-paragraph body, bounded scrolling, bottom citation reachability, Close/focus return and Escape/focus return. The parent visually inspected the opening paragraph and final paragraphs/citation at 1280×720, scrolled the popup to its bottom (scrollTop 5839, clientHeight 418, scrollHeight 6257), and verified actual Escape dismissal returned focus to Harassment. This fixture explicitly bypasses applicability for presentation; it does not prove rendered source matching or product activation. Close scrolls out of view at the bottom; Escape works, but persistent Close visibility remains a usability follow-up before enabling this long definition. Native compact presentation, binding/generation and physical checks remain open.


## September 17 — Persistent definition Close and Harassment binding

The web definition popup now keeps Close in a sticky control strip while the complete text scrolls. The shared iOS WebView component was regenerated; native SwiftUI already keeps Close outside its ScrollView. The browser fixture passes 357 checks, including bottom-of-popup hit testing. The parent inspected the final paragraphs and citation with Close visible and clicked it successfully, restoring focus to the original term. The initial new hit-test failed because the synthetic trigger was offscreen; the fixture now scrolls the trigger into view before opening, matching the tested user flow. Definitions v78, Reader v485 and shell v1137 invalidate cached web assets. This does not constitute native or physical acceptance.

A source-guarded Harassment binding now preserves the full original ID, source, aliases and 45-paragraph body and compiles the reviewed 38 accepted/87 excluded occurrence rules. All 85 HMC tests pass (`/tmp/permitext-hmc-harassment-binding-all-tests.log`). It is not wired into generation, so Harassment remains withheld. Registry activation, actual-source rendered verification and native compact verification remain open. No phone interaction or TestFlight release occurred. Popup product commit `900e78a02f933e9ecc259f1620f0cde9259e4e63` is pushed to main. Production `dpl_2Cftc15N1dqHxWFFCHEMMntYwpSy` is READY for that exact SHA; five public assets match committed bytes (`/tmp/permitext-sticky-close-production-verification.json`). Generic iOS build 83 passed (`/tmp/permitext-build83-sticky-close.log`), and its bundled WebView matches source at SHA-256 `3ef775a80229144fd9b80b2031c3db5188b727d64cdf8452aac0b4fcf2a92a25`. UX alignment, offline checks and shared WebView parity pass. The generic build was not installed on the phone.

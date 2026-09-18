# Title 26 Chapter 24 buyout definition review

Current local checkpoint: all three source-verified meanings are enabled only for physical chapter 30000042 and exact application sections 26-2401, 26-2403, 26-2404 and 26-2405. Section 26-2402 is excluded. Only the three reviewed entries changed; all definition bodies and sources are unchanged. The full inventory remains 5,667 entries in 24 sources. Web fixture: 543 checks passed; Buyout popup full body, citation, Close and focus return visually inspected. Native actual-registry unit passed on physical development build 87 (0.038 seconds). Physical popup test passed in 40.987 seconds; exported source, complete popup/citation and returned-source screenshots were inspected in `/tmp/permitext-buyout-native-review`. The full meaning fits and the source viewport returns within the fresh ±4-point test bound. Normal Permitext was relaunched without fixture arguments. Product commit `f843c1d71` is deployed: Production `dpl_AafJuyNZzz5B1rqz9fFpzybARjVH` is READY and eight live assets match exactly. TestFlight remains 84; no TestFlight 87 upload.

2026-09-17. Local-corpus extraction and applicability review. The earlier index-only checkpoint kept all three meanings `review-required`; the current bounded activation follows the occurrence review below. This does not establish current external legal currency.

## Source and full-body boundaries

Exact source: `2026-enacted-administrative-code/chapters/30000042.html`, Title 26 (`codeSectionID: 3`), physical chapter `30000042`, printed chapter 24. SHA-256: `32cc5551c717fb978a5532c69e44bc6d8ec0ac9922b07f6f9689b751cb17e3af`.

Section 26-2402, anchor `section-31000822`, says “As used in this chapter:” and supplies three sentence-label definitions. Each occupies exactly one complete paragraph; no continuation clauses follow. The existing targeted sentence parser preserves the full buyout surrender/waiver and vacating condition and both agency definitions' successor clauses. It excludes the introductory scope paragraph and the following legislative history. No source wording is rewritten or shortened.

- **Buyout agreement:** agreement exchanging money or other valuable consideration to induce a lawfully entitled occupant to surrender or waive occupancy rights, resulting in the tenant vacating the unit. Exact wording is asserted in the test.
- **Commissioner:** commissioner of housing preservation and development and any successor thereto.
- **Department:** department of housing preservation and development and any successor thereto.

## Exhaustive occurrence inventory

Counts cover every paragraph in the physical chapter, case-insensitively with singular/plural word boundaries. Headings are separately excluded, as they are not application prose. Repeated labels and quoted labels inside definitions count as occurrences, but must never become links.

| Section | Buyout agreement | Buyout agreements | Commissioner | Commissioners | Department | Departments |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 26-2401 Application | 0 | 1 | 0 | 0 | 0 | 0 |
| 26-2402 Definitions (excluded) | 2 | 0 | 3 | 0 | 3 | 0 |
| 26-2403 Owner filing requirements | 4 | 0 | 1 | 0 | 2 | 0 |
| 26-2404 Reporting requirements | 0 | 1 | 1 | 0 | 0 | 0 |
| 26-2405 Penalties and enforcement | 1 | 0 | 0 | 0 | 0 | 0 |
| Total paragraphs | 7 | 2 | 5 | 0 | 5 | 0 |
| Application paragraphs only | 5 | 2 | 2 | 0 | 2 | 0 |

All eleven application ranges were reviewed: §26-2401's plural defines the chapter's application; §26-2403's opening has one buyout, one commissioner, and two department references, followed by one buyout reference in each of items 2, 3 and 4; §26-2404's opening has one commissioner and one plural buyout; §26-2405 has one buyout. No other paragraphs contain these terms. The chapter title contains singular Buyout Agreement and §26-2404's heading contains Department; neither is counted as a paragraph or a link target.

## Scope conclusion and negatives

All three definitions are suitable for **this exact physical chapter's application prose**, with §26-2402 excluded. The plural “buyout agreements” is source-attested twice. No plural commissioners or departments occurs, so no independent plural activation is proposed for those terms. Neither another named department nor another named commissioner occurs in this chapter's application prose. “Commissioner of the department” refers to the two locally defined HPD offices and is consistent with both meanings.

Generic agency labels recur elsewhere with different meanings: Title 25 chapter 8 defines Commissioner and Department as citywide administrative services, and Title 26 chapter 36's §26-3601 uses a buildings-department meaning. They must not inherit this HPD definition. Exact bundle, code section, and physical chapter identity—not printed chapter number alone—must bound integration. No propagation to Title 27, other Title 26 chapters, definition paragraphs, headings, quotations outside this reviewed source, or other editions is approved by this review. The reference to §27-2115 in §26-2405 does not extend this chapter's meanings into that external section.

## Effective-date evidence and limits

Section 26-2401 limits the chapter to buyout agreements executed on or after its effective date. Each of the five sections carries `(L.L. 2019/102, 6/8/2019, eff. 7/1/2020)`. This is the local corpus's express temporal restriction. Extraction must preserve that application section; it does not authorize applying these filing obligations to earlier agreements. This review does not independently verify current law or amend the corpus's stated currency.

## Reproduction

`node --test permitext-sync-server/tests/title26-buyout-definitions.mjs`

Tests verify complete exact bodies, provenance, exact activation boundaries, full-source hash rejection, exact chapter identity, every paragraph occurrence count, definition exclusion, and local effective-date text. Web and native registry acceptance are recorded above; physical Buyout popup acceptance is recorded above.

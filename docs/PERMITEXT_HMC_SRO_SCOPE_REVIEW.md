# HMC Single room occupancy scope review

September 17, 2026. Read-only source and full-registry proposal audit. **No applicability activation, new definition, source rewrite, Xcode run, or phone interaction.** The ten deferred authoritative-source entries and Report work remain outside this review.

## Original meaning and evidence boundary

Preserve entry `eaab3c85f92d400bb0c5`, `Single room occupancy`, with no aliases. It comes from HMC §27-2004(a)(17), `2026-enacted-administrative-code/chapters/30000077.html#section-31001849`. Full-body SHA-256: `f471028ef30a2efea12f6c19d99dac7a5602aa4e5dd7cb434b19c4bc67d6b1cc`.

The complete existing body must remain:

> Single room occupancy is the occupancy by one or two persons of a single room, or of two or more rooms which are joined together, separated from all other rooms within an apartment in a multiple dwelling, so that the occupant or occupants thereof reside separately and independently of the other occupant or occupants of the same apartment. When a class A multiple dwelling is used wholly or in part for single room occupancy, it remains a class A multiple dwelling.

The second sentence is material source content; do not reduce the entry to its first sentence, or convert the general occupancy description into a definition of every SRO building, unit, program or organization.

The portable audit is `permitext-sync-server/scripts/audit-hmc-sro-applicability.mjs`. Run from the repository root:

```sh
node permitext-sync-server/scripts/audit-hmc-sro-applicability.mjs /tmp/permitext-hmc-sro-proposal.json
```

It guards the existing ID/body/citation/no-alias identity and all five enacted HMC source hashes using `hmcGeneralSourceHashes`. It reads current registry entries, changes only an in-memory copy for the proposal, runs the production registry selection and matcher against the complete active entry set, and writes the requested evidence JSON. No registry or source output is written. JSON records original/proposed metadata, source hashes, section/anchor, paragraph and source-HTML offsets, full paragraph/hash, exact UTF-16 occurrences and prospective matches.

## Complete exact-label occurrence inventory

The five chapters contain **29 raw exact-label occurrences in 23 paragraphs**. Two are within the general definition itself, leaving the requested **27 contexts outside §27-2004**. These counts cover case-insensitive “single room occupancy” with whitespace normalization and Unicode word boundaries in source paragraphs; headings, SRO abbreviations, hyphenated spelling variants, or inferred aliases are not claimed.

| Location | Raw count | Classification |
| --- | ---: | --- |
| §27-2004 | 2 | General definition; plain |
| §27-2012 | 1 | Ordinary application candidate |
| §27-2051 | 1 | Ordinary application candidate |
| §27-2067 | 1 | Ordinary application candidate |
| §27-2074 | 1 | Ordinary application candidate |
| §27-2075 | 1 | Ordinary application candidate |
| §27-2078 | 1 | Ordinary application candidate |
| §27-2079 | 1 | Ordinary application candidate |
| §27-2080 | 2 | Ordinary application candidates |
| §27-2093 | 3 | Locally imported compound building category |
| §27-2093.1 | 1 | Inside a local definition's nested exclusion list |
| §27-2140 | 1 | Express external-law-qualified use; unresolved |
| §27-2150 | 2 | Imported category definitions; plain |
| §27-2151 | 8 | Operative imported building/unit categories |
| §27-2152 | 2 | Operative imported dwelling-unit category |
| §27-2152 | 1 | Named housing development fund company |
| **Total** | **29** | **9 prospective ordinary links; 20 withheld** |

By chapter the raw counts are 2, 2, 7, 4 and 14. After excluding the two general-definition occurrences, the 27 remaining contexts divide into nine ordinary candidates and eighteen contexts not accepted for the general popup.

## Nine ordinary candidates

Exact reviewed section list: **27-2012, 27-2051, 27-2067, 27-2074, 27-2075, 27-2078, 27-2079, 27-2080**. These occur only in HMC subchapters 2 and 3.

- §§27-2012(b) and 27-2051 use a multiple dwelling **used for** single room occupancy, concerning cleaning and management duties. The general entry expressly addresses a class A multiple dwelling used wholly or partly for that occupancy; these are not the adjacent noun phrase “single room occupancy multiple dwelling.”
- §§27-2067(a) and 27-2079 refer to individual apartments **used for** single room occupancy when prescribing sanitary facilities.
- §27-2074(e)(1) supplies a room-area requirement for a room **used for** single room occupancy.
- §27-2075(a)(2) uses “in a single room occupancy” in the rooming-unit occupancy/area rule. It is a bounded application candidate for the unchanged general occupancy meaning, not a newly supplied building-category definition.
- §27-2078(b) classifies the described rental as use of an apartment for single room occupancy and separately addresses unlawful rooming-unit use in a converted dwelling. This is an operative application rule; it does not replace the general source paragraph.
- §27-2080 uses the phrase twice for rooms used for single room occupancy in the tenant-register requirement.

The audit's in-memory scope uses only these eight sections and chapters 2/3, alongside the existing HMC definition exclusions. All nine expected occurrences are returned by the full production matcher. No ordinary candidate needs a phrase exclusion within this limited scope. Existing `applicableSections` semantics include dotted descendants; the source-hash guards and audited finite corpus bound this proposal. A future newly numbered section must be reviewed rather than assumed accepted.

## Imported categories, compounds and unresolved boundaries

### §27-2093: three occurrences, no general fallback

Source `30000080.html`, `section-31001988`:

- Paragraph 0 / subdivision (a): “single room occupancy multiple dwelling” occurs inside the local Harassment definition introduction. Keep defining prose plain.
- Paragraph 5 / subdivision (b): the same compound occurs in the ownership presumptions.
- Paragraph 6 / subdivision (c): the compound expressly refers to its meaning in **§27-198, article nineteen of subchapter one of the Building Code**.

The latter is positive evidence of an imported **building category**, not authorization to apply the general HMC occupancy paragraph to the shorter words inside it. Keep all three outside the initial scope. Any future local category would need its complete actual referred source and separate applicability; do not synthesize it from the HMC general paragraph.

### §27-2093.1: one occurrence in defining prose

Source `30000080.html`, `section-31001989`, paragraph 15: the “single room occupancy multiple dwelling” phrase is in subdivision (a)'s **Pilot program list** definition, nested exception (2), concerning approved rehabilitation/preservation programs. This is not operative prose merely because the paragraph starts with a list marker. Leave it plain. Do not use prefix exclusion `27-2093` to reason about §27-2093.1; they are separately numbered sections with different contexts.

### §27-2140: external qualification, unresolved

Source `30000081.html`, paragraph 3 / subdivision (d): the violation rule covers a class B multiple dwelling or a class A multiple dwelling used for single room occupancy **pursuant to §248 of the Multiple Dwelling Law**. The general HMC paragraph and this qualified external provision cannot be assumed interchangeable from this source alone. Keep this one occurrence withheld in the initial batch. This is uncertainty about popup applicability, not a finding that the enacted text is erroneous.

### Article 9: §§27-2150–27-2152

Source `30000081.html`:

- §27-2150 expressly imports **single room occupancy multiple dwelling** and **single room occupancy dwelling unit** from **§27-198.2(b)** for this article. Both defining occurrences remain plain.
- §27-2151 has eight occurrences in those building/unit categories, with further explicit §27-198.2 qualifications. The general occupancy entry must not match inside these compounds if a longer category is absent or later excluded.
- §27-2152 has two operative **single room occupancy dwelling unit** occurrences, in paragraphs 5 and 6. Preserve the Article 9 imported-category boundary.
- §27-2152 paragraph 9 names the **single room occupancy housing development fund company**, established under §27-198.2(i). This is an organization name, not the general occupancy meaning.

These thirteen Article 9 occurrences require their own source/category work or must stay plain. Broad whole-chapter activation of the general term would misrepresent them.

## Status and next decision

The portable audit ran successfully: 29 raw occurrences, 23 paragraphs, **9 prospective full-registry matches**, with all reviewed negatives remaining unmatched. This is source/matcher proposal evidence only. The existing entry remains `review-required`; no rendered web/native or physical acceptance is claimed.

A bounded future implementation could retain the exact original body/ID and enable only the eight reviewed sections above, with hash guards and actual-source positive/negative tests. Do not silently broaden to all HMC chapters, add SRO aliases, or substitute this entry for the imported §27-198/§27-198.2 categories. The §248-qualified occurrence remains a separate unresolved scope decision.

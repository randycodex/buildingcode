# Construction-related Local Law definition source review

September 17, 2026. Source inventory only. No registry activation, amendment consolidation, or legal-currency determination.

The earlier heading-only discovery found no Definitions headings in 39 annual files. That did not establish absence of definitions. The new paragraph-level inventory finds **89 candidate paragraphs across 32 individual laws**, including **51 explicit quoted-label declarations in 13 laws**. It also retains an unquoted Disaster Recovery Area declaration. These are lexical retrieval counts, not a claim that all definitions have been extracted or that every candidate is a definition.

Run from the repository root:

```sh
node permitext-sync-server/scripts/audit-local-law-definition-sources.mjs /tmp/permitext-local-law-source-inventory.json
node --test permitext-sync-server/tests/local-law-definition-source-audit.mjs
```

Every annual file retains its ID and SHA-256. Each candidate law retains its exact printed identity, source anchor, entire decoded paragraph sequence, local section numbers, original HTML offsets and paragraph hashes. Noncandidate paragraphs remain available for continuation, scope, amendment and effective-date review. Source hashes describe the audited bytes; they are provenance, not a claim that legal applicability was approved.

## Concrete boundaries found in the bundled sources

- **L.L. 2021/012 and 2021/137:** both define Certification form, Commissioner and Department in section 1 of the same annual chapter. The Certification form bodies differ. Annual chapter identity and a bare section number cannot distinguish these meanings; the individual law identity is required as well.
- **L.L. 2019/049:** Program area continues through numbered exclusions and a long geographic boundary sequence. A one-paragraph extraction would omit material source wording. The same law's 1968 building code entry refers to §28-101.5; it is a referral, not a directly supplied definition. Other terms are imported by subdivision 1(a), subject to 1(b)'s definitions.
- **L.L. 2013/031:** Disaster Recovery Area is unquoted and followed by two geographic alternatives. Section 7 of this source expressly says sections 1–5 are deemed repealed after December 31, 2013. Inventorying that historical source does not authorize presenting it as current generally applicable law.
- **L.L. 2026/060:** Merchant association, Neighborhood association and Supplemental sanitation service provider are introduced only for section 2. Do not extend them through the 2026 annual chapter or even all provisions of this individual law.
- **L.L. 2025/036:** Administering agency, Eligible building and Official waste container are introduced for this local law. The surrounding source retains its applicability and expiration language for further review.
- Consolidated provisions are expressly omitted from some annual-law excerpts. Neither omission nor a title mentioning a definition supplies the missing definition body. Preserve explicit referrals to the reviewed enacted collection; do not reconstruct deleted/added wording from snippets.

## Explicit quoted-label declaration inventory

| Local law | Declaration count |
| --- | ---: |
| 2016/136 | 2 |
| 2017/013 | 1 |
| 2019/028 | 9 |
| 2019/049 | 9 |
| 2021/005 | 5 |
| 2021/012 | 3 |
| 2021/101 | 1 |
| 2021/112 | 6 |
| 2021/137 | 3 |
| 2021/158 | 4 |
| 2023/157 | 2 |
| 2025/036 | 3 |
| 2026/060 | 3 |

The complete report includes labels and context; identical labels in different laws remain separate. The other 19 retrieved laws include source references, ordinary uses of “means,” amendment descriptions and other contextual hits. Those hits are not silently converted into definitions.

Four focused actual-corpus tests passed: 39-file source-range retention; different same-year Certification form bodies; retained continuation/repeal text; and section-only versus law-wide introductions. Tests verify source inventory, not rendered linking or official legal interpretation.

Remaining: classify every candidate paragraph and additional declaration format; approve full extraction boundaries; review historical/effective scope and exact referrals; implement individual-law and subsection applicability with older-client compatibility; then verify web/native rendered behavior. All existing registry data and the ten deferred unresolved source entries remain unchanged.

# Title 26 chapters 25–27 definition review

September 17, 2026. Local authored-corpus review. Twelve full definitions are extracted through exact chapter and whole-file SHA guards. They remain `review-required`: this checkpoint does not activate Reader links or claim current external legal currency.

## Source bindings

All sources are in `2026-enacted-administrative-code/chapters/`, Title 26 (`codeSectionID: 3`).

| Chapter ID / printed chapter | Definition section / anchor | File SHA-256 |
| --- | --- | --- |
| 30000043 / 25 | 26-2501 / section-31000826 | efa3dd7cff3431a9f67423d2508f016a271ad401a06e3f05f2a1fac51325c27c |
| 30000044 / 26 | 26-2601 / section-31000829 | 189643c16c9f7c8dfd5d93a85d308bd9e8e1e579b35573334397e158c415577f |
| 30000045 / 27 | 26-2701 / section-31000831 | 71b2911888d15134f0017f1b4f854d4337dcc01c6e4d94ede358b9c485a4edb3 |
| 30000041 / 22, referral target only | 26-2201 / section-31000816 | c5a7ba368cc8db09638569105e4fb5c99626e6b7fbe1b7390fbe46af49cce4dc |

Each definition is one complete paragraph. Chapter 25's inline scope/declaration paragraph is preserved whole. Chapters 26 and 27 use repeated sentence labels. Legislative-history paragraphs are excluded from bodies. Exact full bodies are asserted in `title26-housing-reporting-definitions.mjs`; no source HTML is rewritten.

## Chapter 25: Certifications of correction

One defined term: Certification of correction. Its complete body covers a paper or electronic document, filing with either DOB or HPD, filing by a property owner or managing agent, affirmation of correction of cited violating conditions, and the required timeframe.

Seven application occurrences: two plurals in §26-2502; two singulars and three plurals in §26-2503. The section and chapter headings contain additional plurals that must remain plain. “False certification” is not an approved alias. This chapter has both DOB and HPD but no generic Department definition; it must not inherit a single agency meaning from neighboring chapters.

Proposed scope: exact physical chapter 30000043 and sections 26-2502/26-2503, excluding 26-2501. Source-attested alias: certifications of correction.

## Chapter 26: Affordable housing placements

Eight defined terms: Affordable housing unit; Area median income; Department; Extremely low income household; Low income household; Middle income household; Moderate income household; Very low income household.

Affordable housing unit explicitly imports §26-2201. The resolved record retains the exact original referral in `referenceText`, the complete target paragraph, and the actual chapter-22 citation. Both target conditions remain: affordability restrictions under the listed law/program/agreement, **and** operation pursuant to an agreement administered by the department. The target file is independently hash-guarded; modified or missing target evidence fails extraction. The other chapter-22 definitions are not indexed by this binding.

Seventeen application ranges, all in §26-2602: nine Affordable housing unit(s), three Department, and one plural of each of the five income-household labels. Area median income has no application occurrence and stays withheld. The direct definitions retain the household-size qualification and their distinct income boundaries: ≤30%, >30–50%, >50–80%, >80–120%, and >120–165%.

The shorter “low income households” appears lexically three times, but twice as a suffix of Extremely/Very low income households. A review-only full matcher test proves only the independent occurrence receives the shorter meaning, with longest phrases retaining their own entries. All aliases remain proposals until activation.

The definition section also names the United States department of housing and urban development; it must not receive the HPD meaning. All three application-section Department occurrences are HPD. Proposed scope is physical chapter 30000044, exact §26-2602, excluding 26-2601. No definition-within-definition links are allowed.

## Chapter 27: Mitchell-Lama development reporting

Three defined terms: Department; Mitchell-Lama development; Waiting list. Complete bodies retain the private housing finance law article-two requirement and departmental supervision, and the managing agent's processing of potential tenants or shareholders for subsequent occupancies.

Eleven application ranges in §26-2702: one Department, two Mitchell-Lama development(s), and eight Waiting list(s). Headings contain additional terms and stay plain. Source-attested plural aliases: Mitchell-Lama developments and waiting lists; other dash variants are not established by this source. No competing agency meaning occurs in application prose.

Proposed scope is exact physical chapter 30000045 and §26-2702, excluding 26-2701. Digitization and housing-portal incorporation restrict the report population; they do not redefine Mitchell-Lama development or Waiting list.

## Verification and remaining acceptance

`node --test permitext-sync-server/tests/title26-housing-reporting-definitions.mjs`

Five tests passed: all twelve complete source declarations; source/identity drift rejection; referral compilation with both substantive conditions, original referral and actual citation; a review-only matcher proposal covering all 35 application ranges without phrase-suffix collisions; and exact shared web/native published records with inactive selection. That proposal is not production activation. The full targeted regression suite passes 83 checks and both offline contracts pass. All 5,667 prior published entries compare unchanged; the inventory is now 27 sources / 5,679 entries. No new physical build, rendered popup acceptance, or TestFlight release is claimed for these twelve entries.

All three chapters expressly give chapter-local scope. Reporting deadlines and historical reporting periods affect duties, not definition activation dates. No definition-specific expiry appears in these three source files. This audit does not independently verify their external currency.

# Permitext Zoning Research — Case 23 applicability audit

Date: August 30, 2026

Status: **NO-COST OFFICIAL-SOURCE RE-AUDIT COMPLETE; NEW OWNER SCOPE DECISION REQUIRED**

This audit corrects the earlier recommendation for `zr-candidate-b1-deep-through-lot-vertical-yard`. It changes no frozen cohort, retained result, price, allowance, deployment, or public setting. It used current official NYC Zoning Resolution text and the already imported governed corpus. No provider call was made.

## Stated facts

The question states a 200-foot-deep through lot in R7A with **residential wings** facing both streets, a 30-foot-wide open area between them, and wings rising to 100 feet. It does **not** state whether the building or zoning lot also contains a community-facility use. Silence about that fact cannot be treated as proof that the lot is residential-only.

## Current official provisions

- [ZR 23-01](https://zr.planning.nyc.gov/article-ii/chapter-3/23-01) applies Chapter 3 bulk regulations to residential buildings and residential portions of mixed-use buildings. Governed section ID: `20017996`.
- [ZR 24-01](https://zr.planning.nyc.gov/article-ii/chapter-4/24-01) applies Chapter 4 to community-facility buildings or portions, while directing residential buildings or portions to Chapter 3 unless specifically modified or incorporated by cross-reference. Governed section ID: `20017622`.
- [ZR 23-343](https://zr.planning.nyc.gov/article-ii/chapter-3/23-343) supplies the residential through-lot rear-yard-equivalent branch. At 190 feet or more in depth, it requires 40 feet at or below 75 feet, 60 feet above 75 feet, and a standard location midway or within 10 feet of midway. Governed section ID: `20018060`.
- [ZR 24-31](https://zr.planning.nyc.gov/article-ii/chapter-4/24-31) makes Chapter 4 side- and rear-yard rules material on zoning lots containing both residential and community-facility uses. The frozen question does not resolve whether that condition exists.
- [ZR 24-382](https://zr.planning.nyc.gov/article-ii/chapter-4/24-382) exists and is current. For the listed districts, including R7A, it contains the Chapter 4 branch requiring its 60-foot paragraph (a) option on through lots at least 180 feet deep, with a standard location midway or within five feet of midway. Governed section ID: `20017661`.

Both ZR 23-343 and ZR 24-382 were last amended December 5, 2024. The issue is applicability, not staleness or absence.

## Source-bound conclusion

The selected evidence supports the ZR 23-343 **residential-only branch**, but the question as written does not establish that it is the only applicable branch. Assuming the building and zoning lot contain no community-facility use:

- if 30 feet is the regulated depth, the open area is 10 feet deficient at and below 75 feet because 40 feet is required;
- it is 30 feet deficient above 75 feet because 60 feet is required;
- the upper 25 feet of each 100-foot wing is in the above-75-foot tier; and
- the standard location is midway or within 10 feet of midway between the street lines.

If the lot also contains a community-facility use, ZR 24-31 can make the Chapter 4 path material and ZR 24-382 may instead supply a 60-foot rule with a five-foot midpoint tolerance. Under either apparent branch, 30 feet is insufficient if 30 feet is the legally measured depth; however, the lower-height deficiency, height-tier statement, and midpoint tolerance differ by branch.

The plans still must establish that the stated 30-foot width is the required depth measured in the legally relevant direction, the qualifying through-lot geometry, the absence or effect of listed exceptions, permitted obstructions, and any special-district modification. The selected evidence set does not contain ZR 23-01, 24-01, 24-31, or 24-382 and therefore cannot grade a detailed Chapter 4 applicability analysis.

## Why the earlier recommendation was wrong

The earlier review compared the numeric rules in ZR 23-343 and ZR 24-382 but did not test their parent chapters' applicability provisions. It therefore treated the more district-specific wording in ZR 24-382 as unconditionally controlling. The expanded answer that introduced ZR 24-382 had retrieved an unselected cross-reference; the later successor then encoded that answer into its key without adding or evaluating Chapter 4 applicability.

The first version of this audit overcorrected in the other direction by treating the question's silence about community-facility use as proof of residential-only status. The official ZR 24-31 mixed-use rule makes that inference unsafe. This re-audit records the missing use fact instead of choosing a branch that the frozen question does not uniquely establish.

The explicit-answer-key/evidence preflight correctly blocks this case because its key names unselected ZR 24-382. A later bare-section parser hardening found two additional frozen-key mismatches, so current full-successor preflight is 27/30. Those blocks prevent a further paid run. The frozen parent, successor, approval record, and paid results remain historical evidence and are not rewritten.

## Recommended owner disposition

Two internally coherent dispositions are available:

1. **Recommended narrow residential case:** append one explicit fact to the question: `The building and zoning lot contain no community-facility use.` Then replace only Case 23's ZR 24-382 expected conclusion and required concepts with the ZR 23-343 residential result above. Preserve its selected evidence (`ZR 12-10` and `ZR 23-343`), existing forbidden claims, every other question fact, and all other cases. Do not grade a detailed Chapter 4 claim from evidence that was not selected.
2. **Broader applicability case:** preserve the ambiguous question, add ZR 23-01, 24-01, 24-31, and 24-382 to selected evidence, and revise the expected conclusion, required concepts, missing facts, and forbidden claims to evaluate both branches. This is a materially larger case redesign.

The existing forbidden claim against saying the same depth applies at every height is coherent in the recommended ZR 23-343 residential case, but it can conflict with the single-depth Chapter 4 branch. That is why the mixed-use boundary cannot simply be added to the old key while all forbidden claims remain unchanged.

Either option is a substantive case correction and requires a new explicit owner approval. No correction has been applied. This is not professional zoning sign-off, public enablement, deployment authorization, or paid-run authorization.

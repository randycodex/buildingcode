# Final local research checks — October 5, 2026

The requested last round is complete and did not pass its acceptance criteria. One frozen cohort attempted all 40 questions in 20 paired conversations through the normal isolated local backend and native Responses. A separate Luna medium reviewer graded every turn once against the user's supplied reviewed references. Its raw result was **19/40 fully correct**. These are provisional model grades, not expert-certified application accuracy. There was no application rerun or paid grading retry.

All 40 requests returned HTTP 200, but five delivered a processing or unavailable-answer notice: reserved plumbing record turn 1, environmental-exhaust turn 1, MP-regulator turn 1, permit-basis turn 1, and plaza-fountain turn 2. The other 35 used the substantive answer mode. HTTP success and internal verification were not treated as correctness scores.

The reviewer also flagged missing material conditions, missing explicit uncertainty caveats, dependency coverage gaps, and a historical follow-up that switched from the requested Administrative Code provision to an unrelated Building Code provision after the first answer failed. These are different problems; the 21 failed grading rows should not all be described as invented legal rules. The complete unchanged answers and individual judgments are saved in the two `results.json` files linked below.

## Grading limits

At least one source-limitation judgment conflated the grader's reference packet with the application's actual evidence. For relief-discharge turn 1, the grader had the full PC605.4 materials table, while the application's writer and review inputs recorded it as a missing reference. The application's statement that it had not received the material list is therefore not proven false by the grader-only table. The omitted material coverage still fails the frozen required-concept check. This distinction and exact request hashes are recorded in `final-check-report.json`; the raw grade was preserved rather than silently rewritten.

Several other failures concern an explicit uncertainty sentence that the rubric requires even when an answer states the rule and its remaining conditions. These judgments require substantive human assessment before anyone treats the raw count as application accuracy. No rubric, question or generated answer was changed after seeing the results.

The grading preflight resolved 25 full reference snapshots and additional exact cited records. Three dictionary citations used complete definition entries validated through the existing canonical binder, retaining the published citation, storage-carrier identity, whole-carrier hash, entry hashes and offsets. Seven altered, shortened or foreign-authority variants were rejected. No dictionary condition was clipped to fit the 48,000-character grading ceiling. This was evaluation mechanics; application retrieval and answers were unchanged.

## Validation and budget

Seven selected final offline contracts passed, covering grading completeness/material hard failures, source-body state, actual source-state request envelopes, repair-introduced parents through HTTP with synthetic providers, citation revision bindings, durable spending controls, and canonical definition citation replay. The previous 15 application contracts remain recorded separately. Application runtime hashes matched the frozen candidate throughout the cohort. The 40 questions and all user-supplied reference criteria were preserved verbatim and stayed outside application drafting, review and repair contexts.

Generation roles were Luna low drafts, medium reviews and high repairs, with no Sol fallback. The application used 159 paid requests: 118 generation/review/repair calls and 41 query-embedding calls. Grading used 20 separately prompted Luna medium calls. The local test account had an isolated lifetime grant; this did not test a production subscription or browser.

Estimated round API usage was **$0.884635615**: $0.796533365 for the application cohort and $0.088102250 for grading. The campaign ledger now estimates **$2.896987810**, within the unchanged **$10.99** cap: $1.126637600 diagnostics and $1.770350210 fresh evaluation. The prior 399 ledger entries are unchanged. There are 578 entries: 576 settled, two old authentication rejections, and no pending or unknown calls. Actual billing deductions were not verified. Final ledger SHA-256: `42c07b50c36b7f2e54ee29f88adf9f168594e1be4096bf34628bb6e4177537b1`.

The original frozen **35/40** and separate exploratory **9/10** remain separate and unchanged. This new cohort is also separate; it does not establish 95% general accuracy.

## Saved evidence and remaining limits

- [Machine-readable final report](final-check-report.json)
- [Frozen questions and reviewed rubric](final-check-fixture.json)
- [Application answers, usage and runtime hashes](final-local-native-cohort-20261005/results.json)
- [Separate model grades and usage](final-separate-luna-grading-20261005/results.json)
- [Canonical grading sources and definition bindings](final-separate-luna-grading-20261005/sources.json)

Missing dependency coverage, non-answer delivery, historical follow-up continuity, and the reported omissions remain unresolved. The original PC802.3.2 flush-hub and ZR37-34 sloped-sidewalk disputes also remain unresolved. Hosted native Responses, production browser/subscription behavior and actual billing deductions remain unverified. No deployment or push was performed. Work stops after this round; no additional repair-and-paid-retest loop was started.

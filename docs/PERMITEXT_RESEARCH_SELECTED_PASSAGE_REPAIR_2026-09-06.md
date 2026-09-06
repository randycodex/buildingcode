# Selected-passage Research routing repair — September 6, 2026

Status: both source-routing repairs are published in PR #57, Production
`4ed4b5b9f4eba77683af8aedb4f38fc3e0b4421e`. The separately approved live
confirmation completed with 2014-only sources and no web lookup. Full handoff
acceptance remains open for the findings in the
[September 6 confirmation](./PERMITEXT_RESEARCH_HANDOFF_CONFIRMATION_2026-09-06.md).
The local implementation itself made no provider call; focused contracts,
isolated HTTP save/reopen, full check and smoke passed before publication.

This continues the original 17-finding production-readiness audit, particularly
P0-1 source identity and the P0-2/P1-1/P2-2 professional handoff. The preceding
[deployed confirmation](./PERMITEXT_RESEARCH_HANDOFF_ACCEPTANCE_2026-09-05.md#approved-publication-and-one-turn-confirmation)
failed on `d30874a4d80ccf59566701c9d2558e45d5f8df3c`. Its failed draft and exact
web-claim text were not retained. This repair does not claim to replay that
unavailable generated text or establish live answer quality.

## Exact-question reproduction

The regression uses the unchanged synthetic 2014 BC 1010.2 question, the actual
2014 Slope passage, and the same qualified Project description/facts. The
Project's persisted default remains 2022. It runs through the application HTTP
handler, actual shipped corpus, Project storage, source assembly, validation,
answer persistence and reopen. Model output is a mock, and all external fetches
are rejected by the test.

On the original deployed source:

1. The edition router recognizes the bare `BC 1010.2` citation as current code,
   but does not recognize the short `2014 BC` qualifier. It searches 2022 and
   separately retains the user's pinned 2014 evidence. The mock answer reports
   `multiple-authorized-corpora`.
2. Discovery supplies an outside-library suggestion for **NYC Zoning Resolution**.
   The source policy recognizes some selected-evidence questions, but misses
   “Using the selected … passage, summarize …”. It requests web support with
   `outside_library_support_needed`, although this question requests a passage
   summary with explicit limitations rather than an outside-authority lookup.

The new HTTP test failed on the original source at the assertion that web
support must not be requested. A separate comparison loads the two original
modules directly from the exact deployed Git commit and confirms both decisions
before comparing them with the repaired functions. It makes no external calls.
These are concrete upstream routing defects in the exact input path. They do
not prove which words caused the historical draft's attribution rejection.

## Repair

- Recognize selected/supplied/provided passage-summary requests as bounded to
  assembled enacted evidence. Keep outside-library suggestions visible as
  limitations; do not turn those suggestions into automatic web requests.
- Preserve explicit outside requests, including a subsequent request to check
  DOB guidance, retrieve a bulletin, consult a referenced standard or review
  manufacturer instructions. Ordinary broad design questions still permit
  automatic outside-library support.
- Recognize edition-qualified citations such as `2014 BC 1010.2` and
  `2014 NYC PC 403.1`. A bare citation within a stated 2014 question does not
  independently add 2022. Explicit 2014/2022 comparisons still retrieve both;
  a building's construction year alone does not select an edition.
- Correct the local mock's hardcoded 2022 assumption. It now labels the actual
  assembled editions and discloses prior/historical/future applicability so the
  mock obeys the existing validation gate. This helper is used only by the
  guarded local mock path; provider answer prompts are unchanged.

The attribution checker, token threshold, semantic verifier, source/claim
bindings, model configuration, spend caps, prices and customer allowances are unchanged.
The repair fixes which sources are requested, not which unsupported claims are
accepted. There are no native runtime changes.

## Verification

- Focused source-policy and corpus-routing contracts pass, including explicit
  external-request and cross-edition negative controls.
- The exact-question HTTP regression passes with web support neither requested
  nor searched, every citation in the 2014 corpus, qualified Project facts
  retained, and the same mocked answer preserved on save and reopen. The outside
  Zoning suggestion remains disclosed. There are zero external/provider calls.
- Full `npm run check`, including precheck/postcheck, and `npm run smoke` pass
  with provider credentials and paid-evaluation switches removed. The unchanged
  attribution and guidance-binding contracts pass within those suites.
- `git diff --check` and the repair record's relative-link check pass.
- The two older failed drafts remain unavailable. A separately approved
  PR #57 confirmation has now completed; all three recorded turn approvals
  are consumed. Its saved answer provides exact evidence for the remaining
  quality and downstream defects.

Private local evidence is under
`/private/tmp/permitext-selected-passage-repair-20260906/`, including
`baseline-comparison.json`, `check.log` and `smoke.log`. The repository test uses
only synthetic account/Project identifiers and contains no credentials, real
account identifiers, verification codes or raw account exports.

## Remaining acceptance

The one approved Production confirmation completed and the bounded source-routing
repair is verified. The saved answer still has an unrelated authority footer
and limitation. Further checks found a silent Note-reference opening failure
and Report edition/citation/formatting defects. See the
[confirmation and cleanup record](./PERMITEXT_RESEARCH_HANDOFF_CONFIRMATION_2026-09-06.md)
for exact evidence and remaining work. A completed provider operation is not
blanket professional or release acceptance.

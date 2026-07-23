# Permitext AI Evaluation and Feedback Foundation

## Independent Review Handoff

**Prepared:** July 23, 2026

**Repository:** `/Users/randy/Documents/X_CODING/Building Code`

**Application:** `permitext-sync-server`

**Evaluation implementation commit:** `0e33ed193177da634a45e7e2d5f2e8846d2abcfd`

**Final strict evaluation run:** `9bd01396-085f-4175-8c82-98180613eefb`

This document is intended for another development or review agent. It describes what was implemented, what was actually tested, the complete saved paid-run history, the final results, known limitations, and the checks that should be performed independently.

No API key or other secret is included.

---

## 1. Executive summary

Permitext now has a selected-evidence-only AI research workflow and a server-private evaluation foundation. The five initial architectural code-research cases were converted into structured data, exercised through Permitext's real research-conversation path, scored with deterministic citation checks plus a structured model judge, and iteratively improved.

The final strict full-suite run:

- Used `gpt-5.6-terra` for both the Permitext answer and evaluation judge.
- Used answer prompt `20260722-grounded-passages-v7`.
- Used judge prompt `20260722-exact-rubric-v2`.
- Used only passages explicitly selected for each case; broader code retrieval was disabled.
- Completed all five cases.
- Passed all five cases.
- Satisfied every required concept and every required uncertainty condition.
- Triggered no forbidden claims.
- Used ten paid requests: five answers and five judge calls.
- Had an estimated cost of `$0.185174`.
- Ran at Git commit `0e33ed193177da634a45e7e2d5f2e8846d2abcfd`.

The five overall scores were:

| Case | Score | Strict result |
| --- | ---: | --- |
| Scissor stair counted as two exits | 4.00/4 | PASS |
| Single stair in a six-story residential building | 4.00/4 | PASS |
| Occupancy classification of a residential multipurpose room | 3.93/4 | PASS |
| Plumbing fixtures for an accessory assembly space | 3.93/4 | PASS |
| Building Code evidence versus an agency requirement | 4.00/4 | PASS |

This is a development baseline, not proof that the system is infallible and not authorization to expand to unrestricted code retrieval. Knowledgeable human review remains required before accepting a new prompt/model baseline.

---

## 2. Intended product behavior

The phase was deliberately limited to questions based on enacted passages selected by the user.

The intended user flow is:

1. Select enacted text in a reader.
2. Choose **Analyze**.
3. Add the passage to the current research conversation or start a new conversation.
4. Ask a question.
5. Receive a structured answer limited to the selected evidence.
6. Continue the conversation or attach additional selected passages.
7. Optionally submit categorized feedback.

The response separates:

- The conclusion supported by the selected evidence.
- Explanation.
- Missing project facts.
- Limitations of the selected evidence.
- Additional code sections or agency documents needed.
- Citations tied to the selected passages.

The system must say when the selected evidence is insufficient. It must not silently assume material facts such as occupancy, construction type, location, existing conditions, building height, occupant load, or agency requirements.

---

## 3. Explicit boundaries

The following were intentionally not added:

- Unrestricted search across the entire code.
- Automatic retrieval of broader code sections.
- Automatic creation or approval of answer keys by the AI.
- Automatic promotion of user feedback into the approved dataset.
- Automatic prompt modification or training from unreviewed feedback.
- Inference of HCR or another agency's requirements from unrelated Building Code passages.
- Human preapproval of ordinary production answers.
- Unattended paid evaluation runs in CI.

Production answers are intended to be returned directly to users. The owner console is a development quality laboratory, not a queue in which the owner approves each user's answer.

---

## 4. Principal implementation files

| Area | File |
| --- | --- |
| Evaluation dataset | `permitext-sync-server/evals/research-cases.json` |
| Dataset validation and approved-case filtering | `permitext-sync-server/evals/evaluation-schema.mjs` |
| Evaluation workflow documentation | `permitext-sync-server/evals/README.md` |
| Human review records | `permitext-sync-server/evals/reviews.json` |
| Evaluation runner, scorer, reports, and self-tests | `permitext-sync-server/tests/research-evals.mjs` |
| AI prompt, schema, cost calculation, and spend guard | `permitext-sync-server/research-config.mjs` |
| Conversation, usage, feedback, and owner-console APIs | `permitext-sync-server/app.mjs` |
| Customer research interface | `permitext-sync-server/public/app.js` |
| Owner console | `permitext-sync-server/internal/index.html` |
| Owner-console behavior | `permitext-sync-server/internal/app.js` |
| Owner-console styling | `permitext-sync-server/internal/styles.css` |
| General server documentation | `permitext-sync-server/README.md` |

Saved paid-run results are under:

`permitext-sync-server/evals/results/`

That directory is intentionally Git-ignored because it may contain generated answers and private evaluation artifacts. The current local workspace contains JSON and Markdown reports for all persisted runs described below.

---

## 5. Evaluation-case data contract

Each case contains:

- `id`
- `title`
- `status`: `draft`, `reviewed`, `approved`, or `retired`
- `difficulty`: `basic`, `intermediate`, or `advanced`
- `topics`
- `codeEdition`
- `projectContext`
- `selectedEvidence`
- `question`
- `requiredCitations`
- `requiredConcepts`
- `forbiddenClaims`
- `missingFacts`
- `expectedConclusion`
- `expectedCertainty`
- `sourceType`
- `reviewer`
- `reviewedAt`

The schema and runner contain no case-specific branching. An offline scalability test duplicates the structured cases to validate a 500-case dataset without changing evaluation code.

Only cases whose status is `approved` are included in an evaluation run.

The answer keys, required concepts, forbidden claims, missing facts, reviewer information, and scoring rubrics remain server-side. They are not served to the normal Permitext customer interface.

---

## 6. Initial five cases

### 6.1 Scissor stair counted as two exits

- **Evidence:** BC 1007.1.1, including Exception 3 for Group R-2.
- **Question:** Whether a scissor stair with entrance doors 15 feet apart can count as two exits.
- **Required conclusion:** Fifteen feet alone is insufficient. The general rule counts stairs sharing a scissor-stair assembly as one exit stairway, while the R-2 exception may allow separate treatment if the two-hour enclosure/separation and masonry-or-masonry-equivalent conditions are also satisfied.
- **Material facts to request:** R-2 occupancy, enclosure rating, separating-construction rating, and material.
- **Critical forbidden conclusions:** Every scissor stair always counts as one; 15 feet alone proves compliance; sprinklers alone satisfy the exception.

### 6.2 Single stair in a six-story residential building

- **Evidence:** BC 1006.3.2, particularly Item 7.
- **Question:** Whether a six-story residential building with approximately 1,950 square feet per story may use one exit stair.
- **Required conclusion:** The story count and area are within the selected limits, but eligibility also requires Group R-2 and Type I or II construction.
- **Material facts to request:** Occupancy classification, construction type, and confirmation of the stated story/area facts.
- **Critical forbidden conclusions:** Every six-story residential building qualifies; the allowance is established without R-2 and Type I/II confirmation; unselected additional requirements are presented as though established by the selected passage.

### 6.3 Residential multipurpose-room occupancy

- **Evidence:** BC 303.1.3 and BC 1004.1.3.
- **Question:** Whether a 900-net-square-foot, resident-only room with tables and chairs must be Group A-3.
- **Required conclusion:** The selected unconcentrated factor is 15 net square feet per occupant, so `900 / 15 = 60`. If the room is truly accessory and the facts remain as stated, the fewer-than-75 provision permits Group B or classification as part of the occupancy served.
- **Material facts to request:** Actual net area, furniture arrangement, intended activities, and accessory status.
- **Critical forbidden conclusions:** Every residential amenity room is automatically R-2; the load is below 75 without calculation; the result is unchanged for concentrated seating, standing space, or another function.

### 6.4 Plumbing fixtures for an accessory assembly space

- **Evidence:** BC 303.1.3, PC 403.1, Table 403.1 excerpts, and PC 403.1.1.
- **Question:** Whether a room classified as Group B under the fewer-than-75 accessory-assembly provision can simply use the normal Group B fixture requirements.
- **Required conclusion:** Not automatically. The selected provisions permit the assembly use's fixtures to be calculated using applicable Assembly requirements. The actual Assembly category and project facts must be determined before a final count.
- **Material facts to request:** Occupant load, actual Assembly category/use, existing or shared facilities, applicable sharing/credit provisions, other occupancies, and any approved sex-distribution data.
- **Critical forbidden conclusions:** Group B always controls; residential-unit fixtures automatically satisfy the requirement; a final fixture count is possible from the supplied evidence.

### 6.5 Building Code evidence versus an HCR requirement

- **Evidence:** BC 1107.2.2.7.2.2.
- **Question:** Whether the selected Building Code passage proves that HCR requires a bathroom vanity.
- **Required conclusion:** No. The passage regulates forward-approach water-closet clearance and when a lavatory may be located on the rear wall. It does not establish an HCR vanity requirement.
- **Material evidence to request:** The applicable HCR design standard, funding/program requirements, or official agency guidance.
- **Critical forbidden conclusions:** The selected passage requires a vanity; a lavatory and vanity are interchangeable requirements; HCR's rule can be stated without HCR material.

The exact enacted passages and complete machine-readable rubrics are in `evals/research-cases.json`.

---

## 7. Scoring behavior tested

Each generated answer is scored for:

- Citation correctness.
- Citation completeness.
- Required-concept coverage.
- Hallucinated or invented requirements.
- Appropriate uncertainty.
- Recognition of missing project facts.
- Practical usefulness.
- Response time.
- Token cost.

Citation scope and completeness are checked deterministically. The answer's citation schema is dynamically constrained to the selected canonical section IDs, source IDs, and passage IDs.

The structured judge is constrained to:

- The exact rubric IDs defined by the case.
- The exact required number of concept decisions.
- The exact required number of forbidden-claim decisions.
- The exact required number of uncertainty-condition decisions.

The response fails if any of the following occurs, regardless of its weighted overall score:

- A required concept is missing.
- A required uncertainty condition is missing.
- A forbidden claim is present.
- Citation verification fails.

This strict rule was added after an earlier run received a passing weighted score even though the plumbing-fixture answer failed to ask about existing/shared facilities.

The scorer self-test explicitly verifies that satisfying only three of four required uncertainty conditions fails the case.

---

## 8. Offline and no-cost tests performed

The following command passed after the strict rubric changes:

```sh
npm run check
```

It covered:

- JavaScript syntax checks for server, client, internal console, evaluation, account, sync, and test modules.
- Evaluation schema validation.
- A perfect synthetic scoring case.
- Citation-scope and citation-completeness failure behavior.
- Failure when a required uncertainty condition is omitted.
- Structured scaling to 500 cases without case-specific evaluation code.
- Conservative spend-cap reservation and rejection above the approved cap.
- Exact evidence resolution for all five cases.
- All five cases through Permitext's actual selection and conversation path in mock mode.
- Confirmation that the no-cost path makes no paid model requests.

Observed evaluation preflight result:

```text
READY 1. Scissor stair counted as two exits
READY 2. Single stair in a six-story residential building
READY 3. Occupancy classification of a residential multipurpose room
READY 4. Plumbing fixtures for an accessory assembly space
READY 5. Building Code evidence versus an agency requirement
Summary: 5/5 cases are evidence-ready. No paid model calls were made.
Verified 5/5 cases through Permitext's selection and conversation flow in mock mode.
```

The following command also passed:

```sh
npm run smoke
```

It covered:

- Workboard production build.
- Authentication policy.
- Code-reference parsing.
- Enacted-content integrity.
- Client sync identity behavior.
- Client latest-change state behavior.
- Server route and persistence smoke tests.

Observed content-integrity counts:

| Measure | Count |
| --- | ---: |
| Chapters | 118 |
| Sections | 12,890 |
| Indexed sections | 12,890 |
| Canonical overrides | 417 |
| Available section bodies | 10,371 |
| Referenced images | 248 |
| Known duplicate display keys | 8 |

`git diff --check` passed after the implementation changes. The worktree was clean at evaluation commit `0e33ed19`.

---

## 9. Paid evaluation safety tested

A live suite is locked unless all of the following are provided:

- Explicit `PERMITEXT_RUN_PAID_RESEARCH_EVALS=1`.
- An OpenAI API key.
- Explicit input, cached-input, and output token prices.
- A version label for those prices.
- An explicit maximum dollar amount for that process.

Before each answer or judge request, the runner conservatively reserves a maximum possible amount. The estimate treats every UTF-8 request byte as an uncached input token and adds the provider-enforced output ceiling. A request is stopped before it could exceed the configured cap.

Other live-run safety behavior tested:

- The maximum planned number of requests is printed before the run.
- Run state is saved after each completed case.
- A failed run is preserved as JSON and Markdown.
- Failed runs do not become baselines.
- Targeted one-case diagnostic runs are labeled `targeted` and cannot automatically replace a complete full-suite baseline.
- Every saved run records model, reasoning effort, prompt version, evidence/retrieval version, code edition, dataset hash, Git commit, timing, tokens, price version, estimated cost, and timestamp.

The approved total experimentation limit was `$10`. Saved run estimates total `$1.097864`. One initial pre-persistence attempt has no complete cost artifact, so the exact cumulative amount cannot be derived solely from the saved files; total experimentation nevertheless remained far below the approved limit.

No further spending should be authorized or performed by a reviewing agent without asking the owner first.

---

## 10. Complete paid-run history

### Unpersisted initial attempt

This run occurred before partial-run persistence was added.

- Cases 1 through 4 reached passing results.
- Case 5 failed response verification.
- No result file was saved.
- The failure motivated strict structured-answer citation constraints and partial-run persistence.
- Exact cost is unavailable from local artifacts.

### Persisted runs

| Time/file | Scope | Answer prompt | Result | Scores | Estimated cost | Reason for next iteration |
| --- | --- | --- | --- | --- | ---: | --- |
| `02-54-38-196Z` | Full, failed after 1 case | v3 | 1 completed case; run failed | `4.00` | `$0.032880` | Judge returned the wrong number of uncertainty conditions. Exact judge cardinality was enforced. |
| `02-57-10-413Z` | Full | v3 | 3/5 passed | `3.09, 3.86, 4.00, 3.54, 4.00` | `$0.190475` | Scissor-stair and plumbing behavior required stronger prompt guidance. |
| `03-01-10-872Z` | Full | v4 | 4/5 passed | `4.00, 4.00, 4.00, 3.23, 3.63` | `$0.179862` | Plumbing remained deficient. Targeted diagnostics were added. |
| `03-04-15-064Z` | Targeted plumbing | v5 | 1/1 passed | `3.83` | `$0.052865` | Confirmed the plumbing correction before another full suite. |
| `03-04-58-887Z` | Full | v5 | 4/5 passed | `4.00, 4.00, 3.93, 3.71, 3.38` | `$0.199337` | HCR case failed to request the external HCR material explicitly. |
| `03-07-48-390Z` | Targeted HCR | v6 | 1/1 passed | `4.00` | `$0.026980` | Confirmed the external-authority correction. |
| `03-08-12-514Z` | Full | v6 | 5/5 weighted passes | `4.00, 4.00, 4.00, 3.83, 4.00` | `$0.179178` | Manual inspection found plumbing still omitted existing/shared facilities. The weighted pass was intentionally not accepted as sufficient. |
| `03-12-11-490Z` | Targeted plumbing | v7, strict pass | 1/1 passed | `3.87` | `$0.051113` | Verified all four missing-fact conditions, including existing/shared facilities. |
| `03-13-13-558Z` | Final full suite | v7, strict pass | 5/5 passed | `4.00, 4.00, 3.93, 3.93, 4.00` | `$0.185174` | Accepted as the current machine-scored candidate baseline, pending knowledgeable human review. |

The corresponding JSON and Markdown reports use the full timestamps shown in `evals/results/`.

---

## 11. Final strict run configuration

| Field | Value |
| --- | --- |
| Run ID | `9bd01396-085f-4175-8c82-98180613eefb` |
| Dataset SHA-256 | `a208727d07faf88c3428868ad1b847738cb1aabf261d1b4dcd542566f31781d9` |
| Code edition | `2022 New York City Construction Codes` |
| Answer model | `gpt-5.6-terra` |
| Answer reasoning effort | `medium` |
| Answer prompt | `20260722-grounded-passages-v7` |
| Judge model | `gpt-5.6-terra` |
| Judge reasoning effort | `medium` |
| Judge prompt | `20260722-exact-rubric-v2` |
| Evidence version | `selected-passages-only-v2` |
| Retrieval version | `none-selected-evidence-only` |
| Suite scope | `full` |
| Git commit | `0e33ed193177da634a45e7e2d5f2e8846d2abcfd` |
| Paid requests | 10 |
| Process spend cap | `$0.75` |
| Conservative reservation | `$0.502444` |
| Estimated actual cost | `$0.185174` |
| Total input tokens, answer plus judge | 16,019 |
| Total output tokens, answer plus judge | 9,675 |
| Total tokens, answer plus judge | 25,694 |
| Sum of answer-call latency | 43.220 seconds |

Token costs used the versioned configuration label:

`openai-standard-gpt-5.6-terra-2026-07-22`

---

## 12. Final strict per-case results

| Case | Overall | Required rubrics | Answer latency | Answer tokens | Answer + judge estimated cost |
| --- | ---: | --- | ---: | ---: | ---: |
| Scissor stair | 4.00 | All satisfied | 7.797 s | 2,097 | `$0.034972` |
| Single stair | 4.00 | All satisfied | 6.771 s | 1,497 | `$0.029980` |
| Multipurpose occupancy | 3.93 | All satisfied | 9.999 s | 2,508 | `$0.041738` |
| Plumbing fixtures | 3.93 | All satisfied | 12.660 s | 2,989 | `$0.047048` |
| Building Code versus HCR | 4.00 | All satisfied | 5.993 s | 1,536 | `$0.031436` |

All five received:

- Citation correctness: `4/4`.
- Citation completeness: `4/4`.
- Required-concept coverage: `4/4`.
- Hallucinations/invented requirements: `4/4`.
- Appropriate uncertainty: `4/4`.
- Recognition of missing project facts: `4/4`.
- Practical usefulness: `4/4`.

The two `3.93` overall scores resulted only from a `3/4` token-cost score:

- Multipurpose occupancy answer estimated cost: `$0.021608`.
- Plumbing-fixture answer estimated cost: `$0.024348`.

They did not lose points for substantive accuracy, citations, uncertainty, or usefulness.

The exact answers, citations, missing-fact lists, evidence limitations, judge rationales, and rubric decisions are in:

- `evals/results/2026-07-23T03-13-13-558Z.json`
- `evals/results/2026-07-23T03-13-13-558Z.md`

---

## 13. Final conclusions generated

These are condensed descriptions; inspect the saved report for the exact output.

### Scissor stair

The answer concluded that the stairs may conditionally count separately under the R-2 exception. It correctly stated that 15 feet satisfies only the door-separation condition and requested verification of R-2 status, two-hour enclosure and separating construction, and masonry or masonry-equivalent construction.

### Single stair

The answer concluded that one stair may conditionally be available under the selected passage because the stated six stories and approximately 1,950 square feet are within the stated limits. It withheld final reliance until R-2 occupancy and Type I or II construction are confirmed and limited broader egress observations to evidence not supplied.

### Multipurpose occupancy

The answer calculated `900 / 15 = 60`, compared 60 with the fewer-than-75 threshold, and conditionally concluded that Group A-3 is not required under the selected accessory-assembly provision. It requested confirmation of net area, actual arrangement, intended uses, and accessory status.

### Plumbing fixtures

The answer rejected the proposition that Group B ratios automatically and exclusively control. It explained the selected permission to use applicable Assembly fixture requirements, explained the supplied calculation mechanics, declined to invent a final fixture count, and requested occupant load, actual Assembly category, other occupancies, existing/shared facilities, sharing or credit provisions, and approved sex-distribution data.

### Building Code versus HCR

The answer concluded that the selected Building Code passage does not prove an HCR vanity requirement. It explained what the passage does regulate and requested HCR standards, program/funding requirements, or official agency guidance.

One judge rationale noted that the phrase `vanity (lavatory)` was imprecise because the selected evidence did not define the terms. The judge found that it did not change the conclusion or assert interchangeability. An independent professional reviewer should still decide whether that wording should be removed from the production prompt or response style.

---

## 14. User-facing feedback behavior tested

Completed AI answers include:

- Helpful.
- Incorrect or misleading.
- Missing information.
- Citation problem.
- Other feedback.
- Optional written comment.

The server stores feedback with:

- Conversation and answer identifiers.
- Selected evidence identifiers.
- Question.
- Answer.
- Citations.
- Model and prompt/evidence versions.
- Feedback category.
- User comment.
- Timestamp.

Feedback is saved as a `candidate`. It is not proof that an answer was wrong, is not automatically added to the approved dataset, and does not automatically train the model or change the prompt.

---

## 15. Owner-console behavior

The local owner console is available at:

`http://localhost:8787/internal/`

It contains:

- **Cases:** private evidence, expected conclusion, required citations, concepts, missing facts, forbidden claims, and case approval/rejection.
- **Runs and comparison:** two saved runs shown side by side for one selected case, generated answers, automatic metrics, score overrides, notes, and run-answer approval/rejection.
- **Feedback candidates:** production feedback awaiting human triage.

Local access requires a valid Permitext browser session and requests originating from the same machine as the non-Vercel development server. A hosted environment requires explicit enablement and an owner user ID.

### Important workflow defect requiring correction

Run reviews are displayed and stored per case, but the baseline-selection code currently treats a run ID as approved if it finds any approved review for that run. Therefore, approving one answer can cause the entire run to be preferred as a baseline before all five cases are reviewed.

Recommended correction:

1. Keep per-case answer decisions.
2. Require every approved case in the run to have an approved human decision.
3. Do not accept the run if any case is rejected or unreviewed.
4. Optionally add a separate **Approve full run** action enabled only when the case-level condition is satisfied.

Until that correction is made, inspect the run but do not use a single answer's **Approve** button as evidence that the full run has completed human review.

---

## 16. Current workspace state at handoff

At the time this report was prepared:

- `origin/main` contained the evaluation foundation through `0e33ed19`.
- Local `HEAD` was `a21aeb6a0fdb47acfdedf7a09c8ffcc23b1b14c5`, one commit ahead for a later archived-project synchronization change unrelated to this evaluation baseline.
- `evals/research-cases.json` and `evals/reviews.json` had uncommitted changes produced by owner-console case-review activity.
- Those user-generated review changes must be preserved.
- This report must be staged and committed independently from those review files unless the owner explicitly asks to include them.
- The local server was running on port 8787 using JSON-file storage.
- The newly started local server process did not have `OPENAI_API_KEY` loaded. Saved evaluations and the owner console remain viewable, but a new real-AI request will not work until the key is securely restored.
- No key should be retrieved from logs, committed, printed, or embedded in this report.

---

## 17. Reproduction commands

Run from:

`/Users/randy/Documents/X_CODING/Building Code/permitext-sync-server`

### Free validation

```sh
npm run check
npm run smoke
npm run eval:research
git diff --check
```

These commands must not make paid model calls.

### Targeted paid diagnostic

After explicit owner approval for a specific dollar cap:

```sh
PERMITEXT_RUN_PAID_RESEARCH_EVALS=1 \
OPENAI_API_KEY=... \
PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS=... \
PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS=... \
PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS=... \
PERMITEXT_RESEARCH_PRICING_VERSION=... \
PERMITEXT_RESEARCH_EVAL_MAX_USD=... \
npm run eval:research:live -- --case CASE_ID
```

### Full paid baseline

After explicit owner approval for a specific dollar cap:

```sh
PERMITEXT_RUN_PAID_RESEARCH_EVALS=1 \
OPENAI_API_KEY=... \
PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS=... \
PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS=... \
PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS=... \
PERMITEXT_RESEARCH_PRICING_VERSION=... \
PERMITEXT_RESEARCH_EVAL_MAX_USD=... \
npm run eval:research:live
```

Do not guess prices. Do not reuse the previous `$10` authorization for a new independent spending decision. Ask the owner first.

---

## 18. Recommended independent review

The next agent should:

1. Read `evals/research-cases.json` and verify the exact passages against the enacted source files.
2. Inspect the final JSON report rather than relying only on the Markdown summary.
3. Confirm each returned citation belongs to the selected evidence and supports the attributed statement.
4. Independently review every required concept, missing fact, and forbidden claim.
5. Assess whether the answer would be professionally safe and practically useful in architectural work.
6. Pay special attention to:
   - Exact treatment of the scissor-stair exception.
   - Whether the single-stair answer overstates what the selected passage proves.
   - The `900 / 15 = 60` occupant-load calculation.
   - Existing/shared facilities in the plumbing answer.
   - The distinction between Building Code evidence and HCR authority.
   - The imprecise `vanity (lavatory)` parenthetical.
7. Verify the strict pass logic by temporarily constructing a test result that misses one required uncertainty condition; do not modify the approved dataset.
8. Review the owner-console baseline-selection defect described above.
9. Rerun the free checks.
10. Do not make a new paid call without explicit owner approval.

---

## 19. Acceptance criteria for the next AI change

Before a future prompt, model, evidence, citation, or reasoning change is accepted:

1. All approved cases resolve exact enacted evidence.
2. Free preflight passes.
3. The same change is exercised through Permitext's real conversation workflow.
4. A paid run is explicitly authorized with a dollar cap.
5. Every approved case passes strict required-rubric logic.
6. No citation outside selected evidence is shown as verified.
7. No forbidden claim is triggered.
8. The new run is compared with the accepted prior full baseline.
9. A knowledgeable human reviews all case answers.
10. Only then may the complete run become the new baseline.

---

## 20. Bottom line

The foundation is technically functioning and the final five-case machine-scored run passed strict checks. The most important remaining work is not broader retrieval. It is:

1. Correct the owner-console rule so a full run cannot be accepted after only one case-level approval.
2. Complete knowledgeable human review of all five final answers.
3. Expand the dataset with real architectural questions and confirmed production failures.
4. Restore the API key securely when real local AI use resumes.
5. Continue selected-evidence-only operation until the evaluation set demonstrates enough reliability to justify controlled retrieval.

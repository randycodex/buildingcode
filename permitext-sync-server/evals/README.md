# Permitext research evaluations

This directory is Permitext's server-private, repository-based laboratory for measuring AI research quality. It reuses the production Research conversation path and does not add retrieval, training, or customer-facing answer-key behavior.

## Storage map

- `research-cases.json`: human-authored cases and answer keys.
- `evaluation-schema.mjs`: data-contract validation and approved-case selection.
- `evaluation-governance.mjs`: shared full-run eligibility, human-review completeness, and preferred-baseline rules.
- `results/`: immutable raw JSON runs and generated Markdown review reports.
- `reviews.json`: human decisions, notes, and score overrides, stored separately from raw answers.
- `baselines/`: provisional or human-accepted baseline summaries that point to immutable raw runs.
- `comparisons/`: machine-readable and Markdown comparisons between two raw runs.

None of these paths is under `public/`. The customer client cannot request them. The local owner console reads them only through authenticated server routes.

## Case contract

Every case supports:

- `id`, `title`, `status`, `codeEdition`, `jurisdiction`, `topics`, and `difficulty`.
- `sourceType` and `sourceReference`.
- Structured `projectContext`.
- `selectedEvidence` containing persisted canonical `sectionID`, code prefix, section number, reference, and exact enacted passages.
- `question`, `requiredCitations`, optional claim-specific `requiredCitationClaims`, `requiredConcepts`, `forbiddenClaims`, optional deterministic `forbiddenPhrases`, and `missingFacts`.
- `expectedConclusion` and explicit `expectedUncertainty` level/description.
- `reviewer`, `reviewedAt`, and `notes`.

Draft cases may use `null` reviewer fields. `reviewed`, `approved`, and `retired` cases require a reviewer and timestamp. Only `approved` cases can run.

Approval means a knowledgeable human confirmed the jurisdiction and edition, copied exact enacted passages from Permitext's canonical content, matched required citations to selected evidence, and reviewed the expected conclusion, concepts, forbidden claims, missing facts, and uncertainty. AI-generated answer keys are never self-approved.

## Add a case

1. Copy an existing case object and give it a stable, descriptive ID.
2. Set `status` to `draft`, `reviewer` to `null`, and `reviewedAt` to `null`.
3. Record jurisdiction, edition, source type/reference, anonymized project context, topics, and difficulty.
4. Resolve the enacted section in Permitext and persist its canonical numeric `sectionID`.
5. Copy exact enacted passages. Do not use a paraphrase as selected evidence.
6. Write the question, expected conclusion/uncertainty, required citations/concepts, forbidden claims, and missing-fact rules.
7. Run `npm run eval:research`; a missing passage or wrong canonical ID blocks the case.
8. Have a knowledgeable reviewer inspect every approval condition.
9. Record the reviewer and timestamp and change the status to `approved`.

The schema and runner contain no case-specific branches. The self-test validates the same contract after expanding it to 500 cases.

## Dataset growth to 200–500 cases

Cases may originate from real architectural projects, RFIs, plan-review objections, code-consultant coordination, accessibility reviews, fire-protection reviews, MEP coordination, Permitext user feedback, confirmed production failures, official agency interpretations, Buildings Bulletins, public determinations/decisions, professional architectural or code forums, educational discussions, and deliberately constructed edge cases.

Online/forum material supplies a problem scenario, never an authoritative answer key:

1. Record the source reference.
2. Paraphrase and anonymize the scenario where appropriate.
3. Identify the applicable jurisdiction and code edition.
4. Rebuild the expected answer from Permitext's canonical enacted text.
5. Add official agency material when applicable.
6. Define required citations/concepts, forbidden claims, missing facts, and expected uncertainty.
7. Obtain knowledgeable human review.
8. Promote to `approved` only after that review.

Build coverage deliberately across direct rules and exceptions, general and occupancy-specific rules, current and older editions, cross-references, outside-agency questions, insufficient selected evidence, and material missing facts such as occupancy, construction type, height, stories, floor area, occupant load, use, location, existing conditions, sprinklers, accessibility standard, and edition.

Feedback categories are `helpful`, `incorrect_misleading`, `missing_information`, `citation_problem`, and `other`. Feedback stores the conversation/answer IDs, selected evidence IDs, question, immutable answer, citations, model, prompt/evidence versions, comment, optional self-described professional role, optional supporting reference, and timestamp. It always remains a review `candidate`; a thumbs-down is not proof of error and never promotes a case automatically.

The owner-only console keeps triage separate from candidate status. A candidate may be marked `new`, `reviewing`, `evaluation_candidate`, `resolved`, or `dismissed`, with reviewer notes and an append-only triage history. `evaluation_candidate` means only that the report is worth rebuilding as a reviewed case. It does not write to `research-cases.json`, approve an answer key, modify a prompt or model, or make a run eligible as a baseline.

## Free validation

Validate all approved cases against canonical evidence and exercise the real production conversation path in mock mode:

```sh
npm run eval:research
```

Run one case:

```sh
npm run eval:research -- --case scissor-stair-two-exits
```

Filter approved cases:

```sh
npm run eval:research -- --topic "means of egress"
npm run eval:research -- --difficulty advanced
npm run eval:research -- --code-edition "2022 New York City Construction Codes"
```

List every case/status:

```sh
node tests/research-evals.mjs --list
```

`npm run check` also runs the scorer/report self-test and the no-cost production-path preflight.

## Paid live runs

A live repetition makes one production-path answer request and one separate structured grader request per case. It is locked unless spending was explicitly approved and every required value is supplied:

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

Useful live options:

```sh
npm run eval:research:live -- --case CASE_ID
npm run eval:research:live -- --topic accessibility
npm run eval:research:live -- --difficulty advanced --repeat 3
npm run eval:research:live -- --model MODEL
npm run eval:research:live -- --prompt-version 20260722-grounded-passages-v7
```

The model option uses the production configuration boundary. Prompt selection is intentionally stricter: a requested version must exist in the current application build, so a run cannot relabel unchanged prompt text as a different prompt.

Every run uses an isolated temporary local store and synthetic eval account. It never writes a normal user's conversations or consumes a production user's monthly allowance. Pricing is never guessed; each paid request reserves a conservative maximum before dispatch and stops at the approved cap.

## Scoring

Quality uses a transparent 0–4 scale:

- Deterministic: answer presence/shape; canonical section and passage IDs; selected-evidence scope; explicit inline evidence IDs; required-citation completeness; malformed, duplicate, and unsupported returned citations; and unexpected writing-system contamination when the dataset declares an English response.
- Semantic: citation-to-claim support, required concepts, unsupported/invented requirements, forbidden claims, uncertainty, missing facts, selected-evidence insufficiency, usefulness, and directness.
- Operational: duration, input/cached/output/total tokens, and reliable estimated cost are recorded separately from the quality score.

Semantic criteria include a rationale, failure excerpt where possible, confidence, and objective/subjective classification. Model scoring is reviewable and overridable; it does not rewrite the answer key.

Structural/citation failures, invented requirements, forbidden claims, unjustified certainty, and omitted required missing facts are critical failures. Aggregate score cannot hide them.

## Baselines and comparisons

Create a baseline summary from a completed full raw run:

```sh
node tests/research-evals.mjs \
  --create-baseline evals/results/RUN.json
```

Baseline eligibility is deliberately strict. A source must use the current raw-run schema, be a completed unfiltered full suite, contain exactly one successful result for every case ID recorded by that immutable run, show that every embedded case was approved when it ran, contain no case errors, and use one repetition. Eligibility does not silently change when the current mutable dataset later grows. Legacy, targeted, filtered, repeated, incomplete, and errored runs cannot become baselines.

An eligible artifact remains `provisional` until the latest human decision for every case answer is approved. Any latest rejection blocks the run. One case approval never approves or prefers the full run. Human score overrides are preserved separately and reflected in the baseline summary without changing the immutable raw answer.

Compare a later raw run with a raw baseline run or baseline artifact:

```sh
node tests/research-evals.mjs \
  --compare evals/results/NEW_RUN.json \
  --against evals/baselines/BASELINE.json
```

Comparison reports call out improvements, regressions, newly passing/failing cases, substantially changed answers, citation/invention/uncertainty/missing-fact regressions, latency/token/cost increases, and model/prompt/evidence/application changes. A higher aggregate score never accepts a model or prompt automatically.

## Human review

Open `/internal` on a local Permitext server while signed in. Hosted access is disabled unless explicitly enabled and restricted to `PERMITEXT_INTERNAL_OWNER_USER_IDS`; writes remain local-only.

The console shows the full private case rubric, project context, enacted evidence, generated answer/citations, deterministic and semantic detail, prior runs, configuration, duration, tokens, cost, score overrides, notes, approval/rejection, and full-run baseline eligibility. Each run decision applies to one case answer; the run is accepted only after every case has a current approval. Reviews are append-only records in `reviews.json`; raw generated answers are never modified.

Never expose answer keys through production client assets, run paid evals unattended in CI, promote feedback automatically, or infer an outside agency's requirements from unrelated Building Code evidence.

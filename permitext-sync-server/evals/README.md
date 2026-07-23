# Permitext research evaluations

`research-cases.json` is Permitext's permanent, human-authored golden set for AI research behavior. The evaluator is data-driven: append a case with the fields below and the existing runner will validate, execute, score, and report it without a code change.

Each case requires:

- `id`: stable, unique identifier.
- `title`: reviewer-facing name.
- `codeEdition`: edition governing the exact evidence.
- `selectedEvidence`: one or more code references with `codePrefix`, `sectionNumber`, and `exactPassages` copied from the enacted text.
- `question`: the project question sent through the real Permitext research-conversation flow.
- `requiredCitations`: selected references that must appear in the answer.
- `requiredConcepts`: ideas a competent answer must cover.
- `forbiddenClaims`: unsupported or unsafe conclusions the answer must avoid.
- `requiredUncertaintyConditions`: missing project facts or outside materials the answer must request before concluding.
- `expectedAnswerSummary`: the domain-expert reference used by the structured judge and human reviewer.

The top-level `automaticScoring` object controls the seven score weights, pass scale, latency thresholds, and answer-token thresholds for every case. Scores run from 0 through 4. A case passes only when its weighted score and every critical quality dimension meet the configured passing score.

## Development gate

Run the no-cost evidence preflight after changing the dataset or enacted content:

```sh
npm run eval:research
```

The same preflight and an offline scorer/report self-test are included in `npm run check`. The preflight must resolve each reference to exactly one canonical section, find every exact passage, and successfully exercise every selection through Permitext's real conversation endpoints in mock mode before the evaluator will permit any model request. A blocked case identifies a source preparation, mapping, or selection problem that must be resolved before paid testing.

After explicit spending approval, run the live suite whenever a prompt, model, reasoning level, response schema, evidence assembly rule, citation rule, or AI-facing conversation behavior changes:

```sh
PERMITEXT_RUN_PAID_RESEARCH_EVALS=1 \
OPENAI_API_KEY=... \
npm run eval:research:live
```

Live execution uses two paid model requests per case: one through Permitext's actual selection-to-conversation path and one strict structured scoring request. Reports are written to ignored `evals/results/` files and include the dataset hash, model configuration, all automatic scores, rubric checks, latency, and separate answer/judge token usage. Compare the new report with the last accepted report before accepting the behavior change. Keep a building-code professional in the review loop for significant releases.

Paid evaluation is deliberately manual. Do not add the live command to unattended CI or run it without the user's approval of the expected number of requests and spending.

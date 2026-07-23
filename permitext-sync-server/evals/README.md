# Permitext research evaluations

`research-cases.json` is Permitext's permanent, server-private golden set for AI research behavior. It is not served by the production client. Add or edit structured case data; the runner and owner console require no case-specific application code and are designed for hundreds of cases.

## Case contract

Every case contains:

- `id`, `title`, `status`, `difficulty`, and `topics`.
- `codeEdition` and structured `projectContext`.
- `selectedEvidence` with canonical references and exact enacted passages.
- `question`, `requiredCitations`, `requiredConcepts`, and `forbiddenClaims`.
- `missingFacts`, `expectedConclusion`, and `expectedCertainty`.
- `sourceType`, `reviewer`, and `reviewedAt`.

The accepted values and full validation contract live in `evaluation-schema.mjs`. Draft cases may have `null` reviewer fields. Reviewed, approved, and retired cases require a reviewer and timestamp. Only `approved` cases are executed by the evaluation runner.

## Dataset-growth workflow

1. Collect a real code-research question.
2. Attach the exact enacted passages; do not paraphrase the evidence field.
3. Define the expected conclusion and required canonical citations.
4. Identify missing project facts and forbidden claims.
5. Add incomplete, misleading, cross-reference, and out-of-scope variations as separate cases when useful.
6. Have a knowledgeable human review the evidence and answer key.
7. Promote the case from `draft` to `approved`; the AI may not approve its own answer key.
8. Run approved cases after every meaningful model, prompt, evidence, citation, or reasoning change.
9. Convert confirmed production failures and reviewed user feedback into regression cases. Feedback remains a `candidate` until this review is complete.

## Free development gate

Run the no-cost evidence preflight after changing the dataset or enacted content:

```sh
npm run eval:research
```

The preflight resolves every canonical source, finds every exact passage, and exercises the real selection/conversation workflow in mock mode. `npm run check` also runs the offline scorer/report self-test and this evidence preflight.

## Paid baseline gate

A live suite makes two paid requests per approved case: one Permitext answer and one structured judge. It remains locked unless all of the following are supplied after explicit spending approval:

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

The pricing values are never guessed. Without an explicit pricing version, all three rates, and the dollar cap approved for that run, the runner refuses a paid run. Before each answer or judge call, it reserves a conservative maximum based on every UTF-8 request byte being an uncached input token plus the provider-enforced output-token ceiling. The next request is stopped before it could exceed the approved cap.

Results are written to ignored `evals/results/` JSON and Markdown files. Each run records its ID and timestamp, dataset hash, code editions, Git commit, model/reasoning settings, prompt/evidence/retrieval versions, answers, citations, timing, tokens, reliable estimated cost, automatic scores, and comparison with the preceding saved baseline. Model judging is a regression signal; human review remains the authority for answer keys and score overrides.

During prompt development, `npm run eval:research:live -- --case CASE_ID` runs one approved case with one answer call and one judge call. The result is marked `targeted` and cannot replace a completed full-suite baseline. Run the complete approved suite after the targeted case is satisfactory.

## Owner console

Open `/internal` on the local Permitext server while signed in. Local access is available only from the machine running the development server. In a hosted environment, the console is disabled unless explicitly enabled and the signed-in user ID is listed in `PERMITEXT_INTERNAL_OWNER_USER_IDS`.

The console can inspect private cases, expected conclusions, answers, automatic scores, feedback candidates, and two saved runs side by side. Local reviewers can approve/reject cases, override scores, and add notes. These capabilities are intentionally separate from the customer application.

Never add the live command to unattended CI, expose answer keys through production client assets, promote unreviewed feedback automatically, or infer agency requirements from unrelated Building Code evidence.

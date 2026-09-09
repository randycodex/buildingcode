# Research source binding and historical branch coverage

This local pass starts from `977f27945`. It makes no new paid provider request and does not claim a delivered or professionally accepted answer. The retained ZR-06 live attempt still represents a failed 25.182-second request. All 110 numbered cases remain in scope, including the unresolved official-PDF confirmation and other retained answer defects.

## Changes

- Reconcile a missing point-level source binding only when the point explicitly makes a supplied numbered ZR provision the subject of a rule, exactly one supplied source resolves it, that source contains text, and an existing top-level citation matches its section and available edition/corpus metadata. Add the missing source ID without changing prose or removing existing bindings. Ambiguous passages, editions, duplicate identities, contradictory citations, incorporated references and absent sources are not guessed.
- Apply that reconciliation only on the conditional source-explanation path with mandatory semantic verification. The verifier receives the resulting answer. A verifier rejection still fails the request without saving an assistant answer or charging a Research turn. Successful answers retain the binding-repair record in their existing Zoning diagnostic metadata.
- Recognize passive nominal withholding, such as “an as-of-right determination for a specific property cannot be made,” in the shared conditional and map-boundary checks. Remove Markdown emphasis delimiters before splitting mapped-analysis sentences so closing bold text does not join the next sentence. Tests retain appended approvals, prohibitions and property placement as failures.
- Require the reconstruction and undocumented/nonconforming alternatives when the reviewed storage-applicability excerpt actually supplies those branches. Coverage must appear in the answer prose or a supporting point and bind to the historical provision; it cannot be satisfied solely by a missing-fact checklist. A mixed point may retain additional sources. These are coverage checks, not proof of substantive entailment.
- Ask for one concise direct answer/application and distinct supporting rules, avoiding repetition across the two fields. This is a prompt change; generated brevity remains unverified.

The branch coverage comes from the supplied enacted excerpt and its reviewed scope metadata, not from an answer key inserted into the model request. The reconstruction and documentation alternatives were cross-checked against the official [ZR 42-192](https://zr.planning.nyc.gov/article-iv/chapter-2/42-192). Its reconstruction alternative retains documentation, damage/destruction, same-lot and floor-area constraints; its undocumented historical alternative points to Article V. The check does not calculate an absent Section 43-10 cap or apply either alternative to an unidentified property.

## Retained-draft findings

The latest actual provider draft now clears the missing-source binding and nominal lead checks in offline replay without changing its narrative. The two omitted historical branches are now explicitly detected. Other ordinary rule descriptions still trigger the mapped-location validator. No new live answer has been accepted, and the remaining grammar problem must be repaired before another paid attempt.

The earlier C06 draft likewise lacks the two branches. Its replay now distinguishes those real omissions from its corrected binding and missing-fact issues. Handwritten completeness contrasts were updated and labelled as test doubles, not provider outputs. A fuller grammatical reconstruction sentence still exposed the known map-validator false rejection; the compact test double does not establish that the broader grammar problem is fixed.

## Verification and limits

Targeted source-binding tests cover immutable inputs, idempotence, exact source/citation identity, cross-corpus and edition ambiguity, absent text, and the mandatory-verifier prerequisite. The actual HTTP handler is exercised with an accepting and a rejecting verifier double after a binding repair. An initial expanded test exceeded its disposable account's 30-request protection; the duplicate binding scenario was removed while retaining both acceptance and rejection, without changing runtime rate limits.

Validation logs for this pass:

- `/tmp/permitext-source-binding-contract-20260909.log`
- `/tmp/permitext-source-binding-safety-20260909.log`
- `/tmp/permitext-storage-branch-contract-20260909.log`
- `/tmp/permitext-storage-binding-quality-20260909.log`
- `/tmp/permitext-storage-binding-replay-20260909.log`
- `/tmp/permitext-storage-binding-planner-20260909.log`
- `/tmp/permitext-source-binding-research-suite-20260909.log`

The full `npm run test:research-chat` suite passed (exit 0), including the 30-flow conditional HTTP contract with accepting and rejecting verifier doubles after source-binding repair. The separate mapped-safety contract and `npm run test:zoning-architecture-v2` also passed. `git diff --check` and syntax checks passed. These are local, intercepted-provider checks; their simulated token/cost entries are not provider spending or live quality measurements.

The retained cost audit still records $7.375051 conservatively against the fresh $8 allowance, leaving **$0.624949**. The account balance/invoice was not checked. No Project/Notebook/Reports/export workflow, UI, phone, push or deployment work was performed.

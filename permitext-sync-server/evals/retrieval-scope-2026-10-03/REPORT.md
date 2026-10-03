# Retrieval scope candidate — source-reviewed result

The frozen candidate is **not accepted for production**. In the final 50-turn run, 39 answers were correct, 7 were withheld, 3 were materially wrong, and 1 had a minor issue. These are correlated, assistant-authored evaluation cases reviewed against source text, not an estimate of overall product accuracy or professional adjudication.

## What improved locally

- Current-library recall no longer mistakes ordinary words such as “only 8 inches” for a restriction to one code book. Explicit source and selected-passage restrictions remain honored.
- Canonical chapter/district scope travels with sources. Current district statements override stale hints, and unrelated special-district rules receive lower ranking.
- Current references receive priority without allowing every inherited citation to dominate a new question. Ordinary physical-support and application questions are distinguished from source-relevance comparisons.
- Complete canonical dependencies precede optional definitions. A referenced provision that does not fit the evidence budget is explicitly unresolved; partial prefixes are not labeled complete.
- Reusable corpus partitions and compact postings reduce peak index memory by 42% in the measured local build. The same 12 comparison searches returned byte-identical results.
- The isolated runner now loads and asserts project links and structured facts using the application’s normalization path. This is a local HTTP check, not a production browser check.

## What still fails

The source reviews distinguish retrieval from subsequent interpretation and delivery. Correct source IDs alone do not demonstrate that the decisive text reached the model.

- A cylinder follow-up lost its governing fire-code source.
- A tank question missed the decisive subsection despite retrieving the parent section.
- A mixed-use zoning question retrieved commercial-only provisions without the applicable mixed-building provision and applied the wrong minimum.
- Four answers with correct principal rules were discarded for ancillary citation or binding defects. A fifth nonanswer involved a general-versus-specific provision conflict without the code’s interpretation clause.
- Both fire-watch turns were materially wrong despite complete decisive text. In the first, the verifier rejected a correct draft and directed the wrong interpretation. The [FDNY F-01 guidance](https://www.nyc.gov/site/fdny/business/all-certifications/cof-f01.page) confirms that the initial four-hour allowance covers planned and unplanned outages. A verifier pass is not a correctness label.

## Evaluation integrity

The candidate and fixture hashes were frozen before the paid answer run. Source reviewers verified actual writer packets, operative text, citations, project facts, and final outputs. A first run was stopped after six answers because a separate synthetic dependency test exposed an unsafe parser assumption. Those outputs were not inspected before the correction. The final result must therefore separately identify 44 first-execution turns and 6 blind repeated turns. No score from retuning these now-known cases can be presented as fresh validation.

Twenty distinct focused contracts passed for this candidate. Every recorded provider call is settled. Generation used the existing GPT-6 Luna low writer and medium verifier on the standard tier. No production model setting, user research history, push, or deployment changed.

Timing is warm local HTTP timing: fixture-wide preflight warms the corpus and query caches. It does not establish hosted performance or cold-start behavior. Hosted semantic query calls remain guarded off until they are integrated with the durable research-spend reservation path.

## Next work

1. Repair secondary citation defects without inventing a “no governing evidence” result or erasing independently supported conclusions. Recheck the repaired answer against the sources.
2. Add edition-matched interpretation and applicability context, including mixed-use overrides, without treating search metadata as proof that a rule applies to the project.
3. Preserve verified subject/source continuity while allowing explicit new facts, hypotheticals, editions, and topic changes to override prior assumptions.
4. Improve subsection-level recall and complete parent/child/table/exception assembly; measure decisive-text delivery separately from final-answer correctness.
5. Run new reserved ordinary-language conversations after implementation, including structured project facts, follow-ups, and unrelated topic changes. A release claim also needs independent professional review and hosted accounting/browser checks.

Raw request/response evidence is archived outside Git. See `archive.json` for locations, hashes, and exact campaign accounting; `heldout-summary.json` and the three review files provide the final breakdown. New code updates require corpus-version ingestion, reindexing of changed text, invalidation of stale caches, and regression checks rather than retraining the answer model.

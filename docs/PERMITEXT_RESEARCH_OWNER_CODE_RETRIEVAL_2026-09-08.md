# Permitext Research — Owner code questions and retrieval

September 8, 2026. Local development evidence; no deployment.

The owner's 60 additional questions exposed a broad retrieval weakness. Large dictionaries and long, unrelated provisions accumulated matches across their full text and displaced short governing rules. The model often received roughly 42,371 characters while still lacking a reviewed reference.

## Measured local result

| Diagnostic | Before | Revised |
|---|---:|---:|
| Cases containing every reviewed reference | 30/60 | 44/60 |
| Cases retrieving no evidence | 1 | 0 |
| Average evidence characters | 42,371 | 16,067 |
| Additional paraphrases and changed-value questions containing every reviewed reference | — | 9/10 |

The revised package is about 62% smaller on average. Fourteen cases gained complete exact-reference coverage; all 30 cases with complete coverage before the change retained it. These are **retrieval measurements**, not model-answer scores or observed end-to-end speed. A missing parent/group reference can sometimes be supported by an included child, and a present reference does not establish completeness, applicability or a correct answer.

The comparison artifact records all 60 before/after results, all ten variants, question wording, reference identities, source-text hashes, review provenance and runtime-file hashes. Original and corrected answers never enter the answering input. The diagnostic disables network access and records zero network attempts and zero provider calls.

## Implementation

- Rank local passages using word frequency, rarity and passage length, with a modest discipline preference. Preserve explicit citations and reviewed topic routes ahead of lexical matches. No expected answers or numerical code rules are embedded in ranking.
- Normalize punctuation, hyphenated words and plural forms consistently between the shipped index and the query. Preserve numbered references.
- Resolve structured tables and image metadata after candidate ranking, retaining every selected source's review requirements and missing-source restrictions.
- Keep a separate, bounded opportunity for relevant definitions. Reviewed design dependencies retain priority and their existing request budget. A ramp regression caught an excessive dictionary expansion; the complete ramp baseline and dimensional dependencies now pass the established $0.50 request-envelope checks again.
- Recognize that a question about the scope of an optional 1968-code election for new technical work needs the current applicability rules. Historical technical text remains subject to the existing eligibility boundary.
- Restore governing source routes for exterior-opening calculations, structural-frame ratings and fire-barrier duct exceptions. Type I/II kitchen hoods do not trigger the building construction-type route.
- Narrow the fixture-count route so a backwater-protection question is not automatically treated as a fixture-count calculation. Recognize plural gas-appliance wording in the existing combustion-air route.

## Remaining failures and limitations

Sixteen original cases still lack at least one exact reviewed reference. They are FGC-02, FGC-05, FGC-09, MC-01, MC-04, MC-07, GAP-01, GAP-02, GAP-08, GAP-09, GAP-10, GAP-11, GAP-14, GAP-15, PC-04 and PC-12. The held-out apartment return-air question also misses MC 403.2.1. These remain failures to investigate; the answer key has not been changed to excuse them.

The misses have different implications. GAP-01 now retrieves the central election rule, AC 28-101.4.3, but lacks the additional AC 28-102.4.3 reference. GAP-08 retrieves the material-misrepresentation language in AC 28-105.10.1 but lacks its parent. FGC-02 is more concerning: retrieval selects the sleeping-room direct-vent provisions while omitting the general bathroom/location rule in FGC 303.3. PC-12 omits the actual prohibition on reducing drainage-pipe size downstream. Those substantive gaps need priority over improving a reference-count score.

The separate 60-case source review retains 53 original answers and revises seven. That review, retrieval recall and actual Research answer quality are separate kinds of evidence. PDF concision, the earlier construction-code completeness findings, useful missing-property-fact answers and service-wide latency remain open.

## Reproduction

Validation passed: the complete `precheck` phase; the main check via `npm --ignore-scripts run check` after correcting the retrieval dataset's stale version label; `npm run smoke`; 27 original benchmark cases/55 required references; 36 distinct benchmark cases/92 references; all 20 draft retrieval cases; the current 30-case zoning preflight; and scoped diff/credential checks. The aggregate command's earlier failures remain diagnostic history, not successful runs. No approval status or historical consumed evaluation artifact was changed.

`npm run eval:research:owner-code-retrieval` runs the 60 questions without network access. Add `-- --variants` for the ten additional questions. `--output=/absolute/path/result.json` creates a new result and refuses to overwrite an existing file.

The one-attempt live confirmation runner is `scripts/run-research-owner-confirmation-20260908.mjs`. Its default mode is a no-network preflight. The live package contains seven new code questions and the previously blocked FAR calculation, one attempt each, with $0.60 per turn and an absolute $4.80 sum ceiling. It checks the preceding pilot's settled conservative spend against the owner's approximately $8 total authorization and uses an isolated local account and store. A permanent result lock prevents replay. A prepared runner is not evidence that the live test has run.

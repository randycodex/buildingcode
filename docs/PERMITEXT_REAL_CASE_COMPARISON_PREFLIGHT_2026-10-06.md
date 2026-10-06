# Real-case instruction comparison: preparation

The supplied collection contains 80 unique public-question URLs and 80 unique case IDs, with ten cases in each of eight code families. The dataset and 240 candidate writer requests are prepared. No model answers or correctness scores have been generated, and no Permitext behavior has been changed.

## Frozen materials

- Source: `nyc_real_code_questions_80.json`, supplied by the user.
- Source SHA-256: `e0e5f788f79fca3fa8b4cf8fe36bc1405856567867c1a0e062f04f8e0db4e041`.
- Retrieval code: `bf95e36b6`; preparation scripts are recorded in the next task commit.
- Private preparation directory: `/Users/randy/.codex/experiments/permitext-real-cases/20261006-v2`.
- `source.json`: unchanged copy of the supplied file.
- `model-inputs.json`: questions, user-supplied facts, original-location status, NYC scenario context and research date. Expected answers, authority lists, missing-fact labels and grading rubrics are excluded.
- `reference-review.json`: expected answers, authorities, provenance and rubrics, all still draft and not independently certified by this exercise.
- `evidence-packets.json`: frozen local retrieval evidence.
- `preflight.json`: retrieval audit and per-case source identities.
- `writer-requests/`: 240 prepared requests, with no credentials or request headers.
- `writer-request-preflight.json`: hashes and proof that the three arms share the same input, model, effort, output allowance and response schema.
- `comparison-plan.json`: proposed comparison and remaining steps.

## Local retrieval findings

All 80 cases returned some local evidence, without network attempts or provider calls. Having sources does not establish relevance, completeness or correctness. As a coarse coverage indicator, 27 packets contained no source with the case's listed code-family prefix:

| Case family | Cases | Packets containing that family | Packets missing that family |
| --- | ---: | ---: | ---: |
| Building | 10 | 10 | 0 |
| Plumbing | 10 | 9 | 1 |
| Mechanical | 10 | 10 | 0 |
| Fuel Gas | 10 | 9 | 1 |
| General Administrative Provisions | 10 | 9 | 1 |
| Energy | 10 | 0 | 10 |
| Electrical | 10 | 0 | 10 |
| Zoning | 10 | 6 | 4 |

The energy and electrical Reader sources are present in the 2025 specialty bundle, but the automatic Research corpus registry has no ECC or EC corpus. The electrical Reader category identifies NYC amendments; its presence does not establish availability of the complete adopted NEC. This is an evidence-access issue to measure separately from writing restrictions.

Other missing-family cases are `PC-02`, `FGC-02`, `GAC-10`, `ZR-03`, `ZR-08`, `ZR-09`, and `ZR-10`. Their cross-code questions may involve several authorities; this indicator is not an automatic failure or a legal correctness judgment.

The retrieval profile uses production corpus and evidence-assembly functions, local lexical search, and local access to draft Zoning diagnostics. Web support and semantic search are disabled. It does not establish hosted Production behavior. The Zoning registry identifies text through August 13, 2026, while the supplied reference collection is dated October 6, 2026; matching snapshot coverage remains to be checked.

## Reference review

The source declares 258 authority references across 128 unique URLs. Twelve original questions have indexed, blocked or unavailable-page access notes. Preserve those provenance limits.

`EC-03` and `EC-04` explicitly retain unverified adopted-NEC text flags. `MC-08` is expressly adapted to NYC from a source with unknown jurisdiction. `ECC-10` preserves a historical filing and approval question. These distinctions are retained in the comparison inputs or reference review as appropriate.

The edition framework was checked against DOB's [Energy Code page](https://www.nyc.gov/site/buildings/codes/energy-conservation-code.page), [Electrical Code page](https://www.nyc.gov/site/buildings/codes/electrical-code.page), and [Existing Building Code page](https://www.nyc.gov/site/buildings/codes/existing-building-code.page). DOB identifies March 30, 2026 for the 2025 NYCECC filing transition, December 21, 2025 for the 2025 Electrical Code's full effect, and July 17, 2027 for the Existing Building Code. These checks do not verify every expected answer or every referenced provision.

## Controlled writer experiment

Each of the 80 cases has three requests using `gpt-6-luna`, low reasoning, the same frozen evidence, factual context, citation schema, default service tier and 24,000-token output allowance:

1. **Minimal:** 131 characters of Permitext-specific instructions, retaining the response format and citation identifiers.
2. **Simplified:** 597 characters emphasizing a direct supported answer, useful conditional application, material qualifications and accurate citations.
3. **Current policy set:** the current writer's policies, including policy text originally mixed into the data input, consolidated into the instruction field. Instruction length ranges from 31,893 to 40,753 characters.

This isolates policy sets over identical data. Consolidating the current policies changes their message placement, so this arm must not be represented as an unchanged full Permitext request. A separate full-pipeline replay is required to measure actual retrieval, pre-generation blocks, review vetoes, repairs and delivered answers before making the final restrictions decision. The minimal arm retains common interface constraints and provider behavior; it is not a reproduction of ChatGPT's undisclosed configuration.

Generate and save every first answer before grading. Rotate arm order, blind the grader to arm names, and score correctness, completeness, directness, unnecessary refusal, citation support and material uncertainty separately. Draft-reference disagreements and missing authoritative text must remain visible instead of becoming automatic model faults. Report writer-only and full-pipeline results separately.

## Validation and next step

The dataset integrity and three-arm control contract passed, including answer-key exclusion, duplicate/count/URL checks, safe case IDs, preservation of review flags and detection of mismatched model controls. All 80 retrieval preparations and all 240 writer-request preparations completed. Provider calls: **0**. Application, production configuration, user accounts and Research history were untouched.

The next proposed paid scope is one answer per arm per case (240 answers), followed by blinded comparative review. A dollar cap must be authorized before dispatch, with pricing checked and budget enforcement proved before the first paid request. No restriction changes or final decision are authorized by this preparation.

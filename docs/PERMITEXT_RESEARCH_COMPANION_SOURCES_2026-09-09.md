# Companion-source retrieval and answer scope

The preceding live batch showed that a general user-guide answer could omit a material workflow exception or limit. This pass repairs source selection and source context before another paid diagnostic. It makes no new professional-acceptance claim.

## Changes

- Subsequent-filing questions retrieve the Application User Guide, the complete Subsequent Filings FAQ section, and the NB/Alteration-CO FAQ. This supplies the job-number rule, both public FAQ statements about creation timing, and the specialized completion path.
- Post Approval Amendment questions retrieve the DOB NOW section of the PAA process page, the complete PAA FAQ section, and the Application User Guide. This supplies the same-applicant and one-open-PAA limits, locked fields and the Work on Floors disagreement without substituting the BIS section.
- Stormwater questions retrieve the Application User Guide and DEP's stormwater page. This preserves the separate drainage and numerical conditions alongside the portal field.

These are source locations selected from the question's topic. They contain no reference answer or scoring expectation. Runtime fetches and validates the documents. Explicit requests for another source, no-internet instructions and enacted-code questions retain their existing boundaries. In the 110-case cohort, only DOBNOW-003, 004 and 012 change to these direct-document routes; guidance-only eligibility is unchanged for every case.

HTML extraction now keeps explicitly linked FAQ questions with their complete answers. A link must name one adjacent answer container; missing targets, duplicate IDs and intervening headings do not acquire a question's scope. Ordered and unordered lists retain their complete items and introducing text. Curated HTML sections retain their headings and subordinate conditions; a missing or oversized section fails validation instead of being silently cut. Original document hashes and source-bound persistence remain intact.

The shared drafting/verification instructions now distinguish conflicting instructions from different applicability scopes, require the exact field and responsible attesting party, and discourage unrelated filing branches and invented authorization statements. These prompt changes still require live answer-quality confirmation.

## Evidence

Fresh public GETs through the production fetcher, parser and selector supplied:

| Case | Validated sources | Selected passages | Supplied text characters |
| --- | ---: | ---: | ---: |
| DOBNOW-003 | 3 | 6 | 9,425 |
| DOBNOW-004 | 3 | 5 | 14,379 |
| DOBNOW-012 | 2 | 2 | 7,506 |

The [DOB FAQ](https://www.nyc.gov/site/buildings/industry/dob-now-build-faqs.page), [NB/Alteration-CO FAQ](https://www.nyc.gov/site/buildings/industry/new-building-buildfaqs.page), [PAA page](https://www.nyc.gov/site/buildings/industry/post-approval-amendment-paa.page), and [DEP page](https://www.nyc.gov/site/dep/water/stormwater-permits.page) were retrieved on September 9. Source inspection is recorded in `evals/results/research-owner-companion-source-inspection-2026-09-09.json`. Its hashes identify the code present at that inspection; later plural-query handling was checked separately.

Source-derived HTML test fragments preserve actual headings, FAQ links and lists. The fixture records separate full-page and excerpt hashes. It is never supplied to runtime Research as an authoritative source.

Actual isolated HTTP requests for retained questions 003, 004 and 012, using synthetic PDFs and the HTML fragments with mocked providers, now reach summary, independent verification and persistence with the companion conditions present. They use two provider doubles each, eliminating the initial model search on these routes. These checks prove wiring and evidence availability, not model correctness or measured live speed. Existing invalid-document, rejected-summary and persistence-tampering checks remain in place.

The complete offline `test:research-chat` suite passed (exit 0; `/tmp/permitext-companion-full-suite-20260909.log`). Final natural-language route variants, complete-section failure cases and request-comparison changes also passed their focused contracts after that suite. All 110 authored question/project inputs remain identical to `e7a7d530b`, including 47 evidence references and eight exact selections. The answer key and historical live results were not revised.

## Stable diagnostic comparison

Successive live HTML fetches produced different raw document fingerprints. A second fresh-source inspection proved that all three complete summary requests were equivalent after normalizing only their opaque HTML content-hash and claim-ID fields. Actual passage changes still produced a different request hash.

The optional `normalizeOfficialHTML` mode belongs to the evaluation harness. It retains each passage's URL, text, heading, question, source identity, limitations and exact schema association, plus instructions, model, tier and token ceiling. PDF fingerprints stay strict. It does not change requests sent to a provider, runtime citation validation, saved integrity proofs, or the default comparison used by consumed packages.

The reproducible inspector is `scripts/inspect-research-companion-request-binding-20260909.mjs --fetch-public-documents`; its retained result is `evals/results/research-owner-companion-request-binding-inspection-2026-09-09.json`. It fetched eight public documents and made zero provider requests. This is a request-factory comparison; a new paid package still needs its own committed actual HTTP preflight with the new comparison explicitly enabled.

## Remaining work and budget

No paid API calls were made in this pass. The latest consumed round still has an estimated $3.20868407 in provider usage, $6.188751 in conservative accounting, and $1.811249 of conservative authorization remaining. These are retained evaluation accounts, not a refreshed provider balance.

Coverage remains 98/110 attempted. The 12 unattempted cases and earlier quality defects remain open. Next, verify the repaired paths with real model responses and extend the remaining DOB coverage within that allowance. Also reconcile the occupied-unit reference with the newly identified TPP applicability exceptions before treating it as a complete benchmark. No Project workflow, phone, UI, deployment or professional approval is part of this pass.

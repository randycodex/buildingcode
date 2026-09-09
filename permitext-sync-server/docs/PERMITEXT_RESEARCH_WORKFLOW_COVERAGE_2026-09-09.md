# Research workflow source coverage — September 9, 2026

Two unassigned Research HTTP turns at `d44137366df8261df031e586a5543a153a4f4ada` delivered answers, but neither met the complete unchanged benchmark. Both received a passing runtime verifier response. The remaining problem includes semantic verification of material conditions, beyond retrieval alone.

## Source repair and validation

Before live spending, the filing-representative source packet lacked the current conditional board-stakeholder update. Official workflow routing v8 now includes the release notes alongside the application guide and roles FAQ. The retained February 2026 update on release-note page 20 describes the additional board representative and separate attestations for the specified owner types. The PDF document hash is `03c2b6c9eac3f540be3911f8813b3e1a3591c25f78c7bc721d19d3ce3678b9e0`.

The official PDF HTTP contract checks that the complete update, owner-type condition and existing role guidance reach both drafting and verification. The full offline `npm run test:research-chat` suite and source-selection contract passed. These mocked checks establish source transport, not model understanding.

The v1 preflight was superseded before spending. The committed v2 preflight matched both initial live request hashes. The question and answer-key hashes were unchanged; neither answer-key text nor rubric was supplied to the models. The single-use driver has been consumed and must not be replayed.

## Live findings

| Case | HTTP duration | Provider calls | Usage-derived estimate | Conservative cost | Review |
| --- | ---: | ---: | ---: | ---: | --- |
| DOBNOW-023, filing representative | 10.792 s | 2 | $0.02164665 | $0.041003 | Core authority answer delivered; conditional additional stakeholder omitted |
| DOBNOW-003, subsequent plumbing filing | 11.715 s | 2 | $0.01772080 | $0.032184 | Same-job answer delivered; universal timing claim and missing completion qualifications remain |

The representative answer correctly distinguishes preparation from attestation and submission authority. It omits the board condition despite its presence in the initial source packet, and adds unasked document-age and login instructions.

The subsequent-filing answer preserves the job number and distinguishes a filing extension. It asserts universal creation timing despite the supplied FAQ entries needing reconciliation. It does not explain the job-type-dependent completion path or identify the missing initial job type, and includes unasked examiner, fee and field-entry details.

The source basis is the [DOB NOW FAQ](https://www.nyc.gov/site/buildings/industry/dob-now-build-faqs.page), [NB/Alteration-CO FAQ](https://www.nyc.gov/site/buildings/industry/new-building-buildfaqs.page), and [release notes, page 20](https://www.nyc.gov/assets/buildings/pdf/dob_now_build_release_notes.pdf#page=20), retrieved on September 9. Complete answer reviews and hashes are retained in `evals/results/research-owner-workflow-coverage-answer-review-2026-09-09.json`.

## Budget and evidence limits

The package was capped at $0.40 and four provider calls. It completed with four calls, no paid search, no retry, and no pending reservations. Its usage-derived estimate is $0.03936745 and conservative cost is $0.073187. The round now totals **$7.593176 conservatively against $8**, leaving **$0.406824**. The cumulative usage-derived estimate is $4.00698307. The provider account balance and invoice were not checked.

Retained files are the v1/v2 workflow-coverage preflights, live workflow-coverage v2 result, workflow-coverage cost audit, and manual answer review in `evals/results`, all dated September 9. Full raw verifier inputs were not retained; an offline reconstruction did not match the recorded verifier hashes. Source visibility therefore relies on the matched initial live request and tested runtime path, not a claim of reconstructed verifier-payload identity.

Next, require an explicit account of material qualifications from all supplied passages in the existing verification stage, with local rejection checks before further paid tests. A bare verifier pass is insufficient evidence of benchmark acceptance. All 110 numbered cases remain in scope; historical provider attempts do not establish complete delivery, correctness or professional acceptance. No Project workflow, UI, phone, pricing, push or deployment was exercised.

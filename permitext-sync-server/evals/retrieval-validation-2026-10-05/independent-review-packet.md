# Retrieval acceptance review packet

Status: pending independent interpretation and rubric review. Prepared by the implementing assistant on October 5, 2026. This packet does not change any frozen grade or authorize a release.

The original frozen evaluation remains 35/40 fully correct; the separate exploratory evaluation remains 9/10. Local native diagnostics and exposed-case retests are separate evidence. Missing conditions, avoidable nonanswers and unresolved material interpretations fail acceptance, regardless of a correct headline or weighted score.

Exact shipped source identities, full bodies and SHA-256 hashes are in `independent-review-sources.json`. Review the legal questions below against primary authority and record the source, edition, reasoning and any unresolved disagreement. Neither the frozen answer key nor the model's answer is authority.

## Questions requiring independent interpretation

| Case | Existing frozen finding | Question for reviewer |
|---|---|---|
| PC 802.3.2, hub-drain-height-1 and -2 | Both fail; modifier scope is disputed. The model granted affirmative permission for a flush hub; the frozen key requires a one-inch projection. | Does the projection modifier govern both the hub and pipe alternatives? Is there DOB interpretation or other enacted context that resolves it? If unresolved, what bounded answer is justified? |
| FC 314.5/314.5.1 and BC 903.3.3, diag-covered-display-1 and -2 | Both fail for omitted FC qualifications despite correct BC width boundary. | Identify the scope of the NFPA 13 open-grid/drop-out exception and its interaction with the independent BC obstruction/placement rules. Which qualifications are material to the five-foot and exactly-four-foot scenarios? Do not assume the FC exception waives BC. |
| ZR 37-34, diag-project-transparency-3 | Fails for incomplete sloping-sidewalk explanation. The model refused to establish a high-end datum; the key specifies a local reference. | Does the adjoining-sidewalk phrase establish local measurement along a sloped frontage, and what authoritative support defines the area-calculation method? Separately assess the window start-height condition; endpoint sill heights do not establish glazing percentage. |

Primary sources checked during local work:

- [DOB 2022 Plumbing Code Chapter 8](https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022PC_Chapter8_IndirectWasteWBwm.pdf), PC 802.3/802.3.2. The official wording preserves the disputed grammatical attachment; no decisive DOB interpretation was located in this pass.
- [FDNY Fire Code](https://www.nyc.gov/site/fdny/codes/fire-code/fire-code.page) and [2022 amendment text](https://www.nyc.gov/assets/fdny/downloads/pdf/codes/fire-code-local-law.pdf), PDF pages 130–131, FC 314.5–314.5.2. The text retains obstruction, placement, clearance and a conditional NFPA 13 exception. Independent review of the referenced standard and cross-code effect remains open.
- [DOB 2022 Building Code Chapter 9](https://home4.nyc.gov/assets/buildings/codes-pdf/cons_codes_2022/2022BC_Chapter09_FireProtectionWBwm.pdf), BC 903.3.3. The width trigger and obstruction control appear together; the stated kitchen-equipment exception has a separate subject.
- [DCP ZR 37-34](https://zoningresolution.planning.nyc.gov/article-iii/chapter-7/37-34). It distinguishes the area band, window start height, widths and excluded portions. A specific official sloping-frontage calculation interpretation was not located in this pass.

## Proposed final acceptance gate

Review `acceptance-review-fixture.json` and `acceptance-review-sources.json` before any generation. The forty questions comprise twenty paired conversations; paired turns are correlated and must be reported that way. Exact source snapshots establish a review starting point, not a complete approved answer rubric. The reviewer must add any material parent, definition, exception or referenced-standard conditions required for each bounded question.

Record independent approval separately with the fixture hash and source hashes. Do not edit exposed questions or relax a check after seeing generated answers. If a genuine ambiguity remains, retain it explicitly and resolve it before a final freeze.

After source/rubric review and any demonstrated fixes, freeze the final code hashes and run this cohort once through the real local native Responses backend with Luna low drafts, medium reviews and high repairs. Preserve the existing ledger and $10.99 cap ($2.99 diagnostics, $8 fresh). Count every delivered turn, including withheld answers. The proposed sample gate is at least 38/40 fully correct, zero accepted confirmed material errors and no unresolved material disputes. This is a scoped sample gate, not a guarantee of 95% accuracy in general use.

Production browser sign-in, actual subscription access and hosted native transport still need separate validation. No deployment is part of this review.

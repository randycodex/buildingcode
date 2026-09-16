# Original 137: remaining source gaps

Reviewed 2026-09-16 after commit a4cd16fce. **127 resolved; 10 unresolved.**
This is an incomplete task, not a redefinition of completion. The baseline is
`471267018`; the review ledger retains exactly its 137 unresolved IDs and terms.

## External texts still needed (4 original references)

| Original reference | Required source | Verified boundary / missing evidence |
| --- | --- | --- |
| 2014 BC BALCONY, EXTERIOR | ASCE/SEI 7-05 §4.1 | BC 1602.1 refers to ASCE 7; BC 1601.1 explicitly means the 2005 edition. Publisher text could not be fetched. Do not substitute a later edition or a generic architectural definition. |
| 2014 BC DECK | ASCE/SEI 7-05 §4.1 | Same exact edition chain. Search results show possible reproductions, but no reviewed authoritative publisher text is archived. |
| 2022 BC EFFECTIVE WIND AREA | ASCE/SEI 7-16 with Supplement No. 1 and applicable NYC Chapter 16 modifications | Chapter 35 identifies this edition. No complete, edition-verified definition and its qualifications have been reviewed for this original reference. A short search snippet is insufficient. |
| 2022 BC ELECTRIC VEHICLE SUPPLY EQUIPMENT (EVSE) | NYC Electrical Code §625.2, using the governing NEC edition and NYC amendments | NYC LL39/2011 adopts NEC 2008. Its amendment PDF is available and contains no §625 change; the underlying NEC definition is not in the local corpus. Seattle's official 2008 code reproduction appeared in search but the PDF could not be retrieved (404/403). Do not use a newer NEC body or infer equivalence from snippets. |

Publisher and primary-source locations checked:

- ASCE/SEI 7-05: https://ascelibrary.org/doi/book/10.1061/9780784408094
  (search identifies the edition and chapter; direct fetch failed).
- NYC LL39/2011: https://home4.nyc.gov/html/dob/downloads/bldgs_code/electrical_code_local_law_39of2011.pdf
  (downloaded to `/tmp/permitext-electrical-2011.pdf`, 102 pages).
- NYC's 2022 electrical interpretation page confirms NEC 2008 plus NYC amendments:
  https://www.nyc.gov/site/buildings/codes/ecric-code-interpretations-2022.page
- Seattle reproduction candidate:
  https://www.seattle.gov/documents/Departments/SDCI/Codes/2008ElectricalCodeReplacementPages.pdf
  (not retrieved; not used as a definition source).

A supplied authoritative copy/excerpt of the applicable standards would allow
review to continue. No purchase, account access, or unverified mirrored standard
has been used to fill these definitions.

## Published target mismatches still requiring an authoritative resolution (6 originals)

| Original reference | Current source evidence | Why it remains unresolved |
| --- | --- | --- |
| 2014 BC DRY-CHEMICAL EXTINGUISHING SYSTEM → §902.1 | `2014-construction-codes/chapters/bc-9.html` defines DRY-CHEMICAL EXTINGUISHING AGENT | The extinguishing agent is not the whole system. No exact system definition was verified at the cited target. |
| 2014 BC THERMALLY ISOLATED SUNROOM ADDITION → §1202.1 | `2014-construction-codes/chapters/bc-12.html` defines SUNROOM and THERMAL ISOLATION separately | Combining separate meanings would synthesize a definition not printed as the referenced compound term. |
| 2014 MC POWER BOILER → Boiler | `2014-construction-codes/chapters/mc-2.html` has high-pressure and low-pressure boiler definitions | The unqualified referral does not identify a subtype. Do not select high pressure based solely on terminology from another standard. |
| 2022 MC POWER BOILER → Boiler | `2022-construction-codes/code-sections/mechanical-code/chapters/Chapter 2.html` has high-pressure and low-pressure boiler definitions | Same unresolved subtype selection. ASME and other jurisdictions have differing scope wording; those do not establish this referral by themselves. |
| EBC ACCEPTANCE OR ACCEPTED → AC §28-101.5 | Reviewed LL42/2026 §4 replacement and its archived provenance omit this named definition | Reusing the earlier administrative meaning without evidence would cross the EBC effective regime. |
| EBC WORK NOT CONSTITUTING MINOR ALTERATIONS OR ORDINARY REPAIRS → AC §28-101.5 | LL42/2026 §4 page 18 deletes the named referral to §28-105.4.2.1 | The old onward reference is expressly deleted; it is not a verified terminal meaning for the EBC. |

Corpus paths above are relative to
`NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/`.
LL42 evidence is archived at `docs/source-evidence/ll42of2026.pdf`.
These need an applicable official correction, a demonstrable source chain, or a
product decision to show the unresolved referral as such. Merely labeling them
reviewed does **not** fulfill the original request for resolved meanings.

## Verification boundary

- Latest implementation checks: 130 shared checks passed; web/native registry
  copies match; shared WebView check passes.
- Last native test run: 19 tests passed at the 123-resolution checkpoint, before
  the later data-only oil, dwelling and silt bindings. No later native/touch
  acceptance is claimed.
- All original 137 IDs and terms match the baseline; no originals were removed.
- No production deployment or TestFlight upload is implied by these local results.

Recheck 2026-09-16: worktree and original ledger remain at 127/137. The 2022 BC Chapter 35 source identifies ASCE/SEI 7-16 with Supplement No. 1, as modified by Chapter 16. The source-access and missing-target conditions above remain; no new definition body was added.

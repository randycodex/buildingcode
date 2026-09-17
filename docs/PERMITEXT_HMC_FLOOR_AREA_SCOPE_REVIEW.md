# HMC Floor area scope review — September 17, 2026

Read-only review of all five HMC chapters. No definition activation or product change. This resolved meaning is separate from the ten deferred authoritative-source references.

## Original meaning and source

Entry `4a42b67efbedfa875d15`, §27-2004(a)(22), anchor `section-31001849`, source `2026-enacted-administrative-code/chapters/30000077.html`:

> The floor area is the clear area of the floor contained within the partitions or walls enclosing any room, space, foyer, hall or passageway of any dwelling.

Source SHA-256: `dcc196eed865ed4bad3efa726df9b3855dd8e7cf40ade22bd37c19c5372a6066`. A later implementation must preserve that complete body, ID and citation. No plural alias is supported by this corpus scan: there are zero “floor areas” occurrences.

## Complete occurrence classification

The scan finds 50 exact singular occurrences: seven in §27-2004 definition prose and 43 elsewhere. All 43 were grouped using their complete paragraphs, not isolated snippets.

| Classification | Count | Treatment proposed |
| --- | ---: | --- |
| Room, space, balcony, window or dining-space measurements | 28 | Bounded candidates using the original clear-area meaning; local numeric/window requirements remain controlling |
| Cooling-system definition, §27-2030 | 1 | Keep the entire local declaration plain |
| Total livable/liveable apartment-area calculation, §27-2075(a)(1) | 5 | Withhold all five occurrences conservatively; the paragraph supplies inclusion/exclusion and residual-area counting rules |
| Zoning floor-area-ratio uses, §27-2093.1 | 3 | Exclude; not the HMC room-space definition |
| Whole-building/low-income-housing area, §27-2093.1 | 6 | Withhold; this audit does not establish equivalence with HMC room clear area |

The 28 supported candidates span **§§27-2058, 27-2059, 27-2060, 27-2061, 27-2062, 27-2071, 27-2073, 27-2074, 27-2075, 27-2083 and 27-2085**. This includes all reviewed ordinary application contexts, not merely §§27-2073/2074. These are candidate scopes, not accepted rendered links.

Use that explicit section allowlist, existing definition exclusions and five exact occurrence exclusions in §27-2075, each targeting occurrence zero inside every matching phrase:

- `total livable floor area`
- `residual floor area`
- `floor area of a kitchen or kitchenette`
- `total liveable floor area`
- `floor area for private halls`

Each phrase occurs once in the guarded section. The remaining §27-2075(a)(2) occurrence concerns the minimum area of a living room and remains a candidate. The five withheld uses should not be characterized as proven false meanings: withholding conservatively avoids presenting the generic definition as the complete local occupancy calculation.

§27-2030's occurrence sits inside the definition of approved cooling system. All nine §27-2093.1 occurrences are deliberately outside the proposed allowlist. Existing §27-2004 definition prose remains plain. Missing source context must fail closed; any future use of descendant section semantics remains subject to the exact guarded corpus and ordinary source-change review.

## Reproducible evidence

Run from repository root:

```sh
node permitext-sync-server/scripts/audit-hmc-floor-area-applicability.mjs /tmp/permitext-hmc-floor-area-audit.json
```

The script guards all five HMC source hashes and the complete original Floor area body, records the current registry hash, and emits exact source/section/anchor, paragraph index, full paragraph text and SHA-256, plus UTF-16 occurrence ranges and classifications. It also emits the proposed section list and five explicit exclusion rules, checking their exact occurrence counts. No published registry is written.

Evidence output: `/tmp/permitext-hmc-floor-area-audit.json`; run summary: `/tmp/permitext-hmc-floor-area-audit.log`. Future implementation still requires complete-registry matching, source/identity invariants, web/native tests and rendered acceptance. This audit does not supply those acceptance layers.

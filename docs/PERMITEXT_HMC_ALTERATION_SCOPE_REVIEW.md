# HMC Alteration scope review — September 17, 2026

Source audit only. Alteration remains withheld; no product registry or definition wording changed. This review is separate from the ten deferred authoritative-source entries.

Original ID `4d33bc1533510d86e707`, §27-2004(a)(44), source `2026-enacted-administrative-code/chapters/30000077.html#section-31001849`. Preserve the whole definition, covering changes/rearrangements of structural parts or existing facilities, enlargement by extension or increased height, and relocation. Do not replace it with a general permit description.

The repository script `permitext-sync-server/scripts/audit-hmc-alteration-scope.mjs` checks all five source hashes and scans every direct section paragraph for singular/plural Alteration. It records 19 raw occurrences in 12 paragraphs: one general definition, one local definition, ten external-category contexts, one permit compound and six ordinary candidates. These classifications are review decisions encoded explicitly; counts are not rendered acceptance.

| Context | Count | Decision |
| --- | ---: | --- |
| §27-2004 | 1 | General defining prose; keep plain. |
| §27-2074(f) | 1 | Explicit replacement definition limited to subdivisions (a) and (e), including some conversion without physical change. Keep declaration plain and do not apply the general definition to that local use. The singular/plural audit finds no other Alteration label in §27-2074; references by other wording are outside this lexical count. |
| §27-2009.2 | 1 | “minor alterations” appears in a permit-work exemption contrast. The generic change definition does not define the minor-work category; not accepted here. |
| §27-2093 | 8 | Certification/permit provisions explicitly refer to Building Code §27-198 regulations and §27-227 enforcement. The full local context must be reconciled with those imported categories; do not assume an unqualified HMC meaning. |
| §27-2093.1 | 1 | Alterations of the type prescribed by rule under §28-505.3 item 5; preserve that explicit external category. |
| §27-2044 | 1 excluded; 1 candidate | Keep “alteration permit” plain, while the neighboring plural “alterations to be made in an apartment” is a physical-work candidate. A whole-section exclusion would lose this supported neighbor. |
| §27-2056.5 | 2 candidates | “substantial alterations” and “such alterations” concern removal/permanent covering of lead-based paint. The full general change/facilities meaning can be presented without claiming it defines the additional substantial-work qualification. Preserve the operative requirements. |
| §27-2066 | 1 candidate | Alteration increasing apartments expressly includes subdivision, conversion or enlargement; consistent with the original meaning. |
| §27-2077 | 1 candidate | “with or without physical alterations” distinguishes physical work from use conversion; retain that distinction and the source's rooming-unit restrictions. |
| §27-2089 | 1 candidate | Current alteration under approved plans to eliminate interior rooms or install sanitary facilities; consistent with the source definition. |

The six ordinary candidates include the source-attested plural `alterations`. A later implementation must preserve the original singular entry/body/citation, add only that reviewed alias, and use exact positive section scopes with an occurrence exclusion for “alteration permit” in §27-2044. The external-category exclusions above do not establish a replacement meaning or invent new definitions. Full-registry matching, source-preservation tests, native validation and rendered popup checks remain required before activation.

Reproduce with `node permitext-sync-server/scripts/audit-hmc-alteration-scope.mjs /tmp/permitext-hmc-alteration-scope.json`. The output contains complete original entry, source/paragraph hashes, section/anchor, paragraph index, exact UTF-16 ranges and classification. No app, phone or provider state is changed.

## Production matcher follow-up

The portable audit now runs the hypothetical scope through the complete production registry matcher and checks each reviewed positive and negative occurrence. It returns 6 prospective matches. This closes the matcher integration gap without activating the entry; rendered and native implementation verification remain pending.

# Title 26 definition source inventory

September 17, 2026. Discovery only; no meanings extracted or activated. This review concerns the bundled authored corpus, not an independent legal currency check.

`node permitext-sync-server/scripts/audit-title26-definition-sources.mjs /tmp/permitext-title26-source-inventory.json` now inventories all 38 Title 26 files and 41 heading/inline declaration candidates. The older 30-heading count did not include the current inline discovery rules. Candidate counts do not establish complete definition extraction: a scope declaration can be a rule rather than a noun definition, and other formats may escape discovery. Each file retains its SHA-256, chapter ID, title, printed chapter number and each candidate's anchor.

## Identity boundaries before activation

The actual source files contain repeated printed citations with different bodies:

| Printed citation | Distinct source chapter IDs | Different subject matter |
| --- | --- | --- |
| §26-2101 / Chapter 21 | 30000039, 30000040 | Affordable Housing Plan Report; Short-Term Residential Rentals |
| §26-3001 | 30000048, 30000051 | Tenant Data Privacy (Chapter 30); affordable-housing zoning enforcement (Chapter 33) |
| §26-3701 / Chapter 37 | 30000055, 30000056 | Creation of Homeownership Opportunity Units; Sales of Cooperative Apartments |

Chapter 13 also occurs twice (30000031 and 30000032); only the latter contributes discovered definition candidates. These are separately represented corpus chapters, not authorization to merge or renumber enacted text.

Direct inspection confirms the two §26-2101 Dwelling unit entries differ: one refers to the HMC meaning, while the short-term rental text adds a building-within-the-city qualification. The two §26-3701 collections have different labels and scopes. The §26-3001 Tenant Data Privacy collection includes Authentication data and Biometric identifier information, while the Chapter 33 collection defines Affordable housing unit and Authorized monitor. Printed section identity alone is therefore insufficient for resolving or selecting these meanings.

The current web selector receives bundle, code section ID, chapter number and section number, but no chapter file ID. It cannot distinguish the two Chapter 21 or two Chapter 37 sources with those same values. Before enabling affected definitions, carry exact source chapter identity through web/native selection and any cross-reference resolver, or retain affected entries as review-required until that support exists. A broad chapter-number allowlist is not accepted. This is a newly verified implementation prerequisite, not a claim that currently published Title 26 popups are wrong: these sources are not yet independently indexed.

## Remaining work

Review extraction boundaries and full bodies for all discovered sources, resolve explicit referrals without substituting another edition, inspect each meaning's application scope, preserve definition prose as plain text, and then verify web/native selection and rendering. Construction-related Local Law amendment definitions remain a separate uncompleted audit. The ten previously deferred authoritative-source entries remain unchanged.

Validation: `node --test permitext-sync-server/tests/title26-definition-source-audit.mjs permitext-sync-server/tests/definition-section-discovery.mjs`. Actual-corpus tests preserve all three duplicate citation pairs and both §26-3601/3602 inline declarations. They verify discovery identity retention, not production selection support or semantic acceptance.

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

The initial audit found that web/native definition selection received printed chapter and section numbers without the source chapter ID. The follow-up now carries `chapter.id` through web, native text and HTML-fallback contexts and supports `applicableChapterIDs` as an additional required allowlist. Missing IDs fail closed for ID-scoped entries. Whole-definition-chapter exclusions distinguish sibling file IDs when available and remain conservative without IDs. Compilation and occurrence-audit caching preserve those IDs. Existing published registry selection is unchanged; no Title 26 entry is activated. The separate cross-reference resolver still needs review before extracting and resolving these sources. A chapter-number allowlist alone is not accepted. Native file loading was independently inspected: PublishedHTMLContentStore already prioritizes the stable ID filename supplied by CodeLibraryViewModel. No chapter-file routing repair was required.

## Remaining work

Review extraction boundaries and full bodies for all discovered sources, resolve explicit referrals without substituting another edition, inspect each meaning's application scope, preserve definition prose as plain text, and then verify web/native selection and rendering. Construction-related Local Law amendment definitions remain a separate uncompleted audit. The ten previously deferred authoritative-source entries remain unchanged.

Validation: `node --test permitext-sync-server/tests/title26-definition-source-audit.mjs permitext-sync-server/tests/definition-section-discovery.mjs`. Actual-corpus tests preserve all three duplicate citation pairs and both §26-3601/3602 inline declarations. They verify discovery identity retention, not production selection support or semantic acceptance.

## Chapter identity verification

144 JavaScript registry/HMC tests passed (`/tmp/permitext-chapter-identity-js.log`), including compiled duplicate-number fixtures and unchanged actual administrative-corpus selection. Offline and UX contracts passed. The iOS test build succeeded, then the targeted native identity unit test passed on the physical iPhone in 0.007 seconds: `/tmp/permitext-chapter-identity-native.log`, `Test-permitext-2026.09.17_21-52-19--0400.xcresult` in the reused DerivedData Logs/Test directory. Direct development build 86 was installed by that run, and normal Permitext was relaunched afterward. This is native logic verification, not rendered acceptance of new Title 26 meanings. TestFlight remains 84. The initial generic compilation used the default build number and was not installed.

The shipped registry has not gained ID-scoped entries. Before any such data activation, ensure older clients cannot interpret those entries as broad scope merely by ignoring the new metadata; client compatibility is part of the activation gate.

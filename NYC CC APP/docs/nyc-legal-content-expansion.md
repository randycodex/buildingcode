# NYC enacted-text expansion inventory

Permitext's legal-content expansion is limited to text enacted by New York
City. RCNY agency rules and all guidance or reference material are outside
this scope.

Permitext now bundles:

- NYC Zoning Resolution
- NYC General Administrative Provisions
- NYC Building Code
- NYC Plumbing Code
- NYC Mechanical Code
- NYC Fuel Gas Code
- 2025 NYC Energy Conservation Code
- 2025 NYC Electrical Code amendments
- NYC Existing Building Code, enacted January 17, 2026 and effective July 17,
  2027
- NYC Fire Code
- 1968 NYC Building Code, retained as historical enacted text
- NYC Housing Maintenance Code
- NYC Noise Control Code
- NYC Landmarks Preservation Law
- Other construction-related provisions of Administrative Code Titles 24–28
- Construction-related Local Laws and unconsolidated enactment, transition,
  applicability, and effective-date provisions

The expanded enacted corpus contains 5,660 sections in 156 reader chapters:

- Administrative Code Titles 24, 25, 26, and 28: 3,499 sections
- 1968 Building Code and Housing Maintenance Code: 1,160 sections
- Fire Code: 415 sections
- Construction-related Appendix A Local Laws: 225 sections
- Energy Conservation and NYC Electrical amendments: 361 sections

These collections use the same prepared chapter catalog, section catalog,
chapter body, section body, and search-index organization as the construction
codes. The reader presents them in grouped menus for Construction Codes,
Historical and Housing Codes, Administrative Code Titles, and Local Laws and
Transitions.

## Administrative Code Bulk XML coverage

The City-contracted code library exposes a complete Bulk XML download for the
New York City Administrative Code. The importer at
`permitext-sync-server/scripts/import-nyc-enacted-admin-code.py` extracts only
the enacted text and legal hierarchy. The inventory script at
`permitext-sync-server/scripts/inventory-nyc-legal-expansion.mjs` identifies
the relevant enacted collections and snapshot metadata without downloading
individual sections:

- Title 24 — Environmental Protection and Utilities, including the Noise
  Control Code
- Title 25 — Land Use, including the Landmarks Preservation Law
- Title 26 — Housing and Buildings
- Title 27 — Construction and Maintenance, represented by separate 1968
  Building Code and Housing Maintenance Code reader collections
- Title 28 — New York City Construction Codes, as the current consolidated
  enacted title
- Title 29 — New York City Fire Code
- Appendix A — Unconsolidated Local Laws

The specialty-code importer at
`permitext-sync-server/scripts/import-nyc-specialty-codes.py` extracts the
official integrated 2025 Energy Conservation Code and the NYC-enacted
Electrical Code amendments. It does not reproduce the referenced 2020 NFPA 70
text. The Existing Building Code remains clearly marked with its July 17, 2027
effective date.

## Explicit exclusions

Do not add:

- Any Rules of the City of New York or RCNY agency rules
- DOB, FDNY, or other agency guidance, bulletins, manuals, interpretations, or
  FAQs
- State or federal law that was not enacted into the NYC text
- Referenced model codes, technical standards, or private standards that were
  not enacted into the NYC text
- Publisher annotations, highlighters, front matter, styling, or editorial
  material

First-party agency publications may be used to verify enacted text, adoption
dates, effective dates, and repeal status, but explanatory agency material
does not become part of the Permitext legal corpus.

## Source and publication boundary

The Administrative Code archive is suitable for identifying enacted
collections, extracting hierarchy, tracking its stated current-through date,
and comparing amendments. Before publishing legal text derived from the Bulk
XML, confirm that Permitext has permission to republish that source or replace
it with the corresponding enacted Local Law or first-party NYC publication.

Every published package should record source authority, source URL, archive
hash, adoption date, effective date, repeal status, stated currency,
extraction date, and verification status.

## Refresh command

After downloading and expanding the Administrative Code Bulk XML:

```sh
node permitext-sync-server/scripts/inventory-nyc-legal-expansion.mjs \
  --admin-dir /path/to/Admin/XML \
  --admin-zip /path/to/Admin/XML.zip \
  --write "NYC CC APP/docs/nyc-legal-content-expansion-catalog.json"
```

The generated catalog contains no legal text. It records only source
currency, enacted-text scope, collection boundaries, document/record/section
counts, and hashes needed for repeatable refreshes and change detection.

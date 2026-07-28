# NYC enacted-text expansion inventory

Permitext's legal-content expansion is limited to text enacted by New York
City. RCNY agency rules and all guidance or reference material are outside
this scope.

Permitext already bundles:

- NYC Zoning Resolution
- NYC General Administrative Provisions
- NYC Building Code
- NYC Plumbing Code
- NYC Mechanical Code
- NYC Fuel Gas Code

These six collections must not be duplicated. The current Administrative Code
Title 28 collection may be used to reconcile later enacted amendments with the
existing General Administrative Provisions.

## Missing NYC-enacted text

The authorized missing corpus is:

- 2025 NYC Energy Conservation Code, effective March 30, 2026
- NYC Electrical Code
- NYC Existing Building Code, enacted January 17, 2026 and effective July 17,
  2027
- NYC Fire Code
- 1968 NYC Building Code, retained as historical enacted text
- NYC Housing Maintenance Code
- NYC Noise Control Code
- NYC Landmarks Preservation Law
- Other construction-related provisions of Administrative Code Titles 24–28
- NYC Local Laws that amend or supplement these codes
- Unconsolidated enactment, transition, applicability, and effective-date
  provisions

## Administrative Code Bulk XML coverage

The City-contracted code library exposes a complete Bulk XML download for the
New York City Administrative Code. The inventory script at
`permitext-sync-server/scripts/inventory-nyc-legal-expansion.mjs` identifies
the relevant enacted collections without downloading individual sections:

- Title 24 — Environmental Protection and Utilities, including the Noise
  Control Code
- Title 25 — Land Use, including the Landmarks Preservation Law
- Title 26 — Housing and Buildings
- Title 27 — Construction and Maintenance, including the 1968 Building Code
  and Housing Maintenance Code
- Title 28 — New York City Construction Codes; amendment reconciliation only
  for content already in Permitext
- Title 29 — New York City Fire Code
- Appendix A — Unconsolidated Local Laws

The Energy Conservation, Electrical, and Existing Building Codes have separate
enacted-code or Local Law sources maintained by NYC Department of Buildings.
Construction-related Local Laws should be verified against the enacted text
published by DOB and the New York City Council.

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

# NYC legal-content expansion inventory

Permitext currently bundles the 2022 Building, General Administrative
Provisions, Fuel Gas, Plumbing, and Mechanical Codes, plus the NYC Zoning
Resolution. Those collections must not be duplicated.

The City-contracted code library exposes complete Bulk XML downloads for the
New York City Administrative Code and the Rules of the City of New York. The
inventory script at
`permitext-sync-server/scripts/inventory-nyc-legal-expansion.mjs` uses record
boundaries in those archives to identify the requested missing collections
without downloading sections individually.

## Confirmed missing collections in the Bulk XML

Administrative Code:

- Title 24 — Environmental Protection and Utilities, including the Noise Code
- Title 25 — Land Use, including the Landmarks Preservation Law
- Title 26 — Housing and Buildings
- Title 27 — Construction and Maintenance, including the 1968 Building Code
  and Housing Maintenance Code
- Title 28 — current consolidated Construction Codes provisions; reconcile
  against Permitext's existing General Administrative Provisions instead of
  creating a duplicate
- Title 29 — New York City Fire Code
- Appendix A — Unconsolidated Local Laws

Binding agency rules:

- Title 1 RCNY — Department of Buildings
- Title 2 RCNY — Board of Standards and Appeals
- Title 3 RCNY — Fire Department
- Title 15 RCNY — Department of Environmental Protection
- Title 28 RCNY — Housing Preservation and Development
- Title 29 RCNY — Loft Board
- Title 34 RCNY — Department of Transportation
- Title 62 RCNY — City Planning
- Title 63 RCNY — Landmarks Preservation Commission

## Missing collections published separately

- 2025 NYC Energy Conservation Code, effective March 30, 2026
- NYC Electrical Code
- NYC Existing Building Code, enacted January 17, 2026 and effective July 17,
  2027
- Historical 1938, 1968, 2008, and 2014 codes from DOB's Past Codes collection
- Construction-related Local Laws from DOB and the New York City Council

The Fire Code and FDNY rules also have first-party FDNY publications. The
Housing Maintenance Code has a first-party HPD/DOB PDF. Those sources should
be preferred for publication validation even when the Bulk XML is used to
discover structure and changes.

## Source and publication boundary

The code-library archive is suitable for identifying collections, extracting
hierarchy, tracking the stated current-through date, and comparing
amendments. Do not carry American Legal editorial notes, highlighters,
publisher front matter, styling, or other added material into Permitext.

Before shipping legal text derived from the Bulk XML, confirm that Permitext
has permission to republish that source or replace the text with the
corresponding enacted law or first-party NYC agency publication. Every
published package should record source authority, source URL, archive hash,
adoption date, effective date, repeal status, stated currency, extraction
date, and verification status.

## Refresh command

After downloading and expanding the two Bulk XML archives:

```sh
node permitext-sync-server/scripts/inventory-nyc-legal-expansion.mjs \
  --admin-dir /path/to/Admin/XML \
  --rules-dir /path/to/Rules/XML \
  --admin-zip /path/to/Admin/XML.zip \
  --rules-zip /path/to/Rules/XML.zip \
  --write "NYC CC APP/docs/nyc-legal-content-expansion-catalog.json"
```

The generated catalog contains no legal text. It records only source
currency, collection boundaries, document/record/section counts, and hashes
needed for repeatable refreshes and change detection.

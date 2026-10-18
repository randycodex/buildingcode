# Assistant work categories: NYC DOB source review

Reviewed official NYC DOB pages on October 15, 2026. Implemented locally on `codex/research-context-speed`; no deployment.

## Product decision

The Assistant's Proposed work selector describes research scope. Its labels are adapted for Permitext from DOB project guidance; they are not an exhaustive or verbatim list of DOB NOW filing job types or trade work types. Combined scopes belong in Additional facts. Selecting a category adds only a user-provided work fact and does not establish a permit requirement, Certificate of Occupancy outcome, filing classification, or governing code edition.

DOB's [Project Categories](https://www.nyc.gov/site/buildings/dob/project-categories.page) groups projects into alterations, renovations, building systems, construction equipment, demolition, and new buildings. The [DOB NOW New Building/Alteration-CO FAQ](https://www.nyc.gov/site/buildings/industry/new-building-buildfaqs.page) distinguishes New Building, Alteration, and Alteration-CO job types. Its enlargement guidance explicitly makes CO impact material: an enlargement is not automatically an Alteration-CO. The two vocabularies should not be treated as interchangeable.

## Menu and provenance

| Permitext choice | Basis and intended use |
| --- | --- |
| Unspecified | Permitext control; the user has not supplied a scope. |
| New building | DOB's New Building terminology. |
| Alteration | Broad existing-building changes; retain the user's description without inferring Alteration vs Alteration-CO filing status. |
| Renovation / repair | DOB's [Renovations](https://www.nyc.gov/site/buildings/dob/project-categories-renovations.page): remodeling, repairs, and component renewal. The choice alone does not establish CO consequences. |
| Enlargement / addition | Horizontal/vertical enlargement scope in DOB's [Alterations](https://www.nyc.gov/site/buildings/dob/project-categories-alterations.page) guidance. |
| Change of use or occupancy | DOB's alteration/conversion guidance distinguishes use and occupancy changes. Record specifics in Proposed uses and Additional facts. |
| Building systems work | Short label for DOB's [Building Systems Installation & Modification](https://www.nyc.gov/site/buildings/dob/project-categories-bsim.page), including plumbing, mechanical, electrical, and fire-protection systems. |
| Construction equipment | DOB's [Construction Equipment](https://www.nyc.gov/site/buildings/dob/project-categories-cons-equip.page), such as sheds, scaffolds, fences, chutes, and hoists. |
| Full demolition | DOB's [Build FAQ](https://www.nyc.gov/site/buildings/industry/dob-now-build-faqs.page), Full Demolition section. Partial demolition can be part of renovation/alteration and must not be silently promoted to full demolition. |
| Other | Permitext control for work outside these shortcuts; describe it in Additional facts. |

NB/Alteration/Alteration-CO filing selection and trade work-type codes such as GC, ST, MS, and PL are deliberately not inferred from this field. Their requirements depend on the actual project and further evidence. No model routing, retrieval, or citation checks changed.

## Existing records and verification

Only equivalent legacy menu wording is mapped for display: New construction → New building; Addition → Enlargement / addition; Change of use → Change of use or occupancy. Reading the menu does not rewrite stored work facts or historical answer snapshots. Explicit Save uses the visible selected wording. Unknown custom work descriptions remain available; generic Demolition is not inferred to mean Full demolition.

`npm run test:assistant-context`, JavaScript syntax, and whitespace checks passed. Tests cover category fact round trips, legacy wording preservation, custom labels, bounded context, workspace/account persistence, and unchanged citation-related contracts. Browser verification confirms all ten choices fit the left sidebar, the official guidance link is present, and a new category saves and reloads through the existing context endpoint. No paid model calls were needed.

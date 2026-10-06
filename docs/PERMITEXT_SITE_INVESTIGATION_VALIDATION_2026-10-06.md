# Permitext site investigation validation — 2026-10-06

Local implementation and isolated acceptance only. No Production deployment or physical-device acceptance is established.

## Trigger and behavior

Question: “based on the project address, is this a corner lot site?”
Linked project address: 155 E 182nd Street, Bronx.

Research now resolves the linked address, identifies an unambiguous parcel, obtains its PLUTO lot type and requested DOF lot-face geometry, routes lot classifications to Zoning, and retrieves substantive definition targets instead of aliases. The writer, repair and reviewer receive the same official property investigation context. User wording cannot activate that context by impersonating an official record. A mapped-site conclusion remains explicitly conditional on zoning-lot composition and relevant street lines.

The geometry reader measures straight mapped block-boundary faces; it excludes curved, approximate, erroneous, ambiguous, multipart and self-intersecting inputs. It preserves obtuse and reflex angles and never converts missing records into a negative classification. Public tax-map reads have at most one retry per dataset. Fresh investigation reuse is bounded to the same project, address, version and a 24-hour age; unresolved geometry is retried when needed.

## Live acceptance

The final replay used real NYC property services and gpt-6-luna (low writer, medium reviewer), store:false, one synthetic project/account, temporary local persistence and a $0.50 evaluation cap. It did not change existing user history, production configuration or the earlier comparison budget. General supporting web search was disabled; the official property APIs and local enacted corpus supplied the evidence.

Result: HTTP 200, mode=openai, verification.pass=true. Two provider requests, no repair. Approximately 21 seconds end to end. Estimated provider cost was $0.003660 under the local comparison pricing; actual billing was not independently inspected. This is one site acceptance, not a general accuracy score.

Actual final visible answer:

**Preliminarily, yes:** official records classify tax lot 2031630001 as a corner tax lot, and its two mapped block-boundary faces meet at an approximate 90° angle. That geometry is consistent with the Zoning Resolution’s corner-lot definition, which uses an angle of 135° or less. The zoning classification is conditional, however: it follows only if the zoning lot is the mapped tax lot and those faces are the relevant street lines. The tax records do not establish either point, so this is not a verified final zoning determination. (ZR § 12-10; [PLUTO record](https://data.cityofnewyork.us/resource/64uk-42ks.json?bbl=2031630001); [DOF Digital Tax Map records](https://data.cityofnewyork.us/resource/i38t-6if2.json?bbl=2031630001&%24limit=100), [face data](https://data.cityofnewyork.us/resource/sif6-3bej.json?bbl=2031630001&%24limit=100))

## Checks

Passed:

- New site investigation contracts and real HTTP flow with provider doubles.
- Live official-source and real-provider replay of the exact question.
- Existing property lookup/layers/authenticated sync contracts.
- Corpus registry and inherited-corpus contracts, including Mechanical Code distance questions that mention a side lot line.
- Definition excerpts, canonical source edition integrity, zoning planner, zoning safety, and mapped-scope review contracts.
- Hosted semantic spend contracts, answer-quality contract, transparency applicability and fast-conversation revision/recheck contracts.
- Syntax and diff whitespace checks.

Known existing failure: research-zoning-verification-instructions-contract.mjs exceeds its 14,000-character scoped-prompt ceiling. An isolated copy with the changed modules restored to pre-change HEAD reproduced the same failure. This fix does not change that scoped prompt file or its threshold; the full project-investigation suite is therefore not green.

## Delivery boundary

The source, regression fixtures and test command are committed on codex/research-site-investigation. Push, deployment, and authenticated web/iPhone acceptance remain separate steps.

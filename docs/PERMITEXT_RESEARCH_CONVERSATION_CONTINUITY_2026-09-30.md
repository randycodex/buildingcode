# Research conversation continuity and Zoning availability — September 30, 2026

The owner authorized ordinary Zoning Research and removal of constraints that stopped useful continuing conversations. The reported example was transparency at 1070 Southern Boulevard, followed by sidewalk measurement, slope, governing section, and §141-32 questions.

## Changes

- Enable the imported NYC Zoning Resolution in ordinary Research. Preserve imported review provenance separately; `PERMITEXT_ZONING_RESEARCH_ENABLED=0` remains an operational disable switch.
- Route transparency and streetscape questions to Zoning. Retrieve complete transparency provisions and applicability context, preserve the active topic, and resolve bare numbered follow-ups such as “then explain the 141-32.” Previously discussed citations are context rather than mandatory repeated claims.
- Look up an explicitly stated NYC street address through the existing official property service. Treat the result as an attributed candidate tax lot and existing conditions, not proposed-building facts or proof of frontage, zoning-lot, or historical applicability.
- Give answer generation and verification recent conversation context. Keep bounded earlier user statements for longer conversations. Remove the 200-message/100-exchange cutoff; raise the hourly conversation-message throttle from 30 to 180. Existing entitlement and spend limits remain.
- Permit one full Zoning answer revision and verify the actual revised answer. Preserve source binding, historical-text, map-scope, and unsupported-project-conclusion checks.
- Return and save an uncharged clarification when evidence or answer verification cannot support a substantive answer. Do not save the rejected draft. The same conversation remains available for follow-up. Provider outages and user cancellation retain their actual error behavior.

## Verification

A real-provider run against an isolated local HTTP server completed all five questions with substantive cited answers and passing verification. It used ordinary Zoning availability, no diagnostic bypass, live NYC Planning property lookup, and no production account or database writes.

| Turn | Question | Seconds | Result |
| --- | --- | ---: | --- |
| 1 | Transparency at 1070 Southern Boulevard | 27.500 | Cited explanation; property applicability distinguished |
| 2 | Where to measure the 2 feet | 12.058 | Adjoining sidewalk explained |
| 3 | Highest/lowest sidewalk points | 37.198 | Starting-height check distinguished from overall calculation |
| 4 | Governing ZR number | 35.420 | Candidate provisions and applicability explained |
| 5 | Explain §141-32 | 43.620 | Supplied current open-space provision explained without inventing historical text |

Estimated provider cost for that five-turn run: $0.213816 under the runner's configured pricing. This is one acceptance run, not a reliability or latency benchmark. The source corpus identifies its text-through date as August 13, 2026; enabling it does not establish a live amendment refresh or historical vesting basis.

The repeatable live runner is `permitext-sync-server/scripts/check-research-transparency-live.mjs --live`; its $3 aggregate ceiling applies to each isolated run. It fails acceptance if any turn only produces a clarification. The ordinary offline suite includes the five-turn retrieval regression and a 101-exchange HTTP test, plus rejected-draft, source, billing, and map-scope regressions.

All 95 Research contract commands passed across the full regression run and targeted reruns after fixing the verifier-context request-builder fixture. The complete `npm run smoke`, deploy-content verification, and client build also passed. Dependencies were restored from the existing lockfile with `npm ci`; no dependency versions changed.

Deployment status is recorded in the task closeout after the Production build completes. Local provider acceptance does not substitute for signed-in browser or physical-device acceptance.

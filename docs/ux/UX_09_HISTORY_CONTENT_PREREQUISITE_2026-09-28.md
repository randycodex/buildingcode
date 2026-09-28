# UX-09: safe Research history classification prerequisite

## Finding

The current “Empty draft” label checks message count and selected-source count. It does not establish that a record lacks other sources, rich/visual evidence, a local composer draft, or an interrupted request. Using that label to hide history would be unsafe.

## Bounded implementation

Add versioned scalar content-presence facts before the server strips heavyweight conversation data for list responses. File and PostgreSQL paths must retain equivalent facts. Keep old or incomplete summaries unknown. A pure classifier requires explicit known local state and absence of every local retained-content category before returning confirmed-empty. Positive evidence always retains a record. Native metadata is additive and optional; history UI is unchanged.

The web recovery-presence snapshot reads once per account/workspace and returns only matching conversation identifiers. It performs no writes or pruning. Missing scope, malformed JSON/records, or inaccessible storage return unknown. Expired records still count as retained evidence until the existing recovery lifecycle prunes them normally. No user data is removed, reused, or hidden.

## Acceptance remaining

- Wire account/workspace-scoped composer, evidence, attachment and pending-request snapshots into presentation only after their completeness is established.
- Do not classify on each row with storage-mutating reads.
- Resolve automatic code-basis/context defaults separately; conservative retention may leave many candidates visible.
- Verify a reversible counted group with populated authenticated fixtures, selected evidence, unsent text, pending requests, account switching, reload and native physical rendering.
- No paid Research requests, owner account mutations, simulator use, deployment or distribution is part of this prerequisite.

## Validation

- `npm run test:research-history-content`: 41 web/native classification fixtures pass; actual native scalar model is compiled on the host, with wrapper decoding of missing/null/malformed optional metadata. This is not a simulator or physical UI test.
- Existing Research list-summary and recovery-progress contracts pass.
- Full `test:readiness-recovery` and `test:offline` pass.
- Both PostgreSQL projections have matching structural contracts, including top-level key inspection rather than recursively copying large messages/visual data. Live PostgreSQL execution and query timing remain unverified.
- Public shell/import/precache versions remain coherent at v590 / shell1233; Research recovery module is v123.
- This does not establish completed UX-09 or rendered history acceptance. Build41.29 predates these additive Research model changes; its existing artifact remains the chapter-performance candidate, not a build of this entire later checkout.

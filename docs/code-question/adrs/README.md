# Code Question workspace — architectural decision records

Phase 0 ADRs for the Code Question reorganization. Each record states an **explicit choice** (not TBD). Storage and UI implementation follow in later phases; these decisions govern that work.

| ADR | Topic |
| --- | --- |
| [001](./001-artifact-granularity.md) | Artifact granularity |
| [002](./002-counters-uniqueness.md) | Dedicated counters / uniqueness |
| [003](./003-expected-version-cas.md) | Atomic `expectedVersion` compare-and-swap |
| [004](./004-offline-transport-outbox.md) | Offline Question transport / outbox |
| [005](./005-issuance-saga.md) | Idempotent issuance saga and staged-file recovery |
| [006](./006-report-draft-v2-manifest-v3.md) | Report Draft v2 / Manifest v3 adapters |
| [007](./007-permission-mapping.md) | Permission mapping onto existing roles |
| [008](./008-url-pane-identity.md) | URL and pane identity |

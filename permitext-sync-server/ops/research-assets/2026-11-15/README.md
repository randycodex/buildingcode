# Current public-source search asset refresh — November 15, 2026

The November 15 zoning refresh changed the current corpus, including the October 22 DCP consolidation and Council Resolutions 736 and 737 adopted November 12. The deployment gate correctly rejected the old prepared vector fingerprint.

`scripts/refresh-prepared-research-assets.mjs` reused 26,261 exact cached inputs and embedded 27,435 changed inputs. It rebuilt the private runtime artifact for all 53,696 unique inputs and all 31 current-corpus combinations. The offline verification gate validates complete coverage, metadata, checksums, and source fingerprints; it remains mandatory for production builds.

The maintenance run had an explicit $0.50 cap. All 429 provider requests settled; reported usage cost was $0.07723534. `budget-ledger.json` records reservations, provider usage, input hashes, and request IDs. `summary.json` records the resulting fingerprint and SHA-256. No project data, user questions, or generated answers were sent. This was source-index maintenance, separate from paid answer evaluation campaigns.

The tool defaults to offline inventory. A live invocation requires both an explicit cap no higher than $0.50 and a checkpoint directory. It refuses resumes with pending or unknown provider outcomes. Reused vectors retain their original Float32 values.

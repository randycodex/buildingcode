The local Assistant uses the nonsecret production settings in
`local-assistant-production.json`. The snapshot records the verified production
deployment and commit. Startup checks the shared engine, prompts, source-scope
helpers and provider files against their deployed SHA-256 hashes. Refresh this
snapshot after a production Assistant change; do not remove the hash checks to
claim parity with a different version.

Research v2 controls its own provider requests: GPT-6 Luna, default service tier,
`store: false`, low effort for a simple draft, medium effort for complex drafts,
reviews and repairs, 6,144 output tokens for drafts/repairs and 4,096 for reviews.
The legacy priority-tier and revision-effort environment settings are copied
from production too; they do not override those v2 request settings.

`scripts/local-assistant-environment.mjs` must run before importing `app.mjs`.
It removes inherited production database, authentication, billing, mock and AI
overrides, then selects the supplied local JSON store, assets, local API key and
existing evaluation ledger. It also validates the prepared semantic corpus and
sets its local paths. No production account data or provider key is copied.

The local spending limits remain $1 per turn and $7 in the original durable
evaluation ledger. Generation, review, repair and query embeddings share that
ledger; failures with unknown usage retain their reservations. Startup refuses
a missing ledger rather than silently opening a new allowance. For another
worktree, pass the original absolute path with
`npm run start:research-v2 -- --live --budget-path=/absolute/path/to/budget-ledger.json`.
Provider charges still use the locally configured API key's billing account.

Run `node tests/local-assistant-production-parity.mjs` for the offline parity
and isolation checks. These checks use temporary fixture data and no paid calls.

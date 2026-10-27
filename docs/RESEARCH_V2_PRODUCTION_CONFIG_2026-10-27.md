# Research v2 production configuration — local verification

The configuration work is complete locally on `codex/research-rebuild`. This is
configuration and local test evidence, not a deployed release. No remote
environment, production database, push, merge or deployment was changed. Human
answer reviews remain deferred.

## Activation and rollback

- V2 is disabled unless `PERMITEXT_RESEARCH_V2=1` is explicitly configured.
- Hosted activation defaults to `PERMITEXT_RESEARCH_V2_ROLLOUT=allowlist` and
  requires backend user IDs in `PERMITEXT_RESEARCH_V2_USERS`. An explicit `all`
  rollout permits all otherwise entitled accounts.
- `PERMITEXT_RESEARCH_V2_DEFAULT=legacy` preserves the existing interface.
  Setting it to `v2` opens the new interface for eligible accounts.
- Authenticated server availability controls the browser on any domain. A URL
  preference cannot authorize generation. Interface preferences are scoped to
  the signed-in account, including when browser storage is unavailable. Late
  configuration responses cannot cross account or session changes.
- `?research=legacy` provides an interface rollback and retains the unsent draft.
  Setting the master switch to `0` blocks new v2 generation. Existing answers and
  their frozen evidence remain readable in either interface.

`permitext-sync-server/config/research-v2.production.env.example` contains a
disabled example with proposed spending caps. It has no credentials and was not
applied anywhere. Preserve existing base-model prices and secrets; model-specific
Luna rates are separate. The examples affect shared Research application caps,
so choose the intended business limits before a future activation.

## Spending and runtime

Hosted v2 requires PostgreSQL, the existing server-side provider key, valid
versioned pricing and the normal request, user and global spending caps. It uses
existing durable application reservations and usage records, with no local
evaluation file. Hosted configuration rejects local evaluation-budget settings
and mock mode. Pricing validation uses exactly the rate selection used by
application accounting, including model-specific rates and fallback behavior.

Local paid testing still requires the original durable $7 ledger. Original Fast
answers in that testing session share the ledger. The local launcher remains
local-only; its restrictions were not loosened to enable hosted configuration.

Both paths enforce Luna-only request bounds: Standard service, no provider
storage, no tools, at most 180 KB per request and 8,192 output tokens. The
substantive engine and prompts are unchanged: at most four provider calls,
240 seconds overall and 120 seconds per provider request. The API function now
declares 300 seconds for preparation and persistence headroom.

The read-only `npm run verify:research-v2:production` preflight checks production
configuration and function duration without a provider call or database
connection. Add `-- --require-enabled` to require activation readiness. A disabled
configuration passing the ordinary check does not imply activation readiness.
The production build runs that check; the existing deployment checker also
rejects invalid enabled v2 configuration in hosted previews and production.
Diagnostics omit credentials, database URLs and account allowlists.

## Verification performed

- `npm run test:research-v2`: runtime and rollout policy, preflight, sync refresh,
  view interactions, frozen evidence, review/repair, original $7 ledger, actual
  HTTP routes and twelve known-target discovery checks. Provider responses are
  simulated; this does not establish substantive answer correctness.
- `npm run test:research-v2:production`: actual API entry and HTTP suite with
  production/hosted flags, disposable loopback PostgreSQL, Neon SQL encoding and
  simulated provider responses. Checks cover durable usage, cumulative per-turn
  spending rejection before dispatch, invalid pricing rejection, account rollout,
  kill switch, rollback, zero local-ledger writes, replay, cancellation, exact
  evidence and retained history.
- The cancellation test waits for the server to observe the disconnect before
  releasing its simulated provider. This removes a timing race where an
  instantaneous double could reach persistence before the disconnect arrived.
  Cancellation observed before completion saves no answer.
- Browser checks on that local production-mode fixture: the server default opens
  the numbered v2 interface at `/workspace` without an opt-in query; saved answers
  reopen; Sources used retains the original passage after removal from the
  conversation; Original Research restores the old interface and unsent draft.
  The fixture contains synthetic questions and provider responses.
- Existing account isolation, context recovery, Project scope, economics,
  durable messages, Fast streaming, compiled routing and static cache checks.
- Required public-source Search and passage artifacts were built offline using
  the existing deployment scripts. The first hosted-mode attempts rejected
  missing artifacts. No fallback was added to weaken that requirement.
- Client version `20261027-research-v2-v1391`, shell cache `v1983`, and the new
  rollout module agree across the HTML, app and offline manifests.

No real provider requests were added during this configuration work. The original
ledger remains at 235 calls, 202,430 input tokens, 58,945 output tokens and
$0.077652 accounted against $7, including one uncertain call held conservatively.
Remaining authorization: $6.922348.

## Outside this local completion

Actual hosted environment values, platform duration eligibility, hosted requests,
release health and deployed database behavior have not been verified. Those
belong to a later authorized release. Existing commercial and authentication
readiness gates remain in place. Human answer reviews and the native Research
interface are outside this configuration change.

# Permitext Sync Server

Backend service for Permitext's iPhone and web account, sync, Research, billing,
organization, and private-file contracts.

It now supports two runtime shapes:

- local Node server for development and smoke testing
- Vercel Function deployment for hosted testing
- Neon Postgres persistence when Vercel provides a database URL

## Run

```sh
node server.mjs
```

Defaults:

- URL: `http://localhost:8787`
- Data file: `data/sync-store.json` when no database URL is configured

Override with:

```sh
PORT=8787 PERMITEXT_SYNC_DATA_PATH=/tmp/permitext-sync-store.json node server.mjs
```

Enable internal lifetime grant admin routes with:

```sh
PERMITEXT_SYNC_ADMIN_TOKEN=dev-secret node server.mjs
```

Lifetime-grant routes can instead use a separate, narrowly scoped credential:

```sh
PERMITEXT_SYNC_GRANT_ADMIN_TOKEN=grant-secret node server.mjs
```

Apple sign-in requests may include the identity token issued by Sign in with Apple. When a token is present, the server verifies the Apple signature, issuer, expiration, subject, and configured audience. Every Vercel deployment requires a valid identity token automatically. Local development can opt into the same policy with `PERMITEXT_REQUIRE_APPLE_IDENTITY_TOKEN=1`:

```sh
APPLE_BUNDLE_ID=com.randycodex.permitext \
APPLE_SERVICE_ID=com.example.permitext.web \
APPLE_ALLOWED_CLIENT_IDS=com.example.extra.client \
PERMITEXT_REQUIRE_APPLE_IDENTITY_TOKEN=1 \
node server.mjs
```

The web app uses Sign in with Apple JS when `APPLE_SERVICE_ID` is configured. During the domain transition, Apple Developer should allow both the new canonical domain/return URL and the legacy pair until installed apps and existing sessions have migrated:

```text
Domain: permitext.com
Return URL: https://permitext.com/account/apple/callback

Domain: permitext-sync.vercel.app
Return URL: https://permitext-sync.vercel.app/account/apple/callback
```

`permitext.com` is attached to the production Vercel deployment and is the
canonical public/share-link host. The native backend base remains
`permitext-sync.vercel.app` during the staged identity migration. Verify AASA
and installed-app universal links, the Apple Service ID return URL, account
cookies, Stripe returns/webhooks, and production PostgreSQL through the apex;
keep the Vercel hostname accepted for existing installed apps and shared links.
The production verification scripts accept an explicit host through
`PERMITEXT_SYNC_PRODUCTION_URL` (or `PERMITEXT_PRODUCTION_BASE_URL` for identity
restore), so verify both hosts during the transition.

Without `APPLE_SERVICE_ID`, production web sign-in is disabled instead of creating a browser-only account that cannot match iOS. Localhost can still use the browser-local fallback for development, or set `PERMITEXT_ALLOW_WEB_BROWSER_SIGN_IN=1` to allow it explicitly.

If a browser already has a temporary `web:` account from the earlier checkout flow, the web app can link it during Apple sign-in. The backend retargets saved records to the new `apple:` account, transfers the server-owned entitlement, and invalidates the old browser session.

Passkey registration and sign-in are disabled until the backend implements a complete server-challenge WebAuthn verification ceremony. Existing passkey records remain readable only for administrative cleanup and account export. Older clients receive HTTP `410` from passkey registration and sign-in attempts.

Hosted account sessions are multi-device and store only a SHA-256 token hash. Each sign-in creates a distinct session with a 30-day default expiry; `PERMITEXT_SESSION_TTL_SECONDS` can set a different duration of at least one hour. Existing plaintext sessions are migrated to the hashed table on successful use and removed from the legacy session table. `POST /account/sign-out` revokes only the current device session.

The HTTP perimeter rejects request bodies larger than 1 MiB by default. `PERMITEXT_MAX_REQUEST_BODY_BYTES` can set a limit from 64 KiB through 10 MiB. HTML responses use a Content Security Policy, Apple callback scripts use a per-response nonce, and all responses include baseline anti-framing, MIME-sniffing, referrer, and browser-permission headers.

Configured account, billing, Research, organization, owner, admin, sync, and private-file routes return HTTP `429` with `Retry-After` when a fixed-window burst limit is exceeded. PostgreSQL deployments increment hashed client, verified account, and verified administrator buckets atomically, so limits are shared across Node/Vercel instances. PostgreSQL limiter errors fail closed with HTTP `503`; the server never silently downgrades a configured PostgreSQL deployment to process-local enforcement.

Pro Research is presented to customers without a monthly request counter or allowance. The server retains a private monthly per-account cost guardrail, configured with `PERMITEXT_RESEARCH_MONTHLY_REQUEST_LIMIT` and defaulting to 100, so pricing pilots can be adjusted without exposing a product quota. Request, token, and estimated-cost totals are excluded from customer Research responses. They are available only in the owner-authenticated `/admin/` console under **Research spend** (`/internal/` remains a compatibility URL); hosted access requires the signed-in user ID to be listed in `PERMITEXT_INTERNAL_OWNER_USER_IDS`.

The JSON-file development adapter uses a bounded in-memory limiter. When its bucket capacity is exhausted it denies new principals instead of evicting active protection. Forwarded client IP headers are trusted automatically on Vercel, ignored on direct local connections, and can be enabled for an explicitly trusted local reverse proxy with `PERMITEXT_TRUST_PROXY=1` (or disabled with `PERMITEXT_TRUST_PROXY=0`).

The web workspace stores signed-in mutations in a durable browser outbox before sending them. Entries are coalesced by account and record, replay on reload, reconnect, or tab foregrounding, and retry transient failures with bounded exponential delay. Server-newer records move to a separate conflict list instead of retrying forever. Settings shows waiting/conflict counts and requires an explicit **Use server** or **Keep mine** choice for conflicts. Note and tag edits enter the outbox before their network debounce begins.

Workboard has been retired from the product. Its UI, detached route, editor bundle, and ability to create new drawings are removed. The server temporarily retains authenticated read compatibility for historical Workboard records and immutable Report snapshots so existing Projects and issued documents do not break; this compatibility is not a user-facing feature.

After the web workspace has a full baseline, later pulls send the server event cursor and merge only records changed since that cursor. Reloads still begin with a full pull, and a content-map version change forces a full replacement so canonical section-ID repairs cannot be hidden by an old checkpoint.

## Canonical Code Content

The published iPhone content tree is the authority for chapter structure, section IDs, corrected section bodies, search IDs, and assets:

```text
NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2022-construction-codes
```

The web reader uses that same chapter catalog and always prefers its canonical `prepared/sections/<sectionID>.json` body. The older `NYCCCApp` section tree remains a read-only body fallback while the remaining sections are migrated; it is not allowed to redefine published IDs. Historical web-ID repair is limited to old sync records at the ingestion boundary.

Run the release gate before shipping content or search changes:

```sh
npm run verify:content
```

The gate verifies all 118 chapter files, 12,890 unique published section IDs, exact search-index coverage, canonical override ownership, available-body coverage promised by the manifest, and the eight known duplicate display-number cases that must remain distinct records. It also runs as part of `npm run smoke`.

iPhone and web search both use the shipped `prepared/searchIndex.json` token map. Results use the same rank, natural chapter/section ordering, code-section tie-break, and final section-ID tie-break on both platforms. The web server no longer rebuilds an index by opening every section body; both clients trust the validated index and resolve body text only for result snippets. The smoke suite runs every golden query through the web endpoint and compares its ordered IDs with the iPhone regression fixture.

Canonical sections have a shared URL contract:

```text
https://permitext.com/open/section/<canonical-section-id>
```

The same URL loads the section-detail workspace in a browser and opens `ReaderView` in the installed iPhone app. The previous `https://permitext-sync.vercel.app/open/section/<canonical-section-id>` route remains compatible during the domain transition, but web share controls generate `permitext.com` links. The AASA response advertises `/open/section/*`, and the iOS target includes the associated domains. Opening a section on web replaces the current address with its shared route, and reader/detail share controls use the native share sheet when available with clipboard fallback. Private workspace state is never serialized into the link.

Signed-in web readers also publish the shared `continuity` record after chapter or section navigation and restore only a newer server record. Web updates preserve continuity values owned by iPhone, merge the canonical section into recent history, use the same Swift reference-date encoding, and stay in the durable outbox on network failure. A pending local continuity mutation prevents remote state from overwriting it; choosing the server copy during conflict resolution clears the local continuity checkpoint before pulling again.

The web `Research` pane stores conversations built from enacted passages selected by the user. Users can attach additional passages and ask for plain-language interpretations grounded only in those exact passages. Related sections remain disclosed suggestions and are not sent to the model as verified authority. The server re-resolves canonical bodies, excludes private notes, rejects changed selections, verifies every cited section and passage ID, and returns separate supported conclusions, missing facts, evidence limitations, and additional evidence needs. Interpretations are research assistance, not official code determinations.

Automated tests can exercise the interpretation contract without calling an external model. Mock Research is accepted only when `NODE_ENV=test`; it is never available to the normal localhost, Preview, or Production app:

```sh
NODE_ENV=test PERMITEXT_TEST_RESEARCH_MOCK=1 node server.mjs
```

Enable live OpenAI Responses API calls with a server-only key:

```sh
OPENAI_API_KEY=... \
PERMITEXT_RESEARCH_MODEL=gpt-5.6-terra \
PERMITEXT_RESEARCH_REASONING_EFFORT=medium \
node server.mjs
```

For persistent localhost Research on macOS, store the server-only key in the login Keychain with service name `permitext-openai-api-key`, then run:

```sh
npm run start:local-research
```

That command fails closed when the Keychain entry is missing or invalid, always defaults to `gpt-5.6-terra`, and never enables test mock generation.

`OPENAI_API_KEY` must never be exposed to the browser. The server disables response storage, uses a privacy-preserving hashed safety identifier, requests strict structured output, validates citations before returning an answer, and records versioned model/token usage without logging the question or code text. The Research list shows requests used versus the monthly allowance and reset date; token totals are secondary, and estimated cost appears only when explicit versioned pricing is configured. The OpenAI account that owns the API key is responsible for model usage charges.

### Research evaluation set

The human-authored architectural cases in `evals/research-cases.json` are the golden set for research quality. Preflight starts an isolated local server and verifies that every selected canonical section actually contains the evidence the case requires. It never calls OpenAI:

```sh
npm run eval:research
```

The preflight intentionally blocks a live run when a section is missing, mapped to the wrong body, or missing required table text. Add or revise cases only in the dataset; the runner discovers every case and rubric item without case-specific code. See `evals/README.md` for the field contract and change process.

After explicit spending approval, a full five-case run makes ten paid model requests: five Permitext answers plus five structured scoring calls. It requires an API key, the paid-run interlock, and explicit versioned token prices so cost scoring is reliable:

```sh
PERMITEXT_RUN_PAID_RESEARCH_EVALS=1 \
OPENAI_API_KEY=... \
PERMITEXT_RESEARCH_INPUT_USD_PER_MILLION_TOKENS=... \
PERMITEXT_RESEARCH_CACHED_INPUT_USD_PER_MILLION_TOKENS=... \
PERMITEXT_RESEARCH_OUTPUT_USD_PER_MILLION_TOKENS=... \
PERMITEXT_RESEARCH_PRICING_VERSION=... \
PERMITEXT_RESEARCH_EVAL_MAX_USD=... \
npm run eval:research:live
```

Version-controlled live results are written under `evals/results/` as immutable JSON plus a Markdown review report. Every report records the run ID and timestamp, dataset hash, Git commit, jurisdiction/code edition, requested and provider-returned model identifiers, prompt/evidence/retrieval versions, answer and judge configurations, response time, tokens, reliable estimated costs, per-case errors, deterministic validation, semantic scoring, and comparison with the previous accepted baseline. Citation canonicality, section/passage scope, completeness, duplicates, explicit inline evidence IDs, formatting, and unexpected response-script contamination are checked deterministically. A strict evidence-only judge separately scores citation support, invented requirements, uncertainty, missing facts, evidence insufficiency, required concepts, forbidden claims, usefulness, and directness with confidence and failure excerpts. Automatic scores are regression signals and require knowledgeable human review. A baseline can be accepted or preferred only when a current-schema, complete, unfiltered, single-repetition full run has an approved latest human decision for every case answer actually embedded in that immutable run.

Completed answers include lightweight feedback controls with an optional self-described professional role and supporting code or official-source reference. Feedback is stored with the server-derived conversation, evidence, question, immutable answer, citations, model, and prompt/evidence versions. Every record remains a review `candidate`; it is never treated as proof of error or promoted into the approved dataset automatically. The owner-only console at `/admin/` shows the complete report and supports separate `new`, `reviewing`, `evaluation_candidate`, `resolved`, and `dismissed` triage states. Queueing a report for evaluation does not create or approve a case, change a prompt, or change a model. Baseline and comparison commands, filters, repetitions, the full case contract, and the 200–500-case growth workflow are documented in `evals/README.md`.

Run the free preflight whenever the dataset or enacted content changes. Whenever prompts, models, model settings, citation logic, evidence assembly, or other AI behavior changes, obtain spending approval, run the live suite before accepting the change, and compare the new JSON/Markdown report with the previous accepted result. Never place a paid live run in unattended CI.

`GET /code/sections?ids=<comma-separated-ids>` resolves up to 100 canonical or legacy section IDs into ordered canonical metadata without loading section bodies. The Research pane batches larger projects through that endpoint and caches results in the browser. Single-section lookup uses the same cached server catalog, avoiding repeated chapter scans.

Configure paid entitlement sources with:

```sh
STRIPE_SECRET_KEY=sk_live_... \
STRIPE_PRO_PRICE_ID=price_... \
STRIPE_WEBHOOK_SECRET=whsec_... \
STOREKIT_PRO_PRODUCT_ID=com.randycodex.permitext.pro.monthly \
APPLE_BUNDLE_ID=com.randycodex.permitext \
APPLE_APP_STORE_ROOT_SHA256_FINGERPRINTS=... \
PERMITEXT_REQUIRE_APPLE_TRANSACTION_ROOT_PIN=1 \
PERMITEXT_REQUIRE_PRODUCTION_APPLE_TRANSACTIONS=1 \
PERMITEXT_PUBLIC_BASE_URL=https://permitext-sync.vercel.app \
node server.mjs
```

Production checkout requires a live Stripe secret (`sk_live_...`) and a live recurring Price. The server rejects test credentials and test-mode webhook events when `VERCEL_ENV=production` or `PERMITEXT_REQUIRE_LIVE_STRIPE=1`, so a `cs_test_...` session can never appear to be a real purchase. Stripe uses different webhook signing secrets for test and live mode; configure the live endpoint at `https://permitext-sync.vercel.app/billing/stripe/webhook`.

Stripe Checkout creates the web subscription session, and the successful return path plus signed Stripe webhook events grant or revoke the shared backend entitlement. Apple Pro access is granted only after the iOS app sends an App Store-signed StoreKit transaction JWS to the backend. Production requires the configured bundle ID and App Store root fingerprints, and accepts only App Store production transactions. Xcode StoreKit purchases remain device-only, while App Store Sandbox and TestFlight transactions may synchronize only through a non-production backend configured for billing tests. Apple original transaction IDs are permanently bound to the first Permitext account that verifies them, preventing one purchase from being replayed across accounts.

## Deploy To Vercel

This folder is Vercel-ready.

- Root Directory: `permitext-sync-server`
- Preset: `Other`
- Entrypoint: `api/index.mjs`
- Routing: `vercel.json` rewrites clean paths like `/account/sign-in` to the Vercel function

When a Neon database is connected through Vercel, the server uses the first available database URL from:

- `PERMITEXT_SYNC_DATABASE_URL`
- `DATABASE_URL`
- `STORAGE_URL`
- `POSTGRES_URL`
- `NEON_DATABASE_URL`

Historical Workboard image records may still require the private Vercel Blob store while the compatibility window remains in effect. No new Workboard images are created by the product.

The Neon schema is created automatically on first request. The current Postgres schema is `normalized-v4`:

- `permitext_users`
- `permitext_entitlements`
- `permitext_sessions`
- `permitext_account_sessions`
- `permitext_passkey_credentials`
- `permitext_saved_items`
- `permitext_annotations`
- `permitext_projects`
- `permitext_project_items`
- `permitext_comments`
- `permitext_foundation_artifacts`
- `permitext_project_links`
- `permitext_research_answers`
- `permitext_evidence_snapshots`
- `permitext_project_activity`
- `permitext_migration_checkpoints`
- `permitext_research_conversations`
- `permitext_research_usage`
- `permitext_research_feedback`
- `permitext_sync_events`
- `permitext_user_content_records`
- `permitext_sync_state`

`permitext_user_content_records` and `permitext_sync_state` remain as compatibility mirrors for the existing iOS/web mutation contract. New saved sections, paragraph notes/tags, projects, and project membership are also written into first-class relational tables. Project relationships, immutable Research answers and evidence, meaningful activity, and migration checkpoints use separate owner-scoped tables so older clients can safely ignore record families they do not understand. Local development still falls back to the JSON file store if no database URL is present.

On Postgres, `sync/push` and `sync/pull` use a direct per-user repository instead of reading and rewriting the global store. A push applies conditional row upserts and sync-event inserts in one Neon HTTP transaction; a pull reads only that user's canonical records. Account sessions, profiles, checkout authentication, verified payment entitlements, lifetime grants, and legacy passkey cleanup also use targeted or transactional rows. The JSON file adapter intentionally keeps the simpler whole-file behavior for local smoke testing. Hosted legacy-account merge/repair requests fail safely without changing data until a fully transactional cross-account migration is implemented and verified against Postgres.

## Endpoints

- `GET /health`
- `GET /.well-known/apple-app-site-association`
- `POST /account/sign-in`
- `POST /account/sign-out`
- `POST /account/attach-local-data`
- `POST /account/profile`
- `POST /sync/push`
- `POST /sync/pull`
- `POST /projects/foundation/state`
- `POST /projects/foundation/link`
- `POST /projects/foundation/unlink`
- `POST /research/answers/list`
- `POST /research/answers/get`
- `POST /workboards/assets/upload`
- `POST /workboards/assets/read`
- `POST /workboards/assets/delete`
- `POST /billing/web/checkout`
- `POST /billing/stripe/webhook`
- `POST /billing/apple/transactions/verify`
- `POST /admin/lifetime-grants/grant`
- `POST /admin/lifetime-grants/revoke`
- `GET /admin/accounts/grant-summaries`
- `POST /admin/accounts/delete-legacy-passkey-users`
- `POST /admin/accounts/restore-checklist`
- `GET /admin/storage/summary`

Admin routes require:

```http
Authorization: Bearer <PERMITEXT_SYNC_ADMIN_TOKEN>
```

Administrative bearer credentials are compared with a shared length-checked
constant-time helper. Keep `PERMITEXT_SYNC_ADMIN_TOKEN` and
`PERMITEXT_SYNC_GRANT_ADMIN_TOKEN` distinct, randomly generated secrets; do
not reuse an account-session token as an administrative credential.

The lifetime-grant routes and grant-account summary also accept
`PERMITEXT_SYNC_GRANT_ADMIN_TOKEN`. That token does not authorize unrelated
storage, account-repair, or evaluation admin routes.

Storage summary verifies which persistence layer is live and returns table counts plus the latest sync event cursor:

```sh
curl https://permitext-sync.vercel.app/admin/storage/summary \
  -H "Authorization: Bearer $PERMITEXT_SYNC_ADMIN_TOKEN"
```

Postgres integration verification runs only when a database URL is configured. It starts a local server against that database, writes a synthetic account, checks normalized tables and event-cursor pull behavior, then cleans up the synthetic rows:

```sh
PERMITEXT_SYNC_DATABASE_URL="$DATABASE_URL" npm run verify:postgres
```

## Sync Cursor

`POST /sync/push` returns both the accepted/rejected mutation IDs and the latest server event cursor:

```json
{
  "acceptedMutationIDs": [],
  "rejectedMutationIDs": [],
  "latestEventID": 123,
  "syncRevision": 123,
  "entitlement": null,
  "serverTime": "2026-06-27T00:00:00.000Z"
}
```

Entitlements are server-owned. Sync batches can include local user content mutations, but any client-provided `batch.entitlement` value is ignored; paid access should be written only by verified Apple/web payment handlers or admin grant routes.

Each sync push is limited to 100 mutations so one request cannot create an unbounded database transaction. Current iOS automatic sync batches are smaller than this limit.

`POST /sync/pull` still accepts the original timestamp `since` field, but hosted Postgres deployments can also use the event cursor:

```json
{
  "auth": { "accountUserID": "apple:USER" },
  "sinceEventID": 123,
  "contentMapVersion": 2
}
```

The response includes `latestEventID`/`syncRevision`, `contentMapVersion`, and the current mutations affected after that cursor. The server honors an event cursor only when the client content-map version matches its canonical section-map schema; older clients receive the full canonical state so identifier repairs are not hidden. File-backed local development returns `0` for the cursor and keeps the timestamp-compatible behavior.

Legacy passkey cleanup removes only accounts whose stored user ID starts with `passkey:`. It exists to clean records created before unlinked passkey sign-in was blocked:

```sh
curl -X POST https://permitext-sync.vercel.app/admin/accounts/delete-legacy-passkey-users \
  -H "Authorization: Bearer $PERMITEXT_SYNC_ADMIN_TOKEN"
```

Restore checklist summarizes account restore readiness for one user:

```sh
curl -X POST https://permitext-sync.vercel.app/admin/accounts/restore-checklist \
  -H "Authorization: Bearer $PERMITEXT_SYNC_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userID":"apple:YOUR_APPLE_USER_ID"}'
```

Production identity restore can be tested with:

```sh
PERMITEXT_RUN_PRODUCTION_IDENTITY_RESTORE=1 \
PERMITEXT_PRODUCTION_TEST_USER="$APPLE_USER_ID" \
PERMITEXT_PRODUCTION_TEST_APPLE_IDENTITY_TOKEN="$APPLE_IDENTITY_TOKEN" \
npm run verify:production:identity
```

That test requires a current Sign in with Apple identity token and writes one stable smoke account to the configured production backend.

Local mode remains intentionally simple and file-backed for integration testing. Hosted mode is intended to run on Vercel with Neon Postgres for durable storage.

## iOS Local HTTP Mode

In a DEBUG build, point the app at this server with:

```swift
PermitextBackendConfiguration.setDebugHTTPBaseURL("http://localhost:8787")
```

For a physical iPhone, replace `localhost` with the Mac's LAN IP address.

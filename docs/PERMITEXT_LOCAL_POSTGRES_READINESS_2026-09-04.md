# Local PostgreSQL concurrency acceptance — September 4, 2026

Passed against frozen runtime commit `dcc6cb6cbe6ea6341ac77771ed96417e368d61fd`, using a new, empty PostgreSQL 18.6 database on `127.0.0.1:56439`. No application runtime files changed for this verification. The test is opt-in and excluded from default suites.

## Verified behavior and boundary

`tests/postgres-readiness-concurrency.mjs` runs the existing Research/Notebook/Project information HTTP concurrency contract against production `handleRequest`, the PostgreSQL store adapter, schema initialization, and the Neon query/batch encoder. A test-only fetch transport sends those generated statements to local PostgreSQL. Each Neon batch runs on one connection at its requested isolation level; separate batches use separate connections. This verifies actual PostgreSQL SQL execution and Serializable concurrency. It does not verify Neon cloud transport, production credentials, deployment configuration, or a production database.

HTTP coverage includes current Project facts after move/unassign, immutable historical answers, exact answer/card/note retries, concurrent Notebook updates, atomic deletion/link tombstones, concurrent first Project information creation, concurrent Project note edits, and rejection of missing/stale expected versions.

Additional cases execute the actual PostgreSQL method bodies: stale generation after a move preserves its uncharged reservation and creates no answer/event; reverse ordering preserves an accepted answer and charges exactly once after replay; four simultaneous move/completion races each have one winner; failed Research and Notebook link guards roll back preceding writes; competing conversation revisions have one winner.

Final run: **passed**, 834 SQL transport requests, 34 Serializable batches, maximum 14 simultaneous connections, four simultaneous move/completion races. External database requests: **0**. Paid/provider requests: **0**. Research used the deterministic Project-context path. Node syntax and `git diff --check` passed. No runtime defect was found.

## Provenance

The original frozen-runtime result above remains historical. A follow-up on the
repair branch extended this same opt-in harness with `account-link-recovery-http.mjs`.
It reproduced the lost transitive ancestry and a PostgreSQL `42P18` failure in
account linking: JSON constructors received untyped parameters. Source ancestry
is now carried into the destination, and account/entitlement constructor inputs
have explicit text casts.

The final follow-up passed **946 SQL requests, 39 Serializable batches, maximum
14 connections**, with the four earlier move/completion races. The added HTTP
flow preserves a linked Project and Pro entitlement across A → B → C, returns
both source identities on fresh sign-in after discarded merge responses, rejects
old source sessions, and ignores client-supplied ancestry. Recovery authorization
is stored in a separate server-controlled migration checkpoint within the merge
transaction. Forged account-attachment/sync metadata cannot replace it. The
transaction locks both identities and rejects a consumed source; simultaneous
links have one winner and the loser creates no recovery authorization. Sign-in
reconfirms the issued session against the returned account before releasing its
checkpoint. Historical client-writable account fields are never recovery proof. No provider or external
database requests occurred. The disposable cluster was stopped, image detached,
and its temporary runtime/data removed. Evidence:
`/private/tmp/permitext-readiness-links-ownership-session-final-20260904.log`.

- Primary distribution: [Postgres.app downloads](https://postgresapp.com/downloads.html), [2.9.6 release](https://github.com/PostgresApp/PostgresApp/releases/tag/v2.9.6).
- Asset: `Postgres-2.9.6-18.dmg`, 122,517,005 bytes. Its actual SHA-256 matched the release digest: `9fc7d0dc08cf46dfd94bb32cbaaad81b41b37847a42d6dcb2f9fbd292813defb`.
- `codesign --verify --deep --strict` passed. Signer: `Developer ID Application: Jakob Egger (ZF84SJ5A3G)`, through Apple Root CA; signature timestamp August 12, 2026.
- Executable: `PostgreSQL 18.6 (Postgres.app) on aarch64-apple-darwin23.6.0`, Apple clang 15.0.0. Read-only DMG; no app installation, GUI launch, login item or service.
- Transport driver: [`pg` 8.23.0](https://github.com/brianc/node-postgres), installed only in the task directory with npm lifecycle scripts disabled. Package integrity: `sha512-Ip2EQCngowJLGOfCwkFhPXU7/ljlhn6Rxlmy4XYfL2Y+vyRM59+8uR2xqRWKdYmbXmxCFOAmKxBuSUCdF34qLg==`.
- Runtime SHA-256: `app.mjs` = `00947967097a8b1e2ca644ac10e860d1d435d4135704ad638ab2f4f4a8871603`; `notebook-persistence.mjs` = `cf8da7ae54737f2a2d795d9676efed1e32b7d566990e8f303051c6dea187bceb`; `research-context-state.mjs` = `b5541e54dc280e01c3cf5624e1f40ab04a67dceedb3d94c83bcc155ec6fb15bb`.

## Reproduction

Run from `permitext-sync-server` on macOS with Node/npm. The test requires a fresh empty database and rejects non-loopback hosts, the default PostgreSQL port, other database/user names, or connection options that could override its local target.

```sh
set -euo pipefail
task_pg_root=$(mktemp -d /private/tmp/permitext-pg-acceptance.XXXXXX)
task_pg_port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
curl --fail --location --silent --show-error --max-time 180 \
  https://github.com/PostgresApp/PostgresApp/releases/download/v2.9.6/Postgres-2.9.6-18.dmg \
  -o "$task_pg_root/Postgres-2.9.6-18.dmg"
printf '%s  %s\n' 9fc7d0dc08cf46dfd94bb32cbaaad81b41b37847a42d6dcb2f9fbd292813defb \
  "$task_pg_root/Postgres-2.9.6-18.dmg" | shasum -a 256 -c -
mkdir "$task_pg_root/mount" "$task_pg_root/socket"
hdiutil attach -readonly -nobrowse -mountpoint "$task_pg_root/mount" "$task_pg_root/Postgres-2.9.6-18.dmg"
codesign --verify --deep --strict "$task_pg_root/mount/Postgres.app"
task_pg_bin="$task_pg_root/mount/Postgres.app/Contents/Versions/18/bin"
"$task_pg_bin/postgres" --version
npm install --prefix "$task_pg_root/transport" --ignore-scripts --no-audit --no-fund pg@8.23.0
"$task_pg_bin/initdb" -D "$task_pg_root/data" -U permitext_readiness --auth=trust --no-locale --encoding=UTF8
"$task_pg_bin/pg_ctl" -D "$task_pg_root/data" -l "$task_pg_root/server.log" \
  -o "-h 127.0.0.1 -p $task_pg_port -k $task_pg_root/socket" -w start
"$task_pg_bin/createdb" -h 127.0.0.1 -p "$task_pg_port" -U permitext_readiness permitext_readiness_temp
PERMITEXT_RUN_LOCAL_POSTGRES_READINESS=1 \
PERMITEXT_LOCAL_POSTGRES_URL="postgresql://permitext_readiness:test@127.0.0.1:$task_pg_port/permitext_readiness_temp" \
PERMITEXT_LOCAL_PG_DRIVER="$task_pg_root/transport/node_modules/pg/lib/index.js" \
  npm run test:readiness-postgres | tee "$task_pg_root/acceptance.log"
```

Always stop this cluster and detach its image, including after a test failure:

```sh
"$task_pg_bin/pg_ctl" -D "$task_pg_root/data" -m fast -w stop
hdiutil detach "$task_pg_root/mount"
```

Retain summary/provenance before deleting this task's temporary directory. Never reuse the test against an existing database. Synthetic raw database files stay outside git.

This run used `/private/tmp/permitext-pg-acceptance.IyZ5Qo`; its cluster was stopped, image detached, and temporary runtime/data removed. Retained local evidence: `/private/tmp/permitext-readiness-postgres-concurrency-20260904.log` and `/private/tmp/permitext-readiness-postgres-provenance-20260904.json`.

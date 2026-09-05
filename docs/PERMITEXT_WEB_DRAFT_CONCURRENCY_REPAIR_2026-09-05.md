# Web device-draft concurrency repair — September 5, 2026

## Confirmed failure

Two independent browser contexts can load the same Notebook or Project
information draft, then checkpoint different text while offline. The previous
storage implementation unconditionally replaced the single draft record, so a
stale editor erased another editor's unsent text. Server expected-version checks
could not recover text already lost in local storage.

A dedicated loopback browser fixture reproduced this against real IndexedDB:
the stale-editor preservation case failed while the four initial surrounding
durability cases passed. All accounts and data were synthetic. No Production API,
operator credential, paid Research call or customer record was used.

## Repair

- Both editors pass the revision they actually loaded or checkpointed. The
  comparison and write share the same IndexedDB transaction.
- A stale checkpoint preserves the previous authored version in `recoveryCopies`
  alongside the current editor version and pauses automatic synchronization.
  The stale editor retains its own server base version rather than inheriting
  another tab's newer version.
- The recovery control displays both versions. Keeping the current editor
  version requires an explicit comparison confirmation and an unchanged local
  revision. A stale review cannot remove newer work. Existing server-version
  checks and immutable request journals remain in force after local review.
- Recovery downloads include authored drafts and queued image bytes, scoped to
  the current account and Project. Downloading leaves the device records intact.
- A late acknowledgement cannot remove a conflicting device version. The
  Notebook editor publishes its own acknowledged revision within its write
  queue, preventing a slow cache update from producing a false conflict.
- Web shell references advance together to
  `20260905-device-draft-conflicts-v39` / `permitext-pro-shell-v778`.

## Verification

- `npm run check`: passed, terminal exit 0. Subsequent acknowledgement/download
  refinements were verified by the final targeted recovery suite and syntax check.
- `npm run test:readiness-recovery`: passed again after the final runtime changes,
  terminal exit 0. This includes actual mounted Notebook and Project information
  functions with deterministic overlapping storage/network boundaries, account
  isolation and deletion tests, and file-adapter concurrency tests.
- `node tests/offline-contract.mjs`: passed, including coordinated shell keys.
- Real Chromium 152 IndexedDB fixture: **7/7 passed** at
  `2026-09-05T13:35:20.059Z`–`2026-09-05T13:35:20.212Z`:
  stale writer preservation and guarded review; newer edits during acknowledgement;
  simultaneous first checkpoints; creation rekey collisions; concurrent card
  caching; drafts/images after public cleanup and context restart; deletion
  tombstones after restart with another account preserved.
- The app's actual comparison helper rendered both synthetic text versions in
  the browser. Cancel preserved the comparison; confirmed selection retained the
  current editor text. An initial fixture-only variable-shadowing error was fixed;
  no new console error appeared in the subsequent rendered run.
- `git diff --check`: passed.

Reproduce the browser checks with
`node permitext-sync-server/tests/offline-browser-durability.mjs`, open the printed
temporary loopback URL, and choose **Run durability checks**. The fixture serves
only allowlisted local modules; its content policy disables network API requests.
It uses independent same-origin frames and fresh synthetic account IDs. It does
not erase an existing user database or touch the normal localhost/Production origin.

## Acceptance limits

These checks cover actual browser storage timing plus bounded rendered recovery
controls, not the full authenticated cross-device release matrix. Physical storage
pressure, process termination/reconnect, the remaining Production account lifecycle
and export/deletion acceptance, and the public release gates remain open. The
operator-token replacement requested earlier is still required for the remaining
Production export checks. No public App Store submission is implied.

The native source is unchanged from the previously uploaded and physically
spot-checked TestFlight build 58. This is a web repair; a new full repository SHA
does not imply a new iOS binary or repeat of native acceptance.

## Production publication

Under the owner's existing repair-publication authorization, PR
[#45](https://github.com/randycodex/buildingcode/pull/45) merged by fast-forward at
`2026-09-05T13:47:26Z`. Local `main`, `origin/main`, the repair branch and GitHub
matched `0985728b26e5b247d758fce26c4e0739efef986f` at publication.

Vercel deployment `dpl_JEcWTHNrTGZYbUA4qM24utdX7LpY` reached READY for Production
with both canonical aliases. Both `/release` endpoints returned the exact
published SHA at approximately `2026-09-05T13:51:03Z`. Served `app.js`,
`offline-storage.js`, `service-worker.js` and `index.html` bytes matched the
tested source at both origins. Deployment host:
`permitext-sync-n40rvin12-randycodexs-projects-b72fc111.vercel.app`.

Production PostgreSQL `normalized-v4` health, configured Clerk authentication,
Apple universal links and the strict approved-policy byte audit passed. The
deployment-scoped error/fatal log query for `13:47:26Z`–`13:51:23Z` returned no
matching entries; this is a brief observation, not long-term reliability evidence.

The existing signed-in browser reloaded client v39, returned to Synced, retained
four saved sections, one existing synthetic note, the saved collection and the
Building Code (2014) Reader. Account displayed `Release: 0985728b26e5`. The
previous legacy-ownership recovery notice remained visible. No customer content
was changed, no Research turn was made, and the Account panel was closed after
inspection. The isolated test tab/server were also closed; the normal local
server was preserved.

Private local evidence: `/private/tmp/permitext-device-draft-production-20260905.json`,
`/private/tmp/permitext-device-draft-policy-20260905.json`,
`/private/tmp/permitext-device-draft-check-20260905.log`, and
`/private/tmp/permitext-device-draft-recovery-final-20260905.log`.

GitHub's Vercel check passed. The separate Apple cloud Archive check was still
pending when this web publication was recorded; it is not a new TestFlight
upload or additional physical-device acceptance.

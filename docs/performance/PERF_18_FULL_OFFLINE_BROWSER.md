# PERF-18 full offline browser acceptance

Run explicitly from `permitext-sync-server`:

```sh
node tests/offline-full-corpus-browser.mjs
```

This opt-in check launches installed desktop Chrome with a fresh temporary profile and isolated local production HTTP handler. It calls the unchanged production `downloadOfflineLibrary`, including shell preparation, all chapter body windows, figures, and atomic activation. It never signs in or uses the owner's browser. Allow several hundred MB of temporary storage. The runner prints its temporary profile directory and local port; keep them to resume, or stop with Ctrl-C after reviewing the result.

To verify a browser restart against that same installed origin:

```sh
OFFLINE_ACCEPTANCE_PROFILE='<printed temporary directory>' OFFLINE_ACCEPTANCE_PORT='<printed port>' node tests/offline-full-corpus-browser.mjs
```

Stop the previous runner first. The profile and install are preserved; remove that specific temporary directory only after review. No npm default test invokes this heavyweight check.

The September 24 run installed all 22 sources, 578 chapters, and 32,551 sections. Installer byte accounting was 175,839,710 bytes. Initial installation plus checks took 16.0945 seconds on localhost. A fresh Chrome process reopened the retained profile and actual workspace shell, then repeated the checks in 5.0654 seconds. Full metrics and limitations are in `PERF_18_FULL_OFFLINE_BROWSER.json`.

After install, the server rejects `/code/` requests. An uncached revision fetch must return HTTP 503 before assertions run. The check opens actual stored metadata and bodies for one section in each source, verifies `concrete` results (1,525 unrestricted; 1,232 for 2022/2014), and verifies an empty source selection returns zero results.

Static shell resources remain available from the server. Workspace HTML receives only an external acceptance script; production application and offline module code are unchanged. This first phase proves persisted installed content and source-aware offline access after restart. The separate full-network phase below verifies service-worker shell fallback. Neither phase is physical iPhone acceptance. Timing is desktop localhost evidence, not a network-download performance claim.

## Full network disconnected phase

While the isolated full-installer runner remains active:

```sh
OFFLINE_ACCEPTANCE_PROFILE='<printed temporary directory>' node tests/offline-full-network-browser.mjs
```

This connects to only that profile's Chrome debugging endpoint, disables network transport on its page and running service-worker targets, then navigates to clean `/workspace`. Checks execute through CDP, without fetching an injected runner. It discovers the installed versioned offline module in CacheStorage. This phase passed: workspace DOM present, service-worker controlled, uncached network fetch rejected, all 22 sources and exact representative metadata available, 1,232 scoped concrete results, zero all-off results. Elapsed check time was 4.761 seconds. The server remained running, but browser network transport was disabled.

An initial assertion implementation timed out while running 22 full-index searches to find representatives. A single IndexedDB scan replaced that test-only work; the subsequent phase passed without reinstalling the corpus. The test closes CDP sockets on timeout or completion. Restart the runner/browser to restore normal network operation after this offline phase.

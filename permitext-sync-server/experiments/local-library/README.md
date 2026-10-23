# Optional downloaded-library prototype

Local experiment; not enabled in the regular app or deployed. See [RESULTS.md](RESULTS.md) for the measured comparison.

## Run

Leave the ordinary local preview on port 8788 running. From `permitext-sync-server`:

```sh
node experiments/local-library/server.mjs
```

Open `http://127.0.0.1:8793/prototype`, download the library, then select **Open downloaded workspace**. The real application UI runs inside the dashboard. **Open online workspace** uses public production code APIs. For a baseline that has no library installed at all, open `http://127.0.0.1:8795/prototype` and choose online mode.

The experiment also starts an isolated synthetic account/project backend on port 8794. Public library installation reads loopback port 8788, after checking that its corpus and figure revision match production. Public online reads use `https://permitext.com`; private requests stay in the synthetic backend. The ordinary preview, its accounts, and its data are not modified. All experiment servers bind to loopback. No production mutation, model call, push, or deployment is required.

The server prints its temporary output directory. **Save measurements** writes `results.json` there. To resume the same synthetic records after stopping this experiment, set `LIBRARY_PROTOTYPE_DATA_DIR` to that printed directory. SIGINT stops only the experiment and its synthetic backend; it does not stop 8788. The browser library persists at its prototype origin.

## Data path

- IndexedDB stores each passage body once. Chapter manifests contain lightweight section metadata, so body windows read only their requested sections.
- Figures are kept in Cache Storage with exact asset revisions.
- Search downloads the existing server search catalogs, exact text, and candidate postings. It does not invent a second corpus or approximate the search rules. The worker reads only relevant posting lists and candidate documents, then applies the existing word matcher, ranking, edition/source filters, and snippets.
- A dedicated worker serves the normal public reader/search request shapes. Only public GETs are intercepted; private project and Note requests are unchanged. Caller cancellation releases the client promise and stops worker work at batch boundaries.
- The app's existing bounded in-memory caches remain active in both modes. Therefore repeat searches already cached in memory should have little additional download benefit.

The dashboard measures input-to-render with two animation frames after results or the requested reader target appears. These are renderer timing estimates, not hardware display-frame measurements. It separately records request and worker durations. Search timings include the existing input debounce.

**Measure memory & disk** uses `performance.measureUserAgentSpecificMemory()` when available and cross-origin isolated. That measurement includes document/frame/worker memory; it is not the entire Chrome renderer process or its graphics allocation. The older `performance.memory` counter is also displayed, but can include other same-site documents and is not used for the comparison. Disk is the browser's approximate origin storage accounting.

## Validation

```sh
node experiments/local-library/test-core.mjs
node experiments/local-library/test-reader-protocol.mjs
node experiments/local-library/test-server.mjs
```

The live **Compare search results** control fetches every page for six real queries and compares full result IDs and ordering, rather than checking only the first preview. The recorded run also compared the five opened reader targets and exercised repeated searches and reader closes/reopens.

## Prototype boundaries

The optional path has no production setting, entitlement rollout, update scheduler, delta downloader, quota preflight, resumable installation, installer cancellation UI, or cross-device/browser compatibility acceptance yet. It does not replace the regular app's existing offline installer. Reader-internal Find is explicitly unsupported in the prototype; global Search is the comparison under test. Existing downloaded reader/Search data are never used to bypass edition/source guards. An unfinished rebuilt index is marked unusable until rebuilt successfully.

The public corpus is complete, but the fixture projects are synthetic. Real project switch/private synchronization performance is outside this experiment. The download timing uses localhost and must not be presented as an internet download time. A production implementation still needs packaged, revision-verified index delivery, atomic replacement, available-space checks and phone/Safari acceptance.

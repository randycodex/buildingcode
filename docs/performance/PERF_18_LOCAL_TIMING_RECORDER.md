# Local development timing fallback

Instruments repeatedly failed to attach to the physical phone, even when CoreDevice showed a wired, booted device. Mirroring functional checks remained usable. This fallback records the existing application milestones locally; it does not replace CPU, memory, main-thread-stall, or display-server measurement.

## Build and storage boundary

Only builds explicitly compiled with `SWIFT_ACTIVE_COMPILATION_CONDITIONS=PERMITEXT_LOCAL_PERFORMANCE` enable recording. Normal builds contain no recorder storage/writer. The profiling configuration remains Release with coverage disabled. Build 41.17 is being prepared with this flag; its compilation and physical extraction are still pending.

The recorder accepts a finite milestone enum. Each event has a sequence, monotonic uptime and milestone; the snapshot adds schema, random run UUID, bounded app-build string, capacity and dropped-event count. There are no queries, passage IDs/text, source selections, account identifiers or network transport.

The first 2,048 events are retained; subsequent events increment a dropped count. A single utility queue coalesces atomic writes to `Library/Caches/PermitextPerformance/current.json` approximately one second after activity. A single replaced file bounds storage across launches. Per-event work includes a lock, clock and bounded append; overhead is nonzero and has not been measured on-device. Suspension/termination may lose the last second, and a write failure can leave an old file. Run UUID, build and dropped count must be checked before analysis.

## Physical procedure

1. Install the verified development profiling artifact in place. Do not uninstall or clear owner data.
2. Launch Permitext and use Mirroring for one sequential scenario at a time. Note visible source scope and result count separately; the recorder intentionally omits them.
3. Run Search to completion, then open and close one exact result repeatedly. Avoid overlapping requests. Inspect complete body, references and edition identity independently of timing.
4. Allow the asynchronous snapshot write to finish while the app remains foreground. Copy only the timing file:

   ```sh
   xcrun devicectl device copy from --device 00008150-001535280CC0401C \
     --domain-type appDataContainer --domain-identifier com.randycodex.permitext \
     --source Library/Caches/PermitextPerformance/current.json \
     --destination /tmp/permitext-local-timing.json --timeout 20
   ```

5. Confirm expected build and a fresh run UUID, then summarize:

   ```sh
   python3 Tools/permitext_local_timing_summary.py /tmp/permitext-local-timing.json --expected-build 41.17
   ```

6. Keep raw sequential samples. Do not report percentiles from a few interactions. Retest with the same configuration for comparisons. A completed local capture does not close missing account, cold-launch, offline or resource gates.

## What the report means

- Search work ends only after current-generation complete publication; cancellation, partial outcomes, failures and overlapping requests are excluded. This interval excludes input debounce.
- Result opening is measured separately to body `onAppear` and reference-data readiness.
- Native chapter opening uses destination preparation and native content `onAppear` or the separate restoration-completed callback; the report identifies which endpoint occurred.
- SwiftUI `onAppear` is an application callback, not proof of the exact displayed frame. Combine it with rendered correctness observations; retain that limitation.
- The analyzer rejects wrong-build, truncated, unordered and invalid snapshots. Overlapping requests invalidate that interval family because no per-request identifier is collected.

Host validation: enabled/disabled actual Swift recorder contracts pass concurrency, cap, sequence/clock order, delayed flush, fixed schema and run replacement. Five analyzer tests cover successful complete Search, partial exclusion, separate body/reference intervals, overlapping requests, missing endings and invalid snapshots. Existing active-source aggregate passes with instrumentation disabled. Physical extraction and usefulness remain unverified until the profiling build runs on the phone.

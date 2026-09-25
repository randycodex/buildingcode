# Performance integration preflight — September25

Source checkpoint: `f5b21f397d6c320ef7e97b20ecb03ce72fc4c05a` on codex/permitext-performance. No main merge, push, deployment or distribution action performed.

- `npm run verify:deploy-content`: PASS. Generated figure manifest/body/index validation covers21,472published body files,578chapter indexes and32,551sections. Local log: `/tmp/permitext-final-content-verification.log`.
- `npm run smoke`: PASS. Full configured web smoke command completed successfully. Local log: `/tmp/permitext-integration-smoke.log`. This is local integration evidence, not production service or account acceptance.
- Normal iOS Release, profiling compile flag disabled: PASS: build and strict signature verification succeeded. The build log contains no recorder define or coverage compiler flags. Generic physical iOS destination, no simulator. Separate output directory preserves installed profiling-build artifact41.25. This verification-only artifact was not installed. Build log: `/tmp/permitext-normal-release-41.25.log`.
- Xcode project diff adds ActiveCodeSources and LocalPerformanceRecorder source membership; profiling flag is not enabled in checked-in build settings. Checked-in build number remains41; development41.25 uses a command-line override. A distribution build requires its own verified release version/provenance.
- Remote main55302eded is an ancestor at the previous fetch checkpoint. There is no divergent main commit to resolve; this does not replace code review or satisfy device/release gates.

Still open: direct-phone figure/table checks, controlled startup/scope and frame/stall measurements, populated native Saved/sync/account transitions, deployed revision/cache verification, distribution acceptance, and owner scope decision for full optional downloads. See the remaining execution disposition and physical checklist. Passing preflight does not close these requirements.

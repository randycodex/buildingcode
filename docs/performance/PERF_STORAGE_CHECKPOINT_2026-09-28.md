# Performance artifact cleanup — September28

Owner explicitly authorized deleting unnecessary artifacts and resuming the plan. Free space was53GiB before cleanup and54GiB afterward (rounded df values; logical file sizes are not exact reclaimed physical bytes).

## Removed

- `/tmp/permitext-perf18-build/Build/Intermediates.noindex` —505MiB of regenerable compiler intermediates; app product and dSYM retained.
- `/tmp/permitext-4130-chapters-hitches-20260928-01.trace` —285MiB; excluded unconfirmed-gesture capture, superseded by the confirmed03 trace.
- `/tmp/permitext-4130-chapters-confirmed-20260928-02.trace` —171MiB; excluded idle capture, superseded by the confirmed03 trace.
- `/var/folders/7n/n3rb544x4fn41_wd2xr352tr0000gn/X/com.google.Chrome.code_sign_clone` —aged temporary signing clone selected by the repository storage guard.

The three explicit targets were directories, not symlinks; lsof found no open handles. No Xcode/build/profiling/signing operation was active. Repository storage guard ran audit then clean without bypassing its age/size/process checks.

## Retained

Confirmed41.30 trace, current41.32 app and dSYM,41.30 preserved symbols, diagnostic logs and unresolved older diagnostic traces. CoreDevice installation deltas4.1GiB remained below the guard threshold. No source, account data, DeviceSupport, Git worktree, or unrelated owner file was removed. Main’s existing untracked files remain untouched.

## Profiling discipline on resumption

No new recording was started during cleanup. Future captures must target a named unresolved question, begin only when the operator is ready, use15–30seconds for a single interaction and the minimum relevant instrument. Check free space before starting and monitor process/disk growth through recording and save. Stop the owned recording if free space approaches10GiB or observed trace growth exceeds2GiB; stopping does not guarantee small save-stage temporary files, so do not treat this as a proven cap. Do not reuse the failed three-minute Animation Hitches configuration. Keep valid raw evidence until its analysis is complete; delete only identified superseded/excluded artifacts after checking active use.

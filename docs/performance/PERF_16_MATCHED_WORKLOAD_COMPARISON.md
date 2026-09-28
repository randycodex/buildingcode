# PERF-16 — matched visible workload comparison

## Why this remains necessary

PERF-16 acceptance item 7 requires the same visible target with small versus large unrelated account content. Earlier four-pane medians (157.6 ms small, 635.5 ms large) also varied visible Saved rows, Note length/images and Report length. They describe those workloads, but cannot isolate account-size cost.

## Fixture and measurement protocol

Use `tests/populated-workspace-performance-fixture.mjs --visible-workload matched` with `--profile small` and `--profile large` on separate loopback ports. Default stress profiles stay unchanged.

Both Project 1 workspaces must have identical canonical three Saved passages, four Notes, a one-paragraph first Note with one identical tiny image, and the same eight Report blocks. Large account extras belong to other projects. Verify authenticated persisted reads and matching stable content hashes before browser timing. Keep asset revision, viewport, visible pane order, selected Note, library install state and warmup policy identical.

Open Search, Project Saved, Note 1 and Report using the real UI. Measure readiness of all expected contents separately from the two-animation-frame callback floor. Record five warm reloads per profile, request counts and long tasks. Report median/range only; five runs do not support a robust p95. If an account-size cost appears, attribute it before changing production code.

## Status

Matched fixture implementation and cross-profile integrity verification pass. Run `npm run test:matched-workload` in `permitext-sync-server`; parent rerun passed. Persisted visible-content SHA-256 is `7fb43eeba391d33af0cda680cb2d26e04b9d1e1949f6595dc6e8d31741ebe669` for both. Canonical visible section IDs are 8779, 8780 and 8781 in the 2022 construction edition. Account totals remain 12/2/4 versus 1000/12/60 Saved/Projects/Notes. Browser measurements are not yet performed. This record must not be cited as a speedup or completed account-size acceptance.

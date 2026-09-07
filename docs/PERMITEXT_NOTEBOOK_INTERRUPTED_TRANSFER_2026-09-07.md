# Notebook interrupted transfer — September 7, 2026

Three actual transport phases passed in Chrome with the current application
upload, asset reconciliation and Note synchronization handlers. Two page
reloads retained the original image and draft. Final retry recovered one
image, saved one Note with its permanent image reference, and acknowledged
the local draft only after the Note save succeeded.

This adds the previously missing mid-body interruption evidence for the local
web pipeline. It does not close B4's actual storage-pressure/OS-eviction,
hosted private-storage/PostgreSQL or physical-iPhone transfer coverage.

## Reproducible exercise

Run `npm run test:notebook-transfer-browser` in `permitext-sync-server`, open
its printed loopback URL in Chrome, and use the three numbered-by-order
controls, reloading between phases. After completion, use **Clean up fixture**,
reload to verify an empty checkpoint, close that tab, and stop the server with
Ctrl-C.

The fixture has two local HTTP servers. A proxy cuts an actual upstream socket
after the application's body reader consumes 32 bytes of a declared 68-byte
PNG. In phase two, the proxy consumes and discards a successful server
response before closing the browser connection. Phase three relays normally.
It does not replace `fetch` in the browser with a fabricated failure.

The browser imports the real IndexedDB module and extracts the application's
`uploadPendingNotebookImage`, image dimensions/reference reconciliation and
`synchronizeNotebookDraft` functions. The fixture supplies its own minimal UI,
synthetic account identity, HTTP helper and pending-status display adapter.
It uses the current schema-version-2 BlockNote document format. It creates
the pending-save journal through the real synchronization handler only after
all local image references resolve.

Backend account, Pro grant, Project, image and Note are synthetic and use a new
temporary file store. Provider/database credentials are removed from that
process; external fetch attempts are rejected. No Production account, grant,
paid Research, purchase or live-provider request is involved.

## Verified run

The successful run began at `2026-09-07T16:57:00.782Z` on
`http://127.0.0.1:64361/`. Independent server/file verification completed at
`2026-09-07T16:58:39.075459+00:00`.

| Phase | Observed result |
| --- | --- |
| Partial body | Chrome made two transport attempts; each delivered exactly 32/68 bytes, aborted without completing the body, and finished its handler. Zero committed images or Notes; exact local draft and original PNG retained; synchronization withheld the Note save |
| Reload and lost response | The same image identity reached the app in full. Chrome made three attempts; all completed with server status 200 and their response was discarded. One image remained on the server; the browser retained its unacknowledged image and unchanged draft; no Note was saved |
| Second reload and recovery | One final full upload returned the existing asset, preserving its upload timestamp and hash. One version-1 Note saved with a permanent image reference. The draft was acknowledged/removed and a separate authenticated image read returned the original bytes |

Independent filesystem inspection found exactly one private file, one
`notebookImageAsset` and one version-1 `notebookCard`. The saved Note uses
schema version 2, contains the correct permanent asset reference and has no
device-local image reference. PNG size is 68 bytes; SHA-256 is
`97737a870e5bd38fa539b9455040ecb2b5e02d6f1ed409b250da33a4139b5561`.
The preserved upload timestamp is `2026-09-07T16:57:12.624Z`.

Private receipt: `/private/tmp/permitext-notebook-transfer-20260907.json`.
It includes every transfer, final file/Note counts, hashes and the exact source
file hashes. Application runtime files were unchanged by this test.

The expected aborted connections emitted local `request_error: aborted`
logs; their handler status was 500 after the socket closed. This record
establishes storage/recovery behavior, not clean Production error metrics.
Earlier fixture-development runs exposed browser transport retries, premature
test-only journal creation and an outdated document schema in the fixture;
these setup assumptions were corrected before the recorded successful run.

## Cleanup and limits

Every development run's dedicated browser data and server store were cleaned
before restarting. For the final run, the browser reported removal of its
database/checkpoint and a reload showed **Ready** with no retained evidence.
The exact server session then reported removal of synthetic servers/private
storage and exited 0; its tab was closed. User account sessions were retained.

The exercise uses a small real PNG, current desktop Chrome, real loopback TCP,
actual application handlers, real IndexedDB and the local file-store/image
provider. It does not test a large upload, mobile-radio interruption, low disk
space, OS eviction, real Clerk login, Vercel Blob or Production PostgreSQL.
Those remaining boundaries stay explicit in the original closeout checklist.

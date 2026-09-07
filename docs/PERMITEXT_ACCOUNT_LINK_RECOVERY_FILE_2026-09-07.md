# Account-link retained-work recovery file — September 7, 2026

The missing independent download receipt is now verified. Chrome downloaded
the application's recovery JSON after a lost link response and tab restart;
the actual file contains the retained Note, pending-save journal, original PNG
bytes and later source edit. It excludes credential fields and unattributed
legacy work. This closes the isolated recovery-file check, not the remaining
live Apple/Microsoft/provider-link/consent matrix.

## Scope and execution

The existing `tests/account-link-recovery-browser.mjs` server remained alive
at `http://127.0.0.1:62830/`; it was not restarted. Before reopening the tab,
its request log contained the three preparation sign-ins. The existing
browser record identified run `049849ea-8e10-4dec-8679-5d72d8164749`, started
at `2026-09-07T15:44:45.697Z`. Source and fixture match branch
`f198eae1f97a81db635e45ade7b41ef7963f5125`.

The fixture uses real Chrome IndexedDB/local storage, the actual local account
HTTP handler, and recovery/sign-in/download functions extracted from `app.js`.
Provider login, view hydration and background synchronization have explicit
synthetic adapters. The server removes provider/database credentials, uses
temporary file storage and rejects external fetches. It is not a deployed
Clerk-provider integration or Production account merge.

After the original tab had closed, reopening the same origin restored only
the persisted fixture evidence. Clicking **Recover after reload** restored
source ancestry from the server checkpoint. Clicking the application's
**Export retained source work** produced Chrome's completed download, and
**Verify export and isolation** reported all six checks passed:

1. The local HTTP link completed while its client receipt was discarded.
2. An independent stale source context retained a real draft, pending-save
   journal and PNG after linking.
3. An unrelated authenticated account and forged ancestry could not export
   the source work.
4. Fresh sign-in after tab restart reconstructed exact source access from
   the server checkpoint without a prior destination-side client receipt.
5. Export included the exact draft/journal, PNG and later source edit while
   excluding credentials and unattributed legacy data.
6. Source namespaces remained unchanged; the destination had no drafts,
   images or outbox, and the server saw only four sign-in requests, with no
   automatic source-work replay.

## Independent downloaded-file receipt

Chrome displayed `permitext-linked-account-recovery (3).json`, **Done**.
The actual file was located in the user's iCloud Downloads directory and read
independently through the filesystem. Assertions at
`2026-09-07T16:39:15.076895+00:00` verified:

- Export timestamp: `2026-09-07T16:37:34.568Z`.
- Format/version: `permitext-account-local-recovery`, version 1, export-only.
- Source/destination IDs match this exact synthetic run.
- One draft and one image; base version 3 and the same revision/document in
  the Note and its pending-save journal.
- The draft's image reference resolves to the exported image; all 68 PNG
  bytes equal the original fixture image.
- The later source edit is included; credential markers and ambiguous legacy
  text are absent.
- The fresh server request log contains exactly four `POST /account/sign-in`
  entries and no other mutation path.

File size: **3,823 bytes**. SHA-256:
`7b3f6a60e170f4726e4bcedbe779d59b47ddd22f9cdfa2c65e9c7ef18b971fdb`.
PNG SHA-256:
`97737a870e5bd38fa539b9455040ecb2b5e02d6f1ed409b250da33a4139b5561`.

The private machine receipt is
`/private/tmp/permitext-link-recovery-receipt-20260907.json`.
The downloaded synthetic JSON remains available outside the repository; no
raw account export or private contact information was committed.

## Cleanup and remaining boundary

The fixture's **Clean up fixture** control reported removal of its database,
local storage and session storage. A reload returned **Ready**, with Recover
and Verify disabled and no retained evidence. The test tab was closed. The
same server received SIGINT, reported removal of synthetic server/private-file
storage, and exited 0. Production and Gmail sessions were not signed out.

Real provider-link authorization/consent and remaining live provider cases
stay open. This result must not be used as evidence of OS storage eviction,
physical-device recovery or the final selected release's complete acceptance.

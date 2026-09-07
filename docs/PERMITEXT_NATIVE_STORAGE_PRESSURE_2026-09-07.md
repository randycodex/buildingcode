# Native cache under actual storage pressure — September 7, 2026

The shipped `ProjectHubOfflineCache` preserved its previously durable files
when real APFS storage exhaustion rejected a replacement and a new draft.
A separate process recovered the exact previous payloads while storage was
still exhausted. After freeing space, both retries became durable and another
process recovered them exactly. No production repair was needed for this path.

This is macOS execution of the actual native cache implementation. It adds
controlled storage-pressure evidence to B4; it does not establish iOS UI
behavior, physical-device pressure, browser quota eviction or OS termination.

## Reproduction and isolation

From the repository root, run:

```sh
python3 Tools/permitext_native_storage_pressure.py --receipt /private/tmp/permitext-native-pressure-new-run.json
```

The runner requires macOS, Swift and at least 1 GiB of host free space. It
creates a disposable 128 MiB APFS disk image and checks that the mounted
filesystem differs from the host before filling it. All writes are bounded
to that volume. Cleanup detaches the image and removes only its newly created
temporary directory. An existing receipt is never overwritten.

The harness compiles the unchanged cache definitions and implementation from
`ProjectHubOfflineCache.swift`, excluding the unrelated identity/policy types
after it. A namespace adapter supplies the actual Research cache-scope string
read from source; no storage API or error is mocked. The payload is a synthetic
`Codable` structure with text, pending-request fields and 65,536 binary bytes.
Those bytes exercise cache serialization; they are not a native image-upload
attachment or the actual `NativeNotebookDraft` model.

Each of the five phases runs in a separate executable process. A second
synthetic account acts as an isolation control. No installed app container,
real account, network service, price, entitlement or device setting is used.

## Verified run

Run: `2026-09-07T17:13:20.213616+00:00` through
`2026-09-07T17:13:34.257127+00:00`.
Compiler: Apple Swift 6.3.3, target `arm64-apple-macosx26.0`.
Cache source SHA-256:
`006b6faced65ce2f15ea2083e2a1a973b8a78365a0378b58642c4f201b0036fc`.
Compiled cache-prefix SHA-256:
`5bf5da7f7066ed922860b2f0a1e076e0ca6018df270d83e94bc3c6671c26bf9e`.

| Phase | Evidence |
| --- | --- |
| Seed | Two account-scoped draft files durably written |
| Exhaustion | Filler writes stopped with POSIX `ENOSPC` (28); replacing the existing draft and writing a new draft each returned Cocoa 640 with underlying POSIX 28 |
| Restart while full | Exact original text, pending-request fields and binary payload restored; recovery listing contained the original draft; failed new draft absent; other account unchanged |
| Free space and retry | Filler removed; both previously failed writes succeeded |
| Restart after recovery | Both newer payloads restored exactly; other account still unchanged |

The volume capacity was 134,176,768 bytes; the filler wrote 129,236,992 bytes.
Filesystem statistics still reported 3,264,512 free bytes at failure, so the
assertion depends on actual write errors rather than a zero-free-space display.
Before/after SHA-256 maps of both durable cache files were identical during
failure. Their common hash was
`8993871251aad5d9d008c805b0021d138047ca8c73a770f52645b781a14e659f`.
All five processes had distinct PIDs.

Private receipt: `/private/tmp/permitext-native-storage-pressure-20260907.json`.
It records each process, both error chains, file hashes, capacity, source
identity and cleanup completion. An independent temporary-directory check
found no remaining `permitext-native-pressure-*` directory after the run.

## Remaining boundaries

Newer edits whose write failed were not durable; the test confirms preservation
of the previously saved draft, then successful retry of the newer payload.
The native editor's source already reports that its local draft is not saved
and instructs the user to keep the Note open and free space. This exercise
does not render or physically verify that message.

B4 still needs a recorded disposition for iOS storage pressure, OS eviction,
browser quota/eviction, and broader hosted/native interrupted transfers. The
existing real Chrome/HTTP transfer pass and this real APFS failure pass cover
different conditions. Neither should be repeated or presented as completing
all remaining storage/release gates.

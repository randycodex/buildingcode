# Local edition-pack installation prototype

Host Swift package; no app integration, network downloader, device or simulator. Run `swift test`, or `swift run edition-pack install SOURCE ROOT TRUSTED_MANIFEST_SHA256`.

SOURCE contains `manifest.json` and exactly its listed regular files. Manifest schema 1 has explicit `packID`, `revision`, `sourceIdentities`, and `files` entries (`path`, `bytes`, lowercase `sha256`). The supplied digest must come from an independently trusted release channel. This prototype does not establish that trust, sign manifests, or infer canonical source identities.

Installation validates, copies into private staging, validates again, moves to an immutable revision directory and atomically replaces a small active pointer. Previous revisions remain available for explicit validated rollback. Failure before activation preserves the prior pointer. Reinstalling an existing revision requires the exact same manifest. Source and store must not be concurrently mutated: this is single-writer local-directory transport, not a hardened adversarial downloader. Use canonical macOS temporary paths (`/private/var/...` rather than the `/var` symlink).

Storage-budget and interruption closures support deterministic tests. The default budget is unlimited (`Int64.max`), so production integration must supply actual available-space checks plus filesystem overhead/headroom. Logical budget includes payload and manifest bytes, not APFS metadata or temporary overhead. Atomic pointer replacement is not a power-loss durability/fsync guarantee. No automatic garbage collection, persistent download resume, archive extraction, multiwriter locking, signature distribution, native catalog integration, or active Reader reference counting is provided.

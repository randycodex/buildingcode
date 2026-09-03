# Permitext Beta 1 build 51 physical-iPhone acceptance — September 3, 2026

Status: **PARTIAL PASS — the replacement 2014 Building Code Chapter 7 Reader check passed on a physical iPhone; the remaining release-bound client workflows remain open**

This record contains no email address, customer content, provider token, payment data, raw account export, or other personal identifier. The owner performed the physical-iPhone observation. Codex retained only release identity, build metadata, hashes, automated-verification results, and the bounded pass/open outcome.

## Exact release identity

- Git commit: `195de4f31229d785760eef570a658208f1f4e47d`.
- Branch at build time: `main`; local `HEAD` and `origin/main` matched the exact commit before archive and upload.
- Production deployment: `dpl_EVfpG8R9q1Di3F7kguri9ekbjYvs`, state `READY`.
- Canonical Production URL: `https://permitext-sync.vercel.app`.
- Production `/release`: release ID `195de4f31229`, exact full Git commit above, environment `production`.
- iOS app: version `1.0`, build `51`, bundle identifier `com.randycodex.permitext`.
- Archive backend: `https://permitext-sync.vercel.app`.
- Native Reader rollout stage: `isolated-table-fallback`.
- Archive executable SHA-256: `650650e5529c4427b6b50b37a2447bc71408bb7dbcf767f0936e47d46c2ea450`.
- Encryption declaration: `ITSAppUsesNonExemptEncryption=false`.

## Build, upload, and automated verification

- The signed build 51 archive was produced from an isolated checkout at the exact Git commit above. Strict deep code-signature verification passed.
- The archive contains the byte-identical 2014 Building Code Chapter 7 file `bc-7.html`, size 427,359 bytes.
- The archive contains all 111 prepared 2014 chapter documents, 9,989 prepared 2014 resources, and 285 bundled local media items.
- The exact-commit iOS suite passed `161/161` tests with zero failures. A dedicated Simulator fixture visibly opened 2014 Building Code Chapter 7.
- Production verification passed for `/release`, `/health`, AASA, exact policy publication, and the protected deployment configuration. The live release and archive were bound to the same full Git commit.
- App Store upload completed with `Upload succeeded` and `EXPORT SUCCEEDED` on September 3, 2026.
- App Store Connect processed version `1.0`, build `51`, as `Validated` and `Ready to Submit`; it was assigned to the Internal Testers group.

## Physical-iPhone Reader observation

On September 3, 2026, the owner installed TestFlight build 51, opened 2014 Construction Codes → Building Code → Chapter 7, and reported: `it looks good now`.

This closes the specific release-blocking failure observed in build 50: the physical iPhone no longer presents `Chapter HTML Missing` for 2014 Building Code Chapter 7, and the owner accepted the opened chapter's rendered result.

The owner then opened Account on build 51 and confirmed all three requested continuity indicators:

- The existing Permitext account remained signed in.
- The plan displayed `Lifetime Pro`.
- Sync displayed `Synced`.

This is persisted existing-account continuity, not a fresh Apple sign-in exercise.

## Evidence boundary

This result proves the replacement resolver and bundled Chapter 7 work together on the tested physical iPhone. It does **not** by itself prove every section, table, image, chapter, or 2014 code family on a physical device. Automated corpus and native tests provide broader non-device coverage, but do not replace representative owner testing.

This observation does not prove fresh Apple authentication, existing saved-content continuity, Project-item continuity, Free entitlement presentation, restore/cancellation presentation, a complete Production Research turn, the remaining sign-in provider matrix, or the disposable-account export/deletion lifecycle. Final public-Beta owner go/no-go remains open.

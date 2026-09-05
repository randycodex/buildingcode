# App Store Screenshot Package

## Current local candidate

September 5: [build 58 candidate](./build58-candidate/provenance.json) contains
four newly captured `1320 × 2868` Release Simulator images. PNG originals are in
`build58-candidate/iphone-6.9/`; JPEG upload copies without alpha are in its
`submission/` directory. The order remains library, Reader, search and Saved.

The capture uses the real signed-out application on the iPhone 17 Pro Max,
iOS 26.5, built with the iOS 27 Simulator SDK. It verifies all five accessible
tab names, the 2022 Building Code chapter picker, a single chapter-label prefix,
Chapter 7 Reader without the debug control, search results, and saved passages.
All four settled PNGs were visually inspected. The first search capture caught
the system tab-bar transition; the accepted set waits for that transition and
shows every icon. No application pixels were retouched. Simulator status-bar
overrides provide 9:41, Wi-Fi and a full battery.

The candidate manifest records image hashes, conversion, the executable hash
and native runtime tree `52dbb515963108de06568fa85baab5994ea5511f`. The native
accessibility repair was present during capture; the source base commit alone
does not represent that repair. These are preparation artifacts, not an App
Store upload, final build selection, TestFlight availability or physical-device
acceptance. Reverify compatibility with the selected submission candidate and
obtain the required approval before upload.

To recapture, replace `SIMULATOR_UUID` and `CANDIDATE_BUILD` below with a dedicated
signed-out Simulator's identifier and the candidate build number, then choose an
unused result-bundle path:

```sh
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
./Tools/permitext_xcode.sh capture-simulator 'SIMULATOR_UUID' \
  CURRENT_PROJECT_VERSION='CANDIDATE_BUILD' MARKETING_VERSION=1.0 \
  ARCHS=arm64 ONLY_ACTIVE_ARCH=YES \
  -disableAutomaticPackageResolution -onlyUsePackageVersionsFromResolvedFile \
  -resultBundlePath /private/tmp/permitext-app-store-capture.xcresult
```

The wrapper enforces Release configuration, a Simulator destination and serial
execution. The capture test does not sign in, buy Pro or submit Research. It may
save the displayed code passage in the Simulator's guest workspace. Export the
four named attachments with `xcresulttool export attachments`, inspect them, and
convert upload copies while preserving their original dimensions. Keep raw
failure diagnostics restricted because they may show existing Simulator data.

## Historical build 33

Prepared for Permitext 1.0, Build 33, from source commit `45ec8be57e9734f9bf66dad8ab46abadf7cf5b31`.

September 3 re-audit: **historical package; do not upload as the final set.** All four JPEGs still pass dimension/alpha checks, but `02-code-reader.jpg` visibly includes the Reader's ladybug debug control. Re-capture the set from the final release-configured candidate and verify current navigation before upload. No image was modified or deleted by this audit.

## Historical candidate files

The JPEG files in `iphone-6.9/submission/` use this order:

1. `01-code-library.jpg` — Building Code chapter library
2. `02-code-reader.jpg` — native Chapter 7 code reader
3. `03-search-results.jpg` — cross-code search results for `fire resistance`
4. `04-saved-section.jpg` — locally saved Building Code section

Every submission file is:

- `1320 × 2868` pixels, an accepted iPhone 6.9-inch portrait size;
- JPEG with no alpha channel;
- captured from the iPhone 17 Pro Max Simulator on iOS 26.5;
- without visible personal account information in the September 3 review; and
- visually checked after capture, with the later debug-control finding above superseding the original clean-diagnostics claim.

The sibling PNG files are the lossless Simulator originals. They retain an alpha channel and are not the upload copies.

## Provenance and limits

- The current source was built locally with the `permitext` scheme for the iPhone 17 Pro Max Simulator.
- The built bundle reports version `1.0` and build `33`.
- The four final screenshots were recaptured after that Build 33 app was installed and launched.
- These screenshots verify the rendered library, reader, search, and saved-section states. They do not replace the final physical-device smoke test or App Store review.

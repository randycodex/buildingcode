# App Store Screenshot Package

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

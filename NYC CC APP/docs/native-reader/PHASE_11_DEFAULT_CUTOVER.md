# Native Reader Phase 11 Default Cutover

Date: 2026-08-19

## Status

The local native Reader migration implementation is complete through Phase 11. Validated chapters are native by default in both Debug and Release configurations. The authoritative HTML Reader remains the automatic fallback for invalid, unknown, unsupported, or newly introduced content patterns and remains available through the diagnostic selector.

This checkpoint does not claim TestFlight or App Store evidence. The migration plan calls for TestFlight during the Phase 10 gate; on 2026-08-19, the user explicitly chose to defer that run and proceed with the local default cutover. No TestFlight upload, App Store Connect change, App Store submission, production release, or merge to `main` was performed.

## Default routing

Both application configurations now embed:

`PermitextNativeReaderRolloutStage = isolated-table-fallback`

The cumulative stage enables every document that passed the deterministic native eligibility and fidelity gates:

- 233 text-only chapters.
- 6 media chapters.
- 0 current native-grid table chapters.
- 3 chapters with bounded isolated complex-table fallback.
- 242 total native-default chapters.

The same generated schema-2 index continues to exclude:

- 208 `fullHTMLFallback` chapters.
- 13 `invalidContent` chapters.

Those 221 chapters open in the authoritative HTML Reader. A native document that fails runtime integrity, table, or media validation also switches immediately to HTML. A future content package that introduces an unsupported construct cannot enter the native route until the regenerated versioned index classifies and validates it.

The feature flag and launch-argument override remain intact. Invalid or missing explicit flag values still fail closed to HTML-only routing. The internal selector retains `Native (Default)` and `HTML (Diagnostic)` presentations without loading both readers simultaneously.

## Verification

Completed on the retained iPhone 17 Pro simulator running iOS 26.5 with parallel workers disabled:

- Focused Phase 11 build-setting and invalid-content routing contracts: 2 passed, zero failures.
- Complete iOS unit/contract target: 101 passed, zero failures, zero skips.
- The Phase 11 source contract verifies that both Debug and Release use `isolated-table-fallback`, no normal configuration remains `off`, and the HTML diagnostic path remains present.
- The corpus routing contract verifies that each validated tier is enabled monotonically and that representative invalid content returns no native route.

Clean arm64 Release verification:

- Unsigned Release build: passed.
- Built app reported version 1.0 build 19.
- Built Info.plist contained `PermitextNativeReaderRolloutStage = isolated-table-fallback`.
- No XCTest bundle was present.

Exact signed Release-device verification:

- Clean signed Release build: passed.
- Built app reported version 1.0 build 19 and `isolated-table-fallback`.
- No XCTest bundle was present.
- Strict deep code-signature verification passed.
- The signed Release build was installed in place and launched on the connected iPhone 17 Pro running iOS 27.0.
- Device inventory contained exactly one `com.randycodex.permitext` app, version 1.0 build 19.

## Preserved fallback and follow-up work

The authoritative HTML content, assets, Reader implementation, automatic fallback routing, diagnostic presentation, versioned parser schema, and eligibility manifest remain in the repository. None was deleted or replaced by independently maintained Swift legal text.

Two accepted UX follow-ups remain outside this completed local migration checkpoint:

- Replace the intermediate `Preparing native Reader…` restoration state with a genuinely direct first frame at the saved location, without reintroducing a visible jump, horizontal drift, or stale-position reversal.
- Run a dedicated native visual-formatting parity pass; the user currently prefers the authoritative HTML Reader's typography and spacing.

TestFlight evidence also remains explicitly deferred. If resumed, it must be treated as a separate release-validation task rather than retroactively claimed by this checkpoint.

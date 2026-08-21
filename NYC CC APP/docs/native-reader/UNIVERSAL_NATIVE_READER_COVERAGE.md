# Universal Native Reader Coverage

Date: 2026-08-21

Branch: `codex/universal-native-reader`

## Current result

Every indexed code section and chapter in the shipped corpus now opens through the native iOS Reader.

- 463 of 463 authored chapters have deterministic native documents.
- 312 chapters render entirely with native text, list, link, and media blocks.
- 151 chapters remain native at the chapter level while preserving complex tables inside bounded, isolated table web views.
- 0 known chapters use whole-chapter HTML fallback.
- 0 known chapters are classified as invalid content.
- 0 generated documents fail structural validation.

This is universal coverage of the current indexed corpus, not permission to silently accept unknown future markup. The authoritative HTML Reader remains an emergency fallback for an unindexed future chapter, an unsupported future construct, a schema mismatch, or a runtime integrity failure.

## What changed

The deterministic parser and runtime now preserve corpus-known legacy presentation markup, inter-code links, duplicate authored anchors, embedded data-URI images, tables nested inside list items, and very large tables without rejecting the entire chapter.

Complex tables preserve their source HTML inside the native chapter. Their horizontal and, for unusually tall tables, vertical scrolling is confined to the table viewport. The outer chapter remains the native SwiftUI Reader.

Thirty-nine media references are declared by their source packages but do not have a delivered asset. Those chapters remain native and show an explicit `Image unavailable` placeholder at the authored position. Existing local assets and nineteen embedded data-URI images must still decode successfully. If an asset expected by the generated document later disappears or changes integrity, runtime validation fails closed to the authoritative HTML Reader.

Duplicate authored anchor IDs no longer reject a complete chapter. The first occurrence stays the canonical jump destination, the duplicates remain recorded in parser audit metadata, and enacted text is not rewritten.

## Verification

Completed on the retained iPhone 17 Pro simulator running iOS 26.5:

- Native inventory package: 17 passed, 0 failed.
- Deterministic full-corpus generation and `--check`: 463 chapters, 1,677 tables, 885 media records, 0 whole-chapter fallbacks, and 0 invalid chapters.
- Exhaustive iOS load and semantic/asset parity gate: all 463 generated documents opened and passed runtime table/media validation.
- Complete iOS unit/contract suite: 116 passed, 0 failed, 0 skipped.
- Debug simulator build: passed.
- Rendered UI test: former HTML-only Plumbing Code Chapter 1 opened through the native Reader and displayed the native-ready state, code/chapter title, enacted text, jump control, and bookmark control.

The generated corpus hash is:

`57166ea4cf999e2c223e2da07a826dfc312ea342a662cc797a22b51fac0d7cda`

## Evidence boundary

The physical phone was unavailable for this checkpoint. No claim is made here about final physical-device scrolling, memory, VoiceOver, link-tap coverage, or oldest-supported-device performance. Those checks remain separate from the verified source, corpus, simulator, and automated-test coverage above.

TestFlight remains explicitly deferred. This checkpoint does not claim an App Store upload, submission, or release.

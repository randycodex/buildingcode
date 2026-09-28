# UX-04/10: Recently Viewed exact edition — September 28, 2026

Status: web correction and bounded local rendered acceptance complete. Native build unchanged; physical cross-device and hosted rollout acceptance remain open.

## Reproduced problem

After opening saved 2014 Administrative section `28-101.3.1`, the local synthetic workspace showed its Recently Viewed tile as “General Administrative Code (2022 edition)”. The creating function selected a prefix-only label and omitted both `codeVersion` and native `sourceVersion`. Reopening passed the entry through `searchResultDetail`, which inserted a default edition before exact-source validation. Clicking the legacy tile produced “Source could not be opened” with “Code library changed while loading. Retry with its current manifest.” This observed error is recorded verbatim; it does not prove that an incorrect edition was rendered.

The server history merge also used only prefix and section ID, ignoring editions. A label-only patch would leave the durable identity problem unresolved.

## Required correction

1. Store the Reader's actual canonical edition in new web history records, including the native-compatible `sourceVersion` field.
2. Retain separate history for different editions and normalize explicit native/web aliases during merge.
3. Keep unknown legacy editions unknown; do not guess from title, current Reader, account, or surrounding continuity snapshot.
4. Pass legacy exact section identity to the guarded resolver without inventing a current edition or an unknown prefix.
5. Label explicit sources using their canonical edition. Label unknown legacy entries honestly. Do not delete legacy records to hide the defect.
6. Verify historical entry creation, reload, opening, and independent occupied Reader preservation. Test cross-edition/native-web server merge and existing continuity clear/recency rules.

No native build changes or hosted rollout are included in this correction.

## Implemented and verified

New web entries carry canonical `codeVersion` and `sourceVersion`. Explicit history identity is canonical edition plus section ID, matching native `historyIdentity` and the edition-wide index in `AuthoredCodeStore.swift` (section insertion and lookup). Legacy identity remains separately namespaced; records are not deleted or relabeled with guessed editions. Unknown explicit editions cannot fall through to a current-edition label. Legacy preview enrichment waits for an explicit guarded open rather than guessing a source.

Browser verification used a refreshed synthetic signed-in account on port 8805 after the previous fixture process expired. Candidate asset: `20260928-recent-source-edition-v601`, shell 1244.

1. Opened saved 2014 `28-101.3.1` and its Reader while an independent 2022 Building Chapter 1 Reader remained open.
2. Search Recently Viewed showed “General Administrative Provisions (2014)”; the retained unversioned entry showed “AC · Edition not recorded”.
3. Reload retained both records and their honest labels.
4. Opened the legacy entry: canonical-ID resolution opened the 2014 Administrative Reader with the exact subsection visible, without an error dialog.
5. Opened the explicit 2014 entry: correct source/subsection again; the independent 2022 Reader and original 2014 Reader remained unchanged.

[Rendered history and destination](UX_04_10_RECENT_HISTORY_EDITION_2026-09-28.png).

Validation passed: continuity merge, new actual-function history integrity (including cross-edition preview isolation and unknown-edition label), evidence-folder, Research source-edition integrity, web Reader source-navigation and offline suites, plus JavaScript syntax. Server alias/edition merge is covered by direct contract tests; this does not establish hosted or physical cross-device acceptance. No application latency claim is made.

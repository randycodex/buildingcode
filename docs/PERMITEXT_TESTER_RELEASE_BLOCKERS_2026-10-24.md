# Tester release blockers: bounded fixes

The production walkthrough found an ambiguous Calculator → Assistant draft, failed attempts presented as usable Report sources, and PDF overpaint clipping a citation. This change addresses those boundaries without changing Research generation or safeguards.

## Calculator handoff

The editable footnote draft now includes the user-entered room name and explicitly requests the calculation with the entered area as-is, without applying an additional optional fixture/amenity deduction. It still requires genuinely missing mandatory applicability facts, preserves later corrections, distinguishes custom factors, excludes unsupplied Project facts and does not infer indoor/roof/terrace location from a table row. Review remains explicit; the handoff prepares a question without automatically sending it.

## Failed-attempt presentation and Report eligibility

The compact answer projections in both file and PostgreSQL storage had dropped mode, model and verification status. The Report client summary also dropped the existing isRecovery flag. Those projections now preserve the small status fields needed to identify a failed attempt without loading private review details or changing the immutable answer.

Unsuccessful attempts show available source references and “No answer completed,” rather than “sources used” or “Cited in this answer.” Counts update from the exact saved record when it loads. Completed-answer source grouping remains intact.

The Report picker excludes recovery attempts. Server-side preview, draft validation and export manifest resolution reject them too, protecting against stale clients. Existing issued Report manifests and original failed attempts are not rewritten.

## PDF citation clipping

A one-point white rounded shape painted before the following source obscured the lower part of the preceding citation. That unnecessary shape has been removed. Evidence-list headings also reserve room for their first citation.

The PDF regression check inspects graphics and text together: ordinary text extraction can report a citation even when later graphics erase some pixels. It detects an opaque overlap in the original production PDF and zero overlaps in the corrected fixture, while retaining all 27 citations across pages. Existing Report versions remain intact; users create a new fixed version to receive the layout fix.

## Validation

- Full production build passed.
- 68 focused test files passed, zero failed/skipped/cancelled.
- HTTP tests exercise real Report list, preview, save, PDF generation and immutable history, with provider/network calls disallowed outside the local fixture.
- Source-panel tests cover unsuccessful initial/exact records and successful answer grouping.
- Footnote tests preserve citation/source binding, current facts, corrections, custom-factor limits, unsent drafts and zero automatic sends.
- Two stale UI-copy expectations in existing test harnesses were aligned with the already-shipped passage prerequisite and conversation chooser; no corresponding runtime behavior changed.
- All 94 protected Research modules have identical before/after SHA-256 hashes. The app.mjs changes concern compact answer metadata and Report eligibility only.
- Client version: `20261024-release-blockers-v1360`; Calculator module v27; shell generation `permitext-pro-shell-v1935`.

Live deployment, first-use account results, screenshots and final issued-PDF checks are recorded in the task's external evidence directory. Local tests are not represented as proof of production account signup or model success.

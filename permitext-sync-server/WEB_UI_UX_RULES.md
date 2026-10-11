# Permitext Web UI/UX Rules

These rules apply to the web version only. The iOS app can keep its current mobile patterns.

## Core Direction

The web app is a working desk, not a phone screen stretched wider. It should feel like multiple code readers can sit side by side, with search, saved work, AI-assisted research, and settings available as workspace tools.

## Layout

- Use a fixed top menu with a thin divider below it.
- Everything below the divider should fill the available height from top to bottom.
- Reader, Search, Evidence, Research, and Notebook columns should use square outer edges.
- Do not use card-like rounded corners for the main panes.
- Use vertical dividers between panes.
- Dividers should be draggable when pane resizing is implemented.
- On desktop, horizontal scrolling is a consequence of a wide multi-column desk, not the primary navigation model. On narrow screens, use one scroll-snapped full-width pane at a time.
- Adding a reader should split the workspace proportionally.
- Each reader should remain independently scrollable.
- Web tables do not scroll horizontally inside themselves. Keep readable cell widths, clip excess at the column edge, and reveal more by expanding or resizing the column. This also applies to Evidence detail, Assistant, and Report previews.
- Columns are independent tools within the Research or Notebook view. Opening Evidence, Notebook, or Report must not force the others open.
- Web layout changes must avoid full-screen blink/flicker: do not clear the whole workspace before rebuilding it; preserve existing panes or swap the next pane sequence in one operation.

## Top Menu and Working Views

- Keep the top menu compact, with text actions rather than large pill bubbles.
- Primary working views are `Research`, `Notebook`, and `Report`.
- Keep toolbar actions in workflow order: Research uses `Reader`, `Search`, `Assistant`; Notebook uses `Reader`, `Notes`, `Evidence`; Report uses `Reader`, `Sources and version`, `Save draft`, `Export PDF version`. Use `Assistant` for the AI conversation column title too.
- Reader is available in Research, Notebook, Report, and Project details. Open new Readers beside the current work without switching views. Each view retains its own Reader columns, source selections, widths, and scroll positions. Report and Project details use reference columns to the right and regain their full width when those columns close.
- Research history's Project filter and Search's matching options share the Layout menu's surface, padding, corners, shadow, and option styling. Keep keyboard selection, Escape, and outside-click dismissal available.
- Keep Project selection, `Project details`, `Layout`, and `Account` available across working views, including Project details and Account. Open one working view at a time and keep inactive columns mounted.
- Center the Permitext brand and plan on the screen in the main navigation across all working views. Keep the navigation and current-view toolbar at 42px, with 12px uppercase button labels: light (300) when inactive and bold (700) when active. Do not add vertical dividers between buttons. The Account footer is also 42px, with its disclaimer centered on one line.
- Report's Sources & versions panel opens on the left. Let users expand or resize its width while keeping the document visible and retaining the chosen width when switching views.
- Resize reference Readers and the adjoining Report or Project details layout together on every drag frame, so the divider follows the pointer before release.
- Project details contains Context & records and Facts below the shared top menu, with the same 42px toolbar as Research, Notebook, Report, and Account. Do not duplicate Context and Facts in the Project menu.
- Retain mounted editors, drafts, selected sources, column order, and scroll positions when switching views or returning from Report/Project details.
- Open linked columns beside their origin. Preserve unrelated Readers, including Readers in another working view.
- Delayed navigation must not focus or scroll a destination after the user switches views or Projects.
- Without a Project, column actions show a short-lived message below the centered Create Project action; they do not open columns.

## Readers

- Each reader represents one selected code context.
- A user can add multiple readers.
- A reader should allow code section, chapter, and optional section selection.
- Chapter text should appear after a chapter is selected.
- Users should be able to scroll through the full chapter continuously.
- Selecting a section should jump within the chapter, not be required before text appears.
- Reader controls should be compact and placed at the top of the reader.
- Do not show repeated large reader titles inside the pane.
- Do not show selector labels when the fields are self-explanatory.

## Search

- Search should behave like the iOS app.
- When a behavior already exists in the iOS app, use it as the default reference for web Search/Saved/Projects behavior unless there is a clear desktop-specific reason not to.
- With no query, keep the iOS menu order: `Jump Back In`, `Pinned`, then `Recent Searches`.
- Keep the Search field directly below the column title. When a query is active, place the result summary and code-book filters beneath the field, before the results.
- Preserve the iOS history actions: pin or unpin searches, remove recent searches, reopen recently viewed sections, and toggle their saved state.
- Search-result detail columns are transient. A shared `/open/section/:id` link may open one once, but it must consume that route and must not persist or reopen the detail column after a browser refresh.
- Code-section filters should support every available code section, not only Building Code, and should be generated from the available code data where practical.
- Search results should show the count and offer explicit `Open in reader` and `New reader` destinations.
- Search text should be highlighted in results when practical.
- Search should not replace the user's existing reader layout unless explicitly opened as a tool.
- `Command-K` should expose workspace commands, `Command-F` should target the active Reader search, and `Command-1` through `Command-5` should move among visible panes.

## Evidence and Notebook

- Evidence is the active Project's saved collection, grouped by code book and chapter, with saved passages and comments.
- Keep Evidence detail beside its originating column, showing full source text, tables, and editable comments with Reader's design. It must not change an unrelated Reader's place.
- Add evidence and notes to Report from their own columns. Show the named destination and persistent inclusion status.
- Notebook supports Conclusion, Supporting evidence, Uncertainty, and Next action. Project details holds the records checklist.
- Distinguish whole-section and passage comments and retain their exact source identities.
- Research handoff links to the exact saved answer with its citations and original Project snapshot; it must not silently rewrite or reassign that answer.

## Report

- Keep the Report document and Reader columns at least 600px wide. Sources & versions reserves its selected width; hide the optional outline before squeezing the document. Overflow belongs to whole workspace columns, never individual tables. Keep the Report text centered at a maximum 850px reading width.
- Report is a working view below the shared top menu, with an outline, editor, and optional source/version panel. Research, Notebook, Project selection, Layout, and Account stay accessible. Switching views preserves column positions and drafts; reopening Report retains its editor and scroll position.
- Use clear section hierarchy and compact text/icon actions, without pills for headings and metadata.
- Allow review of full passages, tables, notes, and facts before export. Snippets are never the export source.
- Let users choose which section and passage comments to include.
- Deduplicate overlapping whole sections and saved paragraphs within their exact edition, retaining selected comments and all conditions/exceptions.
- Save draft and export version are distinct: export creates an immutable snapshot. Preview the actual PDF bytes returned by Download PDF.
- Render tables as tables, consolidate repeated fact provenance without losing qualifications, and keep comment headings subordinate to code headings.
- Loading/errors/retry use the Report screen's stable layout and preserve drafts and other columns.

## Research

- Research is a product-hosted, signed-in, AI-assisted workflow over explicitly selected official sections.
- Always label generated output as AI-assisted research, not an official interpretation.
- Keep citations, assumptions, missing facts, and the authority disclaimer visible with the response.
- Exclude private notes and general web content from the evidence set.
- Never alter or present generated language as canonical enacted text.

## Visual Style

- Use the chrome and reader typography variables as the baseline; do not force a single size onto every element.
- Do not use gradients.
- Avoid oversized rounded UI.
- Keep contrast clear in light and dark themes.
- Keep every scrollbar visually hidden. Column and workspace scrolling must continue to work without visible rails or thumbs; tables themselves are not scroll containers.
- Main panes should feel like workspace columns, not floating cards.
- Internal controls can stay lightly rounded only when it helps usability.
- Match the iOS radius set for shared surfaces: cards use a 14 px radius and compact tiles use a 10 px radius unless a desktop-specific control needs a different value.
- Use surface color, spacing, and hierarchy for annotation cards. The Notebook editor has only thin neutral top and bottom lines spanning the full column width, without changing its background.
- Use spacing consistently; prefer tight, deliberate spacing over large mobile-style gaps.
- Search and Saved must remain proportional at the standard 320 px utility-column width: compact header actions, readable rows, and bottom controls that do not crowd the content.
- Every web confirmation, destructive warning, error alert, and acknowledgement should use the shared Clear-canvas dialog pattern: dimmed backdrop, centered white surface, divided title, concise message, outlined cancel action when applicable, and red confirmation action. Do not use native browser `alert()` or `confirm()` dialogs.

## Mobile

- Mobile should use one full-width pane at a time with a bottom, horizontally scrollable tool strip.
- Hide desktop-only resize and layout controls at narrow widths.
- Preserve the active pane and use horizontal scroll snapping to move between open tools.

## Acceptance Checks

- The workspace fills the viewport below the top divider.
- Main panes have square outer edges.
- There are no gradients.
- Reader and chrome typography can scale independently without a global `!important` lock.
- Chapter text appears after choosing a chapter.
- Section selection jumps within chapter text instead of controlling whether text exists.
- Search, Saved (including its Projects summary), Research, and Settings are accessible without disrupting existing readers.
- Canonical inline section references remain text-identical while becoming keyboard- and pointer-accessible.
- Research and private notes carry visible authority labels.
- Opening, closing, adding, removing, reordering, or resizing panes should not flash the workspace empty.

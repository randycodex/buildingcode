# Permitext Web UI/UX Rules

These rules apply to the web version only. The iOS app can keep its current mobile patterns.

## Core Direction

The web app is a working desk, not a phone screen stretched wider. It should feel like multiple code readers can sit side by side, with search, saved work, AI-assisted research, and settings available as workspace tools.

## Layout

- Use a fixed top menu with a thin divider below it.
- Everything below the divider should fill the available height from top to bottom.
- Reader, search, saved, analysis, and settings panes should use square outer edges.
- Do not use card-like rounded corners for the main panes.
- Use vertical dividers between panes.
- Dividers should be draggable when pane resizing is implemented.
- On desktop, horizontal scrolling is a consequence of a wide multi-column desk, not the primary navigation model. On narrow screens, use one scroll-snapped full-width pane at a time.
- Adding a reader should split the workspace proportionally.
- Each reader should remain independently scrollable.
- Search, saved, analysis, and settings should open as workspace tools, not permanent default reader panes.
- Web layout changes must avoid full-screen blink/flicker: do not clear the whole workspace before rebuilding it; preserve existing panes or swap the next pane sequence in one operation.

## Top Menu

- Keep the top menu compact.
- Show `permitext` as the brand.
- Do not show `New York City` in the top menu.
- Top menu actions should be text/buttons, not large pill bubbles.
- Keep these actions available and grouped by intent: `Reader`, `Search`, `Saved`, `Projects`, `Research`, and `Settings`.
- Search, saved, and settings should stay visually secondary to reader work.

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
- Code-section filters should support every available code section, not only Building Code, and should be generated from the available code data where practical.
- Search results should show the count and offer explicit `Open in reader` and `New reader` destinations.
- Search text should be highlighted in results when practical.
- Search should not replace the user's existing reader layout unless explicitly opened as a tool.
- `Command-K` should expose workspace commands, `Command-F` should target the active Reader search, and `Command-1` through `Command-5` should move among visible panes.

## Saved Work

- Saved sections, projects, tags, and notes should behave consistently with the iOS app.
- Saved should be available from the top menu.
- Present Saved and Projects as adjacent parts of `Your workspace`: Saved is the inbox for bookmarks, notes, and tags; Projects organize job-specific work and Workboards. Keep their data models distinct.
- Project and saved-section interactions should not require learning a separate web-only workflow unless the web layout makes it clearly better.

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
- Keep native thin scrollbars on independently scrollable reading and utility regions; never hide every scrollbar globally.
- Main panes should feel like workspace columns, not floating cards.
- Internal controls can stay lightly rounded only when it helps usability.
- Match the iOS radius set for shared surfaces: cards use a 14 px radius and compact tiles use a 10 px radius unless a desktop-specific control needs a different value.
- Notes, comments, and other annotation cards should not use thin border outlines; rely on surface color, spacing, and hierarchy instead.
- Use spacing consistently; prefer tight, deliberate spacing over large mobile-style gaps.

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
- Search, Saved, Projects, Research, and Settings are accessible without disrupting existing readers.
- Canonical inline section references remain text-identical while becoming keyboard- and pointer-accessible.
- Research and private notes carry visible authority labels.
- Opening, closing, adding, removing, reordering, or resizing panes should not flash the workspace empty.

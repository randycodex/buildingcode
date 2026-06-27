# Permitext Web UI/UX Rules

These rules apply to the web version only. The iOS app can keep its current mobile patterns.

## Core Direction

The web app is a working desk, not a phone screen stretched wider. It should feel like multiple code readers can sit side by side, with search, saved work, analysis, and settings available as workspace tools.

## Layout

- Use a fixed top menu with a thin divider below it.
- Everything below the divider should fill the available height from top to bottom.
- Reader, search, saved, analysis, and settings panes should use square outer edges.
- Do not use card-like rounded corners for the main panes.
- Use vertical dividers between panes.
- Dividers should be draggable when pane resizing is implemented.
- Do not use horizontal scrolling as the primary navigation model.
- Adding a reader should split the workspace proportionally.
- Each reader should remain independently scrollable.
- Search, saved, analysis, and settings should open as workspace tools, not permanent default reader panes.
- Web layout changes must avoid full-screen blink/flicker: do not clear the whole workspace before rebuilding it; preserve existing panes or swap the next pane sequence in one operation.

## Top Menu

- Keep the top menu compact.
- Show `permitext` as the brand.
- Do not show `New York City` in the top menu.
- Top menu actions should be text/buttons, not large pill bubbles.
- Keep these actions available: `+ Reader`, `Search`, `Saved`, `Analysis`, and `Settings`.
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
- Search results should open or update a reader context.
- Search text should be highlighted in results when practical.
- Search should not replace the user's existing reader layout unless explicitly opened as a tool.

## Saved Work

- Saved sections, projects, tags, and notes should behave consistently with the iOS app.
- Saved should be available from the top menu.
- Project and saved-section interactions should not require learning a separate web-only workflow unless the web layout makes it clearly better.

## Analysis

- Analysis is a placeholder pane for now.
- The planned model is bring-your-own AI account or provider key.
- The app owner should not silently pay for user AI usage.
- Analysis should be aware of the active reader or selected text when implemented.
- No AI calls should run until the user explicitly connects/configures an AI provider.

## Visual Style

- Use 12 pt text as the baseline.
- Do not use gradients.
- Avoid oversized rounded UI.
- Keep contrast clear in light and dark themes.
- Main panes should feel like workspace columns, not floating cards.
- Internal controls can stay lightly rounded only when it helps usability.
- Match the iOS radius set for shared surfaces: cards use a 14 px radius and compact tiles use a 10 px radius unless a desktop-specific control needs a different value.
- Notes, comments, and other annotation cards should not use thin border outlines; rely on surface color, spacing, and hierarchy instead.
- Use spacing consistently; prefer tight, deliberate spacing over large mobile-style gaps.

## Mobile

- Mobile can keep the existing iOS-inspired behavior.
- These web rules should not force mobile to use cramped split panes.
- When responsive behavior is needed, prioritize a usable stacked mobile layout over preserving the desktop split.

## Acceptance Checks

- The workspace fills the viewport below the top divider.
- Main panes have square outer edges.
- There are no gradients.
- Text defaults to 12 pt.
- Chapter text appears after choosing a chapter.
- Section selection jumps within chapter text instead of controlling whether text exists.
- Search, saved, analysis, and settings are accessible without disrupting existing readers.
- Opening, closing, adding, removing, reordering, or resizing panes should not flash the workspace empty.

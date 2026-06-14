# Permitext Web Next Steps

Reference list for the current web workspace direction.

## Priority Order

1. Column behavior
   - Done: Smooth and predictable resizing with many panels open is supported by persisted pane widths, role-based defaults, and resize limits.
   - Done: Better minimum widths per panel type are defined for readers, utilities, settings/analysis, and detail side screens.
   - Done: Utility panels stay smaller by default than reader panels.
   - Done: Double-clicking a divider resets the two adjacent panes to their default widths.

2. Panel visibility
   - Search, Saved, Analysis, Settings, and Projects should open in useful positions.
   - Utility panels should remain accessible even with multiple readers open.
   - Adding readers should not collapse utility panels into unusable widths.

3. Settings cleanup
   - Hide developer-only sync controls until real sign-in exists.
   - Keep Reader Preview useful and simple.
   - Preserve line-only section separators.

4. Reader search polish
   - Show result counts.
   - Keep the last query.
   - Add keyboard navigation later.
   - Jump to selected results smoothly.

5. Projects, Saved, and Search sync readiness
   - Treat Projects as the future shared workspace list between web and iOS.
   - Treat Saved sections as shared user content between web and iOS.
   - Treat Search as local UI state now, with future handoff to shared reading context.
   - Keep data contracts compatible with a future backend and iOS app sync.

6. Saved/bookmark behavior
   - Saved icons should always reflect current state.
   - Saved panel should list saved items clearly.
   - Clicking a saved item should open or jump to the section.
   - Prepare the saved model for iOS sync.

7. Comments
   - Persist typed comments per subsection.
   - Filled comment icon should persist.
   - Saved comments should become discoverable in a useful list.
   - Prepare comments for iOS sync.

8. Performance and code cleanup
   - Remove stale UI experiments.
   - Clean duplicated CSS/select styles.
   - Centralize panel sizing constants.
   - Add focused browser smoke checks for resizing, picker menus, search, saved items, and bookmarks.

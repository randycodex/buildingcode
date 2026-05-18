# Codex Workflow

## Branches

- Keep `main` as the stable branch.
- Start each task on its own branch.
- Use the naming pattern `codex/<task-name>`.

Current working branch:

- `codex/editor-ui-perf-audit`

Recommended workflow:

1. Start a new Codex thread for one clear task.
2. Create a matching branch.
3. Do the work only on that branch.
4. Test it.
5. Commit it.
6. Merge it back into `main` when it is stable.

Example branch names:

- `codex/editor-performance`
- `codex/editor-ui-cleanup`
- `codex/ios-reader-layout`
- `codex/release-packaging`

## Thread Structure

Use one thread per goal.

Recommended thread list:

1. `Editor Performance`
   Use for lag, typing slowness, crashes, save issues, undo/redo, and responsiveness.
2. `Editor UI`
   Use for toolbar layout, spacing, typography, panel cleanup, and visual polish.
3. `Editor Authoring Flow`
   Use for code versions, code sections, chapters, chapter sections, titles, text blocks, and editor behavior.
4. `Editor Formatting`
   Use for bold, italic, title targeting, search actions, tables, images, and formatting commands.
5. `iOS App Reader`
   Use for anything that should appear in the iOS app, including hierarchy, indentation, and reading layout.
6. `Packaging And Install`
   Use for app bundling, reinstalling, icons, launch behavior, and standalone app setup.
7. `Git And Backup`
   Use for GitHub, commits, pushes, backups, repo setup, and recovery strategy.

## When To Start A New Thread

Start a new thread when:

- the goal changes
- the current thread gets very long
- you switch from bug fixing to UI work
- you switch from editor work to iOS work
- you want a clean context for a risky change

## Rule Of Thumb

- New task: new thread
- New task: new branch
- Stable code: merge to `main`

# Permitext minimal workflow plan

Date: October 12, 2026

Status: Web implementation complete and locally verified on the isolated review branch. iOS work is paused at the user’s request; final native acceptance remains pending. Nothing has been merged or deployed.

## Purpose

Make Permitext easier to use while preserving the complete professional workflow:

**Find → Read → Save → Ask → Develop notes → Resolve uncertainties → Assemble a report → Export a fixed version.**

Users must remain free to enter or leave this workflow at any point: read without a project, save without using AI, write a note directly, or add a source to a report without creating an intermediate note.

The goal is fewer decisions between finding a provision and producing useful work.

## Basis and limits

- The recommendation follows a review of the live web app's Research, Notebook, Report, Project Details, and layout controls on October 12, 2026.
- The live interface was ahead of the local checkout inspected during that review. Verify the current implementation before starting any step; do not treat older local source or earlier plans as the current product.
- This is product judgment, not a finding from usage analytics or a comprehensive usability study.
- The iPhone direction is conceptual. The installed iPhone app was not inspected in this review.
- This document records proposals, not completed work. Existing capabilities may already satisfy parts of a step.
- The user subsequently authorized implementing the full plan on a new branch. Publishing, merging, and deleting existing user records are not authorized.
- Preserve the Research, Notebook, and Report submenus. Improve their defaults; do not remove their navigation.

## Main recommendations

### Remove column Groups from the ordinary workflow

Groups is the first candidate for removal because it adds another organizational object alongside projects, evidence, notes, conversations, reports, and columns. Let each project remember its working arrangement automatically.

Retain side-by-side Readers, resizing, rearranging, restoration, and a secondary Reset layout action. Remove Layout from the main toolbar and place occasional layout controls in a secondary menu.

Before removing Groups, inspect actual usage and existing saved groups. If frequent users depend on it, keep it as an advanced option. Preserve existing records and a recovery path; this proposal does not authorize deleting saved configurations.

### Add Open questions inside Notebook

Give existing notes a lightweight way to record what remains unresolved. Do not add another main tab or a separate task-management system.

An open question should support:

- A concise question or assumption that needs verification.
- An explanation of why it matters.
- Links to its note, evidence, and research conversation where available.
- An explicit user-controlled resolution with a supporting source or explanation.
- A compact Notebook filter or count, such as “3 open questions.”
- Visibility of unresolved items associated with material selected for a report.

Example: “Confirm the building's sprinkler protection,” linked to the note and passages whose interpretation depends on that condition.

The Assistant may suggest questions. The user controls recording and resolution. “Resolved” describes the user's research state; it must not imply certified compliance. Historical research answers and exported report versions remain unchanged.

## Product structure

| View | Responsibility | Default presentation |
| --- | --- | --- |
| Research | Find and understand source material | Search or the last Reader; Assistant opens when needed |
| Notebook | Develop and retain reasoning | Notes, with saved evidence available beside them |
| Report | Assemble and communicate selected work | The document, with sources and version tools available when needed |

Implementation branch: `codex/minimal-workflow-changes`.

Return point: `codex/baseline-before-minimal-workflow-20261012` at `0457828b6b4cba534ce5d5c80ae50c4e9e42c519` (fetched remote main before implementation). The original dirty checkout remains untouched.

Projects provide context across these views. Project Details holds the address, conditions, facts, and records.

## Step-by-step implementation checklist

All steps are authorized. Implement and verify each increment separately; mark completion only after its acceptance criteria are proven.

### Step 1 — Make Notebook immediately useful

- [x] Verify current Notebook opening and restoration behavior.
- [x] Make Notes the default focus for a new or unconfigured Notebook view.
- [x] Keep saved evidence available beside Notes when useful.
- [x] Preserve intentional existing arrangements and unsaved work.

Acceptance: A user opening Notebook can immediately understand where to write and how to use saved evidence. Reopening work preserves the selected note and its contents.

Review observation: Notebook opened to Evidence while Notes was closed. Treat this as an observed session state, not proof that every user's default behaves that way.

### Step 2 — Clarify the source-to-note-to-report handoffs

- [x] Inventory the existing Save, Ask/Research, Add to Notebook, and Add to Report actions before changing them.
- [x] Give each transition a clear contextual action.
- [x] Carry source identity, edition, citations, and project context through the handoff.
- [x] Show when an item is already included and prevent accidental duplication.
- [x] Retain direct paths, including adding a source to a report without creating a note.

Acceptance: A user can carry useful material from a passage or answer into a note and then a report without copying text manually or losing source relationships.

### Step 3 — Open supporting material beside the current task

- [x] Open a search result in an appropriate Reader while preserving the search state.
- [x] Open the Assistant with the selected passage visibly attached when the user asks about it.
- [x] Open a citation beside the answer or note being checked.
- [x] Reuse suitable existing panels and conversations instead of multiplying them unnecessarily.
- [x] Preserve drafts, selections, reading position, and explicit additional-Reader actions.

Acceptance: The user chooses the material to examine; the app supplies a useful arrangement without requiring layout management or losing the original task.

### Step 4 — Reduce layout-management overhead

- [x] Inspect Groups usage, saved configurations, and restoration dependencies.
- [x] Decide whether Groups can leave the ordinary workflow or should remain as an advanced option.
- [x] Make project/view arrangement restoration reliable before reducing controls.
- [x] Move Layout out of the main toolbar.
- [x] Retain resizing, rearranging, side-by-side Readers, and a discoverable Reset layout action.
- [x] Preserve existing saved configuration data and recovery paths.

Acceptance: The full research workflow works without creating or managing a Group. Experienced users retain the essential comparison and arrangement capabilities.

### Step 5 — Add Open questions to existing notes

- [x] Inspect existing note, research, and report relationships for reuse.
- [x] Define the smallest useful question and resolution representation.
- [x] Allow users to record, link, review, and resolve questions.
- [x] Add a compact Notebook count/filter without a new main destination.
- [x] Surface relevant unresolved questions when assembling a report.
- [x] Keep Assistant suggestions explicit and user-controlled.

Acceptance: A user can resume a project and identify what still needs verification, why it matters, and which note or report material it affects. Resolving an item does not imply regulatory approval.

### Step 6 — Preserve the distinction between Notebook and Report without repeated writing

- [x] Inspect existing note-to-report links and update behavior before adding anything.
- [x] Keep working reasoning, alternatives, and open questions in Notebook.
- [x] Keep Report focused on material selected for its intended audience.
- [x] Preserve links between included notes and their report sections.
- [x] Offer a clear update action when linked material changes.
- [x] Preserve fixed exported versions and intentional report-specific editing.

Acceptance: A user can improve a note and deliberately update the associated report material without rewriting it, silently overwriting editorial changes, or altering an earlier export.

### Step 7 — Make Project Details useful before it is complete

- [x] Show recorded facts and facts relevant to the current work first.
- [x] Keep an All facts route for comprehensive review and editing.
- [x] Allow work to begin with minimal project information and develop progressively.
- [x] Preserve distinctions between imported facts, assumptions, and confirmed information.
- [x] Preserve sources and material uncertainty when changing presentation.

Acceptance: Users can start work without confronting every empty field, while all facts remain accessible and relevant missing information remains visible.

### Step 8 — Reveal report tools when useful

- [x] Avoid opening a full outline column by default for an almost-empty report.
- [x] Keep the outline discoverable and useful as the document grows.
- [x] Show version comparison when saved versions exist.
- [x] Keep sources and export readily available.
- [x] Respect intentional panel preferences and restore existing work.

Acceptance: A new report prioritizes its content; a developed report still supports navigation, source inspection, version comparison, and export.

### Step 9 — Simplify repeated controls and visual presentation

- [x] Remove unnecessary repeated controls and decorative containers.
- [x] Put occasional actions in contextual menus while keeping frequent actions visible.
- [x] Keep clear labels, readable typography, consistent spacing, and recognizable interaction states.
- [x] Preserve visible save state, citation identity, edition, and material uncertainty.
- [x] Verify keyboard access and discoverability after moving controls.

Acceptance: The interface is quieter without making essential actions harder to find or obscuring the information needed to evaluate a source or conclusion.

### Step 10 — Adapt the workflow to iPhone

- [ ] Inspect the current installed/native implementation before defining changes.
- [ ] Preserve the same responsibilities and source relationships across devices.
- [ ] Use focused screens with Back navigation instead of copying desktop columns.
- [ ] Preserve reading position, drafts, project context, and note/report continuity.
- [ ] Verify the relevant flows on the rendered native app.

Acceptance: The core workflow remains understandable and connected on iPhone. Report native build results and physical-device interaction evidence separately.

### Step 11 — Continuous Notes editor (user addition, October 12)

The user supplied a reference showing a large uninterrupted writing area with a compact formatting toolbar, and explicitly rejected the floating block “+” and drag handle as the way to add headings.

For iPhone, follow the user's Apple Notes reference: one open writing page, Back and Done at the top, and a small toolbar above the keyboard. Put text styles and headings under Aa, with quick list and insertion controls. Keep save state and open questions accessible without crowding the page.

- [ ] Use one continuous editable Notes surface on iPhone; Return, selection, cursor movement, and Back must preserve natural writing flow.
- [ ] Keep basic formatting in a compact toolbar: bold, italic, strikethrough, Body/Heading, bullets, numbering, links, and Insert.
- [ ] Remove floating “+” and drag handles from the writing surface on web and iPhone.
- [ ] Retain rich document structure, headings, nested lists, images, evidence/research links, and undo/redo; do not flatten saved notes.
- [ ] Preserve offline drafts, autosave, conflict review, last-keystroke durability, and source-return editing position.
- [ ] Verify the rendered web editor and physical iPhone interaction using the supplied visual direction.

Acceptance: A note feels like a single document with basic tools, while existing content and the complete source-to-note-to-report workflow remain intact. The shared storage format remains compatible; a continuous visual editor does not require replacing the notes backend.

## Rules for working through a step

1. Confirm the selected step and inspect the current implementation and applicable repository guidance.
2. Identify which behavior already exists and the smallest remaining change.
3. Preserve unrelated local changes, user records, drafts, source identity, and restoration paths.
4. Implement the full authorized plan in reviewable increments, preserving the submenus and the complete workflow.
5. Verify the relevant rendered interaction and appropriate regression checks.
6. Record the outcome below, including limitations and remaining work, before marking a step complete.
7. Distinguish local implementation, hosted verification, native build, and device acceptance. Follow the user's release instructions separately.

## Progress log

| Date | Step | Outcome | Verification / remaining work |
| --- | --- | --- | --- |
| 2026-10-12 | Planning | Plan saved; all implementation steps pending | No app changes authorized or performed as part of saving this plan |
| 2026-10-12 | Authorization and isolation | Full plan authorized, then continuous Notes added from the user’s desktop and Apple Notes references | Work isolated on `codex/minimal-workflow-changes`; original checkout and rollback branch retained |
| 2026-10-12 | 1–4 | First Notebook visit opens Notes; existing arrangements retained. Contextual handoffs and beside-source opening preserved. Layout moved to View options; existing Groups remain an advanced option | Workflow/navigation/layout regression suites pass. Local browser verified Notebook opening and public Reader without a Project. No usage analytics were available; no saved group data removed |
| 2026-10-12 | 5 | Open questions persist with notes, support explanation/resolution, count/filter and Report visibility | HTTP round-trip, receipt replay, invalid-draft correction, legacy compatibility and conflict tests pass. Browser create/resolve and physical iPhone resolution/Back checks pass |
| 2026-10-12 | 6 | Live linked notes and explicit editable snapshots retain provenance; changed notes can be reviewed before replacing report-specific wording | Browser verified snapshot editing, cancel, explicit replacement, then fixed PDF export. Report/export/duplicate-handoff tests pass; exported versions remain fixed |
| 2026-10-12 | 7 | Recorded/core facts first, complete All facts route, sourced/assumed/confirmed/unknown distinctions retained | Browser verified both fact modes; retained editor, draft, access, source and fact-grouping regressions pass |
| 2026-10-12 | 8 | Small reports start without Outline; explicit preference persists per account/Project. Versions appears when history exists | Browser verified new Report defaults, sources, export and version preview; preference, live history refresh and deletion tests pass |
| 2026-10-12 | 9 | Repeated layout controls removed. Notes formatting uses a single toolbar and standard 42px bottom action row | Browser verified exact 42px toolbar/footer, narrow columns, bold, heading, list and link insertion. Questions expand above the footer |
| 2026-10-12 | 10–11 native paused | Continuous native rich document, native Aa/list/image/link tools, pushed source navigation and final-keystroke preservation | Simulator build and three physical iPhone tests pass (heading/Return, linked-note exact caret, questions). Final keyboard-return layout and stale-refresh safeguards remain pending native acceptance; iOS work is paused at the user’s request |



## Web completion checkpoint

The user clarified that only iOS work should pause. The web portion of steps 1–9 and the web requirements of step 11 are complete locally on `codex/minimal-workflow-changes`.

- [x] Continuous web note with persistent basic formatting, heading levels, lists, links and Insert; floating block controls removed.
- [x] Desktop verification at **1920 × 1080**: toolbar and bottom action row each measure **42px**, footer ends at viewport bottom, and document width is 1920px without horizontal overflow in the tested two-column arrangement.
- [x] Heading hierarchy renders at 25.2px / 20.3px / 16.8px above 14px body text. Removed the inherited blanket font-size lock from editable document content.
- [x] Create, save, reload, question editing/removal and note-to-Report inclusion verified with isolated synthetic records. Incomplete questions can be discarded without blocking note synchronization.
- [x] Cold editor loading and first-save server ID assignment retain the current editor, question ownership and Report membership.
- [x] Local web build, dependency-security check, workflow/navigation/layout tests, editor formatting/structure contracts, question HTTP round-trip, offline/save durability, source-to-Report promotion, report save/history/outline/export and Project details tests pass. `git diff --check` passes.

Rendered proof: `/Users/randy/.codex/visualizations/2026/10/12/01a131d7-c022-7202-9df6-1408c1f097e0/notes-1920x1080.jpg`.

The review used only loopback synthetic data and no paid Research requests. Local verification does not establish hosted deployment acceptance.

### Remaining iOS work — paused

Existing native changes remain in this worktree, separate from the completed web commit. Do not restart phone/simulator work until the user resumes it. Final keyboard-return layout, large text, stale-refresh protection and integrated device acceptance remain to be reviewed. Reuse the existing simulator/runtime and shared DerivedData; inspect exact storage ownership before removing unneeded artifacts. Do not create duplicate runtimes or device clones.

## Supporting principle

Expose frequently needed actions clearly and reveal secondary controls when useful. Progressive disclosure should reduce initial complexity without hiding essential work.

Reference: [Nielsen Norman Group — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).

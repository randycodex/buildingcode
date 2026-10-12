# Permitext minimal workflow plan

Date: October 12, 2026

Status: Proposal saved for step-by-step review. No app implementation authorized.

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
- This plan does not authorize app edits, migrations, feature removal, deployment, or changes to existing user records.

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

Projects provide context across these views. Project Details holds the address, conditions, facts, and records.

## Step-by-step implementation checklist

All steps are pending. Start implementation only after the user requests it, and limit each increment to the selected step.

### Step 1 — Make Notebook immediately useful

- [ ] Verify current Notebook opening and restoration behavior.
- [ ] Make Notes the default focus for a new or unconfigured Notebook view.
- [ ] Keep saved evidence available beside Notes when useful.
- [ ] Preserve intentional existing arrangements and unsaved work.

Acceptance: A user opening Notebook can immediately understand where to write and how to use saved evidence. Reopening work preserves the selected note and its contents.

Review observation: Notebook opened to Evidence while Notes was closed. Treat this as an observed session state, not proof that every user's default behaves that way.

### Step 2 — Clarify the source-to-note-to-report handoffs

- [ ] Inventory the existing Save, Ask/Research, Add to Notebook, and Add to Report actions before changing them.
- [ ] Give each transition a clear contextual action.
- [ ] Carry source identity, edition, citations, and project context through the handoff.
- [ ] Show when an item is already included and prevent accidental duplication.
- [ ] Retain direct paths, including adding a source to a report without creating a note.

Acceptance: A user can carry useful material from a passage or answer into a note and then a report without copying text manually or losing source relationships.

### Step 3 — Open supporting material beside the current task

- [ ] Open a search result in an appropriate Reader while preserving the search state.
- [ ] Open the Assistant with the selected passage visibly attached when the user asks about it.
- [ ] Open a citation beside the answer or note being checked.
- [ ] Reuse suitable existing panels and conversations instead of multiplying them unnecessarily.
- [ ] Preserve drafts, selections, reading position, and explicit additional-Reader actions.

Acceptance: The user chooses the material to examine; the app supplies a useful arrangement without requiring layout management or losing the original task.

### Step 4 — Reduce layout-management overhead

- [ ] Inspect Groups usage, saved configurations, and restoration dependencies.
- [ ] Decide whether Groups can leave the ordinary workflow or should remain as an advanced option.
- [ ] Make project/view arrangement restoration reliable before reducing controls.
- [ ] Move Layout out of the main toolbar.
- [ ] Retain resizing, rearranging, side-by-side Readers, and a discoverable Reset layout action.
- [ ] Preserve existing saved configuration data and recovery paths.

Acceptance: The full research workflow works without creating or managing a Group. Experienced users retain the essential comparison and arrangement capabilities.

### Step 5 — Add Open questions to existing notes

- [ ] Inspect existing note, research, and report relationships for reuse.
- [ ] Define the smallest useful question and resolution representation.
- [ ] Allow users to record, link, review, and resolve questions.
- [ ] Add a compact Notebook count/filter without a new main destination.
- [ ] Surface relevant unresolved questions when assembling a report.
- [ ] Keep Assistant suggestions explicit and user-controlled.

Acceptance: A user can resume a project and identify what still needs verification, why it matters, and which note or report material it affects. Resolving an item does not imply regulatory approval.

### Step 6 — Preserve the distinction between Notebook and Report without repeated writing

- [ ] Inspect existing note-to-report links and update behavior before adding anything.
- [ ] Keep working reasoning, alternatives, and open questions in Notebook.
- [ ] Keep Report focused on material selected for its intended audience.
- [ ] Preserve links between included notes and their report sections.
- [ ] Offer a clear update action when linked material changes.
- [ ] Preserve fixed exported versions and intentional report-specific editing.

Acceptance: A user can improve a note and deliberately update the associated report material without rewriting it, silently overwriting editorial changes, or altering an earlier export.

### Step 7 — Make Project Details useful before it is complete

- [ ] Show recorded facts and facts relevant to the current work first.
- [ ] Keep an All facts route for comprehensive review and editing.
- [ ] Allow work to begin with minimal project information and develop progressively.
- [ ] Preserve distinctions between imported facts, assumptions, and confirmed information.
- [ ] Preserve sources and material uncertainty when changing presentation.

Acceptance: Users can start work without confronting every empty field, while all facts remain accessible and relevant missing information remains visible.

### Step 8 — Reveal report tools when useful

- [ ] Avoid opening a full outline column by default for an almost-empty report.
- [ ] Keep the outline discoverable and useful as the document grows.
- [ ] Show version comparison when saved versions exist.
- [ ] Keep sources and export readily available.
- [ ] Respect intentional panel preferences and restore existing work.

Acceptance: A new report prioritizes its content; a developed report still supports navigation, source inspection, version comparison, and export.

### Step 9 — Simplify repeated controls and visual presentation

- [ ] Remove unnecessary repeated controls and decorative containers.
- [ ] Put occasional actions in contextual menus while keeping frequent actions visible.
- [ ] Keep clear labels, readable typography, consistent spacing, and recognizable interaction states.
- [ ] Preserve visible save state, citation identity, edition, and material uncertainty.
- [ ] Verify keyboard access and discoverability after moving controls.

Acceptance: The interface is quieter without making essential actions harder to find or obscuring the information needed to evaluate a source or conclusion.

### Step 10 — Adapt the workflow to iPhone

- [ ] Inspect the current installed/native implementation before defining changes.
- [ ] Preserve the same responsibilities and source relationships across devices.
- [ ] Use focused screens with Back navigation instead of copying desktop columns.
- [ ] Preserve reading position, drafts, project context, and note/report continuity.
- [ ] Verify the relevant flows on the rendered native app.

Acceptance: The core workflow remains understandable and connected on iPhone. Report native build results and physical-device interaction evidence separately.

## Rules for working through a step

1. Confirm the selected step and inspect the current implementation and applicable repository guidance.
2. Identify which behavior already exists and the smallest remaining change.
3. Preserve unrelated local changes, user records, drafts, source identity, and restoration paths.
4. Implement only the requested increment; do not treat this checklist as blanket authorization for later steps.
5. Verify the relevant rendered interaction and appropriate regression checks.
6. Record the outcome below, including limitations and remaining work, before marking a step complete.
7. Distinguish local implementation, hosted verification, native build, and device acceptance. Follow the user's release instructions separately.

## Progress log

| Date | Step | Outcome | Verification / remaining work |
| --- | --- | --- | --- |
| 2026-10-12 | Planning | Plan saved; all implementation steps pending | No app changes authorized or performed as part of saving this plan |

## Supporting principle

Expose frequently needed actions clearly and reveal secondary controls when useful. Progressive disclosure should reduce initial complexity without hiding essential work.

Reference: [Nielsen Norman Group — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).

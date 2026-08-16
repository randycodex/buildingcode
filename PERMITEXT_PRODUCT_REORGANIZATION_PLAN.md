# Permitext Product Reorganization Plan

## Purpose

Reorganize Permitext around one clear professional workflow without rebuilding or discarding the systems already developed:

**Read → Save → Research → Analyze → Publish**

The interface should expose professional meaning while Permitext continues to maintain evidence versions, provenance, validation, history, review state, and report snapshots underneath.

## Target product model

> Reader and Search find enacted law.  
> Saved preserves it.  
> Project gives it context.  
> Research investigates it.  
> Notebook records the professional's analysis.  
> Report publishes the selected conclusion.

## Reorganization steps

### 1. Make Projects the context column

The existing Projects column becomes the persistent organizational anchor. It contains:

- Project selector
- Project Context
- Structured Facts
- Saved Evidence
- Research history
- Actions to open Notebook or Report

Projects should organize work, not become a separate workflow the user must enter.

### 2. Establish six consistent user-facing concepts

Use these names throughout the interface:

- Reader
- Search
- Saved
- Research
- Notebook
- Report

Use **Project** only for job context and organization.

Retire ordinary UI terms such as Folder, Code Question, Code Decision, Evidence Set, governed record, immutable answer, Report Draft, and Workboard. The underlying systems remain.

### 3. Make Reader the enacted-code workspace

Reader remains the authoritative reading surface. From a specific passage, the user can:

- Save it
- Add or open a note
- Change its Project when needed
- Link it to a Notebook note
- Start Research
- Open a cited cross-reference

Reader selections should be passage-specific. The Source Detail column can display the complete subsection while highlighting the specific saved passage when that distinction is useful.

### 4. Make saving immediate

Clicking the bookmark should save the exact passage immediately to Saved.

Project assignment becomes contextual:

- If a Project is active, suggest or inherit it.
- If no Project is active, save it as unassigned.
- Allow the destination to be changed afterward.
- Never require a Project simply to preserve evidence.

### 5. Treat Saved as an inbox

Saved collects unassigned or recently captured material: things the user preserved but has not necessarily organized or analyzed.

From Saved, users can:

- Open the exact passage in Reader
- Assign it to a Project
- Start Research
- Link it to a note
- Remove it

Once assigned, the item also appears under that Project's Saved Evidence.

### 6. Keep Search separate from Reader navigation

Search finds candidate provisions across the enacted library. Selecting a result opens or reuses a Reader at the exact provision without automatically opening additional unnecessary columns.

- Search finds provisions.
- Reader examines provisions.
- Source Detail temporarily inspects a provision in context.

### 7. Use Reader for every enacted-code source

Retire Source Detail from the ordinary workflow. Reader is the single authoritative surface for enacted-code text.

Open or reuse an adjacent Reader when the user selects:

- Saved evidence
- A Notebook reference
- A Research citation
- A Report citation
- A cross-reference

Reader shows the complete provision and highlights the exact passage when available. It retains passage actions for Save, Note, Research, and Project context. Opening a source should preserve the originating Saved, Research, Notebook, or Report column and should not automatically open Search.

### 8. Make Research one conversational system

Combine the existing Research History and Research Conversation into one capability with two complementary columns:

- **Research History:** previous questions and answers
- **Research Conversation:** the active conversation

A question can start from Reader, Search, Saved, a Project, or an empty composer.

The user sees:

- Question
- Answer
- Sources
- Facts used
- Assumptions and limitations
- History

Permitext continues to maintain evidence versions, model metadata, validation, provenance, and immutable revisions internally.

### 9. Make Research context automatic but editable

Research should automatically inherit:

- The active Project
- Relevant Project Facts
- Selected Reader passages
- A selected Notebook note, when applicable

The user can change any association before starting. No Project means unassigned Research, not blocked Research.

### 10. Separate cited sources from reviewed sources

Within Evidence Reviewed, use two clearly numbered lists:

- Cited in this answer
- Reviewed for context—not cited

This preserves Terra's broader investigation without implying that every reviewed provision supports the conclusion.

### 11. Give Notebook one unmistakable job

Notebook is the professional's authored analysis, not another Saved list and not an AI conversation.

A note may contain:

- User-authored analysis
- Linked evidence
- Why each piece of evidence matters
- Optional Research answers
- Assumptions or unresolved questions
- Report status

The expected workflow is to collect linked evidence and then write the analysis, but the editor must permit work in any order.

### 12. Make evidence roles optional advanced structure

Context, Supports, Conflicts, and Unresolved can organize complex notes, but they should not confront every user when linking a passage.

Default action:

> Link to Note

Optional detail:

> Relationship: Supports

### 13. Make Notebook-to-Report a live relationship

When a note has not been added:

> Add to Report

After it has been added:

> Update in Report

The report block remains linked to the originating note. Updating revises that block while retaining Report revision history instead of creating duplicate snapshots.

### 14. Make Report both an outcome and a persistent editor

Users encounter Report naturally through actions such as:

- Create Report
- Add to Report
- Update in Report
- Open Report

Permitext can automatically assemble the question, conclusion, facts, evidence, assumptions, and citations. The existing Report column remains available for arranging, editing, revising, and exporting the complete document.

Remove **Draft** from ordinary naming. Internally, the object may remain a `ReportDraft`.

### 15. Demote specialized systems

Keep these systems, but remove them from the primary hierarchy:

- Workboard
- Code Question workflow
- Code Decision records
- Evidence Set management
- Review and issuance mechanics
- Immutable snapshots
- Model/version metadata
- Audit records

Expose them only when relevant through advanced details, status messages, review controls, or Report history.

### 16. Simplify the top bar

The primary desktop controls should be:

- Projects
- Reader
- Search
- Saved
- Research
- Reset workspace
- Close all
- Settings

Notebook and Report should normally open from the active Project or associated work rather than compete as permanent global navigation icons.

### 17. Preserve and standardize the desktop column model

The column model is a Permitext advantage and should be standardized rather than removed:

- Projects stays anchored.
- Settings is the only column allowed left of Projects.
- New working columns open to the right.
- Contextual Source Detail does not open Search.
- Selecting a new Project does not close Research.
- Every column uses the same header height, close behavior, drag behavior, scrolling, and contextual coloring.

### 18. Give mobile a smaller hierarchy

Mobile should expose:

- Projects
- Reader
- Search
- Saved
- More

More contains Research, Notebook, Report, Settings, and secondary actions. Mobile should support reviewing work and basic capture without reproducing an overcrowded desktop workspace.

### 19. Introduce the reorganization without migrating data

Most of this work concerns navigation, naming, and orchestration. Existing records remain:

- Saved evidence remains saved.
- Research history remains intact.
- Notebook notes remain intact.
- Reports remain intact.
- Project associations remain intact.
- Governance and version records remain intact.

The reorganization changes how users reach and understand these systems, not their underlying ownership.

### 20. Implement in four controlled phases

#### Phase 1 — Vocabulary and navigation

- Rename visible concepts.
- Simplify the top bar.
- Standardize column names and responsibilities.

#### Phase 2 — Contextual actions

- Make Save immediate.
- Apply automatic and editable Project context.
- Correct Source Detail routing.
- Allow Research to begin anywhere.

#### Phase 3 — Professional workflow

- Clarify Notebook's role.
- Link Notebook notes to Report blocks.
- Automate Report construction and updates.

#### Phase 4 — Progressive disclosure and mobile

- Hide governance machinery from ordinary workflows.
- Demote specialized systems.
- Simplify the mobile hierarchy.

## Implementation rule

Work through this plan one numbered step at a time. Before changing a step:

1. Inspect the existing implementation and data ownership.
2. Identify what is being renamed, moved, hidden, or automated.
3. Preserve existing data and restoration paths.
4. Implement the smallest coherent change.
5. Verify the complete rendered interaction locally.
6. Commit the verified step independently before continuing.

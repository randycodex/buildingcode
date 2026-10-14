# Permitext minimal workflow plan

Date: October 12, 2026

Status: The revised minimal workflow is implemented and locally verified on the isolated review branch. Notes is continuous writing with basic formatting; Open questions has been removed. The Pro startup presentation fix passes controlled tests and real-account physical-device cold launches under normal and 3G-conditioned networking. Nothing has been merged or deployed.

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

### Notes direction — revised October 13

The user rejected Open questions after seeing it on iPhone: “an area for typing, and basic format - that is.” Notes should provide one continuous writing area with a compact basic formatting toolbar. Remove question counts, filters, resolution fields, and question panels. Preserve saved documents and existing source-to-note-to-report relationships; retain compatibility with any stored metadata without displaying the rejected feature.

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

### Step 5 — Superseded: remove Open questions from the interface

The original question-tracking recommendation was implemented and tested, then explicitly rejected by the user on October 13. It is no longer part of the desired workflow.

- [x] Remove question UI from native Notes.
- [x] Remove question counts, filters, editors, and related Report panels from web.
- [x] Keep Notes focused on continuous typing and basic formatting.
- [x] Preserve stored content and metadata compatibility; no deletion or migration of user records.

Acceptance: Opening a note shows a simple writing space and basic formatting, without question management.

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

- [x] Inspect the current installed/native implementation before defining changes.
- [x] Preserve the same responsibilities and source relationships across devices.
- [x] Use focused screens with Back navigation instead of copying desktop columns.
- [x] Preserve reading position, drafts, project context, and note/report continuity.
- [x] Verify the relevant flows on the rendered native app.

Acceptance: The core workflow remains understandable and connected on iPhone. Report native build results and physical-device interaction evidence separately.

### Step 11 — Continuous Notes editor (user addition, October 12)

The user supplied a reference showing a large uninterrupted writing area with a compact formatting toolbar, and explicitly rejected the floating block “+” and drag handle as the way to add headings.

For iPhone, follow the user's Apple Notes reference: one open writing page, Back and Done at the top, and a small toolbar above the keyboard. Put text styles and headings under Aa, with quick list and insertion controls. Keep save state unobtrusive; do not show a questions section or extra panels in Notes.

- [x] Use one continuous editable Notes surface on iPhone; Return, selection, cursor movement, and Back must preserve natural writing flow.
- [x] Keep basic formatting in a compact toolbar: bold, italic, strikethrough, Body/Heading, bullets, numbering, links, and Insert.
- [x] Remove floating “+” and drag handles from the writing surface on web and iPhone.
- [x] Retain rich document structure, headings, nested lists, images, evidence/research links, and undo/redo; do not flatten saved notes.
- [x] Preserve offline drafts, autosave, conflict review, last-keystroke durability, and source-return editing position.
- [x] Verify the rendered web editor and physical iPhone interaction using the supplied visual direction.

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

### Native acceptance — resumed October 13

The user made the physical iPhone available and confirmed it unlocked. Native verification resumed using shared DerivedData and the existing physical device. No new simulator runtime or device was created. Device use must end by 08:09:34 ET on October 13 at the user's departure deadline.

Verified in physical-device runs: continuous heading/Return editing; link insertion, lists, undo/redo; offline draft retention and retry; revoked/viewer access protection; cached refresh protection; focused document width after preventing sub-16px input autozoom. The source bridge, exact source identity, evidence insertion, keyboard geometry, and autosave/question durability regressions also pass locally.

Corrections made during verification: compact native keyboard toolbar positioning, native link-entry form, a 16px minimum editable body size while retaining larger Dynamic Type, explicit empty-question persistence, stable-ID question bindings after row removal, and native destructive confirmation alerts.

**Historical morning result (superseded by the final evening checkpoint below): native acceptance was not complete.** The 08:04 focused run failed all three checks. Initial typing in Larger Text produced ` BEORE` instead of ` BEFORE`, even with individual character events and a Synced status; this is an unresolved input-loss risk, not a dismissed automation artifact. Earlier source-return passes do not close this latest failure. The deletion and question-removal tests reached their native alerts but failed action hittability; duplicate accessibility wrappers were removed for a final focused retry. The earlier last-question removal crash also requires successful post-fix device confirmation.

Input-loss follow-up: capture DEBUG-only beforeinput/input/composition events, editor transaction revisions, replacement requests, and saved document snapshots using synthetic text. Determine whether loss occurs before WebKit input, within editor transactions, or during native synchronization. Do not record real note content. Keep the exact text assertions and retain steps 10–11 as pending until the defect is resolved and retested.

Keep rendered layout, device interaction, isolated persistence checks, and hosted acceptance distinct. Nothing in these runs establishes TestFlight, App Store, or hosted acceptance.

### Evening device follow-up — October 13

- Physical iPhone: conflict review, explicit deletion, return to the actual Notebook list, and no draft restoration after foreground refresh **pass**. The previous empty-list assertion used a fixture with no parent list; its navigation now matches the actual workflow.
- Physical iPhone: question creation/resolution, Back navigation, explicit removal of the final question, saving, and return without resurrection **pass**. No removal crash occurred.
- Intermediate evening result, superseded below: Larger Text source-return test remained pending: initial text and pre-navigation final keystroke survived, but the resumed string was `AFTE` rather than `AFTER`. Fixture-only input tracing is being captured before failed assertions to distinguish delivered input, editor transactions, and native synchronization.
- Evidence: `Test-permitextPhysicalStress-2026.10.13_20-43-01--0400.xcresult` in shared DerivedData (2 passed, 1 failed).

### Final Notes checkpoint — October 13 evening

- User direction applied: Notes contains a continuous editable document and compact basic formatting. Open questions panels, counts, filters, and related Report displays are removed on web and iPhone. Stored legacy metadata remains compatible and recoverable; no user-record migration or deletion was performed.
- Web rendered verification at **1920 × 1080** passes: 42px toolbar and footer, no horizontal overflow, create/bold/save/reload and linked Note-to-Report content. Current proof: `simple-notes-1920x1080.jpg` in the visualization directory above.
- Native lifecycle corrections avoid mounting the web editor before initial load and avoid publishing readiness during SwiftUI view updates. Synthetic diagnostics observed the complete input sequence and matching editor/native revisions. The exact cause of the earlier intermittent input loss was not conclusively established.
- Physical iPhone final tests **pass without diagnostic instrumentation**: ordinary whole-string typing in normal and Larger Text, immediate last-keystroke source navigation, exact full text and caret after Back, resumed typing, reachable formatting toolbar, and synchronization. Evidence: `Test-permitextPhysicalStress-2026.10.13_21-00-58--0400.xcresult` (2 passed, 0 failed).
- Continuous heading/Return and the simplified Notes surface also pass on the physical iPhone in `Test-permitextPhysicalStress-2026.10.13_20-57-27--0400.xcresult` (3 passed, including delayed Pro presentation).
- Bridge, autosave/revert, reference identity, evidence insertion, keyboard geometry, lifecycle publication, and legacy recovery-cache regressions pass. Web workflow, offline durability, Report, build-output, and cache contracts pass.
- Steps 10–11 are accepted for the tested local scope. These checks do not guarantee absence of all bugs or establish a hosted/TestFlight/App Store release. The regular app has been reopened and the phone is no longer needed for the remaining Mac checks.

### Additional issue — Pro recognition on cold start (October 13)

- [x] Implement neutral presentation while an existing account entitlement is restored after cold launch or sign-in.
- User-reported behavior: locked controls appear for a few seconds before the app recognizes the Pro account.
- Expected behavior: while account entitlement is being restored or checked, show an appropriate loading state instead of prematurely presenting the account as non-Pro. Preserve account isolation and entitlement validation.
- [x] Real-account acceptance: two process cold launches under normal networking and two with the iPhone Network Link Conditioner enabled on its 3G preset. All four retained Saved and Research access, showed Account type: Pro / Lifetime Pro, and exposed no Free/lock prompt in sampled UI states. Controlled tests separately cover authoritative Free, Pro, failure, timeout, retry, and account switching. This is interaction acceptance, not a backend-latency benchmark or a frame-by-frame guarantee before XCTest attaches.
- Status: implemented locally. Saved, Research, and Plan use a neutral checking state until authoritative resolution; cached valid Pro remains available. The delayed-backend fixture passes on the physical iPhone, and eight state/account-isolation/timeout tests plus the final sign-in ordering regression pass on the existing simulator. The sign-in check reserves Apple verification before applying backend Free, without granting access. Final evidence: `Test-permitext-2026.10.13_21-07-46--0400.xcresult` (1 passed). The requested real-account normal/slow-network interaction check is now complete; backend latency was not separately benchmarked.

## Supporting principle

Expose frequently needed actions clearly and reveal secondary controls when useful. Progressive disclosure should reduce initial complexity without hiding essential work.

Reference: [Nielsen Norman Group — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).

Local storage checkpoint: reused the existing simulator and shared DerivedData; no simulator downloads or duplicate devices were created. Final audit reported 25 GiB free and 0 B XCTest clone data. The worktree wrapper declined automatic cleanup because its repository validation targets the primary checkout; the separate primary-checkout audit succeeded.

### Real-account Pro cold-start acceptance — October 13, 21:19 ET

- Added `testRealProAccountColdStartKeepsAccess` using normal launch arguments and the phone’s existing account/session; no synthetic entitlement or authentication bypass. Each run terminates and launches twice, samples Saved 12 times after navigation becomes reachable, verifies actual Saved/Research content, then checks the exact Pro account label. No research question, purchase, sign-out, or explicit content edit was performed.
- Normal connection: **PASS**, `Test-permitextPhysicalStress-2026.10.13_21-13-17--0400.xcresult`.
- Phone Network Link Conditioner, **3G preset enabled**: **PASS**, `Test-permitextPhysicalStress-2026.10.13_21-17-14--0400.xcresult`. Setting was visually verified before testing and still enabled afterward.
- Restored Network Link Conditioner to **off**, with its original **Wi-Fi preset** selected, and visually verified restoration. Reopened the normal Permitext app. No simulator runtime/device was added.
- Screenshots are retained in the corresponding shared-DerivedData test results. Network setup/restoration evidence: `/tmp/permitext-pro-network-3g-enabled.png` and `/tmp/permitext-pro-network-restored.png`. Account evidence confirms the actual Lifetime Pro account, not a fixture.
- The initial app-launch interval before XCTest can inspect UI is outside the sampled assertions. No full-screen video claim is made: the device reports native screen recording unsupported. Existing delayed-entitlement device coverage and state regression tests cover the unknown-plan transition independently.

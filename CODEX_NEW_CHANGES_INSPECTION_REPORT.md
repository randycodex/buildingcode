# codex/new-changes — Agent Handoff Pack

**Purpose:** Single document so another agent can continue without re-deriving context from chat. Covers code/UX inspection, performance/flicker, product model, and recommended direction.

**Repo:** `/Users/randy/Documents/X_CODING/Building Code`  
**Branch:** `codex/new-changes`  
**HEAD at inspection:** `2b78b40a7` — *feat: group research folder destinations*  
**Compared against:** `main` (`946d36d58`) — **64 commits ahead**  
**Hard constraint from user:** **Do not merge into `main` under any circumstances** unless the user explicitly reverses this.  
**Date:** 2026-08-02  
**Author of this pack:** Grok inspection session (read-only product/code review; report file only).

### Status of this file

- Untracked at write time (`?? CODEX_NEW_CHANGES_INSPECTION_REPORT.md`) — not committed unless someone commits it.
- Application source was **not** modified for this pack.
- Automated checks run during inspection: all **pass** (see §4).

### How to use this pack (for the next agent)

1. Read **§0 constraints**, **§1 executive summary**, **§2 architecture**, **§16 product**, **§17 recommendations**.
2. For bugs/fixes, use **§5–§11** and **§15** (flicker).
3. Do **not** re-merge to main; work on `codex/new-changes` (or a branch off it).
4. Prefer verifying HEAD still matches or re-diff if the branch moved.
5. Highest-leverage implementation order is in **§18**.

---

## 0. Constraints & conversation intent

| Item | Detail |
| --- | --- |
| User goal (inspection) | Short but thorough: everything that needs a fix at code level; UX/UI; **especially project columns and columns derived from them** |
| Deliverable | This `.md` report |
| Branch | `codex/new-changes` only |
| Merge | **Never into main** (user instruction) |
| Follow-ups discussed | Performance/flicker; product opinion; “what would you do different?” |
| User confirmed | Report path updates for flicker (§15) were applied |

---

## 1. Executive summary

This branch is a large workspace redesign (web-first, ~8.4k insertions / ~3.6k deletions across 31 files). The old **standalone Project Detail column** was intentionally removed from the render path. **Projects** now live inside the **Projects/Saved column** (toolbar label: “Projects”), and **Notebook / Report Draft / Workboard / Coordination** open as **project-derived columns** next to that host column.

That architecture is coherent and largely deliberate (contract tests explicitly assert `renderProjectDetail` is not called from workspace render). The remaining problems are mostly:

1. **State/UI desync** between the selected folder in Projects and the open derived tool columns.
2. **Dead project-detail machinery** still in state, placement, labels, and tests.
3. **Incomplete close/reset paths** (especially Coordination + Close All).
4. **Research ↔ folder** semantics that now include Reference destinations while foundation/history still treat “project” as non-reference.
5. **UX polish / consistency** issues across dual list UIs, optimistic tool toggles, and drag/group behavior.
6. **Column flicker** on many button clicks: tool open/close and project select force a full Projects (and sometimes Research/Settings) remount via `projectOverviewRefreshPaneIDs()` — see §15.

**Product read (summary):** Permitext is a serious vertical instrument — enacted code as authority, Projects as the unit of job work, AI as constrained non-authority. The *logic* is strong; daily feel is hurt by remount-heavy workspace machinery and multi-layer state that can disagree. See §16–§17.

Automated checks on this tree: `evidence-folders-contract`, `workspace-state-contract`, `project-foundation-contract`, and `smoke` all **pass**. Findings are from static/code-path review, not failing CI.

---

## 2. Mental model — project column & derived columns

| Layer | What it is | How it appears |
| --- | --- | --- |
| **Host column** | Saved utility instance(s), labeled **Projects** in the topbar (`#toggle-saved`) | Project/Reference tiles, optional selected-folder context (summary, tools, evidence, history) |
| **Studio context** | `state.projectDetails` (hard-capped to **1** via `.slice(0, 1)`) | Not a visible column anymore; gate for which tool columns may open |
| **Derived columns** | Notebook, Report Draft, Workboard, Coordination (+ thread) | Separate panes with `--project-color` / drag handles; ordered after the host column |
| **Related derived** | Research list + conversation | Can pick up project color via `project-derived-panel` when a primary project is set |
| **Archive** | `utility:archive` | Separate column; can open projects into the Saved host path |

### Intended interaction (happy path)

1. Open **Projects** (`#toggle-saved` → `utility:saved:*`).
2. Select a **Project** tile → `activateProjectStudio` + folder context with 4 tool buttons.
3. Open tools → `placeProjectToolPaneLast` appends each new tool after existing tool siblings (opening order).
4. Drag host Projects column → moves host + all open tools + archive as one stack (`paneGroupForMove`).
5. Drag a single tool → only among same project’s tools (cross-project drag rejected).

### Architectural decision already locked in

```text
renderWorkspace / renderUtilityWorkspace
  → open project tools if projectDetails + open flags
  → do NOT call renderProjectDetail()
```

`tests/evidence-folders-contract.mjs` asserts:

- `defaultActivePaneIDs` does **not** include `paneIDForProjectDetail`
- neither render path calls `renderProjectDetail`

So findings that mention `renderProjectDetail` are **dead-code / migration debt**, not “missing feature,” unless product reverses that decision.

### State that must stay aligned (today it often does not)

| State key | Lives on | Meaning |
| --- | --- | --- |
| `utilityInstances[].selectedFolderID` | Saved instance | Which Project/Reference tile is selected in the host UI |
| `state.projectDetails` / `projectDetail` | Workspace layout | “Studio” project (max 1) — gates tools |
| `state.notebooks` / `workboards` / `reportDrafts` / `coordinations` / `coordinationThreads` | Workspace layout | Which tools are open (matched to project identity) |
| `state.paneOrder` / `paneWeights` | Workspace layout | Column order and widths |
| Research `primaryProjectID` | Server conversation | Research assignment (may include Reference IDs from UI — see §6) |

**Desync = primary UX bug class on this branch.**

---

## 3. Branch scope

**Primary surface:**  
`permitext-sync-server/public/{app.js,styles.css,index.html,workspace-state.js,offline-storage.js,service-worker.js}`

**Server/contracts:** folder types (`project` | `reference`), foundation filtering, research assignment, evidence/folder contracts  

**iOS (secondary):** folder type + Reader/Bookmarks/Project Hub under `NYC CC APP/`  

**Largest risk concentration:** `public/app.js` (~22.5k lines) — pane ordering, project studio, Saved folder context.

**Asset version at HEAD:** `20260802-research-folder-groups-v457` (index / SW / offline-storage / smoke aligned).

**Diff stat (main...HEAD, approx):** 31 files, +8377 / −3615 lines.

---

## 4. Tests run during inspection

| Suite | Result |
| --- | --- |
| `tests/evidence-folders-contract.mjs` | Pass |
| `tests/workspace-state-contract.mjs` | Pass |
| `tests/project-foundation-contract.mjs` | Pass |
| `tests/smoke.mjs` | Pass |

**Gap:** Smoke is mostly **source-string contracts**, not runtime interaction tests. P0 deselect/orphan-tool and flicker remounts are **not** covered.

Suggested tests for implementers:

1. State-machine unit tests: activate / deselect / switch project / closeAll / tool open-close without full DOM.
2. Optional Playwright: select Project → open Notebook → deselect → expect Notebook closed; tool toggle should not replace Saved panel element identity.

---

## 5. Findings — Project column ↔ derived columns

Severity: **P0** user-visible broken · **P1** wrong state / hard recover · **P2** UX debt · **P3** cleanup

### P0 — Deselecting a Project leaves derived columns orphaned

**Where:** `renderSavedProjects` tile `open()` (~18749–18775 in `public/app.js`)

When the selected Project tile is toggled **off**:

- `selectedFolderID` is cleared
- path falls through to non-project refresh: `transitionWorkspace("utility", { refreshPaneIDs: [paneID] })`
- **`openProjectDetails` is not cleared**
- **open Notebook / Workboard / Report Draft / Coordination stay open**

**User-visible:** Projects host shows no selection; tool columns remain.

**Fix direction:** On deselect of a Project folder, tear down studio like archive/close (`closeProjectDetailForProject` or `deactivateProjectStudio`), including discard confirms for Notebook/Report Draft.

---

### P0 — Selecting a Reference folder does not close Project tools

**Where:** same `open()` path; Reference only refreshes Saved.

If Project A is open with tools, then user selects Reference B:

- host shows Reference (notes + convert, no tool strip)
- **Project A tools remain open**

**Fix direction:** Selecting non-project folder or different project should close previous tools (with confirms) or re-select the project that owns open tools.

---

### P1 — Switching Projects remaps open tools to the new identity

**Where:** `activateProjectStudio` (~2338–2425)

A → B with tools open:

- Notebook/Report Draft get discard confirms
- Workboard / Coordination open flags **transfer** to B
- widths transfer; content becomes B’s

**Fix options:** (A) close tools on switch (safest); (B) keep transfer + toast; (C) multi-project (not supported — `slice(0, 1)`).

---

### P1 — Host selection and `projectDetails` can diverge on restore

**Persistence:**

- `selectedFolderID` on `utilityInstances`
- `projectDetails` + tool flags on workspace layout (`workspace-state.js`)

**Hydration:** `hydrateSavedPanel` / `renderSavedFolderContext` use `selectedFolderID` only; do **not** re-call `activateProjectStudio`.

| Restored state | Result |
| --- | --- |
| Tools + matching selection | OK |
| Tools + empty selection | Orphan tools |
| Selection Project + empty `projectDetails` | Context without studio gate |
| Selection B + `projectDetails` A | Host B, tools A |

**Fix:** On Saved hydrate, reconcile selection ↔ studio ↔ tools.

---

### P1 — `closeAllColumns` incomplete for Coordination

**Where:** `closeAllColumns` (~22092–22116)

Clears projectDetails, workboards, notebooks, reportDrafts, utilities, readers, research…  
Does **not** clear `coordinations`, `coordinationThreads` (and arguably `detachedWorkboards`).

**Fix:** Mirror `closeProjectDetailForProject` / empty layout.

---

### P1 — Pane order still places dead `project:detail:*` IDs

**Where:** `placeProjectDetailAfterProjects`, `restoreProjectsStackOrder`, some close paths

- Still insert/filter `paneIDForProjectDetail(...)`
- `activePaneIDs` **strips** project-detail IDs and only re-inserts **tool** IDs
- Render never builds a detail panel

**Fix:** Stop writing `project:detail:*` into order/weights; treat `projectDetails` as studio context only.

---

### P2 — Drag grouping still references dead project-detail IDs

**Where:** `paneGroupForMove` (~21318–21333)

Dragging **Saved host** correctly moves tools + archive.  
`isProjectDetailPaneID` branch is dead.  
**Edge:** Only `primarySavedPaneID()` (first Saved instance) anchors tools if multiple Saved instances exist.

---

### P2 — Tool opening order

`placeProjectToolPaneLast` only when `!wasOpen` — opening order intent is correct. No visual affordance that order is open-sequence vs fixed product order.

---

## 6. Findings — Projects host UX

### P1 — Dual project UIs: live Saved vs dead `utility:projects`

- Topbar **Projects** → Saved instance
- `renderProjects()` + `utility:projects` exist; smoke asserts workspace does **not** `push(await renderProjects())`
- `toggleUtilityPane("projects")` still special-cases tearing down tools
- Old snapshots with `utilities.projects: true` can mark workspace non-empty without rendering that column

**Fix:** Migrate flag → open Saved; remove or fully wire standalone column.

### P2 — Dense selected-Project chrome

Address, 4 tools, Blocknotes, evidence, research history, activity — all in one scroll. Tools drop below fold easily.

**Suggestion:** Sticky `saved-project-tool-controls` under folder header.

### P2 — Research destination grouping incomplete

Conversation list groups Projects vs Reference (latest commit).  
`createResearchProjectSelect` / evidence discovery still flat.

### P2 — Evidence rows hide folder names by design

Discoverability cost when multi-membership matters.

### P1 — Research can assign to Reference; foundation is project-only

**Client:** `researchProjectChoices` includes Reference.  
**Server:** `requireResearchProject` accepts any owned project record; does not reject `folderType === "reference"`.  
**Foundation:** excludes references (`folderType !== "reference"`).

**Pick one policy:** forbid Reference as research primary, or fully support “folder context” in foundation/copy.

---

## 7. Findings — Reader / Section Detail / bookmarks

### Solid

- Multi-destination save picker with confirm
- Folder membership **section-level** (`blockID = ""` in `projectSectionRecordForSection`); paragraph notes stay annotations
- Local-first membership refresh via `panel.__refreshProjectMembership` (preserves scroll)
- Saved markers scoped to paragraph when bookmarked block differs
- Project saved-item opens project-scoped Reader (`projectSavedSourceKey`)

### P2 — Mental model needs UI education

Users bookmark a paragraph and link a whole section to folders. Document in Save UI.

---

## 8. Findings — Research ↔ Projects

### Solid

- Derived theme via `applyProjectDerivedPaneTheme`
- Move/assign confirmation when context review required
- Grouped destinations in conversation list

### P2 — Closing Research refreshes dead detail pane IDs

```js
const projectPaneIDs = openProjectDetails().map(paneIDForProjectDetail);
```

Should use `projectOverviewRefreshPaneIDs()` / Saved + tools, not dead detail IDs.

### P2 — `preferredResearchProjectID` ignores selected folder if studio inactive

Uses open `projectDetails`, not `selectedFolderID`.

---

## 9. Server / sync / iOS (brief)

### Server

- `folder_type` + default `project` — OK
- Reference excluded from foundation project list — intentional
- Research assign should match folder-type product policy

### iOS

- Parallel folder-type support; hub-oriented vs web full studio
- Expect parity gaps (Workboard detach, etc.)

---

## 10. Dead code & maintainability (P3, large)

| Symbol / path | Status |
| --- | --- |
| `renderProjectDetail` | Unreachable from workspace render; still large + smoke-tested |
| `mountProjectOpeningPane` | Unused in live open path |
| `utility:projects` / `renderProjects` | Not mounted in default render; Archive reuses template |
| `placeProjectDetailAfterProjects` detail IDs | Writes dead IDs |
| Smoke on project-detail chrome | Protects dead UI |

**Recommendation:** Delete dead Project Detail path **or** revive as real column — not both half-alive.

---

## 11. What already looks good (do not regress)

- Single Projects host with embedded studio tools
- Tool opening order + same-project drag constraint
- Host drag moves whole project stack
- Folder types Project vs Reference + Convert path
- Section-level folder membership + local-first membership refresh
- Project-colored derived Research panes
- Grouped research destinations in conversation list
- Local-first archive/delete/sync recovery patterns
- Cache-bust version kept in sync across shell assets
- Trust copy: AI is not official interpretation; project facts are context-only

---

## 12. Recommended fix order (code — no merge)

1. **P0** — Deselect Project / select Reference closes or reconciles studio + tools  
2. **P0/P1** — Hydrate reconcile `selectedFolderID` ↔ `projectDetails` ↔ open tools  
3. **P0** — Stop over-refreshing host on tool open/close (flicker — §15)  
4. **P1** — Complete `closeAllColumns` + workspace teardown  
5. **P1** — Research Reference-folder policy (allow fully or forbid fully)  
6. **P1** — Stop writing dead `project:detail:*` IDs; refresh via real Saved/tool IDs  
7. **P2** — Sticky tool strip; group all research destination UIs  
8. **P3** — Delete or revive dead Project Detail / `utility:projects`; retarget smoke  

---

## 13. Key file map

| Concern | Primary location |
| --- | --- |
| Studio activate / tool transfer | `public/app.js` → `activateProjectStudio` |
| Tool open/close + opening order | `openProject*` / `placeProjectToolPaneLast` / `closeProject*` |
| Active pane composition | `defaultActivePaneIDs`, `activePaneIDs`, `projectWorkspacePaneIDs` |
| Host Projects UI | `renderSaved`, `renderSavedProjects`, `renderSavedFolderContext`, `hydrateSavedPanel` |
| Dead Project Detail | `renderProjectDetail`, `mountProjectOpeningPane` |
| Drag rules | `paneGroupForMove`, `orderWithPaneMoved` |
| Layout persistence | `public/workspace-state.js` |
| Research destinations | `researchProjectChoices`, conversation list picker, `createResearchProjectSelect` |
| Server research project gate | `app.mjs` → `requireResearchProject`, foundation filter |
| Column flicker / rebuild | `renderUtilityWorkspace`, `projectOverviewRefreshPaneIDs`, `renderSaved`, `appendPaneSequence` |
| Membership in-place refresh (good pattern) | `refreshProjectMembershipPanes`, `panel.__refreshProjectMembership` |

---

## 14. Key function index (`public/app.js`)

Use these names when navigating (line numbers drift; search by name):

| Function | Role |
| --- | --- |
| `activateProjectStudio` | Switch/set single open project studio; transfers tool flags |
| `setOpenProjectDetails` | Cap to 1 project detail identity |
| `openProjectNotebook` / `Workboard` / `ReportDraft` / `Coordination` | Open derived columns |
| `placeProjectToolPaneLast` | Append tool after sibling tools |
| `placeProjectDetailAfterProjects` | Still writes dead detail pane IDs |
| `restoreProjectsStackOrder` | Restack host + tools + archive |
| `projectOverviewRefreshPaneIDs` | **Broad refresh list** — major flicker source |
| `renderUtilityWorkspace` | Reuse vs remount based on `refreshPaneIDs` |
| `renderWorkspace` | Full remount, no reuse |
| `appendPaneSequence` | Reorder track DOM, rebind drag |
| `renderSaved` / `hydrateSavedPanel` | Host column build (loading flash on remount) |
| `renderSavedFolderContext` | Selected folder tools + evidence chrome |
| `closeProjectDetailForProject` | Teardown studio + tools for one project |
| `closeAllColumns` | Incomplete teardown |
| `paneGroupForMove` | Drag groups |
| `researchProjectChoices` | Research destination list incl. Reference |

---

## 15. Performance & column flicker

**User report:** Some actions make the current or other columns blink/flicker when clicking a button.

**Conclusion:** Explainable from render pipeline; not random paint. Structural over-remount.

### 15.1 How columns update

| Mode | Function | Pane reuse? |
| --- | --- | --- |
| Full rebuild | `renderWorkspace()` | **No** |
| Utility transition | `renderUtilityWorkspace({ refreshPaneIDs })` | Reuse panes **not** in set; force recreate for IDs in set |

`appendPaneSequence` always reorders the track, rebinds drag, closes custom selects — even when panes reused.

Critical helper:

```js
function projectOverviewRefreshPaneIDs(...additionalPaneIDs) {
  return [
    ...savedPaneIDs(),           // ALL Projects/Saved columns
    analysis?, conversation?,
    settings?,
    ...additionalPaneIDs
  ];
}
```

Almost every project tool open/close and studio activate ends with:

```js
await transitionWorkspace("utility", {
  refreshPaneIDs: projectOverviewRefreshPaneIDs()
});
```

→ **Opening a tool intentionally rebuilds Projects (+ Research/Settings if open)** even when only a derived pane should change.

### 15.2 Why Projects blinks

When Saved is in `refreshPaneIDs`, `renderSaved`:

1. Clone shell template  
2. Show **“Loading saved content…”**  
3. rAF → async `hydrateSavedPanel` (`loadSyncedContent`, tiles, context, evidence, foundation)

= loading flash + scroll loss (unlike `__refreshProjectMembership`, which keeps `scrollTop`).

### 15.3 Action → flicker map

| User action | What re-renders | Why |
| --- | --- | --- |
| Tool open/close | New tool **+** entire Projects (+ Research/Settings) | `projectOverviewRefreshPaneIDs()` |
| Select Project tile | Host (and more) | `activateProjectStudio` broad refresh; tile `is-opening` then parent destroyed |
| Deselect / switch folder | Full Saved remount | `refreshPaneIDs: [paneID]` recreates shell |
| Archive mode toggle | List + CSS animation | Intentional 170ms — OK |
| Tag/note save with Projects open | **All columns** sometimes | `renderWorkspace()` paths when `state.utilities.saved` |
| Cross 4-column threshold | Width jumps | `normalizePaneWeights` `Math.max(value, defaultWidth)` |

### 15.4 Double-refresh & dispose

1. Open tool when studio inactive → `activateProjectStudio` refresh + tool open refresh = **two** Saved rebuilds.  
2. `renderProjectNotebook` always `dispose()` previous mount then rebuild — accidental refresh of notebook ID kills editor.  
3. `closeActiveCustomSelect()` on every `appendPaneSequence`.

### 15.5 Performance fix priority

**P0 — Tool open/close without host remount**

- Refresh only changed tool pane IDs (or empty + mount new).  
- Update `aria-pressed` on existing Saved DOM in place.  
- Use `projectOverviewRefreshPaneIDs()` only when overview content actually changed.

**P0 — Project select in place**

- Patch selection + folder context without “Loading saved content…” if panel exists.

**P1 — Kill full `renderWorkspace()` on local note/tag saves**

- Prefer membership / `__applySavedView` / narrow `refreshPaneIDs`.

**P1 — Coalesce double transitions**

- `activateProjectStudio` + open tool in one transition; debounce rapid transitions.

**P2 — Soft remount**

- Preserve scroll; skip loading placeholder; don’t dispose Notebook/Workboard unless leaving active set.

### 15.6 Verify in browser

1. Record performance: select Project → open Notebook → close → switch Project.  
2. Today: Projects detach/attach + Loading row.  
3. After fix: tool insert/remove only; `.saved-panel` element identity stable on tool toggle.

### 15.7 Link to state bugs

Flicker and desync share a root: **full host remount used as the update mechanism**. Fix both by **patching studio in place; remount only when the pane set changes.**

---

## 16. Product model — how things connect & product opinion

*Discussed with user after code inspection. For agents: this is product judgment, not a ticket list.*

### 16.1 One-sentence product

Permitext is a **professional workspace for reading official construction code and turning that reading into durable project evidence** — not a chat app that “knows the code,” and not a generic doc manager.

### 16.2 Logical layers

```text
1. Authority     → enacted codes, Reader, Search, Section Detail
2. Capture       → bookmarks, paragraph notes, tags, multi-folder destinations
3. Project       → Project vs Reference folders
4. Tools         → Notebook, Workboard, Report Draft, Coordination
5. Research      → AI on selected enacted passages + project context (non-authority)
6. Continuity    → sync, outbox, foundation, Pro/entitlements, firm
```

**Research is deliberately downstream** of selection + project context. Trust copy that AI is not official interpretation is product-mature.

### 16.3 What is strong

- Core insight: stable citations + job-shaped home + notes that don’t corrupt authority  
- **Project vs Reference** matches firm reality  
- Trust posture (context-only facts, review on research move) is a differentiator  
- Column workspace fits comparison work  
- Local-first sync instincts fit field use  

### 16.4 What is strained

- **Multi-layer state** (selection / studio / tools / research / pane order) vs UI that looks like “one Projects column”  
- **One project at a time** (`slice(0, 1)`) blocks multi-job comparison  
- Research easy to misread as ChatGPT if entry points are free-floating  
- Web = real studio; iOS still hub — parity messaging must be honest  
- Complexity tax: many secondary studios before spine feels rock solid  
- Flicker makes careful data product feel unreliable  

### 16.5 Product verdict

**Serious vertical product, not a thin LLM wrapper.**  

- Best self: Reader + project evidence + light tools + cautious AI  
- Risk self: Swiss-army workspace where remounts and state forks destroy trust  

**Spine to protect:**

1. Authority never blurred  
2. Project is the unit of professional work  
3. Everything else is a lens or export of that unit  

---

## 17. What we would do differently (product + engineering direction)

*Opinion for prioritization. Not implemented.*

### 17.1 Single Active Project (king object)

- Selecting a Project *is* activating it  
- Deselect / Reference closes or parks tools  
- Research defaults to Active Project only  
- Tools never silently remapped without confirm/toast  

### 17.2 Host column stable; tools mount only

- Projects shell long-lived  
- Tool toggle = insert/remove one pane + `aria-pressed`  
- Membership updates use in-place refresh pattern  

**Rule:** If the user didn’t change *which* project they’re in, don’t remount Projects.

### 17.3 Fewer simultaneous surfaces (phased)

| Phase | Ship |
| --- | --- |
| Spine | Reader + Search + Projects (evidence/notes) + one writing surface |
| Next | Research on selected passages |
| Later | Workboard, Coordination, firm as secondary |

Prefer Notebook *or* Report as default writing path, not two equal peer editors day one.

### 17.4 Multi-destination save — keep, clarify story

- Primary: Save to Active Project (one tap)  
- Secondary: Also in…  
- Explicit: bookmark vs folder membership  

### 17.5 Research narrower

- No Reference as primary (or full foundation support — pick one)  
- Entry only from selection or “Analyze for {Active Project}”  
- Lead with this Project’s research, not free-floating chat history  

### 17.6 Kill dual host

One Projects host. Delete or quarantine dead `renderProjectDetail` / `utility:projects`.

### 17.7 Named modes vs pure free-form window manager

Defaults: Reading / Project / Research modes; free drag optional; consider cap on open tool columns.

### 17.8 Sync quieter

No full workspace remount on tag edit; inline “Saved · syncing.”

### 17.9 Cross-platform honesty

Web = full studio for now; iOS = capture + browse + deep-link to web for heavy tools — said out loud until parity is real.

### 17.10 Do not change

- Enacted text as authority  
- Project vs Reference  
- AI as non-authority, selection-bound  
- Section-level folders + finer notes  
- Column metaphor  
- Sensible Pro gating on heavy surfaces  

### 17.11 If only three things

1. Single Active Project always aligned with tools and Research  
2. Stable Projects column (no flicker on tool toggle)  
3. Spine over suite — progressive disclosure for secondary tools  

**One-line strategy:** Sharper instrument, not bigger office — same professional object, fewer rooms, UI that never lies about what’s active.

---

## 18. Suggested implementation sequence for next agent

**Still on `codex/new-changes`. Do not merge to main.**

### Milestone A — Correctness (state truth)

1. Introduce or tighten **deactivate/reconcile** helpers:  
   - deselect Project → close tools (confirms)  
   - select Reference → close project tools  
   - switch Project → explicit close or transfer policy  
2. Hydrate: reconcile `selectedFolderID` ↔ `projectDetails` ↔ tool arrays  
3. Fix `closeAllColumns` (coordinations, coordinationThreads)  
4. Add smoke/state tests for A  

### Milestone B — Flicker (same machinery)

1. Tool open/close: **do not** put Saved in `refreshPaneIDs` by default  
2. Patch tool button pressed state in existing Saved DOM  
3. `activateProjectStudio` / tile select: in-place hydrate, no loading flash if panel exists  
4. Coalesce activate+openTool to one transition  
5. Replace tag/note `renderWorkspace()` with narrow updates  

### Milestone C — Dead code & Research policy

1. Remove or isolate `renderProjectDetail` / dead pane IDs; retarget smoke  
2. Decide Research + Reference policy; enforce client + server  
3. Prefer sticky tool strip / Research entry from Active Project  

### Out of scope unless user asks

- Merge to main  
- Large iOS parity  
- New major features (new tool types, multi-project side-by-side) before A+B  

---

## 19. Conversation log (compressed)

| Turn | User | Outcome |
| --- | --- | --- |
| 1 | Can you see `codex/new-changes`? | Yes, in Building Code repo |
| 2 | Inspect that repo/branch thoroughly; fix list + UX especially project/derived columns; `.md` report; **no merge to main** | Full inspection report written |
| 3 | Did you review performance / column blink? | Yes — structural remount causes; §15 added |
| 4 | Did you update the `.md`? | Confirmed §15 + summary updates |
| 5 | Product opinion — how connected, what do you think? | §16 content |
| 6 | What would you do different? | §17 content |
| 7 | Update `.md` so another agent can take a look at everything | This handoff pack |

---

## 20. Explicit non-actions from this session

- Did **not** merge into `main`  
- Did **not** push remote  
- Did **not** modify application source for inspection/product discussion  
- Working tree at inspection: clean on `2b78b40a7` (report file may be untracked)  

---

*End of agent handoff pack.*

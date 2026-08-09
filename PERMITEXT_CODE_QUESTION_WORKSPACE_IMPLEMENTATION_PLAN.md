# Permitext Research and Code Decision Workspace Implementation Plan

- **Plan version:** 1.2
- **Prepared:** August 3, 2026
- **Status updated:** August 9, 2026
- **Repository:** `/Users/randy/Documents/X_CODING/Building Code`
- **Implementation status:** **PHASE 5 CONVERSATIONAL MIGRATION IN PROGRESS; PHASE 5A TRUST LAYER COMPLETE; LATER-PHASE GATES REMAIN OPEN** (see progress ledger)
- **Purpose:** Product, architecture, migration, verification, and continuation plan

> Phases 0–10 produced substantial branch-only UI, domain-contract, and local-hardening work. Phase 5A closed the server-authority, account-isolation, cross-session, and lifecycle-integration gap for the underlying governed record. On August 9, 2026, the primary user experience was redesigned: the five-stage interface is superseded by conversational Research that progressively builds a structured Code Decision. The trust architecture remains; the amount of manual workflow the professional must perform is reduced. Keep the capability default-disabled; do not begin a professional pilot or enable it in production until the remaining conversational-UX migration and Phase 9/10 device, policy, accessibility, deployment, Production, and rollback gates are proven with the evidence stated below.

---

## 1. Executive decision

Permitext should be organized around one first-class Project-owned unit of professional work, presented to users as a **Code Decision**. The existing internal `CodeQuestion` model may remain where a risky rename would endanger compatibility.

The trust layer must preserve one continuous and traceable lifecycle:

> **Official code text → approved evidence + Project facts → bounded analysis → professional conclusion → optional/contextual review when applicable → immutable issued record**

The primary interface must not require the professional to operate that lifecycle as five visible stages. The authoritative experience is:

> **Conversation on the surface. Structure underneath.**

The natural progression of a Research conversation is:

> **Ask → Investigate → Decide**

These are conceptual moments, not required tabs or gates. A professional opens a Project, opens Research, asks naturally, investigates candidate provisions, confirms evidence with lightweight actions, and arrives at a professional decision. Permitext progressively builds the governed record alongside the conversation.

This is a reorganization and integration of systems Permitext already has. It is not a greenfield rebuild and must not create a parallel Research/decision system. The existing multi-column workspace, Reader, Search, saved passages, selected-evidence Research, Code Question contracts, Notebook, Coordination, Report Draft, immutable Report Manifest, Workboard, local-first storage, sync, permissions, and activity contracts are valuable foundations. They should be reused behind one connected Research-to-Code-Decision experience.

The central product change is this:

- Today, several Project tools appear as neighboring destinations with roughly equal weight, and the Phase 2–7 prototype exposes five workflow stages.
- In the target product, a professional opens a Project and enters Research as the primary working surface.
- A Research conversation may be exploratory and messy: it can contain follow-up questions, tentative ideas, rejected provisions, and unresolved information.
- Permitext progressively extracts and updates one structured Code Decision containing the Question, Project Facts, Assumptions, Missing Information, Approved Evidence, Evidence-bounded Analysis, Professional Conclusion, applicable Review information, and any issued Code Memo.
- Candidate evidence remains distinct from approved evidence. The intended discovery path is **Question → suggested evidence → professional confirmation → bounded analysis**.
- Notebook and Workboard remain available as supporting tools.
- Coordination continues underneath as structured Review Requests, surfaced only when review is applicable.
- Report Draft remains an advanced supporting tool; **Create Code Memo** is the main issuance action for a finalized Code Decision.

Nothing should be deleted during the initial reorganization. Tools that are not part of the default path should move under **Add column** or **More** until real usage and migration evidence justify removal.

---

## 2. Authority and supersession

### 2.1 What this plan governs

This plan governs:

- the user-facing Research and Code Decision information architecture;
- the Ask → Investigate → Decide conversational progression;
- the internal Code Question governance lifecycle that continues underneath the interface;
- the user-facing purpose and placement of existing Permitext tools;
- the web multi-column workspace arrangements;
- the additive data-contract and server changes needed to support Code Questions;
- migration and compatibility with existing Project material;
- the adapted iPhone/iOS experience;
- verification, pilot, rollout, rollback, and handoff requirements.

### 2.2 What this plan supersedes

For this scope, this plan supersedes:

- Projects being treated primarily as a subsection of Saved;
- Notebook, Research, Workboard, Report Draft, and Coordination appearing as equally important Project entry points;
- generic Report Draft being the normal starting point for a project-specific code decision;
- the older default flow of `Project → saved evidence → Notebook → Research → Report`;
- `Define → Evidence → Analyze → Review → Issue` as the primary visible workflow, stage selector, or required sequence of user-operated screens;
- treating Research as only an Analyze-stage output or as a product separate from Code Questions;
- requiring professionals to understand or manually operate definition revisions, Evidence Set versions, dependency bindings, governed-artifact names, approval objects, or issuance manifests during ordinary work;
- mandatory review for every decision regardless of role, policy, risk, or Project context;
- prior immediate-sprint ordering where it conflicts with establishing the Code Question workflow;
- any interpretation of the Stitch export as production-ready code.

### 2.3 What this plan does not supersede

This plan does **not** supersede:

- the selected-evidence boundary for Research;
- the distinction between candidate search results and approved evidence;
- canonical source authority and legal-content provenance rules;
- source-rights and licensing obligations;
- server-enforced authorization;
- local-first and offline behavior;
- sync compatibility and preservation of unknown records;
- immutable historical Research answers, evidence snapshots, reports, and activity;
- lawful deletion, retention, privacy, billing, production, and App Store gates;
- the rule that production deployment and production verification are separate from local code completion.

### 2.4 Phase 5 redesign disposition

The August 9 redesign changes presentation and orchestration, not the trust model:

| Previous Phase 5 requirement | Disposition | Authoritative direction |
| --- | --- | --- |
| Immutable question/definition revisions and Question Inputs | Preserved internally | Research captures and updates the Question, Project Facts, Assumptions, and Missing Information; revision mechanics remain underneath. |
| Project ownership and immutable Project-input snapshots | Preserved internally | Every Code Decision remains Project-owned; analysis, conclusion, review, and issuance continue to bind exact controlled input snapshots. |
| Candidate/approved distinction and immutable Evidence Set versions | Preserved internally; simplified presentation | Research suggests candidate provisions. Lightweight professional accept/reject actions create governed evidence proposals/approvals and immutable sets. |
| Evidence eligibility, exact code/source-version binding, citation validation, and dependency/staleness detection | Preserved internally | Only eligible, professionally approved evidence enters analysis; exact source versions and validated citations remain bound, and later changes surface as **Changed — Re-evaluate**. |
| Approved Evidence → Bounded Analysis → Professional Conclusion columns | Consolidated into Research and Code Decision | Research shows conversational investigation and bounded analysis; Code Decision keeps AI analysis visibly separate from the professional-authored conclusion. |
| Define → Evidence → Analyze → Review → Issue stage selector | Superseded | No five-stage primary navigation. Contextual actions and the Code Decision record reveal the next useful step. |
| Review as a required visible stage | Made optional/contextual | Existing Review Requests and approval rules surface when policy, role, or risk requires them; blocking requests still block approval/issuance. |
| Issue as a required visible stage | Changed in presentation | **Create Code Memo** is the main action. Readiness, approval, idempotent issuance, manifests, and immutable records remain server enforced. |
| Permissions, audit history, optimistic concurrency, idempotency, server validation, and offline safety | Preserved internally | Conversational actions must invoke the same authorized, validated, replay-safe commands and expose conflicts or blocked actions in plain language. |
| Code Memo manifests, immutable issued records, and HTML/PDF generation | Preserved internally; simplified presentation | **Create Code Memo** prepares and issues through the existing manifest/file pipeline; issued records remain immutable and versioned. |
| Separate Research and Code Question products | Superseded | Research is the working surface; Code Decision is the governed record produced from it. |
| Code Question user-facing name | Changed in presentation | Prefer **Code Decision** and **Code Decisions**. Retain internal `CodeQuestion` names and stored kinds unless a separately planned safe migration is justified. |
| Detailed versions, hashes, and dependency bindings in normal UI | Preserved internally; progressively disclosed | Show plain warnings such as **Changed — Re-evaluate** by default; expose technical lineage in History, audit, or advanced details. |

If an older document conflicts with this plan on navigation or tool hierarchy, this plan controls that limited subject. If an older specialized contract is stricter about evidence, AI, permissions, privacy, sync, or legal content, the stricter contract controls until deliberately revised.

---

## 3. Repository baseline at planning time

This snapshot is informational and must be rechecked before implementation.

- Planning branch: `codex/project-state-flicker-fixes`
- Planning HEAD: `4cdde772b` — `fix: stabilize project workspace transitions`
- Existing unrelated untracked file: `CODEX_NEW_CHANGES_INSPECTION_REPORT.md`
- That untracked report must not be staged, modified, or treated as current implementation truth without re-verification.
- The app is not a small Stitch-generated React project. The active web product has a mature plain-JavaScript workspace shell, server, contracts, local state, sync, tests, and bundled React-based Notebook/Workboard subsystems.

Important existing foundations include:

- `permitext-sync-server/public/index.html` — the active multi-column shell;
- `permitext-sync-server/public/app.js` — pane orchestration and most web behavior;
- `permitext-sync-server/public/workspace-state.js` — persisted pane order, widths, scroll state, and workspace normalization;
- `permitext-sync-server/public/styles.css` — established visual system and pane behavior;
- `permitext-sync-server/app.mjs` — server routes, storage, sync, Research, reports, and Project Foundation handlers;
- `permitext-sync-server/project-foundation-contract.mjs` — artifacts, links, immutable snapshots, activity, conflict rules, and sync compatibility;
- `permitext-sync-server/collaboration-contract.mjs` — versioned review threads and immutable review comments;
- `permitext-sync-server/report-contract.mjs` — draft normalization, immutable Report Manifest creation, exact-source materialization, and hashes;
- `permitext-sync-server/notebook-contract.mjs` — structured Notebook persistence and safe rendering;
- `permitext-sync-server/code-trust-contract.mjs` — current source trust and research-eligibility metadata;
- `permitext-sync-server/tests/workspace-state-contract.mjs` — baseline workspace-state behavior;
- `permitext-sync-server/tests/offline-contract.mjs` — baseline offline behavior;
- `NYC CC APP/permitext` — iOS models, local storage, sync, and Project Hub surfaces.

Do not resurrect removed standalone Project-detail render paths, obsolete pane IDs, or dead navigation paths to implement the new workspace. Extend the active pane registry and current Project-state machinery on the checked-out implementation.

### 3.1 Governing-document map

Read the documents needed for the active phase. Their authority is scoped, not interchangeable.

| Document | Authority for this plan | Use |
| --- | --- | --- |
| `README.md` | Current product doctrine | Local-first product boundary; Search candidates versus selected-evidence Research |
| `Permitext_Recommended_Implementation_Roadmap.md` | Governing foundation unless this plan explicitly supersedes its IA/order | Project records, evidence, Research, reports, authorization, sync, privacy, release gates |
| `PERMITEXT_AI_EVALUATION_REVIEW_HANDOFF.md` | Governing AI boundary | Selected passages, insufficiency, citations, prohibited unrestricted/automatic behavior |
| `permitext-sync-server/WEB_UI_UX_RULES.md` | Governing active web behavior | Multi-column desk, no workspace blink, pane visual and interaction rules |
| `NYC CC APP/IOS_APP_CONTEXT.md` | Governing iOS product boundary | Native responsibilities, selected-evidence doctrine, adapted Project Hub |
| `NYC CC APP/docs/nyc-legal-content-expansion.md` | Governing source-corpus/provenance constraint | Enacted-source inventory, exclusions, verification, rights metadata |
| `PERMITEXT_DEBUG_FIX_AND_HOTSPOT_REPORT.md` | Risk register; reverify against current HEAD | Concurrency, outbox, report-generation, and lifecycle hotspots |
| `PERMITEXT_RELEASE_WALKTHROUGH.md` | Manual role/workflow baseline; partly superseded by this IA | Owner/Editor/Reviewer/Viewer behavior and release verification |
| `PERMITEXT_CROSS_PLATFORM_REVIEW_HANDOFF.md` | Historical cross-platform context; explicitly may be stale | Repository map and prior asymmetries; verify before acting |

### 3.2 Visual reference contract

The latest reviewed Stitch package at planning time was:

- Path: `/Users/randy/Downloads/stitch_permitext_professional_research_workspace (1).zip`
- SHA-256: `d316d9aeddf234fc2e3a1d2aa3f49d62d9607b831970bf5d5edca998e3a94159`

The hash identifies the reviewed artifact even if the download path later changes. The package is reference material, not a dependency.

Retain or adapt only these structural ideas:

- Candidates → Reader → Evidence Tray;
- Approved Evidence → Bounded Analysis → Professional Conclusion;
- a calm, high-density professional workspace;
- approximate 64px rail, 64px application header, and 48px pane-header proportions, subject to reconciliation with active Permitext CSS and accessibility;
- restrained semantic color for Project context, source family, provenance, review, and status.

Reject direct import of its duplicated page shells, Tailwind/CDN runtime, remote fonts/icons/avatars, fictional legal content, reliability percentages, inconsistent workflow examples, border-heavy card treatment, and nonfunctional controls. Main workspace columns remain edge-to-edge and square; rounded surfaces are reserved for appropriate internal controls or grouped content under the established Permitext visual system. Use no gradients. Phase 0 must record any further Keep/Adapt/Reject decisions before UI implementation.

---

## 4. Product objective and professional boundary

### 4.1 Objective

Permitext should help an architect, engineer, code consultant, or reviewer answer a bounded Project-specific code question and preserve a reconstructable professional record of:

- what was asked;
- which Project facts were confirmed;
- which assumptions and unknowns remained;
- which official passages were considered and approved as evidence;
- which exact evidence and facts an analysis used;
- what the professional concluded;
- what reviewers requested, changed, and approved;
- what was issued, by whom, when, and from which versions.

The ordinary experience should feel like professional Research, not records administration. Permitext should do the clerical work of structuring the decision while the professional asks questions, confirms Project facts, evaluates suggested evidence, and authors or finalizes the conclusion. The user should be able to **research messily but issue cleanly**.

### 4.2 Product boundary

Permitext is a professional research and decision-record workspace. It is not:

- an agency determination;
- a permit approval;
- a guarantee of compliance;
- a substitute for professional judgment;
- a complete catalog of every potentially applicable standard;
- an unrestricted AI answer engine;
- a system that silently converts search results into evidence;
- a system that treats model confidence as legal reliability.

Search or AI-assisted discovery may find candidate material. Only an explicit professional action may approve a passage into a Code Decision’s governed Evidence Set. Analysis may use only the approved evidence and the versioned Project inputs attached to the decision. The professional conclusion remains visibly separate from AI-generated analysis even when both appear in the same conversational workspace.

### 4.3 Primary success condition

A reviewer must be able to open any Issued Record and reconstruct the full decision chain without relying on mutable current state.

Every Issued Record must preserve or resolve to immutable snapshots of:

- the precise Code Question;
- confirmed facts, assumptions, and unknowns;
- the approved Evidence Set;
- the selected analysis, if any;
- the approved professional conclusion;
- review disposition and approval;
- authors, reviewers, timestamps, versions, hashes, and predecessor/successor lineage.

---

## 5. Product principles

1. **Conversation on the surface; structure underneath.** Research is the ordinary working surface; governed records are progressively built without making the professional operate internal objects.
2. **Evidence before governed answer.** Search and AI suggestions are candidates; approved immutable passages are evidence.
3. **One decision, one traceable chain.** Conversation, inputs, approved evidence, bounded analysis, professional conclusion, contextual review, and issuance must resolve to the same Project-owned record and immutable versions.
4. **Professional judgment remains explicit.** AI analysis never silently becomes the professional conclusion.
5. **Uncertainty is first-class.** Assumptions, unknowns, conflicts, missing facts, and insufficient evidence remain visible.
6. **Source verification is not Project applicability.** A source can be authentic and still not govern a particular project condition.
7. **Issued means internally issued, not agency approved.** The interface must not imply official government status.
8. **History is additive.** Corrections create new revisions or superseding records; they do not rewrite history.
9. **Link, do not duplicate.** A Code Decision links existing canonical, authored, Research, visual, and generated artifacts.
10. **Reduce effort, not trust.** Automation may propose, extract, classify, and prefill; consequential acceptance, conclusion, review, approval, and issuance rules remain explicit and enforced.
11. **Local-first remains real.** Offline editing, reload, queueing, reconnection, conflict handling, and recovery are separate requirements.
12. **Columns are the workspace.** Preserve resizable, reorderable, independently scrollable panes and their state without forcing each governance object into its own column.
13. **Progressive disclosure reduces clutter.** Supporting tools and technical lineage remain available without competing with Research.
14. **Web and iOS share meaning, not identical layouts.** Web is the full creation environment; iPhone is an adapted Project Hub.

---

## 6. Users and permissions

Use the existing organization roles as the starting point: Owner, Editor, Reviewer, and Viewer. All enforcement must occur on the server as well as in the UI.

| Capability | Owner | Editor | Reviewer | Viewer |
| --- | --- | --- | --- | --- |
| Create/edit Code Decisions (internal Code Questions) | Yes | Yes | Comment/request only by default | No |
| Add or edit Project inputs | Yes | Yes | Request changes | No |
| Propose evidence | Yes | Yes | Request/add review feedback | No |
| Approve or reject evidence | Yes | No | Yes when assigned/authorized | No |
| Run bounded analysis | Yes | Yes | Optional, policy-controlled | No |
| Draft professional conclusion | Yes | Yes | Suggest/request changes | No |
| Open Review Requests | Yes | Yes | Yes | No |
| Resolve assigned Review Requests | Yes | Yes | Yes | No |
| Approve conclusion | Yes | No | Yes when assigned/authorized | No |
| Issue or supersede a record | Yes | No by default | No | No |
| Read issued and historical records | Yes | Yes | Yes | Yes, if Project access permits |

These defaults preserve the current split: Editors propose evidence and Reviewers/Owners approve or reject it. Firm policy may make approval and issuance stricter. Any broader Editor authority requires a separate, explicit product-policy decision. The initial implementation must not invent a new role system; it should add granular capabilities to the existing role and capability contracts.

---

## 7. Target information architecture

### 7.1 Global navigation

The normal global navigation should become:

- **Home** — recent Projects, decisions needing attention, assigned reviews, and recently issued Code Memos;
- **Code Library** — Reader and Search for finding and reading code outside a specific investigation;
- **Saved** — useful provisions preserved for later Project or Research use;
- **Projects** — direct Project access, including Research and Code Decisions;
- **Reviews** — optional and shown only when collaboration/role capabilities make a cross-Project inbox useful;
- **Settings** — account, organization, subscription, source, offline, and application settings.

Within a Project, **Research** is the primary working surface. Reader/Search and Saved retain distinct jobs: Reader/Search find and read code; Saved preserves useful provisions; Research investigates a professional question; Code Decision is the structured record produced from that research; Code Memo is the issued/documented representation of the decision. Zoning Resolution remains a source-family scope within Code Library, with its own trust and eligibility rules.

Layout operations such as Reset, Close All, saved arrangements, and workspace management should move into a compact layout menu. They remain available but should not dominate the product header.

### 7.2 Project navigation

Opening a Project should show:

- Project identity and Project color;
- address and bounded Project context;
- role/access status;
- sync/offline/conflict status;
- a **Code Decisions** index with a compact derived state, responsible professional when useful, and last activity;
- Research as the primary action and working surface;
- issued Code Memos/records;
- a **More** area for Working Notes, Workboard, attachments, advanced Report Drafts, and legacy material.

The Project is the container. Research is the working surface. A Code Decision is the governed professional record progressively produced from a Research conversation.

The visible list should use simple, meaningful labels such as:

- `Q-001 · Occupancy Classification — Final`
- `Q-002 · Corridor Rating — Needs Review`
- `Q-003 · Accessible Units — Working`
- `Q-004 · Rooftop Generator — Changed`

Primary states are **Working**, **Final**, and **Issued**. Contextual states are **Needs Review**, **Changed**, and **Missing Information**. These are derived presentation labels, not replacements for canonical revision, approval, review, staleness, and issuance state.

**Final** means the current Professional Conclusion has been finalized against the current governed dependencies and is eligible to proceed under applicable policy. It is not an issued, locked, immutable, or agency-approved record. **Issued** is reserved for a server-confirmed immutable Code Memo record.

### 7.3 Conversational Research with a governed companion record

The old five-stage selector and its mandatory arrangements are superseded. The ordinary workspace should open a Research conversation beside, or with easy access to, its progressively assembled Code Decision.

The user can:

- ask and refine a natural-language question without first completing a definition form;
- inspect suggested provisions in Reader and accept or reject them with lightweight actions;
- confirm a conversational statement as a Project Fact or retain it as an explicit Assumption;
- see Missing Information collected without reconstructing it manually;
- run bounded analysis once professionally approved evidence and controlled inputs are ready;
- author and finalize a Professional Conclusion that stays distinct from AI analysis;
- request review when applicable or respond to an existing blocking review;
- select **Create Code Memo** when the decision is ready for issuance;
- keep the Research conversation and Code Decision visible together at useful widths;
- resize, reorder, close, or restore a column;
- return to prior work without losing selection, conversation position, accepted/rejected evidence state, or drafts;
- use **Add column** or contextual links for Reader, evidence details, History, Review, and advanced tools.

Conversation alone must never silently approve evidence, convert an assumption into a fact, publish a Professional Conclusion, resolve a Review Request, or issue a memo. Those consequential actions remain explicit and server validated.

### 7.4 Recommended conversational arrangements

| Context | Default columns | Purpose |
| --- | --- | --- |
| Project opened | Code Decisions, Research | Start or resume an investigation without choosing a workflow stage |
| Investigating a decision | Research, Code Decision | Converse on the left; see Question, inputs, approved evidence, analysis, and conclusion assemble on the right |
| Inspecting a suggestion | Research, Reader, Code Decision | Read exact candidate text and accept/reject it without losing conversational context |
| Contextual review | Code Decision, Review Requests, History | Resolve only the review work that applies; do not make Review a universal step |
| Issuance | Code Decision, Code Memo preview/version details | Use Create Code Memo; progressively disclose readiness, approval, immutable lineage, and downloads |

These are defaults, not rigid screen boundaries. At 1440px and wider, Research and Code Decision should be comfortably usable together, with Reader as a contextual third pane. At intermediate widths, preserve both open surfaces and focus one or two at a time. Tablet behavior may use a focused pane with a named switcher. iPhone uses the adapted Project Hub described later.

Use this responsive behavior as the implementation contract unless Phase 0 rendered testing proves that a small adjustment is necessary:

| Workspace width | Visible working model | Required behavior |
| --- | --- | --- |
| 1440px and wider | Research + Code Decision, with contextual Reader as a third pane | Keep conversation and governed record visible where minimum widths permit; overflow horizontally rather than compress legal text below its minimum |
| 1180–1439px | Research + Code Decision at useful widths | Keep contextual panes in the same horizontal track; use `overflow-x: auto` and scroll the newly focused pane fully into view |
| 768–1179px | One focused pane plus a named pane switcher/drawer | Preserve every open pane and its state; switching visibility must not close panes or overwrite saved desktop width/order |
| Below 768px | One focused web pane or the adapted native Project Hub | Preserve the lifecycle and records; do not squeeze the desktop three-pane arrangement into an unusable miniature |

Initial role-specific minimums should be tested at approximately 288px for the Code Decisions index/candidate list, 420px for the structured Code Decision, and 520px for Research/Reader/Memo content. Existing internal Definition, Evidence, Analysis, Review, and Issuance panes may retain their tested widths while they remain available as advanced or migration surfaces.

The outer workspace owns horizontal overflow. Each pane owns its normal vertical scroll. Reader tables or code grids may use a bounded inner horizontal scroller, but keyboard and touch users must be able to enter and leave it without a scroll trap. Sticky headers must not obscure focused content at browser zoom. Responsive visibility changes must never mutate the saved arrangement.

### 7.5 Column behavior requirements

Every Project-owned Research/Code Decision column must:

- use a stable pane identity scoped to Project and Code Question where applicable;
- preserve width, order, selection, filter, scroll position, and unsaved draft state;
- remain independently scrollable;
- support keyboard focus and named controls;
- expose loading, empty, offline, stale, conflict, permission, and error states;
- inherit the active Project color for Project-owned context;
- keep genuinely unassigned or not-yet-linked Research/Saved material visually neutral until it is attached to a Project or Code Decision;
- never show stale content from a previously selected Project or Code Decision;
- open, close, resize, reorder, and switch Project without flashing the full workspace empty;
- use existing focus-visible outlines while avoiding a dense field of thin outline borders;
- work without remote runtime fonts, icon CDNs, avatars, or Tailwind CDN dependencies.

Every arrangement must use one shared application shell: the same rail, product header, Project/Code Decision context, pane-header actions, and sync/offline state. Do not add a second Research implementation or a separate imitation of the application. The five-stage control is obsolete in the primary experience and should be removed or retained only behind a temporary migration/debug path while the conversational surface reaches parity.

Pane mechanics must include a non-drag alternative:

- a focusable resize separator with separator semantics, orientation, current/minimum/maximum values, Arrow-key adjustment, and Home/End behavior;
- named Move left and Move right actions;
- named Focus and Close actions;
- a deterministic focus destination after a pane closes;
- a polite live announcement after open, close, resize, reorder, Project switch, and Question switch;
- a single-pointer and keyboard alternative for every drag gesture.

The latest Stitch export is a historical visual reference only. Its candidate/Reader/evidence relationships and clear separation of analysis from Professional Conclusion remain useful underneath the conversational model. Its five-stage composition no longer governs the product surface. Its independent static pages, fictional legal examples, confidence percentages, remote dependencies, and nonfunctional controls must not enter production.

---

## 8. Tool disposition

No current user data or tool should be deleted in the first release.

| Current tool or concept | Target disposition | Default visibility |
| --- | --- | --- |
| Projects | Promote to direct global navigation and Project/Code Decisions index | Primary |
| Search | Keep as code discovery; surface results as candidate evidence in Research when question-scoped | Primary in Code Library; contextual in Research |
| Reader | Keep as the authoritative source-reading and candidate-inspection surface | Primary in Code Library; contextual in Research |
| Saved evidence | Preserve as Saved; allow lightweight suggestion/proposal into a Code Decision while preserving Project and unassigned views | Primary as Saved; contextual in Research |
| Research | Make the primary conversational Project working surface; orchestrate the existing selected-evidence engine and governed Code Decision commands | Primary |
| Internal Code Question workspace | Repurpose as the Code Decision trust layer and advanced detail surfaces; do not duplicate it | Under Research / progressively disclosed |
| Coordination | Present as contextual Review Requests and an optional cross-Project Reviews inbox; reuse existing threads/comments | Contextual / optional |
| Report Draft | Use internally for the question-specific Code Memo Draft; keep generic/advanced Report Draft under More | Primary only through Create Code Memo |
| Reports | Present as issued Code Memos/records and Versions | Project / Code Decision |
| Notebook | Rename or describe as Working Notes; link cards to Code Decisions when useful | Add column / More |
| Workboard | Keep as an optional Project Diagram/Workboard; never make it the main Project surface | Add column / More |
| Activity | Present as passive History/Audit, not a task-management replacement | Code Decision details / More |
| Zoning Resolution button | Move into Code Library source-family navigation and filters | Contextual |
| Reset / Close All / saved layouts | Consolidate in Layout menu | Secondary |
| Legacy unassigned Research/Saved/Reports | Preserve in a discoverable Legacy or Unassigned view and allow explicit linking to a Code Decision | Secondary during migration |

Deletion may be considered only after migration telemetry, user interviews, export coverage, and at least one stable release prove that a tool is redundant. Hiding is reversible; destructive deletion is not.

---

## 9. Canonical domain model

### 9.1 Relationship model

```mermaid
flowchart LR
    P["Project"] --> S["Research Conversation"]
    S --> Q["Code Decision (internal Code Question)"]
    Q --> I["Question Inputs"]
    Q --> E["Versioned Evidence Set"]
    E --> A["Immutable Analysis Run"]
    I --> A
    A --> C["Professional Conclusion"]
    E --> C
    C -. "optional/contextual" .-> R["Review Requests"]
    R -. "blocking requests gate approval or issuance" .-> G
    C --> G{"Separate conclusion approval required by policy?"}
    G -->|"yes"| CA["Conclusion Approval"]
    CA --> D["Code Memo Draft"]
    G -->|"no"| D
    D --> MA["Readiness and Code Memo Approval"]
    MA --> X["Immutable Issued Record"]
    X --> X2["Superseding Issued Version"]
    N["Working Notes"] -. link .-> S
    W["Workboard"] -. link .-> Q
```

### 9.2 Code Decision and internal Code Question

Use **Code Decision** in the user interface. Preserve the first-class Project Foundation artifact named `codeQuestion` and related internal names where they are already integrated. A backend rename is not required for the UX redesign and must not be attempted without a separate compatibility/migration plan.

Minimum fields:

- stable internal ID;
- Project-scoped human display ID, such as `Q-001`;
- `projectID`;
- concise title;
- precise question text;
- optional scope and desired decision/output;
- jurisdiction and governing/as-of dates where known;
- responsible professional, assignee, and reviewer references;
- record state: active or archived;
- current definition revision;
- current Evidence Set version;
- current selected analysis ID;
- current conclusion revision;
- current review-round and approval references;
- latest Issued Record ID, if any;
- created/updated actors and timestamps;
- optimistic `expectedVersion`;
- archive metadata.

Project membership and authorization remain Project-level. Responsible-person, assignee, and reviewer references do not create a Question-level access-control list.

The prior selected Define/Evidence/Analyze/Review/Issue stage may remain readable as legacy per-user workspace state during migration, but it no longer governs the primary UI. Shared readiness, review, approval, and issuance states belong to their respective versioned records and are derived for display. A decision may legitimately have Issued Record v1 while a new working revision is in progress; do not force both facts into one canonical status value. Derive simple visible labels—Working, Final, Issued, Needs Review, Changed, and Missing Information—from the underlying records.

Allocate `Q-001`-style display IDs transactionally and enforce uniqueness within a Project. Never derive them by reading the current maximum and writing the next value without a lock or unique retry.

### 9.2.1 Research conversation projection

Research conversations and Code Decisions must not become parallel systems of record. A Project Research session may link to one current Code Decision and may contain exploratory messages that never enter the governed record. Permitext should progressively propose structured updates from the conversation:

- question/title refinements;
- Project Fact candidates;
- explicit Assumptions;
- Missing Information/unknowns;
- candidate evidence suggestions;
- analysis requests and immutable Research answers;
- draft Professional Conclusion content.

Each proposal must have a defined disposition. Low-risk clerical extraction may prefill a draft; professional claims and trust transitions require the applicable confirmation or server command. Rejected evidence and discarded exploratory ideas remain available in conversation/audit history but do not enter approved model context or issued output.

The Code Decision is a governed projection assembled from canonical artifacts and links, not a mutable summary blob that can overwrite them. Conversation messages may reference artifact IDs and immutable versions. Issuance resolves the canonical artifacts, never the latest prose visible in a chat bubble.

### 9.3 Question inputs

Add a first-class `questionInput` artifact or an equivalently granular child-record contract. Do not store critical inputs as undifferentiated prose.

Each input needs:

- stable ID and parent Code Question ID;
- kind: `confirmedFact`, `assumption`, or `unknown`;
- statement;
- state: proposed, confirmed, disputed, resolved, or retired as applicable;
- basis/source, if any;
- responsible person;
- created/updated actor and time;
- revision and prior value lineage;
- optional anchored Review Request references.

Rules:

- An assumption must never be visually rendered as a confirmed fact.
- An unknown may block approval or issuance based on policy.
- Any semantic input change marks dependent analyses and approvals stale; presentation-only metadata exceptions must be explicitly enumerated.
- Issuance snapshots the exact input versions; later edits do not change the prior record.
- Only explicitly selected, versioned `questionInput` snapshots may enter Bounded Analysis. Working Notes, review comments, Workboards, Report text, templates, disclaimers, and general Project prose must never become hidden or authoritative model context.

### 9.4 Approved evidence and Evidence Sets

Generalize the current Research-time evidence snapshot into an independently persisted version-2 evidence snapshot, or embed the complete immutable snapshot in each Evidence Set. Do not assume the current Research-answer snapshot already exists as a reusable pre-analysis artifact. Prefer a reusable `evidenceSnapshotV2` whose content hash covers canonical source identity, exact passage text, locator, structured grid/visual material, and source version—but excludes Evidence Set number, approval, role, and rationale metadata.

Keep evidence proposals and review disposition separate from immutable approved `questionEvidenceSet` versions. A proposal may be proposed, verification-blocked, approved, rejected, or excluded. Rejected/excluded items remain in audit history but do not enter the approved set.

Each Evidence Set entry needs:

- version-2 evidence snapshot ID or complete embedded immutable snapshot;
- exact source identity and passage locator;
- quoted text and text hash;
- structured table/grid or visual snapshot when relevant;
- role: governing, supporting, or conflicting;
- analysis-eligibility and any explicit qualification;
- professional note/rationale;
- approval actor and time;
- source verification state at approval;
- Project applicability note, kept separate from source verification.

Rules:

- A bookmark, search result, or Saved section is not approved evidence.
- For an Editor, **Add as Evidence** creates a clearly labeled proposal. A Reviewer or Owner approval creates/reuses the immutable passage snapshot and adds it to a new Evidence Set version. An authorized solo Owner may propose and approve in an explicit combined flow.
- Only explicitly approved and analysis-eligible entries enter model input. Verification-blocked material requires a defined approval/qualification rule or remains excluded from analysis.
- Removing evidence creates another version; it does not alter a set used by an existing analysis or issued record.
- The UI must show source drift, edition mismatch, incomplete context, and conflicting evidence before analysis or issuance.

### 9.5 Analysis Run

Do not build a second AI system. Reuse the current selected-evidence Research pipeline, conversation infrastructure, and immutable Research answer, but invoke governed analysis through the question-bound server command. That command must resolve the exact question revision, selected Question Input snapshots, and Evidence Set on the server, then atomically create the Research answer and analysis descriptor. It must not rely on mutable conversation selections or live general Project context after validation.

Add `questionAnalysis` as a lightweight immutable descriptor/link containing:

- Code Question ID;
- question definition revision and hash;
- exact Question Input snapshot/version IDs and Input Set hash;
- exact Evidence Set ID, version, and hash;
- canonical dependency hash;
- existing immutable Research answer ID;
- model and analysis-policy identifiers;
- prompt/template version;
- requested/created actor and time;
- idempotency/request ID;
- citation/dependency validation result.

The generated conclusion, explanation, citations, assumptions, missing facts, limitations, and additional-evidence needs remain only in the existing immutable Research answer. The question-analysis descriptor references that answer; it must not copy the generated output or later mutate to add a stale reason/successor.

Compute staleness by comparing the run’s immutable dependency hash with the current dependency hash. The canonical dependency hash must cover the precise question/scope/jurisdiction/as-of content, every selected active Question Input ID/kind/state/text/revision, and the Evidence Set ID/version plus snapshot content hashes, roles, qualifications, and eligibility. Exclude only enumerated presentation metadata such as Project color, pane layout, timestamps, and assignee display. Store current selection or successor relationships on the question or as append-only events.

Analysis rules:

- The model may reason only from approved analysis-eligible evidence and explicitly selected Question Input snapshots.
- It must distinguish confirmed facts from assumptions and unknowns.
- It must refuse or qualify conclusions when evidence is insufficient.
- It must not import uncited search results, model memory, or invented Project facts.
- It must never approve itself.
- Any dependency-hash change marks the run stale.
- AI is optional. A professional may proceed from approved evidence directly to a human-authored conclusion, review, and issuance without spending an allowance or creating an Analysis Run.

### 9.6 Professional Conclusion

Add a `professionalConclusion` artifact with explicit revisions.

Each published conclusion revision is immutable and must contain:

- Code Question ID;
- exact question-definition revision and hash;
- exact Question Input Set IDs/revisions and hash;
- exact Evidence Set ID/version/hash;
- optional Analysis Run ID and dependency hash;
- authored conclusion;
- reasoning/conditions;
- citations to approved evidence;
- disclosed assumptions and unresolved unknowns;
- author and revision timestamps;
- AI-assistance disclosure where required by policy;
- predecessor revision ID.

An editable working draft may autosave, but approval must target one published immutable conclusion revision. Editing after approval creates a new revision and invalidates the prior approval for current issuance; it does not modify the approved revision. Store approval and supersession as separate versioned records/events rather than fields that rewrite an immutable revision.

The UI must keep **AI Analysis** and **Professional Conclusion** visually and semantically separate. Copying or adapting an analysis into the conclusion is an explicit authored action with attribution.

### 9.7 Review Requests

Evolve `reviewThread` and `reviewComment`; do not create a parallel collaboration store.

Review is optional/contextual in presentation, never optional when an applicable policy or unresolved blocking request requires it. A user who does not need a separate reviewer should not be forced through a Review tab. The server must still enforce role, approval, and blocking-request rules for every consequential action.

User-facing request types:

- Fact Request;
- Evidence Review;
- Interpretation Review;
- Revision Request.

Compatibility mapping:

- Fact Request uses the existing `missing-project-fact` kind plus a versioned `requestType: fact-request`;
- Revision Request uses the existing `revision-request` kind plus `requestType: revision-request`;
- Evidence Review and Interpretation Review initially retain the existing `general-review` kind and add `requestType: evidence-review` or `interpretation-review`;
- preserve current internal identifiers and add v2/v3 adapters so old clients do not reject or coerce an unknown `kind`.

Extend review targets to include:

- Code Question;
- Question Input;
- approved evidence or Evidence Set entry;
- Analysis Run;
- Professional Conclusion;
- Code Memo Draft.

Preserve stored statuses `open`, `waiting`, `resolved`, and legacy `dismissed`, plus assignment, actors, dates, immutable comments, and append-only activity. **Reopen** is an action that transitions a resolved/dismissed thread back to `open` and records a reopen event/review-round increment; `reopened` is not a stored status. History remains passive; it is not a second coordination system.

### 9.8 Code Memo Draft and Issued Record

Reuse `reportDraft`, `reportManifest`, generated Report files, exact source materialization, and hashing.

The ordinary output path begins with a single visible **Create Code Memo** action on a sufficiently complete Code Decision. Underneath, that action prepares a constrained question-specific **Code Memo Draft** with:

- Project and question identity;
- prepared date and draft revision;
- question presented;
- Project inputs;
- governing and supporting evidence;
- bounded analysis summary, if selected;
- professional conclusion;
- assumptions, unknowns, limitations, and conditions;
- review/approval summary;
- citations and source appendix.

Use a typed Report Draft v2 such as `recordType: codeDecisionMemo` with `questionID` rather than inventing an unrelated editor. The current draft-v1 normalizer strips unknown fields, so add explicit v1→v2 adapters and never rewrite stored v1 payloads. Keep the advanced generic Report Draft available under More.

Create Report Manifest v3 for Code Questions. It must add the question snapshot, Evidence Set/snapshot identities, approval, evidence roles/qualifications/applicability, conclusion revision, and issue lineage while retaining v1/v2 readers. Never mutate stored Manifest v1/v2 payloads.

Add an immutable `issuedDecisionRecord` wrapper that references the immutable Report Manifest and generated files, and preserves:

- exact component versions and hashes;
- issue number/version;
- status: Issued or Superseded;
- issuing actor and approval basis;
- predecessor and successor IDs;
- correction/supersession reason;
- structured semantic manifest for web/iOS parity.

Issuance must be a server-authorized, transactionally coordinated operation. It must not reuse a check-then-write version allocator that can create duplicate versions or orphaned files. A correction creates a new version and can mark the prior version Superseded; the prior record remains readable subject to lawful account-deletion and retention rules.

Because Blob/object storage cannot participate in a Postgres transaction, implement issuance as an idempotent saga:

1. Authorize, validate dependencies, and bind an idempotency key.
2. In a database transaction, reserve the question-local issue version and a pending issuance record using uniqueness constraints.
3. Generate deterministic content/hashes and upload to a deterministic staged object key with retry-safe semantics.
4. In a database transaction, save/confirm Manifest v3, the issued wrapper, links, and activity, then mark the pending record issued.
5. Publish or resolve the deterministic object reference.
6. Retry safely with the same key or clean abandoned staged objects through a recovery job.

A failure at any point must leave no visible half-issued record. The approved draft remains unissued, and retry resumes or reconciles the same pending operation.

Keep version scopes explicit and separately constrained:

- Project-scoped Code Question display sequence: `(projectID, questionNumber)`;
- question-scoped Evidence Set version: `(questionID, evidenceSetVersion)`;
- existing Project/report sequence where required by Report Manifest history;
- question-scoped issued version: `(questionID, issueVersion)`;
- predecessor/successor identity for supersession, independent from the Project report sequence.

The internal issuance state model remains:

> **Draft → Ready for approval → Approved → Issuing → Issued → Superseded**

The user-facing **Final** state may appear before issuance when the current Professional Conclusion is finalized against current dependencies. **Record locked**, immutable styling, and **Issued** must not appear before the server confirms successful issuance. A failed issue command returns to a clearly unissued Final/Approved state with a durable error and safe retry; it must not leave a half-issued visual or orphaned version.

The ordinary UI should translate that machinery into plain, contextual messages such as **Ready to create Code Memo**, **Needs review before memo**, **Approved — issuance failed; retry**, and **Issued**. Advanced readiness and lineage details remain available without making the professional manually navigate every internal state.

### 9.9 Activity and audit

Reuse append-only Project activity for meaningful professional events:

- question created or archived;
- input confirmed, disputed, or materially revised;
- evidence approved, removed, or found stale;
- analysis generated or marked stale;
- conclusion revised or approved;
- Review Request opened, assigned, resolved, or reopened;
- record issued or superseded;
- migration/promote action completed.

Do not record keystrokes, scroll events, pane resizing, routine sync noise, or every autosave as professional activity.

### 9.10 Canonical transition rules

The implementation and tests must use these transitions. User-facing summary labels may combine them, but storage must not collapse them into one mutable “workflow status.”

| Record | Transition | Authorized actor | Preconditions and effect |
| --- | --- | --- | --- |
| Code Question | nonexistent → active | Owner or Editor | Allocate stable ID and transactionally unique Project question number; create first definition revision |
| Code Question | active → archived | Authorized Owner/Editor | Hide from normal active list; preserve all links and issued history; no cascading delete |
| Code Question | archived → active | Authorized Owner/Editor | Restore without changing historical versions |
| Evidence proposal | proposed → approved | Reviewer or Owner | Verify source/eligibility; create/reuse immutable snapshot and a new approved Evidence Set version |
| Evidence proposal | proposed → rejected / verification-blocked / excluded | Reviewer or Owner | Preserve proposal/disposition in audit; do not place it in model input |
| Evidence Set | vN → vN+1 | Reviewer or Owner | Add/remove/reclassify approved entries; preserve vN; dependency hash changes and prior analysis/approval becomes stale |
| Analysis Run | nonexistent → immutable run | Owner/Editor with Research capability | Server resolves exact dependencies and allowance; create Research answer + descriptor atomically; run never mutates |
| Conclusion | working draft → immutable revision | Owner or Editor | Bind exact definition/Input/Evidence/optional Analysis hashes; later edits create another revision |
| Conclusion approval | unapproved revision → approved revision | Reviewer or Owner | All blocking review/readiness rules pass; approval targets one immutable revision |
| Conclusion | approved revision → newer working/revision | Owner or Editor | Preserve prior approval historically; current working revision is unapproved and cannot reuse that approval |
| Review Request | open ↔ waiting | Authorized assignee/reviewer/editor | Record actor/time and response expectation |
| Review Request | open/waiting → resolved or dismissed | Authorized reviewer/assignee under policy | Preserve immutable comments and resolution event |
| Review Request | resolved/dismissed → open | Authorized Reopen action | Store `open`, append reopen event, increment review round; never store `reopened` |
| Code Memo | Draft → Ready for approval | Owner or Editor | Current dependencies validate and every blocker is resolved; no issue date exists |
| Code Memo | Ready → Draft | System or editor | Any governed content change or failed readiness invalidates Ready state |
| Code Memo | Ready → Approved | Reviewer or Owner | Approval binds exact Draft v2/Manifest-input hashes and conclusion revision |
| Code Memo | Approved → Issuing | User with issue capability | Server revalidates permission/dependencies and begins one idempotent issuance saga |
| Code Memo | Issuing → Approved | System failure/recovery | Durable failure is shown; no Issued Record is published; same idempotency key may retry |
| Code Memo | Issuing → Issued | Server | Saga commits Manifest v3, issued wrapper, links, activity, and resolvable file |
| Issued Record | Issued → Superseded | Server when a later issue succeeds | Prior record remains immutable/readable; link successor and reason |

Readiness rules must classify unresolved information as one of:

- **Blocker** — issuance cannot proceed;
- **Disclosed limitation** — an authorized professional accepts and exposes the uncertainty in the conclusion and memo;
- **Accepted condition** — the conclusion is expressly conditional on the stated fact/event and the record preserves that condition.

AI is never a transition prerequisite. An approved human conclusion may proceed without an Analysis Run.

---

## 10. Source provenance and evidence eligibility

Evolve `code-trust-contract.mjs` additively to a richer provenance contract. Existing version-1 profiles need a compatibility adapter.

Each canonical source package should be able to express:

- stable source identity;
- jurisdiction and issuing authority;
- source family and legal class;
- edition, publication, adoption, effective, repeal, and applicability dates;
- current-through date;
- enacted, proposed, future-effective, historical, explanatory, agency-guidance, incorporated-standard, or publisher-editorial status;
- official source URL and archived-source hash;
- text/extraction hash and extraction date;
- completeness and known missing artifacts;
- verification actor, date, method, and status;
- rights/licensing constraints;
- Search, Reader, Evidence, Analysis, and Issuance eligibility;
- required warnings or boundary language.

Adding a metadata class does not authorize ingestion, copying, display, Evidence eligibility, or AI use. Existing corpus exclusions and source-rights review remain controlling, especially for agency guidance, incorporated standards, and publisher editorial material.

The UI may use semantic status colors, but color alone is insufficient. Use labels such as:

- Verified official source;
- Verification required;
- Historical / not current;
- Explanatory only;
- Not eligible as governing evidence.

Do not use numeric “reliability” or “confidence” percentages for legal authority. Do not claim “official,” “complete,” “verified,” or “compliant” unless the stored provenance supports the exact claim.

Source verification and Project applicability must be shown separately:

- **Source verification:** Is this text authentic, complete, and correctly versioned?
- **Project applicability:** Does this provision govern this Project, date, occupancy, scope, and condition?

---

## 11. Web architecture plan

### 11.1 Preserve the workspace engine

Extend, do not replace:

- the existing pane registry;
- persisted pane widths and order;
- scroll and filter restoration;
- named workspace/layout state;
- resize and reorder behavior;
- Project color propagation;
- Project-switch cleanup and stale-state protections.

Each question-scoped pane key must include both Project ID and Code Question ID. State normalization must close or rebind panes that no longer belong to the active Project/question. Old saved layouts must continue to normalize safely.

### 11.2 Contracts

Create:

- `permitext-sync-server/code-question-contract.mjs` — normalization, validation, lifecycle/readiness derivation, immutable snapshot composition, migration adapters, and deterministic IDs where needed;
- focused contract tests for all new record types and transitions.

Extend additively:

- `project-foundation-contract.mjs` — new artifact and target kinds, conflict policies, activity actions, and compatible transport support;
- `collaboration-contract.mjs` — versioned `requestType`, question-level targets, and legacy kind/status adapters;
- `report-contract.mjs` — Report Draft v2, Manifest v3, typed Code Memos, and issued-record lineage without mutating prior manifests;
- `code-trust-contract.mjs` — provenance version 2 and version-1 adapters;
- organization capability contracts — edit, approve, review, issue, and supersede permissions.

Unknown new records must remain safe for older clients under preserve-and-ignore behavior. That policy alone is insufficient for new fields/enums inside a known artifact, so maintain frozen released-web and released-iOS decode fixtures, gate new serialization/commands by authenticated rollout eligibility and client capability, and test one shared Project edited by old and new clients before opt-in.

### 11.3 Storage and concurrency

Reuse the existing generic Project Foundation artifact/link/activity substrate for payloads and relationships where it preserves the current model. Do not defer correctness constraints to later profiling. Phase 0 must choose and document dedicated counters/tables, transactional locks, or equivalent database constraints for Project question numbers, Evidence Set versions, idempotency, pending issuance, and question issue versions before Phase 1.

Required guarantees:

- additive schema changes only during rollout;
- explicit `expectedVersion` optimistic concurrency, matching the repository convention;
- atomic compare-and-swap inside the storage adapter/database write rather than handler-level read/check/write;
- unique version constraints for Evidence Sets and Issued Records;
- the issuance saga and staged-file recovery defined in Section 9.8;
- idempotency keys for analysis, migration, and issuance commands;
- atomic local mutation plus outbox insertion before any iOS mutation capability is enabled;
- retry-safe commands and deterministic migration IDs;
- no cascading deletion of independently owned canonical or authored artifacts when a question is unlinked or archived.

Project Foundation artifacts are not automatically covered by the current general `/sync/push` and `/sync/pull` mutation set. Phase 0 must make an explicit offline transport decision. The recommended design is:

- canonical question commands remain server-authorized and idempotent;
- local IndexedDB/SQLite stores the last confirmed Question artifacts and working drafts;
- extend the shared change feed for incremental Question-artifact pull;
- use a dedicated idempotent Question-command outbox, or deliberately extend the existing mutation-kind outbox with equivalent conflict semantics;
- keep this outbox as transport, not a second domain store;
- require authoritative online validation for approval and issuance.

Do not claim offline support merely because generic Foundation JSON exists locally. Prove cold reload, queued command replay, `expectedVersion` conflict handling, permission changes, and rollback with pending new-client commands.

### 11.4 Server endpoints

Add question-oriented handlers using the repository’s established authentication, organization, Project Foundation, error, and sync conventions. The exact route names may follow the active server style, but the capabilities must cover:

- list/create/read/update/archive internal Code Questions exposed as Code Decisions;
- link/unlink a Project Research conversation and its Code Decision without duplicating either record;
- propose structured Question/Input/evidence updates extracted from conversation, with explicit disposition and idempotency;
- create/update/confirm/dispute Question Inputs;
- approve/remove evidence and create Evidence Set versions;
- generate/list/select question-bound analyses;
- create/revise professional conclusions;
- open/respond/resolve/reopen Review Requests;
- prepare/validate/approve/issue/supersede Code Memo records;
- migrate/promote legacy artifacts;
- retrieve full immutable lineage.

Do not add parallel endpoints that reproduce current Research, Notebook, report, or collaboration storage. Research and question handlers should call the existing subsystems and create explicit links. Governed analysis must continue through the question-bound server command even when initiated from a conversation.

### 11.5 Web client modules

The existing `public/app.js` is large. New behavior should be placed in bounded modules where the current build/runtime permits, with `app.js` acting as orchestrator rather than receiving another monolithic feature block.

Suggested modules:

- `public/code-question-state.js`;
- `public/code-question-contract.js` or a browser-compatible shared build;
- `public/question-workspace.js` (internal Code Decision orchestration);
- `public/research-code-decision.js` (conversation-to-governed-record adapter, not a second store);
- `public/question-evidence.js`;
- `public/question-review.js`;
- `public/question-issue.js`.

Module names are recommendations, not requirements. Avoid a broad refactor unrelated to the feature. Prefer incremental migration of the existing five-stage implementation: retain its tested domain helpers and server commands, repurpose its panes as Code Decision sections or advanced details, and remove obsolete stage chrome only after the Research surface reaches equivalent access. Preserve current startup, offline shell, service-worker cache, and versioned-client behavior.

### 11.6 Accessibility and responsive behavior

At minimum:

- meet WCAG 2.2 AA for the authenticated web application and generated HTML/PDF output;
- identify the active Code Decision and contextual status without requiring step semantics; any temporary legacy stage control must remain accessible while it exists;
- give navigation and all icon-only controls accessible names, while hiding decorative icon glyphs from assistive technology;
- give all inputs associated programmatic labels, semantic field groups, inline error associations, and an error summary for failed submission;
- pane headings and landmarks need coherent semantics;
- active decision, active pane, review status, changed state, missing information, and selected evidence need non-color state;
- hover-only actions must also work by keyboard and touch;
- focus must be restored when a pane opens/closes or a dialog completes;
- dialogs and drawers must trap focus appropriately and make the obscured background inert;
- resize/reorder needs the keyboard and single-pointer alternatives defined in Section 7.5;
- hidden scrollbars must not conceal that legal text is scrollable;
- visible keyboard focus must not be obscured by sticky UI;
- forced-colors/high-contrast mode, text spacing, and 200%/400% zoom must remain usable;
- primary touch targets should be at least 44×44px where practical;
- legal text must retain semantic headings, lists, tables, captions, and header cells;
- reduced-motion preferences must be honored;
- 1440px, 1180px, tablet, and zoomed desktop states require rendered verification.

---

## 12. iPhone/iOS plan

Do not reproduce the full desktop column editor on iPhone.

The iPhone experience should be an adapted Project Hub with:

- Project and Code Decision lists;
- derived Working/Final/Issued plus contextual Needs Review/Changed/Missing Information state;
- read-only Research conversation and Code Decision continuity in the first compatibility slice;
- limited conversational fact/assumption/missing-information confirmation only in a later mutation slice and only where role/capability permits;
- approved Evidence Set reading and source trust cues;
- read-only Analysis summaries;
- professional conclusion review and comments;
- Review Request reading, followed later by response/resolution when mutation safety is proven;
- Code Memo preview, issue status, versions, and secure download;
- Working Notes access;
- flattened Workboard preview rather than full Excalidraw editing initially;
- offline reading, with edit queueing added only for explicitly enabled artifact/command types.

Web and iOS must share:

- IDs and version identity;
- semantic content and ordering;
- exact Evidence Set and citation identities;
- status and review transitions;
- Report Manifest and Issued Record lineage;
- permission results;
- source verification and uncertainty cues.

The iOS future phase must not be built around reproducing five stage tabs. It should follow the same Research → Code Decision → Code Memo hierarchy, with role-appropriate compact views and progressively disclosed record sections.

Split iOS delivery into two gates:

1. **Compatibility gate before web rollout:** update decoders, local schema, sync preservation, read-only rendering, and mixed-version fixtures so new records cannot be discarded or corrupted.
2. **Mutation gate after compatibility:** enable limited Fact Request responses/resolution or Define edits only after server authorization, atomic local mutation/outbox insertion, `expectedVersion` conflicts, offline retry/recovery, and physical-device behavior are proven.

Do not imply full semantic editing parity is already approved. Test mixed-version clients and shared Projects explicitly.

---

## 13. Migration and backward compatibility

### 13.1 Migration policy

Schema/bootstrap migration must be additive, deterministic, idempotent, checkpointed, observable, and reversible at the UI level. User-content promotion is a separate, explicit command workflow; do not create Code Questions from notes, Research, or Reports as a side effect of reading `projectFoundationState`.

Never:

- delete legacy Notebook, Saved, Research, Report, Workboard, or Coordination records;
- rewrite immutable Research answers, evidence snapshots, Report Manifests, or comments;
- silently treat Saved bookmarks as approved evidence;
- guess that a Notebook question card is an authoritative Code Question;
- invent facts to complete a migrated question;
- collapse distinct artifact types into one generic record;
- require all old content to fit a fake “Legacy Project Research” question.

### 13.2 Promotion instead of guessing

Provide explicit actions such as:

- **Create Code Question from this note**;
- **Link to Code Question**;
- **Add selected passage as Evidence**;
- **Use this Research answer in a Code Question**;
- **Prepare Code Memo from this Report Draft**.

These actions preserve every source artifact and source ID, create a distinct new Code Question ID, and record a provenance link between them. Copy content only when an immutable snapshot or explicit authored starting point is required; never reuse the source ID as the question ID.

### 13.3 Automatic migration eligibility

Automatic schema/bootstrap migration may normalize records created by an earlier Code Question schema version. Automatic association of user content is allowed only when an earlier feature version already stored an explicit stable Question relationship and the adapter validates it. A shared Project ID, similar title, nearby timestamp, or overlapping evidence is not sufficient.

Ambiguous records remain in Legacy/Unassigned views and are counted, not guessed.

### 13.4 Checkpoints and reporting

Use the existing checkpointed migration pattern for schema/bootstrap work. Record user-triggered promotions as separate idempotent professional activity/command results. For both, record:

- migration version;
- started/completed time;
- deterministic source and target IDs;
- migrated count;
- already-current count;
- skipped count and reason;
- ambiguous count;
- failed count and recoverable error;
- last successful checkpoint;
- client/server versions.

Restarting a schema migration or retrying a promotion command must not create duplicate questions, links, Evidence Sets, or issued versions.

### 13.5 Feature flag and rollback

Introduce a server capability and internal feature flag such as `permitext:codeQuestionWorkspace`.

Rollout sequence:

1. Contracts and storage available, UI off.
2. Internal accounts and synthetic fixtures.
3. Selected real Projects with explicit opt-in and eligible client versions.
4. New Projects default to Research and Code Decisions; legacy tools remain available.
5. Existing Projects receive guided promotion tools.
6. Default navigation changes only after parity and recovery are proven.

Rollback disables the new UI and creation commands, pauses new-client outbox replay safely, and preserves queued intent for a compatible retry/recovery path. Because storage changes are additive, existing artifacts and new question records remain intact. Preserve-and-ignore applies to unknown records, but compatibility fixtures must separately prove that older clients do not coerce new fields inside known records. Never roll back by deleting migrated records.

---

## 14. Phased implementation plan

The phases below are sequential gates, not calendar estimates. Several test-writing and visual-design tasks can run in parallel after their governing contracts are stable.

### 14.0 Status terminology used by this ledger

To prevent rendered prototype evidence from being mistaken for production-system evidence, the progress ledger uses these distinct states:

- **UI/domain prototype complete** means the branch contains the intended interface, pure domain contracts, fixtures, adapters, or local render behavior and the cited tests passed for that scope.
- **Server integration complete** means the visible workflow hydrates from and mutates the authoritative server record, authenticated Project access determines role and storage ownership, offline replay uses the same commands, and a clean session reconstructs the same record.
- **Exit gate passed** means every requirement listed in that phase's exit gate has current evidence, including authorization, persistence, isolation, concurrency, cross-client, accessibility, recovery, or deployment evidence where applicable.
- **Pilot-ready** is reserved for the later Phase 10 decision after Phase 5A, all applicable exit gates, policy reviews, real permissioned lifecycle verification, and rollback rehearsal pass. No current branch status carries that claim.

### Phase 0 — Baseline, safety rails, and executable specification

**Goal:** Establish a trusted pre-change baseline and make the target behavior testable.

Tasks:

- Recheck branch, HEAD, worktree, active Project render path, and deployed-client status.
- Inventory current Project, Saved, Research, Notebook, Coordination, Report, Workboard, sync, permission, and iOS behaviors.
- Reverify old defect reports against current HEAD; do not assume historical findings remain current.
- Add the feature/capability flag with no visible behavior change.
- Define versioned synthetic fixtures for one complete Research-to-Code-Decision lifecycle. Every rendered conversation, Code Decision section, contextual Review, and Code Memo view must use the same internal Code Question ID and coherent version chain rather than unrelated hard-coded examples.
- Define a separately verified legal-content fixture for rendered acceptance tests; do not use Stitch’s fictional provisions as authority.
- Create a Stitch visual-adoption matrix with explicit Keep, Adapt, and Reject decisions. Preserve only useful pane relationships as contextual Research/Code Decision arrangements, not as retained stage layouts; reject direct import of its duplicated shells, palette, radii, border-heavy styling, Tailwind tokens, AI Reader highlighting, avatars, remote assets, reliability percentages, and fictional legal content. Reconcile every adopted visual token with the active Permitext CSS before Phase 2.
- Capture baseline workspace, offline, sync, Research, report, and Project-switch tests.
- Freeze representative released-web and released-iOS decode/round-trip fixtures for mixed-client testing.
- Write architectural decision records for artifact granularity, dedicated counters/uniqueness, atomic `expectedVersion` compare-and-swap, offline Question transport/outbox, the issuance saga and staged-file recovery, Report Draft v2/Manifest v3 adapters, permission mapping, and URL/pane identity.

Likely files:

- `permitext-sync-server/package.json`
- `permitext-sync-server/tests/`
- capability/organization contracts
- test fixture directories
- no production UI changes beyond a disabled flag.

Exit gate:

- current targeted and full baseline checks pass;
- fixtures contain no unverified legal claim presented as production truth;
- storage/counter, offline transport, report-version, mixed-client, and issuance-saga decisions are explicit and testable;
- feature is completely inert when disabled;
- implementation branch and intended file scope are cleanly documented.

### Phase 1 — Code Question contracts, storage, permissions, and migrations

**Goal:** Introduce the domain model without changing the primary UI.

Tasks:

- Add `code-question-contract.mjs` and tests.
- Add Code Question, Question Input, evidence-snapshot v2, Evidence Set, question-analysis descriptor, Professional Conclusion, and Issued Decision Record artifact kinds.
- Extend Project link targets, activity actions, conflict policies, and sync record handling.
- Extend collaboration `requestType`/targets compatibly while retaining legacy kinds and stored statuses.
- Add Report Draft v2 and Manifest v3 with backward readers/adapters.
- Add permission capabilities for edit, evidence approval, review, conclusion approval, issue, and supersede.
- Add server handlers and local adapters.
- Add dedicated uniqueness/counter guarantees, atomic compare-and-swap, idempotency, pending-issuance state, and staged-file recovery.
- Implement the chosen Question change-feed/outbox transport behind the disabled capability.
- Add checkpointed, no-op-by-default migration scaffolding.
- Update iOS decoders to preserve unknown/new records before shared rollout.

Exit gate:

- contract tests cover every valid and invalid state transition;
- concurrent mutations return explicit conflicts instead of losing edits;
- migration reruns are idempotent;
- frozen old clients preserve/ignore unfamiliar records and do not coerce new fields in known records;
- no legacy artifact is modified or deleted;
- disabled UI behaves exactly as before.

### Phase 2 — Project, Research, and Code Decision workspace shell

**Goal:** Make Project → Research → Code Decision clear while preserving column mechanics and the existing governed record.

Tasks:

- Promote Projects to direct navigation.
- Add Project **Code Decisions** index with search, filter, simplified derived state, responsible professional, and recent activity.
- Add create/start Research, rename, archive, restore, and open actions subject to permission. Defer duplication until explicit copy semantics are separately approved.
- Make Research the primary open action and show the structured Code Decision as its governed companion record.
- Supersede the five-stage selector. Use contextual actions and Add column/More for Reader, review, history, lineage, and supporting tools.
- Use one shared shell for all arrangements; opening contextual panes may only change view state, never shared professional state.
- Add question-scoped pane identities and workspace-state normalization.
- Add stable Project/decision/research deep links and browser-history restoration without duplicating pane state.
- Preserve active Project color across all Project/question panes.
- Move Notebook, Workboard, advanced Report Draft, attachments, and legacy content into More/Add column.
- Keep a clear Legacy/Unassigned path during migration.
- Ensure Project or question switching cannot leak content or flash the workspace empty.

Exit gate:

- existing saved layouts still load or normalize safely;
- open/close/reorder/resize/scroll state survives reload;
- switching Projects replaces all Project-owned context;
- switching decisions replaces all decision-owned Research and governed context;
- there is one visible Workboard for the selected Project;
- no old record becomes undiscoverable.

### Phase 3 — Governed Question and Project Inputs

**Goal:** Keep the question and Project inputs precise, governed, and reviewable underneath conversational Research.

Tasks:

- Retain the tested Definition/Input contracts and repurpose the Definition column as a progressively disclosed Code Decision section or advanced editor.
- Allow Research to propose question refinements, Project Facts, Assumptions, and Missing Information without silently changing classifications.
- Add concise title, precise question, scope, jurisdiction/as-of context, and desired output.
- Add structured Confirmed Facts, Assumptions, and Unknowns.
- Add stable input IDs, revision history, state, responsible person, and basis.
- Add anchored Fact Requests and change indicators.
- Derive readiness without silently changing shared review/approval/issue state.
- Mark dependent analyses, conclusions, approvals, and drafts stale after any canonical dependency-hash change.

Exit gate:

- facts, assumptions, and unknowns cannot be visually confused;
- revisions and actors are reconstructable;
- conflict and offline queue behavior is proven;
- unresolved required unknowns block approval/issuance according to policy;
- the Code Decision renders these inputs read-only correctly for Viewer/Reviewer roles without requiring them to open a Define stage.

### Phase 4 — Conversational evidence discovery and approval

**Goal:** Deliver Question → suggested evidence → professional confirmation → bounded analysis with the existing evidence trust model intact.

Tasks:

- Surface candidate suggestions inside Research and open Reader contextually for exact-text inspection; retain the tested Candidates/Reader/Evidence Tray surfaces as advanced details during migration.
- Scope Search and AI-assisted discovery to the question without treating results as evidence.
- Show authority, edition, effective date, source status, completeness, and research eligibility in Reader.
- Implement lightweight **Accept evidence** / **Reject** presentation: Editors create proposals; Reviewer/Owner approval creates/reuses evidence-snapshot v2 and versions the approved Evidence Set. An authorized solo Owner may complete the combined explicit action.
- Support exact passage selection, structured tables/grids, and needed surrounding context.
- Add governing/supporting/conflicting roles, proposal disposition, analysis eligibility, qualification, and rationale.
- Surface source drift, changed editions, incomplete context, and Project-applicability notes.
- Support removal via a new Evidence Set version.
- Preserve unassigned Saved material outside the question tray.

Exit gate:

- no candidate or bookmark is analyzed as evidence without explicit approval;
- the Evidence Set can be reconstructed byte-for-byte from immutable snapshots;
- table/visual evidence remains intelligible in memo output;
- source verification and Project applicability appear separately;
- evidence works offline after a cold reload when expected content was cached;
- all evidence actions are keyboard and screen-reader operable.

### Phase 5 — Conversational Research and structured Code Decision

**Goal:** Make Research the primary conversational surface while the existing Code Question architecture automatically and safely builds the structured Code Decision underneath.

Tasks:

- Replace the primary five-stage chrome and arrangements with Research + Code Decision, using the existing pane engine and internal Code Question identity.
- Link one Project Research conversation to the current Code Decision; do not create a second conversation, evidence, conclusion, or issuance store.
- Let the professional begin with a natural-language question. Create or refine the underlying question/definition revision through the existing authoritative command path.
- Progressively propose structured Question, Project Fact, Assumption, Missing Information, and candidate-evidence updates from the conversation. Make classification and consequential acceptance clear; never silently promote conversational prose into governed context.
- Show suggested evidence as candidates and provide lightweight accept/reject actions. Only the existing approved-evidence command may place an item in an immutable Evidence Set.
- Present the Code Decision alongside Research with sections for Question, Project Facts, Assumptions, Missing Information, Approved Evidence, Evidence-bounded Analysis, Professional Conclusion, contextual Review, and Code Memo state.
- Reuse the existing Research answer/generation system through the question-bound server command; do not submit mutable conversation selection as the authority.
- Resolve and bind each run on the server to exact question, selected Question Input, and Evidence Set versions/hashes.
- Enforce approved-evidence-only context at the server.
- Return structured citations, assumptions, missing facts, limitations, conflicts, and additional-evidence requests.
- Store immutable Research answer plus question-analysis descriptor.
- Add explicit “Use as starting point” or citation-transfer actions into the Professional Conclusion, even when both appear in one conversation/decision workspace.
- Implement controlled rerun and translate dependency changes into a simple primary warning such as **Changed — Re-evaluate**, with technical hashes/version details progressively disclosed.
- Keep AI Analysis and Professional Conclusion in different visual regions and artifact types.
- Allow the professional to skip AI entirely and author the conclusion from approved evidence.
- Add a clear save/finalize action for the Code Decision. Finalization binds an immutable Professional Conclusion revision and current governed dependencies; it does not erase the exploratory conversation.
- Make Review contextual. Surface **Needs Review** only when requested or required by policy; preserve all existing blocking-review behavior.
- Make **Create Code Memo** the main issuance action from a sufficiently complete/final decision. Keep readiness, approval, issuance saga, manifests, files, and immutable issued records underneath.
- Retain old stage panes temporarily as advanced/migration surfaces until Research + Code Decision provides equivalent access, then remove obsolete stage-only chrome and shortcuts without deleting the underlying components or data.

Exit gate:

- a professional can start in Project Research and reach a saved/final Code Decision without manually navigating five stages or understanding internal version objects;
- the conversation may contain rejected/exploratory material while the Code Decision contains only governed accepted content;
- every conversation-derived governed update records its source/disposition and uses the existing authoritative command, permission, concurrency, idempotency, offline, and audit paths;
- adversarial tests prove the model cannot cite unapproved candidates or hidden corpus text;
- every cited claim resolves to approved evidence;
- every canonical dependency-hash change marks prior runs stale;
- the ordinary UI translates that state to **Changed — Re-evaluate** without hiding lineage;
- insufficient evidence produces a bounded limitation, not invented certainty;
- professional conclusion remains authored, revisioned, and separately attributable;
- paid generation is idempotent and concurrent requests cannot silently lose an answer;
- Review can be absent when policy permits, but applicable blocking requests still prevent final approval/issuance;
- Create Code Memo invokes the existing validated issuance architecture rather than a parallel document path.

### Phase 5A — Server integration and data authority (corrective gate)

**Status:** Complete in current history (`4bca8b2a7`, now reachable from `main`) after server-authority implementation, integrated HTTP/check/smoke verification, rendered localhost verification, and a clean final no-P1 architecture audit. The capability remains default-disabled and is not pilot-ready.

**Goal:** Preserve authenticated, Project-authorized server persistence as the trust layer while the conversational UI is migrated, retaining the existing domain adapters and established Research, collaboration, Report Manifest v3, and issuance-saga foundations.

Checklist:

- [x] Document the discrepancy between the earlier completion wording and the current browser-local/server-authority boundary.
- [x] Derive Project access, organization role, storage owner, and owner scope on the server from the authenticated user and Project membership; reject client-supplied authority claims.
- [x] Make Code Question create/read/update/archive/restore and lifecycle artifact commands verify that every target belongs to the authorized Project.
- [x] Hydrate the visible Code Decisions list and lifecycle from server artifacts instead of treating workspace state as the professional system of record.
- [x] Route Definition, Question Input, Evidence Set, bounded analysis, Professional Conclusion, Review, approval, memo, issuance, supersession, and recovery mutations through their authoritative server commands.
- [x] Keep immutable snapshots, Research answers, approvals, manifests, and Issued Records immutable; use compare-and-swap and idempotency for mutable or retryable commands.
- [x] Isolate Code Question caches by authenticated account and unload them on sign-out/account switch.
- [x] Replay offline mutations with stable request IDs through the same authorization and conflict paths; preserve queued intent safely across interruption.
- [x] Add HTTP integration coverage for persistence, account and organization isolation, role enforcement, approved-evidence-only analysis, blocking Review gates, issuance idempotency, and recovery.
- [x] Prove a clean second browser/session reconstructs the same IDs, versions, citations, hashes, review state, and issued lineage from the server.
- [x] Wire focused Phase 5A checks into the normal verification scripts and record their exact results in the progress ledger.
- [x] Perform a final architecture review and resolve every P1 server-authority or authorization bypass.

Exit gate:

- the server is the authoritative professional record for the visible lifecycle;
- authenticated Project access controls every read and mutation, with cross-account and cross-organization isolation proven over HTTP;
- approved-evidence-only analysis, review/approval blocking, immutable issuance, idempotent retry, and conflict recovery pass end to end;
- offline replay and a clean second session reconstruct the same authoritative record;
- the normal check/smoke suites include the new integration tests and pass from a clean run;
- the final architecture audit reports no unresolved P1 bypass;
- the capability remains default-disabled and no professional pilot begins as part of this phase.

Detailed corrective notes are maintained in `docs/code-question/PHASE5A_SERVER_INTEGRATION.md`.

### Phase 6 — Contextual Review

**Goal:** Make professional review auditable when applicable without forcing every decision through a visible Review stage.

Tasks:

- Present existing collaboration artifacts as contextual Review Requests in the Code Decision/Research surface.
- Add Fact Request, Evidence Review, Interpretation Review, and Revision Request labels through versioned `requestType` while retaining compatible legacy `kind` values.
- Add anchored targets for inputs, evidence, analysis, conclusion, and draft sections.
- Add assignee, due/priority only if existing product policy supports them, and clear Open/Waiting/Resolved/Dismissed status; Reopen is an action back to Open.
- Add approval action separate from resolving individual requests.
- Show passive History alongside active requests without merging them.
- Add an optional global Reviews inbox for users with relevant organization capabilities; it is not part of every user's default path.

Exit gate:

- old review threads/comments render and remain editable under their existing rules;
- comments remain immutable;
- every transition records actor and time;
- unresolved blocking requests prevent approval/issuance;
- reopen and second review round preserve prior history;
- server permissions reject unauthorized review, approval, and resolution actions.

### Phase 7 — Create Code Memo and issue

**Goal:** Let the professional create a clean memo from the structured decision while preserving every approval and immutable issuance safeguard underneath.

Tasks:

- Make **Create Code Memo** the primary issuance action on the Code Decision.
- Generate a question-specific typed Code Memo Draft from selected versions through the existing server path.
- Allow bounded authored narrative without becoming a desktop-publishing editor.
- Add readiness checks for evidence, unresolved inputs, stale analysis, citations, conclusion, review, permissions, and source status.
- Add approval and issue actions as separate, server-authorized commands.
- Preserve Draft → Ready for approval → Approved → Issuing → Issued → Superseded as internal/advanced state, while presenting plain contextual readiness and recovery messages in the ordinary flow.
- Create immutable Report Manifest v3 and `issuedDecisionRecord` through the idempotent issuance saga, with database transactions around reservation and commit plus deterministic staged-file recovery.
- Add PDF/HTML/structured manifest output.
- Add version history, correction, and supersession flow.
- Use restrained language: internally Issued Record, never agency approval or compliance certificate.

Exit gate:

- issued content and hashes remain unchanged after current Project data changes;
- two concurrent issue attempts cannot create duplicate version numbers or orphan files;
- every record resolves to exact evidence, inputs, conclusion, approval, author, and time;
- web and iOS resolve the same semantic manifest and version identity;
- deletion/retention policies still work lawfully;
- downloaded output passes content, accessibility, privacy, and visual review.

### Later-phase dependency rule

Phases 6–10 depend on the Phase 5 conversational model, not on the superseded five-stage interface:

- Legacy promotion must open or enrich Research/Code Decision context, not send users into a Define stage.
- Review must remain contextual and optional when policy permits, while applicable approval and blocking-request rules remain server enforced.
- **Create Code Memo** must remain the ordinary issuance surface; readiness, manifests, immutable records, and file generation remain underneath it.
- iOS must use Research → Code Decision → Code Memo semantics and simplified derived states, while preserving shared IDs, versions, citations, permissions, and lineage.
- Pilot scripts, accessibility review, analytics, support material, rollback checks, and Production verification must exercise the conversational flow.
- A later phase may reuse internal stage components for advanced details, but it may not restore stage tabs as the ordinary path without an explicit product-direction change.
- No later phase may weaken evidence approval, bounded-analysis, professional-conclusion, review, issuance, concurrency, audit, or offline rules to compensate for missing conversational orchestration.

### Phase 8 — Legacy promotion and supporting tools

**Goal:** Make existing work useful in Research and Code Decisions without forced conversion.

Tasks:

- Add guided linking flows for Notebook cards, Saved passages, prior Research answers, Report Drafts, and Coordination threads into the current Research/Code Decision context.
- Add Legacy/Unassigned counts and filters.
- Let Working Notes and Workboard link to a Code Decision without changing Project ownership.
- Preserve generic advanced Report Drafts.
- Add migration summaries and recovery actions.
- Observe actual use before considering any removal.

Exit gate:

- all pre-feature records remain reachable;
- promotion preserves source IDs/provenance and creates a distinct Question ID;
- ambiguous content is never silently promoted;
- unlink does not delete;
- rerunning promotion/migration does not duplicate relationships.

### Phase 9 — Adapted iPhone/iOS Project Hub

**Goal:** Provide Research/Code Decision semantic continuity, contextual review, and secure record access on iPhone.

Tasks:

- Add Code Decision list/detail and simplified derived state.
- Complete decoder/local-schema/read-only compatibility before enabling any mutations.
- Add limited, role-appropriate fact/assumption/missing-information confirmation and offline queueing only after the separate mutation gate passes.
- Add Evidence Set, analysis summary, conclusion, review, and Issued Record views.
- Add Review Request response/resolution only after authorization, atomic outbox, conflict, and recovery gates pass.
- Add Report download and version lineage.
- Add flattened Workboard preview and Working Notes links.
- Update local schema, sync decoders, migrations, conflict UI, and accessibility.

Exit gate:

- mixed web/iOS versions preserve records;
- local mutation and outbox behavior recover after interruption;
- semantic content, ordering, IDs, citations, and hashes match web;
- offline read/edit/reconnect cases pass on a physical device or appropriate release-grade device test;
- no web-only capability is falsely promised in iOS product copy.

### Phase 10 — Pilot, hardening, and rollout

**Goal:** Prove the complete conversational professional workflow and its unchanged trust guarantees before changing defaults broadly.

Tasks:

- Run internal synthetic and verified-content cases end to end.
- Pilot with selected professionals and real, permissioned Projects.
- Measure completion, evidence traceability, stale-state recovery, review resolution, and issue success.
- Audit accessibility, performance, error recovery, privacy, source rights, retention, and security.
- Verify Production as a separate step after commit, push, and deployment.
- Keep legacy navigation available until adoption and recovery meet defined thresholds.
- Publish user-facing migration and terminology guidance.

Exit gate:

- all Definition of Done conditions in Section 20 pass;
- no severity-one integrity, authorization, sync, or issuance defect remains;
- users can find all legacy work;
- production serves the intended version and the real Research → Code Decision → Code Memo flow is verified;
- rollback has been rehearsed without data deletion.

---

## 15. Verification strategy

### 15.1 Contract and unit tests

Cover:

- normalization and migration of every new artifact;
- stable IDs and display IDs;
- legacy per-user stage state remains non-authoritative while shared readiness/review/approval/issue separation is preserved;
- Research-to-Code-Decision links and proposal dispositions never duplicate or overwrite canonical artifacts;
- simplified Working/Final/Issued and contextual Needs Review/Changed/Missing Information derivation;
- valid and invalid lifecycle transitions;
- input revision/staleness propagation;
- Evidence Set versioning and snapshot hashes;
- analysis binding and citation validation;
- professional-conclusion revisions;
- Review Request legacy kinds, versioned request types, targets, transitions, and permissions;
- issue/supersede lineage and hashes;
- Report Draft v1→v2 and Manifest v1/v2→v3 adapters without stored-record mutation;
- frozen old-client preserve-and-ignore/coercion behavior;
- version-1 provenance adapters.

### 15.2 Migration tests

Cover:

- empty account;
- Project with only Saved material;
- Project with Notebook question cards;
- Project with Research answers and no explicit question;
- Project with multiple Reports;
- existing Coordination threads;
- ambiguous relationships;
- partial failure and restart;
- rerun/idempotence;
- separation of read-time schema/bootstrap migration from explicit user-content promotion;
- downgrade/feature-disable readability;
- mixed client versions.

### 15.3 Workspace tests

Cover:

- pane open, close, focus, reorder, resize, and divider reset;
- stored widths/order/scroll/filter/selection after reload;
- Research + Code Decision default arrangement without destructive state changes;
- temporary legacy stage presets remain non-authoritative during migration;
- Project switch and decision switch without stale conversation/record leakage or full-workspace blink;
- active Project color inheritance;
- one visible Workboard per Project;
- old layout normalization;
- 1440px, 1180px, tablet, browser zoom, and narrow window behavior.

### 15.4 Offline and sync tests

Test these separately:

- online edit;
- offline edit;
- cold offline reload;
- queued mutation;
- reconnect and incremental pull;
- simultaneous input/conclusion edits;
- source/evidence unavailable offline;
- conflict resolution;
- outbox interruption/recovery;
- permission loss between local queueing and server replay;
- rollback/feature-disable while new-client Question commands remain queued;
- old client encountering new records;
- issuance attempted offline or from stale state.

Issuance should normally require an authoritative server round trip. If an offline draft is allowed, it must remain clearly unissued until server validation completes.

### 15.5 AI evaluation

Include adversarial cases where:

- an answer exists in the broader corpus but not in approved evidence;
- a search candidate contradicts approved evidence;
- a Project fact is missing;
- an assumption is presented as if confirmed;
- evidence cites a table without the needed table row;
- edition/effective dates conflict;
- the requested conclusion exceeds the evidence;
- a prior analysis becomes stale.

Pass conditions:

- no uncited external claim enters the answer as governing support;
- every citation resolves to the approved Evidence Set;
- uncertainty and insufficiency remain visible;
- the model does not claim agency approval, compliance, or professional signoff.

### 15.6 Accessibility and visual QA

Verify rendered behavior, not source inspection alone:

- keyboard-only complete Research → Code Decision → Code Memo flow;
- screen-reader labels, headings, landmarks, live status, and error messages;
- focus order/restoration;
- contrast and non-color state;
- touch targets;
- reduced motion;
- long legal text, large evidence sets, long Project names, and localization-safe wrapping;
- empty/loading/error/offline/conflict/permission/stale/locked states;
- print/PDF output.

Screen-reader coverage must include VoiceOver with Safari on macOS and at least one Windows pairing such as NVDA with Chrome or Firefox. Source inspection alone cannot satisfy the gate.

Generated PDF verification must include tagged reading order, document title and language, real selectable text, meaningful headings, table headers, link annotations, and confirmation that no critical meaning depends on color alone.

Production fixtures must fail validation if they contain numeric authority/reliability percentages, a fictional “verified” badge, or an unverified legal passage copied from a design mock.

Use Stitch previews only as composition references. All visible legal facts and passages in acceptance fixtures must be verified or unmistakably synthetic test data.

### 15.7 Issuance-saga failure tests

Force and recover from server/process failure at every boundary:

- after issue-version reservation but before generation;
- after deterministic staged upload but before Manifest save;
- after Manifest save but before issued-wrapper/link/activity commit;
- after database commit but before the client receives success;
- during cleanup of an abandoned staged object;
- after permission is lost between draft approval and issue;
- after the Code Question is archived or deleted under an authorized retention path during generation;
- after Research entitlement/allowance state changes on an idempotent retry;
- while feature rollback leaves new-client outbox commands queued.

Each retry must converge on one question issue version, one visible issued wrapper, one resolvable Manifest/file set, and correct activity—with no duplicate charge, duplicate version, hidden partial record, or unrecoverable queued intent.

### 15.8 Existing verification commands

From `permitext-sync-server`, use the applicable existing scripts, including:

- `npm run check`
- `npm run smoke`
- `npm run test:offline`
- `npm run verify:content`
- `npm run verify:postgres`

Also run focused new contract/migration tests, iOS tests, and real browser verification. A passing local command does not prove a commit, push, deployment, Production alias, active cached client, or live professional flow. Record those as separate evidence.

---

## 16. Product acceptance scenarios

### Scenario A — Conversational Research to Code Decision

1. User opens a Project, opens Research, and asks a natural-language professional question.
2. Permitext creates or links the underlying Code Decision without exposing a five-stage setup flow.
3. During the conversation, Permitext proposes a Project Fact, an Assumption, and Missing Information; the user confirms or corrects their classifications with lightweight actions.
4. Permitext suggests candidate provisions. The user opens exact text in Reader and accepts two; rejected suggestions remain outside approved evidence.
5. Underneath, Permitext creates immutable evidence snapshots and Evidence Set v1 through existing permission/approval rules.
6. User requests bounded analysis; it flags the missing information and cites only approved passages.
7. The Research conversation may continue messily, while the adjacent Code Decision contains only the governed Question, inputs, approved evidence, analysis, and draft Professional Conclusion.
8. User resolves the missing information, producing a new input revision. The ordinary UI shows **Changed — Re-evaluate**; the prior analysis remains immutable and technically traceable.
9. User reruns analysis and authors/finalizes a separate Professional Conclusion.
10. If policy or the user requires review, a contextual Interpretation Review is opened, resolved, and approved. If review is not required, no Review stage is imposed.
11. User selects **Create Code Memo**. Readiness, approval, idempotent issuance, Manifest v3, and file generation operate underneath and produce Code Memo v1.
12. Later evidence changes; v1 remains immutable and a new approved draft may become v2, superseding v1 without deleting it.

### Scenario B — Existing Project material

1. User opens a pre-feature Project.
2. All Saved, Notebook, Research, Workboard, Report, and Coordination records remain discoverable.
3. User chooses to investigate the material in Research or link it to a Code Decision.
4. Permitext creates/links the underlying question record and preserves the original note without changing it.
5. User explicitly promotes selected passages into an Evidence Set.
6. Unrelated legacy content remains unassigned and visible.

### Scenario C — Offline/conflict

1. Editor changes a Question Input offline.
2. Reviewer opens a request against the prior version online.
3. On reconnect, Permitext reports the version conflict and preserves both intent and audit data.
4. Resolution creates a new input revision and retargets or marks the request stale; no edit silently disappears.

### Scenario D — Unauthorized issue

1. An Editor without issue capability prepares a valid draft.
2. The UI shows that approval/issuance is required from an authorized role.
3. A direct unauthorized server request is rejected.
4. An authorized user completes one idempotent issuance saga and produces exactly one issue version.

### Scenario E — Accepted disclosed limitation without AI

1. A professional defines a question and approves governing evidence but cannot resolve one Project unknown.
2. Readiness initially classifies the unknown as a blocker, so approval/issuance is unavailable.
3. An authorized Reviewer determines, with recorded rationale, that the uncertainty may be accepted as a disclosed limitation or explicit condition rather than a blocker.
4. The professional authors a conclusion directly from approved evidence without running Bounded Analysis.
5. The Code Memo visibly preserves the unknown, classification, condition/limitation, rationale, and reviewer approval.
6. The authorized issue action succeeds, proving that “unresolved” is not silently hidden and that optional AI is not a prerequisite.

### Scenario F — Messy research, clean issuance

1. A long Research conversation includes exploratory interpretations, rejected provisions, follow-up questions, and a superseded assumption.
2. Conversation history remains intact and attributable.
3. The Code Decision contains only the current governed Question, classified inputs, professionally approved evidence, selected bounded analysis, Professional Conclusion, and applicable review disposition.
4. Create Code Memo resolves only those governed artifacts; exploratory/rejected chat content cannot leak into the memo or model context.
5. A reviewer can reconstruct the issued chain without treating the entire conversation as an approved professional record.

---

## 17. Metrics and privacy-safe instrumentation

Measure workflow events, not confidential legal text.

Recommended metrics:

- percentage of active Projects with at least one Code Decision;
- time from first Research question to first approved evidence;
- percentage of Research sessions that produce a saved/final Code Decision without opening legacy stage navigation;
- number of explicit confirmations required per accepted Project Fact, Assumption, Missing Information item, and evidence item;
- percentage of analyses with complete resolvable citations;
- rate of stale analyses detected before review/issue;
- number and resolution time of Review Requests by type;
- percentage of issued records with governing evidence, inputs, conclusion, and approval snapshots;
- migration/promotion success, ambiguity, and recovery rates;
- offline queue success and conflict rates;
- legacy-tool discoverability and continued usage;
- issue failure, duplicate-attempt, and supersession rates.

Do not send question text, Project facts, evidence passages, conclusions, review comments, addresses, or report contents to general product analytics. Use coarse event names, anonymized IDs, timing, counts, error classes, and capability state consistent with the privacy policy.

---

## 18. Risks and mitigations

| Risk | Consequence | Mitigation |
| --- | --- | --- |
| Rebuilding from Stitch HTML | Loses real behavior, offline support, accessibility, and current architecture | Rebuild concepts inside the existing pane engine and contracts |
| Building a parallel conversational decision store | Conversation and issued record diverge; trust chain becomes ambiguous | Link Research to existing Code Question artifacts and route governed updates through existing authoritative commands |
| Treating conversation text as governed fact/evidence | Exploratory statements enter analysis or issuance without consent | Use explicit proposal/disposition rules and resolve only canonical artifacts for analysis/memos |
| Treating Saved as evidence | Analysis uses unapproved or incomplete text | Require immutable snapshot plus explicit Evidence Set approval |
| Facts remain loose notes | Conclusions cannot be reconstructed or reviewed | First-class granular Question Inputs with revisions |
| Analysis becomes stale silently | Professional relies on obsolete reasoning | Dependency hashes and explicit stale state |
| AI and conclusion are blurred | Responsibility and provenance become unclear | Separate artifacts, headings, authorship, and approval |
| Review model is duplicated | Split history and incompatible collaboration | Evolve `reviewThread`/`reviewComment` with adapters |
| Report Manifest is mutated to “issue” | Historical output loses integrity | Immutable issued wrapper and superseding versions |
| Concurrent issue allocation | Duplicate versions or orphaned files | Transaction, unique constraint, and idempotency key |
| Project/question switch leaks state | User acts on the wrong Project | Scoped pane IDs, normalization, and rendered switch tests |
| Old clients discard new records | Cross-device data loss | Update decoders first and prove preserve-and-ignore |
| Ambiguous legacy content is auto-converted | False professional history | Explicit promotion; automatic migration only when unambiguous |
| Source verification implies applicability | Misleading legal conclusion | Separate provenance from Project-applicability determination |
| Confidence percentages imply authority | False precision and liability | Use provenance, limitations, and verification status instead |
| Offline local data is mistaken for offline reload | Workspace fails in the field | Test cold shell reload, content, outbox, reconnect separately |
| Too many default columns | Dense and intimidating UI | Default to Research + Code Decision; open Reader/review/history contextually |
| Five-stage implementation keeps governing UX | Professionals perform records administration instead of research | Remove stage chrome after parity, repurpose stage components as Code Decision sections/advanced details |
| Hiding legacy tools too early | Users believe work was lost | Legacy/Unassigned views and staged rollout |
| “Immutable” conflicts with lawful deletion | Privacy/retention violation | Preserve record integrity within account and legal lifecycle |
| Local success reported as Production | False release confidence | Separate test, commit, push, deploy, alias, cache, and live verification evidence |

---

## 19. Deferred scope

The following should remain outside the initial conversational Code Decision release unless separately approved:

- deleting Notebook, Workboard, generic Report Draft, or legacy views;
- real-time shared Workboard editing, presence, or object-level merge;
- full desktop-publishing controls and unrestricted report layout;
- unrestricted “find all relevant evidence” or autonomous compliance analysis;
- Zoning Research before its separate corpus and evaluation gates pass;
- automatic professional approval or unattended paid evaluations;
- public discussions or broad social collaboration;
- new firm billing/invoicing choices;
- unlicensed standards or publisher editorial content as governing evidence;
- full Excalidraw editing on iPhone;
- pixel-identical web/iOS screens;
- public rollout before privacy, deletion, rights, billing, security, Production, and App Store gates are complete.

---

## 20. Definition of Done

The reorganization is complete only when all of the following are true:

### Product and workflow

- A Project clearly contains Research and Code Decisions, with issued Code Memos/records.
- A professional can start with a natural-language Research question and reach a saved/final Code Decision without manually operating five workflow stages.
- Research and Code Decision behave as one connected product and resolve to one internal record identity; no parallel implementation exists.
- The conversation may remain exploratory while the structured decision and issued memo contain only governed accepted content.
- Supporting tools and advanced trust details remain discoverable but do not compete with Research as the primary surface.
- Primary status uses Working, Final, and Issued, with contextual Needs Review, Changed, and Missing Information where applicable.
- Every state—empty, loading, offline, stale, conflict, blocked, locked, unauthorized, and failed—is understandable and recoverable.

### Evidence and AI integrity

- Search results remain candidates until explicit approval.
- Approved passages are immutable, versioned, and reconstructable.
- Analysis is server-enforced to exact approved evidence and versioned inputs.
- All citations resolve.
- Missing facts, assumptions, conflicts, limitations, and source drift remain visible.
- AI analysis and professional conclusion are distinct.

### Review and issue integrity

- Review Requests preserve target, type, actors, comments, transitions, and resolution.
- Review is optional in presentation but mandatory whenever policy or blocking requests require it.
- Approval is permissioned and separate from AI generation.
- Create Code Memo uses the existing validated draft/readiness/approval/issuance path.
- Issue is transactional and idempotent.
- Issued Records preserve exact snapshots, hashes, lineage, author, reviewer, and time.
- Supersession never overwrites an earlier record.

### Compatibility and reliability

- Existing records remain reachable and unchanged unless explicitly promoted.
- Old layouts normalize safely.
- Old clients preserve new records.
- Offline cold reload, mutation queue, reconnection, and conflicts pass.
- Web and iOS share semantic record identity.
- Server permissions reject unauthorized direct calls.

### Quality and release

- Focused tests and existing check/smoke/offline/content/Postgres suites pass.
- Rendered browser and appropriate iOS/device verification pass.
- Accessibility review passes WCAG 2.2 AA for the authenticated web application and generated HTML/PDF output.
- Source provenance and rights review passes.
- Privacy, deletion, retention, security, billing, and release gates remain satisfied.
- Intended code is committed and pushed deliberately.
- Deployment is ready, Production points to it, the current client/cache is active, and the real end-to-end flow is separately verified.
- Rollback has been rehearsed without destructive data changes.

---

## 21. Decisions with recommended defaults

These govern the remaining conversational migration. Use the recommended default unless the product owner explicitly changes it.

| Decision | Recommended default |
| --- | --- |
| Primary working surface | Research conversation |
| Primary user-facing record | Code Decision; retain internal `CodeQuestion` names for compatibility |
| Conversational progression | Ask → Investigate → Decide; not required tabs |
| Visible record states | Working, Final, Issued; contextual Needs Review, Changed, Missing Information |
| Five-stage labels | Superseded as primary UX; temporary advanced/migration surfaces only |
| Final output label | Code Memo; backed by an immutable Issued Record |
| Meaning of Issued | Internally issued professional record, not agency approval |
| Default wide layout | Research + Code Decision, with contextual Reader as an optional third pane |
| Supporting tools | Add column / More, not deleted |
| AI product label | Evidence-bounded Analysis inside Research; separate from Professional Conclusion |
| Review storage | Existing review threads/comments with new labels and targets |
| Report storage | Existing draft/manifest system plus immutable issued wrapper |
| Legacy migration | Explicit promotion unless association is provably unambiguous |
| iPhone parity | Semantic and workflow parity, adapted layout |
| Offline issuance | Draft allowed; authoritative issue requires server validation |
| Source confidence | Provenance/status labels; no numeric reliability score |

Items requiring explicit policy before broad rollout include who may issue, whether a second reviewer is mandatory, retention periods, signature wording, external sharing permissions, and which source classes may qualify as governing evidence.

---

## 22. Continuation instructions for another agent

### 22.1 Before doing anything

1. Read this document completely.
2. Confirm the product owner has explicitly authorized implementation. If not, stop after reporting status.
3. Run `git status --short --branch` and inspect the current HEAD.
4. Preserve all unrelated worktree changes, especially files not named in the authorized phase.
5. Recheck the active implementation because branch-specific reports may be stale.
6. Read the governing contract/docs relevant to the phase; do not treat Stitch as authority.
7. Update the progress ledger below before and after meaningful work.

### 22.2 Next authorized implementation task

Phases 0–5A already established the underlying trust architecture. Continue with the **Phase 5 conversational migration** unless the product owner narrows the batch.

The next implementation handoff should:

- audit the existing five-stage implementation into **Keep unchanged**, **Repurpose**, and **Obsolete UI** categories;
- keep existing server commands, immutable artifacts, permissions, evidence rules, staleness, review, issuance, offline, and audit behavior;
- make Research the primary Project working surface and Code Decisions the visible Project record list;
- link the conversational surface to the existing internal Code Question identity rather than creating parallel state;
- implement one coherent vertical slice—starting/resuming Research, seeing the governed Code Decision, accepting/rejecting candidate evidence, or creating the Code Memo—using existing authoritative commands;
- add/update focused contract tests for the new default arrangement and simplified states;
- retain the capability flag and leave external rollout gates closed.

### 22.3 Work discipline

- Use additive contracts and small, reviewable commits.
- Stage only files belonging to the current phase.
- Do not combine cleanup, broad refactors, source-content changes, and lifecycle implementation in one commit.
- Update web, server, contract tests, and iOS compatibility together when a shared record changes.
- Treat local tests, rendered UI, Git commit, remote push, deployment, Production alias, active cached client, and live flow as separate facts.
- When a phase fails its exit gate, leave the feature disabled and document the exact blocker.

---

## 23. Progress ledger

Update this table as implementation proceeds. Include commit IDs and verification evidence; do not mark a phase complete based only on code being written.

**Status correction (August 7, 2026; current-history note August 9):** Earlier entries used “Complete (branch)” for locally rendered UI/domain milestones before the visible workflow was server-authoritative. Phase 5A closed that integration gap with authenticated Project authority, account isolation, authoritative hydration and mutation paths, offline replay/conflict handling, expanded HTTP integration coverage, full check/smoke verification, rendered localhost proof, and a clean final no-P1 audit. That consolidated work is now recorded in `4bca8b2a7` and is reachable from the current `main` history. The capability remains default-disabled and is not pilot-ready. The Phase 5 conversational migration, Phase 9 device/mutation gates, and Phase 10 external, policy, deployment, Production, accessibility, and rollback gates remain open.

**Direction correction (August 9, 2026):** The server-authoritative lifecycle remains valid, but the visible five-stage workflow is superseded. Phase 2–7 UI work is now implementation inventory: its domain/server behavior is preserved; its stage selector, stage-first defaults, and terminology must be repurposed or removed incrementally. Research + Code Decision is the authoritative UX. No prior local or rendered proof establishes completion of this redesign.

**First incremental migration slice (August 9, 2026):** The current worktree removes the stage control from the ordinary path, relabels the index as Code Decisions, opens Permitext's existing persisted Research workspace as the primary surface, places a derived Code Decision record beside it, simplifies visible states, and makes **Create Code Memo** the primary issuance action. It deliberately reuses the existing Research and internal Code Question stores. Contract/check/smoke suites and a signed-in rendered localhost flow pass for this slice. Automatic conversation-to-governed-record extraction, an explicit durable Research Conversation ↔ Code Decision link, lightweight in-conversation acceptance, and the save/finalize interaction remain open; this slice does not complete Phase 5.

| Phase | Status | Commit(s) | Verification | Notes / blockers |
| --- | --- | --- | --- | --- |
| Plan creation | Complete | `468f7e306` docs: plan Code Question workspace reorganization | Repository/roadmap/architecture/Stitch audits; Markdown checks | Plan only |
| 0 — Baseline and safety rails | Complete (branch) | Branch `codex/code-question-workspace`; `f5a4db822` feat scaffolding; `67476772f` ledger commit ID | `npm run check` exit 0; `npm run smoke` exit 0; `npm run test:code-question` exit 0; flag default disabled; fixtures + 8 ADRs | Inert capability flag; pure contract scaffolding; no UI reorganization; `CODEX_NEW_CHANGES_INSPECTION_REPORT.md` left untracked |
| 1 — Contracts, storage, permissions, migration | Contract and server integration complete | `4523703ff` + `4bca8b2a7` | Original phase contract suites plus Phase 5A HTTP suite; full `test:code-question`, `check`, and `smoke` | Server-derived Project authority, role/isolation enforcement, CAS, counters, issuance saga, migration, adapters, and permissions are integrated behind the default-disabled capability. |
| 2 — Project, Research, and Code Decision shell | First conversational migration slice implemented; further integration open | `a56e51079` + Phase 5A integration + current worktree | `test:code-question`, `check`, and `smoke` pass; signed-in localhost renders Code Decisions → existing Research → Code Decision with no stage control or console/overlay errors | Pane identity, Project/decision isolation, hydration, and account-scoped cache behavior remain valid. Old stage helpers remain only for migration/deep-link compatibility. |
| 3 — Governed Question and Project Inputs | Trust layer complete; Research extraction/presentation open | `fcac63182` + Phase 5A integration | Define/client-state/HTTP contracts; full suites; prior rendered Definition `r1`/`v1` | Persistence, classification, role enforcement, CAS replay, and conflicts remain valid. Manual Define-stage presentation must be repurposed into the Code Decision. |
| 4 — Conversational evidence discovery and approval | Trust layer complete; conversational suggestion/confirmation presentation open | `8608305a8` + Phase 5A integration | Evidence/client-state/HTTP contracts; full suites; prior active-Project Saved candidate import | Approval, immutable snapshots/sets, and isolation remain valid. Candidate/Reader/tray stage arrangement becomes contextual Research UI. |
| 5 — Conversational Research and Code Decision | **Redesign in progress; first UX slice verified; trust layer complete** | `11e129cb8` + `4bca8b2a7` + current worktree | Existing analysis/server-adapter/HTTP contracts prove bounded analysis; current full suites and signed-in localhost prove the first Research-primary/Code Decision presentation slice | Existing persisted Research is now the primary surface; Code Decision sections, simplified derived states, contextual details, and Create Code Memo are present. Durable conversation/decision linking, automatic governed extraction, lightweight in-conversation acceptance, and explicit save/finalize remain open. |
| 5A — Server integration and data authority | **Complete in current history; external rollout not included** | `4bca8b2a7` | `npm run test:code-question`, `npm run check`, and `npm run smoke` pass; expanded HTTP persistence/isolation/roles/analysis/Review/issuance/recovery/replay suite; rendered server-hydrated localhost workflow, real active-Project Saved candidate import, correct Analyze/Review/Issue gating, clean console; final no-P1 audits clean | Server authority, authenticated Project access, account isolation, authoritative hydration/commands, stable-ID offline replay/CAS, exact clean-session reconstruction, immutable/idempotent issuance, and hostile replay protections proven locally. Default disabled; no pilot, deployment, or Production claim. |
| 6 — Contextual Review | Trust layer complete; optional/contextual presentation open | `000ae77c7` + Phase 5A integration | Review/HTTP contracts; full suites; prior rendered Review gating | Coordination compatibility, blocking rules, immutable comments, targets, attribution, and history remain. Mandatory Review-stage presentation is obsolete. |
| 7 — Create Code Memo and issue | Trust layer complete; first simplified issuance presentation implemented | `9aed1741a` + `4bca8b2a7` + current worktree | Issue/HTTP contracts and full suites pass; signed-in localhost renders Create Code Memo from the Code Decision | Immutable lineage, recovery, idempotency, hostile-key rejection, and clean-session reconstruction remain. Advanced readiness/version panes stay contextual; end-to-end memo creation from a finalized redesigned decision still requires later Phase 5 completion evidence. |
| 8 — Legacy promotion and supporting tools | UI/domain and server integration complete | `1909a3473` + `4bca8b2a7` | Legacy/HTTP contracts; full suites; rendered real active-Project Saved candidate import | Explicit promotion/link semantics, provenance, authoritative Project ownership/isolation, unlink/recovery, and generic-tool preservation are integrated behind the disabled capability. |
| 9 — Adapted iPhone/iOS Project Hub | Read-only UI/decoder prototype complete; full exit gate open | `95628625f` | Release + Debug iPhone 17 Pro simulator builds; 38 iOS contract tests; `check`; `test:code-question`; Release launch | Decoder/read-cache work is valid for its scope. Server-authoritative cross-device reconstruction, mutation gate, physical-device proof, and mixed-client recovery remain open. |
| 10 — Pilot, hardening, and rollout | Prototype hardening complete; **pilot gate not passed** | `3884d72d0` | `check`; `test:code-question`; offline + deploy-content contracts; production client build + `smoke`; 20/20 canonical evidence preflight; rendered current-tab desktop/mobile workflow and clean console | Rollout controls, local prototype hardening, and Phase 5A server integration are present in current history. Phase 5 conversational completion, professional pilot evidence, policy/rights/retention/accessibility sign-off, push/deploy/Production verification, real signed-in Production lifecycle, and deployed rollback rehearsal remain pending. |

### Current handoff state

- Current working branch: `main`; the baseline before the August 9 conversational migration slice was `b9b8aa1fa7`, four commits ahead of `origin/main`.
- Phase 5A corrective server integration is committed in `4bca8b2a7`: authenticated Project authority, Project-owned storage, account isolation, authoritative hydration and lifecycle commands, offline replay/CAS conflict handling, exact clean-session reconstruction, immutable/idempotent issuance, hostile replay protection, and final no-P1 audits are covered.
- The August 9 conversational Code Decision migration is active in the current worktree. It must be verified and committed incrementally without creating a second Research or governed-record store.
- Phase 0 delivered: disabled capability flag, pure contracts, fixtures, ADRs, baseline tests.
- Phase 1 contract/server integration delivered: foundation artifact kinds/targets/activity; organization CQ permissions; collaboration `requestType` adapters; Report Draft v2 / Manifest v3 adapters; `code-question-commands.mjs` (CAS, counters, issuance saga, outbox, migration); authenticated gated routes under `projects/code-questions/*`; file + Postgres storage ports; iOS optional payload fields + decode test; and integrated HTTP role/isolation verification. Capability remains **default disabled** (`PERMITEXT_CODE_QUESTION_WORKSPACE=1` to enable).
- No tool deletion and no production deploy; the Code Question workspace remains default-disabled outside explicit rollout opt-in.
- Phase 2–4 UI/domain and server integration delivered: the workspace shell, Define model/UI, and Evidence model/UI now hydrate from and mutate the authenticated Project record; account isolation, role enforcement, stable-ID/CAS replay, immutable evidence approval, and the real active-Project Saved candidate import are verified on localhost.
- Phase 5 UI/domain and server integration delivered: bounded analysis and conclusion use exact server-owned versions, approved evidence, structured limitations/citations/assumptions/missing facts/conflicts, collision-safe idempotency, staleness, attribution, and the no-AI path.
- Phase 6 UI/domain and server integration delivered: typed and anchored Review Requests, status/reopen history, immutable comments, blocking approval denial/resolution, forged-attribution rejection, and separate approval behavior operate against the authoritative record. Due/priority were not introduced because current Coordination policy does not define them; the optional global Reviews inbox is deferred.
- Phase 7 UI/domain and server integration delivered: memo/manifest lineage, audit, supersession, failure recovery, idempotent retry, hostile different-draft key reuse rejection, and clean-session issued reconstruction are proven locally. Phase 10 deployment, policy, privacy, accessibility, and visual-output review remain open.
- Phase 8 UI/domain and server integration delivered: visible Legacy / Unassigned inventory, explicit promotion/link choices, provenance relationships, authoritative Project ownership/isolation, unlink/recovery, and preservation of generic Project tools are integrated.
- Phase 9 read-only UI/decoder prototype delivered: adapted Project Hub views, lifecycle decoding, offline read cache, issued lineage/download, accessibility labels, and bounded product copy. Cross-device server reconstruction, mutations, physical-device proof, and mixed-client recovery remain open.
- Phase 10 local prototype hardening delivered: synthetic lifecycle paths, approved content reconstruction, recovery coverage, rollout controls, coarse metrics, rollback documentation, terminology guidance, and rendered accessibility review. This is not professional-pilot evidence.
- Phase 5A is complete in current history. Phase 5 conversational extraction/linking/finalization remains open; Phase 9 device/mutation gates and Phase 10 external gates still require permissioned professional pilots, final policy/rights/retention/full-accessibility sign-off, deliberate push and deployment, active Production client/cache verification, a real signed-in Production lifecycle, and deployed rollback rehearsal. Capability remains default-disabled.
- August 9 redesign audit: keep the `codeQuestion`/Question Input/Evidence Set/analysis/conclusion/review/issue contracts, server commands, hydration, permissions, concurrency, idempotency, offline, and audit code. Repurpose the Question index as Code Decisions; Definition/Evidence/Analysis/Conclusion panes as sections/actions within Research + Code Decision; Review and issuance panes as contextual/advanced details. Treat the five-stage selector, stage-first deep links/default arrangements, mandatory Review presentation, and separate Research-versus-Code-Question mental model as obsolete UI. Incremental migration is required; no parallel store or destructive backend rename is authorized.

# Permitext — Recommended Implementation Roadmap

## Objective

Develop Permitext into a paid professional NYC code-research platform without delaying market validation by attempting to build the entire long-term vision first.

The immediate goal is to release a strong individual professional product that allows users to:

1. Find and read NYC code requirements.
2. Preserve relevant evidence by project.
3. Analyze deliberately selected evidence.
4. Record questions, assumptions, findings, and decisions.
5. Produce a traceable professional research report.

Collaboration, firm administration, evidence discovery, and zoning should expand this foundation after the individual product has demonstrated paid demand.

---

# Release 0 — Stabilize the Current Product Contract

Complete this release before expanding the Project data model. The purpose is not to redesign Permitext; it is to remove known contradictions and establish a trustworthy baseline for the larger roadmap.

## Phase 0.1 — Billing and Plan Accuracy

- Fix the iOS upgrade action so it displays the actual localized StoreKit price instead of `$0.00/month`.
- Align Free and Pro descriptions across web, iOS, and backend behavior.
- Decide and document the exact Free limits for saved sections, notes, and Projects.
- Enforce paid capabilities on the server wherever a user could bypass a client-only check.
- Keep continuity and cross-device synchronization explicitly available on Free unless the product decision changes.

## Phase 0.2 — Research Consolidation

Consolidate new Research activity on the selected-passage conversation workflow before linking Research to Projects.

- Stop creating new answers through the weaker full-section `/research/interpret` workflow.
- Preserve existing legacy answers and label them accurately.
- Use one conversation, quota, usage, citation-validation, and storage path.
- Continue excluding private notes from approved code evidence.
- Preserve the current requirement for explicit uncertainty and missing-fact handling.

## Phase 0.3 — Cross-Platform Clarity

- Add explicit iOS handling for Research and Workboards that remain web-first.
- Prevent web-only Workboard records from appearing as unexplained iOS conflicts.
- Describe continuity according to actual behavior: shared recents and searches, with local navigation protected on iOS.
- Verify the latest account-linking and entitlement-transfer behavior against production Postgres.

## Phase 0.4 — Deployment and Test Baseline

- Verify that production serves the intended canonical CodeContent after deployment.
- Expand the initial iOS entitlement/sync contract tests.
- Preserve the existing web check, smoke, content-integrity, billing, authentication, and Postgres verification gates.
- Record a known-good production, web, backend, and iOS baseline before schema expansion begins.

**Current implementation checkpoint — July 25, 2026:** The Construction Codes
baseline now audits all five code families, all 118 chapters, all 12,891 catalog
sections, all 101 runtime HTML sources, and every bundled local asset reference.
The runtime resolves each section against its own code family instead of reusing
another book's same-numbered chapter. Administrative Code Chapter 4 now has one
chapter title, normalized section headings, and complete official provision text
on both web and iOS. Building Code Appendix U section U101.5 has also been restored
to the canonical catalog, search index, and runtime.

The audit also found 9,958 current section identifiers that collide with obsolete
legacy prepared-body filenames. Legacy bodies are no longer eligible when the
current canonical identifier is known. Mechanical Code 404.1 now resolves to the
official enclosed-parking-garage ventilation provision instead of an obsolete
spray-booth provision. Official same-number headings are disambiguated by their
full normalized titles, with regressions for the duplicated Building Code 908.10
designations.

The iOS cold-start audit confirmed that first paint had been waiting on search-index,
multi-chapter, and section-detail prewarming. The chapter grid now becomes usable as
soon as the selected content snapshot is ready; cancellable search and Reader
prewarming continues in the background. Instrumented iOS 26.5 simulator runs
recorded cold process launches of 1,446 ms and 1,291 ms on an iPhone 17 Pro and
iPhone 17, followed by immediate relaunches of 1,218 ms and 1,146 ms. Simulator
boot and application-install time are excluded. Physical-device timing remains a
release-candidate verification item.

### Release 0 gate

Do not begin the unified Project migration until:

- Billing copy is accurate.
- Research uses one supported production path for new answers.
- Free and Pro capabilities are documented consistently.
- Production account linking and content serving are verified.
- The existing test suites pass from a clean checkout.

---

# Release 1 — Professional Research Foundation

This release establishes the data model required for everything that follows.

## Phase 1.1 — Unified Project Record

Create a unified Project Record capable of linking existing and future material without copying or flattening fundamentally different record types.

The model must distinguish:

1. **Canonical sources**
   - Code sections
   - Selected code passages
   - Source-library identities
2. **User-authored artifacts**
   - Notes
   - Tags
   - Notebook cards
   - Report Drafts
3. **Research records**
   - Research conversations
   - Immutable Research answers
   - Approved evidence snapshots
4. **Visual and external material**
   - Workboards
   - Attachments
   - Workboard previews
5. **Generated records**
   - Report Manifests
   - Generated reports
   - Activity events

Use a small shared artifact envelope containing only fields that genuinely apply across types:

- Stable unique identity
- Record type
- Created date
- Updated date
- Ownership scope
- Version
- Archived or deleted status

Keep authorship, visibility, review status, source identity, ordering, and other metadata on the record types or relationships where they are meaningful. A canonical code section, for example, is referenced by source identity and is not treated as a user-authored record.

Project-membership rules must be explicit:

- Saved sections and reusable evidence may link to multiple Projects.
- Notes and Notebook cards may link to multiple Projects only through an explicit user action.
- Research conversations have one primary Project by default.
- Workboards belong to one Project.
- Report Drafts and generated reports belong to one Project.
- Evidence snapshots belong to the Research answer or report version that created them.

### Required behavior

- Linking an item to a Project must not duplicate it.
- Unlinking an item must not delete it.
- Deleting a Project must not silently delete independently owned items.
- Existing Projects, saved sections, Workboards, and Research conversations must migrate without data loss.
- Direct links to existing code sections and saved content must continue working.
- Moving a Research conversation to another Project must not silently carry incompatible project facts.
- Project-specific Workboards, Report Drafts, and generated reports must not be reused across Projects as if they were generic artifacts.

### Acceptance gate

Do not continue until migration tests confirm that current user data is preserved and every migrated item retains its original identity.

---

## Phase 1.2 — Immutable Evidence Records

Research answers and reports must preserve the exact evidence that supported them at the time they were created.

For every approved evidence item, store:

- Jurisdiction
- Code edition
- Code book
- Chapter
- Section
- Passage identity
- Passage text or immutable content version
- Evidence approval date
- Evidence-set version
- Source library version

For every Research answer, store:

- Question
- Approved evidence set
- Answer
- Assumptions
- Missing facts
- Limitations
- Additional evidence needed
- Citations
- Passage-to-citation mapping
- Model or Research-system version
- Creation date
- User feedback
- Review status

Historical answers must not silently change when the canonical code library is updated.

A newer answer may be generated from updated evidence, but the original answer and evidence snapshot must remain available.

### Acceptance gate

Opening a historical Research answer must display the stored original question, evidence, answer, and citations exactly. This means reopening the immutable stored record, not rerunning the model and expecting it to regenerate identical text.

---

## Phase 1.3 — Project Activity History

Add the activity model during the foundation phase rather than waiting for collaboration.

Track meaningful saved events such as:

- Item linked
- Item unlinked
- Note or Notebook card created
- Note or Notebook card revision saved
- Evidence approved or removed
- Research question submitted
- Research answer generated
- Review status changed
- Report generated
- Project archived
- Project restored
- Member invited
- Permission changed

Do not create an activity event for every keystroke, autosave pulse, synchronization retry, or other implementation detail. Activity history should explain professional decisions and material record changes.

Each activity entry must identify:

- User
- Date and time
- Action
- Affected object
- Project
- Relevant previous and new status

This activity history will initially support individual continuity and later become the audit trail for teams and firms.

---

## Phase 1.4 — Authorization and Storage Foundation

Establish centralized owner-level security before adding more private content, while preparing stable ownership fields for later organization membership.

The server must enforce authorization for:

- Projects
- Notes
- Notebook cards
- Research conversations
- Research answers
- Attachments
- Workboard images
- Report drafts
- Generated reports

Requirements include:

- Private attachment storage
- Time-limited file access
- Protection against old direct links
- Current-owner checks on every request
- Stable Project identifiers that do not depend on one device's local database ID
- Organization-ready ownership fields without prematurely implementing organization membership
- Clear deletion and retention behavior
- Removal or disabling of cached access when permissions are revoked and the device reconnects
- A future-safe asset namespace based on stable Project or organization ownership rather than permanent dependence on the creating user's ID

The client interface must never be the only authorization layer.

Already downloaded or exported material cannot be remotely recalled. Permission revocation must prevent future server access and remove managed local caches when the client reconnects, without claiming to erase files a user has independently exported or copied.

Full Project-membership authorization, invitation rules, and organization roles belong in Release 3.

---

## Phase 1.5 — Capability and Sync-Contract Foundation

Extend the existing entitlement and synchronization contracts before introducing many new record types.

### Capability foundation

Define capabilities centrally for:

- Saved-work limits
- Note limits
- Projects
- Notebook
- Professional exports
- Offline access
- Research allowance
- Evidence discovery
- Collaboration
- Organization administration

The same capability identifiers must be understood by web, iOS, the backend, and subscription handling. Pricing and packaging may change without requiring every feature check to be rewritten.

### Sync-contract foundation

Add:

- Sync schema version
- Client capability declaration
- Backward-compatible server responses
- Safe handling of record types unknown to an older client
- Migration checkpoints
- Content-map compatibility
- Per-record conflict policies

New Notebook, Research, Report, attachment, activity, or collaboration records must not cause an older installed iOS version to reject unrelated saved data.

---

# Release 2 — Paid Individual Professional Product

This is the first commercially releasable version. Permitext should begin testing paid subscriptions after this release rather than waiting for collaboration, zoning, or automated evidence discovery.

## Phase 2.1 — Project-Linked Research

Extend the consolidated selected-passage conversation system established in Release 0. Do not create a second Project-specific Research path.

Users must be able to:

- Assign new Research conversations to a Project.
- Assign existing Research conversations to a Project.
- Start Research from a saved section.
- Start Research from a selected passage.
- Start Research from a Notebook card.
- Start Research from a Project evidence collection.
- Reopen a conversation with its exact approved evidence.
- Inspect the passage supporting every citation.
- Add the answer to the Project history.
- Move a conversation to another Project through an explicit action and project-context review.
- Reuse approved evidence in another Project without automatically reusing the original Project's question, assumptions, or answer.

Private user notes must remain separate from approved enacted-code evidence.

Project information may be supplied as context, but it must be clearly identified as user-provided project facts rather than official authority.

### Required Research output

Every answer should be structured around:

- Supported conclusion
- Explanation
- Assumptions
- Missing project facts
- Limitations
- Additional evidence needed
- Citations
- Supporting passages

### Acceptance gate

A Research answer must fail validation when:

- A citation does not belong to the approved evidence set.
- A supporting passage cannot be resolved.
- A private note is presented as code authority.
- A required uncertainty condition is omitted.
- Historical evidence cannot be restored.

---

## Phase 2.2 — Focused Notebook

Build the Notebook as a structured code-research notebook, not a general-purpose database.

Initial card types:

- Question
- Finding
- Assumption
- Missing information
- Decision
- Coordination item
- Review task

Each card may link to:

- Code sections
- Selected passages
- Research answers
- Other Notebook cards
- Attachments
- Workboard elements
- Report drafts

Every card must visibly identify whether its content is:

- User-authored
- Quoted or linked code evidence
- AI-assisted
- Project metadata

Avoid adding unrestricted custom card types during the first release.

### Notebook editor candidate — Tiptap

Evaluate Tiptap as the preferred web Notebook editor before building a custom editor.

The first proof must use the smallest viable open-source core and prove:

- A constrained Notebook schema rather than unrestricted document structure
- Permitext-specific nodes or marks for citations, selected evidence, Research answers, and artifact links
- Versioned Tiptap JSON persisted in Permitext storage and validated at the server boundary
- Plain-text and static HTML rendering without loading an editable browser instance
- Stable migration when the schema or extension set changes
- Keyboard, screen-reader, focus, copy/paste, and mobile-browser behavior
- Clean mounting inside the Project Studio without making the Notebook visually dominate the workspace
- Report-manifest extraction that preserves source identity instead of flattening citations into untraceable prose

Do not make Tiptap Cloud, Collaboration, Pages, or paid Conversion services a foundation dependency for the first Notebook release. Evaluate paid DOCX/PDF or collaboration extensions separately when Report export and shared editing reach their own phases. Permitext must retain canonical Notebook JSON and be able to render or migrate it without depending on a live third-party service.

Adopt Tiptap only if this proof is simpler and safer than a constrained native editor built directly for the Notebook schema.

### Acceptance gate

A user must be able to open any source-linked card and reach the original evidence or Research record without relying on copied text.

---

## Phase 2.3 — Web Project Studio

Create one coordinated Project Studio on the web.

Primary areas:

- Project overview
- Saved evidence
- Notebook
- Research history
- Workboard
- Report draft

On wide screens these may appear in coordinated panels. On smaller screens they may collapse, stack, or use tabs.

Changing the active Project must update every project-specific area without leaking content from the previous Project.

The Project Studio should emphasize code research. The Workboard remains a supporting tool rather than the dominant interface.

### Acceptance gate

Switching between Projects must reliably replace all visible project content, selections, pending drafts, and Workboard data.

---

## Phase 2.4 — iOS Project Hub

Create a focused mobile Project Hub containing:

- Project overview
- Saved evidence
- Notebook
- Read-only Research history
- Draft or report summary
- Exports

Do not reproduce the full Workboard editor on iPhone.

The initial iOS Workboard capability may be limited to:

- Flattened preview
- Image viewing
- Opening related project content
- Possibly adding a simple note or image

Full visual editing remains web-first. Because iOS cannot natively render Excalidraw scene JSON as the existing web editor does, the web Workboard workflow should generate a flattened preview image when a meaningful Workboard revision is saved.

Creating Research conversations, assembling evidence, and editing Workboards may remain web-first in the initial paid release. iOS must clearly label those capabilities and provide a direct route back to the web workspace where appropriate.

---

## Phase 2.5 — Report Draft

Implement the Draftboard as a constrained professional report composer rather than a general document editor.

Recommended name:

- Report Draft
- Document Draft
- Research Draft

Initial formatting should support only:

- Title
- Headings
- Paragraphs
- Lists
- Evidence inserts
- Notebook-card inserts
- Research-answer inserts
- Citations
- Basic item ordering
- Report preview

Do not initially build:

- Real-time collaborative editing
- Advanced page-layout controls
- Floating text boxes
- Desktop publishing
- Custom typography systems
- Complex tables
- Unrestricted image placement

The Report Draft should assemble Permitext research into a professional narrative, not compete with Microsoft Word or Google Docs.

---

## Phase 2.6 — Unified Report Manifest

Create one platform-independent Report Manifest describing the semantic contents of every report.

The manifest should identify:

- Project
- Report title
- Report date
- Author
- Code edition
- Selected evidence
- Included passages
- Notebook content
- Research content
- Workboard images
- Attachments
- Ordering
- Attribution
- Disclaimers
- Report version

Web and iOS may render the manifest differently, but both must use the same underlying report record.

### Web report builder

Support:

- Item selection
- Drag-and-drop ordering
- Cover information
- Project metadata
- Evidence sections
- Notebook content
- Research content
- Workboard images
- Attachments
- Preview
- Rich PDF rendering

### iOS report workflow

Support:

- Select Project or saved evidence
- Select report sections
- Include notes
- Include supported Research
- Generate a compact native PDF
- Share through the iOS share sheet

The web and iOS PDFs do not need visual parity. They require semantic parity.

### Required visual separation

Every report must clearly distinguish:

- Published code text
- User-authored notes
- AI-assisted Research
- Project metadata
- Attachments and Workboard material

### Report history

Generated reports must be saved as dated immutable snapshots.

Editing a Report Draft and generating another PDF should create a new report version rather than rewriting the historical report.

### Report storage

Store report material according to its purpose:

- Report Manifest and structured metadata: database
- Immutable evidence snapshots: versioned structured storage
- Generated PDFs: private object storage
- Workboard previews and attachments: private object storage
- Content hash, generator version, and source versions: stored with every generated report

Project and organization authorization must protect both the manifest and every associated file. A report link must not remain permanently accessible after the user's authorization is removed.

---

## Phase 2.7 — Packaging and Enforcement Completion

Complete the capability foundation introduced in Release 1 by mapping capabilities to commercially testable plans and enforcing them consistently.

Initial capabilities:

- Saved-work limit
- Note limit
- Projects
- Notebook
- Professional exports
- Offline access
- Research allowance
- Evidence discovery
- Collaboration
- Organization administration

Use the same capability definitions across:

- Web
- iOS
- Backend
- Subscription service

Initial packaging:

### Free

- Code reading
- Search
- Recent history
- Limited saved sections
- Limited notes
- Basic synchronization

### Pro

- Unlimited saved sections
- Unlimited notes
- Projects
- Notebook
- Report Draft
- Professional exports
- Web offline access
- Advanced workspace

### Research Add-On

- Selected-evidence Research
- Evidence-set history
- Verified citations
- Research conversation history
- Monthly Research allowance

### Teams

Keep unavailable or invitation-only until Release 3.

The capability system must not hard-code pricing assumptions.

---

## Release 2 Commercial Gate

Begin limited paid testing as soon as the following smaller vertical product is reliable:

- Project Record
- Project-linked Research
- Notebook
- A focused Project workspace
- One reliable professional Project report
- Synchronization
- Capability enforcement

Continue improving the full Project Studio, richer Report Draft, report customization, and mobile presentation while the first paid cohort is using the product.

Do not delay initial paid validation for:

- Shared editing
- Firm administration
- Find Relevant Evidence
- Zoning Resolution
- Advanced Workboard collaboration
- The complete four-pane Project Studio
- Advanced report-layout controls

### Initial commercial targets

- First 25 paid professionals
- Then 100 paid professionals
- Then 500 paid seats

Measure:

- Trial-to-paid conversion
- Monthly retention
- Research usage
- Reports generated
- Projects created
- Saved evidence per active user
- Most-used professional workflows
- Reasons for cancellation

---

# Release 3 — Team and Firm Product

Begin this release only after the individual professional workflow is stable.

### Implementation status — July 25, 2026

The core organization and collaboration foundation is now implemented locally and validated across the backend, web application, and iOS application.

- The web application provides firm creation and administration, invitations, role and seat management, Project transfer, shared Project Studio access, shared Notebook editing, attributed Project notes, evidence review, threaded review coordination, Research history, and Report access.
- The iOS application accepts firm invitation links and provides a read-only shared Project Hub for Notebook cards, Project notes, review coordination, Research history, evidence review status, Report downloads, Workboard previews, and recent activity.
- The backend is the authority for organization membership, roles, seat limits, invitations, Project ownership, private asset access, and collaboration permissions.
- Firm administration and shared editing remain web-first on iPhone. iOS intentionally focuses on review, continuity, and secure Report access.
- The Project Studio remains one coordinated workspace. Switching Projects replaces the visible Notebook, notes, reviews, Research, reports, and Workboard state instead of opening parallel workboards or leaking the prior Project's content.
- The Notebook uses a constrained Tiptap editor with canonical versioned JSON owned by Permitext; Tiptap Cloud and paid collaboration services are not foundation dependencies.
- Firm Owners can manage organization tags, Project assignments, reusable Report templates, branding, required disclaimers, Research allowance policy, and policy-only retention from the web. New Reports retain immutable snapshots of those standards.
- iOS presents assigned firm tags, active Report-template context, branding, policy revision, and retention context read-only in the shared Project Hub and applies immutable Report presentation snapshots to native PDF export.
- Shared Workboard editing remains deferred until the ordinary collaboration model has production experience.

## Phase 3.1 — Organizations

Add:

- Organization records
- Organization membership
- User roles
- Organization ownership
- Organization-level capabilities
- Organization billing identity

Initial roles:

- Owner
- Editor
- Reviewer
- Viewer

All permissions must be enforced by the backend.

**Status: core scope complete.** Organization records, membership, Owner/Editor/Reviewer/Viewer roles, capabilities, billing identity, backend permission enforcement, and PostgreSQL repository support are implemented. Organization billing configuration exists as a foundation; centralized firm checkout and invoicing remain part of the later commercial controls.

Before migrating a Project into organization ownership:

- Move attachment and Workboard authorization from a permanent user-owned namespace to a stable Project or organization-owned namespace.
- Preserve access for the original owner during migration.
- Verify that Project transfer does not orphan private files.
- Ensure that deleting or deactivating a member does not delete organization-owned evidence.

---

## Phase 3.2 — Read-Only Project Sharing

Launch collaboration with the lowest-risk workflow.

Allow a Project owner to invite a Viewer who can:

- Read saved evidence
- Read Notebook cards
- Review Research answers
- View generated reports
- View Workboard previews
- Download permitted reports

Viewers must not be able to edit project records.

This phase should verify authorization, invitations, removal, and private-file access before authored collaboration is introduced.

**Status: complete in the current scope.** Invitation acceptance, Viewer access, removal and deactivation, generated Report download, Notebook and Research reading, Workboard preview access, and private-file authorization are covered by automated server and iOS contract tests.

---

## Phase 3.3 — Authored Collaboration

After read-only sharing is stable, allow collaborators to add separately attributed content.

Support:

- Authored notes
- Authored Notebook cards
- Review comments
- Review decisions
- Research feedback
- Project activity history

Do not merge authorship. Every contribution must retain the identity of its author.

**Status: complete in the current phase.** Authorized web Editors and Owners can create and revise separately attributed Project notes and Notebook content. Editors, Reviewers, and Owners can add immutable attributed comments. Reviewers and Owners can open revision or missing-project-fact requests and resolve or reopen them. The activity history records each supported action without merging authorship. iOS intentionally presents these records read-only in the Project Hub.

---

## Phase 3.4 — Shared Evidence and Research

Allow authorized collaborators to:

- Propose evidence
- Approve evidence
- Reject evidence
- Review Research answers
- Mark answers as reviewed
- Request revisions
- Add missing project facts

Consider requiring Reviewer or Owner approval before a Research answer is marked as approved for a Project report.

**Status: complete in the current controlled-review scope.** Editors can propose evidence and Reviewers or Owners can approve or reject it through backend-enforced role checks. Review threads can target the Project, a Research answer, an evidence review, a Report Draft, or a Notebook card. Revision requests and structured missing-project-fact requests support attributed comments and explicit open, resolved, or dismissed states. A review decision does not automatically approve a Research answer, alter its immutable evidence, or turn Project context into authoritative code evidence.

---

## Phase 3.5 — Firm Controls

Add:

- Seat management
- Centralized billing
- Firm tags
- Report templates
- Organization branding
- Required disclaimers
- Review statuses
- Administrative controls
- Pooled or per-seat Research allowances
- Project ownership transfer
- Member deactivation
- Data-retention settings

Educational, governmental, and institutional accounts may reuse the organization structure with different licensing policies.

**Status: complete for the bounded current scope.** Seat limits and usage, pending invitations, member deactivation, role management, Project ownership transfer, review statuses, organization-owned tags and Project assignments, reusable Report templates, branding, required disclaimers, pooled or per-seat Research allowance policy and usage, and policy-only retention are implemented. Firm-control saves use backend permission checks, optimistic concurrency, server-owned administrative history, migration-safe defaults, and PostgreSQL persistence. New web and iOS Reports snapshot the selected template, branding, control revision, and combined disclaimers so later administrative edits cannot change an existing Report.

Billing identity and operation state remain server-authoritative and non-client-mutable. Payment-provider checkout, centralized invoicing, tax handling, and subscription mutation are intentionally deferred until the commercial firm plan is selected; the current client does not simulate or claim those financial operations. Retention does not delete data automatically.

---

## Phase 3.6 — Shared Workboard Editing

Implement shared Workboard editing only after ordinary collaboration is reliable.

Before release, define:

- Simultaneous-edit behavior
- Object-level conflicts
- User presence
- Change history
- Deleted-object restoration
- Offline edits
- Permissions for images
- Workboard snapshot history

This feature should not block the earlier firm release.

**Status: intentionally deferred.** Current collaborators receive a verified Workboard preview; simultaneous editing, presence, shared conflicts, and snapshot restoration are not yet enabled.

---

# Release 4 — Advanced Evidence Discovery

## Phase 4.1 — Retrieval Evaluation Program

Begin evaluation work earlier, during Release 2, even though the feature will not yet be public.

Create a dedicated evaluation dataset covering:

- Direct code questions
- Exceptions
- Cross-references
- Multiple-code questions
- Missing project facts
- Existing-building conditions
- Administrative provisions
- Accessibility
- Egress
- Fire protection
- Plumbing
- Mechanical systems
- Misleading questions
- Insufficient evidence
- Questions requiring agency guidance outside the current library

Measure:

- Correct section recall
- Correct passage recall
- Top-result relevance
- Missed exceptions
- Missed cross-references
- Incorrect candidate sections
- Candidate explanation quality
- Coverage limitations

Do not evaluate only whether one relevant section appears. Evaluate whether the candidate set is sufficiently complete for professional review.

**Status: expanded draft diagnostic program implemented; public gate remains blocked.** Permitext now has a separate retrieval dataset mapped to the canonical selected-evidence Research cases, a free deterministic evaluation harness, and a generated knowledgeable-human review packet. The current fifteen cases remain drafts with zero approved retrieval gates. At diagnostic depth 12, the current implementation recalls the expected sections and passages in all fourteen answerable draft scenarios and correctly identifies the remaining scenario as missing section context. The draft set now covers Mechanical Code 404.1, a prior-code building that crosses the Administrative Code's more-than-110-percent floor-surface-area threshold, existing-installation plumbing repair boundaries, a fire-district question governed by official Appendix D map images, a referenced plumbing table, and a Buildings Bulletin/Zoning/Housing Maintenance boundary. Every answerable draft currently has 100% expected-section and expected-passage recall at depth 12.

The diagnostic now treats incomplete source forms as failures rather than successful text matches. A candidate that contains official images or refers to a table whose complete structured values are unavailable is blocked from preparation and identifies the additional source review required. When a complete official table is present in the enacted source, Permitext now extracts its row and span structure, assigns a stable integrity-addressed source identity, and requires that structured source to accompany the approved passage into Research. Questions that invoke Buildings Bulletins, the Zoning Resolution, the Housing Maintenance Code, HCR, FDNY, federal accessibility, Landmarks, or DEP authority receive a separate outside-scope disclosure with an official source link. This is useful engineering evidence, not release approval. A dedicated Buildings Bulletin corpus, structured official map/image evidence, additional outside-agency interpretations, and broader structural and occupancy-change existing-building scenarios remain coverage gaps.

---

## Phase 4.2 — Find Relevant Evidence

Create a separate Research entry point:

1. User enters a project question.
2. Permitext searches the canonical code library.
3. Candidate sections and passages appear in an Evidence Tray.
4. Permitext explains why each candidate may be relevant.
5. The user approves, rejects, or adds evidence.
6. Only approved evidence enters Analyze Selected Evidence.
7. The final answer identifies remaining coverage limitations.

Automatically retrieved evidence must never be silently presented as approved authority.

Clearly distinguish:

- Candidate evidence
- User-approved evidence
- Supporting evidence
- Additional recommended evidence
- Evidence outside the current library

### Release gate

Do not publicly launch Find Relevant Evidence until evaluation demonstrates dependable candidate discovery across the approved scenario categories.

**Status: private-beta web prototype implemented; public launch remains disabled.** A Research-entitled user can enter a Project question, receive deterministic hybrid lexical and curated-topic candidates from the canonical enacted-code library, review the retrieval explanation and coverage limitations, approve or reject each passage, open its enacted source, and prepare only the approved passages in an empty Research conversation. Preparing evidence does not generate an answer or make a paid model call; Analyze remains a separate user action. Map/image-dependent and incomplete-table candidates visibly explain why text alone is insufficient, cannot be approved for preparation, and still allow the professional to open the enacted source. Outside-scope authorities are separated from Construction Code candidates and link to authoritative starting points without claiming that Permitext retrieved or analyzed those materials.

The server requires the private-beta environment flag in addition to the Research entitlement, all returned evidence is explicitly unapproved, and the production capability stays unavailable until knowledgeable-human review produces approved scenario gates. This assembly workflow is web-first; iOS receives the capability contract and retains access to synchronized Research history but does not expose candidate assembly in this release.

---

# Release 5 — Zoning Resolution

Treat zoning as a separate content and validation program.

### Implementation status — July 24, 2026

The Zoning content and reader milestone is implemented and locally validated on
the web and in the iOS application.

- The canonical package is sourced from the official NYC Zoning Resolution site
  and identifies its text as current through July 16, 2026.
- The package contains 14 Articles, 101 chapters, 16 appendix pages, 4,068
  provisions, 305 tables, 208 map references, 13,141 amendment events, and the
  locally required map and document assets.
- Web and iOS support the Zoning library as a separately identified, teal-themed
  code source with browsing, chapter reading, section reading, search, saved
  sections, notes, Project linking, and direct section links.
- Zoning Research remains disabled. Six Zoning evaluation scenarios exist only
  as unapproved human-review drafts; they do not authorize public AI analysis and
  no paid model calls are made by the validation suite.

## Content foundation

Build a canonical zoning package preserving:

- Article
- Chapter
- Section
- Subsection
- Appendix
- Table
- Map reference
- Special district identity
- Amendment history
- Effective date
- Version

## Reader and Search

First add zoning to:

- Reader
- Search
- Saved sections
- Notes
- Projects
- Direct links

Do not immediately include zoning in AI Research.

## Research validation

Add zoning to selected-evidence Research only after:

- Section resolution is reliable.
- Passage identity is stable.
- Citation validation works.
- Tables and maps are handled correctly.
- Amendments and effective dates are represented.
- Zoning-specific evaluation cases pass.

Zoning must never be described as supported until the actual content and Research validation are complete.

**Status:** The content foundation and non-AI Reader/Search scope are complete.
Selected-evidence Zoning Research remains blocked until knowledgeable-human
review approves sufficient evaluation coverage and the table, map, amendment,
effective-date, passage-identity, and citation-validation gates are all met.

---

# Cross-Platform Synchronization Requirements

Before adding many new object types, define synchronization behavior for each type.

For every record, determine:

- Whether changes can merge automatically
- Whether conflicts occur by field or by entire item
- How deletion conflicts are handled
- How ordering conflicts are handled
- How offline edits behave
- How permission changes affect offline records
- How interrupted attachment uploads resume
- Whether the object is editable or immutable

Immutable objects should include:

- Historical Research answers
- Approved evidence snapshots
- Generated reports
- Activity-history events

Editable objects may include:

- Notes
- Notebook cards
- Project metadata
- Report Drafts
- Workboard objects

The system should not use a single generic conflict strategy for every record type.

---

# Privacy, Retention, and Deletion Requirements

“Immutable” means that a historical record cannot be silently edited through ordinary product workflows. It does not mean that Permitext can ignore account deletion, organization-retention policies, or lawful administrative deletion.

Define:

- User data export
- Account deletion
- Organization retention periods
- Project deletion
- Report deletion permissions
- Research and feedback retention
- Attachment and Workboard-asset deletion
- Deactivated-member access
- Legal or administrative deletion
- Audit records retained after ordinary content deletion

When content must be removed, preserve only the minimum tombstone or audit metadata needed to explain that a record existed and was deleted. Do not retain private content indefinitely merely because it once appeared in an immutable report or Research record.

---

# Recommended Execution Order

## Build now

1. Release 0 stabilization
2. Consolidate new Research on the conversation path
3. Project Record schema
4. Migration plan
5. Immutable evidence model
6. Focused activity-history model
7. Owner authorization and private-storage foundation
8. Capability and versioned sync-contract foundation
9. Thin vertical Project-linked Research slice
10. Focused Notebook
11. Focused web Project workspace
12. Read-only iOS Project Hub
13. Limited Report Draft
14. Unified Report Manifest
15. Initial web and iOS Project reports
16. Limited paid validation
17. Full web Project Studio refinement
18. Expanded professional exports

## Build after paid validation

19. Organizations — core scope completed
20. Read-only Project sharing — completed
21. Authored collaboration — completed for notes, Notebook content, comments, and activity
22. Shared evidence and review — completed for the controlled review workflow
23. Firm controls — bounded operational scope completed
24. Seat management and billing — seat controls and server-authoritative billing state completed; payment-provider checkout and invoicing remain deferred
25. Shared Workboard editing — intentionally deferred

## Develop and evaluate in parallel

26. Evidence-retrieval evaluation dataset
27. Find Relevant Evidence prototype
28. Zoning content pipeline — completed
29. Zoning Reader and Search validation — completed

## Release later

30. Find Relevant Evidence
31. Zoning Research — blocked pending knowledgeable-human evaluation approval
32. Advanced cross-code analysis

---

# Immediate Next Development Sprint

The bounded Release 3.5 firm-control scope is complete. The next sprint should
advance Release 4 evaluation readiness and production hardening without enabling
public evidence discovery, Zoning Research, shared Workboard editing, or paid calls.

## Sprint deliverables

1. Publish and monitor the firm-control schema migration against production PostgreSQL, including legacy organization defaults and immutable historical Report compatibility.
2. Turn the current retrieval draft packet into a focused knowledgeable-human review queue with explicit approve, revise, and reject decisions per scenario.
3. Expand deterministic retrieval coverage for mechanical systems, Buildings Bulletins, existing-building questions, non-text tables or maps, and outside-agency boundaries.
4. Preserve the answerable-versus-insufficient-evidence distinction as a hard evaluation gate; aggregate retrieval scores alone must not pass a case.
5. Keep every new evaluation case in draft until a knowledgeable reviewer approves its expected sources, required concepts, uncertainty conditions, and forbidden claims.
6. Add Zoning-specific evaluation drafts and source-coverage diagnostics while keeping public Zoning Research disabled.
7. Collect production evidence on firm invitation, Project transfer, review, Report-template, and native Report-download workflows before expanding collaboration authority.
8. Write the commercial decision brief for centralized firm checkout and invoicing, including provider, tax, seat-change, cancellation, refund, and audit requirements; do not simulate payment operations in clients.
9. Record iOS cold-start timings on representative devices and preserve the first-paint-before-prewarm contract as a regression gate.
10. Continue deferring simultaneous Workboard editing until ordinary collaboration has production experience.

## Current sprint checkpoint — July 25, 2026

1. The firm-control migration and legacy-default behavior are published on
   production PostgreSQL, and production health reports the PostgreSQL repository.
   Immutable historical Report compatibility remains covered by automated
   contracts. A full signed-in production workflow still requires a designated
   test account and must not be simulated with real customer records.
2. Private Research, retrieval, and Zoning review queues now expose separate
   Approve, Send for revision, and Reject decisions. Dataset mutations remain
   local-only and reviewer-controlled; the production owner console is read-only.
3. Mechanical, prior-code floor-surface-area, existing-installation plumbing
   repair, fire-district map, referenced-table, and Buildings
   Bulletin/Zoning/Housing Maintenance boundary scenarios are added and pass
   the draft diagnostic. Text-only preparation is blocked when
   an official map or image is required. Complete official tables now retain
   integrity-addressed row and span structure as separately approved Research
   evidence; incomplete table references remain blocked. Outside-scope
   authorities receive official source links. Dedicated Buildings Bulletin
   ingestion, structured official map/image evidence, additional agency
   interpretations, and broader structural and occupancy-change
   existing-building scenarios remain named gaps rather than implied coverage.
4. The answerable-versus-insufficient-evidence distinction remains a hard case
   gate, and all fourteen answerable draft cases currently achieve complete
   expected section and passage recall at diagnostic depth 12. The map and table
   scenarios additionally hard-fail if text-only preparation is allowed.
5. All new Research, retrieval, and Zoning scenarios remain drafts. No scenario
   was automatically approved and no paid model call was made.
6. Zoning has its own draft dataset, source-coverage diagnostic, evidence
   hydration, and review queue. Public Zoning Research remains disabled.
7. Server contracts cover invitation, transfer, review, Report-template, and
   native Report-download authority. Non-mutating production deployment evidence
   is collected at publish time; account-specific end-to-end proof remains blocked
   until a designated test account is available.
8. The centralized billing decision brief recommends Stripe Billing with
   explicit seat, tax, cancellation, refund, audit, webhook, and iOS purchasing
   boundaries. No client simulates provider payment state.
9. Startup signposts and regression ordering are implemented. Two current iPhone
   simulators record 1.15–1.45-second usable-content timings; physical iPhone and
   iPad measurements remain release-candidate checks.
10. Simultaneous Workboard editing, presence, and object-level conflict work
    remain deferred.

## Required boundaries

- Preserve the current one-Project-at-a-time Project Studio and its borderless, filled-control visual language.
- Keep the constrained Tiptap Notebook and Permitext-owned canonical JSON.
- Do not begin simultaneous Workboard editing, presence, or object-level conflict work in this sprint.
- Do not enable public Find Relevant Evidence or Zoning Research until knowledgeable-human scenario approval exists.
- Do not use Project notes, review comments, firm templates, or disclaimers as authoritative code evidence.
- Do not make paid Research calls during implementation or validation without explicit approval.
- Treat retention configuration as policy only until deletion, legal-hold, export, audit, and rollback behavior has a separately reviewed design.

---

# Final Product Principle

Every new capability must strengthen at least one of the following:

- Finding applicable code language
- Understanding related provisions
- Preserving evidence
- Recording project-specific reasoning
- Identifying uncertainty
- Reviewing conclusions
- Communicating code research
- Maintaining a defensible research history

Features that do not strengthen one of these goals should be deferred.

Permitext should become the place where a professional can reconstruct:

- What question was asked
- Which code edition applied
- Which evidence was reviewed
- Which assumptions were made
- What information was missing
- What conclusion was reached
- Who reviewed it
- What was ultimately communicated

That is the professional value Permitext should build and sell.

# Permitext Feature Roadmap

## Summary
Permitext should be built first as a trusted, NYC-first professional code workspace, then expanded into a synchronized multi-device product, and only later into a collaboration and public discussion platform. The implementation order should optimize for three things: immediate user utility, future web compatibility, and monetizable private workflow.

The product pillars are:
- `Trusted code reading`: official, version-specific, jurisdiction-specific code text presented clearly and quickly.
- `Private workflow`: bookmarks, notes, tags, project organization, history, exports.
- `Cross-device continuity`: the same work context available later on iPhone, iPad, and web.
- `Structured collaboration`: private shared projects before any public forum.
- `Public interpretation layer`: added only after the core workflow is clearly valuable and trusted.

## Implementation Plan

### Phase 1: Strengthen the Core iPhone Product
Build the strongest possible single-user professional workflow before any backend work.

- Improve reader navigation:
  - Faster movement between jurisdiction, code book, chapter, and section.
  - Better recent history and "continue reading" behavior.
  - Cleaner deep linking internally to specific sections and chapter positions.
- Improve personal organization:
  - Expand bookmarks into richer saved items with tags, project assignment, and note metadata.
  - Treat current folders/projects as first-class workspaces in the UI.
  - Add manual sorting, recents sorting, and code-order sorting inside projects.
- Improve notes and annotation UX:
  - Make note-taking faster and easier from section detail screens.
  - Support clearer distinction between saved section and attached note.
  - Add note presence indicators in list and reader views.
- Improve export value:
  - Make export packets feel like intentional project deliverables rather than a raw saved-items dump.
  - Include project name/context, section references, and notes in a clean professional layout.
- Add trust-focused UI separation:
  - Official code text always visually distinct from user-created notes.
  - No UI that suggests user annotation is part of the official source.
- Add feature gating scaffolding:
  - Introduce app-side plan/entitlement checks for future `Free`, `Pro`, and `Team` limits.
  - Start with local-only gating if needed, but isolate the entitlement logic behind a service interface.

### Phase 2: Refactor for Future Sync Without Shipping Web Yet
Prepare the app so mobile-to-web sync can be added later without rewriting the product model.

- Separate domain logic from local persistence:
  - Move SQLite-specific assumptions behind repository/service boundaries.
  - Prevent views and top-level view models from depending directly on local-only storage semantics.
- Introduce stable IDs and future sync fields for user-created data:
  - Projects, notes, bookmarks/saved items, and tags should have stable client IDs and timestamps.
  - Add local metadata needed for future merge/sync behavior, such as created/updated timestamps and dirty state.
- Define visibility and ownership concepts in the app model now:
  - `personal`
  - `project`
  - `public`
  These can remain unused in v1 UI beyond `personal`, but the model should not assume everything is private forever.
- Define continuity state as a first-class concept:
  - current jurisdiction
  - current version
  - current section
  - current project
  - recent history
- Add iPad-capable layout structure:
  - Do not fully redesign for iPad yet, but stop hard-coding phone-only assumptions in navigation and layout.
  - Prepare screens for future split-view / side-panel presentation.

### Phase 3: Launch Paid Individual Workflow
Monetization should begin with private utility, not community features.

- Define free tier:
  - code reading
  - search
  - limited bookmarks/saved sections
  - limited notes/projects
  - basic recent history
- Define `Pro` tier:
  - unlimited bookmarks, notes, tags, projects
  - premium export workflows
  - advanced sorting/filtering
  - continuity features
  - later, cross-device sync
- Add plan-aware limits and upgrade surfaces:
  - save limits
  - export availability
  - project count limits
  - advanced organization features
- Keep the reader itself useful in free tier so the product can still grow organically.

### Phase 4: Add Account System and Synchronization Backend
Once the private workflow is solid, introduce the server-backed model required for web and collaboration.

- Add account identity with no email requirement as the default:
  - `Sign in with Apple`
  - passkeys
  - guest/local mode for immediate app access
  - public username separate from login identity
- Build backend ownership of:
  - users
  - entitlements
  - projects
  - saved items / annotations
  - continuity state
- Keep mobile SQLite as offline cache:
  - local reads stay fast
  - offline work continues to function
  - server becomes the source of truth for signed-in users
- Add sync behavior for:
  - bookmarks/saved items
  - notes
  - projects
  - recent history / continuity context
- Add migration path for local-only users:
  - first sign-in can attach local data to new account
  - no destructive replacement of local data without explicit migration behavior

### Phase 5: Ship iPad Support and Web Continuity
Once sync exists, the product can become a real multi-device workspace.

- Enable iPad target support and adapt the UI for larger layouts:
  - side-by-side code and note/project panels
  - improved comparison mode
  - better long-form reading and project review
- Implement web reading continuity:
  - users can reopen the same section/project context on the web
  - web can restore recent working context instead of landing on a generic home screen
- First web release should focus on:
  - reading code
  - searching
  - viewing/saving notes and projects
  - continuing work started on mobile
- Web should be productivity-first, not marketing-first.

### Phase 6: Add Private Collaboration
Collaboration should begin in private projects, not public discussion.

- Convert projects into shareable workspaces:
  - owner
  - collaborator/member
  - optional read-only viewer later
- Allow members to:
  - view project sections
  - add their own notes/annotations
  - sort and organize shared project content
- Keep authorship visible:
  - users should know which annotation belongs to which collaborator
- Avoid shared editing of one note in early versions:
  - model annotations as authored objects instead
  - support multiple notes on the same section rather than concurrent editing conflicts

### Phase 7: Add Public Discussion Layer
Only after the product is trusted as a serious tool.

- Public discussion should be section-anchored, version-aware, and structurally distinct from private workflow.
- Add forum entities:
  - threads
  - comments/replies
  - votes
  - reports
- Add thread types:
  - interpretation
  - field question
  - plan review
  - example/application
- Keep public content clearly separate from official code text and private notes.
- Add moderation basics from day one:
  - report post/comment
  - mute thread
  - block user
  - rate limits
  - moderation removal tools
- Do not launch with full Reddit-style complexity:
  - no DMs
  - no elaborate reputation system
  - no generalized social feed disconnected from code sections

## Important Interfaces and Product Concepts
The implementation should stabilize around these product concepts even before all backend pieces exist:

- `Code section`: official source text object, version-specific and jurisdiction-specific.
- `Saved item / annotation`: user-authored object attached to a section, with note content, tags, timestamps, author, and visibility.
- `Project`: organized workspace that groups saved code items and notes by job/use case.
- `Continuity context`: the last or current reading/project state used across devices.
- `Entitlement service`: plan-aware feature access abstraction for Free / Pro / Team.
- `Visibility`: `personal`, `project`, `public`.

## Test Plan

- Reader/navigation:
  - switching jurisdiction/version preserves sensible context
  - recent history and continue-reading restore correct sections
  - official text remains visually distinct from annotations
- Personal workflow:
  - bookmark/note/tag/project actions persist correctly
  - sort modes are stable and predictable
  - export packets contain correct sections and note content
- Entitlements:
  - free-tier limits are enforced consistently
  - upgrade surfaces appear at the right action boundaries
- Sync readiness:
  - local models carry stable IDs and timestamps
  - signed-in migration does not duplicate or lose local data
- Cross-device continuity:
  - a saved working context reopens on another device correctly
- Collaboration:
  - project membership gates access properly
  - authorship is visible on shared annotations
- Public discussion:
  - threads attach to the correct section and version
  - moderation/reporting flows work before broad rollout

## Assumptions

- Default product strategy is `workflow first, community later`.
- Default geography/version strategy is `NYC-first` rather than multi-jurisdiction expansion now.
- Default monetization strategy is `private utility behind paywall`, not paywalled public discussion.
- Default account strategy is `guest mode + Sign in with Apple + passkeys`, with no email requirement.
- Default collaboration strategy is `private shared projects before public forum`.
- Default web strategy is `backend-first sync architecture`, not a direct port of the iPhone app or a web-only rebuild.

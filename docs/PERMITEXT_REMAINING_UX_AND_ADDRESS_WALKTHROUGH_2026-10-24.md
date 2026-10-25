# Permitext remaining UX fixes and manual proposed-building walkthrough

Date: October 24, 2026 (America/New_York). Branch: `codex/ux-release-eight-points`. Baseline: `f2232e9d1`. Final web version: `20261024-ux-remaining-v1358`.

## Outcome and evidence boundary

F06, F12, F14, F15 and F16 are implemented and verified locally. The production walkthrough now uses **manually entered proposed-building facts**, following the user's explicit correction. Existing-property import is optional in the local implementation. No code was pushed or deployed. Production still runs its previous UI.

The original audit's nine production columns remain mounted with the same IDs. The manual-facts audit Project remains open separately, with Context and Facts visible.

| Requirement | Implemented behavior | Verification |
| --- | --- | --- |
| F06 related provisions | Existing source relationships explained and grouped; inline exact-source review; title filters and explicit inclusion | Local UI, client events and real local HTTP discovery/review/inclusion checks |
| F12 calculator continuity | Named rooms; persistent account/Project/edition drafts; shared recent choices; separate saved Notes; focused handoff preview | Local UI reload, Reader/toolbar, multiple drafts, stale-view protection, saved Note and Report; draft/arithmetic contracts |
| F14 terminology/inclusion | Ask Assistant actions; visible Report membership for Notes, evidence and answers; direct destination opening | Local UI for Notes/evidence, actual answer handoff contract, three-source navigation tests |
| F15 project onboarding/facts | Starting actions; manual-first Project setup; explicit existing-record import; clear all/core toggle; expandable fact categories; complete Project names | Local new-Project UI and details, production manual fact persistence; existing concurrency/access contracts |
| F16 Search scope | Per-column temporary codebook/edition selection; separate browsing-library settings | Local UI and actual Search response; scope/pagination/stale-account/storage contracts |
| Revised walkthrough | Proposed design entered manually; unknown design/code facts left unrecorded; no imported building inventory | Production UI and reload; local explicit passage handoff |

## Why the address walkthrough changed

The first production attempt used the public `350 Fifth Avenue, Manhattan, NY` address. The Project creation flow automatically attempted a property import, and showed a generic failure. A public-service diagnostic returned the correct Manhattan lot, `1008350041`, labeled “New York.” The existing address matcher rejected the Manhattan/New York label difference. A direct diagnostic using that BBL resolved property data, but the inventory record used `338 5 AVENUE` for the lot. These observations are not evidence that either address describes proposed work.

The user then requested manual facts because the use case is new buildings and ZoLa describes existing conditions. That request superseded finishing an automatic-import walkthrough. The experimental address-candidate endpoint was removed before completion. The shared property lookup and Research engine remain unchanged.

The local Project form now:

1. Saves a typed address without automatically querying property inventory on blur or Save.
2. Explains that proposed-building facts are entered manually in Project details.
3. Offers **Import existing NYC property records (optional)** as an explicit action.
4. Labels imported records as existing-property inventory and asks the user to review applicability.
5. Preserves the entered address when a lot record reports another address, and makes that difference visible.
6. Reads structured API error codes correctly instead of losing the specific no-match explanation.

The optional import path still uses the existing matcher; the Manhattan/New York matching limitation is recorded rather than silently changing Research behavior. Refresh/import of corrected official records was not completed in this revised manual walkthrough.

## Production manual-facts scenario

Project: **UX MANUAL FACTS — Proposed New Building — 2026-10-24** (`web-project-mvn6enbj`). Address retained: `350 Fifth Avenue, Manhattan, NY`.

The context explicitly says this is a fictional UX scenario, does not describe or propose actual work at the Empire State Building, and must not use existing ZoLa inventory as proposed-design facts.

| Field | Manually entered scenario |
| --- | --- |
| Project status | Proposed new building; fictional audit; no approval established |
| Work / filing type | New building proposed; filing basis and approvals unverified |
| Occupancy | Proposed office use only; classification to verify |
| Stories above grade | 5 proposed stories; fictional design assumption |
| Sprinkler protection | Proposed fully sprinklered; standard and design unverified |
| Building area | 60,000 gross ft² proposed total; fictional assumption |
| Residential units | 0 proposed for the office-only scenario |
| Construction type | Left blank/unrecorded |
| Code basis | Left blank/unrecorded; need for verification stated in Context |

After reload, the manual values persisted and displayed **Stated**. That label describes their provenance; it does not mean approval, official verification or a complete code determination. Construction type and code basis remained blank. No official building facts were imported into this Project.

## F06 — review related provisions without a Reader detour

Candidates retain the existing discovery order, exact section identity, edition and reason. The UI groups Parent scope, References in included text, Broader topic suggestions, and Unresolved references. Broader suggestions start collapsed when direct relationships exist. Topic explanations show literal question/title overlap when present; no overlap is honestly identified as a broader suggestion, not a relevance score.

**Inspect exact text** obtains the existing canonical review payload inline. **Open in Reader** remains available. Both paths preserve section/edition/hash checks, require nonempty exact text and reject content requiring separate visual review. A failed second inspection clears the prior staged/reviewed state before retrying.

The user may filter titles or hide comma-separated title terms. These are presentation filters; they do not change discovery or ranking. Hiding a selected candidate explicitly deselects it. The displayed count explains this behavior. Review and selection still do not attach evidence; **Include selected passages** is required, with the existing revision guards.

In the local walkthrough, 13 candidates appeared in the existing groups. BC 1004.3 was inspected inline, with no Reader column added. Filtering out its title removed it from the staged selection. It was not added as irrelevant evidence to the office calculation.

## F12 — calculator drafts, rooms and snapshots

A calculation can carry a room/space name. Device drafts persist in the account's managed private storage namespace, isolated by Project, exact section, edition and manual/answer-specific context. Reader and toolbar offer the same recent manual calculations. Answer-specific prefill remains separate. Starting another calculation retains earlier drafts and saved Notes.

The UI distinguishes editable device drafts, saved Notebook snapshots, and changes not saved to a new Note. A saved snapshot is never overwritten by draft edits. Room names appear in the saved Note title and content. Storage corruption/quota failures surface an error; existing unreadable data is not replaced. There is no automatic draft eviction.

If the same draft changes in another mounted view, the older view locks its inputs and offers **Reload device draft**, avoiding a silent overwrite. This was verified with simultaneous toolbar and Reader cards. These drafts are local to this browser/device; this work does not add cross-device synchronization.

The local scenario used “Level 2 office,” 12,000 gross ft², the canonical Business areas row and explicit no-fixed-seating input. It showed the unchanged arithmetic result of 120 people, survived reload, saved a named Note, reopened from Reader and was retained when another room draft was started. This arithmetic preview is not a compliance finding.

The handoff preview now starts with the chosen room, row, inputs and associated footnotes. The full exact included section is available under **Full section included · review exact text**. The prepared Research question and inclusion payload remain unchanged. Clicking **Include and prepare question** added one explicitly reviewed passage and prepared the question without sending it or automatically including saved Project Context/Facts.

## F14 — clear action names and Report destinations

Primary passage/Note actions consistently say **Ask Assistant**; new/existing conversations are named as such. RESEARCH remains the workspace name. Existing Research records and metadata retain their identities.

Notes, saved evidence and Assistant answers show Report membership on their existing action. Included material reads **Included in Report · Open**. Clicking it revalidates membership, opens the correct Report, and asks which destination when the source belongs to multiple Reports. Removed membership, cancellation, account/workspace changes and failed navigation cannot leak a pending destination into a later operation.

Exact evidence identity includes section, source edition and selected block. Existing Note snapshots also count as included. Report source deduplication was retained. No extra Notebook footer was introduced.

The walkthrough saved the named calculation Note to a Report, then opened that destination from its inclusion action. It also saved BC 1004.1.3 to Project Evidence and verified that its separate action changed to the included/open state. Actual answer handoff and destination behavior were checked with local tests; this pass did not generate a new paid answer to test that button.

## F15 — useful starting points and fact hierarchy

A new/empty Research view offers actions to review Context/Facts, find a provision, open a codebook, and choose saved evidence. Testing caught the hidden Notebook Evidence pane suppressing this card; the final condition uses the count of visible Research panes, preserving hidden pane state.

Facts use expandable categories and recorded/review-needed counts. **Show all facts** and **Show core & recorded facts** describe the action clearly. Core fields and manually recorded values remain visible when returning to the concise view. Existing source/provenance/review controls are preserved. Complete Project names are taken from the accessible Project record, and menu labels wrap so distinguishing suffixes remain available.

Local UI checks covered a long Project name, the manual-first form, starting actions and proposed facts within the existing categories. Existing Project access, resize, mutation and durable-save checks passed.

## F16 — temporary Search scope

**Search within** opens a per-column chooser containing currently enabled library sources. It supports clear selection, all enabled sources, cancellation and explicit Apply. Exact editions remain separate. **Manage browsing library…** is a separate, clearly labeled action.

Selection persists with the Search column. It intersects with enabled browsing sources at request time; it cannot re-enable a globally disabled source. An explicitly empty selection produces no results rather than unrestricted Search. Stale responses and pagination retain the scope token and exact query scope. Saved references and Reader access are not rewritten.

The local UI selected only BC 2022 and searched “occupant load.” Results came from that edition while the chooser's full enabled-library inventory stayed available. Tests verified explicit empty/all behavior, edition separation, pagination, account changes and persistence.

## Validation and limits

- **26 focused local test files passed**, zero failures. The exact result log is retained with the browser artifacts.
- All **94 protected Research files** match the baseline SHA-256 values, including the server app and failure-recovery module.
- `calculateOccupantLoad`, `occupantLoadTableInput`, `occupantLoadFootnoteQuestion`, `occupantLoadFootnoteAssessment`, `occupantLoadFootnoteState`, and `calculationNoteBlocks` are byte-for-byte unchanged.
- The isolated preview uses synthetic records, clears provider credentials, and rejects external/provider fetches. Production changes in this pass are confined to the explicitly requested audit Project and its manually authored context/facts.
- Research models, prompts, source discovery/ranking, review/repair and verification behavior were not changed.
- There was no new paid model run, production deployment, mobile audit, or claim that the original production calculator-to-Research generation failure is now resolved. This follow-up verifies UX, persistence, provenance boundaries and deterministic/local contracts.

## Retained proof

Artifact directory: `/Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/remaining-five-ux`.

- `manual-proposed-facts-production-final.png`: saved production manual scenario after reload.
- `manual-first-project-setup.png`: explicit optional existing-property import.
- `project-start-actions.png` and `project-manual-fact-groups.png`: onboarding and fact hierarchy.
- `search-query-scope.png`: query-specific BC 2022 results.
- `related-inline-exact-review.png`: exact text review without a Reader detour.
- `calculator-saved-snapshot.png`, `calculator-focused-review.png`, `calculator-shared-recent-final.png`: named draft, saved snapshot, focused handoff and shared continuity.
- `assistant-explicit-handoff.png`: prepared question and explicit passage inclusion.
- `note-included-open-report.png`: included Note action.
- `production-columns-before.json` / `production-columns-after.json`: the same nine production pane IDs remain present.
- `research-engine-baseline.json`, `preservation-check.json`, `final-tests.log`: preservation and test evidence.

# Permitext — original eight UX findings implementation

Branch: `codex/ux-release-eight-points`

Base commit: `d23b6a1f8e593556344417d2a5595e386e87fab7`

Local client: `20261024-ux-release-v1356`

This records the implementation of the eight points in the original audit summary. The production observations remain in [the detailed audit](PERMITEXT_PRODUCTION_UX_AUDIT_2026-10-24.md). Verification below is local; it does not establish a production deployment or live model reliability.

## Scope decision after reviewing the earlier Research work

The user explicitly chose **preserve Research behavior; fix UX and confirmed metadata bugs**. Commit `2d6f9588cd5b956bf47a3a8854b5a12030b40527` deliberately limited Assistant attachments to selected Reader passages. Earlier commits also established calculator-footnote reasoning and conservative failure recovery. These boundaries remain in place.

This pass does not change the substantive model, prompts, citation validation, source acquisition, answer generation, review/repair, budgets, or automatic retry policy. Project Context and Facts remain excluded unless the user states information in their own question. The public Search index repair is separate from the Research retrieval engine.

## Outcomes

| Point | Implemented outcome | Verification |
| --- | --- | --- |
| 1. Report provenance | New selected-passage turns identify the actual included editions and state that no additional sources were searched. Live conversation metadata matches the completed answer. A new report snapshot preserves that basis. An excluded Project default is not described as a failed search. | Exact current/historical/mixed/unknown-edition tests; real local HTTP answer → immutable record → report manifest; PDF text extraction. |
| 2. Calculator Research recovery | Verification failures offer **Review question and passages**, with an explicit option to restore the original question as an editable draft. Existing writing is never overwritten and this action does not submit a paid request. Verification-recovery messages lose ordinary Note/Report handoff actions and are excluded from the new-report Research picker. Interrupted requests retain the existing same-request Retry behavior. | Recovery policy, transport/idempotency, account/navigation guards, existing calculator handoff contracts. No live model request. |
| 3. Project context clarity | New-chat onboarding explains selecting exact passages first and why Send is disabled. It identifies the Project Context/Facts exclusion and tells users to state relevant assumptions in their question. This replaces the initial proposal to broaden context access. | Rendered new-chat flow; selected-only HTTP scope/privacy tests. Context is not attached automatically. |
| 4. Saved evidence scope | Evidence Detail shows the exact saved passage separately from the containing section. Heading-only selections are flagged before a question. **Review containing section…** previews canonical text from the same edition before explicitly adding it for future questions. Prior answers and original passages remain intact. | Rendered save of `Exceptions:` → Evidence → Detail; rendered Research warning → canonical section review → two included passages, no submitted question; cancellation/stale/visual-source tests. |
| 5. Search findability | Public Search indexes the complete text it actually matches, including separately stored tables. Ancestor headings improve subject ranking. Distant matching excerpts remain visible in the client. Query `occupant load business` surfaces BC 2022 §1004.1.3 and its Business areas row. | Real corpus HTTP and offline contracts; prepared-runtime parity previously checked; rendered compiled-runtime search. Source/edition and pagination checks pass. |
| 6. Note destination | **Add to note…** names the active Note and offers another existing Note or a New Note. Closed Notes are loaded at their current version and saved with compare-and-set and a stable mutation ID. Successful feedback names the destination. Opening it is explicit. | Rendered insertion into Synthetic Note 3 while Synthetic Note 4 remained intact; original writing and linked answer both present; real HTTP CAS update; cancellation, offline-open-Note, stale-view/account and changed-target tests. |
| 7. Report readability | Research findings have independent editable report titles. New additions default to a concise export, with a reversible option for the full question and detailed source basis. Only exact duplicate display blocks are omitted; substantive analysis and qualifications remain. Note snapshots keep their titles and lineage. Context/Facts labels differ. Internal preservation instructions are removed from displayed fact qualifications while original snapshot wording is retained. PDF headings reserve space for their first paragraph, and compact calculations stay together. | Rendered snapshot/title editing and saved state; HTTP title/metadata persistence; rich-text/source-formatting/immutable-version tests; 9-page rendered stress PDF with 12 heading/body pairs and 12 intact calculations. |
| 8. Column navigation | Reader headers and collapsed labels include section identity. Adding a passage reveals its destination Assistant. Eligible ungrouped columns expose **Group columns…**; the existing editor and saved-group behavior are retained. Research success uses an accessible, dismissible confirmation outside the toolbar layout; it expires and pauses while hovered/focused. | Rendered group creation for Search + Assistant, Reader section identities and destination behavior; notice account/action/timer guards; workspace restore and linked-column placement contracts. Production columns remain open. |

## Confirmed causes

- **False source-search provenance:** `handleResearchConversationMessage` created basis metadata through the ordinary corpus router even when selected-only analysis used the search-free evidence package. `selectedEvidenceCorpusPlan` now records only included evidence editions for that path.
- **Missing table result:** legacy postings omitted table terms even though complete section text and matching logic already contained them. `completeSearchTextIndex` adds postings from that same complete public-search text. Prepared Search runtime schema 2 prevents accepting old compiled postings in hosted builds; local legacy postings fall back to reconstruction.
- **Matched row hidden after search:** the client clipped a multi-excerpt result to 230 characters. It now retains the bounded excerpt windows, including the matched Business areas row.
- **Implicit Note target:** the active Note was the only destination. The chooser now resolves an explicit target; updating a closed Note includes the server-required `cardID` and version.
- **Lost Note title after snapshot:** paragraph navigation used the start of body text. An independent `reportTitle` survives draft normalization and manifest creation and is used by the outline and PDF.
- **Missing group creation:** the group editor remained implemented, but the menu exposed only editing an already existing group. The creation entry is restored with the existing eligibility rules.
- **Persistent success strip:** Research used the persistent workspace-issue banner for a successful insertion. Success now has separate transient presentation; errors retain their existing recovery banner.

## Verification record

Forty focused scripts passed in the completed local verification set. This includes UX workflow, Research provenance/scope, Note destination/navigation, failure recovery, public/online/offline Search, report contracts/formatting/PDF, calculator handoffs, account isolation, workspace restoration, query-versioned bundles, offline asset revisions, shell activation and update-button guards. Generated search catalogs were rebuilt during this pass. The prepared runtime contract previously verified 2,437,471 postings against source-derived parity.

Two initial test failures were resolved:

1. The recovery-policy test expected an older `!assembledEvidence.length` guard. The untouched base commit already used `!assembledEvidence.length && !openInvestigation && !conversationOnly`. The static assertion now checks that existing boundary; the engine guard was not edited. The baseline mismatch is retained in the proof directory.
2. A workspace-restore VM harness needed the newly added transient-notice cleanup dependency. Its corruption-preservation checks pass after supplying the harness dependency.

The Note destination UI caught a missing `cardID` in the first closed-Note save attempt. That failed without overwriting the Note; the request was corrected and rechecked through both the rendered UI and real local HTTP route.

All provider-dependent behavior used isolated fixtures or provider doubles. No paid model test was run. Deterministic tests establish routing, persistence and presentation behavior; they do not establish live answer quality or frequency of the original calculator failure.

## Local proof artifacts

Proof directory: `/Users/randy/.codex/visualizations/2026/10/24/01a17034-6a03-7842-b20a-c151ed8b8e2b/ux-eight-point-preview/proof`

- `verification-results.json`: focused script results, including resolved initial failures.
- `baseline-recovery-assertion.json`: unchanged-base evidence for the stale guard assertion.
- `note-destination.png`: chosen existing Note, retained writing and new Research link.
- `group-editor.png`: restored creation action and eligible column choices.
- `exact-saved-passage.png`: heading-only saved text distinguished from surrounding section.
- `section-review.png`: explicit canonical containing-section preview.
- `research-destination.png`: the destination Assistant revealed with a compact confirmation.
- `table-search.png`: the Business areas row and factor visible in the result card.
- `report-title.png`: the persisted independent title and compact PDF detail option.
- `report-layout.pdf`: synthetic 9-page pagination verification, preserving the source manifest.
- Additional final-build screenshots document the persisted report title, grouping and visible table search excerpt.

## Boundaries and remaining audit findings

- Changes are local to this branch. No push, merge or deployment was performed.
- The production walkthrough used the hosted app. Its deployed Git SHA was not independently matched; local `main` does not prove which production assets were served.
- The original calculator-generated request failed once in production and a narrowed follow-up succeeded. This pass improves recovery UX but intentionally does not claim an answer-engine reliability fix.
- Historical answers and already issued PDF files are not rewritten. Corrected execution metadata applies to new selected-passage turns. Historical records retain the metadata they captured.
- The real-address/property-import path remains an explicit audit gap. Manually entered fictional facts did not test it.
- The other findings in the detailed audit remain observations, not implied completed fixes. This pass does not promise semantic summarization or remove distinct analysis merely because it sounds repetitive.
- No existing production columns were closed. The separate local fixture contains only synthetic data and retains its columns and test state for review.

# Column UX closeout

This is the finite closeout sequence for the authorized column plan, not a new design backlog. The detailed implementation/evidence history remains in PERMITEXT_COLUMN_UX_CONTINUATION.md. Source implementation, executable contracts, rendered checks, authenticated checks and physical-device checks are separate states. A pass is not complete merely because its code exists.

## 1. Saved recovery

Local implementation and recovery checks completed: project-specific removal labels, native Project Undo and native Saved Undo. Two SQLite tests pass, including newer-note/link preservation and deleted-project handling. Rendered guest Save -> Remove -> Undo passed in Reader 1 and independent Reader 2; test passages returned to their initial unsaved states. Recovery is session-local. Signed-in propagation remains part of the authenticated integration gate; physical checks are deferred. Do not reopen for unrelated Saved redesigns.

## 2. Research and workspace clarity

Implemented: web/native composer persistence, web conversation/layout restoration, native context actions and disclosure. The promised non-color bulk-selection cue and general-workspace explanation are now implemented. Workspace explanation was rendered locally; UI/offline contracts pass. Existing title fallback and context disclosure were inspected. Authenticated history selection/context interaction belongs to the final signed-in integration gate. No further design work or paid Research run is required by this pass.

## 3. Reader and Search verification

Implemented: source orientation, derived Reader behavior, web query/filter/page/selection/scroll restoration, native query/filter/row restoration, paragraph destinations and complete authored Search filtering. Verify native Recently viewed nonzero position restoration and the existing long-text/table/keyboard behavior. The legacy SQLite Search limit is a separately identified limitation, not a reason to repeatedly rework the validated authored Search path. Address only failures that prevent the agreed workflow.

## 4. Notebook, Report and project facts verification

Implemented: native linked-note identity/navigation, web Report draft-first source picker and pending-save protection, native fact provenance and partial-lookup feedback. Run the connected reference/edit/return and draft/save/export/disclosure checks once, using existing supported test surfaces where available. Record authenticated checks requiring account access separately rather than claiming they passed from source tests. Preserve immutable issued reports and unavailable-source warnings.

## 5. Account and final integration

Implemented: web Account modal and verified keyboard focus/close behavior. Verify local-save versus sync wording, archive recovery and native Account on available surfaces. Reconcile every original requirement to evidence or an explicit remaining access gate. Review and commit intended changes; preserve DO NOT DELETE.png. Report local commit, remote push and deployment separately. No deployment is implied by UI completion.

## Deferred by the user

Physical iPhone: touch targets/Dynamic Type, interruption/background recovery, reading sessions/tables, reference return/keyboard behavior. No physical-device completion claim. Authenticated flows are not automatically deferred with the phone: complete available checks and identify exact access requirements if the remaining checks cannot run.

## Stop rule for scope growth

No additional visual redesign, architecture cleanup, new feature or unrelated legacy fix. Reopen a completed pass only for a concrete failing requirement. Existing green tests do not need repetition absent a relevant code change or failure. Completion still requires the original plan; this sequence changes execution order, not the requested end state.

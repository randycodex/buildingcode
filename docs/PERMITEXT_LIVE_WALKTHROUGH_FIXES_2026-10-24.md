# Client fixes found in the production release walkthrough

The first production delivery was `9b1ba8b1b`. A fresh fictional proposed-building Project (`web-project-mvn7e3qm`) exposed three client issues during the live walkthrough.

## Temporary Search scope was lost on reload

BC2022-only scope worked immediately, but reload restored all enabled sources while retaining the query and phrase mode. `normalizeUtilityInstances` did not pass `querySourceKeys` to `newUtilityInstance`, and that constructor did not retain it. The normalization lines had also been placed in the Saved Evidence normalizer rather than the Search normalizer.

The client now preserves and validates the field through actual utility creation, workspace restore and Search normalization. Null still means all enabled sources, and an empty array still means an explicitly empty query scope. The test now exercises the actual app restore functions instead of relying only on the generic workspace-layout copy.

## Saved Evidence handed off the list preview instead of the full passage

The saved paragraph opened in Assistant as a 240-character fragment ending mid-sentence. Saved-row hydration already retained the full paragraph in `savedContentComparisonText`, but single and bulk Assistant handoffs preferred the shortened `previewText`.

Both paths now prefer an explicit `selectedText`, then the full saved comparison text, and use the card preview only as a legacy fallback. This retains deliberately shorter selections and heading-only legacy evidence; it does not automatically include a containing section. A real-handler test checks text beyond 240 characters, preservation of an explicit shorter selection, legacy literal headings, source identity and empty-text rejection.

## Reader insertion into an existing Note gave no confirmation

The passage was appended successfully to the current Note, but the Reader action returned without naming the destination or displaying the success link used for new Notes. Repeated clicks produced repeated passage references in the fictional audit Note. Those original records are retained as reproduction evidence.

A completed current-Note insertion now displays “Added to Note: [title]” and offers Open in Notebook when the saved Note has an ID. It refreshes the target after insertion and respects the account/workspace/navigation guard. Existing text and references are preserved; this change does not delete or automatically deduplicate earlier passages. The existing direct-handoff test now checks the named confirmation for saved and unsaved Note targets.

## Validation and boundaries

The full production build and 63 focused test files passed locally. Only client handoff/presentation/persistence logic, coherent asset versions and tests changed. Research models, generation, source discovery/ranking, verification and repair were not changed. The live generated calculator-footnote question still has a separately recorded verification failure; an explicit no-deduction recovery question passed. These client fixes do not claim to resolve that engine behavior.

Client version: `20261024-ux-live-v1359`. Production verification continues in the external walkthrough record and proof directory for this task.

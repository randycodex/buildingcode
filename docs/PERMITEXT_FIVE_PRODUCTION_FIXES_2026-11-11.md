# Five production walkthrough fixes — November 11, 2026

This change addresses the five findings from the latest production walkthrough. Verification used a local authenticated synthetic workspace and actual generated PDFs. Production records were not changed during this fix pass.

1. **Project context confirmation and Send timing.** Research now tracks pending context and evidence handoff operations by account generation and workspace. Both the Send control and keyboard submission wait until the operation finishes. New pane mounts inherit the pending state, drafts remain intact, and confirmed snapshot writes can publish after the original view is replaced. Five delayed confirmation/save/publish scenarios passed, including remounts. A browser check with a delayed context save retained the draft and blocked Enter until the reviewed snapshot was included.
2. **Letter footnotes in direct evidence tables.** Captured source tables retain superscript positions alongside unchanged plain source text. The Report manifest validates the positions, and preview/PDF render the native superscripts together with user formatting. Three enacted tables passed extraction and PDF checks. A PDF created through the browser from direct BC 1006.2.1 evidence showed raised letter markers and the merged header correctly.
3. **Baseline factor passage ranking.** Factor and allowance questions now rank by topical phrases, title relevance, body coverage and actual tables, while keeping the full question for retrieval. All 19 known-target discovery cases passed. Five baseline occupant-load questions placed BC 1004.1.3 first, including the production audit question; the browser reproduced the corrected first result. Existing ramp, handrail, corridor, exhaust and definition checks passed. Discovery does not claim that a provision applies or that a project complies.
4. **Literal inline Markdown in Assistant answers.** Live and historical answers render bold, italic and inline code safely as semantic text, preserving citation buttons and answer reveal behavior. Model HTML remains inert. Five synthetic answers passed browser checks; view/reveal regressions also passed.
5. **Saved Research-answer references in PDF.** Research references in Notes and editable Report content now export linked labels and printable canonical answer URLs. The authenticated workspace resolves the owned historical answer, selects its workspace, reuses an existing conversation column where available, and waits for the loaded pane before focusing the exact answer. A browser-created PDF contained all five unique link annotations. All five links were followed locally, each landing on the earlier saved answer despite a long later response. Unavailable answers, signed-out access, account changes and superseded navigation were covered by targeted tests.

## Verification

- `npm run test:five-production-fixes` — passed.
- `npm run test:production-workflow-fixes` — passed.
- `npm run test:report-evidence-export` — passed, including actual HTTP generation, immutable versions and authorization/revision fences.
- Targeted saved-evidence handoff, navigation races, Research view/reveal, Report rich text, startup and offline shell checks — passed.
- `npm run build:clients` — passed; generated Notebook bundle included.
- Client and shell versions updated for the changed modules.

Local browser evidence and the four-page verification PDF are retained under:

`/Users/randy/.codex/visualizations/2026/11/09/01a1be70-ba6a-7c42-9d33-71bbefb76a68/five-production-fixes-2026-11-11/`

The five seeded Assistant answers are clearly labeled synthetic test content. No paid model calls were needed. A push to main and an accepted production deployment are separate verification stages; this document records the local checks.

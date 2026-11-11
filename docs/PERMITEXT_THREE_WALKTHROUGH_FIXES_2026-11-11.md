# Three walkthrough fixes — 2026-11-11

Client: `20261111-three-walkthrough-fixes-v1665`.

| Finding | Change | Verification |
| --- | --- | --- |
| First source missing when a new Report is exported immediately | Source additions retain the destination draft's object identity while its first save assigns an ID. PDF creation waits for accepted additions and their saves. A failed addition prevents export and can be retried. | Five deterministic delayed-add/export cases, failure/retry and destination fences; six local browser PDF versions with immediate first-source additions, a repeat after refresh, and an immediate second-source export. |
| Pasted `<mark>` highlights disappear | The editor recognizes semantic highlights through its existing background-color style. Copied passage markup also retains highlight, underline and strike marks. | Pasted semantic and CSS-span highlights in paragraphs and a table cell; saved, reloaded, exported, and visually checked. |
| Superscripts flatten through Notes | Additive superscript support in the shared editor, source copier, canonical save contract, HTML output and PDF paragraph/table runs. Rebuilt web and native editor bundles. | Pasted numeric and nested alphabetic superscripts; copied BC 1104.3.1; save/reload and actual PDF checks. Raised, smaller exponents verified visually. |

Checks passed:

- `npm run test:three-walkthrough-fixes`
- `node tests/nine-workflow-regressions.mjs`
- `node tests/nine-workflow-images-http.mjs`
- `node tests/eleven-production-regressions.mjs`
- `node tests/report-source-formatting.mjs`
- `node tests/report-rich-text.mjs`
- `node tests/notebook-continuous-editor-contract.mjs`
- `node tests/notebook-report-promotion-contract.mjs`
- `node tests/offline-shell-coherence.mjs`
- `node tests/web-shell-cache-contract.mjs`
- `npm run build:notebook` and `npm run build:native-notebook`
- `git diff --check`

Browser verification used an isolated synthetic local fixture at port 8794. The
previous walkthrough fixture at port 8793 was preserved. Browser screenshots,
saved-style inspection and three downloaded PDFs are retained under
`/Users/randy/.codex/visualizations/2026/11/09/01a1be70-ba6a-7c42-9d33-71bbefb76a68/three-fixes-2026-11-11/`.

These checks establish local browser, persistence and PDF behavior. They do not
establish production deployment or physical iOS acceptance.

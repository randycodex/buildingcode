# Eleven production workflow fixes

The implementation follows the production recheck at `https://per.codes/workspace`. Existing issued reports remain immutable.

| # | Change | Verification |
|---|---|---|
| 1 | Both Report entry points flush pending Note edits and reject empty saved content. Image-only and referenced Notes remain valid. | Actual shared guard tested with empty, text, image, conflict and unsynced editor cases; Report handoff contract and authenticated HTTP suite. |
| 2 | Clipboard highlight colors normalize to the supported yellow. Definitively rejected saves retain their exact receipt in recovery and can be corrected; uncertain saves replay unchanged. Pending changes offers Open Note and Retry sync. | Transactional IndexedDB tests, newer-edit race, rejected legacy metadata, RGB HTTP round trip and local browser reload. |
| 3 | Project evidence no longer supplies its project-section ID as an account Saved item ID when opening Assistant. | Exact-text and source identity regression; global Saved IDs remain intact. |
| 4 | Evidence-to-Note always names its destination and offers New Note, including when the current Note is hidden. | Actual destination function tested for current, new and cancelled choices; local browser dialog. |
| 5 | Inline table-cell selection supports marks, highlight and links. | Local browser: bold, highlight, apply link, save, reload and Report handoff. |
| 6 | Assistant distinguishes stipulated hypothetical inputs from verified Project facts, gives table questions more drafting effort, and offers a specific safe failure reason with a fresh Retry action. | Engine writer/reviewer tests, immutable evidence checks, rejected-answer recovery and uncertain-network request-identity tests. A successful answer still requires full review. |
| 7 | Discovery removes audit prefixes and uses matching section titles to recover baseline provisions in long scenario questions. | Fourteen known-target discovery questions, including the production-style occupant-load question; no external provider calls. |
| 8 | Numeric superscript units preserve their paragraph flow. | Actual BC 1104.3.1 extraction and PDF text assertion; rendered PDF inspected. |
| 9 | Source and Note tables preserve merged cells in PDF, including repeated headers and rich links on continuation pages. | Actual BC Table 1006.2.1, five rich Notes, PDF text/annotations, unique continuation rows and visual inspection. |
| 10 | Report Versions includes the local timezone. | UI formatting regression. The PDF already explicitly used UTC; no timestamp defect existed in the PDF. |
| 11 | Failed NYC property import preserves manual work and provides a Try again action. | Actual lookup function tested through failure, explicit retry and successful import; property contract suite. |

Run the consolidated checks with `npm run test:production-workflow-fixes` from `permitext-sync-server`. Production build, offline shell coherence, Report contracts, source-export HTTP and spacing checks also passed.

Local PDF verification covered actual source headers and superscript units plus rich Note formatting, images and clickable URL/email annotations. Previously issued report bytes were compared after later Note edits and remained unchanged.

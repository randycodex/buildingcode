# Stitch visual adoption matrix (Phase 0)

- **Reviewed package path (planning time):** `/Users/randy/Downloads/stitch_permitext_professional_research_workspace (1).zip`
- **SHA-256:** `d316d9aeddf234fc2e3a1d2aa3f49d62d9607b831970bf5d5edca998e3a94159`
- **Role:** Visual reference only — not a runtime dependency, not production HTML.

## Keep

| Idea | Rationale |
| --- | --- |
| Candidates → Reader → Evidence Tray column arrangement | Matches Evidence stage professional desk |
| Approved Evidence → Bounded Analysis → Professional Conclusion arrangement | Matches Analyze stage separation of AI vs human conclusion |
| Calm, high-density professional workspace | Aligns with Permitext multi-column desk doctrine |
| Approximate chrome proportions (rail ~64px, header ~64px, pane header ~48px) | Subject to reconciliation with active CSS and accessibility |
| Restrained semantic color for Project context, source family, provenance, review, status | Compatible with Project color inheritance |

## Adapt

| Idea | How to adapt |
| --- | --- |
| Stage-oriented desk layouts | Implement as **workspace arrangements** inside the existing pane engine, not separate page shells |
| Dense pane headers and status chips | Use Permitext pane-header patterns, focus-visible outlines, and non-color state labels |
| Project/question context strip | Bind to active Project color and existing shell chrome; keep sync/offline indicators |
| Evidence tray grouping | Map to question-scoped Evidence Tray; preserve unassigned Saved views |
| Review / Issue readiness cues | Drive from server readiness derivation; never show “locked/final” before issuance commit |

## Reject

| Idea | Rationale |
| --- | --- |
| Direct import of Stitch HTML page shells | Duplicated static pages; loses offline, sync, a11y, pane state |
| Tailwind CDN / remote fonts / icon CDNs / avatars | Forbidden runtime dependencies |
| Fictional legal provisions as authority | Production fixtures must be verified or unmistakably synthetic |
| Numeric reliability / confidence percentages | False precision; use provenance labels instead |
| Border-heavy card treatment and gradients | Conflicts with edge-to-edge square main columns and no-gradient rule |
| Nonfunctional controls | Must not ship inert chrome that looks interactive |
| AI Reader highlighting as production truth | Selected-evidence boundary remains controlling |
| Pixel-identical Stitch palette/radii without CSS reconciliation | Phase 2+ must reconcile tokens with `styles.css` before adoption |

## Implementation rule

Phase 2+ UI work rebuilds **concepts** inside `public/app.js` / `workspace-state.js` / `styles.css`. No Stitch export file is copied into `public/`.

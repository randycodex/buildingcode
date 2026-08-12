# Permitext Research UI phases

## Phase 1 — Loading and truthful Research progress

Implemented on the web Research mutation without changing the governed answer or citation payload:

- An immediate Permitext-styled 3×3 pixel-grid loading state with a status label and elapsed timer.
- A compact task list driven by opt-in NDJSON events from real application/backend checkpoints.
- Completed, active, failed, cancelled, and retrying presentation states.
- Cancellation through the browser request signal and retry of an unsaved question.
- A collapsed, public progress summary stored beside completed conversation messages.
- Reduced-motion behavior that freezes decorative animation while the elapsed timer continues.

The legacy JSON response remains available for existing callers. Public progress events are allowlisted and contain only a stage ID, public label, public state, sequence, version, and timestamp. They never contain prompts, model reasoning, token usage, cost, internal limits, or provider details.

The native iOS app currently reads saved Research summaries in Project views but does not perform the Research message mutation. Phase 1 therefore preserves the web-only mutation boundary. If native Research submission is later introduced, SwiftUI should use the same six public stages and terminal-state meanings; no placeholder native control should precede that capability.

## Later phases — intentionally not implemented

These Beautiful UI-inspired patterns remain separate, independently reviewable phases:

1. Streaming Text
2. Context Cards
3. Approval Card
4. Prompt Bar
5. Reader Selection Actions
6. Diff Table

Beautiful UI is treated as design inspiration. No reusable component source is copied unless an explicit applicable code license is confirmed. Permitext remains on its existing JavaScript/CSS architecture and design tokens; this work does not introduce React or Tailwind into the critical Research workflow.

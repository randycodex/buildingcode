# Permitext UX/UI Governance

**Effective:** 2026-08-21

**Applies to:** Permitext desktop web and native iPhone app

This document turns the UX/UI alignment plan into a maintenance contract. It does not require identical layouts. It requires shared meaning, predictable outcomes, accessible recovery, and evidence-aware trust on both supported surfaces.

## Product language

Use these terms in user-facing interface copy:

| Meaning | Required term |
|---|---|
| Preserved enacted-code passage | **Saved** / **Save passage** |
| Remove a preserved passage | **Remove from Saved** |
| Job-specific context and work | **Project** |
| Professional generated artifact | **Report** |
| Produce a PDF or other file | **Export** |
| AI-assisted enacted-code investigation | **Research** |
| Research icon in instructions | **sparkle icon** |

After a successful save, the confirmation is **Saved** and optional job organization is **Add to Project**. Internal model names such as bookmark, manifest, folder, and export record may remain in code and schemas; they are not alternate product nouns.

## Interaction contract

- Every primary action must visibly succeed, fail with recovery, or explain why it is unavailable.
- Reader, Search, and Saved use the same immediate-save behavior. Project assignment follows the save and is optional.
- Opening a Search result must not silently replace occupied Reader context.
- Interrupted Research selections retain their enacted passage and original Project context through sign-in or entitlement recovery.
- Destructive confirmations name the exact object types and effects.
- Native iPhone navigation keeps system back behavior, 44-point critical touch targets, Dynamic Type, and programmatic selected state.
- Web keyboard flows keep visible focus, logical Escape behavior, focus restoration, and accessible panel headings.

## Visual and typography contract

- Interface chrome uses the operating-system UI stack; on Apple platforms this resolves to SF Pro.
- Enacted Reader text uses Source Serif 4 on web and iPhone.
- Normal text must reach at least 4.5:1 contrast. Large text and essential graphics must reach at least 3:1.
- New CSS colors belong in semantic tokens. A component-level raw color requires a nearby `ux-audit-allow:` comment with a concrete reason.
- Prefer the shared spacing and radius tokens. Avoid thin outline borders as the primary way to communicate hierarchy.
- New icons need a visible label or an accessible name; selection cannot be communicated by color alone.

## Required review for a changed surface

1. Run `npm run audit:ux-ui` from `permitext-sync-server`.
2. Run `npm run test:ux-alignment`.
3. Run the focused product contract for the changed workflow.
4. If app shell assets changed, run `npm run test:offline` and let the offline contract own cache-generation agreement.
5. Verify the affected web interaction rendered in light and dark themes with keyboard focus.
6. Verify affected iPhone behavior in Simulator or on device, including increased Dynamic Type when text or layout changed.
7. Record source, automated, rendered, Git, deployment, and App Store evidence as separate layers.

The audit command blocks high-confidence regressions in changed lines and emits review reminders for new icons and dynamic buttons. An exception is permitted only with `ux-audit-allow: reason`; the marker documents the decision rather than disabling the governance system globally.

## Regression ownership

- Phase contracts own the behavior introduced in that phase.
- `offline-contract.mjs` alone owns agreement among `index.html`, `app.js`, offline storage, and service-worker shell generations.
- `ux-ui-governance-phase6-contract.mjs` owns terminology, contrast floors, critical-target registrations, governance documentation, and audit-rule behavior.
- Broad server checks remain required when shared Research, persistence, cache, or app-shell behavior changes.

## Intentional exclusions

These remain product decisions, not audit failures:

- There is no iPad product or iPad-specific interface.
- The coarse-pointer mobile-web placeholder remains intentional.
- iPhone Settings remains in the existing Saved/account location.
- The two permanent iPhone Reader destinations remain.
- Notebook and Project Hub error-versus-empty-state redesign remains deferred.
- Platform-specific Research management capabilities remain deferred until separately approved.

This governance layer does not authorize deployment, App Store submission, destructive data changes, or removal of deferred systems.

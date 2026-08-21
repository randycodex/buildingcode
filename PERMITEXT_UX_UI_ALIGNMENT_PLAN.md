# Permitext UX/UI Alignment Plan

**Updated:** 2026-08-20

**Status:** Active roadmap; typography and Phase 1 are implemented, and Phase 2 is implemented on `codex/ux-ui-accessibility-phase2`

**Surfaces:** Permitext web workspace and native iPhone app

**Primary objective:** Make Permitext feel deliberate, trustworthy, and consistent while preserving the strengths of each platform.

## Relationship to earlier documents

This plan is the current implementation roadmap for UX/UI alignment.

- `PERMITEXT_UX_UI_ANALYSIS.md` remains the historical audit and diagnosis.
- `PERMITEXT_PRODUCT_REORGANIZATION_PLAN.md` remains the broader product-model reference.
- The design-system lessons incorporated here came from [The $1M App Design Playbook](https://x.com/jakecastilloooo/status/2090096767723307361?s=20), adapted for a professional code-research product rather than copied literally.
- Where an older recommendation conflicts with a decision recorded here, this plan controls future UX/UI work.
- This plan does not authorize deleting deferred systems, changing data ownership, deploying, or submitting an App Store build.

## Product experience contract

Permitext should communicate one professional workflow:

**Read → Save → Research → Analyze in Notebook → Publish to Report**

The web and iPhone app do not need identical layouts. They must share:

- the meaning of each user-facing term;
- the meaning and result of each action;
- evidence, citation, source-state, and uncertainty presentation;
- loading, empty, error, disabled, entitlement, and success behavior;
- a recognizable visual system;
- an immediate response to every interaction.

Platform adaptation remains intentional:

- Web remains a multi-column professional workspace.
- iPhone remains a compact, native drill-in experience.
- The two permanent iPhone Reader destinations remain unless separately reconsidered.

## Locked decisions and boundaries

Do not reopen these items during the work described by this plan:

1. **iPhone Settings stays where it is.** Settings remains inside the existing account menu on the current Projects/Saved surface. Do not create a separate Settings tab or move it into global navigation.
2. **The iPhone tab structure is intentional for now.** Do not redesign it as part of this plan.
3. **There is no iPad product.** Do not design or implement an iPad-specific shell, navigation model, or responsive tablet layout.
4. **The mobile-web boundary is intentional.** Coarse-pointer mobile web may continue directing users to the iPhone app or desktop experience.
5. **Notebook and Project Hub error-versus-empty states are deferred.** Revisit them in a later review rather than including them in the first implementation pass.
6. **Preserve deferred capabilities.** Do not delete Workboard, governance, collaboration, migration, compatibility, or advanced professional systems without separate technical justification and approval.
7. **No release action is implied.** Local verification, a Git commit, GitHub publication, Production deployment, and App Store submission are separate evidence layers and require their own authorization where applicable.
8. **Use one typeface for interface chrome and one for enacted text.** Web interface chrome uses the operating-system UI stack, which resolves to SF Pro on Apple platforms without redistributing Apple font files. Native iPhone interface chrome uses SwiftUI system styles. Reader text uses bundled Source Serif 4 on both platforms. The Reader typeface is fixed; legacy saved font choices normalize to Source Serif 4.

## Current terminology decisions

Use precise user-facing names:

| Concept | User-facing name | Notes |
|---|---|---|
| Add another web reading column | **New Reader** | Replaces the ambiguous top-bar label `Reader`. |
| Restore the web column arrangement | **Reset layout** | Tooltip should explain what is actually restored. |
| Personal saved code on iPhone | **Saved** | Recommended name for the destination that currently presents bookmarks/saved sections. |
| Job-specific organization | **Project** | Do not use Project as another name for every saved item or folder. |
| AI-assisted enacted-code investigation | **Research** | The accessibility label remains Research even when the visible control is a sparkle icon. |
| Sparkle icon in instructional copy | **sparkle icon** | Replace `Astroid`; do not rename the feature itself Sparkle. |

The proposed iPhone **Saved** naming should be confirmed before implementation. If Project access is present, expose **Saved** and **Projects** as distinct sections rather than making one word represent both objects.

## Design-system principles

The useful lesson from the reviewed design playbook is that consistency is a trust signal. Permitext should encode that consistency instead of relying on screen-by-screen judgment.

### Trust before decoration

For Permitext, visual quality includes:

- citations that remain connected to their claims;
- enacted-source state and provenance;
- clear assumptions, limitations, and uncertainty;
- honest loading and failure states;
- labels that match the action performed;
- no silent or apparently dead controls.

Decorative trends must not reduce code-text readability or make Permitext look less professional.

### Governed primitives

A future design-system artifact should define:

- semantic typography roles for chrome, code text, citations, and metadata;
- a 4-point spacing foundation with an approved scale;
- semantic color tokens rather than component-level raw colors;
- contrast requirements of at least 4.5:1 for normal text and 3:1 for large text and essential UI graphics;
- a small radius scale rather than one radius forced onto every component;
- one consistent web icon family and SF Symbols on iPhone;
- default, hover, focus, pressed, selected, disabled, loading, error, and success states;
- at least 24-by-24 CSS-pixel web targets and 44-point iPhone touch targets;
- native iPhone gestures, safe areas, Dynamic Type, and restrained haptics;
- motion rules that explain state changes rather than decorate them.

The system should be enforced through shared tokens, component contracts, and regression checks. A document by itself is not sufficient.

## Implementation roadmap

Implementation should proceed one phase at a time. Each phase receives an isolated diff, rendered verification, relevant automated checks, and its own commit before the next phase starts.

### Phase 1 — Repair trust-breaking behavior and misleading controls

**Goal:** Remove behavior that looks broken, loses discoverability, or can mislead users about available data.

**Implementation status (2026-08-20): Complete on `codex/ux-ui-alignment`.** The web now has recoverable startup failure, authoritative exact Search pagination, visible saved collections with type-accurate deletion language, one complete Appendix K navigation entry, explicit New Reader limit behavior, Reset layout wording, and semantic Search-status contrast. The Xcode configuration and compiled app metadata now identify Permitext as iPhone-only. Verification includes rendered browser checks, the full server contract suite, an iPhone simulator build, `UIDeviceFamily = [1]` inspection, and a focused XCTest. This status records local implementation evidence only; it does not imply GitHub publication, Production deployment, or App Store submission.

#### Web startup recovery

- Correct the initial-load fallback so an original startup error cannot throw a second error and leave a blank workspace.
- Provide a stable visible error with a retry path.

**Acceptance:** An intentionally failed startup renders one understandable error state; recovery code produces no secondary exception.

#### Exact Search integrity

- Stop applying exact matching only to the first page of broad results.
- Perform exact matching authoritatively or continue retrieval until the exact-match result set is complete.

**Acceptance:** A known exact match cannot produce `No results` merely because it falls outside the first 25 broad matches.

#### Saved collection safety

- Ensure saved collections do not disappear from the visible Projects/Saved experience because they fail a Project-only filter.
- Ensure Settings identifies the record type being removed.
- Never describe deletion of mixed folders/collections as deletion of Projects only.

**Acceptance:** Every persisted collection has a discoverable owner/location, and destructive confirmations name the exact records affected.

#### Appendix K deduplication

- Confirm the four current selector records point to the same Building Code Appendix K.
- Preserve one canonical option and one canonical open action.
- Remove duplicate selector entries without deleting the authoritative appendix content.
- Add a regression test requiring one visible chapter option per canonical chapter identifier.

**Acceptance:** Building Code shows Appendix K exactly once, and selecting it opens the complete canonical Appendix K.

#### New Reader behavior

- Rename the web top-bar control from **Reader** to **New Reader**.
- At the Free two-Reader limit, present a visibly unavailable state and the explanation **Two Reader limit reached**.
- The limit state must be available to assistive technology and must not appear clickable without a result.

**Acceptance:** The control either opens a Reader or clearly explains why it cannot; it never silently does nothing.

#### Reset layout wording

- Rename **Reset workspace** to **Reset layout**.
- Use a tooltip/accessibility description that states the exact current effect, such as restoring default panel widths.

**Acceptance:** The visible label is `Reset layout`, and supporting copy does not imply data deletion or workspace replacement.

#### Light-theme Search status

- Replace the white Search summary/status foreground on the near-white surface with an accessible semantic text color.
- Verify result counts, loading status, and no-results status in light and dark themes.

**Acceptance:** All Search summary/status text meets WCAG contrast requirements in both themes.

#### iPhone-only distribution boundary

- Confirm that the Xcode target and distribution metadata present Permitext as an iPhone app, not a Universal/iPad app.
- If the current target unintentionally advertises iPad support, correct the device-family configuration without designing an iPad interface.

**Acceptance:** Build and release metadata identify the supported product as iPhone-only; no iPad-specific UX is introduced.

### Phase 2 — Restore interaction and accessibility fundamentals

**Goal:** Make every important workflow operable and understandable with touch, keyboard, VoiceOver, and increased text size.

**Implementation status (2026-08-20): Complete on `codex/ux-ui-accessibility-phase2`.** Web panels now expose headings, enhanced selectors use coherent listbox/option keyboard semantics, modal-like surfaces contain and restore focus, visible focus treatment is restored, and compact header/passage actions retain minimum target sizes. The iPhone app restores the standard navigation edge-swipe, gives filter chips a checkmark and programmatic selected state within a 44-point hit area, corrects chapter-card contrast, uses a 17-point Source Serif 4 Reader baseline, permits HTML pinch enlargement, and calls the Research control the sparkle icon in instructional copy. Verification includes rendered desktop keyboard/focus checks, rendered iPhone accessibility-state and typography checks, the full server contract suite, focused XCTest, a fresh iPhone Simulator build, and an XCUITest that opens a chapter and successfully returns with a synthesized left-edge swipe. This status records local implementation evidence only; it does not imply GitHub publication, Production deployment, or App Store submission.

#### Web semantics and focus

- Give each workspace panel an accessible heading or reliable `aria-labelledby` relationship without adding redundant visible chrome.
- Replace inconsistent custom-select semantics with a valid button/combobox plus listbox/option pattern.
- Support expected Arrow, Enter, Space, Escape, and Tab behavior.
- Move focus into modal surfaces when opened, contain focus while open, and return it to the initiating control when closed.
- Restore visible focus treatment where current CSS suppresses it.

**Acceptance:** A keyboard-only user can identify, enter, operate, and leave every primary panel, selector, menu, prompt, and command palette.

#### Web target sizing

- Increase undersized panel-header and passage-action targets while preserving the compact professional layout.
- Prevent flex shrink from reducing the bookmark action below its intended dimensions.

**Acceptance:** Interactive targets meet the plan's minimum size and retain visible focus without overlap at supported desktop widths.

#### iPhone swipe-back

- Restore the standard interactive edge-swipe-back gesture wherever a Reader is presented inside a navigation stack.
- Resolve gesture competition with horizontal Reader content rather than disabling navigation globally.

**Acceptance:** Edge swipe returns to the previous screen; ordinary Reader scrolling and content gestures do not trigger accidental navigation.

#### iPhone filter chips

- Expose selected state programmatically to VoiceOver.
- Add a non-color selected cue such as a checkmark, stronger shape treatment, or both.
- Expand the hit area to approximately 44 points without making the visible chip unnecessarily large.

**Acceptance:** Selection is understandable without color and VoiceOver announces each chip's name and selected state.

#### iPhone contrast and reading comfort

- Adjust chapter-card foreground/background pairs that currently fall near 2.0–2.6:1.
- Review Reader minimum text sizes and the HTML fallback's zoom restrictions.
- Preserve code-book color identity while meeting contrast and reading requirements.

**Acceptance:** Chapter cards pass contrast checks, Reader content remains usable with increased text size, and fallback content provides a viable enlargement path.

#### Research empty-state copy

- Replace `Astroid` with clear language.
- Preferred instructional copy: **Tap the sparkle icon to start Research.**
- Keep the control's accessibility label as **Research**.

**Acceptance:** No user-facing or accessibility copy calls the icon Astroid or renames the Research feature Sparkle.

### Phase 3 — Align meaning and trust across web and iPhone

**Goal:** Make moving between platforms feel like continuing the same work rather than learning a second object model.

#### Saved and Projects

- Keep web **Projects** as the job-context destination.
- Rename the iPhone saved-code destination to **Saved** if approved.
- When Project entitlement is available, present Saved and Projects as distinct concepts within the existing destination.
- Keep Settings in the existing Projects/account location.

**Acceptance:** `Saved` always means preserved code; `Project` always means job context; neither term silently changes meaning by entitlement state.

#### Research access recovery

- Add a direct sign-in or account-recovery action to the signed-out iPhone Research state.
- Do not move Settings or add a Settings tab; route the action to the existing account/Settings flow.
- Check entitlement before switching a Reader selection into Research, or carry the selection through the recovery flow.

**Acceptance:** A signed-out user never lands on a Research dead end and does not lose the selected passage that initiated the action.

#### Research evidence presentation

- Present modeled assumptions, limitations, follow-up questions, additional evidence, citation titles, evidence roles, and source identity where they materially qualify the answer.
- Make citations open the governing source in Reader.
- Keep the user-facing answer concise while making trust detail progressively available.

**Acceptance:** Web and iPhone communicate the same conclusion, material conditions, governing citations, and evidence limitations for the same saved Research answer.

#### Project context visibility

- Preserve automatic context where useful, but show which Project owns or informs the current Research/Notebook action.
- Allow review or correction before a consequential Research action.

**Acceptance:** A user can identify the active Project before committing work without navigating back to Projects.

#### Report language

- Reconcile iPhone **Exports** and web **Report** terminology.
- Use Report for the professional artifact and Export for the action that produces PDF or another file.

**Acceptance:** The same artifact has the same name on both platforms; Export describes an output action, not a competing object.

### Phase 4 — Make Reader and save actions predictable

**Goal:** Ensure a Reader or bookmark action has the same meaning regardless of where it starts.

#### Independent iPhone Reader state

- Remove destructive coupling between the two Reader destinations' loading, search, bookmark, and version state.
- Preserve shared immutable corpus data where appropriate without sharing transient navigation state.

**Acceptance:** Loading or changing the code version in one Reader cannot cancel, blank, or silently retarget the other Reader.

#### Consistent saving

- Define bookmark as immediate save across section Reader, chapter Reader, and Search.
- Do not require a folder/Project in one surface while silently creating an unassigned save in another.
- Offer Project assignment as a follow-up action.

**Acceptance:** The same bookmark icon produces the same saved state and confirmation from every source surface.

#### Search destination choice

- Do not silently overwrite an occupied web Reader when opening a Search result.
- Reuse a clearly eligible Reader or ask whether to replace/open where a genuine choice exists.

**Acceptance:** Opening a Search result never destroys the user's visible Reader context without an explicit, understandable choice.

#### Meaningful native feedback

- Consider restrained haptics for successful save, completed Research, Project evidence attachment, and Report export.
- Do not add haptics to ordinary navigation or every tap.

**Acceptance:** Feedback reinforces consequential success states and respects reduced-motion/haptic preferences where applicable.

### Phase 5 — Improve the first ten seconds

**Goal:** Communicate Permitext's purpose before exposing organizational complexity.

- Keep the iPhone's Reader-first entry and the web's workspace model, but give each a clear first useful action.
- Introduce the core loop with minimal copy rather than a multi-screen tutorial.
- Preserve the user's interrupted section, question, or save through account creation.
- Make enacted-source trust, unofficial status, and citation behavior clear at the first relevant moment rather than repeating compliance language everywhere.
- Prioritize Reader, Search, and Research credibility before decorative Settings or paywall polish.

**Acceptance:** A first-time user can identify what Permitext does, open enacted code, search, and understand how saving and Research relate without encountering internal governance vocabulary.

Specific onboarding copy and account/Pro boundaries require a separate product-copy approval before implementation.

### Phase 6 — Prevent regression

**Goal:** Turn the design system into an operating discipline.

- Add automated checks for duplicate chapter options, target sizes where practical, semantic labels, focus contracts, and theme contrast.
- Maintain a cross-platform terminology contract.
- Add focused web smoke coverage for Free limits, light/dark themes, keyboard navigation, and failure recovery.
- Add iPhone UI coverage for signed-out Research recovery, Reader independence, swipe-back, filter selection, Dynamic Type, and VoiceOver labels.
- Run a short recurring audit for spacing, raw colors, inconsistent radii, icon drift, missing interaction states, and web/iPhone vocabulary drift.

**Acceptance:** A new screen or control cannot bypass the shared terminology, token, accessibility, or interaction-state rules without an explicit review decision.

## Explicitly deferred or pending decisions

These are not part of the first implementation sequence:

- Notebook and Project Hub failure-versus-empty-state redesign.
- Whether Research rename, move, and delete should remain platform-specific or become shared capabilities.
- Any iPad UI or distribution work.
- Any replacement for the intentional mobile-web placeholder.
- Moving iPhone Settings or adding a Settings tab.
- Removing either permanent iPhone Reader destination.
- App Store screenshots, paywall experiments, and conversion benchmarks until the core trust surfaces are stable.

## Verification matrix

Each implemented phase should be checked at the strongest relevant layer.

| Layer | Required evidence |
|---|---|
| Source | Task-scoped diff; stable IDs/data ownership preserved; no unrelated files staged. |
| Web automated | Relevant contracts plus broad `npm run check` when shared app, cache, storage, or Research behavior changes. |
| Web rendered | Desktop light/dark themes, supported width, keyboard flow, focus, target size, and affected Free/Pro states. |
| iPhone automated | Focused unit/UI tests plus a fresh simulator or device build appropriate to the change. |
| iPhone rendered | Standard iPhone size, increased Dynamic Type, VoiceOver-relevant state, signed-out/Free and entitled flows where affected. |
| Git | Intended files only; commit SHA recorded; remote equality reported only if pushed. |
| Release | Production and App Store state verified separately; local success is not release evidence. |

## Recommended execution order

1. Phase 1 trust-breaking web behavior and approved quick fixes.
2. Phase 2 accessibility and native interaction fundamentals.
3. Phase 3 cross-platform meaning and Research trust.
4. Phase 4 Reader-state and save-action consistency.
5. Phase 5 first-use experience after the core workflow is reliable.
6. Phase 6 automated governance and recurring audit, introduced alongside every earlier phase rather than postponed to the end.

The shortest useful standard for every future change is:

> The interface says what will happen, visibly responds when it happens, preserves the user's context, and presents the same professional meaning on web and iPhone.

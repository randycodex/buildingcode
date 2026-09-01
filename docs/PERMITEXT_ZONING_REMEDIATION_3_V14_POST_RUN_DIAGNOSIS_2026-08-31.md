# Permitext Zoning Research — remediation successor 3 v14 post-run diagnosis

Date: August 31, 2026

Source branch: `codex/zoning-research-beta1`

Retained run: `6a100e20-a5d8-4f60-81b3-92c5ed1eaec6`

Retained package: `2c2c000571855bb9f1101d15be0c6bb53feb45c4`

Prospective safety version: `20260831-zoning-appendix-j-explicit-input-boundary-v15`

## Result boundary

This is a no-cost, privacy-bounded diagnosis. It does not reconstruct, reveal, or rescore either unavailable failed answer from the v14 run. It uses only the retained category and clause-shape flags, the approved prompt and evidence, and independent synthetic safe/unsafe controls. It made no provider call and does not alter the immutable v14 package, authorization, result, charging record, or economics.

The retained v14 diagnostics establish two different shapes:

- the initial attempt retained the overall mapped-location boundary but none of its 10 triggering field clauses was recognized as a source rule; and
- the bounded revision gained two recognized source-rule clauses but lost the overall mapped-location boundary and retained other direct-conclusion triggers.

The first shape remains indeterminate without the intentionally absent answer text. No further generic-source relaxation is justified from it. The second shape supports testing equivalent explicit required-input boundary wording because the prompt required a separate address-or-BBL plus official-map boundary, but the revision-level boundary flag was false.

## Reproduced false-negative family

Matched synthetic probes confirmed that these two existing word orders already pass:

- `A parcel-specific conclusion requires the property's address or BBL and the applicable official Appendix J map.`
- `A site-specific conclusion requires the address or BBL and the applicable official Appendix J map.`

Before the prospective v15 repair, the following equivalent bounded forms failed with `zoning_missing_mapped_location` even when paired with a recognized generic Subarea rule, the Appendix J citation, and both missing facts:

- required inputs followed by `to make` a parcel-specific conclusion;
- required inputs followed by `before` a parcel-specific conclusion;
- a `To make a property-specific conclusion` lead followed by required inputs;
- `needs` between the site-specific determination and both required inputs;
- inputs `needed for` a parcel-specific conclusion; and
- an imperative `Before making ... identify` form.

This is a deterministic wording-order false negative. It explains a plausible revision-only boundary loss without asserting that any particular unavailable v14 sentence used one of these forms.

## Prospective v15 repair

V15 adds a narrow explicit-input-boundary recognizer. Its newly accepted inverted and imperative forms must place all of the following in the same clause:

1. a site-, property-, or parcel-specific conclusion, determination, result, applicability, finding, or assessment;
2. the property address or BBL; and
3. the official Appendix J map.

The recognizer also requires a direct grammatical relationship: the result requires the inputs, the inputs are directly required or needed for the result, or a `before` instruction directly identifies both inputs. It does not treat `missingFacts` alone as the narrative boundary.

The actor-continuation safeguard now recognizes these new boundary forms when checking for an appended result. A boundary followed or preceded by a statement that a site is mapped or permitted, a project qualifies, an applicant may proceed, or an owner receives a benefit still fails closed.

## No-cost controls

The focused contract now retains:

- eight equivalent safe explicit-input boundary forms;
- incomplete controls missing the address-or-BBL, official map, or site-specific-result relationship;
- unrelated and optional-input controls that mention the same terms without making them required for the result; and
- nine masked site, property, project, applicant, or owner outcomes around the new boundary forms, including same-sentence `but`, `so`, and `and` continuations.

All safe controls pass. Every incomplete, unrelated, optional, and masked-conclusion control remains rejected. The complete pre-existing named-site, actor, inference, mapped-placement, modal, and boundary-mask suite also remains green.

## Verification

- Focused Zoning Research safety contract: passed.
- Complete `npm run check`: passed with provider credentials removed from the process.
- Paid model calls: zero.
- Public Zoning Research: disabled.
- Disabled 24,000-character candidate: unchanged.
- Price and 100-turn allowance: unchanged.
- Merge, push, deployment, TestFlight, and public release: not performed or authorized.

Prospective source hashes at this checkpoint:

- `permitext-sync-server/research-zoning-safety.mjs`: `b9e863d030b800f27f142d5b6b5ee1ee83dbdff9b8a9ec890ab3cc0236f3a6a0`
- `permitext-sync-server/tests/research-zoning-safety-contract.mjs`: `5a06dba86e700050853254e438d1cbd6e1b006f1eeac2b4c1dce74474688d8e3`

## Decision and next gate

The v14 no-cost diagnosis is complete and supports retaining prospective v15 for a distinct confirmation package. It does not prove the semantic quality, reliability, or cost of the unchanged 30-case successor and does not authorize a paid run.

Before any paid confirmation, commit the reviewed v15 repair, bind a distinct locked package to that exact repair and the unchanged 30-case cohort, preserve every consumed historical authorization/result hash, pass the no-cost package and full mock preflight, and obtain a fresh owner authorization naming the exact package commit, all 30 ordered cases, one repetition, and a cumulative cap no higher than `$5`.

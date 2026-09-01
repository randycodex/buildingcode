# Permitext Zoning Research — remediation successor 3 v15 post-run diagnosis

Date: August 31, 2026

Source branch: `codex/zoning-research-beta1`

Retained run: `fe0367c2-2c62-41e3-bc4c-1fc168fae68e`

Retained package: `8fe33ab45f8d2d4b4653207aee47d8bb557c68b3`

Prospective safety version: `20260831-zoning-appendix-j-preposed-subarea-source-rule-v16`

## Result boundary

This is a no-cost, privacy-bounded diagnosis. It does not reconstruct, reveal, or rescore either unavailable failed answer from the v15 run. It uses only the retained clause hashes, lengths, and classification flags; the approved source-boundary question, evidence, and prompt; and independently authored synthetic safe/unsafe controls. It made no provider call and does not alter the immutable v15 package, authorization, result, charging record, or economics.

The retained v15 diagnostics establish that the initial attempt lacked the overall mapped-location boundary. The bounded revision restored the required address-or-BBL plus applicable-official-map boundary, but all 12 triggering field clauses remained classified as direct conclusions rather than source rules or location boundaries. That localizes the remaining false-negative risk to clause-level generic-source recognition without proving the text of any unavailable clause.

## Reproduced false-negative family

The approved prompt requires a generic description of the Subarea 1 and Subarea 2 source rules. Existing controls already accepted several subject-first and area-first forms. A no-cost probe found that the following equally generic preposed forms failed with `zoning_missing_mapped_location` even when paired with the recognized overall boundary, Appendix J citation, and both missing facts:

- `For Subarea 1, self-service storage facilities are subject to the as-of-right provisions of Section 42-19.`
- `For Subarea 2, self-service storage facilities require a City Planning Commission special permit under Section 74-192.`

Those synthetic clauses are 106 and 118 characters. Those lengths also occur among the retained v15 revision triggers, which is corroborating shape evidence only; it does not establish that the unavailable answer used either sentence.

The failure is grammatical rather than substantive. The detector recognized `self-service storage facilities in Subarea 1 ...` and `For areas mapped in Subarea 1, self-service storage facilities ...`, but not the direct category lead `For Subarea 1, self-service storage facilities ...`.

## Prospective v16 repair

V16 adds one fully anchored reviewed form. It accepts a clause only when all of the following are true:

1. the clause begins with `for`, `in`, or `within` plus Subarea 1 or Subarea 2;
2. the subject is the plural generic category `self-service storage facilities`;
3. the predicate is one of the already-reviewed as-of-right, Section 42-19, or City Planning Commission special-permit treatments; and
4. the complete answer separately retains the address-or-BBL plus applicable-official-map boundary required by the existing structural gate.

It does not accept a singular proposed facility, named site, applicant, owner, client, project, parcel placement, or proceed/benefit conclusion. It does not weaken the overall boundary requirement or infer a property's mapped Subarea.

## No-cost controls

The focused contract adds six safe variants covering `for`, `in`, and `within` for both Subareas and the reviewed regulatory predicate forms. It also adds:

- eight direct unsafe counterparts using a proposed facility, named site, applicant/client, specific project continuation, or named-example insertion; and
- 30 systematic mutations across every safe form, replacing the generic category with a proposed facility, inserting a named site, appending a project-proceed result, appending an applicant-benefit result, or appending a site-applicability result.

All six safe controls pass. All 38 new unsafe controls fail closed with `zoning_missing_mapped_location`. The complete pre-existing named-site, actor, inference, mapped-placement, modal, parenthetical, punctuation, continuation, boundary-mask, missing-boundary, and explicit-input-boundary suite also remains green.

## Verification

- Focused Zoning Research safety contract: passed.
- Complete `npm run check`: passed with OpenAI, database, and Stripe credentials removed from the process.
- Historical consumed v8, v9, v11, v12, v13, v14, and v15 authorization/result integrity checks: passed.
- Paid model calls: zero.
- Public Zoning Research: disabled.
- Disabled 24,000-character candidate: unchanged.
- Price and 100-turn allowance: unchanged.
- Merge, push, deployment, TestFlight, and public release: not performed or authorized.

Prospective source hashes at this checkpoint:

- `permitext-sync-server/research-zoning-safety.mjs`: `c3d1a470bb88314086f23acb04d5d40b3011f5ec35f7bda7341f1ef7bed8f7aa`
- `permitext-sync-server/tests/research-zoning-safety-contract.mjs`: `3d57e48e8bf518c6556043f7529bce8aa51e523581ffc104cf408a6a7bb4151e`

## Decision and next gate

The v15 no-cost diagnosis is complete and supports retaining prospective v16 for a distinct confirmation package. It does not prove semantic quality, reliability, or cost for the unchanged 30-case successor and does not authorize a paid run.

Before any paid confirmation, commit the reviewed v16 repair, bind a distinct locked package to that exact repair and the unchanged 30-case cohort, preserve every consumed historical authorization/result hash, pass the no-cost package and full mock preflight, and obtain a fresh owner authorization naming the exact package commit, all 30 ordered cases, one repetition, and a cumulative cap no higher than `$5`.

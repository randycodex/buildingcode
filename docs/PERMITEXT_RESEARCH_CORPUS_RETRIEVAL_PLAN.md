# Permitext Research — Corpus Retrieval Redesign Plan

**Status:** Planning only (no production code changes in this document’s authoring pass)
**Branch recommendation:** `codex/research-corpus-retrieval` (new task branch off current `main`)
**Owner intent:** Keep evidence-bounded Research, but assemble evidence from the full applicable enacted corpus—not only user-pinned passages.

---

## Feasibility confirmation

**Yes — this is implementable in the current Permitext architecture**, without inventing a greenfield product.

| Requirement | Feasible? | Why |
|-------------|-----------|-----|
| Corpus-wide retrieval (not full-book dump) | **Yes** | Enacted Construction Code / Zoning content is already published under app resources and server content modules; hybrid discovery already exists in `evidence-discovery.mjs` (candidates, section anchors, hybrid ranking). |
| User-pinned + auto-discovered evidence | **Yes** | Conversations already store `sources[]` with `kind: "selection"` (and related kinds). New source kinds / provenance fields can be additive. |
| Remain grounded in enacted sources | **Yes** | Current path already validates interpretations against supplied evidence (`validateResearchInterpretation`) and refuses free-form “model knowledge as law.” Grounding rule expands to *retrieved* set, not *selected-only* set. |
| Hierarchy / exceptions / tables / xrefs | **Yes, staged** | Section catalog, prepared bodies, chapter HTML, and search indexes exist. Cross-ref expansion needs deterministic parsers + bounds; not free-form model crawl. |
| Structured analysis pass | **Yes** | New internal stage before final answer; store as JSON on the conversation/answer record. |
| Verifier + single regenerate | **Yes** | Fits after answer generation; reuse model config + eval harness patterns; hard cap at 1 regenerate (+ optional escalation hook). |
| Eval regression (§1019.3) | **Yes** | `evals/research-cases.json` + `tests/research-evals.mjs` already exercise the production conversation path; cases today assume pre-selected evidence—schema must extend for corpus-retrieval mode. |
| UI: simple ask → research → answer | **Yes** | Web Research pane + evidence discovery UI already separate “find candidates” from Research; wire discovery *into* message flow automatically and show compact provenance summary. |
| Cost / token control | **Yes** | Existing monthly Research limits, mock mode, pricing env; retrieval stays local/DB; model sees narrowed set only. |

### Serious blockers that would stop implementation?

**None identified as hard blockers.** Important risks (not blockers):

1. **Product contract change:** Today Research *requires* at least one selection (`RESEARCH_EVIDENCE_REQUIRED`). Corpus mode must either relax that (question-only + project facts) or keep “selection optional but recommended.” Plan: make selection **optional** once Phase 1 retrieval is trusted; until then allow zero selections *only* when retrieval returns material evidence.
2. **Eval suite coupling:** Approved eval cases pin `selectedEvidence` and score as if that is the full universe. Corpus mode needs dual scoring (pinned anchors + discovered must-include / must-not-hallucinate).
3. **False completeness:** Users may over-trust auto-research—must surface corpus boundaries as evidence limitations.
4. **Cost:** Extra model calls (analysis + answer + verify) raise spend; keep analysis/verify compact; prefer deterministic retrieval first.
5. **Code Question path:** Separate research path for Code Questions must not silently diverge forever; Phase plan shares retrieval module.

**Conclusion:** Proceed with phased implementation after architecture inventory (Phase 0). No data-integrity reason to abandon the approach.

---

## 0. Snapshot of current implementation (light inventory)

These are integration anchors—not a full design rewrite.

| Area | Location (primary) | Current behavior |
|------|--------------------|------------------|
| Message / answer path | `permitext-sync-server/app.mjs` → `handleResearchConversationMessage` | Loads conversation; requires selection sources; builds `selectedResearchEvidence`; calls `openAIResearchInterpretation` / mock; durable commit of answer + conversation. |
| Prompt / model config | `research-config.mjs`, prompts assembled in `app.mjs` | Grounded-passages versions; multimodal selected evidence version string. |
| Evidence discovery (separate UX) | `evidence-discovery.mjs`, web `public/app.js` (`evidence-discovery`) | Hybrid candidate search for “find sections”; **not** yet the automatic pre-answer pipeline for Research messages. |
| Search / content | Construction search postings, prepared section bodies, catalogs under app/server content modules | Local lexical/hybrid retrieval possible without dumping full code books into the LLM. |
| Persistence | Research conversations + immutable answers + usage reservations | Sources and answers stored; provenance for *auto-discovered* set must be added. |
| Evals | `evals/research-cases.json`, `tests/research-evals.mjs`, retrieval evals | Production-path evals with human-approved cases; governance gates paid runs. |
| Client UX | `public/app.js` Research pane; iOS may lag | Selection-centric; discovery is a separate affordance. |

**Desired integration point:** insert a **Research evidence assembly pipeline** between “question accepted” and “final interpretation call,” reusing `evidence-discovery` / search primitives rather than duplicating ranking logic.

---

## Guiding principles (non-negotiable)

1. **No full-book context dumps** into the model.
2. **No free-form pretrained legal conclusions** without authorized retrieved text.
3. **Retrieval relevance ≠ code applicability.**
4. **Maximum supported conclusion** before unresolved facts.
5. **Separate** unresolved project facts vs evidence limitations.
6. **Bounded** hierarchy and cross-reference expansion.
7. **Jurisdiction / edition / effective-date fences.**
8. **Historical answers stay frozen** to their evidence snapshot.
9. **User-pinned evidence always included** (when valid).
10. **Verifier once**, no retry storms.

---

## Architecture target (high level)

```
User question
  + project facts
  + user-pinned sources
       │
       ▼
┌──────────────────────────────┐
│ 1. Anchor parse              │  § cites, exceptions, tables, terms
│ 2. Corpus retrieve           │  lexical + hybrid discovery (jurisdiction/edition scoped)
│ 3. Context expand            │  hierarchy, exceptions, tables, definitions (bounded)
│ 4. Cross-ref expand          │  material explicit refs only (depth-limited)
│ 5. Build evidence set        │  pinned ∪ discovered; provenance tags
│ 6. Structured analysis       │  internal legal map JSON
│ 7. Final answer generation   │  max-supported-conclusion policy
│ 8. Verify                    │  structured issues; optional 1× regenerate
│ 9. Persist                   │  full evidence chain + verifier result
└──────────────────────────────┘
```

**Model calls (budget):** prefer 1 analysis (optional/small) + 1 answer + 0–1 verify. Retrieval stages are deterministic/local.

---

## Implementation phases (ordered steps)

### Phase 0 — Architecture inventory & design freeze (no product behavior change)

**Goal:** Document exact touch points and contracts before merging pipeline work.

Steps:

1. Trace full Research message path end-to-end (web + server): selection attach → message → prompt → validate → persist.
2. Document source kinds and client schemas for `conversation.sources` and answer records.
3. Inventory search indexes: construction postings, section bodies, title catalog, zoning paths.
4. Map `evidence-discovery.mjs` APIs: inputs, outputs, caps (`evidenceDiscoveryMaximumCandidates`), version strings.
5. Inventory cross-ref / hierarchy metadata already available vs. needed parsers.
6. Document project-fact representation (`projectContext`, foundation, Code Decision linkage).
7. Document eval case schema and scoring dimensions.
8. Produce **integration ADR** (short): “Research Evidence Assembly v1” — stages, persistence fields, feature flag.
9. Define feature flag, e.g. `PERMITEXT_RESEARCH_CORPUS_RETRIEVAL=1` (default off in production until Phase 1 green).

**Exit criteria:** Written inventory + ADR accepted; flag exists; no user-visible change.

**Primary files (expected):** docs only + maybe flag plumbing later; inventory notes may live in this plan or `docs/code-question` style ADR.

---

### Phase 1 — Corpus retrieval (behind flag)

**Goal:** Research can include enacted provisions beyond user selections.

Steps:

1. Add **evidence provenance** model:
   - `origin: "user_pinned" | "permitext_discovered"`
   - `retrievalReason`, `retrievalScore` (internal), `codeVersion`, `sectionID`, `retrievedAt`
2. Build `assembleResearchEvidence({ question, projectFacts, pinnedSources, jurisdiction, codeVersion })`:
   - Always include valid pinned selections.
   - Query corpus via existing discovery/search with edition/jurisdiction filters.
   - Cap discovered candidates (e.g. 8–12 sections; align with discovery max).
3. Change message handler (flagged):
   - If no pin and retrieval empty → keep clear error.
   - If pins present → pins + discovered.
   - Pass **union** evidence into interpretation (still validated against that union only).
4. Persist both sets on conversation/answer metadata without breaking old clients (additive JSON fields).
5. Unit/contract tests: assembly includes pins; discovered respect edition fence; no full-book payload.

**Exit criteria:** Flagged path answers using pin+discovered; smoke + contracts green; current default path unchanged.

**Expected change areas:**

- `permitext-sync-server/app.mjs` (message path)
- `evidence-discovery.mjs` (export/reuse ranking)
- Research answer / conversation schema (additive)
- `tests/*research*`, smoke fixtures
- Optional thin server module: `research-evidence-assembly.mjs`

---

### Phase 2 — Context expansion (hierarchy, exceptions, tables, definitions)

**Goal:** Retrieved hits expand to usable legal context—not isolated sentences.

Steps:

1. Define expansion rules per hit type (section / exception / table / definition).
2. Implement **parent/heading/sibling-exception** expansion with relevance gates.
3. Table row + notes inclusion when table is cited or controlling.
4. Definition expansion for terms appearing in controlling text or question.
5. Bound expansion: max nodes, max tokens of raw text into model, prefer structural snippets.
6. Tests with synthetic § structure and real §1019.3 fixture text.

**Exit criteria:** Given an exception anchor, system retrieves enough surrounding § structure to distinguish Exception 2 vs 4 content.

---

### Phase 3 — Cross-reference expansion (bounded)

**Goal:** Explicit material cross-refs (e.g. §903.3.1.1, §1006, §1007) retrieved when they could change the conclusion.

Steps:

1. Deterministic parse of explicit section references in enacted text.
2. Priority ranking: refs inside controlling exception/general rule first.
3. Traversal budget: depth 1–2; max N refs; stop when analysis says immaterial.
4. Safeguards against explosion (visited set, per-question token budget).
5. Tests: §1019.3 Exception 2 refs expand; unrelated book-wide refs do not.

**Exit criteria:** Bounded expansion; unit tests prove visit caps.

---

### Phase 4 — Structured evidence analysis pass

**Goal:** Final answer model receives an organized legal map, not only unordered chunks.

Steps:

1. Finalize internal schema (starting point from product request):

```json
{
  "controlling_provisions": [],
  "general_rules": [],
  "exceptions": [],
  "conditions": [],
  "limitations": [],
  "definitions": [],
  "cross_references": [],
  "tables": [],
  "user_pinned_evidence": [],
  "permitext_discovered_evidence": [],
  "project_facts_used": [],
  "unresolved_project_facts": [],
  "evidence_limitations": []
}
```

2. Prefer **deterministic + light LLM** hybrid: deterministic fill from structure; LLM only to classify roles if needed.
3. Persist analysis snapshot with the answer.
4. Feed analysis + raw evidence + question + facts into final answer prompt.

**Exit criteria:** Analysis present on saved answers; final prompt consumes it.

---

### Phase 5 — Answer policy (max supported conclusion + fact/evidence split)

**Goal:** Fix uncertainty bias without inventing compliance.

Steps:

1. Rewrite Research system/user instructions:
   - A) What the code definitely establishes
   - B) What can be said about the project given facts
   - C) Unresolved project facts (ranked, minimal questions)
   - D) Evidence limitations (separate)
2. Ban generic “insufficient information” when A is non-empty.
3. Allow correcting user premise when pins conflict with retrieved text.
4. Generate **minimum high-value follow-up questions** ranked by blocking power.
5. Update mock interpreter to exercise structure in tests without paid calls.

**Exit criteria:** §1019.3-style mock/fixture responses score on structure; forbidden “only more info needed.”

---

### Phase 6 — Verifier

**Goal:** Catch mis-attribution, missed material conclusions, unsupported requirements.

Steps:

1. Define verifier schema (`pass`, `issues[]` with types).
2. Verifier prompt/model: only authorized evidence + draft answer.
3. On fail: regenerate once with issues injected; re-verify; if still fail → escalate hook / return best draft with caution flag (product decision).
4. Persist verifier result and regeneration history.
5. Tests with deliberately wrong draft asserting catch of “draft curtain on Exception 2.”

**Exit criteria:** Single-regenerate loop only; no infinite retries; issues typed.

---

### Phase 7 — UI / product surface

**Goal:** Simple UX; provenance inspectable.

Steps:

1. Compact summary: e.g. “Based on 9 enacted provisions · 2 selected by you · 7 identified by Permitext · 3 cross-references reviewed · 2 project facts unresolved.”
2. Expandable panels: **Selected by you** vs **Identified by Permitext**.
3. Do not show raw chain-of-thought; show evidence cards with citations.
4. Align web first; iOS follow if Research UI exists / parity needed.
5. Copy review: no claim of universal legal completeness; corpus boundary language.

**Exit criteria:** Web Research flow usable without multi-stage manual discovery for common questions.

---

### Phase 8 — Evaluations & objective “better than before”

**Goal:** Prove quality, not vibes.

Steps:

1. Add draft case: **NYC BC §1019.3 Exception 2 / draft curtain** with full exception text as corpus fixture (and/or library sectionIDs).
2. Required behaviors as scoring checklist (product §17).
3. Extend eval runner for `researchMode: "corpus_retrieval"` vs `selected_only` baseline.
4. Compare runs: citation correctness, premise correction, forbidden generic uncertainty, unsupported claims.
5. Keep human approval gates for public/paid promotion (`evals/README.md` governance).
6. Optional retrieval-only evals continue in `evidence-retrieval-cases.json`.

**Exit criteria:** Automated case fails on “more information only”; passes on maximum-supported-conclusion structure; baseline comparison documented.

---

### Phase 9 — Hardening, cost, rollout

Steps:

1. Caching: section body / expansion results by `(codeVersion, sectionID)`.
2. Token budgets and telemetry (`research_conversation_message` event extensions).
3. Feature flag rollout: internal → beta → default-on.
4. Watch monthly Research limits and latency.
5. Document operational runbook (flags, evals, rollback to selected-only).

**Exit criteria:** Rollback switch works; metrics show bounded cost growth.

---

## Answers to the ten architecture questions

### 1. Assessment of existing implementation
Research today is **selection-bounded**: message path requires user selections, builds evidence only from those passages, and grounds the model there. Separate **evidence discovery** already searches the corpus for candidates but is largely a manual “find” UX, not automatic Research assembly. Evals and durable answer storage are mature for the selected-evidence paradigm.

### 2. Where this should integrate
Primary: **server Research message pipeline** in `app.mjs` (or extracted `research-evidence-assembly.mjs`) *before* `openAIResearchInterpretation`. Reuse **`evidence-discovery.mjs` + search indexes** for candidates. Persist on conversation/answer. UI summary in `public/app.js` Research pane. Evals under `evals/` + `tests/research-evals.mjs`.

### 3. Conflicts / risks
- Breaking `RESEARCH_EVIDENCE_REQUIRED` contract for clients/evals.
- Cost of multi-stage LLM use.
- False completeness / over-trust.
- Divergent Code Question research path.
- Retrieval noise if ranking treated as applicability.
- Historical answer mutability if reopened against new code (must freeze snapshots).

### 4. Exact implementation plan
Phased 0→9 above; feature-flagged; reuse discovery; additive provenance; progressive expansion → analysis → policy → verifier → UI → evals → rollout.

### 5. Files / components / services expected to change
| Layer | Likely paths |
|-------|----------------|
| Server core | `app.mjs`, new `research-evidence-assembly.mjs` (preferred extract), possibly `research-verifier.mjs` |
| Discovery / search | `evidence-discovery.mjs`, search postings / content loaders as needed |
| Config | `research-config.mjs` (versions, flags, budgets) |
| Web | `public/app.js`, CSS for evidence summary |
| Persistence | conversation/answer JSON shapes; optional DB columns later |
| Evals | `evals/research-cases.json`, `evaluation-schema.mjs`, `tests/research-evals.mjs` |
| Docs | this plan, short ADR |
| iOS | only if Research UX parity required in scope |

### 6. How retrieval will work
- **Inputs:** question text, project facts, pin sectionIDs/passages, jurisdiction, code edition/version.
- **Methods:** hybrid lexical + concept routing already in discovery; explicit cite anchors from question; pin anchors.
- **Output:** ranked section candidates with stable `sectionID` and enacted passage bodies from Permitext content.
- **Not:** embedding entire Building Code into the LLM; not web search.

### 7. How cross-reference expansion is bounded
- Parse **explicit** internal section references only.
- Depth cap (e.g. 1–2), max refs (e.g. 6–10), visited set, materiality filter (only if analysis marks controlling/conditional).
- Hard stop when token budget for evidence package is reached.

### 8. How evidence provenance is stored
On each Research answer (and conversation snapshot):
- `userPinnedEvidence[]`, `permitextDiscoveredEvidence[]`
- per-item: `sectionID`, citation label, codeVersion, origin, retrievalReason, content hash / passage hash
- `structuredAnalysis`, `unresolvedProjectFacts`, `evidenceLimitations`
- `verifierResult`, model/prompt/evidence versions, `retrievedAt`
Reopen uses **stored** snapshot only.

### 9. How the verifier works
- Input: draft answer + authorized evidence package + structured analysis + question/facts.
- Output: `{ pass, issues[{ type, detail }] }`.
- Types cover misquote, wrong exception, missed material conclusion, unsupported requirement, fact/evidence confusion, false missing-evidence, overstated compliance, bad citations.
- Policy: 1 regenerate + 1 re-verify; then stop (escalate hook optional).

### 10. How we test objective improvement
- New §1019.3 regression case with explicit required behaviors / forbidden “only more info.”
- Side-by-side eval runs: selected-only baseline vs corpus-retrieval mode.
- Metrics: required concepts, premise correction, citation accuracy, unsupported claim rate, uncertainty quality.
- Human review remains required before treating cases as approved gates for release.

---

## Step checklist (execution order)

Use this as the working todo list when implementation starts:

- [ ] **P0.1** Full architecture inventory write-up (paths, schemas, flags)
- [ ] **P0.2** ADR: Research Evidence Assembly v1 + feature flag name
- [ ] **P1.1** Provenance types + persistence (additive, backward compatible)
- [ ] **P1.2** `assembleResearchEvidence` module reusing discovery/search
- [ ] **P1.3** Wire flagged message path; keep default selected-only
- [ ] **P1.4** Contracts + smoke for assembly + edition fence
- [ ] **P2.1** Hierarchy / exception / table / definition expansion
- [ ] **P2.2** Expansion budget tests + §1019.3 structure fixture
- [ ] **P3.1** Explicit cross-ref parser + bounded traversal
- [ ] **P3.2** Explosion safeguards tests
- [ ] **P4.1** Structured analysis schema + generation + persist
- [ ] **P4.2** Final prompt consumes analysis
- [ ] **P5.1** Answer policy prompts (A/B/C/D + follow-ups)
- [ ] **P5.2** Mock path + contracts for max-supported-conclusion
- [ ] **P6.1** Verifier + single regenerate + persist
- [ ] **P6.2** Verifier regression (wrong-exception draft)
- [ ] **P7.1** Web evidence summary UI (pinned vs discovered)
- [ ] **P7.2** Corpus boundary copy / no false completeness
- [ ] **P8.1** §1019.3 eval case + scoring rules
- [ ] **P8.2** Baseline vs corpus-retrieval comparison run
- [ ] **P9.1** Caching, telemetry, cost caps
- [ ] **P9.2** Flag rollout plan + rollback verified

---

## Explicit non-goals (this program)

- Training/fine-tuning a custom model on code text.
- Allowing answers from ungrounded pretrained knowledge.
- Dumping full code books into context.
- Unbounded agentic browsing of the web.
- Replacing human approval for eval “approved” status.
- Silent re-scoring of historical Research answers against new code.

---

## Immediate next action when implementation is authorized

1. Create branch `codex/research-corpus-retrieval` from `main`.
2. Execute **Phase 0** inventory into a short ADR (still no user-visible behavior change).
3. Implement **Phase 1** behind flag with contracts.
4. Only then expand context/xrefs/analysis/verifier/UI/evals per this plan.

---

## Confirmation

This redesign is **within scope of the current Permitext Research stack**. The plan reuses evidence discovery, enacted content, conversation persistence, and the eval harness; it changes **how evidence is assembled and reasoned over**, not the product’s grounding philosophy.

**No production code was modified to produce this plan.**

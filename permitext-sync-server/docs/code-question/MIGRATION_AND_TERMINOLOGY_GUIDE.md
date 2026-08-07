# Code Questions: migration and terminology guide

## What changed

A Project can organize a professional code determination as one Code Question that moves through five stages:

1. **Define** records the exact question, scope, jurisdiction, date, facts, assumptions, and unknowns.
2. **Evidence** separates search candidates from passages a reviewer explicitly approves for this Project.
3. **Analyze** can create a bounded, evidence-only Research starting point. The professional conclusion remains a separate authored record, and AI is optional.
4. **Review** keeps requests, comments, status changes, actors, dates, and approvals connected to the exact record being reviewed.
5. **Issue** creates an immutable internal Issued Record and Code Memo with its evidence, inputs, conclusion, approvals, hashes, and version lineage.

`Issued` means internally issued as a professional Project record. It does not mean approved by an agency and is not a permit, compliance certificate, or legal opinion.

## Existing work is not automatically converted

Saved passages, Notebook cards, Research answers, Report Drafts, Coordination threads, and Workboards remain in their existing tools. Legacy / Unassigned shows work that is not linked to a Code Question.

You may explicitly:

- create a new Code Question from suitable existing work;
- link existing work to an existing Code Question;
- unlink it later without deleting either record;
- recover a prior link without creating duplicates.

Ambiguous material is never silently promoted. A Saved passage remains a candidate until it is snapshotted and explicitly approved into an Evidence Set.

## Terms

| Term | Meaning |
| --- | --- |
| Code Question | The stable professional question and lifecycle container inside one Project |
| Question Input | A confirmed fact, assumption, or unknown with its own status and revision history |
| Candidate | Search or saved material under consideration; not approved evidence |
| Evidence Snapshot | Immutable exact passage plus source identity, locator, edition/version, and hash |
| Evidence Set | A versioned reviewer-approved collection of snapshots for this Question |
| Bounded Analysis | Optional AI-assisted analysis restricted to the approved Evidence Set and versioned inputs |
| Professional Conclusion | Separately authored conclusion with reasoning, citations, assumptions, unknowns, limitations, and AI disclosure |
| Review Request | An auditable request anchored to an exact input, evidence, analysis, or conclusion record |
| Code Memo | The generated document assembled from approved, versioned records |
| Issued Record | Immutable wrapper preserving the exact approved memo, manifest, lineage, actors, time, and hashes |
| Superseded | An earlier Issued Record remains intact but points to a later correction or replacement |
| Legacy / Unassigned | Existing Project or account work not currently linked to a Code Question |

## iPhone access

The iPhone Project Hub provides adapted read-only Code Question continuity: lifecycle state, Evidence Set, analysis summary, professional conclusion, reviews, Issued Record lineage, report access, Working Notes links, and flattened Workboard context. It preserves the same semantic IDs, citations, hashes, and versions as the web workspace.

Code Question edits, review responses, authoritative issue actions, and full Workboard editing are not promised on iPhone until their separate authorization, atomic outbox, conflict, interruption-recovery, and mixed-client gates pass.

## If the feature is temporarily disabled

Disabling Code Question navigation does not delete or reverse-migrate records. Existing supporting tools remain available, and the stored lifecycle can return with the same identity when the capability is safely re-enabled. Contact the Project owner before attempting any manual migration or duplicate recreation.

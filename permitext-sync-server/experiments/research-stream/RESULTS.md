# Streamed Research prototype — measured results

2026-10-25. Local experiment based on main commit `16b5c231a1fe16fa254196392fdaa3e0df7f0e7b`. Branch: `codex/research-stream-prototype`. No production source, deployment, account, or Research policy was changed.

## Decision

The prototype demonstrates a substantially shorter path to visible text for selected-passage questions. It does **not** demonstrate that removing review is suitable for production: one answer cited the correct passage and calculated the correct occupant load while mischaracterizing a footnote. Citation-ID validity is not factual verification.

Keep this as a local experiment. The evidence supports testing a fast explanatory experience, not replacing verified Research or presenting unreviewed answers as verified reports.

## What is implemented

- Select one to three complete text passages from the actual 2022 NYC BC library; optional user-stated project facts.
- One streamed Luna-low answer, follow-up context, cancellation, source links, passage inspection, and saved local runs.
- Existing official-source routing and HTML/PDF attribution before answer generation. Direct DOB workflow sources are reused when the existing router identifies that workflow.
- Mechanical citation-ID checking and explicit `completed_unreviewed` status; no AI reviewer or repair call on the fast path.
- Existing Research baseline through an isolated synthetic local account, without editing its engine.
- Loopback-only server, local launch capability, Origin/Host checks, isolated storage, offline demonstration, and persistent $5 batch ceiling.

This is a standalone lab, not a production UI integration. It does not remove authentication, spending controls, source attribution, failure handling, or production safeguards.

## Live observations

These are individual local runs, not averages or a statistically reliable benchmark. First-text measurements below come from the CLI client except where explicitly labeled server timing. They include local source preparation and network/provider time; browser automation waiting is excluded. No comparison with ChatGPT itself was measured.

| Case | First text | Completed | Provider calls | Outcome |
| --- | ---: | ---: | ---: | --- |
| Office load, original flattened passage | 2.047 s | 3.109 s | 1 | Correct 60-person calculation and relevant rooftop caveat in this sample |
| Same office question, existing Research | 21.312 s, final answer only | 21.312 s | 2 | Existing verifier passed; correct calculation and footnotes |
| Code title, final passage extraction | 1.276 s | 1.608 s | 1 | Correct title and section-prefix explanation |
| Missing sprinkler evidence | 1.065 s | 1.682 s | 1 | Correctly declined to infer a sprinkler requirement from the title passage |
| Office load, table boundaries preserved | 0.675 s | 1.792 s | 1 | **Quality failure:** correct arithmetic, incorrect description of footnote d |
| Generic official DOB lookup, before wrapper fix | — | 5.462 s | 1 | Retrieval failed; no answer generated |
| Direct DOB workflow, after wrapper fix | 4.014 s | 4.755 s | 1 | Read official HTML/PDF evidence; answer distinguished owner and filing representative roles |
| Browser-submitted title question | 1.155 s, server timing | 1.531 s | 1 | Correct answer rendered; citation and saved reopening verified |

The final three initial passage-only cases started in 0.675–1.276 seconds. The earlier office run took 2.047 seconds; do not omit it when describing variability. The browser title timing is measured server-side and is not an independently instrumented browser paint metric.

### Comparison limitations

The original office fast run and baseline used the same user question and selected-source hash `49d9287c516604536422603f85adc5e84d7840fb8001676940cc351896cf6a18`. However, baseline Research expanded its evidence internally: pinned text was 3,565 characters and total evidence was 10,864 characters, with additional discovered references/definitions. The fast path used only the selected passage. The baseline also generated a longer answer and ran a reviewer. Therefore this is an end-to-end workflow comparison, **not an isolated measurement of reviewer overhead**.

Table extraction was subsequently corrected to retain cell and row boundaries. The later office source hash is `5039c816e7cd8a82ec2da198885ab083a16c1364d1b21415c2e7682086c60283`. Its faster run is not a strictly identical-input comparison with the earlier baseline. Caching, provider variation, and answer length are uncontrolled.

## Confirmed answer-quality failure

The formatted-table office answer said:

> Footnotes c and d concern qualifying residential rooftops or terraces; they do not apply to the stated indoor Business area.

Footnote d is not limited to residential use; the Business row itself references b and d. The sample's indoor-only facts make the rooftop condition inapplicable, so the final 60-person calculation remains correct, but the explanation could mislead a later rooftop question. The citation identifier resolved successfully. This is direct evidence that a passage and a valid citation are insufficient to guarantee a correct interpretation.

The existing pipeline's tested answer described footnotes a, b, and d and correctly identified the rooftop/terrace condition. One successful baseline does not establish its universal accuracy either.

## Official websites

The successful workflow test fetched the DOB NOW application user guide, DOB NOW Build FAQs, and DOB NOW Build release notes. The answer cited the guide's owner-attestation section and the FAQ's separate roles. The retrieved evidence is explicitly labeled supporting guidance, not enacted code.

The prototype initially failed because its fetch wrappers did not accept URL objects. Both wrappers were corrected and a regression check added. Two direct-workflow diagnostic attempts failed before the complete fix, with zero model calls; those failures remain in local history. The successful direct-workflow run used a more specific question than the earlier generic search. **The original generic-search question was not rerun after the fix**, so it is not a demonstrated final-path success.

Official retrieval must finish before grounded answer generation starts. The 4.014-second first-text result includes that retrieval; it does not establish instant web-backed answers or broad official-search coverage.

## Verification completed

- Offline checks: chunked UTF-8/SSE parsing, terminal completion, inconsistent final text, refusal/incomplete/EOF handling, cancellation, unknown/missing citation IDs, and complete table/footnote extraction.
- Budget checks: concurrent reservations, process lock, persistent cap across restarts, model/tool envelope, and official URL-object forwarding.
- HTTP checks: unauthenticated state request rejected with 401; cross-origin run rejected with 403.
- Browser: offline incremental fixture, live submit/completion, explicit unreviewed label, source citation opening the exact supplied passage, and saved answer/source/question restored after reload.
- Fixed old-turn citation clicks to restore that turn's evidence, rather than resolving against the most recent answer's sources.
- Final syntax checks and `git diff --check` passed. No production build or deployment is claimed.

## Budget and retained evidence

At completion of this report: **9 provider requests**, **$3.60 conservatively reserved**, approximately **$0.02814 estimated token/tool usage**. The estimate is calculated from returned usage and is not an invoice. No requests have unknown usage. Three further $0.40 reservations fit under the existing cap; a baseline can consume multiple calls. The ledger is never reset on restart or released after a successful request.

Ignored `.local/runs.json` preserves every run, including failed samples; `.local/budget.json` preserves usage and reservations. Individual CLI results include `.local/office-baseline.json`, `.local/office-stream.json`, `.local/title-stream.json`, `.local/missing-stream.json`, `.local/web-stream.json`, and `.local/webdirect-stream.json`. The original flattened office result remains in `runs.json`, because the later office CLI result reused its filename. `.local/prototype.png` records the rendered browser result. No credentials or synthetic account files are committed.

## Before any production proposal

1. Evaluate more exception-heavy and cross-reference questions, adversarial premises, multiple passages, follow-ups, and actual project facts. Current samples are deliberately small.
2. Repeat matched-input comparisons and measure browser first paint, full answer completion, quality failures, and cost across repeated runs. Do not tune only against the known office example.
3. Decide whether this is a clearly labeled explanation mode or a draft stage followed by existing verification; neither production design is implemented here.
4. Preserve separation between unreviewed text and verified/saved report conclusions. Any integration requires explicit status and failure behavior across Research, Notebook, Report, and native clients.
5. Verify general official web-search routing after the wrapper fix, redirects/unavailable pages, source freshness, and edition selection. Broad automatic library discovery and editions beyond 2022 BC remain out of scope.

The local prototype is usable for review now; replacing current Research is not supported by this experiment.

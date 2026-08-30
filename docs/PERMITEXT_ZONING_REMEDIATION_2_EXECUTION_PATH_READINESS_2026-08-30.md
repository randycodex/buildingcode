# Permitext Zoning Research — remediation successor 2 execution-path readiness

Date: August 30, 2026
Branch: `codex/zoning-research-beta1`
Starting commit: `148cb10ed00174920ea9b6cf549f2b8c7c7e793e`
Exact remediation-successor-2 SHA-256: `459b2273b7ebd209d4519bf9206b6135dc2fc7706052fa9b333c4bf5e63e8a8b`

## Decision boundary

This record closes the remaining **no-cost engineering work** justified by the three execution failures in the historical first-successor run. It does not alter that run, authorize another paid evaluation, enable the disabled 24,000-character candidate, enable public Zoning Research, change pricing or the 100-turn allowance, deploy, push, or merge.

The historical first-successor run remains the controlling semantic, reliability, and cost evidence until remediation successor 2 receives a newly authorized run. Its three failed paths were the office-conversion structured response, City of Yes historical-text boundary, and MIH historical-zoning-lot scenario.

## No-cost result

### City of Yes

The current deterministic historical-text repair was replayed against the exact owner-approved question and compact evidence for ZR 11-31, 11-331, and 11-333.

- Before repair, the only deterministic issue is `zoning_historical_substantive_text`.
- After repair, the answer passes the deterministic Zoning gate.
- The repair does not change the answer's conclusion or citations.
- The limitation and required historical-evidence statement are inserted once.
- Applying the repair twice is identical to applying it once.

No additional City-of-Yes runtime repair or retry was justified.

### MIH historical zoning lot

The Zoning material-completeness contract is now version `20260830-zoning-material-completeness-v5`.

- The previously retained substantively safe MIH answer now passes without changing its conclusion or evidence boundary.
- Equivalent cautious wording is recognized, including plural “do not establish,” conditional “may qualify only if,” “may or may not coincide,” and hyphenated `zoning-lot` / `tax-lot` wording.
- A direct or equivalent categorical grant or denial is rejected when the historical zoning-lot fact remains unresolved.
- A statement limited to what the numerical thresholds alone establish is not misread as an unconditional denial.
- Vague “verify historical zoning-lot status” language remains insufficient. The answer must identify an official establishment date and concrete historical lot evidence such as title, survey, declaration, legal-description, ownership, configuration, or equivalent records.

No broad automatic MIH prose repair was added because appending caveats to an incorrect categorical result could make that result look safer without correcting it.

### Office structured-response path

The single existing bounded structured-response retry is unchanged. New aggregate diagnostics make a future failure distinguishable without retaining the private question, answer, prompt, evidence, raw response, provider request identifier, or arbitrary provider text.

- Ordered failure stages are allowlisted to `provider_incomplete`, `structured_output_parse`, `interpretation_validation`, and `evidence_binding_validation`.
- Provider-incomplete reasons are allowlisted to `max_output_tokens` and `content_filter`.
- A provider-incomplete payload that cannot be parsed is distinguished from a parseable payload that later fails interpretation or evidence-binding validation.
- A recovered retry records one structured failure. Two structured failures record two. A second-attempt timeout or other non-structured failure does not falsely claim a second structured failure.
- Retry eligibility, retry count, output limits, evidence binding, and answer validation are unchanged.

The historical office failure's exact malformed output was not retained and cannot be reconstructed. These diagnostics improve the next run's evidence; they do not prove that the office path will now complete.

## Verification

All verification was run with paid-evaluation variables removed.

- Focused Research safety, durable-message, economics, persistence, syntax, privacy, and counterexample contracts: pass.
- Exact retained MIH-answer replay: pass with zero deterministic issues.
- Remediation-successor-2 governance: three decisions, 30 cases, exactly three changed cases, zero answer-key/evidence mismatches, selected evidence unchanged, forbidden claims unchanged, direct live execution blocked.
- Complete 30-case mock conversation path: 30/30 ready, zero provider tokens, zero provider cost.
- Disabled 24,000-character evidence-budget prototype: 30/30 ready; 28,712 average and 38,896 maximum assembled characters; 6,352 average pinned and 22,360 average supplemental characters; 87 exact pinned sources, eight structured sources, 117 discovered sources, and 29 cross-references; all exact pinned sources preserved.
- Complete repository `npm run check`: recorded after the final implementation and documentation pass.

## Remaining gate

No paid semantic claim is made. The next honest evidence is one complete run of the exact remediation-successor-2 SHA above, all 30 ordered cases, one repetition, under a new one-time owner authorization and cumulative cap no higher than `$5`. The prior authorization is consumed and cannot be reused.

Even a clean run would not by itself enable public Zoning Research. The result must also establish acceptable quality, execution reliability, and measured cost, followed by exact-release web and TestFlight physical-iPhone acceptance and the owner's final public-release decision.

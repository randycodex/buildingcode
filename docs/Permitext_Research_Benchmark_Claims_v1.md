# Permitext Research benchmark claim requirements v1

This note defines the first machine-readable claim layer for the two corrected 40-case Research benchmarks:

- `Permitext_Research_Benchmark_40_Cases_v2.md`
- `Permitext_Research_Benchmark_40_Distinct_Cases_v2.md`

The Markdown remains the human-authored source of truth. The parser derives a backward-compatible `claimRequirements` object for each case while preserving `idealAnswer` and the existing string-valued `forbiddenClaims` array.

## Representation

Every sentence in the Ideal answer becomes a stable required-claim record. Every bullet under Claims Permitext must avoid becomes a stable forbidden-claim record.

```json
{
  "schemaVersion": 1,
  "version": "20260811-lexical-omission-diagnostic-v1",
  "diagnosticOnly": true,
  "required": [
    {
      "id": "required-01",
      "kind": "required",
      "text": "Human-authored benchmark sentence.",
      "match": {
        "mode": "lexical-anchor-recall",
        "referenceAnchors": [],
        "termAnchors": [],
        "minimumTermMatches": 0,
        "distinctiveTermAnchors": [],
        "minimumDistinctiveTermMatches": 0
      }
    }
  ],
  "forbidden": [
    {
      "id": "forbidden-01",
      "kind": "forbidden",
      "text": "Human-authored forbidden claim.",
      "match": {
        "mode": "semantic-review-only"
      }
    }
  ]
}
```

The parser normalizes limited inflectional variants and a small fixed synonym set. It records enacted-code reference anchors, general term anchors, and terms unique to a required claim within that case. This allows the deterministic scorer to identify likely omissions while tolerating ordinary professional paraphrasing.

## Scoring boundary

`scoreBenchmarkAnswerOmissions` returns a zero-to-one required-claim recall ratio, per-claim matched anchors, and omitted claim IDs. It is deliberately diagnostic and non-gating.

Lexical presence does not prove that a claim is correct, properly qualified, or supported by its citation. Lexical absence can also reflect an unanticipated but valid paraphrase. Therefore:

- the score must not approve or reject a legal or code answer;
- forbidden claims remain semantic-review-only because an answer may quote a proposition to reject it;
- citation support, authority scope, exception handling, and legal correctness still require the existing deterministic citation checks plus semantic or human review;
- production evidence routing uses canonical evidence identities separately from this benchmark-only diagnostic.

## Audited inventory

The parser currently produces:

| Corrected benchmark | Cases | Required claims | Forbidden claims |
| --- | ---: | ---: | ---: |
| Primary 40 cases | 40 | 206 | 165 |
| Distinct 40 cases | 40 | 190 | 164 |
| Total | 80 | 396 | 329 |

The contract tests pin these counts, verify stable claim identities, confirm that every forbidden record exactly preserves its Markdown bullet, score every Ideal answer at full lexical recall, exercise a tolerated paraphrase, and detect the removal of each of the 396 required claims independently, including the Type A/Type B+NYC distinction in accessibility Test 25.

# HMC Court: complete source occurrence review

## Status and recommendation

Court remains withheld in product data. This source audit supports a **44-link proposal across all 19 architectural-use sections**, not merely a sample of §§27-2058/2059. No registry activation, native verification, browser acceptance, or phone testing occurred. The ten deferred source entries remain untouched.

Original ID `6c6074adb2680dd4a441`, §27-2004, anchor `section-31001849`, file `2026-enacted-administrative-code/chapters/30000077.html`:

> A court is an open space other than a side or rear yard, on the same lot as a dwelling. A court not extending to the street or rear yard is an inner court. A court extending to the street or rear yard is an outer court.

Preserve this complete body and source identity. The source expressly covers inner and outer court, so those compounds do not require a replacement definition. The plural alias **courts** is directly attested in the maintenance/drainage applications, not inferred from a general plural rule.

## Complete inventory and final proposed counts

Across all five chapter HTML sources, exact paragraph retrieval finds **184 occurrences: 175 singular and 9 plural**. Ten occur within excluded §27-2004 definition prose. This explains the earlier 165 count: it represented the 175 singular occurrences minus 10 definition-prose occurrences. The full review adds all 9 plural applications.

- **44 architectural occurrences**:35 singular and 9 plural, all supported by the original open-space definition.
- **130 judicial occurrences**: courts of law, judges, orders, proceedings, jurisdiction and associated judicial anaphora; all remain plain.
- **10 definition-prose occurrences**:5 in the Court definition itself and 5 judicial uses inside the composite Harassment definition; all remain plain.
- **0 unresolved occurrence classifications** in this frozen five-chapter corpus. This does not establish automatic applicability to changed or additional source text.

The source-guarded proposal uses chapter 1–5 context plus an explicit section allowlist below, retaining the shared definition-section exclusions. No judicial occurrences coexist with architectural occurrences in any of these 19 source sections. Therefore no phrase-level exclusion is required within this frozen allowlist. A future changed section must fail source guards and be reviewed rather than inherit this classification blindly.

| Architectural section | Matches |
| --- | ---: |
| 27-2010 | 1 |
| 27-2015 | 5 |
| 27-2027 | 3 |
| 27-2034 | 2 |
| 27-2038 | 1 |
| 27-2040 | 1 |
| 27-2058 | 4 |
| 27-2059 | 4 |
| 27-2060 | 3 |
| 27-2061 | 2 |
| 27-2062 | 1 |
| 27-2063 | 1 |
| 27-2065 | 2 |
| 27-2071 | 1 |
| 27-2073 | 1 |
| 27-2081 | 1 |
| 27-2083 | 5 |
| 27-2085 | 5 |
| 27-2086 | 1 |

These occurrences span cleaning/whitewashing/drainage (§§27-2010/2015/2027), heater vents (§27-2034), lighting (§§27-2038/2040), light/ventilation and required windows (§§27-2058–2063/2065/2071/2073), and cellar/basement open-space requirements (§§27-2081/2083/2085/2086). `Legal court`, `lawful court`, `inner court` and `outer court` describe the same architectural subject. Local dimensions, window-opening rules, age-specific construction conditions and MDL cross-references remain operative qualifications in the surrounding source; the general popup must not replace those requirements or invent a dimensional standard. No alternate Court definition or inline Court-defining declaration was found in these application paragraphs.

The judicial sections, with exact counts, are:

§27-2041.2 (1); §27-2093 (3); §27-2093.1 (4); §27-2107 (3); §27-2109.1 (2); §27-2113 (1); §27-2114 (3); §27-2115 (45); §27-2116 (6); §27-2117 (5); §27-2120 (2); §27-2121 (4); §27-2122 (3); §27-2123 (6); §27-2124 (2); §27-2127 (14); §27-2132 (2); §27-2133 (4); §27-2134 (10); §27-2136 (2); §27-2137 (2); §27-2140 (1); §27-2146 (2); §27-2152 (2); §27-2153 (1).

In particular, §27-2041.2 contains a judicial `court order` despite being in the otherwise architectural maintenance chapter. It is explicitly outside the architectural allowlist. Chapters 4/5 contain only judicial Court uses in this corpus; chapter-level activation alone would therefore be wrong. All 45 occurrences in §27-2115 were reviewed as judicial, including bare `the court`/`such court` references following judicial antecedents.

## Reproducible evidence and next implementation gate

Run from any working directory:

```sh
node /absolute/repository/permitext-sync-server/scripts/audit-hmc-court-applicability.mjs /tmp/permitext-hmc-court-reviewed.json
```

The repository script checks all five source hashes, exact Court ID/body/source anchor, per-section inventory counts, and full-registry matching. It fails on any unclassified occurrence. It writes only the requested audit JSON and does not alter registry applicability. The completed run produced 44 architectural,130 judicial,10 definition occurrences and 44 candidate links. JSON retains complete decoded paragraphs, hashes, exact anchors, paragraph indices, UTF-16 term/source ranges and individual classifications. Evidence: `/tmp/permitext-hmc-court-reviewed.json`.

A later binding should reconstruct the original source entry, guard exact identity/body/aliases plus all five chapter hashes, add only `courts`, and use this 19-section allowlist. Tests should reproduce all 44 matches with the full registry, reject all 130 judicial and 10 definition occurrences, retain complete inner/outer qualifications, and verify edition isolation. Native and rendered popup/citation/Close verification remain outstanding. This audit does not activate product data; implementation and verification remain separate.

Audited registry SHA-256: `5d5fbd9bb6c6d0568189088a9c8d6f19911b28b9dbb45ed7638e352530168bc9`. Source hashes:

- 30000077.html: `dcc196eed865ed4bad3efa726df9b3855dd8e7cf40ade22bd37c19c5372a6066`
- 30000078.html: `80734cb3ad49feb8aec1bc3e5795c859a62bcb5930a4f56aa803a810d50df7b2`
- 30000079.html: `7545311ec4d903e2c89289d5a4a37ddb66fd06c0f4fe8fba4e98dd17ef90f52e`
- 30000080.html: `a76f2a1f60ad0b632c400189a4f8cf48aaeee90dd0315243560a0ff8b08690d2`
- 30000081.html: `2584178f90403fb03f0ba046060a16775248e557aab7da57d17c47f332c01103`

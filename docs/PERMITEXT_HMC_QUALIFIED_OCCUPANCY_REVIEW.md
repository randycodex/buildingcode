# HMC qualified occupancy review — September 17, 2026

Read-only source review; no definitions activated. These four existing meanings remain `review-required`. This work is separate from the ten explicitly deferred unresolved authoritative-source entries.

## Preserved source identity

All four meanings originate in HMC §27-2004(a), `2026-enacted-administrative-code/chapters/30000077.html#section-31001849`. Source SHA-256: `dcc196eed865ed4bad3efa726df9b3855dd8e7cf40ade22bd37c19c5372a6066`.

| Existing term | Existing ID | Source paragraph |
| --- | --- | --- |
| Tenement | `cb82004890d12b1f78e9` | 11 |
| Hotel | `43ebeca3182a8fe2e536` | 12 |
| Public part of a dwelling | `d92d1e718f0255e5c403` | 20 |
| Dormitory | `bee3855926d65cc9bd1d` | 27 |

Any later activation must preserve the entire original body, ID, aliases and citation. Tenement includes both its general meaning and the explicit old-law-tenement qualification. Dormitory includes all four lettered alternatives and their dates/exceptions; its opening sentence alone is insufficient. No plural aliases were proposed or added by this review.

## Corpus findings and bounded proposals

The five HMC chapter files were scanned paragraph by paragraph with normalized section identities and the full published registry. The audit retains original text and exact UTF-16 match ranges. It covers 34 paragraphs containing the reviewed terms or explicitly searched singular/plural variants, including definition prose.

| Term | All searched variants, including definition prose | Application variants | Review result |
| --- | ---: | ---: | --- |
| Tenement | 28 | 22 | Ordinary exact-singular use in §27-2066 is a bounded candidate. Old-law references have explicit support in the complete original body. New-law/fireproof compounds and the mixed old-law-or-new-law phrase are not accepted by this review. |
| Hotel | 8 | 3 | No accepted exact-singular application candidate: §27-2093.1 names an exempt luxury hotel defined by department rules. §27-2041 contains hotels and apartment hotels; neither establishes an approved singular/plural alias or authority to erase the compound qualification. |
| Dormitory | 7 | 4 | Exact singular §27-2075(b) is a bounded candidate for the defined sleeping space. §27-2074 uses plural dormitories. College/school dormitory uses in §§27-2041 and 27-2093.1 require separate contextual treatment; they must not automatically receive the sleeping-space meaning. |
| Public part of a dwelling | 1 | 0 | No application occurrence found for public part(s) of a/the dwelling. No activation benefit established; differently worded paraphrases are outside this lexical audit. |

Supported old-law-tenement application references occur in §§27-2036, 27-2044, 27-2061, 27-2065, 27-2066, 27-2074 and 27-2086. Source paragraph 11 explicitly defines this subtype; preserving that complete source body is essential if these references are enabled later.

Unaccepted Tenement contexts include new-law references in §§27-2060, 27-2066, 27-2074, 27-2081 and 27-2085; fireproof tenement in §27-2074; and “old law or new law tenement” in §27-2089. These require precise context exclusions or separately supported meanings. A section-wide suppression would also remove legitimate neighboring uses, particularly in §§27-2066 and 27-2074.

Definition/terminology sections must remain undecorated. Any later implementation should retain existing HMC section exclusions, edition/code identity, missing-context safeguards, and explicit source hashes across all five reviewed chapter files. The proposed scopes above are review conclusions, not shipped applicability metadata or rendered acceptance.

## Evidence

Detailed artifact: `/tmp/permitext-hmc-qualified-four-audit.json`. It contains all four original registry entries, source-file SHA-256 values, normalized section/anchor and paragraph indices, full paragraph text and SHA-256, variant ranges, proposed exact-match ranges against the full registry, and per-occurrence review classifications. The mixed old/new-law phrase in §27-2089 is expressly unaccepted here even though the lexical JSON classifier recognizes its immediate “new law” prefix.

Raw paragraph listing: `/tmp/permitext-hmc-qualified-four-paragraphs.txt`. Reproduction script: `/tmp/permitext-hmc-qualified-four-audit.mjs`; its generated base JSON can be reproduced, while the classifications/proposals represent the subsequent manual review. Temporary artifacts supplement this durable summary and may not persist indefinitely.

No authored source, registry, matcher, app, account or phone state changed during this audit.

## September 17 — reproducible two-term proposal

A repository-owned read-only audit now reproduces the Tenement/Dormitory proposal: `node permitext-sync-server/scripts/audit-hmc-qualified-applicability.mjs /tmp/permitext-hmc-qualified-proposal.json`. It guards all five enacted chapter hashes and runs against the complete current registry. It never writes product applicability data. Three focused tests in `tests/hmc-qualified-applicability-audit.mjs` pass.

The follow-up review accepts the source-attested plural spellings **tenements** and **dormitories** as proposal aliases. This supersedes the earlier no-plural-proposal statement for these two labels only. Ordinary/old-law Tenement applications produce 14 proposed matches, including plural and singular neighbors in §27-2066; new-law, fireproof and mixed old-law-or-new-law phrases remain excluded at their exact occurrences. Dormitory produces two proposed matches: the lodging-house sleeping-space use in §27-2074 and occupancy use in §27-2075. The complete source expressly includes the lodging-house branch with its owner/janitor/superintendent apartment exception. Institutional references in §§27-2041 and 27-2093.1 remain plain.

The proposal preserves all original IDs, bodies and source records. Its 29 paragraphs include declaration prose and excluded contexts, with exact source/paragraph hashes and UTF-16 ranges. Hotel and Public part of a dwelling remain outside the proposal. This is verified audit evidence; helper implementation, registry activation, native behavior and rendered acceptance remain separate work.

## September 17 — implemented and locally verified

Tenement and Dormitory are now activated with the exact reviewed aliases/exclusions above. The preceding proposal-only statements remain historical audit evidence, superseded by this checkpoint. All original IDs, bodies and citations remain unchanged. Hotel and Public part remain withheld. Verification passed: 118 focused JS tests, 323 browser checks, native actual-source matching across all 29 paragraphs, and generic build 83. Parent inspected both full popup bodies, scrollable citations and dismissal/focus return. Deployment and physical status are tracked separately in the continuation/closeout checkpoint.

## September 17 — Hotel plural follow-up

A complete singular/plural scan finds five Hotel occurrences in general defining prose and three application occurrences: bare “hotels” and “apartment hotels” in §27-2041, plus the rule-defined exempt luxury hotel in §27-2093.1. The bare plural is a prospective application of the unchanged general meaning, “A hotel is an inn having thirty or more sleeping rooms.” The earlier exact-singular review did not establish this plural candidate.

A full-registry hypothetical scope for §27-2041 with alias `hotels` and an `apartment hotels` occurrence exclusion yields exactly one link, leaving both other application contexts and all defining prose plain. Three tests pass in `tests/hmc-withheld-small-inventories.mjs`. No activation occurred; source-guarded generation, native matching and rendered verification remain required.

The portable `scripts/audit-hmc-withheld-small-inventories.mjs` guards all five HMC source hashes and records full paragraphs/ranges. It also confirms Rear yard (five defining occurrences), Side yard (one), and Public part of a/the dwelling (one) have zero singular/plural application occurrences. Curb level has seven defining and four application occurrences; the latter remain subject to the local §27-2083/2085 measurement instructions previously reviewed. No synonyms or inferred aliases were added for those terms. Evidence: `/tmp/permitext-hmc-small-inventories.json`.

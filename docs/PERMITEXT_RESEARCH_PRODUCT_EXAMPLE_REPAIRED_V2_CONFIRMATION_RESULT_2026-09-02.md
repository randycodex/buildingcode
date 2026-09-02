# Permitext repaired-v2 owner-example confirmation result

Date: September 2, 2026

Package commit: `5e67d36ef40c21cd2315ebd06f9b06ece94e0b02`

Authorization commit: `188d35e59ed5a55c0f4aacee055bff2dc2bac831`

Run ID: `9e81b093-5075-4e76-8cdf-ae75ffd38e50`

## Retained outcome

The exact owner-authorized run completed all seven conversations and all nine
ordered turns once:

- 9 of 9 turns completed;
- 24 provider requests settled with zero pending requests;
- actual and conservative reserved spend were both `$1.289404`, below the
  `$2.00` cumulative authorization cap;
- no separate paid judge request was configured or made;
- all work used the isolated temporary local store; and
- no Production data, customer conversation, public feature flag, price,
  allowance, deployment, merge, push, TestFlight build, or release changed.

The immutable machine result is
`permitext-sync-server/evals/results/2026-09-02T17-28-08-506Z-9e81b093-5075-4e76-8cdf-ae75ffd38e50-product-example-repaired-v2-confirmation.json`.
Its readable companion is the matching Markdown file in the same directory.

## Automated review

Seven turns passed every deterministic example check. Two correctly remained
marked for review, so `allDeterministicChecksPassed` is false and the live
confirmation is not a complete acceptance pass:

- The OMH feasibility answer did not retain an attributable official OMH
  source. It safely refused to invent an OMH ratio without the program type,
  but it returned only ADA.gov supporting sources.
- The 2014 vision-lite follow-up was marked because it did not repeat the full
  `100 square inches ÷ 144 = 0.694 square feet` arithmetic. It did, however,
  accurately identify the prior answer's `0.694` value as the conversion of
  `100 square inches` and correctly narrowed the legal conditions.

## Manual answer review

The run proves the repaired runtime can produce direct, source-bounded answers
in the requested formats, but it also exposes two content gaps and one minor
typography defect that the current deterministic review does not fully model.

- Ramp: acceptable. It leads with the main dimensions, uses a readable
  requirements table, identifies exceptions, gives the 30-foot derived run for
  a 30-inch rise, and cites the controlling sections.
- Fire-escape corridor: substantively acceptable. It directly rejects the
  proposed automatic ADA exemption and gives the applicable 44-, 36-, 30-, and
  24-inch table rows. Three unmatched closing quotation marks are a visible
  formatting defect and should be normalized.
- Appendix P: incomplete against the owner's example. It correctly says the
  2022 appendix is `Reserved`, but it does not explain that the 2014 Building
  Code contained the prior accessibility Appendix P or direct the user to the
  current Chapter 11 / ICC A117.1 framework.
- OMH bathroom boundary: safe but incomplete. It does not invent the screenshot
  example's assumed residential-program ratios, and it correctly asks for the
  exact OMH program type. It should still expose the official OMH source that
  was searched and, once a program is identified, retrieve the controlling
  official regulation or guideline before stating an OMH minimum.
- Habitable room: acceptable. It gives the 80-square-foot and 8-foot baseline,
  relevant exceptions, and a short practical interpretation.
- C4-4D versus R8A, both turns: acceptable. The first answer uses a comparison
  table and the follow-up obeys the request for one short paragraph while
  preserving the controlling references.
- 2014 vision lite, both turns: acceptable on substance. The first answer gives
  the requested conversion and the second corrects the overgeneralization,
  confirms the edition, and accurately limits the 100-square-inch rule to the
  stated conditions. The follow-up checker is too rigid for conversational
  carry-forward and produced a review false positive.

The practical manual result is seven acceptable turns and two incomplete turns:
Appendix P and the OMH outside-authority case. This is not an official code
determination and does not authorize public Research release.

## No-cost correction completion

The four source-level corrections exposed by this immutable run are now
implemented and verified without another provider call:

1. an edition-ambiguous Appendix P question routes both the current 2022 corpus
   and the prior 2014 corpus; discovery retrieves the 2022 `Reserved` status,
   current Chapter 11 context, and the 2014 P101.1/P102.1 accessibility scope;
2. official outside-authority candidate pages are requested independently. If
   an attributable OMH passage is still unavailable, the official OMH page is
   preserved visibly only as a starting point and expressly not as proof of a
   program-specific ratio;
3. unmatched closing curly quotation marks are removed from generated answer
   prose while balanced quotations and enacted evidence remain unchanged; and
4. the vision-lite reviewer recognizes `conversion` as an explicit description
   of the carried-forward `100 square inches` to `0.694 square feet` arithmetic.

The Appendix P acceptance check now requires the current `Reserved` status,
the 2014 distinction, and accessibility context rather than accepting the word
`Reserved` alone. The seven-conversation, nine-turn runtime contract passes
with zero network attempts and zero paid calls, and the complete server
`npm run check` passes. Retrieval diagnostics and their review packet were
regenerated for discovery version `20260902-appendix-p-cross-edition-v22`.

These checks prove the deterministic correction paths, not a new live-model
outcome. The retained run above remains seven acceptable and two incomplete
turns as historical evidence. No third paid confirmation is planned or needed
for the present correction work. The current authorization is consumed and
cannot be reused; any future live measurement would require a separately
designed package and a new exact owner authorization.

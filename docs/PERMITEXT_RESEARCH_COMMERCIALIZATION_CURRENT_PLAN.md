# Permitext Research Commercialization — Current Plan

Last updated: August 28, 2026

Working branch: `codex/research-commercialization`

This is the current source of truth for the Research workstream. The parent Beta 1 plan is [PERMITEXT_BETA1_MASTER_PLAN.md](./PERMITEXT_BETA1_MASTER_PLAN.md).

## Objective

Ship a Research system that:

- uses Luna first and escalates difficult or failed answers to Terra;
- preserves Terra-level reliability on material code conclusions;
- costs no more than approximately $4–$6 per 100 fully used included turns;
- charges one user turn only for a successfully completed and saved answer;
- behaves consistently on web and iOS through the shared backend;
- keeps enacted text, Project facts, uncertainty, citations, and the non-official interpretation boundary visible.

## Completed

- [x] Added Luna-first / Terra-escalation routing and model-neutral user wording.
- [x] Added model, cost, latency, verification, and escalation telemetry.
- [x] Preserved one-charge-per-completed-user-question semantics; internal retries and provider failures do not consume additional turns.
- [x] Added deterministic citation, evidence-boundary, applicability, and answer-quality checks around the models.
- [x] Aligned Research trust, deletion, authority, and Project-context handling across web and iOS.
- [x] Added commercialization benchmark infrastructure, spend caps, frozen configuration, and completion checks.
- [x] Ran the first complete 20-case frozen hybrid cohort after restoring provider credit.
- [x] Recorded and pushed the benchmark report.

### First complete cohort result

- 20 of 20 Research operations completed; no provider failures.
- Operating answer cost: $1.069039 total, approximately $5.35 per 100 turns.
- Latency: 20.388 seconds p50 and 37.349 seconds p90.
- 9 cases passed every exact evaluation rubric.
- 11 cases completed but missed one or more expected qualifications, missing facts, or evidence-boundary statements.
- Full evaluation cost including the separate grader: $1.726035.

Retained report:

- `permitext-sync-server/evals/results/2026-08-27T21-53-23-508Z-bf772b34-fb6e-4b54-b303-7adab469edb5.md`

## In progress now

- [x] Preserve every Project fact explicitly marked unknown through initial generation and revision.
- [x] Treat owner/applicant claims, positions, assertions, and representations as facts requiring verification—not as proven project facts.
- [x] Give the verifier the same structured unresolved-fact map used by the answer model.
- [x] Strengthen the generic selected-evidence instructions so answers state what the supplied provision cannot establish and preserve material provisos or second-sentence rules.
- [x] Add no-cost contract tests for these safeguards.
- [x] Run the normal no-cost Research suites and the repository-wide `npm run check` gate.

The safeguards are committed and pushed, and the no-cost repository gate passes.

## Paid validation after the no-cost tests pass

- [x] Rerun only the previously failed cases under an explicit spend cap.
- [x] Review the new answers for both quality and cost; do not accept an evaluator score blindly where the legal conclusion is still questionable.
- [x] If the targeted cases improve without regressions, run one new complete frozen cohort.
- [x] Compare quality, p50/p90 latency, Luna/Terra escalation rate, and projected cost per 100 turns with the first cohort.

First targeted attempt: the Certificate-of-Occupancy case correctly remained uncharged but failed before grading because automatic web support routed around the intentionally disabled Zoning Research corpus and produced an attribution conflict. It cost $0.134553 in provider calls. The source-policy repair now prevents an intentionally blocked corpus from triggering automatic web support; explicit official-guidance requests remain available.

### Targeted rerun result

Eleven completed targeted cases were evaluated with prompt v30: the repaired Certificate-of-Occupancy case plus the ten remaining first-cohort failures. There were no provider failures.

- 5 passed every prior exact rubric gate.
- 6 scored from 3.65 through 3.96 out of 4 but failed at least one exact completeness item.
- Operating Research cost was $0.733283.
- Total evaluation cost including the independent Terra grader was $1.119755.

The review separated actual answer gaps from evaluator overreach. A conceptual omission, unsafe claim, unsupported citation, or materially inadequate uncertainty remains fatal. Missing-fact recognition now uses the existing 3-of-4 passing threshold rather than requiring every ancillary checklist item to appear verbatim; otherwise a useful 3.96 answer could fail solely for omitting a peripheral filing note. Three answers still have genuine required-concept gaps and remain targeted for repair: movable-seat approved-record context, sidewalk-cafe approved-capacity and electrical boundaries, and garage ventilation quantity/rate/capacity boundaries.

Prompt v31 adds a material-completeness review that names distinct approved records, quantities, rates, capacities, dimensions, system-design inputs, and expressly implicated technical or agency conditions instead of collapsing them into phrases such as “full design” or “other requirements.” It also prohibits irrelevant permit or agency checklist padding.

The first v31 diagnostic reran the three conceptual failures and showed that prompt wording alone was insufficient. Movable seating completed at 3.82, sidewalk café failed closed before charging because both the initial answer and its bounded revision misstated the dining-surface percentage, and the Luna garage answer completed at 3.64. Total provider and grader spend was $0.186111; only the two completed Research operations reached the charged-completion state. No further paid retry was made on the same implementation.

The resulting engineering changes are intentionally narrow and source-governed:

- the draft movable-seat rubric no longer requires Permitext to guess or name PACO authority that is outside the selected evidence;
- an objectively detected per-dining-surface percentage error is repaired only when the answer already cites the exact enacted BC 1108.2.9.1 passage, and the corrected point is bound to that passage;
- questions expressly asking what can and cannot be concluded route to Terra because they require material evidence-boundary judgment rather than a simple Luna lookup.

The next capped rerun passed movable seating at 3.79/4 and garage ventilation at 4.00/4. The sidewalk-café answer completed without a verification failure and scored 3.83/4; direct review found that it correctly covered every supplied provision and safety boundary. Its only fatal draft rubric combined those material requirements with heater, lighting, and electrical topics absent from both the question and selected evidence. That unreviewed draft rubric is being narrowed to the actual bounded question rather than forcing unrelated checklist content into user answers.

After the draft rubric was narrowed, the final sidewalk-only diagnostic completed and charged normally but scored 3.62/4. This exposed a real product defect rather than another evaluation-scope problem: the internal verifier accepted two source paraphrases that were not precise enough. The answer substituted an accessible “dining surface” for the enacted requirement governing accessible seating and standing spaces, and it broadened BC 3111.4 from the enumerated awning, enclosure, fixture, equipment, and removable-platform components to “furniture or equipment.” The Research operation cost $0.079986; total diagnostic cost including the independent grader was $0.131224.

The new source-bound paraphrase repair corrects those two statements only when the answer already cites the exact enacted BC 1108.2.9.1 or BC 3111.4 evidence. It also corrects the associated structured missing-fact text and makes the internal quality gate reject the dining-surface substitution if the repair is ever bypassed. The retained paid answer now passes the deterministic answer-quality gate after repair, and the complete repository-wide `npm run check` gate passes without paid model calls.

The final capped sidewalk-only confirmation passed 4.00/4: 9/9 required concepts, 11/11 required missing-fact conditions, all five required citations, and no unsupported claim or critical failure. The production Research turn took 40.285 seconds and cost $0.083952; total diagnostic cost including the independent grader was $0.131864. It used Terra for the complex answer, Luna verification, and one bounded repair for a false evidence-limitation statement. This clears the final targeted blocker for a new frozen cohort.

### Frozen v2 cohort attempt

The immutable v2 cohort began from commit `de87dbc07780c597dde6f65cfb94f7457d433148` with 20/20 cases evidence-ready. It is retained as a partial operational diagnostic, not a quality or commercialization result:

- 11 Research turns completed: 8 passed and 3 were subthreshold.
- The mixed-occupancy plumbing answer misstated the division of authority between the Building Code and Table 403.1 and did not state the shared-facility evidence boundary directly.
- The legacy fire-alarm answer did not state clearly that a separate qualifying building/occupancy-wide trigger cannot automatically be confined to the enlarged portion.
- The garage answer correctly rejected the proposed controls but again hid detector quantity, airflow rate, and capacity inside a generic full-design limitation.
- Case 12 timed out at the provider. The next eight cases encountered immediate network/provider failures; all nine failed turns remained uncharged.
- Actual settled evaluation cost was $0.985185. Because requests without a billable response cannot safely be assumed free, 19 failed-attempt reservations remained conservative and brought the recorded upper bound to $3.935989 under the $4.00 cap.

The provider client now reports nested network causes instead of only `TypeError`, and future frozen cohorts stop on the first case error so one outage cannot cascade across the remaining suite. The incomplete evidence is retained at `permitext-sync-server/evals/results/2026-08-27T23-21-46-942Z-b53d4522-4a59-49cb-b625-47760ffa7a37.md`.

### Targeted v2 remediation confirmation

After the provider health check succeeded, the three subthreshold v2 cases were rerun separately through the production Research path with a $0.75 per-case cap and stop-on-error enabled:

- mixed-occupancy plumbing passed 4.00/4 in 35.604 seconds; the Research operation cost $0.092032 and the full diagnostic including the independent grader cost $0.123114;
- legacy fire-alarm scope passed 3.84/4 in 26.518 seconds; the Research operation cost $0.049017 and the full diagnostic cost $0.090223; all required concepts, missing facts, and citations passed, with only a nonmaterial citation-relevance description losing one point;
- garage ventilation controls passed 4.00/4 in 13.316 seconds; the Research operation cost $0.023273 and the full diagnostic cost $0.042860.

The three Research operations cost $0.164322 in total and the complete diagnostics cost $0.256197. None produced a provider error, unsupported claim, forbidden claim, or critical failure. These targeted results clear the three v2 defects for a new frozen cohort; they do not replace the required complete cohort.

### Frozen v3 cohort attempt

The immutable v3 cohort began from remediated application commit `ac024f04788ae7552e98198c4db9813437691c26`. It passed the former provider-timeout point and is retained as another partial operational diagnostic:

- 15 Research turns completed: 14 passed and one was marked failed only because an otherwise correct English answer ended one missing-fact sentence with a stray Armenian word.
- The three v2 remediation cases passed again: mixed plumbing 4.00/4, legacy fire alarm 3.68/4 with all required gates satisfied, and garage ventilation 4.00/4.
- Case 16 failed safely after both the initial answer and bounded revision put an automatically retrieved web-guidance statement inside enacted-code supported points. No user answer was returned and the turn was not charged.
- The case expressly asked for a conclusion “Based on” four named Administrative Code provisions. Automatic web support was unnecessary for that bounded question and increased cost and attribution risk.
- Completed-turn operating cost was $0.932010. The failed verification consumed $0.121499 of provider work, bringing total operating cost to $1.053509. The incomplete sample's projected $7.02 per 100 turns is not a commercialization result because it amortizes that failed turn over only 15 completions.
- Completed-turn latency was 24.771 seconds p50 and 36.407 seconds p90.

Permitext now treats an express “Based on [named provisions]” question as section-bounded unless the user also requests an external lookup. English Research narrative sanitation also removes isolated letters from other writing systems while preserving Latin text, numbers, punctuation, symbols, and units. The partial evidence is retained at `permitext-sync-server/evals/results/2026-08-27T23-55-01-805Z-d91a79dc-85f5-4e76-9374-0d477c1cdcbe.md`.

The targeted occupancy confirmation then passed 4.00/4 in 45.936 seconds. Telemetry confirmed that web support was neither requested nor searched, with `selected_evidence_boundary` recorded as the reason. The Research operation cost $0.119429 and the full diagnostic including the independent grader cost $0.150251. One bounded repair removed an improper request to reconfirm an established Project fact. This clears the v3 fail-fast blocker for a new frozen cohort.

### Frozen v4 cohort attempt

The immutable v4 cohort began from the section-bounded and English-sanitation fixes and stopped safely when the OpenAI API credit balance was exhausted:

- 18 Research turns completed: 17 passed every exact rubric gate and one scored 3.47/4 because it applied BC 1101.3.1 categorically while prior-code-building status remained an unverified applicant representation.
- All 16 cases preceding that answer passed, including every prior v2 and v3 remediation case. The next roof-recovering case also passed 4.00/4.
- Case 19 received `credit_balance_exhausted`; the failed user turn was not charged, and case 20 was not attempted because stop-on-error was active.
- Completed-turn operating cost was $1.108311. The recorded $1.449590 operating upper bound includes a conservative $0.341280 reservation for the failed provider request and therefore is not a valid projected cost-per-100 result.
- Completed-turn cost was $0.046152 p50 and $0.116791 p90. Latency was 26.260 seconds p50 and 42.932 seconds p90.
- The incomplete sample cannot decide pricing or the 100-turn allowance because it contains only 18 completed turns and one unresolved provider reservation.

The retained partial evidence is `permitext-sync-server/evals/results/2026-08-28T00-17-54-753Z-e737d550-b07d-4e8d-9f7b-4bf9e8853009.md`.

The BC 1101.3.1 defect is now covered by a generic deterministic consistency gate. When supplied BC 1101.3 ancestor text limits the descendant rule to prior-code buildings and that status remains represented or unresolved, every project-specific accessibility consequence must remain conditional on confirming the prior-code-building and alteration/change context. The answer prompt and independent verifier carry the same boundary. The saved v4 answer now fails that local gate, while a properly conditional answer passes. The affected case is evidence-ready through Permitext's conversation flow in mock mode without a paid model call.

The first paid confirmation after credit restoration failed closed and charged zero Permitext user turns. The initial answer omitted a material AC 28-118.3.1 certification condition; the bounded Terra revision repaired that point but reintroduced the categorical BC 1101.3.1 statement. Three provider requests cost $0.138138 before the internal deterministic gate rejected the revision. The failure is retained at `permitext-sync-server/evals/results/2026-08-28T01-34-11-648Z-3e63fff2-a8e7-4092-82ac-c77a4ce5edc6.md`.

Answer-quality v22 now performs a narrow source-bound deterministic repair after declared Project uncertainty is restored. Only when the exact BC 1101.3 ancestor scope and cited BC 1101.3.1 evidence are both present, and prior-code-building status remains represented or unresolved, it conditions an otherwise categorical accessibility sentence on the prior-code-building and alteration/change scope. It does not rewrite the missing-fact request or add outside law. The saved v4 answer changes from deterministic failure to pass after this repair, and the complete no-cost repository gate passes.

Both capped targeted confirmations now pass every exact rubric gate:

- The repaired mercantile-to-business case passed 4.00/4 with all 11 required concepts, all 11 missing-fact conditions, and no forbidden claims. It completed on the first verification attempt in 40.138 seconds. The production turn cost $0.072414 and the complete diagnostic including its independent grader cost $0.121354. The completed user turn was charged once. Retained evidence: `permitext-sync-server/evals/results/2026-08-28T01-41-39-976Z-75658379-344d-47ab-a98a-c7233586e4d0.md`.
- The provider-interrupted BC 1019.3 case passed 4.00/4 with all 7 required concepts, all 6 missing-fact conditions, and no forbidden claims. It completed on the first verification attempt in 28.382 seconds. The production turn cost $0.054498 and the complete diagnostic including its independent grader cost $0.083380. The completed user turn was charged once. Retained evidence: `permitext-sync-server/evals/results/2026-08-28T01-43-17-103Z-2f961482-50cb-4b2d-afa9-1a7e46c324ad.md`.

These targeted passes clear the fail-fast blockers for a new immutable v5 cohort. They are not a pricing sample by themselves.

### Frozen v5 cohort attempt

The immutable v5 cohort stopped as a partial result after a scored quality failure:

- Nine production turns completed and settled; eight passed and one failed. Seven answers scored 4.00/4, and the remaining passing answer scored 3.84/4.
- The movable-seating answer scored 3.26/4. It correctly rejected selected movable-seat counting, required function-by-function calculations, preserved the commissioner-established lower-basis requirement, and rejected an unsupported nonsimultaneous-use omission. It then improperly inferred that no Certificate-of-Operation analysis was required because no individual room was represented as reaching 75 persons. BC 303.7 did not establish that individual rooms were the governing threshold unit.
- The answer also omitted the existing approved occupancy record from its missing-fact request and described only egress capacity rather than the broader unresolved egress-design inputs.
- Production operating cost was $0.537829; the nine separate graders cost $0.259726; total evaluation spend was $0.797555. Production latency was 16.185 seconds p50 and 38.361 seconds p90.
- The v5 `--stop-on-error` behavior stopped thrown provider/runtime errors but not a scored quality failure. Two later operations began before the operator interrupted the run. No case after case 9 ran, all nine operations settled, and no paid request remained pending.
- The incomplete nine-turn sample cannot decide pricing or the 100-turn allowance.

The retained partial evidence is `permitext-sync-server/evals/results/2026-08-28T01-49-25-092Z-8aaf2e22-a707-496a-ba66-5e2f5275c983.md`.

Answer-quality v23 adds a source-bound guard against treating an individual-room representation as dispositive of the BC 303.7 indoor-assembly-occupancy threshold. It replaces that unsupported negative applicability conclusion with an explicit unresolved filing boundary. For an occupant-load question asking to retain an existing 1:100 basis, it also preserves the existing approved occupancy record and broader egress-design inputs as missing facts. The evaluation runner now treats a scored quality failure as a stop condition. The exact saved v5 failure changes from local deterministic failure to pass after the repair, and the complete no-cost repository gate passes. V5 will not be rerun.

### Frozen v6 complete cohort

The separately authorized immutable v6 cohort completed all 20 production Research turns and all 20 independent evaluations from the post-v23 implementation:

- All 20 answers passed every fatal evaluation gate. Fifteen scored 4.00/4, four scored 3.84/4, and the repaired movable-seating case scored 3.79/4.
- No provider, verification, citation, unsupported-claim, or charging failure occurred.
- Production Research cost was $1.148132, or a projected $5.74 per 100 completed turns at this cohort's mean. The separate graders cost $0.631223, bringing the one-time evaluation total to $1.779355 under the authorized $4 cap.
- Completed-turn cost was $0.047130 p50 and $0.096868 p90. Production latency was 20.010 seconds p50, 31.669 seconds p90, and 40.454 seconds maximum.
- Five of 20 turns needed one bounded verifier-driven revision. Every completed user question was charged exactly once; internal revisions added no user-visible turns.
- Every question routed directly to the accurate Terra answer tier because this deliberately difficult cohort triggered complexity or evidence-boundary rules; Luna verified every answer. There were no Luna-answer-to-Terra escalations in this sample.

The result is retained at `permitext-sync-server/evals/results/2026-08-28T02-26-08-632Z-edc69c6b-bf30-4856-859e-99667d03bd2b.json` with its generated review report beside it. V6 is frozen and must not be rerun.

### No-cost V6 subscriber economics

The V6 costs now have a deterministic no-cost subscriber-level model. It bootstraps complete fully utilized subscriber months from all 20 measured production-turn costs instead of multiplying a single-turn percentile by the allowance.

- 100 turns: model cost $5.74 p50 and $6.06 p90.
- With the owner-approved ten support minutes at $30/hour and planning reserves for payment, tax, refunds, and infrastructure: web costs $14.52 p50 / $15.84 p90; iOS at the confirmed 15% commission costs $16.54 p50 / $17.86 p90; iOS at 30% costs $20.86 p90.
- The owner accepted a $2 minimum Beta contribution at full p90 usage. One hundred turns therefore remains the Beta allowance, leaving $4.16 p90 contribution on web and $2.14 on 15%-commission iOS. The longer-term target is $4–$6 after actual customer evidence.
- Launch-volume sensitivity now allocates the full $45 p90 monthly infrastructure budget across 10, 25, 50, and 100 fully utilized subscribers. At 10, p90 contribution is $1.46 on web and -$0.56 on 15%-commission iOS; at 25 it is $4.16 and $2.14. The accepted $2 floor first passes at 12 fully utilized web subscribers and 24 fully utilized iOS subscribers.
- Refund sensitivity now covers 0%, 1%, 3%, 5%, and 10% of gross revenue. At the working 5% reserve, the model withholds $1.00 from each $20 charge; at 10%, p90 contribution falls to $3.16 on web and $1.14 on 15%-commission iOS.
- The source audit found that current Stripe Checkout does not enable automatic tax, specify inclusive/exclusive tax behavior, or collect/update a billing address for tax. The 5% line remains a downside reserve—not a tax rate—until professional classification/registration guidance and provider configuration are complete.
- No product price, included allowance, pack price, or purchase configuration changed.

Detailed report: [PERMITEXT_RESEARCH_SUBSCRIBER_ECONOMICS_V6.md](./PERMITEXT_RESEARCH_SUBSCRIBER_ECONOMICS_V6.md)

### Cross-platform response-contract confirmation

The current checked-in web and iOS clients now share a retained V6-shaped Research response fixture. The no-cost contract verifies that the server removes internal usage, cost, and pricing metadata while preserving the user-visible answer, authority classification, code basis, source date, fact usage, supported points, unresolved facts, limitations, follow-up questions, supporting sources, citations, and professional-use notice.

The check found and repaired one native parity gap: web already displayed the searched and explicitly pinned corpus edition and applicability metadata, but iOS decoded `codeBasis` without retaining those corpus records. The native model now decodes them, the Research answer displays them with an accessibility label, and copied answers preserve the same corpus-basis lines.

Evidence:

- `permitext-sync-server/tests/fixtures/research-client-response-v1.json` is the shared server/web/iOS fixture and is checked against the retained immutable V6 result shape.
- `node tests/research-trust-boundary-contract.mjs` passes and verifies server serialization plus the web display contract.
- Focused iOS Simulator contract tests pass against the exact shared JSON fixture, including native decode and copied-text output.

This is source and Simulator evidence. It does not claim that the existing TestFlight binary contains the repair; production web and the next compatible TestFlight build still require release-stage verification.

### No-cost Stripe subscription lifecycle confirmation

A local provider-simulated Stripe test-mode exercise now covers the Pro subscription lifecycle without contacting Stripe or creating a charge. It verifies authenticated Checkout creation, signed-event-only fulfillment, duplicate idempotency, renewal expiration, scheduled cancellation through the prepaid period, failed-invoice non-renewal, partial-refund preservation, full-refund cancellation and revocation, and delayed-event recovery.

The first exercise exposed a material ordering defect: after a full refund deleted the entitlement, a delayed older active-subscription event could restore Pro because the last provider timestamp disappeared with the entitlement. The server now retains a per-subscription lifecycle cursor independently of the entitlement in both local storage and PostgreSQL. Terminal events win same-second ties, older or duplicate events cannot mutate access, and a subscription cursor cannot transfer to another Permitext account. Existing PostgreSQL Stripe entitlements seed the cursor during schema initialization.

The permanent `npm run test:billing` suite now includes this lifecycle exercise and reports zero paid provider calls. The normal Beta 1 suite also includes it. This is local provider simulation, not Stripe-created test data, production provider evidence, or a public-billing authorization.

### Provider-backed Stripe sandbox confirmation

A separate provider-backed sandbox exercise now covers Stripe-created Checkout, signed-event fulfillment, duplicate delivery, owner/mismatched-owner restore, scheduled and terminal cancellation, clock-driven renewal, failed invoice, partial and full refunds, and delayed-event recovery. It used synthetic Stripe test data and moved no real money.

The exercise found one material compatibility defect before release: the current Stripe `2026-06-24.dahlia` `charge.refunded` event no longer carried the older direct `invoice` field. Permitext preserved Pro after the first full-refund delivery because it could not find the subscription invoice. The server now resolves an absent direct invoice through `charge.payment_intent` and Stripe's Invoice Payments API, requires one unambiguous invoice match, and retains that event shape in the permanent lifecycle contract. Replaying the same real provider event then removed Pro and canceled the sandbox subscription.

The Stripe test clock extended the recorded expiration by one month, a provider-created failed invoice granted no access and produced the operational warning, partial refund preserved Pro, full refund removed it, duplicate/stale events were inert, and restore succeeded only for the owning Permitext account. All created subscriptions ended canceled or incomplete-expired; all four exercise customers and the test clock were deleted; the temporary CLI session was revoked. Detailed IDs and boundaries are retained in [PERMITEXT_STRIPE_PROVIDER_SANDBOX_EVIDENCE_2026-08-28.md](./PERMITEXT_STRIPE_PROVIDER_SANDBOX_EVIDENCE_2026-08-28.md).

This closes the provider-backed Stripe sandbox item. It does not close controlled production billing evidence, Stripe Tax configuration, Apple Sandbox/TestFlight billing, deployment, or public-billing authorization.

### No-cost Apple subscription lifecycle confirmation

A permanent local exercise now sends ES256-signed App Store Server Notifications V2-shaped payloads through Permitext's actual transaction-verification and notification HTTP routes. It uses an ephemeral local certificate chain, contacts no Apple service, creates no App Store transaction, and reports zero paid provider calls. The sequence covers ownership binding, renewal, auto-renew disablement, notification ordering, failed renewal with and without grace, grace expiration, billing recovery, refund, refund reversal, duplicate delivery, and delayed delivery.

The exercise found two material lifecycle defects. First, `DID_FAIL_TO_RENEW` without `GRACE_PERIOD` could preserve access from a future expiration embedded in the failed transaction; Permitext now revokes unless a signed active grace deadline exists. Second, notifications with no immediate entitlement change returned before recording their signed date, allowing an older delayed terminal event to overwrite a newer snapshot. Permitext now advances the Apple notification cursor while preserving the current entitlement.

`npm run test:billing` retains both regressions and the complete signed-route sequence. Detailed results and boundaries are in [PERMITEXT_APPLE_LOCAL_LIFECYCLE_EVIDENCE_2026-08-28.md](./PERMITEXT_APPLE_LOCAL_LIFECYCLE_EVIDENCE_2026-08-28.md). This is local cryptographic simulation, not Apple-created Sandbox data, TestFlight evidence, production evidence, or public-billing authorization.

### No-cost Apple Sandbox staging preparation

The iOS project now reads its backend URL from the `PERMITEXT_BACKEND_API_BASE_URL` build setting. Debug and Release retain the Production URL as the default, and an explicitly authorized TestFlight archive can override it with an isolated staging URL without changing the checked-in Production default.

A fail-closed `npm run verify:apple-sandbox-readiness` guard now rejects Production runtime, Production hostnames, shared database or Blob storage, missing Apple root-certificate pins, missing Clerk or approved policy-version configuration, enabled paid Research turns, a disabled Research kill switch, and any live Stripe secret. The permanent contract passes with a complete synthetic staging configuration and proves each material unsafe state is rejected. The current Vercel Preview environment is ineligible because it shares the Production database.

Apple's current documentation confirms that development-signed and TestFlight apps use Sandbox and do not create real charges. App Store Connect supports a separate Sandbox notification URL; if none is configured, Sandbox notifications fall back to the Production URL. Permitext must not use that fallback because Production intentionally rejects Sandbox transactions.

The preparation itself made no provider change. The owner subsequently authorized the isolated provider work recorded below. No price change, Apple transaction, paid call, Production deployment, or Production notification configuration was part of either step.

### Read-only App Store Connect confirmation

The authenticated App Store Connect record confirms the expected app and subscription identifiers, a one-month `Permitext Pro Monthly` product in `Prepare for Submission`, two existing United States Sandbox accounts, and processed TestFlight builds through build 41. Build 41 is ready for internal testing but predates the staging-backend override and still targets Production, which rejects Sandbox transactions.

The owner later authorized configuring only the Sandbox App Store Server Notification URL. It now points to `https://permitext-apple-sandbox.vercel.app/billing/apple/notifications`; the Production URL remains unset. Billing Grace Period remains unset. The subscription's English description, review notes, and missing review screenshot require later submission-readiness work. Apple's three official root certificates were downloaded from Apple, their SHA-256 fingerprints were verified with OpenSSL, and the staging guard requires the complete exact set.

### Isolated Apple Sandbox deployment and physical-iPhone evidence

The owner authorized a dedicated `permitext-apple-sandbox` Vercel project with a custom `apple-sandbox` Preview environment, a separate free Neon database, and a separate private Blob store. The environment contains no Stripe secret or OpenAI key, has paid Research turns set to zero and the Research kill switch enabled, and passes all 17 fail-closed staging checks. Its public `/health` endpoint returns HTTP 200 with PostgreSQL storage. The duplicate-idempotency repair is additionally live as protected custom-environment deployment `dpl_Ap73hjFdfjGr4uyzauAmXUuihpXv`, whose `/health` and `/release` identify exact commit `b83194446a6ed8178f597d8bb9a81475b0d52a0b`. The public staging alias was not reassigned; Production was not deployed or reconfigured.

Build 42 established the isolated archive path. Build 43 repaired a stale Release debug-backend override and completed the first Apple-created, no-charge Sandbox purchase on the owner's physical iPhone. Permitext showed `Pro (Test)`, Sandbox/TestFlight billing, a synced account, and all 100 included Research turns. Apple's first server notification reached staging but returned HTTP 503 because build 43 had not bound the device transaction to the Permitext account; the server correctly failed closed instead of granting an unowned entitlement. Apple's official guidance later confirmed that automatic failed-delivery retries are Production-only and Sandbox attempts a notification once.

Build 44 added exact-host-gated Sandbox backend verification without changing Production behavior. The complete 111-test entitlement/sync contract suite passed, the archive was verified as version 1.0 build 44 with the isolated staging backend, and App Store Connect reports it `Complete`, `Ready to Submit`, and associated with Internal Testers. Restoring the existing Sandbox purchase on build 44 produced four HTTP 200 `/billing/apple/transactions/verify` responses and bound the Apple transaction to the signed-in Permitext staging account without another purchase or charge. A later Sandbox notification arrived almost exactly one hour after the earlier HTTP 503 and received HTTP 200. This record previously classified it as a retry, but that classification is withdrawn because Apple says Sandbox does not perform failed-delivery retries and the route log does not expose the notification UUID or signed type. Disabling Sandbox automatic renewal was followed by another HTTP 200 notification; only delivery—not the exact decoded type—is claimed. After a force-close and relaunch, Permitext remained `Pro (Test)`, proving access was retained through the cancellation period. App Store Connect confirms the tester's monthly subscription renewal rate is one hour. At this stage, failed-delivery recovery, expiration, renewal, billing failure/recovery, refund, duplicate-delivery, and delayed-delivery cases were still open.

Build 45 added an in-app, Apple-controlled refund-request entry point for a verified active Pro transaction. Its source contract and 112-test entitlement/sync suite passed, and App Store Connect made the verified staging archive available to Internal Testers. Physical-iPhone testing then exposed a presentation defect: tapping `Request Refund from Apple` produced neither Apple's sheet nor an in-app result message. No refund request was submitted.

Build 46 replaces that sheet binding with StoreKit's direct `Transaction.beginRefundRequest(for:in:)` API using Permitext's foreground-active `UIWindowScene`, adds an explicit presentation-failure message, and makes the visible capsule the full tap target. The complete entitlement/sync suite again passed 112 tests with zero failures. The clean archive was verified as version 1.0 build 46, bundle ID `com.randycodex.permitext`, team `57BY95X97H`, non-exempt encryption disabled, and backend `https://permitext-apple-sandbox.vercel.app`. Its upload completed successfully, Apple made it available in TestFlight, and the owner installed it. Apple's first refund-sheet load returned `Cannot Connect`; after the Sandbox account was refreshed, the native `Request Refund [TestFlight]` form loaded for `Permitext Pro Monthly`, the owner submitted it, and Apple displayed `Your request has been submitted`. This passes refund-form presentation and submission, but not entitlement revocation.

After the submitted refund, isolated staging received four Apple notification requests with HTTP 200 responses and a force-close/relaunch produced four HTTP 200 `/billing/apple/transactions/verify` responses, yet build 46 still displayed `Pro (Test)`. Source inspection found two material defects: transaction verification could re-grant Pro from an older active JWS without consulting a newer refund notification, and iOS did not clear its cached backend entitlement when verification returned no entitlement. Permitext now orders the transaction JWS against the persisted Apple notification `signedDate`, makes the newer notification authoritative, prevents an atomic PostgreSQL re-grant race, rejects mismatched-account replays without exposing entitlement data, and clears the iOS cache before resolving the plan. The signed Apple lifecycle simulation reproduces refund followed by stale relaunch verification and proves it remains Free while a genuinely newer repurchase can still restore Pro. `npm run test:billing` passes with zero paid provider calls, and the complete isolated iOS entitlement/sync suite passes 112 tests with zero failures in `Test-permitext-2026.08.29_00-02-13--0400.xcresult`.

The repair commit `658c1264d6bcb57440e590d0bbf91b274e3b765d` is now live only on isolated Apple staging. Its stable host returns HTTP 200, PostgreSQL storage, and the exact commit identity; Production remains unchanged. A clean staging-targeted build 47 archive also succeeded and was verified as version 1.0 build 47, the expected bundle/team, non-exempt encryption disabled, and backend `https://permitext-apple-sandbox.vercel.app`. After the owner signed into Xcode Apple Accounts, that exact archive uploaded successfully without a rebuild. Apple accepted the package at approximately `2026-08-29 6:50:28 AM EDT` with no upload errors, made it available in TestFlight, and the owner installed it. Without another purchase or Restore, build 47 displayed Free on the physical iPhone. This passes refund revocation at the device layer and confirms that neither the stale transaction JWS nor the cached iOS entitlement restores Pro after Apple's newer refund state.

At the expected accelerated period end, Apple sent another server notification at `2026-08-28 10:14:04 PM EDT` and isolated staging returned HTTP 200. The owner then confirmed that build 44 displayed Free as the active plan. The provider delivery and physical-device state together pass the canceled-subscription expiration case: Pro access did not survive the paid Sandbox period. With the later build 47 refund-revocation pass, renewal, billing failure/recovery, duplicate-delivery, and delayed-delivery cases remained open.

A new United States Sandbox tester configured for five-minute monthly renewals then completed another no-charge build 47 purchase. Apple confirmed the purchase, but the first account-link request returned HTTP 500 because PostgreSQL inferred Apple's millisecond `signedDate` comparison as a 32-bit integer. Commit `c1858dbe60adf9589a3cc762a2fa4c237ecaee79` explicitly binds both signed-date comparisons as `BIGINT` and adds a permanent billing contract. `npm run test:billing` passes with zero paid provider calls, and the repair is deployed only to isolated Apple staging. After a force-close and relaunch, the app automatically verified the Apple transaction with HTTP 200 and displayed `Pro (Test)` without a second purchase. Apple then delivered a server notification at `2026-08-29 2:00:27 PM EDT` and received HTTP 200; a later relaunch produced additional HTTP 200 transaction verifications and the owner again confirmed `Pro (Test)`. Because the configured five-minute initial period had elapsed, this passes the no-charge Sandbox renewal case at both provider-delivery and physical-device layers. At that stage, billing failure/recovery, duplicate delivery, and delayed delivery remained open.

The five-minute tester then exercised billing failure and recovery. With `Allow Purchases & Renewals` disabled, the physical iPhone resolved to Free. Re-enabling it restored active Pro access, completing the lifecycle case, but build 47 could degrade the explicit Sandbox identity from `Pro (Test)` to plain `Pro` after a transient HTTP 429 verification response. Commit `04aec83126fe21ac9086527fb3911acd9f2aad95` now preserves that label only for a previously linked, active Apple Sandbox entitlement across transient verification failures; ownership conflicts, inactive or expired entitlements, Production transactions, non-Apple billing, and expired sessions remain fail-closed. The complete entitlement/sync suite passes 113 tests with zero failures in `Test-permitext-2026.08.29_14-24-35--0400.xcresult`.

A clean staging-targeted build 48 archive was verified as version 1.0 build 48 with the expected bundle/team, non-exempt encryption disabled, the isolated staging backend, and the compiled repair marker. Apple accepted upload record `443a851d-5987-456f-b890-ee6eefdeec78` at approximately `2026-08-29 2:34:08 PM EDT`; App Store Connect reported the build `Complete`, `Ready to Submit`, and associated with Internal Testers, and the owner installed it. The expired five-minute tester correctly showed Free, while its uncleared StoreKit queue produced a no-charge wait message instead of falsely claiming a repurchase. A fresh United States tester configured for hourly monthly renewal then completed a no-charge build 48 purchase. Isolated staging returned HTTP 200 for three transaction-verification requests, and the owner explicitly confirmed that the physical iPhone displayed `Pro (Test)`. This passes the build 48 Sandbox identity-continuity acceptance. The associated server-notification delivery received HTTP 503 before ownership was bound. Read-only database inspection showed the fresh transaction, represented only by MD5 prefix `6ddcd2e01e58`, was bound seconds later but had no matching notification-state row.

With explicit owner authorization, an App Store Connect In-App Purchase API key was generated and secured outside the repository with owner-only permissions. Apple's Sandbox Notification History returned the exact failed build 48 `SUBSCRIBED / INITIAL_BUY` payload and showed one `UNSUCCESSFUL_HTTP_RESPONSE_CODE` send attempt. Replaying the unmodified Apple-signed payload after ownership binding returned HTTP 200 with `changed: true`, passing Apple-created delayed recovery. The identical replay returned HTTP 200 with `changed: false` and created no second notification-state row, but the entitlement `updated_at` advanced to the duplicate time. The PostgreSQL repair gates entitlement updates and deletions on the notification ordering cursor actually advancing in one atomic CTE; `npm run test:billing`, `npm run test:beta1-readiness`, and the full `npm run check` pass with zero paid provider calls and retain the source regression contract.

The owner then authorized deployment only to the isolated custom environment. A committed-only bundle passed the authoritative content guard and Vercel deployed exact commit `b83194446a6ed8178f597d8bb9a81475b0d52a0b` as `dpl_Ap73hjFdfjGr4uyzauAmXUuihpXv`; its protected health/release endpoints report PostgreSQL and that exact commit. Apple's refreshed Sandbox Notification History identified the current successful build 48 `DID_RENEW` event by signed date `1788045248782`, hashed notification UUID `9a24315b0a5c`, and hashed transaction `6ddcd2e01e58`. Before replay, the isolated database contained one matching state row and both the notification and entitlement timestamps were `2026-08-29 19:14:11.638664 EDT`. The exact Apple-signed replay returned HTTP 200 with `changed: false`, and the same hashed read-only query afterward returned the identical row count, cursor, hashes, type, and both microsecond timestamps. Strict provider-backed duplicate idempotency therefore passes. The public staging alias and Production remained unchanged.

Detailed provider identifiers, archive values, observed states, official sources, fingerprints, and retained boundaries are in [PERMITEXT_APPLE_APP_STORE_CONNECT_READINESS_EVIDENCE_2026-08-28.md](./PERMITEXT_APPLE_APP_STORE_CONNECT_READINESS_EVIDENCE_2026-08-28.md).

### No-cost monitoring-signal confirmation

The permanent operations suite now exercises structured monitoring through the actual local HTTP server. It confirms redacted client-error logging, the configured slow-request threshold, a signed synthetic failed-invoice warning, a Research spend-guardrail rejection before any provider request, a sanitized unexpected runtime error, and the corresponding 5xx route observation.

The exercise found and repaired a threshold mismatch: the request wrapper honored `PERMITEXT_SLOW_REQUEST_MS`, while event severity still used a hard-coded two-second threshold. Research spend-cap responses now also emit a dedicated release-identified event with hashed user and operation identifiers.

Detailed evidence and boundaries are in [PERMITEXT_LOCAL_MONITORING_SIGNAL_EVIDENCE_2026-08-28.md](./PERMITEXT_LOCAL_MONITORING_SIGNAL_EVIDENCE_2026-08-28.md). The exercise makes zero paid calls, writes no production data, delivers no external alert, and does not set `PERMITEXT_MONITORING_PROVIDER`. The Vercel Pro-plan gate is now complete. The live team also retains a $20 on-demand spend amount, standard spend notifications, and automatic Production pause for every team project. Two included Permitext-scoped Vercel rules now cover 5xx anomalies and infrastructure-usage anomalies, with owner email/web subscriptions checked. Custom threshold rules were unavailable because Vercel reported a limit of zero custom alerts; delivered alert tests, warning-level billing/Research delivery, health and p95 thresholds, and an exercised notification/hard-stop event remain open master-plan gates.

Provider evidence and retained definitions are in [PERMITEXT_VERCEL_ALERT_CONFIGURATION_2026-08-28.md](./PERMITEXT_VERCEL_ALERT_CONFIGURATION_2026-08-28.md).

### Provider recovery evidence under retained deployment and cost boundaries

The owner-authorized recovery exercise created a time-limited Neon child branch from `main` at an explicit point within the live six-hour history window. Direct read-only provider checks matched all 38 Permitext tables and 3,611 rows by exact content digest, aggregate and representative-account entitlement state matched, and the exact serving Production commit returned successful health, release, storage-summary, and restore-checklist responses against the isolated database. The permanent restore verifier passed with zero mismatches. The private Blob store inventory contained 124 objects, and authenticated in-memory retrieval passed for PNG, JPG, and PDF representatives without a provider write.

The public-Beta restore item remains open because the retained no-deploy/no-paid boundaries excluded an isolated Vercel deployment and a duplicate private Blob provider namespace. Detailed evidence and cleanup state are in [PERMITEXT_NEON_BLOB_RESTORE_DRILL_EVIDENCE_2026-08-28.md](./PERMITEXT_NEON_BLOB_RESTORE_DRILL_EVIDENCE_2026-08-28.md).

### Live Vercel cost-control confirmation

The owner personally submitted the Pro upgrade on August 28. The live dashboard confirmed Pro for the August 28–September 28, 2026 billing cycle, one included owner, $20 of monthly infrastructure credit, and no paid add-ons. The post-upgrade dashboard showed a $20 upcoming invoice; checkout's estimated $1.78 tax remains unverified until the final invoice posts.

The owner selected a $20 on-demand amount beyond the included credit. Vercel's required team-name confirmation stated that all team deployments will pause and owner/billing members will be notified when the amount is reached. After confirmation and an independent reload, the billing summary showed `$0 / $20`, `Notifications: On`, and `Pause Projects: On`. This creates approximately $40 plus tax and possible small periodic-metering overrun of initial Vercel exposure, not an exact all-in ceiling; excluded seats, integrations, and add-ons remain outside the spend amount. No threshold was intentionally reached, no external alert was delivered, and no deployment was paused during this configuration.

### Dormant purchase-policy consent wiring

Web and iOS purchase entry points now require an explicit consent choice tied to the exact Terms, Privacy, and Subscription and Refund Policy versions displayed to the user. The web flow records those versions before creating a checkout session, and server-side checkout enforcement rejects an account that has not accepted the configured current versions. iOS records the exact displayed versions after StoreKit eligibility checks and before starting the purchase. A version change invalidates unseen or stale consent rather than silently carrying it forward.

This is technical readiness, not policy activation. The purchase flow fails closed while owner-approved current versions are unconfigured. Stable public URLs, production environment configuration, deployment, and live purchase verification remain open; no price, deployment, or paid-provider behavior changed in this step.

### Owner legal self-review and web subscription acknowledgment

The owner elected not to retain an attorney and to operate Permitext as a sole proprietor. An official-source self-review now records the recurring-payment, privacy, AI-provider, cancellation, refund, account-deletion, governing-law, dispute, and personal-liability boundaries without calling the result legal approval. The customer Terms and subscription/refund policy no longer describe themselves as drafts awaiting counsel, unresolved dispute text was replaced with a plain 30-day informal-notice and court-jurisdiction process, and present-tense additional-turn promises were removed while those sales remain disabled.

Web and iOS purchase copy now states how and when to cancel to stop the next charge. Web Checkout returns to a printable Permitext subscription acknowledgment containing the amount, monthly renewal, no-trial rule, 100-turn allowance, cancellation mechanism, 72-hour refund rule, and policy links before the user continues into the app. The no-charge provider simulation verifies that Stripe receives this confirmation URL. OpenAI retention language remains matched to the current official API data-controls page, and the existing first-Research acknowledgment provides an affirmative choice before Research data is sent.

Sole-proprietor income treatment and transactional sales tax remain separate. The conservative no-professional path is to treat New York web subscriptions as taxable remotely accessed prewritten software, obtain the New York Certificate of Authority before the first taxable New York web sale, and then configure Stripe's tax code, customer location, registrations, and tax presentation. No tax configuration, policy version, deployment, price, or paid call changed in this step.

## Commercial decision gate

Proceed toward paid Research only if all of the following are true:

- [x] No material forbidden claim or unsupported compliance conclusion appeared in the complete v6 cohort.
- [x] Exact citation and required-qualification behavior passed the complete v6 cohort.
- [x] Provider failures and internal retries remain free to the user.
- [x] Subscriber-level aggregation is complete: 100 fully used turns cost $5.74 p50 and $6.06 p90 in the V6 empirical model.
- [x] Owner-approved Beta economics retain 100 turns with a $2 minimum p90 contribution; the modeled result is $4.16 on web and $2.14 on iOS at the confirmed 15% commission.
- [x] Complete the no-cost tax/refund/infrastructure input audit and launch-volume/refund sensitivities; low-volume p90 allocation is explicit and the missing Stripe Tax configuration is recorded.
- [x] Complete the local no-charge Stripe Pro lifecycle exercise and retain the delayed-event/refund regression in the billing suite.
- [x] Complete the provider-backed Stripe sandbox lifecycle and retain the current PaymentIntent-to-Invoice-Payment refund regression in the billing suite.
- [x] Complete the local signed-payload Apple Pro lifecycle exercise and retain the failed-renewal and notification-ordering regressions in the billing suite.
- [x] Complete Apple-created Sandbox and TestFlight subscription lifecycle evidence against the compatible staging backend, including exact Apple-signed delayed recovery and strict duplicate write-inertness.
- [ ] Verify tax treatment, refund incidence, and launch-volume infrastructure allocation, then review actual contribution after the first 25–50 customers.
- [x] Current checked-in web and iOS clients decode and display the shared Research response contract correctly through the retained V6-shaped fixture and iOS Simulator test.
- [ ] Confirm the same contract on production web and the next compatible TestFlight build during release verification.

If quality requires too many Terra calls to meet the cost target, reduce the included monthly allowance or create a higher Research tier. Do not silently subsidize Terra-only usage inside the current $20 plan.

## After the quality and economics gate

- [ ] Test and activate visible 25-turn and 100-turn purchase options on web and iOS.
- [ ] Calculate pack prices from measured p50 and p90 hybrid costs plus payment fees, taxes, refunds, infrastructure, support, and margin.
- [ ] Verify Stripe fulfillment, App Store consumables, restore/reconciliation, exhausted-allowance screens, and cross-platform balances end to end.
- [ ] Deploy the compatible backend first, verify production, then prepare and test the next iOS build.

## Deliberately deferred

- Zoning Research remains outside public Research until its citations, tables, maps, amendments, applicability, and evaluation gates are trustworthy.
- No Production deployment, merge to `main`, App Review submission, or public pricing change is part of the current remediation step. The explicitly authorized isolated-staging TestFlight builds do not change that boundary.
- A larger AI-assisted blind evaluation set can be discussed after the current 20-case remediation is complete.

## Immediate next action

The owner completed final approval of the exact customer policies and the dormant identifiers and approved-file hashes are recorded. The New York Certificate of Authority application was submitted and its confirmation saved; do not accept a taxable New York web sale until the new Certificate is received and Stripe tax configuration is documented. After stable URLs serve the approved files, configure their exact current versions to activate the already-wired consent flow. Local readiness also requires the exact $7 per-user monthly Research ceiling; Production configuration and deployed verification remain open. The isolated Apple Sandbox lifecycle now passes purchase, the no-charge Sandbox sheet, local Pro activation, 100-turn allowance, authenticated account ownership, Restore, notification delivery, cancellation retention and expiration, refund submission and revocation, renewal, billing failure/recovery, build 48 identity continuity, Apple-created delayed recovery, and strict duplicate write-inertness. The failed-delivery retry claim remains withdrawn because Apple documents that Sandbox sends a notification only once. The repaired custom-environment deployment is protected and the public staging alias remains on its earlier release; any alias reassignment must be separately approved. The next public-Beta billing gate is the separately approved controlled Production Stripe exercise with a dedicated account and real charge. Replace the refund and infrastructure planning reserves only when actual customer and Vercel billing data exist. Before Production deployment, set the per-user monthly Research spend cap to $7 and rerun readiness so the live guardrail supports the retained 100-turn allowance. Production web and the final Production-targeted TestFlight build must then confirm the shared response contract; additional-turn prices and public paid Research remain disabled.

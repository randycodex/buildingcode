import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { researchSubscriberEconomicsReport } from "../research-economics.mjs";

const benchmarkURL = new URL(
  "../evals/results/2026-08-28T02-26-08-632Z-edc69c6b-bf30-4856-859e-99667d03bd2b.json",
  import.meta.url
);

export const v6SubscriberEconomicsAssumptions = Object.freeze({
  generatedAt: "2026-08-28T03:00:00.000Z",
  subscriptionPriceUSD: 20,
  currentIncludedTurns: 100,
  allowanceCandidates: [50, 75, 100],
  bootstrapIterations: 100_000,
  bootstrapSeed: 0x5045524d,
  targetModelCostPerSubscriberMaximumUSD: 6.10,
  minimumContributionUSD: 2,
  infrastructureMonthlyUSD: { p50: 20, p90: 45 },
  fullyUtilizedSubscribers: 25,
  subscriberVolumeCandidates: [10, 25, 50, 100],
  supportMinutesPerSubscriber: { p50: 10, p90: 10 },
  supportHourlyCostUSD: 30,
  refundReserveRate: 0.05,
  refundReserveCandidates: [0, 0.01, 0.03, 0.05, 0.10],
  taxReserveRate: 0.05,
  channels: [
    {
      id: "web-stripe",
      percentageFeeRate: 0.029,
      fixedFeeUSD: 0.30,
      taxAdministrationRate: 0.005,
      requiredForDecision: true
    },
    {
      id: "ios-small-business",
      percentageFeeRate: 0.15,
      fixedFeeUSD: 0,
      requiredForDecision: true
    },
    {
      id: "ios-standard",
      percentageFeeRate: 0.30,
      fixedFeeUSD: 0,
      requiredForDecision: false
    }
  ],
  unverifiedInputs: [
    "fully utilized paid subscriber count",
    "refund incidence",
    "tax treatment and Stripe Tax configuration"
  ]
});

function usd(value) {
  const number = Number(value);
  return number < 0 ? `-$${Math.abs(number).toFixed(2)}` : `$${number.toFixed(2)}`;
}

function percent(value) {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function channelFor(scenario, channelID) {
  return scenario.channels.find((channel) => channel.id === channelID);
}

export function renderV6SubscriberEconomicsMarkdown(report) {
  const rows = report.allowanceScenarios.map((scenario) => {
    const web = channelFor(scenario, "web-stripe");
    const iosSmall = channelFor(scenario, "ios-small-business");
    const iosStandard = channelFor(scenario, "ios-standard");
    return `| ${scenario.includedTurns} | ${usd(scenario.providerCostUSD.p50)} | ${usd(scenario.providerCostUSD.p90)} | ${usd(web.p50.fullServiceCostUSD)} | ${usd(web.p90.fullServiceCostUSD)} | ${usd(iosSmall.p50.fullServiceCostUSD)} | ${usd(iosSmall.p90.fullServiceCostUSD)} | ${usd(iosStandard.p90.fullServiceCostUSD)} |`;
  });
  const current = report.allowanceScenarios.find((scenario) =>
    scenario.includedTurns === report.recommendation.currentIncludedTurns
  );
  const currentWeb = channelFor(current, "web-stripe");
  const currentIOSSmall = channelFor(current, "ios-small-business");
  const currentIOSStandard = channelFor(current, "ios-standard");
  const volumeRows = report.launchVolumeScenarios.map((scenario) => {
    const web = channelFor(scenario, "web-stripe");
    const iosSmall = channelFor(scenario, "ios-small-business");
    return `| ${scenario.fullyUtilizedSubscribers} | ${usd(scenario.infrastructureCostPerSubscriberUSD.p90)} | ${usd(web.p90.contributionUSD)} | ${web.p90.contributionTargetPass ? "Pass" : "Fail"} | ${usd(iosSmall.p90.contributionUSD)} | ${iosSmall.p90.contributionTargetPass ? "Pass" : "Fail"} |`;
  });
  const refundRows = report.refundReserveScenarios.map((scenario) => {
    const web = channelFor(scenario, "web-stripe");
    const iosSmall = channelFor(scenario, "ios-small-business");
    return `| ${percent(scenario.refundReserveRate)} | ${usd(web.p90.contributionUSD)} | ${usd(iosSmall.p90.contributionUSD)} |`;
  });
  const thresholdFor = (channelID) => report.recommendation
    .minimumFullyUtilizedSubscribersForP90ContributionTarget
    .find((channel) => channel.id === channelID)?.fullyUtilizedSubscribers;
  return `# Permitext Research subscriber economics — V6\n\n` +
    `Generated locally without model or provider calls from the immutable V6 result.\n\n` +
    `## Result\n\n` +
    `A fully utilized 100-turn subscriber has modeled Research cost of ${usd(current.providerCostUSD.p50)} p50 and ${usd(current.providerCostUSD.p90)} p90. The p90 aggregate is slightly above the $6 model-cost objective. With the explicit planning reserves below, total p90 monthly cost is ${usd(currentWeb.p90.fullServiceCostUSD)} on web, ${usd(currentIOSSmall.p90.fullServiceCostUSD)} on iOS at a 15% commission, and ${usd(currentIOSStandard.p90.fullServiceCostUSD)} on iOS at the standard 30% commission.\n\n` +
    `The owner-confirmed Beta minimum is $2 contribution from each $20 subscription, with a later $4–$6 target after actual customer data. The model's provisional maximum is therefore ${report.recommendation.provisionalIncludedTurns} included turns. This is not a release-ready commercial result because ${report.assumptions.unverifiedInputs.length} inputs remain unverified. No product price, allowance, or purchase configuration is changed by this report.\n\n` +
    `## Fully utilized subscriber cost\n\n` +
    `| Included turns | Model p50 | Model p90 | Web full p50 | Web full p90 | iOS 15% full p50 | iOS 15% full p90 | iOS 30% full p90 |\n` +
    `| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n` +
    `${rows.join("\n")}\n\n` +
    `At 100 turns, modeled contribution after all stated reserves is ${usd(currentWeb.p90.contributionUSD)} (${percent(currentWeb.p90.contributionMarginRate)}) on web, ${usd(currentIOSSmall.p90.contributionUSD)} (${percent(currentIOSSmall.p90.contributionMarginRate)}) at the 15% App Store rate, and ${usd(currentIOSStandard.p90.contributionUSD)} (${percent(currentIOSStandard.p90.contributionMarginRate)}) at the 30% App Store rate.\n\n` +
    `## Launch-volume sensitivity\n\n` +
    `This table holds the 100-turn p90 model cost, support, tax, refund, and channel assumptions constant and allocates the full $45 p90 monthly infrastructure budget across the stated number of fully utilized subscribers.\n\n` +
    `| Fully utilized subscribers | Infrastructure each | Web p90 contribution | $2 target | iOS 15% p90 contribution | $2 target |\n` +
    `| ---: | ---: | ---: | :---: | ---: | :---: |\n` +
    `${volumeRows.join("\n")}\n\n` +
    `Under that deliberately conservative full-budget allocation, the $2 contribution floor first passes at ${thresholdFor("web-stripe")} fully utilized web subscribers and ${thresholdFor("ios-small-business")} fully utilized iOS subscribers. The fixed platform budget makes the earliest months less efficient; this is launch-volume sensitivity, not a claim that each subscriber causes that infrastructure spend.\n\n` +
    `## Refund-reserve sensitivity\n\n` +
    `This table holds the 25-subscriber infrastructure denominator and all other p90 assumptions constant. It does not predict refund incidence.\n\n` +
    `| Assumed refunded gross revenue | Web p90 contribution | iOS 15% p90 contribution |\n` +
    `| ---: | ---: | ---: |\n` +
    `${refundRows.join("\n")}\n\n` +
    `The working 5% reserve means the model withholds $1.00 from every $20 charge for expected refunds. Permitext has no launch incidence yet, and Stripe does not return the original card-processing fee on ordinary card refunds, so the reserve remains unverified until the lifecycle exercise and customer data exist.\n\n` +
    `## Commercial-input audit\n\n` +
    `- Tax: Permitext's current Stripe Checkout request does not enable automatic tax, state price tax behavior, or collect/update a billing address for tax. Stripe requires a business to register before collecting in a jurisdiction and to enable \`automatic_tax\` for API-created Checkout Sessions. New York guidance generally treats remotely accessed prewritten software as taxable, but Permitext's product classification, registrations, customer locations, and inclusive/exclusive presentation require professional review. The 5% line therefore remains an unresolved downside reserve, not a factual tax rate. [Stripe Tax setup](https://docs.stripe.com/tax/set-up?dashboard-or-api=api) · [New York computer-software guidance](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/computer_software.htm)\n` +
    `- Refunds: the public working policy permits a full refund of every Stripe initial or renewal charge requested within 72 hours regardless of usage. No customer incidence exists yet. Stripe's standard pricing retains the original payment-processing fees after an ordinary card refund. [Stripe pricing](https://stripe.com/pricing)\n` +
    `- Infrastructure: Vercel currently lists Pro at $20 per month with $20 of usage credit. The $45 p90 case is a budget ceiling consisting of that platform fee plus the runbook's $25 on-demand allowance, not measured marginal subscriber usage. [Vercel Pro plan](https://vercel.com/docs/plans/pro-plan)\n` +
    `- App Store: the confirmed decision case uses the 15% Small Business Program commission. Apple states that proceeds can also be reduced by applicable transaction taxes, so the iOS tax reserve remains until actual financial reports exist. [Apple Small Business Program](https://developer.apple.com/app-store/small-business-program/) · [Apple tax categories](https://developer.apple.com/help/app-store-connect/manage-app-information/set-a-tax-category)\n\n` +
    `## Planning assumptions\n\n` +
    `- $20 monthly Pro price; 50, 75, and 100 fully used turns compared.\n` +
    `- 100,000 deterministic empirical-bootstrap subscriber months, sampling with replacement from all 20 V6 production turn costs. This aggregates a subscriber month; it does not multiply the single-turn p90 by the allowance.\n` +
    `- Monthly infrastructure: $20 p50 and $45 p90, allocated across 25 fully utilized paid subscribers ($0.80 p50 / $1.80 p90 each). The $45 case conservatively consumes the documented $25 on-demand budget in addition to the $20 Vercel Pro platform fee.\n` +
    `- Support: owner-approved 10 minutes per subscriber at a $30/hour owner-time planning rate ($5.00 per subscriber).\n` +
    `- Refund reserve: 5% of the $20 price. Tax downside reserve: 5%. Web also includes Stripe Tax Basic's 0.5% fee assumption. These are reserves, not measured incidence or tax advice.\n` +
    `- Web payments: 2.9% + $0.30. The owner confirmed Permitext's 15% App Store rate; 30% remains a sensitivity case only.\n` +
    `- Minimum required Beta contribution: owner-approved $2 per $20 subscription; the later target is $4–$6 after actual customer data.\n\n` +
    `## Inputs that block final commercial validation\n\n` +
    report.assumptions.unverifiedInputs.map((input) => `- ${input}`).join("\n") +
    `\n\n## Reproduce\n\n` +
    `Run \`npm run eval:research:subscriber-economics-v6\` for Markdown or append \`-- --json\` for the complete machine-readable report. The command reads the retained V6 file only and makes no network or model call.\n`;
}

export async function createV6SubscriberEconomicsReport() {
  const benchmark = JSON.parse(await fs.readFile(benchmarkURL, "utf8"));
  return researchSubscriberEconomicsReport(benchmark, v6SubscriberEconomicsAssumptions);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await createV6SubscriberEconomicsReport();
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(renderV6SubscriberEconomicsMarkdown(report));
  }
}

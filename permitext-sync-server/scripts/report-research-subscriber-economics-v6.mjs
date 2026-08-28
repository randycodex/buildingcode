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
  targetModelCostPerSubscriberMaximumUSD: 6,
  infrastructureMonthlyUSD: { p50: 20, p90: 45 },
  fullyUtilizedSubscribers: 25,
  supportMinutesPerSubscriber: { p50: 6, p90: 15 },
  supportHourlyCostUSD: 30,
  refundReserveRate: 0.05,
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
    "support minutes and hourly opportunity cost",
    "refund incidence",
    "tax treatment and Stripe Tax configuration",
    "App Store Small Business Program enrollment"
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
  return `# Permitext Research subscriber economics — V6\n\n` +
    `Generated locally without model or provider calls from the immutable V6 result.\n\n` +
    `## Result\n\n` +
    `A fully utilized 100-turn subscriber has modeled Research cost of ${usd(current.providerCostUSD.p50)} p50 and ${usd(current.providerCostUSD.p90)} p90. The p90 aggregate is slightly above the $6 model-cost objective. With the explicit planning reserves below, total p90 monthly cost is ${usd(currentWeb.p90.fullServiceCostUSD)} on web, ${usd(currentIOSSmall.p90.fullServiceCostUSD)} on iOS at a 15% commission, and ${usd(currentIOSStandard.p90.fullServiceCostUSD)} on iOS at the standard 30% commission.\n\n` +
    `The model's provisional maximum is ${report.recommendation.provisionalIncludedTurns} included turns. This is not a release-ready allowance decision because ${report.assumptions.unverifiedInputs.length} commercial inputs remain unverified. No product price, allowance, or purchase configuration is changed by this report.\n\n` +
    `## Fully utilized subscriber cost\n\n` +
    `| Included turns | Model p50 | Model p90 | Web full p50 | Web full p90 | iOS 15% full p50 | iOS 15% full p90 | iOS 30% full p90 |\n` +
    `| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n` +
    `${rows.join("\n")}\n\n` +
    `At 100 turns, modeled contribution after all stated reserves is ${usd(currentWeb.p90.contributionUSD)} (${percent(currentWeb.p90.contributionMarginRate)}) on web, ${usd(currentIOSSmall.p90.contributionUSD)} (${percent(currentIOSSmall.p90.contributionMarginRate)}) at the 15% App Store rate, and ${usd(currentIOSStandard.p90.contributionUSD)} (${percent(currentIOSStandard.p90.contributionMarginRate)}) at the 30% App Store rate.\n\n` +
    `## Planning assumptions\n\n` +
    `- $20 monthly Pro price; 50, 75, and 100 fully used turns compared.\n` +
    `- 100,000 deterministic empirical-bootstrap subscriber months, sampling with replacement from all 20 V6 production turn costs. This aggregates a subscriber month; it does not multiply the single-turn p90 by the allowance.\n` +
    `- Monthly infrastructure: $20 p50 and $45 p90, allocated across 25 fully utilized paid subscribers ($0.80 p50 / $1.80 p90 each). The $45 case conservatively consumes the documented $25 on-demand budget in addition to the $20 Vercel Pro platform fee.\n` +
    `- Support: 6 minutes p50 and 15 minutes p90 at a $30/hour owner-time planning rate ($3.00 / $7.50 per subscriber).\n` +
    `- Refund reserve: 5% of the $20 price. Tax reserve: 5%. Web also includes Stripe Tax Basic's 0.5% fee assumption. These are reserves, not measured incidence or tax advice.\n` +
    `- Web payments: 2.9% + $0.30. iOS sensitivity: 15% Small Business Program and 30% standard commission.\n\n` +
    `## Inputs that block a final decision\n\n` +
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

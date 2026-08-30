import assert from "node:assert/strict";
import {
  createV6SubscriberEconomicsReport,
  renderV6SubscriberEconomicsMarkdown
} from "../scripts/report-research-subscriber-economics-v6.mjs";

const report = await createV6SubscriberEconomicsReport();
assert.equal(report.decisionStatus, "planning-model-commercial-inputs-unverified");
assert.equal(report.benchmark.sourceGitCommit, "c1db6e4ddf9768a3de424c826529586da3f6dfaa");
assert.equal(report.benchmark.measuredTurnCount, 20);
assert.equal(report.benchmark.runIntegrity.pass, true);
assert.equal(report.recommendation.benchmarkReady, true);
assert.equal(report.recommendation.commercialDecisionReady, false);
assert.equal(report.recommendation.currentIncludedTurns, 100);
assert.equal(report.recommendation.provisionalIncludedTurns, 100);
assert.equal(report.recommendation.currentAllowancePlanningP90Pass, true);

const fifty = report.allowanceScenarios.find((scenario) => scenario.includedTurns === 50);
const seventyFive = report.allowanceScenarios.find((scenario) => scenario.includedTurns === 75);
const oneHundred = report.allowanceScenarios.find((scenario) => scenario.includedTurns === 100);
assert.equal(fifty.providerCostUSD.p50, 2.867397);
assert.equal(fifty.providerCostUSD.p90, 3.093675);
assert.equal(seventyFive.providerCostUSD.p50, 4.301689);
assert.equal(seventyFive.providerCostUSD.p90, 4.579042);
assert.equal(oneHundred.providerCostUSD.p50, 5.737158);
assert.equal(oneHundred.providerCostUSD.p90, 6.056942);

const web = oneHundred.channels.find((channel) => channel.id === "web-stripe");
const iosSmall = oneHundred.channels.find((channel) => channel.id === "ios-small-business");
const iosStandard = oneHundred.channels.find((channel) => channel.id === "ios-standard");
assert.equal(web.p90.fullServiceCostUSD, 15.836942);
assert.equal(web.p90.contributionUSD, 4.163058);
assert.equal(iosSmall.p90.fullServiceCostUSD, 17.856942);
assert.equal(iosSmall.p90.contributionUSD, 2.143058);
assert.equal(iosStandard.p90.fullServiceCostUSD, 20.856942);
assert.equal(iosStandard.p90.contributionUSD, -0.856942);

const tenSubscribers = report.launchVolumeScenarios.find((scenario) =>
  scenario.fullyUtilizedSubscribers === 10
);
const twentyFiveSubscribers = report.launchVolumeScenarios.find((scenario) =>
  scenario.fullyUtilizedSubscribers === 25
);
assert.equal(tenSubscribers.infrastructureCostPerSubscriberUSD.p90, 4.5);
assert.equal(tenSubscribers.channels.find((channel) => channel.id === "web-stripe").p90.contributionUSD, 1.463058);
assert.equal(tenSubscribers.channels.find((channel) => channel.id === "ios-small-business").p90.contributionUSD, -0.556942);
assert.equal(twentyFiveSubscribers.channels.find((channel) => channel.id === "ios-small-business").p90.contributionUSD, 2.143058);
assert.deepEqual(report.recommendation.minimumFullyUtilizedSubscribersForP90ContributionTarget, [
  { id: "web-stripe", fullyUtilizedSubscribers: 12 },
  { id: "ios-small-business", fullyUtilizedSubscribers: 24 },
  { id: "ios-standard", fullyUtilizedSubscribers: null }
]);

const tenPercentRefunds = report.refundReserveScenarios.find((scenario) =>
  scenario.refundReserveRate === 0.10
);
assert.equal(tenPercentRefunds.channels.find((channel) => channel.id === "web-stripe").p90.contributionUSD, 3.163058);
assert.equal(tenPercentRefunds.channels.find((channel) => channel.id === "ios-small-business").p90.contributionUSD, 1.143058);

const markdown = renderV6SubscriberEconomicsMarkdown(report);
assert.match(markdown, /100-turn subscriber has modeled Research cost of \$5\.74 p50 and \$6\.06 p90/);
assert.match(markdown, /provisional maximum is therefore 100 included turns/);
assert.match(markdown, /\$2\.14 \(10\.7%\)/);
assert.match(markdown, /first passes at 12 fully utilized web subscribers and 24 fully utilized iOS subscribers/);
assert.match(markdown, /dormant automatic-tax Checkout path/);
assert.match(markdown, /already includes Stripe Tax Basic's 0\.5% web fee separately/);
assert.match(markdown, /Stripe automatic tax therefore stays web-only/);
assert.match(markdown, /customer price as inclusive of applicable taxes/);
assert.match(markdown, /approximately \$40 plus tax/);
assert.match(markdown, /makes no network or model call/);

console.log("permitext Research V6 subscriber economics contract passed");

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
assert.equal(report.recommendation.provisionalIncludedTurns, 75);
assert.equal(report.recommendation.currentAllowancePlanningP90Pass, false);

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
assert.equal(web.p90.fullServiceCostUSD, 18.336942);
assert.equal(web.p90.contributionUSD, 1.663058);
assert.equal(iosSmall.p90.fullServiceCostUSD, 20.356942);
assert.equal(iosSmall.p90.contributionUSD, -0.356942);
assert.equal(iosStandard.p90.fullServiceCostUSD, 23.356942);
assert.equal(iosStandard.p90.contributionUSD, -3.356942);

const markdown = renderV6SubscriberEconomicsMarkdown(report);
assert.match(markdown, /100-turn subscriber has modeled Research cost of \$5\.74 p50 and \$6\.06 p90/);
assert.match(markdown, /provisional maximum is 75 included turns/);
assert.match(markdown, /-\$0\.36 \(-1\.8%\)/);
assert.match(markdown, /makes no network or model call/);

console.log("permitext Research V6 subscriber economics contract passed");

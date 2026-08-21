import {
  beta1ConfigurationReadiness,
  verifyLiveStripeReadiness
} from "../beta1-readiness.mjs";

const configuration = beta1ConfigurationReadiness();
console.log(JSON.stringify({ configuration }, null, 2));

let ready = configuration.ready;
if (process.argv.includes("--live-stripe")) {
  const stripe = await verifyLiveStripeReadiness();
  console.log(JSON.stringify({ liveStripe: stripe }, null, 2));
  ready = ready && stripe.ready;
}

if (!ready) process.exitCode = 1;

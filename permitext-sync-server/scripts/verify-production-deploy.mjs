import {
  beta1ConfigurationReadiness,
  verifyLiveStripeReadiness
} from "../beta1-readiness.mjs";

if (process.env.VERCEL_ENV !== "production") {
  console.log("Permitext commercial readiness skipped outside Vercel Production.");
} else {
  const configuration = beta1ConfigurationReadiness();
  const liveStripe = configuration.ready
    ? await verifyLiveStripeReadiness()
    : { ready: false, skipped: true };

  console.log(JSON.stringify({ configuration, liveStripe }, null, 2));
  if (!configuration.ready || !liveStripe.ready) {
    throw new Error("Permitext Production deployment failed its commercial readiness gate.");
  }
}

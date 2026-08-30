import {
  beta1ConfigurationReadiness,
  verifyLiveStripeReadiness
} from "../beta1-readiness.mjs";
import {
  operationalMonitoringReadiness,
  productionDeploymentReadiness,
  productionReleaseReadiness
} from "../operational-readiness.mjs";

if (process.env.VERCEL_ENV !== "production") {
  console.log("Permitext commercial readiness skipped outside Vercel Production.");
} else {
  const configuration = beta1ConfigurationReadiness();
  const release = productionReleaseReadiness();
  const monitoring = operationalMonitoringReadiness();
  const liveStripe = configuration.ready
    ? await verifyLiveStripeReadiness()
    : { ready: false, skipped: true };
  const deployment = productionDeploymentReadiness({
    configuration,
    liveStripe,
    release,
    monitoring
  });

  console.log(JSON.stringify({ configuration, liveStripe, release, monitoring, deployment }, null, 2));
  if (!deployment.ready) {
    throw new Error(
      `Permitext Production deployment failed its readiness gate: ${deployment.errors.join(" ")}`
    );
  }
}

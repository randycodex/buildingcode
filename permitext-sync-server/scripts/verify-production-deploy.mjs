import {
  beta1ConfigurationReadiness,
  verifyLiveStripeReadiness
} from "../beta1-readiness.mjs";
import {
  operationalMonitoringReadiness,
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

  console.log(JSON.stringify({ configuration, liveStripe, release, monitoring }, null, 2));
  if (!monitoring.externalAlertsConfigured) {
    console.warn(
      "Permitext Production monitoring is not marked configured. Set PERMITEXT_MONITORING_PROVIDER after dashboard alerts or a log drain are active."
    );
  }
  if (!configuration.ready || !liveStripe.ready || !release.ready) {
    throw new Error("Permitext Production deployment failed its commercial readiness gate.");
  }
}

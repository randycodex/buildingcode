import { researchModelConfiguration } from "../research-config.mjs";
import { researchModelRoutingConfiguration } from "../research-model-routing.mjs";
import { researchV2Configuration } from "../research-v2-runtime.mjs";
import {
  beta1ConfigurationReadiness,
  verifyLiveStripeReadiness
} from "../beta1-readiness.mjs";
import {
  operationalMonitoringReadiness,
  productionDeploymentReadiness,
  productionReleaseReadiness
} from "../operational-readiness.mjs";

if (process.env.VERCEL_ENV) {
  const v2=researchV2Configuration(process.env);
  console.log("Research v2 deployment configuration:",JSON.stringify({enabled:v2.enabled,ready:v2.ready,rollout:v2.rollout,defaultEngine:v2.defaultEngine,spending:v2.spending,problems:v2.problems}));
  if(!v2.ready)throw new Error(`Research v2 configuration is invalid: ${v2.problems.join(' ')}`);
}
if (process.env.VERCEL_ENV !== "production") {
  console.log("Permitext commercial readiness skipped outside Vercel Production.");
} else {
  console.log("Research deployment configuration:", JSON.stringify({
    ...researchModelConfiguration(), routing: researchModelRoutingConfiguration()
  }));
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

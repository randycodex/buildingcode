import { appleSandboxConfigurationReadiness } from "../apple-sandbox-readiness.mjs";

const result = appleSandboxConfigurationReadiness(process.env);
console.log(JSON.stringify(result, null, 2));
if (!result.ready) process.exitCode = 1;

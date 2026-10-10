import { homedir } from "node:os";
import { join } from "node:path";

// Keep the identity, account records, private assets, and browser origin stable.
// Explicit command-line options precede these defaults.
process.argv.push("--port", "8788", "--profile", "small", "--research-history", "true",
  "--data-dir", join(homedir(), "Library", "Application Support", "Permitext", "Local Pro Preview"));
await import("../tests/populated-workspace-performance-fixture.mjs");

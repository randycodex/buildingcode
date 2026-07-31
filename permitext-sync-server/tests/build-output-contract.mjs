import assert from "node:assert/strict";
import notebookViteConfig from "../vite.notebook.config.js";

assert.equal(
  notebookViteConfig.build?.emptyOutDir,
  false,
  "The notebook build must not delete unrelated files in its output directory."
);

console.log("permitext build output contract passed");

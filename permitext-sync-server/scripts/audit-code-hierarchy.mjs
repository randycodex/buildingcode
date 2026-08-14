import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCodeHierarchyAudit,
  renderHierarchyAuditMatrix
} from "../code-hierarchy-audit.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = join(root, "docs", "code-hierarchy");

const audit = await buildCodeHierarchyAudit();
await mkdir(outputRoot, { recursive: true });
await writeFile(join(outputRoot, "audit-report.json"), `${JSON.stringify(audit, null, 2)}\n`);
await writeFile(join(outputRoot, "audit-matrix.md"), `${renderHierarchyAuditMatrix(audit)}\n`);
console.log(`Wrote ${join(outputRoot, "audit-report.json")}`);
console.log(`Wrote ${join(outputRoot, "audit-matrix.md")}`);

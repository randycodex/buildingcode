import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@excalidraw", "excalidraw", "dist", "prod", "fonts");
const destination = join(root, "public", "workboard-assets", "fonts");

await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true, force: true });

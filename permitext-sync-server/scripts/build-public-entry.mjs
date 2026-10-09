import { cp, copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildWorkspaceEntry } from './build-workspace-entry.mjs';

export async function buildPublicEntry(source, output) {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(source, output, { recursive: true });
  await copyFile(`${source}/index.html`, `${output}/workspace.html`);
  await copyFile(`${source}/home.html`, `${output}/index.html`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = fileURLToPath(new URL('../public', import.meta.url));
  const output = fileURLToPath(new URL('../deployment-public', import.meta.url));
  await buildPublicEntry(source, output);
  console.log('Workspace startup bundle:', await buildWorkspaceEntry(source, output));
}

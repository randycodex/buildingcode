import { cp, copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function buildPublicEntry(source, output) {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(source, output, { recursive: true });
  await copyFile(`${source}/index.html`, `${output}/workspace.html`);
  await copyFile(`${source}/home.html`, `${output}/index.html`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildPublicEntry(fileURLToPath(new URL('../public', import.meta.url)), fileURLToPath(new URL('../deployment-public', import.meta.url)));
}

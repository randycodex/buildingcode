import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const output = resolve('public/pdf-preview-assets');
await mkdir(output, { recursive: true });
for (const name of ['pdf.min.mjs', 'pdf.worker.min.mjs']) {
  await copyFile(resolve('node_modules/pdfjs-dist/build', name), resolve(output, name.replace(".mjs", ".js")));
}
console.log('Built lazy Report PDF preview assets.');

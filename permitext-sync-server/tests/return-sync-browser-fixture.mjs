// Full local app/server, synthetic accounts only. Shorten the idle threshold
// in this test-only entry so interactive browser acceptance need not wait 5 min.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const directory=await mkdtemp(join(tmpdir(),'permitext-return-sync-'));
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
await writeFile(join(directory,'app.js'),source.replace('bindReturnSyncChecks({window, document, check:',
  'bindReturnSyncChecks({idleMs:1000, cooldownMs:1000, window, document, check:'));
const child=spawn(process.execPath,[fileURLToPath(new URL('./populated-workspace-performance-fixture.mjs',import.meta.url)),
  '--port',process.env.PERMITEXT_RETURN_TEST_PORT || '8897','--profile','small','--keep-alive','true',
  '--record-requests','true','--client-entry',join(directory,'app.js')],{stdio:['ignore','pipe','pipe']});
child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',async code=>{await rm(directory,{recursive:true,force:true});process.exitCode=code||0;});

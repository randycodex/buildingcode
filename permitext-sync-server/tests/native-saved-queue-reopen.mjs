// Host-only durability regression: compile unchanged production SQLite methods.
// Synthetic folder setup is fixture data; schema, save transaction, queue state,
// acknowledgement, retry, and SQLite connection behavior are production code.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const fullSource = await read('../../NYC CC APP/permitext/Data/UserDataStore.swift');
const source = fullSource.slice(fullSource.indexOf('final class UserDataStore:'));
const models = await read('../../NYC CC APP/permitext/Models/CodeModels.swift');
const sqlite = await read('../../NYC CC APP/permitext/Data/SQLiteSupport.swift');
function block(text, start, indent = '') {
  const begin = text.indexOf(start);
  assert.ok(begin >= 0, `Missing production declaration: ${start}`);
  const end = text.indexOf(`\n${indent}}`, begin);
  assert.ok(end > begin);
  return text.slice(begin, end + indent.length + 2);
}
const methods = [...source.matchAll(/^    (?:private )?(?:func (\w+)|init\(databaseURL:)/gm)].map(match => ({
  name: match[1] || 'init', source: (source.slice(Math.max(0, match.index - 23), match.index).endsWith('    @discardableResult\n') ? '    @discardableResult\n' : '') + block(source.slice(match.index), match[0], '    ')
}));
const chosen = new Set(['init', 'saveSection', 'pendingSyncQueueItems', 'failedSyncQueueItems', 'markSyncQueueItemsInFlight', 'markSyncQueueItemSynced', 'markSyncQueueItemFailed', 'prepareSyncQueueForProcessing']);
let changed;
do {
 changed = false;
 const selected = methods.filter(m => chosen.has(m.name)).map(m => m.source.replace(/"""[\s\S]*?"""/g, '')).join('\n');
 for (const m of methods) if (!chosen.has(m.name) && new RegExp(`\\b${m.name}\\s*[({]`).test(selected)) { chosen.add(m.name); changed = true; }
} while(changed);
const declarations = ['UserContentVisibility','UserContentSyncState','SyncEntityType','SyncOperationType','SyncQueueState','SyncQueuePayload','SyncQueueItem','UserContentSyncCodeVersion','CodeFolderType','UserDataDefaults'].map(name => {
 const kind = models.includes(`enum ${name}`) ? 'enum' : 'struct';
 return block(models, `${kind} ${name}`);
}).join('\n');
const fields = source.slice(source.indexOf('    private static let syncCheckpointSchemaVersion'), source.indexOf('    convenience init()'));
const structs = ['BookmarkIdentity','FolderSectionIdentity','LocalSyncIntent','FolderSectionSyncTarget'].map(n => block(source, `    private struct ${n}`, '    ')).join('\n');
const harness = await read('./fixtures/native-saved-queue-reopen.swift');
const dir = await mkdtemp(join(tmpdir(), 'permitext-saved-queue-'));
try {
 await writeFile(join(dir,'verify.swift'), `${sqlite}\n${declarations}\nfinal class UserDataStore {\n${fields}\n${structs}\n${methods.filter(m => chosen.has(m.name)).map(m => m.source).join('\n')}\n}\n${harness}`);
 execFileSync('xcrun', ['swiftc','-parse-as-library',join(dir,'verify.swift'),'-o',join(dir,'verify')], {stdio:'inherit'});
 execFileSync(join(dir,'verify'),[join(dir,'synthetic.sqlite')],{stdio:'inherit'});
 const correct = await readFile(join(dir,'verify.swift'),'utf8');
 const guard = 'if try !hasUnresolvedQueueItem(matching: item, excludingID: id) {';
 assert.equal(correct.split(guard).length,2);
 await writeFile(join(dir,'verify.swift'),correct.replace(guard,'if true {'));
 execFileSync('xcrun',['swiftc','-parse-as-library',join(dir,'verify.swift'),'-o',join(dir,'mutant')],{stdio:'pipe'});
 assert.throws(() => execFileSync(join(dir,'mutant'),[join(dir,'mutant.sqlite')],{stdio:'pipe'}), error => error.status === 1 && error.stderr.toString().includes('Older acknowledgement must not mark newer assignment synced'));
 console.log('PASS: regression sensitivity confirmed by removing the production unresolved-operation guard in a temporary compiled copy');
 console.log(`Compiled ${methods.filter(m => chosen.has(m.name)).length} unchanged production methods and the full SQLiteConnection.`);
} finally { await rm(dir,{recursive:true,force:true}); }

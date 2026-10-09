import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const models = await readFile(new URL('../../NYC CC APP/permitext/Models/ResearchNotebookModels.swift', import.meta.url), 'utf8');
const notebook = await readFile(new URL('../../NYC CC APP/permitext/Views/NotebookView.swift', import.meta.url), 'utf8');
const research = await readFile(new URL('../../NYC CC APP/permitext/Views/ResearchView.swift', import.meta.url), 'utf8');
const start = models.indexOf('enum ResearchNotebookHandoffPresentation {');
assert.ok(start >= 0);
const actual = models.slice(start, models.indexOf('\n}\n', start) + 3);
const temporary = await mkdtemp(join(tmpdir(), 'permitext-notebook-handoff-'));
try {
  const source = join(temporary, 'main.swift');
  const executable = join(temporary, 'handoff');
  await writeFile(source, `import Foundation\n${actual}\n
let questions = ["Short question", String(repeating: "a", count: 2000), String(repeating: "👩🏽‍💻", count: 500), String(repeating: "e\\u{301}", count: 700)]
for question in questions {
    let label = ResearchNotebookHandoffPresentation.referenceLabel(question: question)
    precondition(label.utf16.count <= 500)
    precondition(label.hasPrefix("Research: "))
    precondition(!label.contains("\\u{FFFD}"))
    let title = ResearchNotebookHandoffPresentation.boundedText(question, maximumUTF16Count: 160)
    precondition(title.utf16.count <= 160)
    precondition(!title.contains("\\u{FFFD}"))
}
precondition(ResearchNotebookHandoffPresentation.referenceLabel(question: "Short question") == "Research: Short question")
let exact = String(repeating: "x", count: 500)
precondition(ResearchNotebookHandoffPresentation.boundedText(exact, maximumUTF16Count: 500) == exact)
print("Native Notebook handoff labels preserve graphemes and meet backend UTF-16 limits.")
`);
  const compiled = spawnSync('xcrun', ['swiftc', source, '-o', executable], { encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stderr);
  const ran = spawnSync(executable, [], { encoding: 'utf8' });
  assert.equal(ran.status, 0, ran.stderr);
  process.stdout.write(ran.stdout);
} finally { await rm(temporary, { recursive: true, force: true }); }

// Review precedes the only mutation; the answer stays an immutable reference.
const sheet = notebook.slice(notebook.indexOf('struct ResearchNotebookHandoffSheet:'), notebook.indexOf('private struct NativeNotebookEditorRoute:'));
assert.match(sheet, /reference\(kind: "researchAnswer", id: handoff\.id/);
assert.match(sheet, /private var isCurrentOwner: Bool \{ owner != nil && owner == library\.privateRequestIdentity \}/);
assert.match(sheet, /guard isCurrentOwner, hasProject, !isSaving else \{ return \}/);
assert.match(sheet, /clientMutationID: mutationID/);
assert.match(sheet, /guard isCurrentOwner, !Task\.isCancelled else \{ return \}\s+savedCardID = card\.id/);
assert.doesNotMatch(sheet, /\.task[\s\S]*saveNotebookCard|answer\.conclusion/);
assert.match(research, /pendingNotebookHandoff = ResearchNotebookHandoff\(\s+id: message\.id, question: question, projectID: current\.primaryProjectID/);
console.log('Native Research handoff preserves answer identity, explicit destination review, stable retries and owner publication guards.');

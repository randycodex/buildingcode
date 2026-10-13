// Run the production answer projection on the host, without a Simulator runtime.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const models = await readFile(new URL('../../NYC CC APP/permitext/Models/ResearchNotebookModels.swift', import.meta.url), 'utf8');
const start = models.indexOf('struct ResearchAnswer:');
const end = models.indexOf('// MARK: - Notebook', start);
assert.ok(start >= 0 && end > start);

const fixture = String.raw`
func check(_ value: Bool, _ message: String) { if !value { fatalError(message) } }
let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
let conversation = json["conversation"] as! [String: Any]
let messages = conversation["messages"] as! [[String: Any]]
let rawAnswer = messages.last!["answer"] as! [String: Any]
let answer = try JSONDecoder().decode(ResearchAnswer.self, from: JSONSerialization.data(withJSONObject: rawAnswer))
let expected = (rawAnswer["answerText"] as! String).trimmingCharacters(in: .whitespacesAndNewlines)
check(answer.narrativeText == expected, "Copy must contain exactly the visible answer from the client response")
check(answer.structuredCopyText(sourceStatus: "changed") != answer.narrativeText, "Copy Answer must not use the structured source-details export")

var withMetadata = answer
withMetadata.answerText = " \n**No.** Sprinklers must be installed in or under the display. (2022 NYC BC § 903.3.3)\n\n- Keep the stated exception.\n "
withMetadata.authorityLabel = "Conditional on Project facts"
withMetadata.disclaimer = "SEPARATE DISCLAIMER"
withMetadata.followUpQuestions = ["SEPARATE FOLLOW-UP"]
withMetadata.missingFacts = ["SEPARATE MISSING FACT"]
check(withMetadata.narrativeText == "**No.** Sprinklers must be installed in or under the display. (2022 NYC BC § 903.3.3)\n\n- Keep the stated exception.", "Answer text must retain inline citations, paragraphs, and qualifications without appending metadata")

withMetadata.answerText = " \n "
withMetadata.conclusion = "  Legacy conclusion (BC § 101.1). \n"
withMetadata.explanation = "\nLegacy explanation.  "
check(withMetadata.narrativeText == "Legacy conclusion (BC § 101.1).\n\nLegacy explanation.", "Legacy answers must copy their displayed conclusion and explanation")
withMetadata.conclusion = " "
check(withMetadata.narrativeText == "Legacy explanation.", "Blank legacy conclusions must not add empty paragraphs")
withMetadata.explanation = "\n"
check(withMetadata.narrativeText.isEmpty, "An empty answer must not copy source details or boilerplate")
print("PASS: answer-only copy, inline citation and qualification retention, legacy fallback, and empty answers")
`;
const directory = await mkdtemp(join(tmpdir(), 'permitext-research-copy-'));
try {
  const source = join(directory, 'main.swift');
  const executable = join(directory, 'verify');
  await writeFile(source, `import Foundation\n${models.slice(start, end)}\n${fixture}`);
  execFileSync('xcrun', ['swiftc', source, '-o', executable], { stdio: 'inherit' });
  execFileSync(executable, [fileURLToPath(new URL('./fixtures/research-client-response-v1.json', import.meta.url))], { stdio: 'inherit' });
} finally { await rm(directory, { recursive: true, force: true }); }

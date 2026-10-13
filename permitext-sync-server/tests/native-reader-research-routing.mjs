// Compile the production routing method to verify owner and conversation behavior.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const source = await readFile(new URL('../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift', import.meta.url), 'utf8');
const start = source.indexOf('    func sendToResearch(');
const end = source.indexOf('    private func performPrivateAccountRequest', start);
assert.ok(start >= 0 && end > start);
const fixture = `
import Foundation
struct ResearchSelectionRequest: Equatable { let text: String }
enum Tab { case reader, research }
final class Library {
 weak var sharedAccountLibrary: Library?
 var activeResearchConversationID: String?
 var selectedTab = Tab.reader
 var pendingResearchSelections: [ResearchSelectionRequest] = []
 ${source.slice(start, end)}
}
let owner = Library()
let first = ResearchSelectionRequest(text: "First paragraph")
let second = ResearchSelectionRequest(text: "Second paragraph")
owner.sendToResearch(first)
precondition(owner.selectedTab == .research)
precondition(owner.pendingResearchSelections == [first])
owner.activeResearchConversationID = "open-conversation"
owner.acknowledgePendingResearchSelections([first])
owner.selectedTab = .reader
owner.sendToResearch(second)
precondition(owner.selectedTab == .reader)
precondition(owner.activeResearchConversationID == "open-conversation")
precondition(owner.pendingResearchSelections == [second])
owner.sendToResearch(second)
precondition(owner.pendingResearchSelections == [second])
owner.acknowledgePendingResearchSelections([second])
let independent = Library()
independent.sharedAccountLibrary = owner
independent.sendToResearch(first)
precondition(owner.pendingResearchSelections == [first])
precondition(independent.pendingResearchSelections.isEmpty)
precondition(owner.selectedTab == .reader && independent.selectedTab == .reader)
owner.acknowledgePendingResearchSelections([first])
owner.activeResearchConversationID = nil
independent.sendToResearch(second)
precondition(owner.selectedTab == .research)
precondition(owner.pendingResearchSelections == [second])
print("PASS: first passage opens Research; existing conversation retains Reader; secondary Readers route to owner; duplicate pending selections suppressed")
`;
const directory = await mkdtemp(join(tmpdir(), 'permitext-reader-research-'));
try {
 const file = join(directory, 'main.swift'), binary = join(directory, 'verify');
 await writeFile(file, fixture);
 execFileSync('xcrun', ['swiftc', file, '-o', binary], {stdio:'inherit'});
 execFileSync(binary, [], {stdio:'inherit'});
} finally { await rm(directory, {recursive:true, force:true}); }

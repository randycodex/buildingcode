import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  accountArtifactRevisionKey,
  normalizeAccountArtifactRevisionEnvelope,
  normalizeProjectArtifactRevisionEnvelope,
  projectArtifactRefreshPlan,
  projectArtifactRevisionKey,
  reduceAccountArtifactRevision,
  reduceProjectArtifactRevisions,
  uniqueProjectArtifactConsumerIDs
} from "../public/project-artifact-checkpoints.js";

const scope = {
  accountUserID: "account-a",
  workspaceID: "workspace-a",
  researchVisible: true,
  visibleProjectIDs: new Set(["project-a", "project-b"])
};

const envelope = (overrides = {}) => normalizeProjectArtifactRevisionEnvelope({
  storageOwnerUserID: "owner-a",
  projectID: "project-a",
  revision: 1,
  domains: ["foundation"],
  ...overrides
}, scope);

assert.deepEqual(
  uniqueProjectArtifactConsumerIDs(["project-a", "project-a", "project-b", "", null]),
  ["project-a", "project-b"],
  "multiple mounted consumers for one Project must produce one checkpoint Project ID"
);

const isolated = reduceProjectArtifactRevisions({
  envelopes: [
    envelope(),
    envelope({ accountUserID: "account-b", revision: 2 }),
    envelope({ workspaceID: "workspace-b", revision: 3 }),
    envelope({ projectID: "project-c", revision: 4 })
  ],
  scope
});
assert.equal(isolated.accepted.length, 1, "account, workspace, and visible Project scope must isolate revisions");
assert.equal(isolated.refreshes[0].projectID, "project-a");

const ownerAKey = projectArtifactRevisionKey(envelope());
const ownerBKey = projectArtifactRevisionKey(envelope({ storageOwnerUserID: "owner-b" }));
assert.notEqual(ownerAKey, ownerBKey, "revision cache keys must include the storage owner");

const accountRevision = normalizeAccountArtifactRevisionEnvelope({
  storageOwnerUserID: "account-a",
  revision: 4,
  domains: ["research"]
}, scope);
assert.equal(
  reduceAccountArtifactRevision({ envelope: accountRevision, scope }).refreshResearch,
  true,
  "an advancing visible account Research revision must refresh mounted Research consumers"
);
assert.equal(
  reduceAccountArtifactRevision({
    envelope: accountRevision,
    revision: { ...accountRevision, revision: 5 },
    scope
  }).accepted,
  null,
  "a late account Research response must be rejected"
);
assert.equal(
  reduceAccountArtifactRevision({
    envelope: accountRevision,
    scope: { ...scope, workspaceID: "workspace-b" }
  }).accepted,
  null,
  "account Research revisions must not cross workspaces"
);
assert.equal(
  reduceAccountArtifactRevision({
    envelope: accountRevision,
    scope: { ...scope, accountUserID: "account-b" }
  }).accepted,
  null,
  "account Research revisions must not cross accounts"
);
assert.notEqual(
  accountArtifactRevisionKey(accountRevision),
  accountArtifactRevisionKey({ ...accountRevision, storageOwnerUserID: "account-b" }),
  "account Research revision keys must include the storage owner"
);

assert.deepEqual(projectArtifactRefreshPlan(["notebook"]), {
  notebookCards: true,
  notebookReferences: true,
  notebookFoundation: false,
  notebookReportStatus: false,
  reportArtifacts: false,
  reportSources: true,
  summaries: false
});
assert.deepEqual(projectArtifactRefreshPlan(["report"]), {
  notebookCards: false,
  notebookReferences: false,
  notebookFoundation: false,
  notebookReportStatus: true,
  reportArtifacts: true,
  reportSources: false,
  summaries: false
});

const current = envelope({ revision: 7, domains: ["foundation", "notebook"] });
const late = reduceProjectArtifactRevisions({
  envelopes: [envelope({ revision: 6, domains: ["report"] })],
  revisions: new Map([[projectArtifactRevisionKey(current), current]]),
  scope
});
assert.equal(late.accepted.length, 0, "a late response cannot roll a Project revision backward");
assert.equal(late.refreshes.length, 0, "a late response cannot refresh stale domains");

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
assert.match(appSource, /postResearch\("\/projects\/artifacts\/checkpoint", \{[\s\S]*?includeAccountResearch: scope\.researchVisible/);
assert.match(appSource, /\(!projectIDs\.length && !scope\.researchVisible\)/);
assert.match(appSource, /focusedDraftInput[\s\S]*?researchQuestionDraft = focusedDraftInput\.value;[\s\S]*?transitionWorkspace\("utility", \{ refreshPaneIDs: paneIDs \}\);[\s\S]*?const preservedDraft = researchQuestionDraft;/, "Research refresh must preserve its live composer draft and pane IDs");
assert.match(appSource, /const accountResult = payload\.account[\s\S]*?applyAccountArtifactRevisionEnvelope\(payload\.account\)[\s\S]*?const projectResult = await applyProjectArtifactRevisionEnvelopes/, "one checkpoint must apply account Research once before Project-domain refreshes");
assert.match(appSource, /\.saved-folder-context\.is-project\[data-project-id=[\s\S]*?workspacePaneHasFocusedEditor\(paneID\)[\s\S]*?refreshSavedPanelInPlace\(paneID/, "visible Project summaries must refresh in place and wait for an active editor to blur");
assert.match(appSource, /if \(dirty \|\| !focusedCardID\) return true;/, "dirty Notebook editors must not be remounted");
assert.match(appSource, /if \(dirty\) \{[\s\S]*?renderSourcePalette\(sourcePalette\);[\s\S]*?renderHistory\(historyBody\);[\s\S]*?return true;/, "dirty Reports must only refresh safe mounted consumers");
assert.match(appSource, /if \(projectUpdatePersisted && account\) \{[\s\S]*?refreshProjectSourceConsumers\(\[updatedProjectID\]/, "Project edits must refresh mounted Project consumers after persistence");

console.log("project artifact checkpoint client contract: ok");

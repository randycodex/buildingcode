import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
function actual(name) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
function method(name, adapter) {
  const start = source.indexOf(`    async ${name}(`, source.indexOf(adapter));
  const end = source.indexOf("\n    },", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 6);
}

const owner = "owner-a";
const mutations = [
  { savedItem: { id: "01", deletedAt: "2026-09-28" } },
  { annotation: { id: "02", noteBody: "note" } },
  { annotation: { id: "03", tags: ["tag"] } },
  { project: { id: "04", folderType: "reference" } },
  { projectSection: { id: "05", sectionID: 123 } },
  { continuity: { id: "06" } },
  { codeVersionClear: { id: "07" } },
  { workboard: { id: "08" } }
];
const profiles = {
  "owner-a": { displayName: " Zed ", publicUsername: "unused", secret: "must-not-return" },
  alpha: { publicUsername: "Alpha", secret: "must-not-return" },
  fallback: {},
  denied: { displayName: "Denied" },
  unrelated: { displayName: "Other account", secret: "must-not-return" }
};
const normalized = value => JSON.parse(JSON.stringify(value));

for (const kind of ["file", "postgres"]) {
  const queries = [];
  const profileRequests = [];
  let initialized = 0;
  let migrated = 0;
  let fileReads = 0;
  const context = vm.createContext({
    ensureSchema: async () => { initialized++; },
    migrateLegacyStateIfNeeded: async () => { migrated++; },
    safeJSON: value => typeof value === "string" ? JSON.parse(value) : value,
    readStore: () => { throw new Error("Global normalized store must not be read"); },
    sql: async (strings, ...values) => {
      const text = strings.join("?");
      queries.push({ text, values });
      if (text.includes("AS user_content")) {
        assert.deepEqual(values, Array(5).fill(owner));
        assert.equal((text.match(/WHERE user_id = \?/g) || []).length, 5);
        for (const table of ["saved_items", "annotations", "projects", "project_items", "user_content_records"]) {
          assert.match(text, new RegExp(`FROM permitext_${table}\\s+WHERE user_id = \\?`));
        }
        assert.match(text, /entity_kind IN \('continuity', 'codeVersionClear', 'workboard'\)/);
        assert.match(text, /ORDER BY record_id/);
        assert.doesNotMatch(text, /deleted_at|deletedAt|permitext_sessions|permitext_entitlements|permitext_users/);
        return mutations.map((mutation, index) => ({ mutation: index % 2 ? JSON.stringify(mutation) : mutation }));
      }
      assert.match(text, /WHERE id = ANY\(\?\)/);
      assert.match(text, /account->>'displayName' AS display_name/);
      assert.match(text, /account->>'publicUsername' AS public_username/);
      assert.doesNotMatch(text, /SELECT id, account FROM/);
      assert.equal(values.length, 1);
      return values[0].filter(id => profiles[id]).map(id => ({
        id, display_name: profiles[id].displayName ?? null,
        public_username: profiles[id].publicUsername ?? null
      }));
    }
  });
  const adapterStart = kind === "file"
    ? "export function createFileStoreAdapter()"
    : "async function createPostgresStoreAdapter()";
  const adapter = vm.runInContext(
    `({${method("listUserContentMutations", adapterStart)},${method("accountProfilesForUserIDs", adapterStart)}})`,
    context
  );
  adapter.read = async () => {
    fileReads++;
    return { users: profiles, mutationsByUserID: {
      [owner]: mutations, unrelated: [{ savedItem: { id: "other-user-secret" } }]
    } };
  };
  context.storeAdapter = async () => adapter;
  vm.runInContext(actual("userContentMutations"), context);
  assert.deepEqual(normalized(await context.userContentMutations(owner)), mutations);
  if (kind === "file") {
    assert.deepEqual(normalized(await context.userContentMutations("missing")), []);
  }
  const publicProfiles = await adapter.accountProfilesForUserIDs([owner, "alpha", owner, "missing"]);
  assert.deepEqual(normalized(publicProfiles), {
    [owner]: { displayName: " Zed ", publicUsername: "unused" },
    alpha: { displayName: null, publicUsername: "Alpha" }
  });
  const countBeforeEmpty = kind === "file" ? fileReads : queries.length;
  assert.deepEqual(normalized(await adapter.accountProfilesForUserIDs([])), {});
  assert.equal(kind === "file" ? fileReads : queries.length, countBeforeEmpty);

  const originalProfiles = adapter.accountProfilesForUserIDs.bind(adapter);
  adapter.accountProfilesForUserIDs = async ids => {
    profileRequests.push(Array.from(ids));
    return originalProfiles(ids);
  };
  context.storedProjectOwnership = async () => ({ owner: { kind: "organization", id: "org" } });
  context.listStoredOrganizationMemberships = async () => [
    { userID: owner, status: "active" }, { userID: "alpha", status: "active" },
    { userID: "denied", status: "active" }, { userID: "unrelated", status: "inactive" }
  ];
  context.listStoredProjectMemberships = async () => [
    { userID: "alpha", status: "active" }, { userID: "fallback", status: "active" },
    { userID: "missing", status: "active" }
  ];
  const permissionsChecked = [];
  context.projectAccessForUser = async (id, projectID) => {
    permissionsChecked.push([id, projectID]);
    return { permissions: id === "denied" ? [] : ["project.view"] };
  };
  context.organizationPermissions = { projectView: "project.view" };
  vm.runInContext(actual("coordinationAssigneesForProject"), context);
  assert.deepEqual(normalized(await context.coordinationAssigneesForProject(owner, "project-a")), [
    { userID: "alpha", displayName: "Alpha" },
    { userID: "fallback", displayName: "Project member" },
    { userID: "missing", displayName: "Project member" },
    { userID: owner, displayName: "Zed" }
  ]);
  assert.deepEqual(profileRequests, [[owner, "alpha", "fallback", "missing"]]);
  assert.deepEqual(permissionsChecked.map(([id]) => id), [owner, "alpha", "denied", "fallback", "missing"]);
  assert.ok(permissionsChecked.every(([, projectID]) => projectID === "project-a"));
  if (kind === "postgres") {
    assert.equal(initialized, 3);
    assert.equal(migrated, 3, "Scoped adapter preserves legacy initialization");
  }
}
console.log("Foundation owner query scope passed: actual consumers avoid global store, adapters retain all legacy mutation kinds/deletions/order, and permitted assignee profiles remain scoped with name fallback/sort.");

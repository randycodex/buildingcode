import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app.mjs", import.meta.url), "utf8");

function actual(name) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end + 2);
}

function method(name, adapter) {
  const start = source.indexOf(`    async ${name}(`, source.indexOf(adapter));
  const end = source.indexOf("\n    },", start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end + 6);
}

const cases = [
  ["projectReportDrafts", "reportDraft"],
  ["projectReportManifests", "reportManifest"],
  ["projectGeneratedReports", "generatedReport"]
];
const links = [];
const artifacts = [];
for (const [, type] of cases) {
  for (const [suffix, projectID, deletedLink, deletedArtifact, wrongType] of [
    ["one", "target", false, false, false],
    ["two", "target", false, false, false],
    ["deleted", "target", false, true, false],
    ["unlinked", "target", true, false, false],
    ["wrong", "target", false, false, true],
    ["other", "unrelated", false, false, false]
  ]) {
    const id = `${type}-${suffix}`;
    links.push({
      projectID, targetKind: type, targetID: id,
      ...(deletedLink ? { deletedAt: "2026-01-01" } : {})
    });
    artifacts.push({
      envelope: {
        id, type: wrongType ? "notebookCard" : type,
        updatedAt: suffix === "one" ? "2026-09-20" : "2026-09-21",
        ...(deletedArtifact ? { deletedAt: "2026-01-01" } : {})
      },
      payload: { reportVersion: suffix === "one" ? 1 : 2, largeUnrelatedBody: "fixture" }
    });
  }
}

function legacy(type, includeDeleted = false) {
  const ids = new Set(links
    .filter(link => !link.deletedAt && link.projectID === "target" && link.targetKind === type)
    .map(link => link.targetID));
  const result = artifacts.filter(artifact =>
    artifact.envelope.type === type &&
    (includeDeleted || !artifact.envelope.deletedAt) &&
    ids.has(artifact.envelope.id));
  if (type === "reportDraft") {
    result.sort((left, right) => right.envelope.updatedAt.localeCompare(left.envelope.updatedAt));
  }
  if (type === "reportManifest") {
    result.sort((left, right) => right.payload.reportVersion - left.payload.reportVersion);
  }
  return result;
}

for (const adapterKind of ["file", "postgres"]) {
  const queries = [];
  const calls = [];
  const sql = async (strings, ...values) => {
    const text = strings.join("?");
    queries.push({ text, values });
    assert.equal(values[0], "storage-owner");
    if (text.includes("FROM permitext_project_links")) {
      assert.match(text, /project_id = \?/);
      assert.match(text, /target_kind = \?/);
      return links
        .filter(link => link.projectID === values[1] && link.targetKind === values[2])
        .map(link => ({ link }));
    }
    assert.match(text, /AND id = ANY\(\?\)/);
    return artifacts.filter(artifact => values[1].includes(artifact.envelope.id));
  };
  const context = vm.createContext({ ensureSchema: async () => {}, sql, safeJSON: value => value });
  const adapterSource = adapterKind === "file"
    ? "export function createFileStoreAdapter()"
    : "async function createPostgresStoreAdapter()";
  const adapter = vm.runInContext(
    `({${method("listProjectLinks", adapterSource)},${method("listFoundationArtifacts", adapterSource)}})`,
    context
  );
  adapter.read = async () => ({
    projectLinksByUserID: { "storage-owner": links },
    foundationArtifactsByUserID: { "storage-owner": artifacts }
  });
  context.listStoredProjectLinks = async (user, options) => {
    calls.push(["links", user, JSON.parse(JSON.stringify(options))]);
    return adapter.listProjectLinks(user, options);
  };
  context.listStoredFoundationArtifacts = async (user, options) => {
    calls.push(["artifacts", user, JSON.parse(JSON.stringify(options))]);
    return adapter.listFoundationArtifacts(user, options);
  };
  vm.runInContext(cases.map(([name]) => actual(name)).join("\n"), context);

  for (const [name, type] of cases) {
    for (const includeDeleted of type === "reportDraft" ? [false, true] : [false]) {
      calls.length = 0;
      const result = await context[name]("storage-owner", "target", { includeDeleted });
      assert.deepEqual(JSON.parse(JSON.stringify(result)), legacy(type, includeDeleted));
      assert.deepEqual(calls[0], ["links", "storage-owner", { projectID: "target", targetKind: type }]);
      assert.equal(calls[1][0], "artifacts");
      assert.equal(calls[1][1], "storage-owner");
      assert.ok(calls[1][2].ids.every(id => !id.endsWith("-other") && !id.endsWith("-unlinked")));
    }
    calls.length = 0;
    assert.deepEqual(Array.from(await context[name]("storage-owner", "empty")), []);
    assert.equal(calls.length, 1, "No artifact read when no linked IDs");
  }
  if (adapterKind === "postgres") {
    assert.ok(queries.length > 0, "Actual Postgres adapter methods emitted scoped SQL");
  }
}
console.log("Report project scoping: actual file/Postgres adapter methods preserve legacy results, deletion handling and order; scoped selectors and empty early exits verified.");

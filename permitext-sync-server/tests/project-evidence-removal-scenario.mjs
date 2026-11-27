import assert from "node:assert/strict";

export async function verifyProjectEvidenceRemoval({ userID, push, pull }) {
  const codeVersion = "nyc-2022";
  const start = (Math.floor(Date.now() / 1_000) - 20) * 1_000;
  const time = offset => new Date(start + offset).toISOString();
  const wrap = (kind, record) => ({ [kind]: { userID, codeVersion, updatedAt: time(0), ...record } });
  const projectID = "native-removal-project";
  const link = (id, sectionID, fields = {}) => wrap("projectSection", {
    id, sectionID, folderClientID: projectID, folderType: "project", ...fields
  });
  const first = 10747;
  const last = 10452;
  const untouched = 10750;
  const quote = "installation of mechanical exhaust systems";
  const firstToken = "95dff575-a1a4-4fab-b724-e1247fbe7420";
  const lastToken = "3438740f-8b82-4427-8dc3-62068ebf14b1";
  const laterWebSave = link("saved-after-phone-action", first, {
    blockID: "later-passage", scope: "manual", updatedAt: time(1_350)
  });
  await push([
    wrap("project", { id: projectID, clientID: projectID, name: "Evidence QA" }),
    wrap("project", { id: "native-other-project", clientID: "native-other-project", name: "Other Evidence" }),
    link("first-portion", first, { blockID: "first-portion", scope: "manual" }),
    link("second-portion", first, { blockID: "second-portion", scope: "manual" }),
    link("ios-selection", last, { selectedExcerpts: [quote], selectedExcerptOccurrences: { [quote]: [1, 2] } }),
    link("last-manual", last, { scope: "manual" }),
    link("untouched", untouched),
    link("another-project-link", first, { folderClientID: "native-other-project" }),
    wrap("savedItem", { id: "native-global-saved-item", sectionID: first, blockID: "first-portion" }),
    wrap("annotation", { id: "native-preserved-note", sectionID: first, blockID: "first-portion", noteBody: "Existing note" }),
    laterWebSave
  ]);
  const action = (sectionID, evidenceRemovalID, offset, remove) => link(`phone-${sectionID}`, sectionID, {
    updatedAt: time(Math.floor(offset / 1_000) * 1_000),
    evidenceActionAt: time(offset),
    evidenceRemovalID,
    ...(remove ? { deletedAt: time(Math.floor(offset / 1_000) * 1_000) } : {})
  });
  const original = await pull();
  const memberships = data => data.mutations.flatMap(({ projectSection }) =>
    projectSection?.folderClientID === projectID && !projectSection.deletedAt ? [projectSection] : []);
  assert.equal(memberships(original).length, 6);
  const firstRemoval = action(first, firstToken, 1_100, true);
  const lastRemoval = action(last, lastToken, 1_200, true);
  for (const change of [firstRemoval, lastRemoval]) {
    const response = await push([change]);
    assert.ok(response.acceptedMutationIDs.includes(change.projectSection.id));
    assert.deepEqual(response.rejectedMutationIDs, []);
  }
  const afterRemoval = await pull();
  const remaining = memberships(afterRemoval);
  assert.deepEqual(remaining.map(record => record.sectionID).sort(), [first, untouched].sort());
  assert.equal(remaining.find(record => record.sectionID === first).blockID, "later-passage");
  assert.ok(afterRemoval.mutations.some(({ projectSection }) => projectSection?.folderClientID === "native-other-project" &&
    projectSection.sectionID === first && !projectSection.deletedAt), "Other project keeps its membership");
  assert.ok(afterRemoval.mutations.some(({ savedItem }) => savedItem?.sectionID === first && !savedItem.deletedAt));
  assert.ok(afterRemoval.mutations.some(({ annotation }) => annotation?.sectionID === first && annotation.noteBody === "Existing note"));
  const undo = action(last, lastToken, 1_450, false);
  const restored = await push([undo]);
  assert.ok(restored.acceptedMutationIDs.includes(undo.projectSection.id));
  assert.deepEqual(restored.rejectedMutationIDs, []);
  const final = memberships(await pull());
  assert.deepEqual(final.map(record => record.sectionID).sort(), [first, last, last, untouched].sort());
  assert.ok(final.some(record => record.sectionID === last && record.scope === "manual"));
  const selection = final.find(record => record.sectionID === last && !record.scope);
  assert.deepEqual(selection.selectedExcerpts, [quote]);
  assert.deepEqual(selection.selectedExcerptOccurrences, { [quote]: [1, 2] });
  await push([lastRemoval]);
  await push([undo]);
  assert.deepEqual(memberships(await pull()), final, "Retries preserve the restored entries");
}

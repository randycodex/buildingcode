import assert from "node:assert/strict";
import {
  continuityMergeContract,
  mergeContinuityMutations,
  mergeContinuityRecords
} from "../continuity-merge.mjs";

function continuity({
  updatedAt,
  views = [],
  searches = [],
  values = {}
}) {
  return {
    userID: "apple:continuity-contract",
    codeVersion: "2022 Construction Codes",
    values: {
      selectedCodeSectionID: values.selectedCodeSectionID || "",
      ...values,
      recentlyViewedSectionsJSON: JSON.stringify(views),
      recentSearchesJSON: JSON.stringify(searches)
    },
    updatedAt
  };
}

function view(sectionID, viewedAt, title = `Section ${sectionID}`, code = {}) {
  return {
    sectionID,
    sectionNumber: String(sectionID),
    title,
    chapterTitle: "Contract chapter",
    codeSectionID: code.codeSectionID ?? 1,
    codeSectionName: code.codeSectionName || "Building Code",
    ...(code.codePrefix ? { codePrefix: code.codePrefix } : {}),
    previewText: "",
    viewedAt
  };
}

function histories(record) {
  return {
    views: JSON.parse(record.values.recentlyViewedSectionsJSON),
    searches: JSON.parse(record.values.recentSearchesJSON),
    searchHistory: JSON.parse(record.values[continuityMergeContract.recentSearchHistoryKey])
  };
}

const deviceA = continuity({
  updatedAt: "2026-07-26T12:00:00.000Z",
  views: [view(101, 804_600_000), view(202, 804_599_000)],
  searches: ["egress", "sprinklers"],
  values: { selectedCodeSectionID: "101" }
});
const deviceB = continuity({
  updatedAt: "2026-07-26T12:00:01.000Z",
  views: [view(303, 804_600_001), view(101, 804_599_500, "Older section 101")],
  searches: ["occupancy", "egress"],
  values: { selectedCodeSectionID: "303" }
});

const mergedAB = mergeContinuityRecords(deviceA, deviceB);
const mergedBA = mergeContinuityRecords(deviceB, deviceA);
assert.deepEqual(mergedAB, mergedBA, "Continuity merge must be commutative.");
assert.deepEqual(
  histories(mergedAB).views.map((entry) => entry.sectionID),
  [303, 101, 202],
  "Concurrent view histories must be unioned and ordered by per-entry recency."
);
assert.equal(
  histories(mergedAB).views.find((entry) => entry.sectionID === 101).title,
  "Section 101",
  "The newest version of a duplicate viewed section must win."
);
const crossCodeA = continuity({
  updatedAt: "2026-07-26T12:00:01.500Z",
  views: [view(101, 804_600_010)]
});
const crossCodeB = continuity({
  updatedAt: "2026-07-26T12:00:01.600Z",
  views: [view(101, 804_600_011, "Plumbing section 101", {
    codeSectionID: 5,
    codeSectionName: "Plumbing Code"
  })]
});
assert.deepEqual(
  histories(mergeContinuityRecords(crossCodeA, crossCodeB)).views.map((entry) => entry.codeSectionName),
  ["Plumbing Code", "Building Code"],
  "Sections with the same numeric ID in different code books must remain separate history entries."
);
assert.deepEqual(
  histories(mergedAB).searches,
  ["occupancy", "egress", "sprinklers"],
  "Concurrent search histories must retain unique queries from both devices."
);
assert.equal(
  mergedAB.values.selectedCodeSectionID,
  "303",
  "Non-history fields must remain snapshot-owned and come from the intrinsically newer record."
);

const deviceC = continuity({
  updatedAt: "2026-07-26T12:00:02.000Z",
  views: [view(404, 804_600_002)],
  searches: ["accessibility"]
});
assert.deepEqual(
  mergeContinuityRecords(mergeContinuityRecords(deviceA, deviceB), deviceC),
  mergeContinuityRecords(deviceA, mergeContinuityRecords(deviceB, deviceC)),
  "Continuity merge must be associative."
);
const normalizedA = mergeContinuityRecords(deviceA, deviceA);
assert.deepEqual(
  mergeContinuityRecords(normalizedA, normalizedA),
  normalizedA,
  "Continuity merge must be idempotent."
);

const bounded = continuity({
  updatedAt: "2026-07-26T12:00:03.000Z",
  views: Array.from({ length: 70 }, (_, index) => view(index + 1, 804_600_100 - index)),
  searches: Array.from({ length: 65 }, (_, index) => `query-${index}`)
});
const boundedHistories = histories(mergeContinuityRecords(bounded, deviceA));
assert.equal(boundedHistories.views.length, continuityMergeContract.recentViewLimit);
assert.equal(boundedHistories.searches.length, continuityMergeContract.recentSearchLimit);
assert.equal(continuityMergeContract.recentViewLimit, 50);
assert.equal(continuityMergeContract.recentSearchLimit, 50);

const serverMerged = mergeContinuityMutations(
  { continuity: deviceB },
  { continuity: deviceA },
  { mergedAt: "2026-07-26T12:00:05.000Z" }
);
assert.equal(
  serverMerged.continuity.updatedAt,
  "2026-07-26T12:00:05.000Z",
  "A history-changing merge must receive a fresh server timestamp for incremental pulls."
);
assert.deepEqual(
  histories(serverMerged.continuity).searches,
  histories(mergedAB).searches,
  "Out-of-order arrival must not change the converged history."
);

const cleared = continuity({
  updatedAt: "2026-07-26T12:00:06.000Z",
  views: [],
  searches: []
});
const afterClear = mergeContinuityRecords(mergedAB, cleared);
assert.deepEqual(
  histories(afterClear).views,
  [],
  "An explicit newer empty view history must act as a convergent clear watermark."
);
assert.deepEqual(
  histories(afterClear).searches,
  [],
  "An explicit newer empty search history must act as a convergent clear watermark."
);
assert.deepEqual(
  mergeContinuityRecords(afterClear, deviceA),
  afterClear,
  "An out-of-order pre-clear snapshot must not resurrect cleared activity."
);

console.log("Permitext continuity merge contract passed.");

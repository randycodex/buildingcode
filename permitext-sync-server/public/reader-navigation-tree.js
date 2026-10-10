function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function provisionNumber(value) {
  return compact(value).replace(/^§\s*/, "").replace(/^[A-Z]{1,6}\s+(?=[A-Z]?\d)/i, "").replace(/\.$/, "");
}

function parentNumbers(number) {
  const parents = [];
  let value = number;
  while (/\([a-z\d]+\)$/i.test(value) || value.includes(".")) {
    value = /\([a-z\d]+\)$/i.test(value)
      ? value.replace(/\([a-z\d]+\)$/i, "")
      : value.slice(0, value.lastIndexOf("."));
    parents.push(value);
  }
  return parents;
}

function headingLabel(value) {
  const text = compact(value);
  if (!text || text !== text.toUpperCase()) return text;
  return text.charAt(0) + text.slice(1).toLowerCase();
}

export function readerContentsChapterKey(chapterID) {
  return `chapter:${chapterID}`;
}

// Build from chapter summaries only. Bodies, tables and definition decoration
// never need to load just to browse the contents.
export function buildReaderChapterContents(chapter, sections, displayTitle) {
  const chapterID = String(chapter.id);
  const groups = new Map((chapter.groups || []).map(group => [String(group.id), group]));
  const buckets = new Map();
  const seen = new Set();
  for (const section of sections || []) {
    if (section.id == null || seen.has(String(section.id))) continue;
    seen.add(String(section.id));
    const key = String(section.groupID || "");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(section);
  }

  const roots = [];
  for (const [groupID, entries] of buckets) {
    const group = groups.get(groupID) || entries[0];
    const header = compact(group.headerLine).replace(/^SECTION\s+/i, "");
    const number = provisionNumber(header);
    const isChapterHeading = /^(?:CHAPTER|APPENDIX)\b/i.test(header);
    const repeatsChapter = isChapterHeading && new RegExp(`^(?:CHAPTER|APPENDIX)\\s+${String(chapter.chapterNumber).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\b|$)`, "i").test(header);
    const nodes = entries.map(section => ({
      key: `section:${chapterID}:${section.id}`,
      kind: "section",
      chapterID,
      sectionID: String(section.id),
      number: provisionNumber(section.sectionNumber),
      title: displayTitle(section.sectionNumber, section.title).replace(/\.$/, ""),
      children: []
    }));
    const byNumber = new Map();
    for (const node of nodes) {
      if (node.number && !byNumber.has(node.number)) byNumber.set(node.number, node);
    }
    const syntheticGroup = header && !repeatsChapter && !byNumber.has(number) ? {
      key: `group:${chapterID}:${groupID || header}`,
      kind: "group",
      chapterID,
      sectionID: nodes[0].sectionID,
      title: [header, headingLabel(group.headingLine)].filter(Boolean).join(" "),
      children: []
    } : null;
    if (syntheticGroup) roots.push(syntheticGroup);
    for (const node of nodes) {
      // Match complete dotted components: 101.1 cannot parent 101.10.
      // Missing intermediate headings fall back to the closest real ancestor.
      const parent = parentNumbers(node.number).map(value => byNumber.get(value)).find(Boolean);
      (parent?.children || syntheticGroup?.children || roots).push(node);
    }
  }
  return roots;
}

export function readerContentsAncestorKeys(nodes, sectionID, path = []) {
  for (const node of nodes) {
    if (node.kind === "section" && node.sectionID === String(sectionID)) return path;
    const found = readerContentsAncestorKeys(node.children || [], sectionID, [...path, node.key]);
    if (found) return found;
  }
  return null;
}

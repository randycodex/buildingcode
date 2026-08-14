const PLACEHOLDER_SECTION_NUMBERS = new Set(["", "section", "§", "sec", "sec."]);

const LOGICAL_HEADING = /^(?<kind>Chapter|Appendix)\s+(?<number>[A-Z]?\d+[A-Z]?|\d+[A-Z]?|[A-Z])(?:\s*[:.—-]\s*(?<title>.*))?$/i;

export function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function isPlaceholderSectionNumber(value) {
  return PLACEHOLDER_SECTION_NUMBERS.has(compactText(value).toLowerCase());
}

export function isReaderNavigationSection(section, chapterContext = {}) {
  const number = compactText(section?.sectionNumber);
  if (!number) return false;
  const compact = number.replace(/\s+/g, "");
  const stripped = compact.replace(/\.$/, "");
  const chapterNumber = compactText(chapterContext.chapterNumber || section?.chapterNumber);
  const prefix = compactText(chapterContext.codePrefix || section?.codePrefix).toUpperCase();

  if (prefix === "AC") {
    return /^28-/i.test(stripped);
  }

  if (/^\d+$/.test(chapterNumber)) {
    if (!/^\d+(?:\.\d+)*$/.test(stripped)) return true;
    const width = chapterNumber.length === 1 ? 3 : 4;
    const official = new RegExp(`^${chapterNumber}\\d{${width - chapterNumber.length}}(?:\\.\\d+)*$`);
    return official.test(stripped);
  }

  if (/^[A-Z]$/i.test(chapterNumber)) {
    return new RegExp(`^${chapterNumber}\\d`, "i").test(stripped);
  }

  if (/^[A-Z]+\d+$/i.test(chapterNumber)) {
    const letter = chapterNumber.replace(/\d+$/, "");
    if (new RegExp(`^${letter}\\d`, "i").test(stripped)) return true;
    return !/\.$/.test(compact);
  }

  return true;
}

export function parseLogicalChapterHeading(headerLine) {
  const value = compactText(headerLine);
  const match = value.match(LOGICAL_HEADING);
  if (!match) return null;
  const kind = /^appendix$/i.test(match.groups.kind) ? "appendix" : "chapter";
  return {
    kind,
    number: compactText(match.groups.number),
    title: compactText(match.groups.title),
    fullTitle: value
  };
}

export function visibleSectionNumber(section) {
  const raw = compactText(section?.sectionNumber);
  if (!isPlaceholderSectionNumber(raw)) return raw;
  const prefix = compactText(section?.codePrefix).toUpperCase();
  const title = compactText(section?.title);
  if (prefix) {
    const prefixed = title.match(
      new RegExp(`^${prefix}\\s+([A-Z]?\\d+(?:\\.\\d+)*|[A-Z]\\d+)\\b`, "i")
    );
    if (prefixed) return `${prefix} ${prefixed[1]}`;
  }
  const generic = title.match(/^([A-Z]{1,6})\s+([A-Z]?\d[\w.]*)\b/);
  if (generic && (!prefix || generic[1].toUpperCase() === prefix)) {
    return `${generic[1].toUpperCase()} ${generic[2]}`;
  }
  return raw;
}

export function applyVisibleSectionNumber(section) {
  if (!section || typeof section !== "object") return section;
  const storedSectionNumber = section.storedSectionNumber ?? section.sectionNumber;
  const sectionNumber = visibleSectionNumber({ ...section, sectionNumber: storedSectionNumber });
  if (sectionNumber === section.sectionNumber && storedSectionNumber === section.storedSectionNumber) {
    return section;
  }
  return {
    ...section,
    storedSectionNumber,
    sectionNumber
  };
}

export function shouldPromoteGroupsToNavigationChapters(codePrefix, groups) {
  // Fire Code is stored as two Administrative Code container chapters. The
  // usable Fire Code chapters live in Chapter 2's groups. Other prefixes that
  // also nest Chapter headings (notably T28 chapters 6–9 and 12) keep those
  // groups inside their Title 28 containers because dedicated BC/PC/MC/FGC/EBC
  // code books already expose that chapter hierarchy.
  if (String(codePrefix || "").toUpperCase() !== "FC") return false;
  const chapterLike = (groups || []).filter((group) => parseLogicalChapterHeading(group.headerLine));
  return chapterLike.length >= 2;
}

export function navigationChapterIDForGroup(sourceChapterID, group, index = 0) {
  const groupID = compactText(group?.id);
  if (/^[a-zA-Z0-9_-]+$/.test(groupID)) return groupID;
  return `${sourceChapterID}-g-${String(index + 1).padStart(3, "0")}`;
}

function withSourceHierarchy(summary, extras = {}) {
  return {
    ...summary,
    sourceChapterID: summary.sourceChapterID || summary.id,
    sourceChapterNumber: summary.sourceChapterNumber || summary.chapterNumber,
    hierarchyKind: extras.hierarchyKind || summary.hierarchyKind || "source-chapter",
    navigationChapterID: extras.navigationChapterID || summary.navigationChapterID || summary.id,
    groupID: extras.groupID || summary.groupID || null,
    ...extras
  };
}

export function projectSourceChapterToNavigation(sourceSummary, preparedChapter) {
  const groups = preparedChapter?.groups || [];
  if (!shouldPromoteGroupsToNavigationChapters(sourceSummary.codePrefix, groups)) {
    return [withSourceHierarchy({
      ...sourceSummary,
      groupCount: sourceSummary.groupCount ?? groups.length,
      sectionCount: sourceSummary.sectionCount ??
        groups.reduce((count, group) => count + (group.sections?.length || 0), 0)
    })];
  }

  return groups.map((group, index) => {
    const heading = parseLogicalChapterHeading(group.headerLine);
    const navigationID = navigationChapterIDForGroup(sourceSummary.id, group, index);
    const title = heading?.fullTitle || compactText(group.headerLine) || `Group ${index + 1}`;
    const sectionCount = group.sections?.length || 0;
    return withSourceHierarchy(sourceSummary, {
      id: navigationID,
      navigationChapterID: navigationID,
      groupID: group.id || navigationID,
      hierarchyKind: "logical-chapter",
      chapterNumber: heading?.number || String(index + 1),
      displayTitle: title,
      fullTitle: title,
      title,
      groupCount: 1,
      sectionCount,
      manifestSectionCount: sectionCount,
      sourceChapterID: sourceSummary.id,
      sourceChapterNumber: sourceSummary.chapterNumber,
      sourceTitle: sourceSummary.fullTitle || sourceSummary.displayTitle || sourceSummary.title
    });
  });
}

export function filterChapterToNavigation(preparedChapter, navigationSummary) {
  if (!preparedChapter) return null;
  if (navigationSummary?.hierarchyKind !== "logical-chapter") {
    return preparedChapter;
  }
  const groupID = String(navigationSummary.groupID || "");
  const groups = (preparedChapter.groups || []).filter((group) => String(group.id) === groupID);
  return {
    ...preparedChapter,
    chapterNumber: navigationSummary.chapterNumber || preparedChapter.chapterNumber,
    groups
  };
}

export function decorateSectionForNavigation(section, navigationSummary, sourceSummary = null) {
  const normalized = applyVisibleSectionNumber(section);
  const sourceChapterID = sourceSummary?.id || navigationSummary?.sourceChapterID || normalized.chapterID;
  return {
    ...normalized,
    chapterID: sourceChapterID,
    sourceChapterID,
    sourceChapterNumber: sourceSummary?.chapterNumber ||
      navigationSummary?.sourceChapterNumber ||
      normalized.chapterNumber,
    navigationChapterID: navigationSummary?.id || sourceChapterID,
    navigationChapterNumber: navigationSummary?.chapterNumber || normalized.chapterNumber
  };
}

export function sectionIDsForPreparedChapter(preparedChapter) {
  return (preparedChapter?.groups || []).flatMap((group) =>
    (group.sections || []).map((section) => String(section.id))
  );
}

export function classifyHierarchyIssue({
  sourceChapterCount,
  navigationChapterCount,
  catalogCount,
  preparedCount,
  manifestCount,
  searchCount,
  placeholderCount,
  recoveredPlaceholderCount,
  promotionApplied = false
}) {
  const issues = [];
  if (sourceChapterCount === 0) {
    issues.push({ kind: "missing-source-content", detail: "No source chapters were found." });
  }
  if (catalogCount !== preparedCount) {
    issues.push({
      kind: "incorrect-source-extraction",
      detail: `Catalog count ${catalogCount} disagrees with prepared chapter sections ${preparedCount}.`
    });
  }
  if (manifestCount != null && manifestCount !== preparedCount) {
    issues.push({
      kind: "incorrect-source-extraction",
      detail: `Manifest count ${manifestCount} disagrees with prepared chapter sections ${preparedCount}.`
    });
  }
  if (searchCount != null && searchCount !== catalogCount) {
    issues.push({
      kind: "incomplete-api-exposure",
      detail: `Search index count ${searchCount} disagrees with catalog ${catalogCount}.`
    });
  }
  if (placeholderCount > 0 && recoveredPlaceholderCount < placeholderCount) {
    issues.push({
      kind: "incorrect-hierarchy-normalization",
      detail: `${placeholderCount - recoveredPlaceholderCount} placeholder section numbers could not be recovered.`
    });
  } else if (placeholderCount > 0) {
    issues.push({
      kind: "incorrect-hierarchy-normalization",
      detail: `${placeholderCount} placeholder section numbers were recovered from titles without changing section IDs.`
    });
  }
  if (navigationChapterCount > sourceChapterCount && !promotionApplied) {
    issues.push({
      kind: "incomplete-api-exposure",
      detail: `Source containers (${sourceChapterCount}) hide ${navigationChapterCount} logical navigation chapters.`
    });
  }
  return issues;
}

export function compareNavigationChapterOrder(left, right) {
  return String(left.codePrefix || "").localeCompare(String(right.codePrefix || "")) ||
    compareLooseChapterNumber(left.chapterNumber, right.chapterNumber) ||
    String(left.id).localeCompare(String(right.id), undefined, { numeric: true });
}

function compareLooseChapterNumber(left, right) {
  const leftValue = String(left || "");
  const rightValue = String(right || "");
  const leftNumeric = /^\d+$/.test(leftValue);
  const rightNumeric = /^\d+$/.test(rightValue);
  if (leftNumeric && rightNumeric) return Number(leftValue) - Number(rightValue);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
}

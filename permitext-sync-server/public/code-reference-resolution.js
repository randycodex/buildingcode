// Reference navigation only. Saved evidence continues to use exact section IDs.
export function referenceNumber(value) {
  return String(value || "").trim().replace(/^Section\s+/i, "").replace(/\([^)]+\)/g, "").replace(/\.$/, "").toUpperCase();
}

export function codeReferenceRequest(params) {
  const required = ["include", "code", "version", "number", "kind"];
  const kinds = ["section", "article-or-section", "table", "figure", "appendix-section", "chapter", "appendix"];
  if (required.some(key => params.getAll(key).length !== 1 || !params.get(key).trim()) ||
      params.get("include") !== "metadata" || !kinds.includes(params.get("kind")) ||
      !/^[A-Z][A-Z0-9]{0,7}$/i.test(params.get("code")) || params.get("number").length > 200 ||
      !/^[A-Z0-9]+(?:[-.][A-Z0-9]+)*(?:\([A-Z0-9]+\))*$/i.test(params.get("number"))) {
    const error = new Error("Provide one code, exact edition, reference number and reference kind for metadata resolution.");
    error.statusCode = 400;
    throw error;
  }
  return {code: params.get("code").toUpperCase(), version: params.get("version"),
    number: params.get("number").toUpperCase(), kind: params.get("kind")};
}

export function resolveCodeReference(records, {code, version, number, kind}) {
  const belongsToChapter = section => {
    const chapter = String(section.sourceChapterNumber || section.chapterNumber || "");
    if (!["BC", "PC", "MC", "FGC"].includes(code) || !/^\d+$/.test(chapter)) return true;
    // Imported lists can carry another section's number inside Chapter 10.
    // Use the enacted numbering hierarchy to exclude those catalog aliases.
    return new RegExp(`^${chapter}\\d{2}(?:\\.|$)`).test(referenceNumber(section.sectionNumber));
  };
  const entries = [...new Map([...records].filter(section => section.codePrefix === code && section.codeVersion === version && belongsToChapter(section))
    .map(section => [String(section.id), section])).values()];
  const numberOf = section => referenceNumber(section.sectionNumber).replace(new RegExp(`^${code}\\s+`), "");
  const requested = referenceNumber(number);
  const chapter = kind === "chapter" || kind === "appendix";
  const order = (a, b) => numberOf(a).localeCompare(numberOf(b), "en", {numeric: true, sensitivity: "base"});
  let matches = [], match = "exact";
  if (chapter) {
    matches = entries.filter(section => [section.sourceChapterNumber, section.chapterNumber, section.navigationChapterNumber]
      .some(value => String(value || "").toUpperCase() === requested));
    // Catalogs also contain numbered list aliases (1.1, 2.1). Start a
    // chapter at its enacted section, rather than at one of those aliases.
    const stem = ["AC", "T28"].includes(code) ? /^28-/ : /^\d+$/.test(requested)
      ? new RegExp(`^${requested}\\d{2}(?:\\.|$)`) : /^[A-Z]\d/.test(requested)
      ? new RegExp(`^${requested}\\d{2}(?:\\.|$)`) : new RegExp(`^${requested}\\d`);
    const numbered = matches.filter(section => stem.test(numberOf(section)));
    if (numbered.length) matches = numbered;
    match = "chapter-start";
  } else {
    matches = entries.filter(section => numberOf(section) === requested);
    if (!matches.length) {
      matches = entries.filter(section => numberOf(section).startsWith(`${requested}.`));
      match = "first-subsection";
    }
    if (!matches.length) {
      matches = entries.filter(section => requested.startsWith(`${numberOf(section)}.`));
      const longest = Math.max(0, ...matches.map(section => numberOf(section).length));
      matches = matches.filter(section => numberOf(section).length === longest);
      match = "containing-section";
    }
  }
  if (!matches.length || (match === "containing-section" && /^[A-Z]$/.test(numberOf(matches[0])))) {
    const error = new Error(`${code} ${kind === "chapter" ? "Chapter " : kind === "appendix" ? "Appendix " : ""}${number} is not available in this code edition. No other section or edition was substituted.`);
    error.statusCode = 404;
    throw error;
  }
  const chapters = new Set(matches.map(section => String(section.navigationChapterID || section.chapterID)));
  if ((["exact", "containing-section"].includes(match) && matches.length !== 1) || chapters.size > 1) {
    const error = new Error("This reference matches multiple destinations in this edition. Open its exact source instead.");
    error.statusCode = 409;
    throw error;
  }
  return {section: matches.sort(order)[0], referenceTarget: {kind, number, match}};
}

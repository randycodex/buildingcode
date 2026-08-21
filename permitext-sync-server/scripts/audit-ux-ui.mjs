import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const allowanceMarker = "ux-audit-allow:";

function auditablePath(path) {
  return /\.(?:css|html|js|swift)$/.test(path) &&
    !/(?:^|\/)(?:tests?|scripts?|docs?)(?:\/|$)/.test(path);
}

export function parseAddedLines(diff) {
  const records = [];
  let path = "";
  let nextLine = 0;
  for (const line of String(diff || "").split("\n")) {
    if (line.startsWith("+++ b/")) {
      path = line.slice(6);
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      nextLine = Number(hunk[1]);
      continue;
    }
    if (!path || line.startsWith("--- ") || line.startsWith("+++ ")) continue;
    if (line.startsWith("+")) {
      records.push({ path, lineNumber: nextLine, text: line.slice(1) });
      nextLine += 1;
    } else if (!line.startsWith("-")) {
      nextLine += 1;
    }
  }
  return records;
}

function hasAllowance(records, index) {
  const record = records[index];
  if (record.text.includes(allowanceMarker)) return true;
  const previous = records[index - 1];
  return Boolean(
    previous &&
    previous.path === record.path &&
    previous.lineNumber === record.lineNumber - 1 &&
    previous.text.includes(allowanceMarker)
  );
}

function rawColorOutsideToken(record) {
  if (!record.path.endsWith(".css")) return false;
  const line = record.text.replace(/\/\*.*?\*\//g, "");
  if (/^\s*--[\w-]+\s*:/.test(line)) return false;
  return /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/.test(line);
}

function deprecatedAstroidCopy(record) {
  return /Astroid/i.test(record.text) &&
    /(?:Text|Label|Button|accessibilityLabel|textContent|innerText|placeholder)/.test(record.text);
}

function iPhoneTopLevelProjectsLabel(record) {
  return record.path.endsWith("PermitextApp.swift") && /Text\(\s*"Projects"\s*\)/.test(record.text);
}

function exportsObjectHeading(record) {
  return /(?:Text\(|title:\s*|textContent\s*=\s*)"Exports"/.test(record.text);
}

function hiddenPanelTitle(record) {
  if (!record.path.endsWith("styles.css") || !/\b(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/.test(record.text)) {
    return false;
  }
  return /\.panel-title\b/.test(record.context || "");
}

export function auditAddedLines(records) {
  const failures = [];
  const warnings = [];
  records.forEach((record, index) => {
    if (!auditablePath(record.path) || hasAllowance(records, index)) return;
    const fail = (rule, message) => failures.push({ ...record, rule, message });
    if (rawColorOutsideToken(record)) {
      fail("raw-color", "Use a semantic CSS token, or add an explicit ux-audit-allow reason.");
    }
    if (deprecatedAstroidCopy(record)) {
      fail("astroid-copy", "Call the control the sparkle icon in user-facing copy.");
    }
    if (iPhoneTopLevelProjectsLabel(record)) {
      fail("ios-projects-tab", "The iPhone saved-code destination is Saved; Projects remain job context within it.");
    }
    if (exportsObjectHeading(record)) {
      fail("exports-heading", "Use Report for the artifact and Export only for the output action.");
    }
    if (hiddenPanelTitle(record)) {
      fail("hidden-panel-title", "Keep workspace panel headings available to assistive technology.");
    }

    if (/systemImage\s*:|<svg\b|IconSVG\s*\(/.test(record.text)) {
      warnings.push({ ...record, rule: "new-icon", message: "Confirm the icon has a text or accessibility label." });
    } else if (/createElement\(\s*"button"\s*\)/.test(record.text)) {
      warnings.push({ ...record, rule: "dynamic-button", message: "Confirm name, focus, disabled, and target-size states." });
    }
  });
  return { failures, warnings };
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function sourceContext(root, record) {
  try {
    const lines = readFileSync(resolve(root, record.path), "utf8").split("\n");
    const start = Math.max(0, record.lineNumber - 9);
    const end = Math.min(lines.length, record.lineNumber + 8);
    return lines.slice(start, end).join("\n");
  } catch {
    return record.text;
  }
}

function workingRecords(root, base) {
  const diffArgs = base
    ? ["diff", "--unified=0", `${base}...HEAD`, "--"]
    : ["diff", "--unified=0", "HEAD", "--"];
  let records = parseAddedLines(git(root, diffArgs));
  if (!base) {
    const untracked = git(root, ["ls-files", "--others", "--exclude-standard"])
      .split("\n")
      .filter(Boolean);
    for (const path of untracked) {
      if (!auditablePath(path)) continue;
      const lines = readFileSync(resolve(root, path), "utf8").split("\n");
      records.push(...lines.map((text, index) => ({ path, lineNumber: index + 1, text })));
    }
    if (!records.length) {
      try {
        records = parseAddedLines(git(root, ["diff", "--unified=0", "HEAD^", "HEAD", "--"]));
      } catch {
        records = [];
      }
    }
  }
  return records.map((record) => ({
    ...record,
    context: sourceContext(root, record)
  }));
}

function printIssue(prefix, issue, root) {
  const file = relative(process.cwd(), resolve(root, issue.path)) || issue.path;
  console.error(`${prefix} ${file}:${issue.lineNumber} [${issue.rule}] ${issue.message}`);
}

export function runUXAudit({ root, base = "" }) {
  const records = workingRecords(root, base);
  const result = auditAddedLines(records);
  result.warnings.slice(0, 20).forEach((issue) => printIssue("WARN", issue, root));
  result.failures.forEach((issue) => printIssue("FAIL", issue, root));
  if (result.warnings.length > 20) {
    console.error(`WARN ${result.warnings.length - 20} additional review reminders omitted.`);
  }
  if (result.failures.length) {
    console.error(`UX/UI audit failed with ${result.failures.length} blocking issue(s).`);
    return 1;
  }
  console.log(`UX/UI audit passed (${records.length} added line(s), ${result.warnings.length} review reminder(s)).`);
  return 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  const baseIndex = process.argv.indexOf("--base");
  const base = baseIndex >= 0 ? String(process.argv[baseIndex + 1] || "").trim() : String(process.env.UX_AUDIT_BASE || "").trim();
  process.exitCode = runUXAudit({ root, base });
}

const credentialPathPattern = /(?:^|\/)(?:\.env(?:\.|$)|credentials?(?:\.|$)|secrets?(?:\.|$))|\.(?:p8|p12|pem|key|mobileprovision)$/i;
const allowanceMarker = "permitext-secret-scan-allow:";

const addedLineRules = Object.freeze([
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["provider-secret-key", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{16,}\b/],
  ["openai-secret-key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ["jwt-literal", /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b/],
  ["credential-assignment", /\b(?:api[_-]?key|client[_-]?secret|password|private[_-]?key|token)\b\s*[:=]\s*["'][A-Za-z0-9_./+=-]{20,}["']/i]
]);

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort();
}

function normalizeRepositoryPath(value) {
  return String(value || "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/\/$/, "");
}

function validCommit(value) {
  return /^[0-9a-f]{40}$/i.test(String(value || ""));
}

function pathAllowed(path, allowedPaths) {
  return allowedPaths.some((allowed) => path === allowed || path.startsWith(`${allowed}/`));
}

export function parseGitPorcelainPaths(source) {
  const entries = String(source || "").split("\0");
  const paths = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry) continue;
    const status = entry.slice(0, 2);
    const path = normalizeRepositoryPath(entry.slice(3));
    if (path) paths.push(path);
    if (/[RC]/.test(status) && entries[index + 1]) {
      const originalPath = normalizeRepositoryPath(entries[index + 1]);
      if (originalPath) paths.push(originalPath);
      index += 1;
    }
  }
  return uniqueSorted(paths);
}

export function scanAddedLinesForCredentials(source) {
  const findings = [];
  let path = "";
  let nextLine = 0;
  let previousAdded = null;
  for (const line of String(source || "").split("\n")) {
    if (line.startsWith("+++ b/")) {
      path = normalizeRepositoryPath(line.slice(6));
      previousAdded = null;
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      nextLine = Number(hunk[1]);
      continue;
    }
    if (!path || line.startsWith("--- ") || line.startsWith("+++ ")) continue;
    if (line.startsWith("+")) {
      const value = line.slice(1);
      const allowed = value.includes(allowanceMarker) || Boolean(
        previousAdded &&
        previousAdded.path === path &&
        previousAdded.lineNumber === nextLine - 1 &&
        previousAdded.value.includes(allowanceMarker)
      );
      if (!allowed) {
        for (const [kind, pattern] of addedLineRules) {
          if (pattern.test(value)) findings.push({ path, lineNumber: nextLine, kind });
        }
      }
      previousAdded = { path, lineNumber: nextLine, value };
      nextLine += 1;
    } else if (!line.startsWith("-") && !line.startsWith("\\ No newline")) {
      nextLine += 1;
    }
  }
  return findings;
}

export function auditReleaseBranchIntegrity(input = {}) {
  const expectedBranch = String(input.expectedBranch || "").trim();
  const actualBranch = String(input.actualBranch || "").trim();
  const baseCommit = String(input.baseCommit || "").trim().toLowerCase();
  const headCommit = String(input.headCommit || "").trim().toLowerCase();
  const mergeBase = String(input.mergeBase || "").trim().toLowerCase();
  const aheadCount = Number(input.aheadCount);
  const behindCount = Number(input.behindCount);
  const dirtyPaths = uniqueSorted((input.dirtyPaths || []).map(normalizeRepositoryPath));
  const allowedDirtyPaths = uniqueSorted((input.allowedDirtyPaths || []).map(normalizeRepositoryPath));
  const changedPaths = uniqueSorted((input.changedPaths || []).map(normalizeRepositoryPath));
  const unexpectedDirtyPaths = dirtyPaths.filter((path) => !pathAllowed(path, allowedDirtyPaths));
  const allowedDirtyPathsPresent = dirtyPaths.filter((path) => pathAllowed(path, allowedDirtyPaths));
  const credentialLikePaths = changedPaths.filter((path) => credentialPathPattern.test(path));
  const credentialFindings = scanAddedLinesForCredentials(input.addedLineDiff);
  const checks = [
    { id: "valid-base-commit", passed: validCommit(baseCommit) },
    { id: "valid-head-commit", passed: validCommit(headCommit) },
    { id: "expected-branch", passed: Boolean(expectedBranch) && actualBranch === expectedBranch },
    { id: "base-is-merge-base", passed: validCommit(baseCommit) && mergeBase === baseCommit },
    { id: "base-not-ahead-of-head", passed: Number.isInteger(behindCount) && behindCount === 0 },
    { id: "ahead-count-resolved", passed: Number.isInteger(aheadCount) && aheadCount >= 0 },
    { id: "diff-check", passed: input.diffCheckPassed === true },
    { id: "dirty-scope", passed: unexpectedDirtyPaths.length === 0 },
    { id: "credential-like-paths", passed: credentialLikePaths.length === 0 },
    { id: "redacted-added-line-scan", passed: credentialFindings.length === 0 }
  ];

  return {
    schema: "permitext-release-branch-integrity-v1",
    sourceIntegrityReady: checks.every((check) => check.passed),
    releaseAuthorized: false,
    manualSemanticReviewRequired: true,
    expectedBranch,
    actualBranch,
    baseCommit,
    headCommit,
    mergeBase,
    aheadCount,
    behindCount,
    checks,
    changedPathCount: changedPaths.length,
    dirtyPathCount: dirtyPaths.length,
    allowedDirtyPathsPresent,
    unexpectedDirtyPaths,
    credentialLikePaths,
    credentialFindings,
    privacy: {
      secretValuesEmitted: false,
      diffContentEmitted: false
    },
    remainingBoundaries: [
      "This automated preflight is not a semantic, line-by-line human review.",
      "It does not select or authorize a release commit.",
      "It does not authorize a push, merge, deployment, charge, provider change, pricing change, or public release."
    ]
  };
}

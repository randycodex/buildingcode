import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { auditReleaseBranchIntegrity, parseGitPorcelainPaths } from "../release-branch-integrity.mjs";

function argumentValues(name) {
  const values = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    if (process.argv[index] !== name) continue;
    const value = String(process.argv[index + 1] || "").trim();
    if (!value) throw new Error(`${name} requires a value.`);
    values.push(value);
    index += 1;
  }
  return values;
}

function requiredArgument(name) {
  const values = argumentValues(name);
  if (values.length !== 1) throw new Error(`Provide exactly one ${name} value.`);
  return values[0];
}

function git(root, args, { allowFailure = false, maxBuffer = 64 * 1024 * 1024 } = {}) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer });
  if (result.error) throw new Error(`Unable to run git ${args[0]}.`);
  if (!allowFailure && result.status !== 0) throw new Error(`git ${args[0]} failed.`);
  return result;
}

const repositoryRoot = resolve(argumentValues("--repo")[0] || git(process.cwd(), ["rev-parse", "--show-toplevel"]).stdout.trim());
const expectedBranch = requiredArgument("--expected-branch");
const requestedBase = requiredArgument("--base");
const allowedDirtyPaths = argumentValues("--allow-dirty");
const baseCommit = git(repositoryRoot, ["rev-parse", "--verify", `${requestedBase}^{commit}`]).stdout.trim();
const headCommit = git(repositoryRoot, ["rev-parse", "HEAD"]).stdout.trim();
const actualBranch = git(repositoryRoot, ["branch", "--show-current"]).stdout.trim();
const mergeBase = git(repositoryRoot, ["merge-base", baseCommit, headCommit]).stdout.trim();
const aheadCount = Number(git(repositoryRoot, ["rev-list", "--count", `${baseCommit}..${headCommit}`]).stdout.trim());
const behindCount = Number(git(repositoryRoot, ["rev-list", "--count", `${headCommit}..${baseCommit}`]).stdout.trim());
const dirtyPaths = parseGitPorcelainPaths(
  git(repositoryRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]).stdout
);
const changedPaths = git(repositoryRoot, ["diff", "--name-only", "-z", `${baseCommit}...${headCommit}`]).stdout
  .split("\0")
  .filter(Boolean);
const diffCheck = git(repositoryRoot, ["diff", "--check", `${baseCommit}...${headCommit}`], { allowFailure: true });
const addedLineDiff = git(repositoryRoot, [
  "diff",
  "--unified=0",
  "--no-ext-diff",
  `${baseCommit}...${headCommit}`,
  "--",
  "*.mjs",
  "*.js",
  "*.json",
  "*.md",
  "*.swift",
  "*.plist",
  "*.yml",
  "*.yaml",
  "*.toml",
  "*.sh",
  "*.html",
  "*.css",
  "*.sql",
  "*.py",
  "*.ts",
  "*.tsx",
  ":!NYC CC APP/permitext/Resources/CodeContent/**"
]).stdout;

const report = auditReleaseBranchIntegrity({
  expectedBranch,
  actualBranch,
  baseCommit,
  headCommit,
  mergeBase,
  aheadCount,
  behindCount,
  diffCheckPassed: diffCheck.status === 0,
  dirtyPaths,
  allowedDirtyPaths,
  changedPaths,
  addedLineDiff
});

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.sourceIntegrityReady) process.exitCode = 1;

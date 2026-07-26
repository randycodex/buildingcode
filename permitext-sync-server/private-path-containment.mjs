import { isAbsolute, resolve, sep } from "node:path";

export function resolveContainedPrivatePath(root, pathname) {
  const normalizedRoot = String(root || "").trim();
  const normalizedPathname = String(pathname || "").trim();
  if (
    !normalizedRoot ||
    !normalizedPathname ||
    normalizedPathname.includes("\0") ||
    normalizedPathname.includes("\\") ||
    isAbsolute(normalizedPathname)
  ) {
    throw new Error("Invalid private project asset path.");
  }
  const rootPath = resolve(normalizedRoot);
  const candidatePath = resolve(rootPath, normalizedPathname);
  if (
    candidatePath === rootPath ||
    !candidatePath.startsWith(`${rootPath}${sep}`)
  ) {
    throw new Error("Private project asset path escapes its configured root.");
  }
  return candidatePath;
}

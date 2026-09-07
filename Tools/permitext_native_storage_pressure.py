#!/usr/bin/env python3
"""Manual macOS acceptance: real APFS ENOSPC against the shipped native cache.

Uses a disposable 128 MiB disk image, synthetic Codable payloads, and separate
processes for restart checks. Does not fill the host volume or use an app account.
This is not an iOS UI, browser quota, or OS eviction test.
"""
import argparse
import datetime
import errno
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


SWIFT_HARNESS = r'''
// Only a namespace adapter for the unrelated legacy migration scope constant.
enum ResearchQuestionAttempt { static let cacheScope = "__RESEARCH_SCOPE__" }

struct SyntheticDraft: Codable, Sendable, Equatable {
    let revision: Int
    let title: String
    let pendingSave: [String: String]
    let imageBytes: Data
}

func require(_ condition: Bool, _ message: String) throws {
    if !condition { throw NSError(domain: "StoragePressureAssertion", code: 1,
        userInfo: [NSLocalizedDescriptionKey: message]) }
}
func draft(_ revision: Int) -> SyntheticDraft {
    SyntheticDraft(revision: revision,
        title: String(repeating: revision == 1 ? "original unsent text " : "newer unsent text ",
                      count: revision == 1 ? 2000 : 70000),
        pendingSave: ["clientMutationID": "synthetic-original-request", "expectedVersion": "7",
                      "title": "Exact original pending request"],
        imageBytes: Data((0..<65536).map { UInt8($0 % 251) }))
}
func errorChain(_ error: Error) -> [[String: Any]] {
    var result: [[String: Any]] = []
    var current: NSError? = error as NSError
    while let item = current, result.count < 8 {
        result.append(["domain": item.domain, "code": item.code])
        current = item.userInfo[NSUnderlyingErrorKey] as? NSError
    }
    return result
}

let phase = CommandLine.arguments[1]
let cache = ProjectHubOfflineCache(directoryURL: URL(fileURLWithPath: CommandLine.arguments[2]))
let account = "synthetic-storage-pressure-a"
let otherAccount = "synthetic-storage-pressure-b"
let project = "synthetic-project"
let scope = "native-notebook-draft:synthetic-existing"
let newScope = "native-notebook-draft:synthetic-new"
var result: [String: Any] = ["phase": phase, "pid": ProcessInfo.processInfo.processIdentifier]
func read(_ owner: String, _ key: String) throws -> SyntheticDraft? {
    try cache.load(SyntheticDraft.self, accountID: owner, projectID: project, scope: key)?.value
}
switch phase {
case "seed":
    for owner in [account, otherAccount] {
        try cache.store(draft(1), accountID: owner, projectID: project, scope: scope)
    }
    result["seededAccounts"] = 2
case "full":
    var failures: [[String: Any]] = []
    for key in [scope, newScope] {
        var failure: Error?
        do { try cache.store(draft(2), accountID: account, projectID: project, scope: key) }
        catch { failure = error }
        try require(failure != nil, "Write unexpectedly succeeded on the full volume")
        let chain = errorChain(failure!)
        try require(chain.contains { ($0["domain"] as? String == NSPOSIXErrorDomain && $0["code"] as? Int == 28)
            || ($0["domain"] as? String == NSCocoaErrorDomain && $0["code"] as? Int == NSFileWriteOutOfSpaceError) },
            "Expected real out-of-space error")
        failures.append(["scope": key, "errors": chain])
    }
    result["failedWrites"] = failures
    fallthrough
case "restart-full":
    try require(try read(account, scope) == draft(1), "Previously durable draft changed")
    try require(try read(otherAccount, scope) == draft(1), "Other account changed")
    try require(try read(account, newScope) == nil, "Failed new write became a durable draft")
    let entries = try cache.entries(SyntheticDraft.self, accountID: account, projectID: project,
                                   scopePrefix: "native-notebook-draft:")
    try require(entries.count == 1 && entries[0].value == draft(1), "Recovery listing changed")
    result["previousDraftAndPendingSaveAndImageExact"] = true
    result["otherAccountExact"] = true
    result["failedNewDraftAbsent"] = true
case "retry":
    for key in [scope, newScope] {
        try cache.store(draft(2), accountID: account, projectID: project, scope: key)
    }
    result["retriedWrites"] = 2
case "restart-recovered":
    for key in [scope, newScope] {
        try require(try read(account, key) == draft(2), "Retry did not become durable")
    }
    try require(try read(otherAccount, scope) == draft(1), "Other account changed after retry")
    result["retriedDraftsAndPendingSaveAndImageExact"] = true
    result["otherAccountExact"] = true
default: fatalError("Unknown phase")
}
result["passed"] = true
print(String(data: try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), encoding: .utf8)!)
'''


def run(*args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=60, **kwargs).stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    if sys.platform != "darwin":
        raise RuntimeError("This acceptance harness requires macOS and APFS")
    if args.receipt.exists():
        raise RuntimeError("Refusing to overwrite an existing receipt")
    root = Path(__file__).resolve().parents[1]
    cache_path = root / "NYC CC APP/permitext/Data/ProjectHubOfflineCache.swift"
    research_path = root / "NYC CC APP/permitext/Views/ResearchView.swift"
    source = cache_path.read_text()
    boundary = "/// A new session invalidates even responses for the same account after sign-out/sign-in."
    assert source.count(boundary) == 1
    cache_source = source.split(boundary)[0]
    scope = re.search(r'static let cacheScope = "([^"\n]+)"', research_path.read_text()).group(1)
    assert re.fullmatch(r"[a-z-]+", scope)
    temporary = Path(tempfile.mkdtemp(prefix="permitext-native-pressure-"))
    mounted = False
    cleaned = False
    receipt = {"startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
               "sourceSHA256": hashlib.sha256(source.encode()).hexdigest(),
               "compiledCachePrefixSHA256": hashlib.sha256(cache_source.encode()).hexdigest(),
               "scope": "Shipped native cache on macOS APFS; synthetic Codable payload, real ENOSPC, process restarts",
               "volumeLimitMiB": 128, "phases": []}
    mount = temporary / "mount"
    try:
        if shutil.disk_usage(temporary).free < 1024 ** 3:
            raise RuntimeError("Need at least 1 GiB of host free space")
        main_source = temporary / "main.swift"
        main_source.write_text(cache_source + SWIFT_HARNESS.replace("__RESEARCH_SCOPE__", scope))
        executable = temporary / "cache-pressure"
        receipt["swiftVersion"] = run("xcrun", "swiftc", "--version").strip()
        run("xcrun", "swiftc", "-o", str(executable), str(main_source))
        image = temporary / "bounded.dmg"
        print("Compiled shipped cache; creating isolated 128 MiB APFS volume", flush=True)
        run("hdiutil", "create", "-size", "128m", "-fs", "APFS", "-volname", "PermitextSyntheticPressure", str(image))
        mount.mkdir()
        run("hdiutil", "attach", "-nobrowse", "-mountpoint", str(mount), str(image))
        mounted = True
        if mount.stat().st_dev == temporary.stat().st_dev:
            raise RuntimeError("Refusing to fill the host filesystem")
        capacity = shutil.disk_usage(mount).total
        if not 0 < capacity <= 128 * 1024 ** 2:
            raise RuntimeError("Mounted volume exceeds the declared bound")
        receipt["volumeCapacityBytes"] = capacity
        cache = mount / "ProjectHubCache"

        def phase(name):
            value = json.loads(run(str(executable), name, str(cache)))
            receipt["phases"].append(value)
            print(f"{name}: passed", flush=True)

        phase("seed")
        before = {str(p.relative_to(cache)): hashlib.sha256(p.read_bytes()).hexdigest()
                  for p in cache.rglob("*.json")}
        filler = mount / "synthetic-pressure.bin"
        written = 0
        with filler.open("wb", buffering=0) as stream:
            for block_size in [65536, 4096]:
                while True:
                    if written + block_size > 128 * 1024 ** 2:
                        raise RuntimeError("Reached fill bound without ENOSPC")
                    try:
                        written += stream.write(os.urandom(block_size))
                    except OSError as error:
                        if error.errno != errno.ENOSPC:
                            raise
                        break
            try:
                os.fsync(stream.fileno())
            except OSError as error:
                if error.errno != errno.ENOSPC:
                    raise
        receipt["fillerBytes"] = written
        receipt["fillerErrno"] = errno.ENOSPC
        receipt["freeBytesAtFailure"] = shutil.disk_usage(mount).free
        phase("full")
        phase("restart-full")
        after = {str(p.relative_to(cache)): hashlib.sha256(p.read_bytes()).hexdigest()
                 for p in cache.rglob("*.json")}
        assert before == after, "Failed writes changed durable cache files"
        receipt["durableFilesUnchangedAtFailure"] = before
        filler.unlink()
        receipt["freeBytesBeforeRetry"] = shutil.disk_usage(mount).free
        phase("retry")
        phase("restart-recovered")
        assert len({item["pid"] for item in receipt["phases"]}) == 5
        receipt["passed"] = True
    finally:
        if mounted:
            run("hdiutil", "detach", str(mount))
        shutil.rmtree(temporary)
        cleaned = True
        print("Disposable volume detached and test files removed", flush=True)
    receipt["cleanupComplete"] = cleaned
    receipt["finishedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with args.receipt.open("x") as output:
        json.dump(receipt, output, indent=2)
        output.write("\n")
    print(f"Receipt: {args.receipt}")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        print(error.stderr, file=sys.stderr)
        raise

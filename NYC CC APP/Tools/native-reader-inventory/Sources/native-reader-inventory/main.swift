import Darwin
import Foundation
import NativeReaderInventoryCore

private struct Options {
    var sourceRoot: String?
    var reportPath: String?
    var manifestPath: String?
    var workerChapterPath: String?
    var checkOnly = false
}

private enum CommandLineError: LocalizedError {
    case missingValue(String)
    case unknownArgument(String)
    case workerFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingValue(let argument): "Missing value for \(argument)"
        case .unknownArgument(let argument): "Unknown argument: \(argument)"
        case .workerFailed(let message): "Chapter inventory worker failed: \(message)"
        }
    }
}

private func parseOptions(arguments: [String]) throws -> Options {
    var options = Options()
    var index = 0
    while index < arguments.count {
        let argument = arguments[index]
        switch argument {
        case "--source-root", "--report", "--manifest", "--worker-chapter":
            guard arguments.indices.contains(index + 1) else {
                throw CommandLineError.missingValue(argument)
            }
            let value = arguments[index + 1]
            switch argument {
            case "--source-root": options.sourceRoot = value
            case "--report": options.reportPath = value
            case "--manifest": options.manifestPath = value
            default: options.workerChapterPath = value
            }
            index += 2
        case "--check":
            options.checkOnly = true
            index += 1
        default:
            throw CommandLineError.unknownArgument(argument)
        }
    }
    return options
}

private func repositoryRoot(fileManager: FileManager) -> URL {
    var candidate = URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true).standardizedFileURL
    while candidate.path != "/" {
        let plan = candidate.appendingPathComponent("NATIVE_IOS_READER_MIGRATION_PLAN.md")
        let app = candidate.appendingPathComponent("NYC CC APP", isDirectory: true)
        if fileManager.fileExists(atPath: plan.path), fileManager.fileExists(atPath: app.path) {
            return candidate
        }
        candidate.deleteLastPathComponent()
    }
    return URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true).standardizedFileURL
}

private func resolvedURL(_ path: String, relativeTo repositoryRoot: URL) -> URL {
    if path.hasPrefix("/") {
        return URL(fileURLWithPath: path).standardizedFileURL
    }
    return repositoryRoot.appendingPathComponent(path).standardizedFileURL
}

private func relativePath(_ url: URL, below root: URL) -> String {
    let rootPath = root.standardizedFileURL.path
    let path = url.standardizedFileURL.path
    guard path.hasPrefix(rootPath + "/") else { return path }
    return String(path.dropFirst(rootPath.count + 1))
}

private func writeOrCheck(_ data: Data, at url: URL, checkOnly: Bool, fileManager: FileManager) throws {
    if checkOnly {
        guard let existing = try? Data(contentsOf: url), existing == data else {
            throw CorpusInventoryError.reportMismatch(url.path)
        }
        return
    }
    try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try data.write(to: url, options: .atomic)
}

private func executableURL(fileManager: FileManager) -> URL {
    let path = CommandLine.arguments[0]
    if path.hasPrefix("/") {
        return URL(fileURLWithPath: path).standardizedFileURL
    }
    return URL(
        fileURLWithPath: path,
        relativeTo: URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true)
    ).standardizedFileURL
}

private func analyzeChaptersInIsolatedWorkers(
    generator: CorpusInventoryGenerator,
    sourceRoot: URL,
    fileManager: FileManager
) throws -> [ChapterInventory] {
    let chapterURLs = try generator.authoredChapterURLs(below: sourceRoot)
    guard !chapterURLs.isEmpty else {
        throw CorpusInventoryError.noChapterFiles(sourceRoot.path)
    }

    let queue = OperationQueue()
    queue.name = "permitext.native-reader-inventory"
    queue.maxConcurrentOperationCount = 2
    let lock = NSLock()
    var chaptersByIndex: [Int: ChapterInventory] = [:]
    var failures: [String] = []
    let binaryURL = executableURL(fileManager: fileManager)

    for (index, chapterURL) in chapterURLs.enumerated() {
        queue.addOperation {
            autoreleasepool {
                let process = Process()
                let output = Pipe()
                process.executableURL = binaryURL
                process.arguments = [
                    "--source-root", sourceRoot.path,
                    "--worker-chapter", chapterURL.path
                ]
                process.standardOutput = output
                process.standardError = FileHandle.standardError

                do {
                    try process.run()
                    let data = output.fileHandleForReading.readDataToEndOfFile()
                    process.waitUntilExit()
                    guard process.terminationStatus == 0 else {
                        throw CommandLineError.workerFailed("\(chapterURL.path) exited \(process.terminationStatus)")
                    }
                    let chapter = try JSONDecoder().decode(ChapterInventory.self, from: data)
                    lock.lock()
                    chaptersByIndex[index] = chapter
                    lock.unlock()
                } catch {
                    lock.lock()
                    failures.append("\(chapterURL.path): \(error.localizedDescription)")
                    lock.unlock()
                }
            }
        }
    }
    queue.waitUntilAllOperationsAreFinished()

    guard failures.isEmpty else {
        throw CommandLineError.workerFailed(failures.sorted().joined(separator: " | "))
    }
    return chapterURLs.indices.compactMap { chaptersByIndex[$0] }
}

do {
    let options = try parseOptions(arguments: Array(CommandLine.arguments.dropFirst()))
    let fileManager = FileManager.default
    let root = repositoryRoot(fileManager: fileManager)
    let sourceRoot = resolvedURL(
        options.sourceRoot ?? "NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city",
        relativeTo: root
    )
    let reportURL = resolvedURL(
        options.reportPath ?? "NYC CC APP/docs/native-reader/corpus-inventory.json",
        relativeTo: root
    )
    let manifestURL = resolvedURL(
        options.manifestPath ?? "NYC CC APP/docs/native-reader/eligibility-manifest.json",
        relativeTo: root
    )

    let generator = CorpusInventoryGenerator(fileManager: fileManager)
    if let workerChapterPath = options.workerChapterPath {
        let chapter = generator.analyzeChapter(
            fileURL: resolvedURL(workerChapterPath, relativeTo: root),
            sourceRoot: sourceRoot
        )
        FileHandle.standardOutput.write(try CorpusInventoryGenerator.encodedJSON(chapter))
        exit(EXIT_SUCCESS)
    }

    let chapters = try analyzeChaptersInIsolatedWorkers(
        generator: generator,
        sourceRoot: sourceRoot,
        fileManager: fileManager
    )
    let report = generator.makeReport(
        chapters: chapters,
        sourceRoot: sourceRoot,
        reportedSourceRoot: relativePath(sourceRoot, below: root)
    )
    let manifest = NativeReaderEligibilityManifest(report: report)
    try writeOrCheck(
        CorpusInventoryGenerator.encodedJSON(report),
        at: reportURL,
        checkOnly: options.checkOnly,
        fileManager: fileManager
    )
    try writeOrCheck(
        CorpusInventoryGenerator.encodedJSON(manifest),
        at: manifestURL,
        checkOnly: options.checkOnly,
        fileManager: fileManager
    )

    let verb = options.checkOnly ? "Verified" : "Generated"
    print("\(verb) native reader corpus inventory")
    print("Chapters: \(report.summary.chapterCount)")
    print("Tables: \(report.summary.tableCount) in \(report.summary.chapterCountWithTables) chapters")
    print("Images/SVG: \(report.summary.imageCount) in \(report.summary.chapterCountWithImages) chapters")
    print("Eligibility: \(report.summary.eligibilityCounts.keys.sorted().map { "\($0)=\(report.summary.eligibilityCounts[$0] ?? 0)" }.joined(separator: ", "))")
    print("Corpus SHA-256: \(report.corpusSHA256)")
} catch {
    fputs("native-reader-inventory: \(error.localizedDescription)\n", stderr)
    exit(EXIT_FAILURE)
}

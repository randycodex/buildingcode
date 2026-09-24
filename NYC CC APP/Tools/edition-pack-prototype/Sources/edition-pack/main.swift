import Foundation
import EditionPackPrototype
// Local directory transport only. No downloading, signatures or app integration.
do {
    let args = CommandLine.arguments
    guard args.count == 5, args[1] == "install" else {
        throw NSError(domain: "Usage: edition-pack install SOURCE ROOT EXPECTED_MANIFEST_SHA256", code: 1)
    }
    let store = try PackStore(root: URL(fileURLWithPath: args[3]))
    let began = Date()
    let source = URL(fileURLWithPath: args[2])
    let manifest = try store.install(from: source, expectedManifestDigest: args[4])
    let result: [String: Any] = ["packID": manifest.packID, "revision": manifest.revision,
        "elapsedSeconds": Date().timeIntervalSince(began),
        "logicalBytes": manifest.files.reduce(0) { $0 + $1.bytes } + (try Data(contentsOf: source.appendingPathComponent("manifest.json"))).count]
    print(String(decoding: try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), as: UTF8.self))
} catch {
    FileHandle.standardError.write(Data("\(error)\n".utf8))
    exit(1)
}

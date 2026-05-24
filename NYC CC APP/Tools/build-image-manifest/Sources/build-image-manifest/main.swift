import Foundation

struct ImageManifest: Encodable {
    let schemaVersion: Int
    let items: [String: String]
}

let imageExtensions: Set<String> = ["png", "jpg", "jpeg", "gif", "webp", "svg", "tif", "tiff", "bmp", "heic"]

guard CommandLine.arguments.count >= 3 else {
    fputs("Usage: build-image-manifest <bundle-root> <output-images.json>\n", stderr)
    exit(1)
}

let bundleRoot = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])

var items: [String: String] = [:]

func register(relativePath: String, fileName: String) {
    items[fileName] = relativePath
    let baseName = (fileName as NSString).deletingPathExtension
    if !baseName.isEmpty, baseName != fileName {
        if items[baseName] == nil {
            items[baseName] = relativePath
        }
    }
}

func scan(directory: URL, relativePrefix: String) {
    guard let enumerator = FileManager.default.enumerator(
        at: directory,
        includingPropertiesForKeys: [.isRegularFileKey],
        options: [.skipsHiddenFiles]
    ) else { return }

    for case let fileURL as URL in enumerator {
        guard (try? fileURL.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true else { continue }
        let ext = fileURL.pathExtension.lowercased()
        guard imageExtensions.contains(ext) else { continue }

        let relativePath: String
        if relativePrefix.isEmpty {
            relativePath = fileURL.lastPathComponent
        } else {
            let subpath = fileURL.path.replacingOccurrences(of: directory.path + "/", with: "")
            relativePath = "\(relativePrefix)/\(subpath)"
        }
        register(relativePath: relativePath, fileName: fileURL.lastPathComponent)
    }
}

let assetsURL = bundleRoot.appendingPathComponent("assets", isDirectory: true)
if FileManager.default.fileExists(atPath: assetsURL.path) {
    scan(directory: assetsURL, relativePrefix: "assets")
}
scan(directory: bundleRoot, relativePrefix: "")

let manifest = ImageManifest(schemaVersion: 1, items: items)
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
let data = try encoder.encode(manifest)
try data.write(to: outputURL, options: .atomic)
fputs("Wrote \(items.count) image keys to \(outputURL.path)\n", stderr)

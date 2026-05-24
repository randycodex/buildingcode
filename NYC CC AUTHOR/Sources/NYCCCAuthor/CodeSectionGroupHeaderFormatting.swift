import Foundation

enum CodeSectionGroupHeaderFormatting {
    private static let knownPrefixes = ["BC", "FGC", "MC", "PC"]

    static func defaultPrefix(for codeSectionName: String?) -> String {
        let name = (codeSectionName ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()

        if name.contains("FUEL GAS") {
            return "FGC"
        }
        if name.contains("MECHANICAL") {
            return "MC"
        }
        if name.contains("PLUMBING") {
            return "PC"
        }
        return "BC"
    }

    /// Builds `SECTION {PREFIX} {ID}` using an explicit authored prefix when present,
    /// otherwise the code-book default. Dotted section IDs (e.g. `402.8`) stay unprefixed.
    static func formattedSectionHeader(
        explicitPrefix: String?,
        sectionID: String,
        codeSectionName: String?
    ) -> String {
        var id = sectionID
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
        var prefix = explicitPrefix?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()

        if prefix == nil {
            for candidate in knownPrefixes {
                if id.hasPrefix("\(candidate) ") {
                    prefix = candidate
                    id = String(id.dropFirst(candidate.count + 1))
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    break
                }
            }
        }

        if let prefix, !prefix.isEmpty {
            return "SECTION \(prefix) \(id)"
        }

        if shouldOmitCodeBookPrefix(forSectionID: id) {
            return "SECTION \(id)"
        }

        return "SECTION \(defaultPrefix(for: codeSectionName)) \(id)"
    }

    static func shouldOmitCodeBookPrefix(forSectionID sectionID: String) -> Bool {
        sectionID.contains(".")
    }
}

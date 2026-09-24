import Foundation

/// Canonical content identity, independent of installation state or display names.
struct ActiveCodeSourceIdentity: Codable, Hashable, Comparable {
    let canonicalEdition: String
    let jurisdictionID: Int64
    let codeID: Int64
    let categoryID: Int64

    static func < (left: Self, right: Self) -> Bool {
        if left.canonicalEdition != right.canonicalEdition { return left.canonicalEdition < right.canonicalEdition }
        if left.jurisdictionID != right.jurisdictionID { return left.jurisdictionID < right.jurisdictionID }
        if left.codeID != right.codeID { return left.codeID < right.codeID }
        return left.categoryID < right.categoryID
    }
}

/// Preference only: disabling never deletes content or removes a saved reference.
/// Absent catalog identities are intentionally retained for later reinstallation.
struct ActiveCodeSources: Codable, Equatable {
    enum FormatError: Error { case unsupportedVersion(Int) }
    private(set) var disabledSources: Set<ActiveCodeSourceIdentity>
    private enum CodingKeys: String, CodingKey { case version, disabledSources }

    init() { disabledSources = [] }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let version = try container.decode(Int.self, forKey: .version)
        guard version == 1 else { throw FormatError.unsupportedVersion(version) }
        disabledSources = Set(try container.decode([ActiveCodeSourceIdentity].self, forKey: .disabledSources))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(1, forKey: .version)
        try container.encode(disabledSources.sorted(), forKey: .disabledSources)
    }

    /// nil means no prior preference; malformed existing data remains an error.
    static func decodePreference(_ data: Data?) throws -> Self {
        guard let data else { return Self() }
        return try JSONDecoder().decode(Self.self, from: data)
    }

    func isEnabled(_ source: ActiveCodeSourceIdentity) -> Bool {
        !disabledSources.contains(source)
    }

    mutating func disable(_ source: ActiveCodeSourceIdentity) { disabledSources.insert(source) }
    mutating func enable(_ source: ActiveCodeSourceIdentity) { disabledSources.remove(source) }

    func enabledSources(in installed: [ActiveCodeSourceIdentity]) -> [ActiveCodeSourceIdentity] {
        Set(installed).filter { isEnabled($0) }.sorted()
    }

    /// Stable scope identity for query caches. Only currently installed/enabled
    /// sources participate, while absent disabled preferences remain retained.
    func scopeFingerprint(installed: [ActiveCodeSourceIdentity]) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return String(decoding: try encoder.encode(enabledSources(in: installed)), as: UTF8.self)
    }
}

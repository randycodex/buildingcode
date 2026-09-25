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

/// Account-scoped local preferences. Callers supply the current account identity
/// for each operation; this store never caches another account's decoded state.
struct ActiveCodeSourcePreferences {
    enum StorageError: Error { case unexpectedStoredType }
    private let defaults: UserDefaults
    private let keyPrefix: String

    init(defaults: UserDefaults, keyPrefix: String = "permitext.active-code-sources.v1.") {
        self.defaults = defaults
        self.keyPrefix = keyPrefix
    }

    private func key(accountID: String?) -> String {
        guard let accountID else { return keyPrefix + "guest" }
        // Base64 is injective over exact UTF-8 bytes; no trimming, normalization,
        // delimiter splitting or reserved account-name aliases are applied.
        return keyPrefix + "account." + Data(accountID.utf8).base64EncodedString()
    }

    func load(accountID: String?) throws -> ActiveCodeSources {
        guard let stored = defaults.object(forKey: key(accountID: accountID)) else {
            return ActiveCodeSources()
        }
        guard let data = stored as? Data else { throw StorageError.unexpectedStoredType }
        return try ActiveCodeSources.decodePreference(data)
    }

    /// A failed read or mutation leaves the existing stored value untouched.
    @discardableResult
    func update(accountID: String?, mutation: (inout ActiveCodeSources) throws -> Void) throws -> ActiveCodeSources {
        var preference = try load(accountID: accountID)
        try mutation(&preference)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let encoded = try encoder.encode(preference)
        defaults.set(encoded, forKey: key(accountID: accountID))
        return preference
    }
}

/// An exact passage identity established from catalog metadata, without reading
/// its body. Edition strings must already use the application's canonical form.
struct ActiveCodeSourceNavigationTarget: Hashable {
    let sectionID: Int64
    let source: ActiveCodeSourceIdentity
}

/// Pure decision for a *new* explicit navigation. It neither enables sources
/// nor changes a Reader, saved reference, account, or installation.
enum ActiveCodeSourceNavigationAccess: Equatable {
    enum UnavailableReason: Equatable {
        case preferencesUnavailable
        case sourceNotFound
        case ambiguousSource
    }

    case allowed(ActiveCodeSourceNavigationTarget)
    case requiresEnable(ActiveCodeSourceNavigationTarget)
    case unavailable(UnavailableReason)

    static func resolve(
        sectionID: Int64,
        canonicalEdition: String? = nil,
        sourceHint: ActiveCodeSourceIdentity? = nil,
        candidates: [ActiveCodeSourceNavigationTarget],
        preferences: ActiveCodeSources?
    ) -> Self {
        guard let preferences else { return .unavailable(.preferencesUnavailable) }
        // Hints restrict metadata matches; they never manufacture a target or
        // cause a fallback to another edition when the requested one is absent.
        let matching = Set(candidates.filter { candidate in
            candidate.sectionID == sectionID &&
                (canonicalEdition == nil || candidate.source.canonicalEdition == canonicalEdition) &&
                (sourceHint == nil || candidate.source == sourceHint)
        })
        guard !matching.isEmpty else { return .unavailable(.sourceNotFound) }
        guard matching.count == 1, let target = matching.first else {
            return .unavailable(.ambiguousSource)
        }
        return preferences.isEnabled(target.source) ? .allowed(target) : .requiresEnable(target)
    }
}

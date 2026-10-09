import Foundation

/// A deliberate save choice, separate from the last Project opened for Research.
struct NativeReaderSaveDestination: Codable, Hashable, Sendable {
    var projectClientID: String?
    static let unassigned = Self(projectClientID: nil)

    static func project(_ clientID: String) -> Self { Self(projectClientID: clientID) }

    static func load(accountID: String?, defaults: UserDefaults) -> Self {
        guard let accountID, let data = defaults.data(forKey: key(accountID)),
              let value = try? JSONDecoder().decode(Self.self, from: data) else { return .unassigned }
        return value
    }

    func store(accountID: String?, defaults: UserDefaults) {
        guard let accountID, let data = try? JSONEncoder().encode(self) else { return }
        defaults.set(data, forKey: Self.key(accountID))
    }

    func validated(projectClientIDs: Set<String>) -> Self {
        guard let projectClientID else { return .unassigned }
        return projectClientIDs.contains(projectClientID) ? self : .unassigned
    }

    private static func key(_ accountID: String) -> String { "reader-save-destination-v1:\(accountID)" }
}
